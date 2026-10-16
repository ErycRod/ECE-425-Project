# Out-of-context synthesis of one systolic_array configuration for the Zynq-7020.
# Usage: vivado -mode batch -source hw/scripts/synth_one.tcl -tclargs <P> <B> <outdir>
set P   [lindex $argv 0]
set B   [lindex $argv 1]
set out [lindex $argv 2]
set here [file dirname [file normalize [info script]]]

file mkdir $out
read_verilog [glob [file join $here .. rtl *.v]]
read_xdc [file join $here clk.xdc]
synth_design -top systolic_array -part xc7z020clg484-1 -mode out_of_context \
             -generic P=$P -generic B=$B
report_utilization    -file [file join $out utilization.rpt]
report_timing_summary -file [file join $out timing.rpt]
report_power          -file [file join $out power.rpt]
