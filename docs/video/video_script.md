# EdgeVLM Lab: 2-minute mid-project video

Five short clips, recorded one at a time, then joined in Clipchamp. About 285 spoken words ≈ 1:55.
The guidelines want: (1) the app starting up, (2) a control changing an output live, (3) narration on
what works now and what's planned for Dec 11.

---

## Before you hit record (10 min)

1. **Start everything once to warm it up**, then stop it (Ctrl+C) so the start-up in Clip B is quick:
   - Window 1: `cd C:\Users\light\ECE-425-Project\anh_web` → `python -m uvicorn server:app --app-dir backend --port 8000`
   - Window 2: `cd C:\Users\light\ECE-425-Project\anh_web\frontend` → `npm run dev`
2. **Clean screen:** close every other tab, hide the bookmarks bar (**Ctrl+Shift+B**), Do Not Disturb on
   (**Win+N**), close Discord/Teams/etc.
3. **Open the three slides and two figures** as tabs in one browser window, in this order:
   `01_title.png`, `architecture.png`, `dataflow.png`, `02_synthesis.png`, `03_status.png`
   (drag each file from `docs\video\` or `docs\` into the browser). Press **F11** for full screen when showing them.
4. **Mic check:** record 5 seconds in Clipchamp and play it back.
5. Clipchamp: Start → **Clipchamp** → **Create a new video** → left sidebar **Record & create** → **Screen**
   → choose **Entire screen**, microphone **on**. After each clip: **Save and edit** (it lands in your media).

---

## Clip A · Title · ~11 s

**Screen:** `01_title.png`, full screen (F11).
**Do:** nothing, just talk.
**Say:**
> "Hi, we're Team P10. EdgeVLM Lab shows how the design of a small hardware accelerator changes how fast
> a vision-language model answers on an edge FPGA."

## Clip B · Starting the app · ~15 s

**Screen:** the two Command Prompt windows side by side (both already `cd`'d into the right folder).
**Do:**
1. Window 1: run the `uvicorn` command, wait for **"Uvicorn running on http://127.0.0.1:8000"**.
2. Window 2: run `npm run dev`, wait for the **VITE ready** line.
3. Open the browser to **http://localhost:5173**. Wait until the top right says **Backend online**.

**Say (while it starts):**
> "The app has three parts: a React page, a FastAPI backend, and our performance model, which uses real
> synthesis results from our own Verilog accelerator. Here I start the backend and the page."

## Clip C · Live demo · ~38 s (the most important clip)

**Screen:** the page. Check it starts at **4×4**, **16-bit**, bandwidth **1.00 GB/s** (reload the page if not).
Move slowly and let each number change sit for about a second before you talk about it.

| # | Do | You'll see | Say |
|---|---|---|---|
| 1 | Hover over the four cards | TTFT **28.27 s**, decode **3.7 tok/s**, clock **295.9 MHz** in the line above the cards | "A 4-by-4 array at 16-bit: 28 seconds to the first word, under 4 words per second." |
| 2 | Click **4-bit** | decode **14.8 tok/s** ("4.0× higher"), TTFT **51.14 s** ("1.8× slower") | "4-bit makes it talk four times faster, since every new word re-reads all the weights and they're now a quarter the size. But the first word got *slower*. More on that soon." |
| 3 | Click **8×8**, pause, click **16×16** | TTFT **12.84 s → 3.27 s**, decode stays **14.8** | "A bigger array fixes the wait: 13 seconds, then about 3, while decode speed doesn't move." |
| 4 | Drag the **Memory bandwidth** slider slowly from 1 to **4.00** | decode climbs to **59.3 tok/s** ("16.0× higher"), TTFT stays ~3.2 s | "To talk faster, add memory bandwidth: almost 60 words per second." |
| 5 | Move the mouse over **Bottleneck status** | Vision encoder & LM prefill **COMPUTE**, Decode **MEMORY** | "The bottleneck panel shows why: reading the image is compute-bound, writing words is memory-bound." |

## Clip D · The hardware behind the numbers · ~31 s

**Screen:** full screen, switch tabs with **Ctrl+Tab**: `architecture.png` (≈8 s) → `dataflow.png` (≈8 s) →
`02_synthesis.png` (≈15 s).
**Say:**
> *(architecture)* "These numbers come from our own accelerator, a parameterized systolic array in Verilog.
> *(dataflow)* All nine versions pass simulation, including a worst-case test that caught an overflow bug.
> *(synthesis slide)* Synthesizing them in Vivado explains the surprise: at 16-bit each multiplier fits in
> a DSP block and runs near 300 megahertz, but at 8 and 4 bits it's built from regular logic at 130 to
> 160. So fewer bits doesn't always mean a faster first word."

## Clip E · Where we are and what's next · ~22 s

**Screen:** `03_status.png`, full screen.
**Say:**
> "Today the full loop works in a few milliseconds, with real synthesis numbers; the model's workload is
> still an estimate. By December 11th you'll be able to ask SmolVLM about an image, see real accuracy at
> 8 and 4 bits, explore layer-by-layer and animated dataflow views, and we'll test it with classmates.
> Thanks!"

---

## Putting it together (15 min)

1. In Clipchamp, drag the clips onto the timeline in order **A B C D E**.
2. Trim the dead air at the start and end of each clip (drag the clip edges inward).
3. Check the total length (bottom of the timeline) is **2:00 or less**. If it's over, trim pauses in Clip C first.
4. **Export → 1080p**. Watch it once all the way through.
5. Upload the MP4 to YouTube as **Unlisted** (backup link, in case D2L limits file size).
6. Put the raw clips + final MP4 in a shared Google Drive folder. If Anh's page improves before Sunday,
   he can re-record **only Clip C** with the same lines and swap it in.
