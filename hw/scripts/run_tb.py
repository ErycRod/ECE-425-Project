#!/usr/bin/env python3
"""Run tb_systolic_array for several array sizes and precisions.

Usage (Vivado simulator; run Vivado's settings64 script first):
  python hw/scripts/run_tb.py
  python hw/scripts/run_tb.py --sim iverilog
  python hw/scripts/run_tb.py --sizes 2 4 --bits 8
"""
import argparse, glob, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HW = os.path.dirname(HERE)
ROOT = os.path.dirname(HW)
FILES = sorted(glob.glob(os.path.join(HW, "rtl", "*.v"))) + [os.path.join(HW, "tb", "tb_systolic_array.v")]
TOP = "tb_systolic_array"


def sh(cmd, cwd):
    p = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True, errors="replace")
    return p.returncode, p.stdout + p.stderr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sim", choices=["xsim", "iverilog"], default="xsim")
    ap.add_argument("--sizes", type=int, nargs="+", default=[4, 8, 16])
    ap.add_argument("--bits", type=int, nargs="+", default=[16, 8, 4])
    args = ap.parse_args()
    tool = "xvlog" if args.sim == "xsim" else "iverilog"
    if not shutil.which(tool):
        sys.exit(f"{tool} not found on PATH")

    files = " ".join(f'"{f}"' for f in FILES)
    passed = total = 0
    for P in args.sizes:
        for B in args.bits:
            wd = os.path.join(ROOT, "build", args.sim, f"P{P}_B{B}")
            os.makedirs(wd, exist_ok=True)
            if args.sim == "xsim":
                rc, log = sh(f"xvlog {files}", wd)
                if rc == 0:
                    rc, more = sh(f'xelab {TOP} -generic_top "P={P}" -generic_top "B={B}" -s snap', wd); log += more
                if rc == 0:
                    rc, more = sh("xsim snap -R", wd); log += more
            else:
                rc, log = sh(f"iverilog -g2012 -P {TOP}.P={P} -P {TOP}.B={B} -o sim.vvp {files}", wd)
                if rc == 0:
                    rc, more = sh("vvp -n sim.vvp", wd); log += more
            open(os.path.join(wd, "run.log"), "w").write(log)
            ok = "TEST PASSED" in log and "FAIL" not in log
            passed += ok; total += 1
            summary = next((l.strip() for l in log.splitlines() if "TEST PASSED" in l or "FAIL" in l), "no result (see run.log)")
            print(f"{'PASS' if ok else 'FAIL':5} P={P:<2} B={B:<2}  {summary}")
    print(f"\n{passed}/{total} configurations passed  (logs: build/{args.sim}/)")
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
