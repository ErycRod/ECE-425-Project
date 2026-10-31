#!/usr/bin/env python3

import argparse
import json
from pathlib import Path

import torch
from PIL import Image
from torch import nn

from vlm import model, processor


HERE = Path(__file__).resolve().parent
DEFAULT_OUTPUT = HERE / "profile_summary.json"

# SmolVLM places its vision encoder and image connector under these names.
VISION_PREFIXES = (
    "model.vision_model",
    "model.connector",
)


def is_vision_component(name: str) -> bool:
    return any(
        name == prefix or name.startswith(prefix + ".")
        for prefix in VISION_PREFIXES
    )


def count_parameters():
    """Count the weights actively used by the vision and language phases."""

    vision_params = 0
    lm_params = 0
    seen = set()

    input_weight = model.get_input_embeddings().weight
    output_layer = model.get_output_embeddings()
    output_weight = output_layer.weight if output_layer is not None else None

    # If input and output embeddings are separate, the input table only
    # performs a row lookup—not a full matrix multiplication per token.
    skip_input_embedding = input_weight is not output_weight

    for name, parameter in model.named_parameters():
        parameter_id = id(parameter)

        if parameter_id in seen:
            continue

        seen.add(parameter_id)

        if skip_input_embedding and parameter is input_weight:
            continue

        count = parameter.numel()

        if is_vision_component(name):
            vision_params += count
        else:
            lm_params += count

    return vision_params, lm_params


def register_vision_hooks():
    """Attach hooks that count vision MACs during one forward pass."""

    totals = {
        "linear": 0,
        "conv2d": 0,
        "attention": 0,
    }
    handles = []

    def linear_hook(module, inputs, output):
        # Every output value uses in_features multiply-accumulates.
        totals["linear"] += output.numel() * module.in_features

    def conv_hook(module, inputs, output):
        kernel_height, kernel_width = module.kernel_size
        values_per_output = (
            module.in_channels // module.groups
        ) * kernel_height * kernel_width

        totals["conv2d"] += output.numel() * values_per_output

    def attention_hook(module, inputs, kwargs):
        """Count QKᵀ and attention-value matrix multiplications."""

        hidden_states = kwargs.get("hidden_states")

        if hidden_states is None and inputs:
            hidden_states = inputs[0]

        if not torch.is_tensor(hidden_states) or hidden_states.ndim < 3:
            return

        tokens = hidden_states.shape[-2]
        hidden_size = hidden_states.shape[-1]
        batches = hidden_states.numel() // (tokens * hidden_size)

        heads = getattr(module, "num_heads", None)
        head_dim = getattr(module, "head_dim", None)

        if heads is None or head_dim is None:
            return

        totals["attention"] += (
            2 * batches * heads * tokens * tokens * head_dim
        )

    for name, module in model.named_modules():
        if not is_vision_component(name):
            continue

        if isinstance(module, nn.Linear):
            handles.append(module.register_forward_hook(linear_hook))

        elif isinstance(module, nn.Conv2d):
            handles.append(module.register_forward_hook(conv_hook))

        elif "Attention" in module.__class__.__name__:
            handles.append(
                module.register_forward_pre_hook(
                    attention_hook,
                    with_kwargs=True,
                )
        )

    return totals, handles


def build_inputs(image, question):
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image"},
                {"type": "text", "text": question},
            ],
        }
    ]

    prompt = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
    )

    return processor(
        text=prompt,
        images=[image],
        return_tensors="pt",
    ).to(model.device)


def profile(image_path: Path, question: str):
    image = Image.open(image_path).convert("RGB")
    image.load()

    inputs = build_inputs(image, question)
    prefill_tokens = int(inputs["input_ids"].shape[-1])

    vision_params, lm_params = count_parameters()
    mac_totals, handles = register_vision_hooks()

    try:
        model.eval()

        # A single forward pass measures vision processing and LM prefill.
        # Generation is intentionally excluded.
        with torch.inference_mode():
            model(
                **inputs,
                use_cache=False,
                return_dict=True,
            )
    finally:
        for handle in handles:
            handle.remove()

    vision_macs = sum(mac_totals.values())

    if vision_params == 0 or lm_params == 0:
        raise RuntimeError("Could not identify the model parameter groups")

    if vision_macs == 0:
        raise RuntimeError("No vision operations were recorded")

    summary = {
        "note": (
            f"profiled SmolVLM-256M using {image_path.name}; "
            f"vision MACs include linear, convolution and attention operations"
        ),
        "vision": {
            "params": int(vision_params),
            "macs": int(vision_macs),
        },
        "lm": {
            "params": int(lm_params),
        },
        "prefill_tokens": prefill_tokens,
    }

    return summary, mac_totals


def main():
    parser = argparse.ArgumentParser(
        description="Profile SmolVLM for the EdgeVLM performance model"
    )
    parser.add_argument(
        "image",
        type=Path,
        help="Representative local image to profile",
    )
    parser.add_argument(
        "--question",
        default="What is shown in this image?",
        help="Question included in the profiled prompt",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON path",
    )
    args = parser.parse_args()

    if not args.image.is_file():
        parser.error(f"Image does not exist: {args.image}")

    summary, mac_totals = profile(args.image, args.question)

    args.output.write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )

    print("\nProfile complete")
    print(f"Vision parameters: {summary['vision']['params']:,}")
    print(f"LM parameters:     {summary['lm']['params']:,}")
    print(f"Prefill tokens:    {summary['prefill_tokens']:,}")
    print(f"Vision linear MACs:    {mac_totals['linear']:,}")
    print(f"Vision Conv2D MACs:    {mac_totals['conv2d']:,}")
    print(f"Vision attention MACs: {mac_totals['attention']:,}")
    print(f"Total vision MACs:     {summary['vision']['macs']:,}")
    print(f"Saved: {args.output}")


if __name__ == "__main__":
    main()