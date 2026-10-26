#!/usr/bin/env python3
"""First-order performance model: maps the VLM's work onto a P x P, B-bit
systolic array and a memory system, and estimates time to first token (TTFT),
decode tokens/s, and energy per answer.

Roofline per phase: time = max(compute time, memory time)
  compute time = MACs / (P*P * f_clk * utilization)
  memory time  = bytes moved / memory bandwidth
Prefill (vision encoder + LM over image and prompt tokens) is usually
compute-bound; decode (one token at a time, re-reading all LM weights) is
usually memory-bound. That contrast is the toolkit's main lesson.

Workload numbers come from a JSON profile. Until eryc_model/profile_summary.json
exists, perf/example_profile.json holds ROUGH placeholder estimates
(parameters x tokens), which ignore attention-score matmuls.

Hardware numbers: if results.json (from hw/scripts/run_sweep.py) exists at the
repo root, each design uses its own Vivado Fmax as the clock and its power for
energy per answer. Otherwise every design runs at --f-mhz and energy is skipped.

Run:  python perf/perf_model.py [--profile ...] [--results results.json]
"""
import argparse, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_RESULTS = os.path.join(ROOT, "results.json")
ERYC_PROFILE = os.path.join(ROOT, "eryc_model", "profile_summary.json")


def default_profile_path():
    """Eryc's real profile if it exists, otherwise the placeholder."""
    return ERYC_PROFILE if os.path.exists(ERYC_PROFILE) else os.path.join(HERE, "example_profile.json")


def load_results(path=DEFAULT_RESULTS):
    """Vivado sweep rows keyed by (P, bits), or {} if the sweep hasn't been run."""
    if not path or not os.path.exists(path):
        return {}
    return {(r["P"], r["bits"]): r for r in json.load(open(path))}


def design_clock_power(results, P, bits, f_default):
    """(clock MHz, power W or None) for one design: Vivado numbers when available."""
    r = results.get((P, bits), {})
    f = r.get("fmax_mhz") or f_default
    return f, r.get("power_w")


def phase_time(macs, bytes_moved, P, f_hz, bw_Bps, util):
    t_compute = macs / (P * P * f_hz * util)
    t_memory = bytes_moved / bw_Bps
    return max(t_compute, t_memory), ("compute" if t_compute >= t_memory else "memory")


def estimate(profile, P, bits, f_mhz=100.0, bw_gbs=1.0, util=0.8, out_tokens=32, power_w=None):
    f, bw = f_mhz * 1e6, bw_gbs * 1e9
    wbytes = bits / 8
    vis = profile["vision"]; lm = profile["lm"]
    prompt = profile["prefill_tokens"]

    t_vis, b_vis = phase_time(vis["macs"], vis["params"] * wbytes, P, f, bw, util)
    t_pre, b_pre = phase_time(lm["params"] * prompt, lm["params"] * wbytes, P, f, bw, util)
    t_tok, b_tok = phase_time(lm["params"], lm["params"] * wbytes, P, f, bw, util)

    ttft = t_vis + t_pre + t_tok
    total = t_vis + t_pre + out_tokens * t_tok
    res = {"P": P, "bits": bits, "ttft_s": ttft, "tokens_per_s": 1 / t_tok,
           "answer_s": total, "vision_bound": b_vis, "prefill_bound": b_pre, "decode_bound": b_tok}
    if power_w is not None:
        res["energy_J"] = power_w * total
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default=default_profile_path())
    ap.add_argument("--results", default=DEFAULT_RESULTS, help="Vivado sweep output (optional)")
    ap.add_argument("--f-mhz", type=float, default=100.0, help="clock for designs without a Vivado Fmax")
    ap.add_argument("--bw-gbs", type=float, default=1.0, help="effective DRAM bandwidth, GB/s")
    ap.add_argument("--util", type=float, default=0.8, help="fraction of PE-cycles doing useful MACs")
    ap.add_argument("--out-tokens", type=int, default=32)
    args = ap.parse_args()

    profile = json.load(open(args.profile))
    results = load_results(args.results)
    print(f"profile: {os.path.relpath(args.profile, ROOT)}  ({profile.get('note', '')})")
    clock = "per-design Vivado Fmax (results.json)" if results else f"{args.f_mhz:.0f} MHz for all designs (no results.json yet)"
    print(f"clock: {clock}; bandwidth {args.bw_gbs} GB/s; utilization {args.util}\n")
    print(f"{'array':>7} {'bits':>4} {'MHz':>6} {'TTFT (s)':>9} {'tok/s':>7} {'answer (s)':>10} {'energy (J)':>10}"
          f"   bound (vision/prefill/decode)")
    for P in (4, 8, 16):
        for bits in (16, 8, 4):
            f, pw = design_clock_power(results, P, bits, args.f_mhz)
            r = estimate(profile, P, bits, f, args.bw_gbs, args.util, args.out_tokens, pw)
            e = f"{r['energy_J']:>10.2f}" if "energy_J" in r else f"{'n/a':>10}"
            print(f"{P:>3}x{P:<3} {bits:>4} {f:>6.1f} {r['ttft_s']:>9.2f} {r['tokens_per_s']:>7.1f} {r['answer_s']:>10.2f} {e}"
                  f"   {r['vision_bound']}/{r['prefill_bound']}/{r['decode_bound']}")


if __name__ == "__main__":
    main()
