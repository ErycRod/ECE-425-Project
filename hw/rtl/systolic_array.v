`timescale 1ns / 1ps
////////////////////////////////////////////////////////////////////////////////
// systolic_array: P x P output-stationary systolic array computing C = A * B
// for one P x P output tile (A is P x K, B is K x P, K streamed over time).
//
// Each cycle with in_valid high, present column k of A and row k of B:
//   a_col[i*B +: B] = A[i][k]     (i = 0..P-1)
//   b_row[j*B +: B] = B[k][j]     (j = 0..P-1)
// Row i of A is delayed i cycles and column j of B is delayed j cycles, so
// A[i][k] and B[k][j] meet in PE(i,j) at cycle k + i + j.
//
// Results: c_flat[(i*P + j)*ACC +: ACC] = C[i][j] (signed). They are final
// when busy goes low, 2P-2 cycles after the last in_valid. Pulse `clear` for
// one cycle before streaming a new tile.
////////////////////////////////////////////////////////////////////////////////
module systolic_array #(
    parameter P   = 4,            // array is P x P PEs
    parameter B   = 8,            // operand width
    parameter ACC = 2 * B + 8     // accumulator width
)(
    input  wire                 clk,
    input  wire                 rst,
    input  wire                 clear,
    input  wire                 in_valid,
    input  wire [P*B-1:0]       a_col,
    input  wire [P*B-1:0]       b_row,
    output wire [P*P*ACC-1:0]   c_flat,
    output wire                 busy
);
    // Horizontal (A, valid) links: P rows x (P+1) positions.
    // Vertical (B) links: (P+1) rows x P columns.
    // Unpacked per-link wires (not one flat bus) so simulators only wake the
    // PE that actually reads a changed link; synthesizes identically.
    wire [B-1:0] a_bus [0:P*(P+1)-1];
    wire         v_bus [0:P*(P+1)-1];
    wire [B-1:0] b_bus [0:(P+1)*P-1];

    genvar i, j;
    generate
        // ---- input skew for A rows (and the valid bit that travels with A)
        for (i = 0; i < P; i = i + 1) begin : g_skew_a
            if (i == 0) begin : g_direct
                assign a_bus[0] = a_col[0 +: B];
                assign v_bus[0]      = in_valid;
            end else begin : g_delay
                reg [B-1:0] sa [0:i-1];
                reg         sv [0:i-1];
                integer k;
                always @(posedge clk) begin
                    if (rst) begin
                        for (k = 0; k < i; k = k + 1) begin
                            sa[k] <= {B{1'b0}};
                            sv[k] <= 1'b0;
                        end
                    end else begin
                        sa[0] <= a_col[i*B +: B];
                        sv[0] <= in_valid;
                        for (k = 1; k < i; k = k + 1) begin
                            sa[k] <= sa[k-1];
                            sv[k] <= sv[k-1];
                        end
                    end
                end
                assign a_bus[i*(P+1)] = sa[i-1];
                assign v_bus[i*(P+1)]          = sv[i-1];
            end
        end

        // ---- input skew for B columns
        for (j = 0; j < P; j = j + 1) begin : g_skew_b
            if (j == 0) begin : g_direct
                assign b_bus[0] = b_row[0 +: B];
            end else begin : g_delay
                reg [B-1:0] sb [0:j-1];
                integer k;
                always @(posedge clk) begin
                    if (rst) begin
                        for (k = 0; k < j; k = k + 1) sb[k] <= {B{1'b0}};
                    end else begin
                        sb[0] <= b_row[j*B +: B];
                        for (k = 1; k < j; k = k + 1) sb[k] <= sb[k-1];
                    end
                end
                assign b_bus[j] = sb[j-1];
            end
        end

        // ---- PE grid
        for (i = 0; i < P; i = i + 1) begin : g_row
            for (j = 0; j < P; j = j + 1) begin : g_col
                mac_pe #(.B(B), .ACC(ACC)) pe (
                    .clk  (clk),
                    .rst  (rst),
                    .clear(clear),
                    .v_in (v_bus[i*(P+1) + j]),
                    .a_in (a_bus[i*(P+1) + j]),
                    .b_in (b_bus[i*P + j]),
                    .v_out(v_bus[i*(P+1) + j + 1]),
                    .a_out(a_bus[i*(P+1) + j + 1]),
                    .b_out(b_bus[(i+1)*P + j]),
                    .acc  (c_flat[(i*P + j)*ACC +: ACC])
                );
            end
        end
    endgenerate

    // ---- busy: high from the first in_valid until the last product reaches PE(P-1,P-1)
    localparam integer DRAIN = 2 * P - 2;
    reg [15:0] drain_cnt;
    always @(posedge clk) begin
        if (rst)                  drain_cnt <= 16'd0;
        else if (in_valid)        drain_cnt <= DRAIN;
        else if (drain_cnt != 0)  drain_cnt <= drain_cnt - 16'd1;
    end
    assign busy = in_valid | (drain_cnt != 16'd0);
endmodule
