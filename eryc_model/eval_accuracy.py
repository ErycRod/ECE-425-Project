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
  python eryc_model/eval_accuracy.py               # 100 questions, about 1 hour on a laptop CPU
  python eryc_model/eval_accuracy.py --n 20        # quick try (~12 min)
  python eryc_model/eval_accuracy.py --rescore     # re-score saved answers (no model, seconds)
Writes eryc_model/accuracy.json, which the website picks up by itself. Every answer is saved
in it, so a change to the scoring in vqa_score.py only needs --rescore, not a new run.
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
    parser.add_argument("--rescore", action="store_true",
                        help="recompute the scores from the answers saved in --out (no model needed)")
    args = parser.parse_args()

    if args.rescore:
        rescore(args.out)
        return

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

    # every answer, so the scoring can be changed later without running the model again
    replies = []
    for i, item in enumerate(items):
        entry = {"question": item["question"], "answer": item["answer"]}
        for s in SETTINGS:
            entry[s["key"]] = answers[s["key"]][i]
        replies.append(entry)

    output = {
        **results,
        "order": [s["key"] for s in SETTINGS],
        "dataset": DATASET + " (VQAv2 validation), first " + str(len(items)) + " questions",
        "n": len(items),
        "model": MODEL_ID,
        "method": "fake quantization of every nn.Linear weight: symmetric round-to-nearest, "
                  "one scale per output channel (4g: per group of 128); activations stay in full precision",
        "replies": replies,
        "total_seconds": round(time.time() - started, 1),
        "date": date.today().isoformat(),
    }
    score_replies(output)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print("wrote", args.out)
    for s in SETTINGS:
        print("  {:<22} {:.1%}".format(s["label"], output[s["key"]]["score"]))


def same_reply(a, b):
    """The same answer, ignoring case and surrounding spaces."""
    return (a or "").strip().lower() == (b or "").strip().lower()


def score_replies(output):
    """Scores, plus a few questions where fewer bits changed the answer (for the website),
    from the saved replies. Used after a run and by --rescore."""
    replies = output["replies"]
    keys = [s["key"] for s in SETTINGS if s["key"] in output]
    for key in keys:
        output[key]["score"] = round(accuracy([r[key] for r in replies], [r["answer"] for r in replies]), 4)
    # how many answers each precision kept identical to full precision, and how many it
    # turned from right to wrong ("lost") or wrong to right ("gained")
    if "full" in keys:
        agreement = {}
        for key in keys:
            if key == "full":
                continue
            same = lost = gained = 0
            for r in replies:
                if same_reply(r[key], r["full"]):
                    same += 1
                full_right = is_correct(r["full"], r["answer"])
                right = is_correct(r[key], r["answer"])
                if full_right and not right:
                    lost += 1
                if right and not full_right:
                    gained += 1
            agreement[key] = {"same": same, "lost": lost, "gained": gained}
        output["agreement"] = agreement

    # examples for the website: first the questions where 16- or 8-bit changed the answer
    # (so it's visible that they do change, just rarely), then ones where only 4-bit did
    def example(r):
        entry = {"question": r["question"], "answer": r["answer"]}
        for key in keys:
            entry[key] = r[key]
            entry[key + "_correct"] = is_correct(r[key], r["answer"])
        return entry

    high = [r for r in replies if "full" in r and any(
        key in ("16", "8") and not same_reply(r[key], r["full"]) for key in keys)]
    others = [r for r in replies if r not in high and len(set(r[key].strip().lower() for key in keys)) > 1]
    output["examples"] = [example(r) for r in high[:2] + others[:6]]
    output["metric"] = ("VQA-normalized match (lowercase, no punctuation/articles, number words to digits): "
                        "the reply equals or starts with the answer, or is a short sentence (up to 12 words) "
                        "containing it; yes/no answers must start the reply")


def rescore(path):
    with open(path, encoding="utf-8") as f:
        output = json.load(f)
    if "replies" not in output:
        sys.exit(path + " has no saved replies (made by an older version): run the evaluation again")
    score_replies(output)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print("re-scored", path)
    for s in SETTINGS:
        if s["key"] in output:
            print("  {:<22} {:.1%}".format(s["label"], output[s["key"]]["score"]))


if __name__ == "__main__":
    main()
