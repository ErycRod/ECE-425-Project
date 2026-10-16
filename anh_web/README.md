# Website (Anh Tran)

**Your job:** build the interactive app people use: upload an image, ask a question, see the answer,
and move sliders (array size, bits, memory bandwidth) that update time-to-first-token, tokens/s,
FPGA resources and charts.

**What to put in this folder:** the app code (React/Vite as planned, or Gradio/Streamlit for a faster
first version) plus a short "how to run it" section in this README.

**Data you can use from the rest of the repo:**
- `results.json` at the repo root (after Lucius runs the Vivado sweep): LUTs, DSPs, Fmax, power per design.
- `perf/perf_model.py`: the `estimate()` function turns slider values into TTFT and tokens/s.
- `docs/dataflow.png`, `docs/tradeoff.png`: figures you can show or redraw interactively.

**Midproject need (due Nov 1):** at least one slider that visibly changes an output on screen,
with screenshots for the report and a 2-minute demo video.
