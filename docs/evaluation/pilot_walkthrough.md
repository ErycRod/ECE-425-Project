# Pilot walkthrough (developer check, not participant data)

Before the user study, the 8 study tasks in `participant_sheet.md` were run start to finish in
a browser (Chrome, 1440×900 and 390-px phone width), acting as a first-time user who starts on
the Home page. The goal was to make sure every task *can* be completed and to remove obvious
friction before real participants try it. These are not user-study results and are not
counted in `summary.md`.

## Result

All 8 tasks could be completed with no errors in the browser console.

| Task | Level | Done? | Actions needed |
|---|---|---|---|
| T1 Beginner quick checks | Remember / Understand | Yes, all 4 checks give instant feedback, steps get ticked | 9 clicks |
| T2 Read a PE's sum in the animation | Understand | Yes | 1 click on the PE |
| T3 First word under 1 minute | Apply | Yes (16×16, 4-bit), task ticks itself | 2 clicks |
| T4 16-bit, over 10 words/s | Apply | Yes (16-bit, bandwidth ≈ 3 GB/s) | 2 actions |
| T5 Why is 8-bit slower at 4×4 | Analyze | Yes (in-page question with feedback) | 1 click |
| T6 Bits within 5 points of accuracy | Analyze | Yes, once `eryc_model/accuracy.json` exists | 2 clicks |
| T7 16-bit design beating the best first word | Evaluate | Yes (14×14, 16-bit) | 2 actions |
| T8 Download the Verilog + synth command | Create | Yes (`edgevlm_top_p14_b16.v`, command shown) | 1 click |

## Problems found and fixed

| Problem | Fix |
|---|---|
| The animation started with PE(2,3) already selected, which gave away T2. | Starts with no PE selected and says "Click a PE to see the multiply-adds that build its number." |
| The Intermediate bandwidth slider had no accessible name (screen readers announced only "slider"). | Added the label "Memory bandwidth". |
| Leaving a level and coming back reset the tasks, challenges, Beginner checks and the Advanced design. | Progress is now kept for the browser session. |
| After finishing Intermediate there was no obvious next step. | "Done here? Next: Advanced" at the bottom of Intermediate, and a link to the Code page after Advanced. |
| Challenges could be won by dragging the array size to 32×32, far beyond any synthesized design. | Challenges count only up to 24×24, with a note explaining why. |
| Chart tabs wrapped onto two lines on a laptop screen. | Shorter labels ("Time split"). |

## Things to watch in the real study

- Whether people find the bandwidth slider for T4 without a hint (the task hint points to it).
- Whether "math-limited" / "memory-limited" is understood without opening the info tips.
- How long T1 takes for people with no hardware background.
