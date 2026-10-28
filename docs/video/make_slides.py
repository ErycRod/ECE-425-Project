#!/usr/bin/env python3
"""Make the 1920x1080 slides for the 2-minute mid-project video.

  01_title.png       opening title card
  02_synthesis.png   what Vivado did at 16 / 8 / 4 bits (reads results.json)
  03_status.png      what works now vs. what's next (Dec 11)

Run:  python docs/video/make_slides.py
"""
import json, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
BG, CARD, EDGE = "#0e131c", "#171e2b", "#2a3446"
INK, MUTED, FAINT = "#f0efec", "#a9b0bd", "#6b7485"
BLUE, ORANGE, AQUA, YELLOW = "#3987e5", "#d95926", "#199e70", "#e0a500"


def canvas():
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100, facecolor=BG)
    ax = fig.add_axes([0, 0, 1, 1]); ax.set_xlim(0, 192); ax.set_ylim(0, 108); ax.axis("off")
    ax.set_facecolor(BG)
    return fig, ax


def card(ax, x, y, w, h, edge=EDGE):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=2.2",
                                facecolor=CARD, edgecolor=edge, linewidth=2))


def footer(ax, text="EdgeVLM Lab  ·  Team P10  ·  ECE 425/525 Mid-Project, Fall 2026"):
    ax.text(12, 6, text, fontsize=15, color=FAINT, va="center")


def save(fig, name):
    out = os.path.join(HERE, name)
    fig.savefig(out, facecolor=BG)
    plt.close(fig)
    print("wrote", out)


# ---- 01 title ----------------------------------------------------------------
fig, ax = canvas()
ax.add_patch(FancyBboxPatch((12, 66), 3.2, 3.2, boxstyle="round,pad=0,rounding_size=0.8",
                            facecolor=BLUE, edgecolor="none"))
ax.text(18, 67.6, "ECE 425/525 · Interactive Deep Learning Toolkit · Mid-Project Demo",
        fontsize=20, color=MUTED, va="center")
ax.text(12, 55, "EdgeVLM Lab", fontsize=96, color=INK, weight="bold", va="center")
ax.text(12, 36, "How accelerator design choices shape a vision-language model's\n"
                "response time on a small FPGA", fontsize=34, color=MUTED, va="center", linespacing=1.35)
ax.plot([12, 180], [24, 24], color=EDGE, linewidth=2)
ax.text(12, 17, "Lucius Casertano  ·  Eryc Rodriguez  ·  Anh Tran", fontsize=24, color=INK, va="center")
ax.text(180, 17, "Team P10  ·  University of Arizona", fontsize=20, color=MUTED, va="center", ha="right")
save(fig, "01_title.png")

# ---- 02 synthesis -----------------------------------------------------------
rows = {}
rp = os.path.join(ROOT, "results.json")
if os.path.exists(rp):
    for r in json.load(open(rp)):
        rows[(r["P"], r["bits"])] = r


def per_pe(bits, P=16):
    r = rows.get((P, bits))
    return None if not r else r["luts"] / (P * P)


fig, ax = canvas()
ax.text(12, 96, "Vivado results: precision changes how the hardware is built", fontsize=40,
        color=INK, weight="bold", va="center")
ax.text(12, 88, "Same Verilog, synthesized 9 ways for a Zynq-7020 FPGA (3 array sizes × 3 precisions)",
        fontsize=22, color=MUTED, va="center")
cols = [
    (16, BLUE, "DSP blocks", "whole multiply-add in\none dedicated DSP slice",
     rows.get((8, 16), {}).get("fmax_mhz", 295.9), "almost no LUTs"),
    (8, ORANGE, "Regular logic (LUTs)", "multipliers built from\ngeneral-purpose logic",
     rows.get((8, 8), {}).get("fmax_mhz", 130.2), f"≈ {per_pe(8) or 89:.0f} LUTs per unit"),
    (4, AQUA, "Regular logic (LUTs)", "smaller multipliers,\nstill no DSPs",
     rows.get((8, 4), {}).get("fmax_mhz", 162.2), f"≈ {per_pe(4) or 38:.0f} LUTs per unit"),
]
x0, w, gap = 12, 52, 6
for i, (bits, color, built, how, mhz, luts) in enumerate(cols):
    x = x0 + i * (w + gap)
    card(ax, x, 26, w, 52, edge=color)
    ax.text(x + 4, 72, f"{bits}-bit", fontsize=34, color=color, weight="bold", va="center")
    ax.text(x + 4, 64, built, fontsize=22, color=INK, va="center")
    ax.text(x + 4, 56.5, how, fontsize=17, color=MUTED, va="center", linespacing=1.3)
    ax.text(x + 4, 41, f"{mhz:.0f}", fontsize=64, color=INK, weight="bold", va="center")
    ax.text(x + 4 + 7.2 * len(f"{mhz:.0f}"), 38.6, "MHz", fontsize=24, color=MUTED, va="center")
    ax.text(x + 4, 31, luts, fontsize=18, color=MUTED, va="center")
ax.text(12, 17, "Surprise: 16-bit runs fastest per cycle, so fewer bits does NOT always mean a faster first word.",
        fontsize=23, color=YELLOW, va="center", weight="bold")
ax.text(12, 11.5, "All 9 designs fit the chip. 16×16 at 16-bit needs 256 multipliers but the chip has 220 DSPs, "
                  "so 36 spill into LUTs and the clock drops to 95 MHz.", fontsize=16, color=MUTED, va="center")
footer(ax, "Post-synthesis estimates (Vivado 2022.2, xc7z020clg484-1)  ·  EdgeVLM Lab · Team P10")
save(fig, "02_synthesis.png")

# ---- 03 status --------------------------------------------------------------
fig, ax = canvas()
ax.text(12, 96, "Where we are, and what's next", fontsize=44, color=INK, weight="bold", va="center")
card(ax, 12, 16, 82, 70, edge=AQUA)
card(ax, 98, 16, 82, 70, edge=BLUE)
ax.text(17, 79, "Working now (Nov 1)", fontsize=28, color=AQUA, weight="bold", va="center")
ax.text(103, 79, "By the final (Dec 11)", fontsize=28, color=BLUE, weight="bold", va="center")
now = ["Web page ↔ FastAPI backend ↔ performance model,\nupdates in ~1–3 ms",
       "Verilog systolic array: all 9 designs pass\nsimulation, incl. worst-case overflow test",
       "Real Vivado clock, LUT/DSP and power numbers\nfeed every estimate",
       "Placeholder: SmolVLM workload profile,\naccuracy at 8/4 bits, question answering"]
nxt = ["Connect SmolVLM: upload an image,\nask a question, see the answer",
       "Real per-layer profile and 16/8/4-bit accuracy",
       "Layer-by-layer model map and an animated\nsystolic-array dataflow view",
       "Tradeoff + bandwidth charts; user study\nwith classmates"]
for items, x, color in ((now, 17, AQUA), (nxt, 103, BLUE)):
    for j, t in enumerate(items):
        y = 68 - j * 14
        dot = YELLOW if t.startswith("Placeholder") else color
        ax.add_patch(plt.Circle((x + 1.2, y + 0.4), 1.0, color=dot))
        ax.text(x + 4.5, y + 0.4, t, fontsize=19, color=INK if not t.startswith("Placeholder") else MUTED,
                va="center", linespacing=1.3)
footer(ax, "Code: github.com/ErycRod/ECE-425-Project  ·  EdgeVLM Lab · Team P10")
save(fig, "03_status.png")
