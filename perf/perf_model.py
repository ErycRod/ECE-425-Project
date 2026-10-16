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

Workload numbers come from a JSON profile. Until model/profile_smolvlm.py has
been run, perf/example_profile.json holds ROUGH placeholder estimates
(parameters x tokens), which ignore attention-score matmuls.

Run:  python perf/perf_model.py [--profile perf/example_profile.json]
"""
import argparse, json, os

HERE = os.path.dirname(os.path.abspath(__file__))


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
    ap.add_argument("--profile", default=os.path.join(HERE, "example_profile.json"))
    ap.add_argument("--f-mhz", type=float, default=100.0, help="accelerator clock (from Vivado Fmax)")
    ap.add_argument("--bw-gbs", type=float, default=1.0, help="effective DRAM bandwidth, GB/s")
    ap.add_argument("--util", type=float, default=0.8, help="fraction of PE-cycles doing useful MACs")
    ap.add_argument("--out-tokens", type=int, default=32)
    args = ap.parse_args()

    profile = json.load(open(args.profile))
    print(f"profile: {os.path.basename(args.profile)}  ({profile.get('note', '')})")
    print(f"clock {args.f_mhz:.0f} MHz, bandwidth {args.bw_gbs} GB/s, utilization {args.util}\n")
    print(f"{'array':>7} {'bits':>4} {'TTFT (s)':>9} {'tok/s':>7} {'answer (s)':>10}   bound (vision/prefill/decode)")
    for P in (4, 8, 16):
        for bits in (16, 8, 4):
            r = estimate(profile, P, bits, args.f_mhz, args.bw_gbs, args.util, args.out_tokens)
            print(f"{P:>3}x{P:<3} {bits:>4} {r['ttft_s']:>9.2f} {r['tokens_per_s']:>7.1f} {r['answer_s']:>10.2f}"
                  f"   {r['vision_bound']}/{r['prefill_bound']}/{r['decode_bound']}")


if __name__ == "__main__":
    main()
