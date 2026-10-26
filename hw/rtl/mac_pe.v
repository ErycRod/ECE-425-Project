`timescale 1ns / 1ps
////////////////////////////////////////////////////////////////////////////////
// mac_pe: one processing element of an output-stationary systolic array.
//
// Every cycle the PE forwards its A operand right and its B operand down
// (registered), and when v_in is high adds a_in * b_in into its accumulator.
// `clear` zeroes the accumulator (and wins over a same-cycle accumulate).
////////////////////////////////////////////////////////////////////////////////
module mac_pe #(
    parameter B   = 8,            // operand width (signed)
    parameter ACC = 2 * B + 12    // accumulator width: never overflows for K <= 8191
                                  // (SmolVLM's largest inner dimension is 3072)
)(
    input  wire                  clk,
    input  wire                  rst,      // synchronous, active high
    input  wire                  clear,
    input  wire                  v_in,
    input  wire signed [B-1:0]   a_in,
    input  wire signed [B-1:0]   b_in,
    output reg                   v_out,
    output reg  signed [B-1:0]   a_out,
    output reg  signed [B-1:0]   b_out,
    output reg  signed [ACC-1:0] acc
);
    wire signed [2*B-1:0] prod = a_in * b_in;

    always @(posedge clk) begin
        if (rst) begin
            v_out <= 1'b0;
            a_out <= {B{1'b0}};
            b_out <= {B{1'b0}};
            acc   <= {ACC{1'b0}};
        end else begin
            v_out <= v_in;
            a_out <= a_in;
            b_out <= b_in;
            if (clear)     acc <= {ACC{1'b0}};
            else if (v_in) acc <= acc + prod;      // prod is sign-extended to ACC
        end
    end
endmodule
