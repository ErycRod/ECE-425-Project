"""Backend for the EdgeVLM Lab website.

All performance numbers come straight from Lucius's perf/perf_model.py
(estimate() and phase_time()). This file only picks the inputs, calls his
functions, and sends the results to the web page. It does not change them.

Run (from the anh_web folder):
  .venv\\Scripts\\python -m uvicorn server:app --app-dir backend --port 8000
"""
import os
import sys
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import data

# Don't leave a __pycache__ folder inside perf/ (that folder is not ours)
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.join(data.REPO_ROOT, "perf"))
from perf_model import estimate, phase_time

# ---- settings ----------------------------------------------------------------
ALLOWED_P = [4, 8, 16]
ALLOWED_BITS = [16, 8, 4]

# Zynq-7020 (xc7z020clg484-1). LUT and DSP limits match hw/scripts/run_sweep.py
CHIP_LIMITS = {"luts": 53200, "dsps": 220, "ffs": 106400, "bram": 140}

# defaults from perf/perf_model.py
DEFAULT_F_MHZ = 100.0
DEFAULT_BW_GBS = 1.0
DEFAULT_UTIL = 0.8
DEFAULT_OUT_TOKENS = 32

BW_MIN = 0.25
BW_MAX = 4.0
BW_STEP = 0.05

# what the hardware team says in their README / tradeoff chart
HW_TEAM_NOTES = [
    {"P": 16, "bits": 16, "note": "16x16 at 16-bit exceeds the chip's 220 DSPs (hardware team README)"},
]

# figures from docs/ that the page is allowed to show
FIGURES = {
    "tradeoff": "tradeoff.png",
    "dataflow": "dataflow.png",
}

