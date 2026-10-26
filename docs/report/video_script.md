# Midproject video script (2 minutes)

Record the screen with narration. Roughly 280 spoken words. **[Brackets]** show what's on screen.

---

**0:00–0:15 · Intro** *(anyone)*
[Title slide or the site's landing page]
"This is EdgeVLM Lab. It shows what happens when a small vision-language model, SmolVLM, runs on a small FPGA chip, and why the choices you make in hardware change how fast it answers."

**0:15–0:35 · Starting it up** *(Anh)*
[Terminal: start the backend with `python -m uvicorn ...`, then open the page in the browser]
"The backend is a FastAPI server that calls our performance model. The page sends every slider change to it and redraws the results."

**0:35–1:05 · Live interaction** *(Anh)*
[Drag the array-size slider from 4×4 to 16×16. Time to first token drops, tokens per second stays flat.]
"At 4-bit, going from a 4×4 to a 16×16 array makes the first word arrive about fifteen times sooner, but the model doesn't talk any faster."
[Drag the bits slider from 16 to 8 to 4. Tokens per second doubles, then doubles again.]
"Using fewer bits per number is what speeds up talking, because each new word has to re-read every weight from memory."

**1:05–1:35 · Hardware behind the numbers** *(Lucius)*
[Show `architecture.png`, then `dataflow.png`, then the resources readout or Table I]
"These numbers come from our own accelerator: a parameterized systolic array in Verilog. We verified all nine designs in simulation against a cycle-accurate model, including a worst-case test that caught an accumulator overflow. Then we synthesized all nine in Vivado for a Zynq-7020. One surprise: 16-bit multipliers fit in the chip's DSP blocks and run at almost 300 megahertz, while 8-bit ones are built from regular logic at 130, so fewer bits doesn't automatically mean a faster first word."

**1:35–2:00 · What's real and what's next** *(anyone)*
[Status table from the README]
"Right now the hardware numbers are real. The model's workload is still an estimate, and the question-answering isn't connected yet. By December 11 we'll connect SmolVLM, use the real profile and accuracy at 8 and 4 bits, and add a layer-by-layer view and an animated dataflow view, then test the tool with classmates."

---

**If you can't all record together:** Lucius records the 1:05–1:35 part as a separate clip (screen + voice) and sends it to Anh to splice in. Any free screen recorder works (OBS, Windows Game Bar `Win+Alt+R`, or the macOS screenshot toolbar `Cmd+Shift+5`).
