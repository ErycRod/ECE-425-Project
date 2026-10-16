#!/usr/bin/env python3
"""Plot the 9-design tradeoff from perf_model.py: time to first token vs. tokens/s.

Each dot is one (array size, precision) design. Up = faster talking (decode),
left = faster first word (prefill). The point of the chart: moving right-to-left
is mostly array size; moving up is mostly precision.

Run:  python perf/plot_perf.py [--profile perf/example_profile.json] [--out docs/tradeoff.png]
"""
import argparse, json, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from perf_model import estimate

COLORS = {16: "#2a78d6", 8: "#eb6834", 4: "#1baf7a"}   # validated categorical slots 1-3
INK, MUTED, GRID = "#0b0b0b", "#52514e", "#e6e5e1"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default=os.path.join(HERE, "example_profile.json"))
    ap.add_argument("--f-mhz", type=float, default=100.0)
    ap.add_argument("--bw-gbs", type=float, default=1.0)
    ap.add_argument("--util", type=float, default=0.8)
    ap.add_argument("--out", default=os.path.join("docs", "tradeoff.png"))
    a = ap.parse_args()
    prof = json.load(open(a.profile))

    fig, ax = plt.subplots(figsize=(7.2, 4.6))
    for bits in (16, 8, 4):
        pts = [estimate(prof, P, bits, a.f_mhz, a.bw_gbs, a.util) for P in (4, 8, 16)]
        xs = [r["ttft_s"] for r in pts]; ys = [r["tokens_per_s"] for r in pts]
        ax.plot(xs, ys, color=COLORS[bits], linewidth=2, zorder=2)
        ax.scatter(xs, ys, s=64, color=COLORS[bits], edgecolor="white", linewidth=2,
                   zorder=3, label=f"{bits}-bit")
        for r in pts:
            note = "  (over 220 DSPs)" if (r["P"] == 16 and bits == 16) else ""
            ax.annotate(f"{r['P']}×{r['P']}{note}", (r["ttft_s"], r["tokens_per_s"]),
                        textcoords="offset points", xytext=(6, 6), fontsize=8, color=MUTED)
    ax.set_xscale("log")
    from matplotlib.ticker import FixedLocator, NullLocator, FuncFormatter
    ax.xaxis.set_major_locator(FixedLocator([1, 2, 5, 10, 20, 50, 100, 200]))
    ax.xaxis.set_minor_locator(NullLocator())
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:g}"))
    ax.set_xlabel("Time to first token (s, log scale)  ← better", color=INK)
    ax.set_ylabel("Decode speed (tokens/s)  better →", color=INK)
    ax.grid(True, color=GRID, linewidth=0.8); ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(GRID)
    ax.tick_params(colors=MUTED)
    ax.legend(frameon=False, loc="upper right")
    ax.set_title("Bigger arrays cut TTFT; fewer bits raise tokens/s", loc="left",
                 fontsize=12, color=INK)
    fig.text(0.01, 0.01, f"{a.f_mhz:.0f} MHz, {a.bw_gbs} GB/s, util {a.util}. "
             f"Workload: {'PLACEHOLDER estimate' if 'PLACEHOLDER' in prof.get('note', '') else prof.get('note', '')}", fontsize=7, color=MUTED)
    fig.tight_layout(rect=(0, 0.03, 1, 1))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    fig.savefig(a.out, dpi=200, facecolor="white")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
