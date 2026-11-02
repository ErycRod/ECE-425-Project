# Overleaf updates for the measured SmolVLM workload

Eryc's real workload profile changed the TTFT numbers, and SmolVLM now answers questions, so a few
sentences in Lucius's sections are out of date. Each step: press **Ctrl+F** in Overleaf, search for
the **Find** text, select that passage, and paste the **Replace with** text over it.

**First, re-upload two figures** into the `figs` folder (Overleaf asks to overwrite; say yes):
`docs/tradeoff.png` and `docs/architecture.png` from this zip.

## 1. Abstract: last sentences

**Find** (starts with): `performance model and back works, with responses in about 1--3~ms. The`

Select from there to the end of this passage:

```latex
performance model and back works, with responses in about 1--3~ms. The
  vision-language model itself and its real workload profile are being
  integrated. Code: \url{https://github.com/ErycRod/ECE-425-Project}.
```

**Replace with:**

```latex
performance model and back works, with responses in about 1--3~ms, and
  SmolVLM answers questions about uploaded images on the same page. Profiling
  the real model shows that the vision encoder accounts for about 92\% of the
  time to first token on every design.
  Code: \url{https://github.com/ErycRod/ECE-425-Project}.
```

## 2. Section 3, 'Frontend and backend': add /api/ask

**Find** (starts with): `\texttt{/api/bandwidth\_curve} returns tokens/s as bandwidth varies. T`

Select from there to the end of this passage:

```latex
\texttt{/api/bandwidth\_curve} returns tokens/s as bandwidth varies. The
backend calls the performance model directly, without changing its output.
```

**Replace with:**

```latex
\texttt{/api/bandwidth\_curve} returns tokens/s as bandwidth varies, and
\texttt{/api/ask} sends an uploaded image and question to SmolVLM and returns
its answer with the measured time. The
backend calls the performance model directly, without changing its output.
```

## 3. Table I: replace the whole table

**Find:** search for `\label{tab:designs}`. Select from the `\begin{table}[t]` just above it
down to its `\end{table}` (stop before the `% ----` comment line).

**Replace with:**

```latex
\begin{table}[t]
\centering
\small
\setlength{\tabcolsep}{3.5pt}
\caption{The nine designs on the Zynq-7020 (Vivado, post-synthesis) and their predicted TTFT and decode speed at each design's $f_{\max}$, 1~GB/s.}
\label{tab:designs}
\begin{tabular}{l c r r r r r r}
\hline
Array & Bits & LUTs & DSPs & $f_{\max}$ & Power & TTFT & Tok/s \\
      &      &      &      & (MHz)      & (W)   & (s)  &       \\
\hline
$4\times4$ & 16 & 25 & 16 & 295.9 & 0.121 & 399.92 & 3.7 \\
$8\times8$ & 16 & 123 & 64 & 295.9 & 0.179 & 100.18 & 3.7 \\
$16\times16$ & 16 & 12,158 & 220 & 94.9 & 0.517 & 78.15 & 3.7 \\
$4\times4$ & 8 & 1,433 & 0 & 130.2 & 0.137 & 908.40 & 7.4 \\
$8\times8$ & 8 & 5,754 & 0 & 130.2 & 0.213 & 227.20 & 7.4 \\
$16\times16$ & 8 & 22,842 & 0 & 130.2 & 0.522 & 56.90 & 7.4 \\
$4\times4$ & 4 & 610 & 0 & 162.2 & 0.117 & 729.14 & 14.9 \\
$8\times8$ & 4 & 2,427 & 0 & 162.2 & 0.149 & 182.34 & 14.9 \\
$16\times16$ & 4 & 9,836 & 0 & 161.5 & 0.274 & 45.83 & 14.9 \\
\hline
\end{tabular}
\end{table}
```

## 4. Section 3, the paragraph starting "Figure 3 shows the tool's central lesson"

**Find** (starts with): `Figure~\ref{fig:tradeoff} shows the tool's central lesson. Decode does`

Select from there to the end of this passage:

```latex
Figure~\ref{fig:tradeoff} shows the tool's central lesson. Decode does about
one MAC per weight byte, so it is memory-bound: array size leaves tokens/s
unchanged, and only fewer bits raise it (3.7, 7.4 and 14.8 tokens/s at 16, 8
and 4 bits). Vision and prefill are compute-bound, so TTFT falls with array
size: at 4~bits, from 51~s at $4\times4$ to 3.3~s at $16\times16$, close to
the $P^2=16\times$ expected. The synthesis results add a twist that users can
discover with the sliders: fewer bits do not always give a faster first
token. 16-bit PEs run in DSP slices at 296~MHz while 8-bit PEs run in LUTs at
130~MHz, so at $4\times4$ and $8\times8$ the 16-bit design has the
\emph{shortest} TTFT (28~s vs.\ 64~s at $4\times4$). Packing two 8-bit
multiplies into each DSP would remove this penalty. Overall, $16\times16$ at
4~bits is best on every axis: 3.3~s TTFT, 14.8 tokens/s and 1.5~J of
accelerator energy per 32-token answer. The workload is still a placeholder
(Section~\ref{sec:roadmap}), so the trends hold but the absolute numbers
will change.
```

