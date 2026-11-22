#!/usr/bin/env python3
"""Export a cycle-by-cycle recording of the systolic array for the website's animation.

Runs the cycle-accurate model (systolic_model.py, which mirrors hw/rtl/systolic_array.v
register by register) on a small 3x3 example and saves the state after every clock edge:
the operands each PE is holding, which PEs did a multiply-add, every accumulator, and the
running list of products that make up each output.

The example uses the same matrices as the Beginner level's matrix-multiply demo, so the
animation ends on the same C the user worked out by hand.

Run:  python hw/model/export_frames.py
Out:  hw/model/systolic_frames.json  (served by the backend at /api/systolic_frames)
"""
import json
import os

import numpy as np

from systolic_model import SystolicArrayModel

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(HERE, "systolic_frames.json")

# same numbers as anh_web/frontend/src/components/MatrixDemo.jsx
A = np.array([[1, 2, 0],
              [3, 1, 2],
              [0, 1, 4]], dtype=np.int64)
B = np.array([[2, 1, 0],
              [1, 3, 1],
              [4, 0, 2]], dtype=np.int64)
BITS = 8


def to_list(matrix):
    return [[int(x) for x in row] for row in matrix]


def snapshot(model, cycle, fed, terms):
    P = model.P
    active = [[bool(model.v_out[i, j]) for j in range(P)] for i in range(P)]
    return {
        "cycle": cycle,
        "fed": fed,                      # what entered the array on this edge (None = nothing)
        "a": to_list(model.a_out),       # operand from A each PE holds after this edge
        "b": to_list(model.b_out),       # operand from B each PE holds after this edge
        "active": active,                # True = this PE did a multiply-add on this edge
        "acc": to_list(model.acc),       # running sums
        "terms": [[list(cell) for cell in row] for row in terms],  # products added so far
    }


def record(A, B, bits):
    P, K = A.shape[0], A.shape[1]
    model = SystolicArrayModel(P, bits)
    model.step(clear=1)
    terms = [[[] for _ in range(P)] for _ in range(P)]
    frames = [snapshot(model, 0, None, terms)]

    cycle = 0
    k = 0
    while k < K or model.busy(0):
        if k < K:
            a_col, b_row = A[:, k], B[k, :]
            model.step(1, a_col, b_row)
            fed = {"k": k, "a_col": [int(x) for x in a_col], "b_row": [int(x) for x in b_row]}
            k += 1
        else:
            model.step(0)
            fed = None
        cycle += 1

        for i in range(P):
            for j in range(P):
                if model.v_out[i, j]:
                    # check the dataflow rule: A[i][kk] and B[kk][j] meet in PE(i,j) at cycle kk+i+j+1
                    kk = cycle - 1 - i - j
                    assert 0 <= kk < K, (cycle, i, j)
                    assert model.a_out[i, j] == A[i, kk] and model.b_out[i, j] == B[kk, j], (cycle, i, j)
                    terms[i][j].append([int(model.a_out[i, j]), int(model.b_out[i, j])])
        frames.append(snapshot(model, cycle, fed, terms))

    C = A @ B
    assert frames[-1]["acc"] == to_list(C), "animation result does not match A @ B"
    assert cycle == K + 2 * P - 2, cycle
    return {
        "P": int(P),
        "K": int(K),
        "bits": bits,
        "A": to_list(A),
        "B": to_list(B),
        "C": to_list(C),
        "cycles": cycle,
        "latency_rule": "K + 2P - 2",
        "source": "hw/model/systolic_model.py (cycle-accurate copy of hw/rtl/systolic_array.v)",
        "frames": frames,
    }


if __name__ == "__main__":
    recording = record(A, B, BITS)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(recording, f, indent=1)
    print("wrote", os.path.relpath(OUT_PATH), "-", len(recording["frames"]), "frames,",
          recording["cycles"], "cycles (K + 2P - 2 =", recording["K"], "+", 2 * recording["P"], "- 2)")
