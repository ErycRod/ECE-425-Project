"""Advanced level: estimate, rank and explain a design the hardware team never synthesized.

The 9 Vivado results (results.json) are the only real hardware numbers we have. For any other
array size we fit simple per-bit-width models to them:

  * 8-bit and 4-bit: Vivado builds every multiplier from LUTs, so LUTs, flip-flops and power
    grow in a straight line with the number of PEs (N = P*P). Fmax doesn't depend on P
    (each PE only talks to its neighbours), so we use the average synthesized Fmax.
  * 16-bit: each PE fits in one DSP block until the chip's 220 DSPs run out. Past that, Vivado
    builds the extra multipliers from LUTs ("spill"), which costs ~330 LUTs each and drops the
    clock to ~95 MHz (what happened to the 16x16 design). So 16-bit has a line for the DSP
    part plus a per-spilled-PE cost.

leave_one_out() checks the 8- and 4-bit lines by fitting on two designs and predicting the
third. Everything here is plain Python (no FastAPI), so it is easy to test.
"""

MIN_P = 2
MAX_P = 32
DSP_LIMIT = 220
BIT_WIDTHS = [16, 8, 4]


# ---- small helpers -----------------------------------------------------------------------
def fit_line(xs, ys):
    """Least-squares straight line y = a + b*x. Returns (a, b). Needs at least 1 point."""
    n = len(xs)
    if n == 1:
        return ys[0], 0.0
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    top = 0.0
    bottom = 0.0
    for i in range(n):
        top = top + (xs[i] - mean_x) * (ys[i] - mean_y)
        bottom = bottom + (xs[i] - mean_x) ** 2
    if bottom == 0:
        return mean_y, 0.0
    b = top / bottom
    a = mean_y - b * mean_x
    return a, b


def mean(values):
    return sum(values) / len(values)


def rows_for_bits(rows, bits):
    found = []
    for row in rows:
        if row.get("bits") == bits and row.get("luts") is not None:
            found.append(row)
    return found


# ---- the resource model --------------------------------------------------------------------
def build_model(rows):
    """Fit the per-bit-width models from results.json rows. Returns {bits: coefficients}."""
    model = {}
    for bits in BIT_WIDTHS:
        group = rows_for_bits(rows, bits)
        if len(group) == 0:
            continue

        if bits == 16:
            # PEs that fit in DSPs vs designs that spilled into LUTs
            normal = []
            spilled = []
            for row in group:
                if row["P"] * row["P"] <= DSP_LIMIT:
                    normal.append(row)
                else:
                    spilled.append(row)
            if len(normal) == 0:
                normal = group
                spilled = []
            xs = [r["P"] * r["P"] for r in normal]
            entry = {
                "luts": fit_line(xs, [r["luts"] for r in normal]),
                "ffs": fit_line(xs, [r["ffs"] for r in normal]),
                "power": fit_line(xs, [r["power_w"] for r in normal]),
                "fmax": mean([r["fmax_mhz"] for r in normal]),
                "spill": None,
            }
            # extra cost per spilled PE = what the line misses, divided by the spilled PEs
            if len(spilled) > 0:
                extra_luts = []
                extra_ffs = []
                extra_power = []
                for r in spilled:
                    n = r["P"] * r["P"]
                    spill_count = n - DSP_LIMIT
                    extra_luts.append((r["luts"] - line(entry["luts"], DSP_LIMIT)) / spill_count)
                    extra_ffs.append((r["ffs"] - line(entry["ffs"], n)) / spill_count)
                    extra_power.append((r["power_w"] - line(entry["power"], DSP_LIMIT)) / spill_count)
                entry["spill"] = {
                    "luts_per_pe": mean(extra_luts),
                    "ffs_per_pe": mean(extra_ffs),
                    "power_per_pe": mean(extra_power),
                    "fmax": mean([r["fmax_mhz"] for r in spilled]),
                }
            model[bits] = entry
        else:
            xs = [r["P"] * r["P"] for r in group]
            model[bits] = {
                "luts": fit_line(xs, [r["luts"] for r in group]),
                "ffs": fit_line(xs, [r["ffs"] for r in group]),
                "power": fit_line(xs, [r["power_w"] for r in group]),
                "fmax": mean([r["fmax_mhz"] for r in group]),
                "spill": None,
            }
    return model