app = FastAPI(title="EdgeVLM Lab backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---- request formats ---------------------------------------------------------
class EstimateRequest(BaseModel):
    P: int
    bits: int
    bw_gbs: float = DEFAULT_BW_GBS
    f_mhz: Optional[float] = None
    util: Optional[float] = None
    out_tokens: Optional[int] = None


class SweepRequest(BaseModel):
    bw_gbs: float = DEFAULT_BW_GBS
    f_mhz: Optional[float] = None
    util: Optional[float] = None
    out_tokens: Optional[int] = None


class BandwidthCurveRequest(BaseModel):
    P: int
    f_mhz: Optional[float] = None
    util: Optional[float] = None
    out_tokens: Optional[int] = None
    points: int = 40


# ---- helpers -----------------------------------------------------------------
def design_number(P, bits):
    """Design numbers from the project README:
              4x4  8x8  16x16
      16-bit   1    2    3
       8-bit   4    5    6
       4-bit   7    8    9
    """
    row = ALLOWED_BITS.index(bits)
    column = ALLOWED_P.index(P)
    return row * 3 + column + 1


def check_P(P):
    if P not in ALLOWED_P:
        raise HTTPException(status_code=422, detail="P must be 4, 8 or 16")


def check_bits(bits):
    if bits not in ALLOWED_BITS:
        raise HTTPException(status_code=422, detail="bits must be 16, 8 or 4")


def check_positive(name, value):
    if value is not None:
        if value <= 0:
            raise HTTPException(status_code=422, detail=name + " must be greater than 0")


def check_util(util):
    if util is not None:
        if util <= 0 or util > 1:
            raise HTTPException(status_code=422, detail="util must be between 0 and 1")


def pick_util(util):
    if util is None:
        return DEFAULT_UTIL
    else:
        return util


def pick_out_tokens(out_tokens):
    if out_tokens is None:
        return DEFAULT_OUT_TOKENS
    else:
        return out_tokens


def pick_clock(f_mhz_override, results, row):
    """Clock to use: user's value first, then real Fmax from results.json, then 100 MHz."""
    if f_mhz_override is not None:
        return f_mhz_override, "user"

    if results["available"] and row is not None:
        if row.get("fmax_mhz") is not None:
            return row["fmax_mhz"], "results.json (Fmax)"

    return DEFAULT_F_MHZ, "default (perf_model.py)"


def get_resources(row):
    """This design's row from results.json, or all n/a if we don't have it."""
    keys = ["luts", "ffs", "dsps", "bram", "wns_ns", "fmax_mhz", "power_w", "fits_zynq7020"]
    resources = {}
    for key in keys:
        if row is None:
            resources[key] = None
        else:
            resources[key] = row.get(key)
    return resources


def get_hw_team_note(P, bits):
    for item in HW_TEAM_NOTES:
        if item["P"] == P and item["bits"] == bits:
            return item["note"]
    return None


def get_phases(profile, P, bits, f_mhz, bw_gbs, util):
    """Time and bound for each phase, from Lucius's phase_time().
    The inputs are prepared the same way estimate() prepares them."""
    f_hz = f_mhz * 1e6
    bw_Bps = bw_gbs * 1e9
    wbytes = bits / 8
    vision = profile["vision"]
    lm = profile["lm"]
    prompt = profile["prefill_tokens"]

    t_vision, bound_vision = phase_time(vision["macs"], vision["params"] * wbytes, P, f_hz, bw_Bps, util)
    t_prefill, bound_prefill = phase_time(lm["params"] * prompt, lm["params"] * wbytes, P, f_hz, bw_Bps, util)
    t_decode, bound_decode = phase_time(lm["params"], lm["params"] * wbytes, P, f_hz, bw_Bps, util)

    phases = {
        "vision": {"time_s": t_vision, "bound": bound_vision},
        "prefill": {"time_s": t_prefill, "bound": bound_prefill},
        "decode": {"time_s": t_decode, "bound": bound_decode},
    }
    return phases


def flags():
    results = data.load_results()
    profile_info = data.load_profile()
    accuracy = data.load_accuracy()
    return {
        "results_available": results["available"],
        "results_placeholder": not results["available"],
        "results_source": results["source"],
        "profile_placeholder": profile_info["placeholder"],
        "profile_source": profile_info["source"],
        "profile_note": profile_info["note"],
        "accuracy_pending": accuracy["pending"],
        "accuracy_source": accuracy["source"],
    }


def run_one_design(P, bits, bw_gbs, f_mhz_override, util, out_tokens):
    """Everything the page needs for one design."""
    profile_info = data.load_profile()
    profile = profile_info["profile"]
    results = data.load_results()
    row = data.find_result_row(results, P, bits)

    f_mhz, f_source = pick_clock(f_mhz_override, results, row)
    resources = get_resources(row)

    # energy only when real power from results.json is there
    power_w = resources["power_w"]
    if power_w is not None:
        result = estimate(profile, P, bits, f_mhz, bw_gbs, util, out_tokens, power_w)
        energy_note = None
    else:
        result = estimate(profile, P, bits, f_mhz, bw_gbs, util, out_tokens)
        energy_note = "needs real power data (results.json)"

    result["design"] = design_number(P, bits)
    result["bw_gbs"] = bw_gbs
    result["f_mhz"] = f_mhz
    result["f_mhz_source"] = f_source
    result["util"] = util
    result["out_tokens"] = out_tokens
    result["energy_note"] = energy_note
    result["phases"] = get_phases(profile, P, bits, f_mhz, bw_gbs, util)
    result["resources"] = resources
    result["hw_team_note"] = get_hw_team_note(P, bits)
    return result


# ---- the model (not connected yet) -------------------------------------------
def answer(image_bytes, question):
    """Answer a question about an image.
    Eryc's model code will go here later. Only this function needs to change."""
    return {
        "connected": False,
        "answer": None,
        "message": "Model not connected yet (pending integration with eryc_model)",
    }


# ---- endpoints ---------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def config():
    designs = []
    for bits in ALLOWED_BITS:
        for P in ALLOWED_P:
            designs.append({"design": design_number(P, bits), "P": P, "bits": bits})

    return {
        "chip": "Zynq-7020 (xc7z020clg484-1)",
        "chip_limits": CHIP_LIMITS,
        "allowed_P": ALLOWED_P,
        "allowed_bits": ALLOWED_BITS,
        "bandwidth": {"min": BW_MIN, "max": BW_MAX, "step": BW_STEP, "default": DEFAULT_BW_GBS},
        "defaults": {"f_mhz": DEFAULT_F_MHZ, "util": DEFAULT_UTIL, "out_tokens": DEFAULT_OUT_TOKENS},
        "designs": designs,
        "hw_team_notes": HW_TEAM_NOTES,
        "figures": list(FIGURES.keys()),
        "flags": flags(),
    }


@app.post("/api/estimate")
def estimate_one(request: EstimateRequest):
    check_P(request.P)
    check_bits(request.bits)
    check_positive("bw_gbs", request.bw_gbs)
    check_positive("f_mhz", request.f_mhz)
    check_positive("out_tokens", request.out_tokens)
    check_util(request.util)

    result = run_one_design(request.P, request.bits, request.bw_gbs, request.f_mhz,
                            pick_util(request.util), pick_out_tokens(request.out_tokens))
    result["flags"] = flags()
    return result


@app.post("/api/sweep")
def sweep(request: SweepRequest):
    check_positive("bw_gbs", request.bw_gbs)
    check_positive("f_mhz", request.f_mhz)
    check_positive("out_tokens", request.out_tokens)
    check_util(request.util)

    util = pick_util(request.util)
    out_tokens = pick_out_tokens(request.out_tokens)

    designs = []
    for bits in ALLOWED_BITS:
        for P in ALLOWED_P:
            result = run_one_design(P, bits, request.bw_gbs, request.f_mhz, util, out_tokens)
            designs.append(result)

    return {"bw_gbs": request.bw_gbs, "designs": designs, "flags": flags()}


@app.post("/api/bandwidth_curve")
def bandwidth_curve(request: BandwidthCurveRequest):
    check_P(request.P)
    check_positive("f_mhz", request.f_mhz)
    check_positive("out_tokens", request.out_tokens)
    check_util(request.util)
    if request.points < 2 or request.points > 200:
        raise HTTPException(status_code=422, detail="points must be between 2 and 200")

    util = pick_util(request.util)
    out_tokens = pick_out_tokens(request.out_tokens)
    profile = data.load_profile()["profile"]
    results = data.load_results()

    # bandwidth values from BW_MIN to BW_MAX
    bandwidths = []
    step = (BW_MAX - BW_MIN) / (request.points - 1)
    for i in range(request.points):
        bandwidths.append(round(BW_MIN + i * step, 4))

    lines = {}
    for bits in ALLOWED_BITS:
        row = data.find_result_row(results, request.P, bits)
        f_mhz, f_source = pick_clock(request.f_mhz, results, row)

        line = []
        for bw in bandwidths:
            result = estimate(profile, request.P, bits, f_mhz, bw, util, out_tokens)
            line.append({
                "bw_gbs": bw,
                "tokens_per_s": result["tokens_per_s"],
                "decode_bound": result["decode_bound"],
            })
        lines[str(bits)] = {"f_mhz": f_mhz, "f_mhz_source": f_source, "points": line}

    return {"P": request.P, "lines": lines, "flags": flags()}


@app.get("/api/accuracy")
def accuracy():
    return data.load_accuracy()


@app.post("/api/ask")
async def ask(question: str = Form(""), image: Optional[UploadFile] = File(None)):
    image_bytes = None
    if image is not None:
        image_bytes = await image.read()
    return answer(image_bytes, question)


@app.get("/api/figures/{name}")
def figure(name: str):
    if name not in FIGURES:
        raise HTTPException(status_code=404, detail="unknown figure")

    path = os.path.join(data.DOCS_DIR, FIGURES[name])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="figure file not found in docs/")
    return FileResponse(path, media_type="image/png")
