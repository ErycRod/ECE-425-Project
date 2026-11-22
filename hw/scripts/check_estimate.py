#!/usr/bin/env python3
"""Check the website's hardware estimates on array sizes we never synthesized.

The Advanced level estimates LUTs, flip-flops, DSPs, Fmax and power for any P x P array from
the 9 designs in results.json (anh_web/backend/custom_design.py). This script synthesizes a
few new sizes in Vivado and compares what Vivado reports with those estimates.

The new designs are NOT added to results.json, so the estimates are still made only from the
original 9 designs: this is a true test on unseen sizes.

Run (in a terminal where Vivado's settings64 script has been run):
  python hw/scripts/check_estimate.py                     # 12x12 at 16, 8 and 4 bits (~5-10 min)
  python hw/scripts/check_estimate.py --sizes 6 12 --bits 8
  python hw/scripts/check_estimate.py --skip-existing     # only re-read reports in build/check/
Writes hw/estimate_checks.json, which the website shows under "How good are the estimates?".
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, "anh_web", "backend"))

from run_sweep import CLOCK_NS, parse_power, parse_util, parse_wns  # noqa: E402
import custom_design  # noqa: E402

LIMITS = {"luts": 53200, "dsps": 220, "ffs": 106400, "bram": 140}
OUT_PATH = os.path.join(ROOT, "hw", "estimate_checks.json")


def error_pct(estimate, actual):
    if estimate is None or actual is None or actual == 0:
        return None
    return round((estimate - actual) / actual * 100, 1)


def compare(P, bits, vivado, rows):
    """Estimate for (P, bits) from the 9 synthesized rows next to what Vivado reported."""
    estimate = custom_design.estimate_hardware(P, bits, rows, LIMITS)
    entry = {"P": P, "bits": bits, "estimate": {}, "vivado": {}, "error_pct": {}}
    for key in ["luts", "ffs", "dsps", "fmax_mhz", "power_w"]:
        entry["estimate"][key] = estimate[key]
        entry["vivado"][key] = vivado.get(key)
        entry["error_pct"][key] = error_pct(estimate[key], vivado.get(key))
    return entry


def read_reports(out):
    if not os.path.exists(os.path.join(out, "utilization.rpt")):
        return None
    row = parse_util(os.path.join(out, "utilization.rpt"))
    wns = parse_wns(os.path.join(out, "timing.rpt"))
    row["fmax_mhz"] = round(1000 / (CLOCK_NS - wns), 1) if wns is not None else None
    row["power_w"] = parse_power(os.path.join(out, "power.rpt"))
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", type=int, nargs="+", default=[12])
    ap.add_argument("--bits", type=int, nargs="+", default=[16, 8, 4])
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "check"))
    ap.add_argument("--skip-existing", action="store_true", help="reuse reports already in build/check")
    args = ap.parse_args()

    rows = json.load(open(os.path.join(ROOT, "results.json")))
    synthesized = {(r["P"], r["bits"]) for r in rows}
    if not shutil.which("vivado") and not args.skip_existing:
        sys.exit("vivado not found on PATH: run Vivado's settings64 script in this terminal first")

    old = {}
    if os.path.exists(OUT_PATH):
        for entry in json.load(open(OUT_PATH)):
            old[(entry["P"], entry["bits"])] = entry

    for P in args.sizes:
        for B in args.bits:
            if (P, B) in synthesized:
                print(f"skip P={P} B={B}: already in results.json, not a new size")
                continue
            out = os.path.join(args.out, f"P{P}_B{B}")
            os.makedirs(out, exist_ok=True)
            if not (args.skip_existing and os.path.exists(os.path.join(out, "power.rpt"))):
                cmd = (f'vivado -mode batch -nojournal -log "{os.path.join(out, "vivado.log")}" '
                       f'-source "{os.path.join(HERE, "synth_one.tcl")}" -tclargs {P} {B} "{out}"')
                print(f"synthesizing P={P} B={B} ...", flush=True)
                subprocess.run(cmd, shell=True, check=False)
            vivado = read_reports(out)
            if vivado is None:
                print(f"   no reports for P={P} B={B}; see {os.path.join(out, 'vivado.log')}")
                continue
            entry = compare(P, B, vivado, rows)
            old[(P, B)] = entry
            print(f"   P={P} B={B}: errors {entry['error_pct']}")
            with open(OUT_PATH, "w") as f:
                json.dump([old[k] for k in sorted(old, key=lambda k: (-k[1], k[0]))], f, indent=2)
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