def line(coefficients, x):
    a, b = coefficients
    return a + b * x


def estimate_hardware(P, bits, rows, limits):
    """LUTs, FFs, DSPs, Fmax and power for a P x P array at `bits`.

    If the design was really synthesized (P and bits match a row of results.json) the real
    Vivado numbers are returned with "estimated": False. Otherwise the fitted model is used.
    """
    for row in rows:
        if row.get("P") == P and row.get("bits") == bits and row.get("luts") is not None:
            return {
                "luts": row["luts"], "ffs": row["ffs"], "dsps": row["dsps"], "bram": row.get("bram", 0),
                "fmax_mhz": row["fmax_mhz"], "power_w": row["power_w"],
                "fits_zynq7020": row["fits_zynq7020"], "wns_ns": row.get("wns_ns"),
                "estimated": False,
                "basis": "synthesized in Vivado (results.json)",
            }

    model = build_model(rows)
    if bits not in model:
        return None
    m = model[bits]
    n = P * P

    if bits == 16:
        in_dsps = min(n, DSP_LIMIT)
        spill_count = n - in_dsps
        luts = line(m["luts"], in_dsps)
        ffs = line(m["ffs"], n)
        power = line(m["power"], in_dsps)
        fmax = m["fmax"]
        basis = "fitted to the synthesized 16-bit designs (1 DSP per PE)"
        if spill_count > 0 and m["spill"] is not None:
            luts = luts + spill_count * m["spill"]["luts_per_pe"]
            ffs = ffs + spill_count * m["spill"]["ffs_per_pe"]
            power = power + spill_count * m["spill"]["power_per_pe"]
            fmax = m["spill"]["fmax"]
            basis = ("fitted to the synthesized 16-bit designs: " + str(in_dsps) + " PEs in DSPs, "
                     + str(spill_count) + " built from LUTs like the 16x16 design")
        dsps = in_dsps
    else:
        luts = line(m["luts"], n)
        ffs = line(m["ffs"], n)
        power = line(m["power"], n)
        fmax = m["fmax"]
        dsps = 0
        basis = "fitted to the synthesized " + str(bits) + "-bit designs (LUT multipliers)"

    luts = max(0.0, luts)
    ffs = max(0.0, ffs)
    power = max(0.0, power)
    fits = luts <= limits["luts"] and ffs <= limits["ffs"] and dsps <= limits["dsps"]
    return {
        "luts": round(luts), "ffs": round(ffs), "dsps": dsps, "bram": 0,
        "fmax_mhz": round(fmax, 1), "power_w": round(power, 3),
        "fits_zynq7020": fits, "wns_ns": None,
        "estimated": True,
        "basis": basis,
    }


def leave_one_out(rows):
    """How well the 8- and 4-bit lines predict a design they weren't fitted on.

    For each synthesized 8-/4-bit design: fit on the other two designs of that bit width,
    predict this one, and compare with what Vivado reported. (16-bit can't be checked this way:
    only two designs fit in DSPs and one spills, so there is nothing left to fit on.)
    """
    checks = []
    for bits in [8, 4]:
        group = rows_for_bits(rows, bits)
        if len(group) < 3:
            continue
        for held_out in group:
            others = [r for r in group if r is not held_out]
            n = held_out["P"] * held_out["P"]
            xs = [r["P"] * r["P"] for r in others]
            predicted = {
                "luts": line(fit_line(xs, [r["luts"] for r in others]), n),
                "ffs": line(fit_line(xs, [r["ffs"] for r in others]), n),
                "power_w": line(fit_line(xs, [r["power_w"] for r in others]), n),
            }
            entry = {"P": held_out["P"], "bits": bits}
            for key in ["luts", "ffs", "power_w"]:
                actual = held_out[key]
                entry[key] = {
                    "predicted": round(predicted[key], 3 if key == "power_w" else 0),
                    "actual": actual,
                    "error_pct": round((predicted[key] - actual) / actual * 100, 1),
                }
            checks.append(entry)

    worst = 0.0
    for entry in checks:
        for key in ["luts", "ffs", "power_w"]:
            worst = max(worst, abs(entry[key]["error_pct"]))
    return {"checks": checks, "worst_error_pct": worst}


