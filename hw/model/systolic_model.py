#!/usr/bin/env python3
"""Cycle-accurate Python model of hw/rtl/systolic_array.v.

Mirrors the RTL register by register (input skew registers, PE a/b/valid
pipeline registers, accumulators, drain counter), so it can be used to:
  * check the dataflow and the "results final when busy falls" timing, and
  * generate golden values for the Verilog testbench and the performance model.

Run:  python hw/model/systolic_model.py      (self-test over many configs)
"""
import numpy as np


class SystolicArrayModel:
    def __init__(self, P, B, acc_bits=None):
        self.P, self.B = P, B
        self.ACC = acc_bits if acc_bits is not None else 2 * B + 8
        self.reset()

    def reset(self):
        P = self.P
        self.sa = [[0] * i for i in range(P)]           # A skew regs, row i has i stages
        self.sv = [[0] * i for i in range(P)]           # valid skew regs (travel with A)
        self.sb = [[0] * j for j in range(P)]           # B skew regs, col j has j stages
        self.v_out = np.zeros((P, P), dtype=np.int64)
        self.a_out = np.zeros((P, P), dtype=np.int64)
        self.b_out = np.zeros((P, P), dtype=np.int64)
        self.acc = np.zeros((P, P), dtype=object)        # python ints: no overflow surprises
        self.drain = 0

    def _wrap(self, x, bits):
        """Two's-complement wrap, like a signed Verilog register of `bits` bits."""
        m = 1 << bits
        x %= m
        return x - m if x >= m // 2 else x

    def busy(self, in_valid):
        return bool(in_valid) or self.drain != 0

    def step(self, in_valid=0, a_col=None, b_row=None, clear=0):
        """Advance one rising clock edge."""
        P = self.P
        a_col = [0] * P if a_col is None else [self._wrap(int(x), self.B) for x in a_col]
        b_row = [0] * P if b_row is None else [self._wrap(int(x), self.B) for x in b_row]

        # combinational inputs to each PE (from skew outputs or neighbour registers)
        a_in = np.zeros((P, P), dtype=np.int64)
        b_in = np.zeros((P, P), dtype=np.int64)
        v_in = np.zeros((P, P), dtype=np.int64)
        for i in range(P):
            for j in range(P):
                if j == 0:
                    a_in[i, j] = a_col[0] if i == 0 else self.sa[i][i - 1]
                    v_in[i, j] = in_valid if i == 0 else self.sv[i][i - 1]
                else:
                    a_in[i, j] = self.a_out[i, j - 1]
                    v_in[i, j] = self.v_out[i, j - 1]
                if i == 0:
                    b_in[i, j] = b_row[0] if j == 0 else self.sb[j][j - 1]
                else:
                    b_in[i, j] = self.b_out[i - 1, j]

        # next-state (all registers update together)
        for i in range(P):
            for j in range(P):
                if clear:
                    self.acc[i, j] = 0
                elif v_in[i, j]:
                    self.acc[i, j] = self._wrap(self.acc[i, j] + int(a_in[i, j]) * int(b_in[i, j]), self.ACC)
        self.v_out, self.a_out, self.b_out = v_in, a_in, b_in
        for i in range(1, P):
            self.sa[i] = [a_col[i]] + self.sa[i][:-1]
            self.sv[i] = [int(in_valid)] + self.sv[i][:-1]
        for j in range(1, P):
            self.sb[j] = [b_row[j]] + self.sb[j][:-1]
        if in_valid:
            self.drain = 2 * P - 2
        elif self.drain:
            self.drain -= 1

    def matmul_tile(self, A, Bm, gaps=()):
        """Stream A (P x K) and B (K x P); return (C, cycles until busy falls)."""
        P, K = self.P, A.shape[1]
        self.step(clear=1)
        cycles = 0
        for k in range(K):
            self.step(1, A[:, k], Bm[k, :]); cycles += 1
            if k in gaps:
                self.step(0); cycles += 1
        while self.busy(0):
            self.step(0); cycles += 1
        return np.array(self.acc, dtype=object), cycles


def _self_test(seed=0):
    rng = np.random.default_rng(seed)
    configs = [(P, B) for P in (1, 2, 3, 4, 8, 16) for B in (4, 8, 16)]
    for P, B in configs:
        m = SystolicArrayModel(P, B)
        for trial in range(3):
            K = int(rng.integers(1, 40))
            lo, hi = -(1 << (B - 1)), (1 << (B - 1))
            A = rng.integers(lo, hi, size=(P, K), dtype=np.int64)
            Bm = rng.integers(lo, hi, size=(K, P), dtype=np.int64)
            gaps = {K // 2} if trial == 1 else set()
            C, cycles = m.matmul_tile(A, Bm, gaps)
            ref = A.astype(object) @ Bm.astype(object)
            assert (C == ref).all(), f"mismatch P={P} B={B} K={K}"
            assert cycles == K + len(gaps) + 2 * P - 2, (P, K, cycles)
    print(f"model self-test passed: {len(configs)} configs x 3 trials; "
          f"latency = K + 2P - 2 cycles per tile")


if __name__ == "__main__":
    _self_test()
