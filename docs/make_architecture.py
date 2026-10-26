#!/usr/bin/env python3
"""Draw the system architecture / data-flow diagram for the report (Section 3).

Solid border = working now; dashed border = in progress or placeholder.
The Vivado and profiling boxes turn solid automatically once results.json /
eryc_model/profile_summary.json exist; re-run after those land.
Run:  python docs/make_architecture.py      -> docs/architecture.png
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

INK, MUTED, LINE = "#0b0b0b", "#52514e", "#8a8984"
OWNER = {"Lucius (hardware)": ("#2a78d6", "#e3eefb"),
         "Eryc (model)": ("#eb6834", "#fde9e0"),
         "Anh (website)": ("#1baf7a", "#ddf4ea")}

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HAVE_RESULTS = os.path.exists(os.path.join(ROOT, "results.json"))           # sweep done -> solid border
HAVE_PROFILE = os.path.exists(os.path.join(ROOT, "eryc_model", "profile_summary.json"))

fig, ax = plt.subplots(figsize=(7.2, 3.9))
ax.set_xlim(0, 100); ax.set_ylim(0, 56); ax.axis("off")


def box(x, y, w, h, title, body, owner, done=True):
    edge, fill = OWNER[owner]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1.2",
                                facecolor=fill, edgecolor=edge, linewidth=1.4,
                                linestyle="-" if done else (0, (4, 2))))
    ax.text(x + w / 2, y + h - 1.4, title, ha="center", va="top", fontsize=7.2, weight="bold", color=INK)
    ax.text(x + w / 2, y + h - 4.6, body, ha="center", va="top", fontsize=6.2, color=MUTED, linespacing=1.25)


def arrow(x1, y1, x2, y2, label=None, lx=0, ly=0, rad=0.0):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=9,
                                 color=LINE, linewidth=1.1, connectionstyle=f"arc3,rad={rad}"))
    if label:
        ax.text((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, fontsize=5.8, color=MUTED,
                ha="center", va="center", style="italic")


# stage headers (the course's required data-flow chain)
stages = ["UI inputs", "Execution hooks / API", "Tensor processing", "Visual rendering"]
for i, s in enumerate(stages):
    ax.text(3 + i * 24.5 + 9.5, 55, f"{i + 1}. {s}", ha="center", va="top", fontsize=7.4, color=INK, weight="bold")
ax.text(0.3, 50.5, "LIVE  (every slider move or question)", fontsize=6, color=MUTED, ha="left")
ax.text(0.3, 19.0, "OFFLINE  (precomputed once, stored as JSON)", fontsize=6, color=MUTED, ha="left")
ax.plot([0, 100], [20.6, 20.6], color="#d9d8d4", linewidth=0.8, linestyle=(0, (2, 2)))

# live row
box(1, 27, 20, 22, "Browser page", "image + question\nsliders: array size P,\nprecision B, memory\nbandwidth", "Anh (website)", done=False)
box(25.5, 27, 20, 22, "FastAPI backend", "/api/estimate\n/api/sweep\n/api/bandwidth_curve\n/api/ask", "Anh (website)")
box(50, 38.5, 20, 10.5, "SmolVLM-256M engine", "PyTorch, answers\nthe question", "Eryc (model)", done=False)
box(50, 27, 20, 10, "Performance model", "roofline per phase:\nvision / prefill / decode", "Lucius (hardware)")
box(74.5, 27, 24, 22, "Charts + readouts", "TTFT, tokens/s, energy,\nLUT / DSP use vs. chip,\ncompute- vs memory-bound,\nsystolic dataflow view", "Anh (website)", done=False)
arrow(21.5, 38, 25, 38, "HTTP", 0, 2.4)
arrow(46, 43, 49.5, 43.5)
arrow(46, 32, 49.5, 32)
arrow(70.5, 43.5, 74, 41)
arrow(70.5, 32, 74, 34)

# offline row
box(1, 2, 20, 14.5, "Verilog accelerator", "P x P systolic array of\nB-bit MAC PEs\n(P = 4/8/16, B = 16/8/4)", "Lucius (hardware)")
box(25.5, 2, 20, 14.5, "Verification", "vs. cycle-accurate\nPython model;\n9/9 configs pass", "Lucius (hardware)")
box(50, 2, 20, 14.5, "Vivado sweep", "9 designs, Zynq-7020:\nLUTs, DSPs, Fmax,\npower", "Lucius (hardware)", done=HAVE_RESULTS)
box(74.5, 2, 24, 14.5, "Model profiling", "per-layer MACs (forward\nhooks) + 16/8/4-bit\naccuracy", "Eryc (model)", done=HAVE_PROFILE)
arrow(21.5, 9, 25, 9)
arrow(46, 9, 49.5, 9)
arrow(60, 17, 60, 26.5, "results.json", -5.3, -0.4)
arrow(78, 17, 70.6, 29, "profile_summary.json", 9.5, -1.5)

# legend
lx = 1
for name, (edge, fill) in OWNER.items():
    ax.add_patch(FancyBboxPatch((lx, -3.6), 2.6, 2.0, boxstyle="round,pad=0.1,rounding_size=0.4",
                                facecolor=fill, edgecolor=edge, linewidth=1.2))
    ax.text(lx + 3.4, -2.6, name, fontsize=6.2, color=INK, va="center")
    lx += 20
ax.plot([lx + 1, lx + 4], [-2.6, -2.6], color=MUTED, linewidth=1.2)
ax.text(lx + 5, -2.6, "working", fontsize=6.2, color=INK, va="center")
ax.plot([lx + 15, lx + 18], [-2.6, -2.6], color=MUTED, linewidth=1.2, linestyle=(0, (4, 2)))
ax.text(lx + 19, -2.6, "in progress", fontsize=6.2, color=INK, va="center")
ax.set_ylim(-4.5, 56)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "architecture.png")
fig.tight_layout(pad=0.3)
fig.savefig(out, dpi=300, facecolor="white")
print(f"wrote {out}")