# ---- ranking and explanations (Evaluate) ---------------------------------------------------
METRICS = [
    {"key": "ttft_s", "name": "first word", "better": "lower"},
    {"key": "tokens_per_s", "name": "words/s", "better": "higher"},
    {"key": "energy_J", "name": "energy", "better": "lower"},
]


def is_better(a, b, better):
    if better == "lower":
        return a < b
    return a > b


def at_least_as_good(a, b, better):
    if better == "lower":
        return a <= b
    return a >= b


def short_name(P, bits):
    return str(P) + "x" + str(P) + "/" + str(bits) + "-bit"


def rank_design(custom, designs):
    """Rank the custom design against the synthesized ones (same bandwidth and settings).

    Returns ranks per metric (1 = best of all), the designs that beat it on every metric
    ("dominated by"), and whether it's on the Pareto front (nothing beats it on everything).
    A synthesized design with the same P and bits as the custom one is left out.
    """
    others = []
    for d in designs:
        if d["P"] == custom["P"] and d["bits"] == custom["bits"]:
            continue
        if d.get("energy_J") is None:
            continue
        others.append(d)

    ranks = {}
    for metric in METRICS:
        key = metric["key"]
        if custom.get(key) is None:
            ranks[key] = None
            continue
        position = 1
        for d in others:
            if is_better(d[key], custom[key], metric["better"]):
                position = position + 1
        ranks[key] = {"rank": position, "of": len(others) + 1}

    dominated_by = []
    for d in others:
        if custom.get("energy_J") is None:
            break
        if not d["resources"].get("fits_zynq7020", True):
            continue
        all_ok = True
        any_better = False
        for metric in METRICS:
            key = metric["key"]
            if not at_least_as_good(d[key], custom[key], metric["better"]):
                all_ok = False
            if is_better(d[key], custom[key], metric["better"]):
                any_better = True
        if all_ok and any_better:
            dominated_by.append({"design": d["design"], "P": d["P"], "bits": d["bits"],
                                 "ttft_s": d["ttft_s"], "tokens_per_s": d["tokens_per_s"],
                                 "energy_J": d["energy_J"]})

    return {"ranks": ranks, "dominated_by": dominated_by, "pareto": len(dominated_by) == 0,
            "compared_with": len(others)}


