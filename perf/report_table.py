#!/usr/bin/env python3
"""Turn results.json (Vivado sweep) + the performance model into a LaTeX table
for the report. Missing values print as "--", so it runs before the sweep too.

Run:  python perf/report_table.py      -> docs/table_designs.tex (paste into Overleaf)
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from perf_model import estimate, load_results, design_clock_power, default_profile_path


def fmt(v, spec="{:,.0f}"):
    return "--" if v is None else spec.format(v)


def main():
    profile = json.load(open(default_profile_path()))
    results = load_results()
    placeholder = "PLACEHOLDER" in profile.get("note", "")
    lines = [r"\begin{table}[t]", r"\centering", r"\small", r"\setlength{\tabcolsep}{3.5pt}",
             r"\caption{The nine designs on the Zynq-7020 (Vivado, post-synthesis) and their "
             r"predicted TTFT and decode speed at each design's $f_{\max}$, 1~GB/s"
             + (" (placeholder workload)" if placeholder else "") + "."
             + (r" $^\dagger$Does not fit the device." if any(r.get("fits_zynq7020") is False for r in results.values()) else "")
             + "}",
             r"\label{tab:designs}",
             r"\begin{tabular}{l c r r r r r r}", r"\hline",
             r"Array & Bits & LUTs & DSPs & $f_{\max}$ & Power & TTFT & Tok/s \\",
             r"      &      &      &      & (MHz)      & (W)   & (s)  &       \\",
             r"\hline"]
    for bits in (16, 8, 4):
        for P in (4, 8, 16):
            row = results.get((P, bits), {})
            f, pw = design_clock_power(results, P, bits, 100.0)
            e = estimate(profile, P, bits, f)
            mark = "$^\\dagger$" if row.get("fits_zynq7020") is False else ""
            lines.append(" & ".join([
                f"${P}\\times{P}${mark}", str(bits),
                fmt(row.get("luts")), fmt(row.get("dsps")),
                fmt(row.get("fmax_mhz"), "{:.1f}"), fmt(row.get("power_w"), "{:.3f}"),
                f"{e['ttft_s']:.2f}", f"{e['tokens_per_s']:.1f}"]) + r" \\")
    lines += [r"\hline", r"\end{tabular}", r"\end{table}"]
    tex = "\n".join(lines) + "\n"
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    open(os.path.join(ROOT, "docs", "table_designs.tex"), "w").write(tex)
    print(tex)
    print("wrote docs/table_designs.tex" + ("" if results else "  (no results.json yet: resource columns are --)"))


if __name__ == "__main__":
    main()
