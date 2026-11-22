import { describe, it, expect } from "vitest";
import { aPosition, bPosition } from "./systolic.js";
import recording from "../../../hw/model/systolic_frames.json";

// The animation moves the numbers with aPosition / bPosition. These tests check that rule
// against every frame recorded from the cycle-accurate hardware model, so the picture can't
// drift away from what the Verilog does.
describe("systolic animation follows the hardware model", () => {
  const P = recording.P;
  const K = recording.K;

  it("every active PE holds the A and B numbers the rule puts there", () => {
    let checked = 0;
    for (let s = 0; s < recording.frames.length; s++) {
      const frame = recording.frames[s];
      for (let i = 0; i < P; i++) {
        for (let j = 0; j < P; j++) {
          if (!frame.active[i][j]) {
            continue;
          }
          let foundA = false;
          let foundB = false;
          for (let k = 0; k < K; k++) {
            if (aPosition(i, k, s) === j && recording.A[i][k] === frame.a[i][j]) {
              foundA = true;
            }
            if (bPosition(j, k, s) === i && recording.B[k][j] === frame.b[i][j]) {
              foundB = true;
            }
          }
          expect(foundA).toBe(true);
          expect(foundB).toBe(true);
          checked = checked + 1;
        }
      }
    }
    // every PE does K multiply-adds
    expect(checked).toBe(P * P * K);
  });

  it("a PE is active exactly when the rule puts a number in it", () => {
    for (let s = 0; s < recording.frames.length; s++) {
      for (let i = 0; i < P; i++) {
        for (let j = 0; j < P; j++) {
          const k = s - 1 - i - j;
          const shouldBeActive = k >= 0 && k < K;
          expect(recording.frames[s].active[i][j]).toBe(shouldBeActive);
        }
      }
    }
  });

  it("finishes in K + 2P - 2 cycles with C = A x B", () => {
    expect(recording.cycles).toBe(K + 2 * P - 2);
    expect(recording.frames[recording.frames.length - 1].acc).toEqual(recording.C);
  });
});
