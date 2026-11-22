# User evaluation

A short study to measure whether EdgeVLM Lab is easy to use and whether people learn from it.
Each session takes about 25 minutes with one participant (classmates or friends are fine).
Aim for 5 or more participants.

| File | What it is |
|---|---|
| `participant_sheet.md` | What the participant reads and fills in (print it or share the link) |
| `results_template.csv` | One row per participant; the observer fills this in |
| `analyze.py` | Turns the filled-in CSV into `summary.md` and `summary.png` for the report |
| `pilot_walkthrough.md` | The developer's own run-through before the study (not participant data) |

## Before the session
1. Start the backend and frontend (see the main README) and open http://localhost:5173 on the **Home** page.
2. Have a timer (phone) and a copy of `results_template.csv` open.
3. Tell the participant: *"This is a class project. Your answers are anonymous, nothing personal
   is recorded, and you can stop at any time. We're testing the website, not you."*

## During the session (observer)
1. **Background (1 min):** major, and two 1–5 ratings: deep learning experience, hardware experience.
2. **Pre-quiz (3 min):** the 6 questions in Part 1 of the participant sheet, *before* touching the site.
   Record 1 (right) or 0 (wrong) per question.
3. **Tasks (15 min):** read each task aloud, start the timer, ask them to think aloud. Don't help.
   - If they're stuck for 60 s, give one hint (point to the right tab or the (i) hint icon).
   - Record `success` (no help), `hint` (needed the hint) or `fail` (gave up / 3 min), and the time in seconds.
   - Write down anything they say that shows confusion.
4. **Post-quiz (3 min):** the same 6 questions again (Part 3).
5. **Questionnaire (3 min):** the 10 SUS statements and 3 extra statements (Part 4), each 1–5.
6. **Comments:** "What was most confusing? What helped most?"

## After all sessions
```
python docs/evaluation/analyze.py docs/evaluation/results.csv
```
writes `docs/evaluation/summary.md` (tables to paste into the report) and `summary.png` (chart).
It reports task completion, median times, quiz score before vs after (learning gain), and the
System Usability Scale (SUS) score, where 68 is average and 80+ is very good.

**Report only real sessions.** The pilot walkthrough is a developer check, not participant data.

## Quiz answer key (observer only)
1 b · 2 c · 3 c · 4 c · 5 b · 6 b
