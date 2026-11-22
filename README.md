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
| `eryc_model/` | Eryc Rodriguez (Lucius: accuracy evaluation) | Running and profiling SmolVLM, accuracy at 16/8/4 bits | Profiling done (`profile_summary.json`); accuracy: `eval_accuracy.py` → `accuracy.json`, see `eryc_model/README.md` |
| `anh_web/` | Anh Tran (Lucius: charts, icons, developer view) | The interactive website (FastAPI backend + React frontend) | Controls, KPI cards, 4 charts, resources, bottleneck lamps, developer view and Ask panel working. See [Website](#website-anh_web) |
| `docs/` | Everyone | Figures, architecture diagram, report sections, video slides, user study | `architecture.png`, `dataflow.png`, `tradeoff.png`, `report/`, `video/`, `evaluation/` |

**Real vs. placeholder right now:** hardware numbers (simulation, synthesis) are real, the workload
is measured from SmolVLM (`eryc_model/profile_summary.json`), and SmolVLM answers questions about an
uploaded image on the page. Accuracy at 16 / 8 / 4 bits appears on the page once
`eryc_model/eval_accuracy.py` has been run (it writes `eryc_model/accuracy.json`).

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

# Accuracy at 16 / 8 / 4 bits on VQAv2 questions -> eryc_model/accuracy.json (~20-40 min on a CPU)
python eryc_model/eval_accuracy.py --n 20   # quick try first
python eryc_model/eval_accuracy.py

# Check the Advanced level's hardware estimates on sizes never synthesized (Vivado terminal)
python hw/scripts/check_estimate.py         # 12x12 at 16/8/4 bits -> hw/estimate_checks.json

# Systolic-array animation frames for the Beginner level (already committed)
python hw/model/export_frames.py            # -> hw/model/systolic_frames.json
```

**User study:** see `docs/evaluation/README.md` (session script, participant sheet, results
template). After the sessions: `python docs/evaluation/analyze.py docs/evaluation/results.csv`.

**Website backend** (Anh's; see [Website](#website-anh_web)):
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

A learning site in three levels mapped to Bloom's Taxonomy. Beginner explains the model and the
systolic array step by step; Intermediate lets you pick the array size (P), bits per weight and
memory bandwidth and see TTFT, tokens/s, answer time and whether each phase is compute- or
memory-bound, with tasks to complete; Advanced (in progress) lets you build and rank your own design. The numbers are
modelled FPGA estimates from `perf/perf_model.py`, not measured times.

| Part | Status |
| --- | --- |
| **Levels** (tabs in the top bar, address `#/home`, `#/beginner`, ...): Home · Beginner (Remember, Understand) · Intermediate (Apply, Analyze) · Advanced (Evaluate, Create) · Code | Working (`src/levels.js`, `src/pages/`) |
| Home: the question the tool answers, image→vision→prefill→decode strip, why edge, who it's for, what to know first, level cards | Working |
| Beginner: 5 short steps with a quick-check question each, clickable 3×3 matrix multiply, **animated systolic array** (play / pause / step, click a PE to see its sum), compute- vs memory-bound | Working. The animation replays `hw/model/systolic_model.py` cycle by cycle (`hw/model/export_frames.py` → `hw/model/systolic_frames.json` → `/api/systolic_frames`) |
| Intermediate: one plain-language answer, 4 headline numbers vs the 4×4/16-bit start, one chart at a time, 5 tasks that tick themselves off | Working |
| Advanced: build any P×P design (P = 2–32) at 16/8/4 bits; hardware estimated from the 9 Vivado results (real numbers when the size was synthesized); ranked against the 9 designs with plain-language reasons; generated top-level Verilog + the `run_tb.py` / `synth_one.tcl` commands for it; leave-one-out check of the estimates (worst error 5.8%); 3 challenges | Working (`anh_web/backend/custom_design.py`, `verilog_gen.py`, `/api/custom_design`, `/api/custom_design/validation`) |
| Hardware controls (P, bits, bandwidth, advanced settings) | Working |
| KPI cards (TTFT, tokens/s, answer time, energy) | Working (clock, power and energy use real Vivado data from `results.json`) |
| Bottleneck lamps, target chip info | Working |
| Tradeoff chart (all 9 designs, TTFT vs tokens/s; click a point to select it) | Working |
| Decode speed vs bandwidth (roofline knee: faded = compute-bound) | Working (`/api/bandwidth_curve`) |
| Where the answer time goes (vision / prefill / decode, all 9 designs) | Working |
| FPGA resources (LUT / DSP / FF / BRAM meters vs chip limits, Fmax, power) | Working |
| Every chart: hover tooltips, info tip, one-line takeaway, **Table** button with the same numbers | Working |
| Icons + short labels with (i) tooltips instead of long paragraphs | Working (inline SVG in `components/Icon.jsx`, no extra npm package) |
| **Code page** (developer view): roofline math with live numbers checked against the API, Verilog and Python source, raw API JSON + curl | Working (`/api/source/<name>`, fixed list of files) |
| How it works: architecture + dataflow figures from `docs/` | Working |
| Accuracy at 16 / 8 / 4 bits | Waiting on `eryc_model/accuracy.json` |
| Ask the model (image + question) | Working (`eryc_model/vlm.py`) |

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
# backend (pytest, 47 tests): every number is checked against perf_model.py
cd anh_web
$env:PYTHONDONTWRITEBYTECODE = "1"
.\.venv\Scripts\python -m pytest tests -v

# frontend (Vitest, 36 tests): number formatting, "n/a" for missing values, 4×4 baselines, plain-language durations, chart scales/ticks, animation vs hardware-model frames, Advanced challenges, accuracy task, verdict ranks and accuracy tile, same-answer counts
cd frontend
npm test -- --run

# accuracy tools and user-study analysis (from the repo root)
.\anh_web\.venv\Scripts\python -m pytest eryc_model/tests docs/evaluation -v
```

**Quick demo check** (defaults: each design's Vivado Fmax from `results.json`, measured SmolVLM workload, 1 GB/s, utilization 0.8, 32 output tokens):
1. Start at 4×4, 16-bit (296 MHz): TTFT **399.92 s**, **3.7** tokens/s.
2. Click 4-bit (162 MHz): tokens/s rises to **14.9**, but TTFT gets *slower* (**729.14 s**): 16-bit multipliers use DSP blocks and clock faster.
3. Click 16×16 (still 4-bit): TTFT drops to **45.83 s**, tokens/s stays at 14.9.
4. Drag the bandwidth slider to 4 GB/s: tokens/s follows it (about **59.4**); TTFT barely moves.
5. Bottleneck panel: the vision encoder is about 92% of TTFT in every design.

**Where the numbers come from.** The website only displays these; it doesn't change them.
Missing data shows "n/a" or "pending".

| On the page | Comes from |
| --- | --- |
| TTFT, tokens/s, answer time, compute / memory bound | `perf/perf_model.py` (`estimate()`, `phase_time()`) |
| Workload (MACs, parameters, tokens) | `eryc_model/profile_summary.json`, else `perf/example_profile.json` |
| Clock | Advanced setting, else `fmax_mhz` from `results.json`, else 100 MHz |
| LUTs, DSPs, FFs, BRAM, Fmax, power, fits on chip | `results.json` (chip limits match `hw/scripts/run_sweep.py`) |
| Energy per answer | `estimate()` with `power_w` from `results.json` |
| Accuracy at 16 / 8 / 4 bits (Accuracy tab, answer card, Advanced verdict) | `eryc_model/accuracy.json` from `eryc_model/eval_accuracy.py` |
| Advanced: any P×P design | `anh_web/backend/custom_design.py` (fitted to `results.json`), `verilog_gen.py` |
| "How good are the estimates?" | leave-one-out on `results.json`, plus `hw/estimate_checks.json` if it exists |

**Placeholder data:** cards using placeholder input show an amber **PLACEHOLDER DATA** pill (none
should show now that the measured profile is in). The backend re-reads its data files when they change, so the site switches
over by itself (no restart) when `eryc_model/profile_summary.json` or `eryc_model/accuracy.json` appear.

```
anh_web/backend/     server.py (FastAPI app, calls perf_model.py), data.py (loads the data files)
anh_web/frontend/    React + Vite app: src/App.jsx, src/api.js, src/format.js, src/components/
                     src/pages/ (Home, Beginner, Intermediate, Advanced, Code) + src/levels.js
                     src/charts/ (scales, tooltip, width hook for the hand-drawn SVG charts)
                     src/highlight.js (code colouring for the developer view)
anh_web/tests/       backend tests (pytest)
```

Note: `npm audit` reports warnings in development tools only (Vite's esbuild, Vitest), not in the
page itself. Upgrading them is planned after the midproject.

## Deadlines

- **Midproject: Sun Nov 1, 11:59 PM.** 3–4 page report (Overleaf template), repo link, 2-minute video.
  Every member submits their own `P10_MidProject_FullName.zip`.
- **Final: Dec 11.**

Model: [SmolVLM-256M-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM-256M-Instruct) (Apache 2.0).
