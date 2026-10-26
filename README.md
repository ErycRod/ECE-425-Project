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
- Twist from synthesis: on this FPGA, 16-bit multipliers use DSP blocks (~296 MHz) while 8/4-bit ones are built
  from LUTs (130–162 MHz), so fewer bits doesn't automatically mean a faster first word.

## Who owns what

| Folder | Owner | What it holds | Status |
| --- | --- | --- | --- |
| `hw/` | Lucius Casertano | Verilog matrix-multiply engine, testbench, Python model of it, Vivado scripts | Working: all 9 designs pass simulation (including worst-case overflow test); Vivado sweep → `results.json` |
| `perf/` | Lucius Casertano | Performance model (TTFT, tokens/s, energy), tradeoff chart, latency + report-table scripts | Working; uses each design's real Fmax and power from `results.json`; workload numbers are a placeholder until Eryc's profile lands |
| `eryc_model/` | Eryc Rodriguez | Running and profiling SmolVLM, 8/4-bit accuracy | Not started, see `eryc_model/README.md` |
<<<<<<< HEAD
| `anh_web/` | Anh Tran | The interactive website | Backend working (FastAPI); web page in progress, see `anh_web/README.md` |
| `docs/` | Everyone | Figures, architecture diagram, report sections | `architecture.png`, `dataflow.png`, `tradeoff.png`, `report/` |

