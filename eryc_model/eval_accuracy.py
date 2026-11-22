#!/usr/bin/env python3
"""How much does answer quality drop when SmolVLM's weights are rounded to 16, 8 or 4 bits?

Asks SmolVLM-256M the same image questions with:
  full  : the original weights (reference)
  16    : every Linear weight rounded to 16-bit integers (per-channel scale)
  8     : 8-bit (per-channel)
  4     : 4-bit (per-channel), what our simplest 4-bit hardware would store
  4g    : 4-bit with one scale per group of 128 weights (the standard fix for 4-bit)
and scores the answers against VQAv2 (validation questions from merve/vqav2-small, streamed,
so only the questions used are downloaded).

Run from the repo folder (first run downloads the model and ~100 images):
  python eryc_model/eval_accuracy.py               # 100 questions, ~20-40 min on a laptop CPU
  python eryc_model/eval_accuracy.py --n 20        # quick try
Writes eryc_model/accuracy.json, which the website picks up by itself.
"""
import argparse
import json
import sys
import time
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from vqa_score import accuracy, is_correct  # noqa: E402

DATASET = "merve/vqav2-small"
SETTINGS = [
    {"key": "full", "label": "Full precision", "bits": None, "group_size": None},
    {"key": "16", "label": "16-bit", "bits": 16, "group_size": None},
    {"key": "8", "label": "8-bit", "bits": 8, "group_size": None},
    {"key": "4", "label": "4-bit", "bits": 4, "group_size": None},
    {"key": "4g", "label": "4-bit, groups of 128", "bits": 4, "group_size": 128},
]
PROMPT_SUFFIX = " Answer with a single word or a short phrase."
MAX_NEW_TOKENS = 10
OUTPUT = HERE / "accuracy.json"


def load_questions(n):
    """First n (image, question, answer) items of the VQAv2 validation subset (streamed)."""
    from datasets import load_dataset

    stream = load_dataset(DATASET, split="validation", streaming=True)
    items = []
    for row in stream:
        items.append({"image": row["image"].convert("RGB"), "question": row["question"],
                      "answer": row["multiple_choice_answer"]})
        if len(items) >= n:
            break
    return items


def ask(model, processor, image, question):
    import torch

    messages = [{"role": "user", "content": [{"type": "image"},
                                             {"type": "text", "text": question + PROMPT_SUFFIX}]}]
    prompt = processor.apply_chat_template(messages, add_generation_prompt=True)
    inputs = processor(text=prompt, images=[image], return_tensors="pt").to(model.device)
    with torch.inference_mode():
        out = model.generate(**inputs, max_new_tokens=MAX_NEW_TOKENS, do_sample=False)
    new_tokens = out[0][inputs["input_ids"].shape[-1]:]
    return processor.decode(new_tokens, skip_special_tokens=True).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--n", type=int, default=100, help="number of questions (default 100)")
    parser.add_argument("--out", default=str(OUTPUT))
    args = parser.parse_args()

    print("loading SmolVLM-256M ...", flush=True)
    from vlm import MODEL_ID, model, processor
    from quantize import quantize_model, save_weights

    print("loading", args.n, "questions from", DATASET, "...", flush=True)
    items = load_questions(args.n)
    saved = save_weights(model)

    answers = {}
    results = {}
    started = time.time()
    for setting in SETTINGS:
        info = quantize_model(model, saved, setting["bits"], setting["group_size"])
        t0 = time.time()
        replies = []
        for i, item in enumerate(items):
            replies.append(ask(model, processor, item["image"], item["question"]))
            print("\r  {:<22} {:>3}/{}".format(setting["label"], i + 1, len(items)), end="", flush=True)
        score = accuracy(replies, [item["answer"] for item in items])
        answers[setting["key"]] = replies
        results[setting["key"]] = {
            "score": round(score, 4),
            "label": setting["label"],
            "bits": setting["bits"],
            "group_size": setting["group_size"],
            "layers_rounded": info["layers"],
            "weights_rounded": info["weights"],
            "seconds": round(time.time() - t0, 1),
        }
        print("  ->  {:.1%}".format(score), flush=True)
    quantize_model(model, saved, None)  # put the original weights back

    # a few questions where the answer changed with fewer bits (for the website)
    examples = []
    for i, item in enumerate(items):
        changed = len(set(answers[s["key"]][i].lower() for s in SETTINGS)) > 1
        if changed and len(examples) < 8:
            entry = {"question": item["question"], "answer": item["answer"]}
            for s in SETTINGS:
                entry[s["key"]] = answers[s["key"]][i]
                entry[s["key"] + "_correct"] = is_correct(answers[s["key"]][i], item["answer"])
            examples.append(entry)

    output = {
        **results,
        "order": [s["key"] for s in SETTINGS],
        "metric": "exact match after VQA normalization (lowercase, no punctuation/articles, "
                  "number words to digits); a reply also counts if it starts with the answer",
        "dataset": DATASET + " (VQAv2 validation), first " + str(len(items)) + " questions",
        "n": len(items),
        "model": MODEL_ID,
        "method": "fake quantization of every nn.Linear weight: symmetric round-to-nearest, "
                  "one scale per output channel (4g: per group of 128); activations stay in full precision",
        "examples": examples,
        "total_seconds": round(time.time() - started, 1),
        "date": date.today().isoformat(),
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print("wrote", args.out)
    for s in SETTINGS:
        print("  {:<22} {:.1%}".format(s["label"], results[s["key"]]["score"]))


if __name__ == "__main__":
    main()
