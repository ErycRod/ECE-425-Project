`timescale 1ns / 1ps
////////////////////////////////////////////////////////////////////////////////
// tb_systolic_array: self-checking test of systolic_array.
// Streams random signed A (P x K) and B (K x P) matrices, waits for busy to
// fall, and compares every C[i][j] with a behavioral matrix multiply.
// Override P / B / K / TRIALS from the command line to test other configs.
// Prints "TEST PASSED" or "FAIL: ...".
////////////////////////////////////////////////////////////////////////////////
module tb_systolic_array;
    parameter P      = 4;
    parameter B      = 8;
    parameter K      = 16;
    parameter TRIALS = 5;
    localparam ACC   = 2 * B + 8;

    reg                  clk = 1'b0, rst = 1'b1, clear = 1'b0, in_valid = 1'b0;
    reg  [P*B-1:0]       a_col = 0, b_row = 0;
    wire [P*P*ACC-1:0]   c_flat;
    wire                 busy;

    systolic_array #(.P(P), .B(B), .ACC(ACC)) dut (
        .clk(clk), .rst(rst), .clear(clear), .in_valid(in_valid),
        .a_col(a_col), .b_row(b_row), .c_flat(c_flat), .busy(busy)
    );

    always #5 clk = ~clk;

    integer A [0:P*K-1];     // A[i*K + k]
    integer Bm[0:K*P-1];     // Bm[k*P + j]
    integer i, j, k, t, tmp, errors = 0, checks = 0, cycles;
    reg signed [63:0] expected, got;

`ifdef DUMP
    // waveform for GTKWave / Vivado: compile with -DDUMP (iverilog) or -d DUMP (xvlog)
    initial begin
        $dumpfile("waves.vcd");
        $dumpvars(0, tb_systolic_array);
    end
`endif

    initial begin
        repeat (3) @(posedge clk);
        @(negedge clk) rst = 1'b0;

        for (t = 0; t < TRIALS; t = t + 1) begin
            // random signed B-bit operands (full range, including -2^(B-1))
            for (i = 0; i < P*K; i = i + 1) begin tmp = $random; A[i]  = tmp >>> (32 - B); end
            for (i = 0; i < K*P; i = i + 1) begin tmp = $random; Bm[i] = tmp >>> (32 - B); end

            @(negedge clk) clear = 1'b1;
            @(negedge clk) clear = 1'b0;

            // stream column k of A and row k of B (one idle cycle mid-stream on odd trials)
            for (k = 0; k < K; k = k + 1) begin
                for (i = 0; i < P; i = i + 1) begin tmp = A[i*K + k];  a_col[i*B +: B] = tmp[B-1:0]; end
                for (j = 0; j < P; j = j + 1) begin tmp = Bm[k*P + j]; b_row[j*B +: B] = tmp[B-1:0]; end
                in_valid = 1'b1;
                @(negedge clk);
                if ((t % 2) && k == K/2) begin in_valid = 1'b0; @(negedge clk); end
            end
            in_valid = 1'b0;

            cycles = 0;
            while (busy && cycles < 10 * P + 10) begin @(negedge clk); cycles = cycles + 1; end

            for (i = 0; i < P; i = i + 1)
                for (j = 0; j < P; j = j + 1) begin
                    expected = 0;
                    for (k = 0; k < K; k = k + 1) expected = expected + A[i*K + k] * Bm[k*P + j];
                    got = $signed(c_flat[(i*P + j)*ACC +: ACC]);
                    checks = checks + 1;
                    if (got !== expected) begin
                        if (errors < 10)
                            $display("FAIL: trial %0d C[%0d][%0d] = %0d, expected %0d", t, i, j, got, expected);
                        errors = errors + 1;
                    end
                end
        end

        if (errors == 0) $display("TEST PASSED: P=%0d B=%0d K=%0d, %0d outputs checked", P, B, K, checks);
        else             $display("FAIL: %0d of %0d outputs wrong (P=%0d B=%0d K=%0d)", errors, checks, P, B, K);
        $finish;
    end
endmodule
