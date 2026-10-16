#!/usr/bin/env python3
"""Synthesize every (array size, precision) design and collect results.json.

For each P in --sizes and B in --bits, runs Vivado in batch mode on
hw/scripts/synth_one.tcl, then parses LUTs, FFs, DSPs, worst negative slack
(-> Fmax estimate) and total power from the reports.

Run (after Vivado's settings64 script):  python hw/scripts/run_sweep.py
STATUS: starter code; check the report parsing against your first real run.
"""
import argparse, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CLOCK_NS = 10.0          # must match clk.xdc


def first_number(line):
    m = re.search(r"-?\d+(\.\d+)?", line)
    return float(m.group()) if m else None


def parse_util(path):
    res = {}
    for line in open(path, errors="replace"):
        cells = [c.strip() for c in line.split("|")]
        if len(cells) > 2:
            name = cells[1].rstrip("*").strip()
            if name in ("Slice LUTs", "Slice Registers", "DSPs", "Block RAM Tile"):
                res[name] = first_number(cells[2])
    return {"luts": res.get("Slice LUTs"), "ffs": res.get("Slice Registers"),
            "dsps": res.get("DSPs"), "bram": res.get("Block RAM Tile")}


def parse_wns(path):
    lines = open(path, errors="replace").read().splitlines()
    for n, line in enumerate(lines):
        if "WNS(ns)" in line and "TNS(ns)" in line:
            for nxt in lines[n + 1:n + 4]:
                v = first_number(nxt)
                if v is not None and not set(nxt.strip()) <= {"-", " "}:
                    return v
    return None


def parse_power(path):
    for line in open(path, errors="replace"):
        if "Total On-Chip Power" in line:
            return first_number(line.split("|")[2]) if "|" in line else first_number(line)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sizes", type=int, nargs="+", default=[4, 8, 16])
    ap.add_argument("--bits", type=int, nargs="+", default=[16, 8, 4])
    ap.add_argument("--out", default=os.path.join(ROOT, "build", "synth"))
    args = ap.parse_args()

    results = []
    for P in args.sizes:
        for B in args.bits:
            out = os.path.join(args.out, f"P{P}_B{B}")
            os.makedirs(out, exist_ok=True)
            cmd = (f'vivado -mode batch -nojournal -log "{os.path.join(out, "vivado.log")}" '
                   f'-source "{os.path.join(HERE, "synth_one.tcl")}" -tclargs {P} {B} "{out}"')
            print(f"synthesizing P={P} B={B} ...", flush=True)
            subprocess.run(cmd, shell=True, check=False)
            r = {"P": P, "bits": B, **parse_util(os.path.join(out, "utilization.rpt"))}
            wns = parse_wns(os.path.join(out, "timing.rpt"))
            r["wns_ns"] = wns
            r["fmax_mhz"] = round(1000 / (CLOCK_NS - wns), 1) if wns is not None else None
            r["power_w"] = parse_power(os.path.join(out, "power.rpt"))
            r["fits_zynq7020"] = (r["luts"] or 0) <= 53200 and (r["dsps"] or 0) <= 220
            results.append(r)
            print("   ", r)

    path = os.path.join(ROOT, "results.json")
    json.dump(results, open(path, "w"), indent=2)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
