# 100 MHz target for out-of-context synthesis; tighten to find Fmax
create_clock -period 10.000 -name clk [get_ports clk]
