"""Tests for analyze.py, using made-up rows (test data only, never reported)."""
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import analyze  # noqa: E402


def fake_row(name, pre, post, sus, result="success"):
    row = {"participant": name, "major": "ECE", "dl_experience": "2", "hw_experience": "3", "comments": ""}
    for i in range(1, 7):
        row["pre_q%d" % i] = "1" if i <= pre else "0"
        row["post_q%d" % i] = "1" if i <= post else "0"
    for t in range(1, 9):
        row["t%d_result" % t] = result
        row["t%d_time_s" % t] = str(30 * t)
    for i in range(1, 11):
        row["sus%d" % i] = str(sus[i - 1])
    for i in range(11, 14):
        row["learn%d" % i] = "4"
    return row


def test_sus_formula():
    best = {"sus%d" % i: (5 if i % 2 == 1 else 1) for i in range(1, 11)}
    worst = {"sus%d" % i: (1 if i % 2 == 1 else 5) for i in range(1, 11)}
    middle = {"sus%d" % i: 3 for i in range(1, 11)}
    assert analyze.sus_score(best) == 100
    assert analyze.sus_score(worst) == 0
    assert analyze.sus_score(middle) == 50
    assert analyze.sus_score({"sus1": "x"}) is None


def test_summary_and_files(tmp_path):
    good = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]
    ok = [4, 2, 4, 2, 4, 2, 4, 2, 4, 2]
    rows = [fake_row("P1", 2, 5, good), fake_row("P2", 3, 3, ok, result="hint")]
    s = analyze.summarize(rows)
    assert s["n"] == 2
    assert s["tasks"][0]["success"] == 1 and s["tasks"][0]["hint"] == 1
    assert s["tasks"][2]["median_time_s"] == 90
    assert s["quiz"]["pre_mean"] == 2.5 and s["quiz"]["post_mean"] == 4.0 and s["quiz"]["improved"] == 1
    assert s["sus"]["mean"] == (100 + 75) / 2

    path = tmp_path / "results.csv"
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    sys.argv = ["analyze.py", str(path)]
    analyze.main()
    text = (tmp_path / "summary.md").read_text()
    assert "2 participants" in text and "Mean SUS **87.5**" in text
