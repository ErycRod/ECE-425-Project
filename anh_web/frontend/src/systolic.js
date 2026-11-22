// Where each number is in the systolic array after `s` clock cycles.
// A[i][k] enters PE(i,0) on cycle k+i+1 and moves one PE right per cycle, so after s cycles
// it is in column j = s-1-i-k (negative = still waiting outside, >= P = already passed).
// B[k][j] does the same going down: row i = s-1-j-k.
// systolic.test.js checks this against every frame recorded from the hardware model.
export function aPosition(i, k, s) {
  return s - 1 - i - k;
}

export function bPosition(j, k, s) {
  return s - 1 - j - k;
}