**Real vs. placeholder right now:** hardware numbers (simulation, synthesis) are real.
The workload (how much math SmolVLM does) is a rough placeholder, so TTFT and tokens/s show
the right *trends* but not final values. The model does not answer questions yet.
=======
| `anh_web/` | Anh Tran | The interactive website (FastAPI backend + React frontend) | Controls, KPI cards and bottleneck lamps working; charts next. See [Website](#website-anh_web) |
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
perf/         perf_model.py (TTFT, tokens/s, energy), plot_perf.py (tradeoff chart),
              measure_latency.py (response times), report_table.py (LaTeX table from results.json)
docs/         make_architecture.py (system diagram), report/ (report sections + references)
```

A P x P output tile takes **K + 2P - 2 clock cycles** for inner dimension K.
The accumulators are 2B + 12 bits wide, so they never overflow for K up to 8191
(SmolVLM's largest inner dimension is 3072).

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

# Performance table and figures (use results.json automatically once it exists)
python perf/perf_model.py
python perf/plot_perf.py              # -> docs/tradeoff.png
python hw/model/plot_dataflow.py      # -> docs/dataflow.png
python docs/make_architecture.py      # -> docs/architecture.png
python perf/report_table.py           # -> docs/table_designs.tex (for the report)
```

**Website backend** (Anh's; see `anh_web/README.md` for the page):
```bash
cd anh_web
python -m uvicorn server:app --app-dir backend --port 8000
# then, in another terminal from the repo root: python perf/measure_latency.py
```

**Waveforms:** add `hw/rtl/*.v` and `hw/tb/tb_systolic_array.v` to a Vivado project and click
*Run Behavioral Simulation*. Or with Icarus Verilog + GTKWave:
```bash
iverilog -g2012 -DDUMP -P tb_systolic_array.P=4 -P tb_systolic_array.K=8 -o sim.vvp hw/rtl/*.v hw/tb/tb_systolic_array.v
vvp -n sim.vvp && gtkwave waves.vcd
```

## Website (`anh_web/`)

A dark dashboard where you pick the array size (P), bits per weight and memory bandwidth, and see
TTFT, tokens/s, answer time and whether each phase is compute- or memory-bound. The numbers are
modelled FPGA estimates from `perf/perf_model.py`, not measured times.

| Part | Status |
| --- | --- |
| Hardware controls (P, bits, bandwidth, advanced settings) | Working |
| KPI cards (TTFT, tokens/s, answer time, energy) | Working (energy needs real power data) |
| Bottleneck lamps, target chip info | Working |
| Tradeoff chart, bandwidth curve, phase breakdown | Next |
| FPGA resources (LUT / DSP / FF / BRAM) | Waiting on `results.json` (Vivado sweep) |
| Accuracy at 16 / 8 / 4 bits | Waiting on `eryc_model/accuracy.json` |
| Ask the model (image + question) | Waiting on the model code in `eryc_model/` |

**Needs:** Python 3.9+, Node.js 18+ (with npm). Commands are for Windows PowerShell.

**First-time setup** (from the repo root):
```powershell
python -m venv anh_web\.venv
.\anh_web\.venv\Scripts\python -m pip install -r requirements.txt
cd anh_web\frontend
npm install
```
The website's Python packages are in this root `requirements.txt`. `.venv/` and `node_modules/` are git-ignored.

**Run it** (two PowerShell windows):
```powershell
# Window 1: backend on port 8000 (API docs at http://127.0.0.1:8000/docs)
cd anh_web
.\.venv\Scripts\python -m uvicorn server:app --app-dir backend --port 8000 --reload

# Window 2: frontend on port 5173
cd anh_web\frontend
npm run dev
```
Then open http://localhost:5173. If the backend isn't running, the status bar lamp turns red and the
page shows the command to start it.

**Tests:**
```powershell
# backend (pytest, 20 tests): every number is checked against perf_model.py
cd anh_web
$env:PYTHONDONTWRITEBYTECODE = "1"
.\.venv\Scripts\python -m pytest tests -v

# frontend (Vitest, 10 tests): number formatting, "n/a" for missing values, comparison with design 1
cd frontend
npm test -- --run
```

**Quick demo check** (defaults: 100 MHz, 1 GB/s, utilization 0.8, 32 output tokens):
1. Start at 4×4, 16-bit: TTFT **83.11 s**, **3.7** tokens/s.
2. Click 16×16: TTFT drops to **5.45 s** ("15.3× faster"), tokens/s stays at 3.7.
3. Back to 4×4, click 4-bit: **9.5** tokens/s and the decode lamp flips to **COMPUTE**.
4. At 8×8, 4-bit, drag the bandwidth slider: tokens/s follows it (14.8 at 1 GB/s).

**Where the numbers come from.** The website only displays these; it doesn't change them.
Missing data shows "n/a" or "pending".

| On the page | Comes from |
| --- | --- |
| TTFT, tokens/s, answer time, compute / memory bound | `perf/perf_model.py` (`estimate()`, `phase_time()`) |
| Workload (MACs, parameters, tokens) | `eryc_model/profile_summary.json`, else `perf/example_profile.json` |
| Clock | Advanced setting, else `fmax_mhz` from `results.json`, else 100 MHz |
| LUTs, DSPs, FFs, BRAM, Fmax, power, fits on chip | `results.json` (chip limits match `hw/scripts/run_sweep.py`) |
| Energy per answer | `estimate()` with `power_w` from `results.json` |
| Accuracy | `eryc_model/accuracy.json` |

**Placeholder data:** cards using placeholder input show an amber **PLACEHOLDER DATA** pill. The
backend re-reads its data files when they change, so the site switches over by itself (no restart)
when `results.json`, `eryc_model/profile_summary.json` or `eryc_model/accuracy.json` appear.

```
anh_web/backend/     server.py (FastAPI app, calls perf_model.py), data.py (loads the data files)
anh_web/frontend/    React + Vite app: src/App.jsx, src/api.js, src/format.js, src/components/
anh_web/tests/       backend tests (pytest)
```

Note: `npm audit` reports warnings in development tools only (Vite's esbuild, Vitest), not in the
page itself. Upgrading them is planned after the midproject.

## Deadlines

- **Midproject: Sun Nov 1, 11:59 PM.** 3–4 page report (Overleaf template), repo link, 2-minute video.
  Every member submits their own `P10_MidProject_FullName.zip`.
- **Final: Dec 11.**

Model: [SmolVLM-256M-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) (Apache 2.0).
