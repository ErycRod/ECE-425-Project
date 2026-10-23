"""Loads the data files the website shows.

The website only displays what the hardware and the model
produce. If a file is not there yet,
we say so and the page shows "n/a" or "pending" (waiting on either Eryc or Lucius)

  Vivado results : <repo>/results.json                    (else: not available yet)
  Workload       : <repo>/eryc_model/profile_summary.json  (else: <repo>/perf/example_profile.json)
  Accuracy       : <repo>/eryc_model/accuracy.json         (else: pending)

Files are read again whenever they change on disk, so the site picks up new
files without restarting.
"""
import json
import os

# anh_web/backend/data.py -> anh_web/backend -> anh_web -> repo root
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ANH_WEB_DIR = os.path.dirname(BACKEND_DIR)
REPO_ROOT = os.path.dirname(ANH_WEB_DIR)

RESULTS_PATH = os.path.join(REPO_ROOT, "results.json")
ERYC_PROFILE_PATH = os.path.join(REPO_ROOT, "eryc_model", "profile_summary.json")
LUCIUS_PROFILE_PATH = os.path.join(REPO_ROOT, "perf", "example_profile.json")
ACCURACY_PATH = os.path.join(REPO_ROOT, "eryc_model", "accuracy.json")
DOCS_DIR = os.path.join(REPO_ROOT, "docs")

_cache = {}


def clear_cache():
    _cache.clear()


def read_json_file(path):
    """Read a JSON file. Only reads it again if the file changed since last time."""
    modified_time = os.path.getmtime(path)
    if path in _cache:
        saved_time = _cache[path]["modified_time"]
        if saved_time == modified_time:
            return _cache[path]["data"]

    file = open(path, "r")
    data = json.load(file)
    file.close()

    _cache[path] = {"modified_time": modified_time, "data": data}
    return data


def load_results():
    """Vivado sweep results from Lucius (hw/scripts/run_sweep.py)."""
    if os.path.exists(RESULTS_PATH):
        rows = read_json_file(RESULTS_PATH)
        return {"available": True, "source": "results.json", "rows": rows}
    else:
        return {"available": False, "source": None, "rows": []}


def find_result_row(results, P, bits):
    """Find the row for one design in results.json. Returns None if it is not there."""
    for row in results["rows"]:
        if row.get("P") == P and row.get("bits") == bits:
            return row
    return None


def load_profile():
    """Workload numbers. Eryc's real profile if it exists, else Lucius's placeholder."""
    if os.path.exists(ERYC_PROFILE_PATH):
        profile = read_json_file(ERYC_PROFILE_PATH)
        source = "eryc_model/profile_summary.json"
    else:
        profile = read_json_file(LUCIUS_PROFILE_PATH)
        source = "perf/example_profile.json"

    note = profile.get("note", "")
    if "PLACEHOLDER" in note:
        placeholder = True
    else:
        placeholder = False

    return {"profile": profile, "source": source, "note": note, "placeholder": placeholder}


def load_accuracy():
    """Accuracy at 16/8/4 bits from Eryc. Pending until the file exists."""
    if os.path.exists(ACCURACY_PATH):
        accuracy = read_json_file(ACCURACY_PATH)
        return {"pending": False, "source": "eryc_model/accuracy.json", "data": accuracy}
    else:
        return {"pending": True, "source": None, "data": None}
