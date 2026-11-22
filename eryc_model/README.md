# Model (Eryc Rodriguez)

**Your job:** get SmolVLM-256M-Instruct running in PyTorch, measure how much work each layer does,
and test how much answer quality drops when weights are rounded to 8-bit and 4-bit.

**What to put in this folder:**
- Your profiling script and quantization/accuracy scripts.
- `profile_summary.json`: the workload numbers the hardware performance model needs, in this format
  (same keys as `perf/example_profile.json`, which is a placeholder until yours exists):
  ```json
  {"note": "profiled SmolVLM-256M, <image used>",
   "vision": {"params": 0, "macs": 0},
   "lm": {"params": 0},
   "prefill_tokens": 0}
  ```
- A short table of accuracy at 16 / 8 / 4 bits (any format).

**Hand-off:** once `profile_summary.json` is here, Lucius runs
`python perf/perf_model.py --profile eryc_model/profile_summary.json`.

Tip: PyTorch forward hooks on every `nn.Linear` layer give you in/out features and token counts per layer.

## Accuracy at 16 / 8 / 4 bits

`eval_accuracy.py` asks SmolVLM-256M the same VQAv2 image questions with its weights rounded to
16, 8 and 4 bits (plus full precision and 4-bit with one scale per 128 weights) and scores the
answers. Run from the repo folder:

```
python eryc_model/eval_accuracy.py --n 20     # quick try (~5 min on a laptop CPU)
python eryc_model/eval_accuracy.py            # 100 questions (~20-40 min)
```

It writes `eryc_model/accuracy.json`; the website shows it on its own (Intermediate → Accuracy).

- `quantize.py`: fake quantization of every `nn.Linear` weight (round to signed B-bit integers
  and back), per output channel or per group of 128, with save/restore of the original weights.
- `vqa_score.py`: VQA-style answer normalization and matching (no PyTorch needed).
- Questions: the first N of `merve/vqav2-small` (VQAv2 validation), streamed, so only those
  images are downloaded.
- Limitation: only weights are rounded; activations stay in full precision.

Tests: `python -m pytest eryc_model/tests` (the quantization tests need PyTorch).