**Replace with:**

```latex
Figure~\ref{fig:tradeoff} shows the tool's central lesson, using the workload
measured by profiling SmolVLM on an example photo. The image is split into
sub-images, giving 1.40 trillion vision MACs and 877 prefill tokens.
Decode does about one MAC per weight byte, so it is memory-bound: array size
leaves tokens/s unchanged, and only fewer bits raise it (3.7, 7.4 and 14.9
tokens/s at 16, 8 and 4 bits). Vision and prefill are compute-bound, so TTFT
falls with array size: at 4~bits, from 729~s at $4\times4$ to 46~s at
$16\times16$, the $P^2=16\times$ expected. The vision encoder alone is about
92\% of TTFT in every design, which makes it the first target for
optimization. The synthesis results add a twist that users can discover with
the sliders: fewer bits do not always give a faster first token. 16-bit PEs
run in DSP slices at 296~MHz while 8-bit PEs run in LUTs at 130~MHz, so at
$4\times4$ and $8\times8$ the 16-bit design has the \emph{shortest} TTFT
(400~s vs.\ 908~s at $4\times4$). Packing two 8-bit multiplies into each DSP
would remove this penalty. Overall, $16\times16$ at 4~bits is best on every
axis: 46~s TTFT, 14.9 tokens/s and 13~J of accelerator energy per 32-token
answer. Even this best design takes most of a minute to start answering on a
small FPGA, which quantifies how far edge VLMs are from feeling interactive.
```

## 5. Figure 3 caption

**Find** (starts with): `Vivado $f_{\max}$ (placeholder workload, 1~GB/s).`

Select from there to the end of this passage:

```latex
Vivado $f_{\max}$ (placeholder workload, 1~GB/s).
```

**Replace with:**

```latex
Vivado $f_{\max}$ (measured SmolVLM workload, 1~GB/s).
```

## 6. Table II: SmolVLM row

**Find** (starts with): `SmolVLM answer, CPU (one question) & pending \\`

Select from there to the end of this passage:

```latex
SmolVLM answer, CPU (one question) & pending \\
```

**Replace with:**

```latex
SmolVLM answer, CPU (one question) & [TBD] s \\
```

## 7. Section 6 roadblocks (3) and (5)

**Find** (starts with): `(3)~\emph{Placeholder workload:} SmolVLM splits large images into sub-`

Select from there to the end of this passage:

```latex
(3)~\emph{Placeholder workload:} SmolVLM splits large images into sub-images,
so the real number of image tokens, and therefore TTFT, may be several times
the placeholder until profiling is done.
```

**Replace with:**

```latex
(3)~\emph{Real workload:} the measured profile is about $15\times$ larger
than our early estimate, because SmolVLM splits each image into sub-images
(877 prefill tokens), so TTFT is minutes, not seconds, on small arrays.
```

## 7b. Section 6 roadblock (5)

**Find** (starts with): `(5)~\emph{Integration:} the model is not yet connected to \texttt{/api`

Select from there to the end of this passage:

```latex
(5)~\emph{Integration:} the model is not yet connected to \texttt{/api/ask}.
```

**Replace with:**

```latex
(5)~\emph{Model integration:} SmolVLM now answers through \texttt{/api/ask};
it is loaded once when the backend starts, so only the first question waits
for the model to load.
```

## 8. Roadmap, Nov 2-8 line

**Find** (starts with): `cycle-accurate run of a full $576\times576$ layer. E: real profile`

Select from there to the end of this passage:

```latex
cycle-accurate run of a full $576\times576$ layer. E: real profile
        and 16/8/4-bit accuracy; connect SmolVLM to \texttt{/api/ask}.
        A: finish the sliders and placeholder labels.
```

**Replace with:**

```latex
cycle-accurate run of a full $576\times576$ layer. E: 16/8/4-bit
        accuracy on a small image--question set. A: tradeoff chart and
        FPGA-resources card.
```

## 9. Last step

Fill the `[TBD] s` in Table II (SmolVLM answer) with the **"Measured on this PC"** time
shown in the page's Ask the model card after a question (use the second question, not the first,
which includes loading the model). Then Recompile and check it still fits in 4 pages.