def explain(custom, ranking, limits, accuracy=None):
    """Short plain-language reasons for how the design did. Each is {"kind", "text"} where
    kind is "good", "warning" or "info". `accuracy` is eryc_model/accuracy.json (or None)."""
    reasons = []
    P = custom["P"]
    bits = custom["bits"]
    n = P * P
    res = custom["resources"]

    # does it fit?
    if not res["fits_zynq7020"]:
        if res["luts"] > limits["luts"]:
            reasons.append({"kind": "warning", "text":
                            "Needs about {:,} LUTs but the Zynq-7020 has {:,}: it won't fit on this chip.".format(
                                int(res["luts"]), limits["luts"])})
        else:
            reasons.append({"kind": "warning", "text": "It doesn't fit on the Zynq-7020."})
    else:
        reasons.append({"kind": "good", "text":
                        "Fits on the Zynq-7020 ({:.0f}% of the LUTs, {:.0f}% of the DSPs).".format(
                            res["luts"] / limits["luts"] * 100, res["dsps"] / limits["dsps"] * 100)})

    # what the multipliers are built from, and what that does to the clock
    if bits == 16 and n > DSP_LIMIT:
        reasons.append({"kind": "warning", "text":
                        "Only {} of its {} multipliers fit in DSP blocks; the other {} are built from LUTs, "
                        "which drops the clock to about {:.0f} MHz (the same thing happened to the 16x16 design).".format(
                            DSP_LIMIT, n, n - DSP_LIMIT, res["fmax_mhz"])})
    elif bits == 16:
        reasons.append({"kind": "good", "text":
                        "Every multiplier fits in a DSP block, so it can clock at about {:.0f} MHz.".format(res["fmax_mhz"])})
    else:
        reasons.append({"kind": "info", "text":
                        "{}-bit multipliers are built from LUTs, so the clock is about {:.0f} MHz "
                        "(16-bit DSP multipliers run near 296 MHz).".format(bits, res["fmax_mhz"])})

    # first word: which phase dominates
    phases = custom["phases"]
    share = phases["vision"]["time_s"] / custom["ttft_s"] * 100
    reasons.append({"kind": "info", "text":
                    "{:.0f}% of the wait for the first word is the vision encoder, which is {}-bound: "
                    "{}".format(share, phases["vision"]["bound"],
                                "more PEs or a faster clock shorten it." if phases["vision"]["bound"] == "compute"
                                else "more bandwidth or fewer bits shorten it.")})

    # decode
    if phases["decode"]["bound"] == "memory":
        reasons.append({"kind": "info", "text":
                        "Decode is memory-bound, so words/s depends only on bits and bandwidth; "
                        "the array size doesn't change it."})
    else:
        reasons.append({"kind": "warning", "text":
                        "Decode is compute-bound here: more bandwidth won't speed up writing, but more PEs "
                        "or a faster clock would."})

    # against the synthesized designs
    if ranking["pareto"] and not res["fits_zynq7020"]:
        reasons.append({"kind": "warning", "text":
                        "On paper no synthesized design beats it on first word, words/s and energy at once, "
                        "but it doesn't fit on the Zynq-7020, so it can't be built on this chip."})
    elif ranking["pareto"]:
        reasons.append({"kind": "good", "text":
                        "No synthesized design beats it on first word, words/s and energy all at once "
                        "(it's on the Pareto front)."})
    else:
        best = ranking["dominated_by"][0]
        reasons.append({"kind": "warning", "text":
                        "Design {} ({}) beats it on first word, words/s and energy at the same time, "
                        "so there's no reason to pick this one over it.".format(
                            best["design"], short_name(best["P"], best["bits"]))})

    # answer quality at this bit width (only when eryc_model/accuracy.json exists)
    if accuracy and str(bits) in accuracy and "score" in accuracy[str(bits)]:
        right = accuracy[str(bits)]["score"] * 100
        text = "With {}-bit weights the model answered {:.0f}% of {} test questions right".format(
            bits, right, accuracy.get("n", "the"))
        kind = "info"
        if "full" in accuracy and "score" in accuracy["full"]:
            full = accuracy["full"]["score"] * 100
            text = text + " ({:.0f}% at full precision)".format(full)
            if full - right > 5:
                kind = "warning"
                text = text + ": faster, but noticeably less accurate"
        reasons.append({"kind": kind, "text": text + "."})

    # honesty about extrapolation
    if res.get("estimated") and P > 16:
        reasons.append({"kind": "warning", "text":
                        "P is bigger than anything we synthesized, so Fmax and power are extrapolated. "
                        "A real place-and-route would probably lose some clock speed at this size."})
    elif res.get("estimated"):
        reasons.append({"kind": "info", "text":
                        "Hardware numbers are estimated from the 9 synthesized designs, not from Vivado."})
    return reasons
