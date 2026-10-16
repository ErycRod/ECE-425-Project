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
