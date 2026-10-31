from io import BytesIO

import torch
from PIL import Image, UnidentifiedImageError
from transformers import AutoModelForMultimodalLM, AutoProcessor


MODEL_ID = "HuggingFaceTB/SmolVLM-256M-Instruct"
MAX_NEW_TOKENS = 64


# These load once when backend imports this file.
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    device_map="auto",
)
model.eval()


def answer(image_bytes: bytes, question: str) -> str:
    """Answer a question about an uploaded image."""

    if not image_bytes:
        raise ValueError("Image data is empty")

    question = question.strip()
    if not question:
        raise ValueError("Question is empty")

    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        image.load()
    except (UnidentifiedImageError, OSError) as error:
        raise ValueError("The uploaded file is not a valid image") from error

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

    inputs = processor(
        text=prompt,
        images=[image],
        return_tensors="pt",
    ).to(model.device)

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
        )

    prompt_length = inputs["input_ids"].shape[-1]
    new_tokens = outputs[0][prompt_length:]

    return processor.decode(
        new_tokens,
        skip_special_tokens=True,
    ).strip()