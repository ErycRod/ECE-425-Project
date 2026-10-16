#!/usr/bin/env python3
"""Draw the systolic array's dataflow, cycle by cycle, using the cycle-accurate model.

Each panel is one clock cycle. A PE is shaded when it does a multiply-accumulate
that cycle, and labeled with the k it is working on (A[i][k] * B[k][j]).
The diagonal "wavefront" is the skew: PE(i, j) sees step k at cycle k + i + j.

Run:  python hw/model/plot_dataflow.py [--P 4] [--K 6] [--out docs/dataflow.png]
"""
import argparse, os, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from systolic_model import SystolicArrayModel

INK, MUTED, GRID, ACTIVE, DONE = "#0b0b0b", "#52514e", "#d9d8d4", "#2a78d6", "#cfe0f6"


def trace(P, K):
    """Run the model and record, per cycle, which PEs accumulate and on which k."""
    m = SystolicArrayModel(P, 8)
    m.step(clear=1)
    frames = []
    for t in range(K + 2 * P - 2):
        valid = 1 if t < K else 0
        # a PE accumulates this cycle iff its v_in is high; recover k from the skew
        k_at = np.full((P, P), -1)
        for i in range(P):
            for j in range(P):
                k = t - i - j
                if 0 <= k < K:
                    k_at[i, j] = k
        rng = np.random.default_rng(t)
        m.step(valid, rng.integers(-8, 8, P), rng.integers(-8, 8, P))
        frames.append(k_at)
    return frames


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--P", type=int, default=4)
    ap.add_argument("--K", type=int, default=6)
    ap.add_argument("--out", default=os.path.join("docs", "dataflow.png"))
    a = ap.parse_args()
    P, K = a.P, a.K
    frames = trace(P, K)
    n = len(frames)
    cols = min(n, 6)
    rows = (n + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(2.1 * cols, 2.35 * rows + 0.8))
    axes = np.atleast_1d(axes).ravel()
    finished = np.zeros((P, P), dtype=int)
    for t, ax in enumerate(axes):
        ax.set_axis_off()
        if t >= n:
            continue
        k_at = frames[t]
        for i in range(P):
            for j in range(P):
                k = k_at[i, j]
                if k >= 0:
                    fc, txt, tc = ACTIVE, f"k={k}", "white"
                elif finished[i, j] >= K:
                    fc, txt, tc = DONE, "done", MUTED
                else:
                    fc, txt, tc = "white", "", MUTED
                ax.add_patch(Rectangle((j + 0.06, P - 1 - i + 0.06), 0.88, 0.88,
                                       facecolor=fc, edgecolor=GRID, linewidth=1))
                if txt:
                    ax.text(j + 0.5, P - 1 - i + 0.5, txt, ha="center", va="center",
                            fontsize=7 if P <= 4 else 5, color=tc)
        finished += (k_at >= 0)
        ax.set_xlim(0, P); ax.set_ylim(0, P); ax.set_aspect("equal")
        busy = sum(1 for x in k_at.ravel() if x >= 0)
        ax.set_title(f"cycle {t}  ·  {busy}/{P*P} busy", fontsize=8, color=INK)
    fig.suptitle(f"{P}×{P} output-stationary systolic array, K={K}: "
                 f"tile done in K+2P−2 = {K + 2*P - 2} cycles",
                 fontsize=11, color=INK, x=0.02, ha="left")
    fig.text(0.02, 0.005, "Blue = PE doing A[i][k]·B[k][j] this cycle.  "
             "Light = its C[i][j] is final.  Low utilization at the start and end "
             "is the fill/drain cost; it shrinks as K grows.", fontsize=7.5, color=MUTED)
    fig.tight_layout(rect=(0, 0.03, 1, 0.95))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    fig.savefig(a.out, dpi=200, facecolor="white")
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
