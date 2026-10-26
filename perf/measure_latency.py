#!/usr/bin/env python3
"""Measure response times for the report's latency section (Section 5).

1. The performance model by itself: one design, and all 9 designs.
2. The website backend, if it is running: the requests a slider move sends
   (/api/estimate, /api/sweep, /api/bandwidth_curve), timed end to end over HTTP.

Uses only the Python standard library. Writes docs/latency.json.

Run:  python perf/measure_latency.py [--url http://127.0.0.1:8000] [--n 50]
      (start the backend first to include step 2; see anh_web/README.md)
"""
import argparse, json, os, statistics, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from perf_model import estimate, default_profile_path


def stats_ms(samples_s):
    ms = sorted(s * 1000 for s in samples_s)
    return {"median_ms": round(statistics.median(ms), 4),
            "p95_ms": round(ms[int(0.95 * (len(ms) - 1))], 4),
            "max_ms": round(ms[-1], 4), "n": len(ms)}


def time_call(fn, n):
    fn()                                   # warm-up
    out = []
    for _ in range(n):
        t0 = time.perf_counter(); fn(); out.append(time.perf_counter() - t0)
    return stats_ms(out)


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")   # not "localhost": on Windows that tries IPv6 first and adds ~2 s
    ap.add_argument("--n", type=int, default=50)
    a = ap.parse_args()

    profile = json.load(open(default_profile_path()))
    out = {"perf_model": {}, "backend": {}}

    out["perf_model"]["one_design"] = time_call(lambda: estimate(profile, 8, 8), a.n * 20)
    out["perf_model"]["all_9_designs"] = time_call(
        lambda: [estimate(profile, P, b) for P in (4, 8, 16) for b in (16, 8, 4)], a.n * 20)

    try:
        urllib.request.urlopen(a.url + "/api/health", timeout=2).read()
        up = True
    except Exception:
        up = False
    if up:
        out["backend"]["estimate (one slider move)"] = time_call(
            lambda: post(a.url + "/api/estimate", {"P": 8, "bits": 8, "bw_gbs": 1.0}), a.n)
        out["backend"]["sweep (all 9 designs)"] = time_call(
            lambda: post(a.url + "/api/sweep", {"bw_gbs": 1.0}), a.n)
        out["backend"]["bandwidth_curve (3 lines x 40 pts)"] = time_call(
            lambda: post(a.url + "/api/bandwidth_curve", {"P": 8, "points": 40}), a.n)
    else:
        out["backend"] = f"not running at {a.url} (start it and re-run to include HTTP timings)"

    results = os.path.join(ROOT, "results.json")
    if os.path.exists(results):
        rows = json.load(open(results))
        synth = [r["synth_s"] for r in rows if r.get("synth_s")]
        if synth:
            out["vivado_synthesis_per_design_s"] = {"min": min(synth), "max": max(synth),
                                                    "total": round(sum(synth), 1)}

    print(json.dumps(out, indent=2))
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "docs", "latency.json"), "w"), indent=2)
    print("wrote docs/latency.json")


if __name__ == "__main__":
    main()
