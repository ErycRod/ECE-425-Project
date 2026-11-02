# EdgeVLM Lab: 2-minute mid-project video

Five short clips, recorded one at a time, then joined in Clipchamp. About 290 spoken words ≈ 1:55.
The guidelines want: (1) the app starting up, (2) a control changing an output live, (3) narration on
what works now and what's planned for Dec 11.

Numbers below use the **measured SmolVLM workload** (`eryc_model/profile_summary.json`), each design's
Vivado clock, bandwidth **1.00 GB/s**, and the Advanced settings at their defaults. If the page shows
slightly different numbers, read what's on screen.

---

## Before you hit record (10 min)

1. **Start everything once to warm it up** (the first SmolVLM answer is slow while the model loads):
   - Window 1: `cd anh_web` → `python -m uvicorn server:app --app-dir backend --port 8000`
   - Window 2: `cd anh_web\frontend` → `npm run dev`
   - Open http://localhost:5173 and ask one test question in **Ask the model** so the model is loaded.
   - Then stop both (Ctrl+C) so Clip B can show the start-up. *(Or skip the restart: Clip B can just
     show the two windows already running and the page loading.)*
2. **Have a photo ready** for Clip C (something obvious, e.g. a dog or a street scene), saved somewhere easy.
3. **Clean screen:** close other tabs, hide the bookmarks bar (**Ctrl+Shift+B**), Do Not Disturb on
   (**Win+N**), close chat apps.
4. **Open the slides and figures** as browser tabs, in order: `docs/video/01_title.png`,
   `docs/architecture.png`, `docs/dataflow.png`, `docs/video/02_synthesis.png`, `docs/video/03_status.png`.
   **F11** = full screen, **Ctrl+Tab** = next tab.
5. **Mic check:** record 5 seconds in Clipchamp and play it back.
6. Clipchamp: Start → **Clipchamp** → **Create a new video** → **Record & create** → **Screen** →
   Entire screen, microphone on. After each clip: **Save and edit**.

---

## Clip A · Title · ~10 s

**Screen:** `01_title.png`, full screen.
> "Hi, we're Team P10. EdgeVLM Lab shows how the design of a small hardware accelerator changes how fast
> a vision-language model answers on an edge FPGA."

## Clip B · Starting the app · ~12 s

**Screen:** the two command windows, then the browser.
**Do:** run the `uvicorn` command, run `npm run dev`, open **http://localhost:5173**, wait for **Backend online**.
> "It's a React page and a FastAPI backend connected to SmolVLM and to our performance model, which
> uses real synthesis results from our own Verilog accelerator."

## Clip C · Live demo · ~50 s (the most important clip)

**Start state:** **4×4**, **16-bit**, bandwidth **1.00 GB/s**. Move slowly; let each change sit a second.

| # | Do | You'll see | Say |
|---|---|---|---|
| 1 | Hover the cards | TTFT **≈400 s**, decode **3.7 tok/s** | "A 4-by-4 array at 16-bit: almost seven minutes before the first word, then under 4 words a second." |
| 2 | Click **4-bit** | decode **14.9 tok/s**, TTFT **≈729 s** | "4-bit talks four times faster, since every word re-reads all the weights and they're a quarter the size. But the first word got *slower*. More on that soon." |
| 3 | Click **8×8**, pause, **16×16** | TTFT **≈182 s → ≈46 s**, decode stays 14.9 | "A bigger array fixes the wait: three minutes, then 46 seconds." |
| 4 | Drag **Memory bandwidth** to **4.00** | decode **≈59 tok/s**, TTFT unchanged | "To talk faster, add memory bandwidth." |
| 5 | Point at **Bottleneck status** | Vision encoder **≈42 s, COMPUTE**; Decode **MEMORY** | "And the bottleneck panel shows 92% of the wait is the vision encoder." |
| 6 | Scroll to **Ask the model**: pick your photo, type *"What is in this picture?"*, click Ask | SmolVLM's answer + "Measured on this PC" time | "Here's SmolVLM itself answering a real question through the same page." |

*(In Clipchamp, cut the waiting while the answer generates.)*

## Clip D · The hardware behind the numbers · ~28 s

**Screen:** `architecture.png` (≈7 s) → `dataflow.png` (≈7 s) → `02_synthesis.png` (≈14 s).
> *(architecture)* "These numbers come from our own accelerator, a parameterized systolic array in Verilog.
> *(dataflow)* All nine versions pass simulation, including a worst-case test that caught an overflow bug.
> *(synthesis)* Vivado explains the surprise: at 16-bit each multiplier fits in a DSP block near 300
> megahertz, but at 8 and 4 bits it's built from regular logic at 130 to 160. So fewer bits doesn't
> always mean a faster first word."

## Clip E · Where we are and what's next · ~18 s

**Screen:** `03_status.png`.
> "Today the full loop works: real synthesis numbers, a measured model workload, and SmolVLM answering
> questions. By December 11th we'll add accuracy at 8 and 4 bits, ways to cut the wait, layer-by-layer
> and dataflow views, and a user study. Thanks!"

---

## Putting it together (15 min)

1. Drag the clips onto the Clipchamp timeline in order **A B C D E**.
2. Trim dead air at each end, and cut the wait while SmolVLM generates in Clip C.
3. Total must be **2:00 or less**. If it's over, trim pauses in Clip C first.
4. **Export → 1080p**, watch it once, upload to YouTube as **Unlisted** as a backup link.
5. Share the MP4 + YouTube link in the group chat so everyone can add it to their zip.
