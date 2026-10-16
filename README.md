# EdgeVLM Lab

ECE 425/525 (Fall 2026) team project, P10.

**What it is:** an interactive tool that shows what happens when a small vision-language model
(SmolVLM-256M) runs on a small FPGA chip. Users ask the model about an image, then change hardware
choices (how many multipliers, how many bits per number, memory bandwidth) and see how speed,
accuracy, chip size and power change.

**The main lesson:** more multipliers make the model start answering sooner, but they don't make it
talk faster. Fewer bits do.
- Before the first word (*prefill*), the model does a huge amount of math, so a bigger multiplier array helps.
- After that (*decode*), each new word re-reads all the model's weights from memory, so fewer bits per weight helps.

## Who owns what

| Folder | Owner | What it holds | Status |
| --- | --- | --- | --- |
| `hw/` | Lucius Casertano | Verilog matrix-multiply engine, testbench, Python model of it, Vivado scripts | Engine passes simulation; Vivado sweep not run yet |
| `perf/` | Lucius Casertano | Performance model (TTFT, tokens/s) and tradeoff chart | Working, but uses placeholder workload numbers |
| `eryc_model/` | Eryc Rodriguez | Running and profiling SmolVLM, 8/4-bit accuracy | Not started, see `eryc_model/README.md` |
| `anh_web/` | Anh Tran | The interactive website | Not started, see `anh_web/README.md` |
| `docs/` | Everyone | Figures and diagrams for the report | Two figures so far |

## How the pieces connect

```
eryc_model/profile_summary.json ─┐
                                 ├─> perf/perf_model.py ─> TTFT, tokens/s ─┐
hw/ ── Vivado sweep ─> results.json ┘                                      ├─> anh_web/ (sliders + charts)
                                    └──────────────────────────────────────┘
```

- **Eryc → Lucius:** `eryc_model/profile_summary.json` (how much work the model does) replaces the placeholder `perf/example_profile.json`.
- **Lucius → Anh:** `results.json` (chip size, clock speed, power for each of the 9 designs) and `perf/perf_model.py`.

## Hardware (`hw/`)

A P x P grid of multiply-add units (a *systolic array*) that multiplies matrices, written in Verilog.
P (grid size) and B (bits per number) are parameters, giving 9 designs:

| | 4 x 4 | 8 x 8 | 16 x 16 |
| --- | --- | --- | --- |
| 16-bit | design 1 | design 2 | design 3 (exceeds the chip's 220 DSPs) |
| 8-bit | design 4 | design 5 | design 6 |
| 4-bit | design 7 | design 8 | design 9 |

```
hw/rtl/       mac_pe.v (one multiply-add unit), systolic_array.v (the grid)
hw/tb/        tb_systolic_array.v: feeds random matrices, checks every answer
hw/model/     systolic_model.py: cycle-by-cycle Python copy of the hardware
              plot_dataflow.py: draws the data moving through the grid
hw/scripts/   run_tb.py (simulate all 9), run_sweep.py + synth_one.tcl (Vivado), clk.xdc
```

A P x P output tile takes **K + 2P - 2 clock cycles** for inner dimension K.

## Running it

```bash
pip install -r requirements.txt

# Python model self-test
python hw/model/systolic_model.py

# Simulate the Verilog for all 9 designs (Vivado's simulator; open a terminal
# where Vivado's settings64 script has been run). Or add: --sim iverilog
python hw/scripts/run_tb.py

# Synthesize all 9 designs in Vivado -> results.json (try one first: --sizes 4 --bits 8)
python hw/scripts/run_sweep.py

# Performance table and figures
python perf/perf_model.py
python hw/model/plot_dataflow.py      # -> docs/dataflow.png
python perf/plot_perf.py              # -> docs/tradeoff.png
```

**Waveforms:** add `hw/rtl/*.v` and `hw/tb/tb_systolic_array.v` to a Vivado project and click
*Run Behavioral Simulation*. Or with Icarus Verilog + GTKWave:
```bash
iverilog -g2012 -DDUMP -P tb_systolic_array.P=4 -P tb_systolic_array.K=8 -o sim.vvp hw/rtl/*.v hw/tb/tb_systolic_array.v
vvp -n sim.vvp && gtkwave waves.vcd
```

## Deadlines

- **Midproject: Sun Nov 1, 11:59 PM.** 3–4 page report (Overleaf template), repo link, 2-minute video.
  Every member submits their own `P10_MidProject_FullName.zip`.
- **Final: Dec 11.**

Model: [SmolVLM-256M-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) (Apache 2.0).
