#!/usr/bin/env python3
"""Synthesize every (array size, precision) design and collect results.json.

For each P in --sizes and B in --bits, runs Vivado in batch mode on
hw/scripts/synth_one.tcl, then parses LUTs, FFs, DSPs, worst negative slack
(-> Fmax estimate) and total power from the reports.

Run (in a terminal where Vivado's settings64 script has been run):
  python hw/scripts/run_sweep.py --sizes 4 --bits 8     # one design first (~2 min)
  python hw/scripts/run_sweep.py                        # all 9 (can take an hour)
results.json is rewritten after every design, so a crash keeps finished rows;
--skip-existing reuses reports already in build/synth/.
"""
import argparse, json, os, re, shutil, subprocess, sys, time

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
    ap.add_argument("--skip-existing", action="store_true", help="reuse reports already in build/synth")
    args = ap.parse_args()
    if not shutil.which("vivado") and not args.skip_existing:
        sys.exit("vivado not found on PATH: run Vivado's settings64 script in this terminal first")

    path = os.path.join(ROOT, "results.json")
    old = {(r["P"], r["bits"]): r for r in json.load(open(path))} if os.path.exists(path) else {}
    results = []
    for P in args.sizes:
        for B in args.bits:
            out = os.path.join(args.out, f"P{P}_B{B}")
            os.makedirs(out, exist_ok=True)
            synth_s = None
            if not (args.skip_existing and os.path.exists(os.path.join(out, "power.rpt"))):
                cmd = (f'vivado -mode batch -nojournal -log "{os.path.join(out, "vivado.log")}" '
                       f'-source "{os.path.join(HERE, "synth_one.tcl")}" -tclargs {P} {B} "{out}"')
                print(f"synthesizing P={P} B={B} ...", flush=True)
                t0 = time.time()
                subprocess.run(cmd, shell=True, check=False)
                synth_s = round(time.time() - t0, 1)
            if not os.path.exists(os.path.join(out, "utilization.rpt")):
                print(f"   no reports for P={P} B={B}; see {os.path.join(out, 'vivado.log')}")
                continue
            r = {"P": P, "bits": B, **parse_util(os.path.join(out, "utilization.rpt"))}
            wns = parse_wns(os.path.join(out, "timing.rpt"))
            r["wns_ns"] = wns
            r["fmax_mhz"] = round(1000 / (CLOCK_NS - wns), 1) if wns is not None else None
            r["power_w"] = parse_power(os.path.join(out, "power.rpt"))
            r["fits_zynq7020"] = (r["luts"] or 0) <= 53200 and (r["dsps"] or 0) <= 220
            r["synth_s"] = synth_s if synth_s is not None else old.get((P, B), {}).get("synth_s")
            results.append(r)
            print("   ", r)
            # keep rows for designs not in this run, then save after every design
            merged = {**old, **{(x["P"], x["bits"]): x for x in results}}
            rows = [merged[k] for k in sorted(merged, key=lambda k: (-k[1], k[0]))]
            json.dump(rows, open(path, "w"), indent=2)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
