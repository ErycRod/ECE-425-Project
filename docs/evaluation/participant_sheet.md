# EdgeVLM Lab: participant sheet

Thank you for helping! This is a class project (ECE 425/525, University of Arizona). Your answers
are anonymous and you can stop at any time. We are testing the website, not you.

## Part 1: before using the site (pick one answer each)

1. When a small FPGA chip answers a question about an image, which step takes the most time?
   a) Loading the image  b) The vision encoder  c) Writing the answer  d) Sending the answer to the screen
2. Writing the answer one word at a time (decode) on these chips is mostly limited by…
   a) The number of multipliers  b) The clock speed  c) Memory bandwidth (moving the weights)  d) The size of the image
3. How many multiply-adds does a 16×16 systolic array do in one clock cycle?
   a) 16  b) 32  c) 256  d) 4096
4. Going from 16-bit to 4-bit weights, what happens to the writing speed (words per second)?
   a) About the same  b) About 2× faster  c) About 4× faster  d) Slower
5. On this FPGA, why can fewer bits per weight make the *first* word slower?
   a) Smaller numbers need more memory  b) 8/4-bit multipliers are built from LUTs and run at a lower clock
   c) The model reads more tokens  d) It can't; fewer bits are always faster
6. What do you usually give up when you store a model's weights in fewer bits?
   a) Nothing  b) Some answer accuracy  c) The ability to read images  d) Memory bandwidth

## Part 2: tasks (the observer reads each one aloud)

| # | Level | Task |
|---|---|---|
| T1 | Remember / Understand | Open **Beginner** and go through the 5 steps, answering each quick check. |
| T2 | Understand | In the systolic array animation (step 3), find which PE builds C[2][3] and say what it adds up. |
| T3 | Apply | In **Intermediate**, change the design so the first word arrives in under 1 minute. |
| T4 | Apply | Keep 16-bit weights and make it write faster than 10 words per second. |
| T5 | Analyze | Explain why, at 4×4, the 8-bit design gives its first word later than the 16-bit one. |
| T6 | Analyze | Using the Accuracy tab, which bit width would you choose if you can lose at most 5 points of accuracy? Why? |
| T7 | Evaluate | In **Advanced**, build a 16-bit design that beats the fastest synthesized first word, and explain why it works. |
| T8 | Create | Download the Verilog for your design and say which command would synthesize it. |

## Part 3: after using the site

Answer the 6 questions from Part 1 again.

## Part 4: how was it? (1 = strongly disagree, 5 = strongly agree)

System Usability Scale:
1. I think that I would like to use this website frequently.
2. I found the website unnecessarily complex.
3. I thought the website was easy to use.
4. I think that I would need the support of a technical person to be able to use this website.
5. I found the various functions in this website were well integrated.
6. I thought there was too much inconsistency in this website.
7. I would imagine that most people would learn to use this website very quickly.
8. I found the website very cumbersome to use.
9. I felt very confident using the website.
10. I needed to learn a lot of things before I could get going with this website.

About learning:
11. The levels (Beginner, Intermediate, Advanced) made it clear where to start.
12. The pictures, animation and charts helped me understand more than text alone would.
13. I could now explain to a classmate why a bigger array or fewer bits changes the speed.

## Part 5: comments
What was most confusing? What helped the most?
