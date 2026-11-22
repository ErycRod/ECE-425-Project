"""Tests for the website backend.

The main thing we check: every number the website shows is exactly what
Lucius's perf_model.py gives back. The backend must not change his numbers.
"""
import os
import sys

import pytest

import data
from conftest import write_json
from perf_model import DEFAULT_RESULTS, design_clock_power, estimate, load_results, phase_time

ALL_P = [4, 8, 16]
ALL_BITS = [16, 8, 4]
BANDWIDTHS = [0.25, 1.0, 4.0]


def lucius_profile():
    return data.load_profile()["profile"]


def ask_estimate(client, body):
    response = client.post("/api/estimate", json=body)
    assert response.status_code == 200, response.text
    return response.json()


# ---- basic -------------------------------------------------------------------
def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_config(client):
    config = client.get("/api/config").json()
    assert config["chip_limits"] == {"luts": 53200, "dsps": 220, "ffs": 106400, "bram": 140}
    assert config["allowed_P"] == [4, 8, 16]
    assert config["allowed_bits"] == [16, 8, 4]
    assert config["bandwidth"]["default"] == 1.0
    assert len(config["designs"]) == 9


def test_design_numbers(client):
    # numbering from the project README
    expected = {
        (4, 16): 1, (8, 16): 2, (16, 16): 3,
        (4, 8): 4, (8, 8): 5, (16, 8): 6,
        (4, 4): 7, (8, 4): 8, (16, 4): 9,
    }
    for key in expected:
        P = key[0]
        bits = key[1]
        result = ask_estimate(client, {"P": P, "bits": bits, "bw_gbs": 1.0})
        assert result["design"] == expected[key]


# ---- numbers match perf_model.py exactly ---------------------------------------
def test_estimate_matches_perf_model(client):
    profile = lucius_profile()
    for P in ALL_P:
        for bits in ALL_BITS:
            for bw in BANDWIDTHS:
                result = ask_estimate(client, {"P": P, "bits": bits, "bw_gbs": bw})
                expected = estimate(profile, P, bits, 100.0, bw, 0.8, 32)

                assert result["ttft_s"] == expected["ttft_s"]
                assert result["tokens_per_s"] == expected["tokens_per_s"]
                assert result["answer_s"] == expected["answer_s"]
                assert result["vision_bound"] == expected["vision_bound"]
                assert result["prefill_bound"] == expected["prefill_bound"]
                assert result["decode_bound"] == expected["decode_bound"]


def test_phases_match_perf_model(client):
    profile = lucius_profile()
    for P in ALL_P:
        for bits in ALL_BITS:
            for bw in BANDWIDTHS:
                result = ask_estimate(client, {"P": P, "bits": bits, "bw_gbs": bw})
                expected = estimate(profile, P, bits, 100.0, bw, 0.8, 32)
                phases = result["phases"]

                assert phases["vision"]["bound"] == expected["vision_bound"]
                assert phases["prefill"]["bound"] == expected["prefill_bound"]
                assert phases["decode"]["bound"] == expected["decode_bound"]

                # TTFT = vision + prefill + one decode token (same order as estimate())
                total = phases["vision"]["time_s"] + phases["prefill"]["time_s"] + phases["decode"]["time_s"]
                assert total == expected["ttft_s"]
                assert 1 / phases["decode"]["time_s"] == expected["tokens_per_s"]


def test_decode_phase_is_phase_time(client):
    profile = lucius_profile()
    lm_params = profile["lm"]["params"]
    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    t_decode, bound = phase_time(lm_params, lm_params * 8 / 8, 8, 100e6, 1e9, 0.8)
    assert result["phases"]["decode"]["time_s"] == t_decode
    assert result["phases"]["decode"]["bound"] == bound


def test_real_results_match_perf_model(client, monkeypatch):
    # use the hardware team's real results.json (skip if it is not there yet)
    if not os.path.exists(DEFAULT_RESULTS):
        pytest.skip("no results.json yet")
    monkeypatch.setattr(data, "RESULTS_PATH", DEFAULT_RESULTS)
    data.clear_cache()

    profile = lucius_profile()
    results = load_results(DEFAULT_RESULTS)
    for P in ALL_P:
        for bits in ALL_BITS:
            clock_and_power = design_clock_power(results, P, bits, 100.0)
            f_mhz = clock_and_power[0]
            power_w = clock_and_power[1]
            expected = estimate(profile, P, bits, f_mhz, 1.0, 0.8, 32, power_w)
            result = ask_estimate(client, {"P": P, "bits": bits, "bw_gbs": 1.0})

            assert result["f_mhz"] == f_mhz
            assert result["ttft_s"] == expected["ttft_s"]
            assert result["tokens_per_s"] == expected["tokens_per_s"]
            assert result["answer_s"] == expected["answer_s"]
            assert result["decode_bound"] == expected["decode_bound"]
            if power_w is not None:
                assert result["energy_J"] == expected["energy_J"]


def test_values_from_handoff_table(client):
    # 100 MHz, 1 GB/s, util 0.8, 32 tokens, placeholder profile
    result = ask_estimate(client, {"P": 4, "bits": 16, "bw_gbs": 1.0})
    assert result["ttft_s"] == pytest.approx(83.11, abs=0.01)

    result = ask_estimate(client, {"P": 8, "bits": 4, "bw_gbs": 1.0})
    assert result["tokens_per_s"] == pytest.approx(14.8, abs=0.05)

    result = ask_estimate(client, {"P": 4, "bits": 4, "bw_gbs": 1.0})
    assert result["decode_bound"] == "compute"
    assert result["tokens_per_s"] == pytest.approx(9.5, abs=0.05)

    result = ask_estimate(client, {"P": 16, "bits": 16, "bw_gbs": 1.0})
    assert result["ttft_s"] == pytest.approx(5.45, abs=0.01)


def test_sweep_matches_perf_model(client):
    profile = lucius_profile()
    response = client.post("/api/sweep", json={"bw_gbs": 2.0})
    assert response.status_code == 200
    designs = response.json()["designs"]
    assert len(designs) == 9

    for result in designs:
        expected = estimate(profile, result["P"], result["bits"], 100.0, 2.0, 0.8, 32)
        assert result["ttft_s"] == expected["ttft_s"]
        assert result["tokens_per_s"] == expected["tokens_per_s"]
        assert result["decode_bound"] == expected["decode_bound"]


def test_bandwidth_curve_matches_perf_model(client):
    profile = lucius_profile()
    for P in ALL_P:
        response = client.post("/api/bandwidth_curve", json={"P": P, "points": 40})
        assert response.status_code == 200
        lines = response.json()["lines"]

        for bits in ALL_BITS:
            points = lines[str(bits)]["points"]
            assert len(points) == 40
            assert points[0]["bw_gbs"] == 0.25
            assert points[-1]["bw_gbs"] == 4.0
            for point in points:
                expected = estimate(profile, P, bits, 100.0, point["bw_gbs"], 0.8, 32)
                assert point["tokens_per_s"] == expected["tokens_per_s"]
                assert point["decode_bound"] == expected["decode_bound"]


def test_advanced_settings_passed_through(client):
    profile = lucius_profile()
    body = {"P": 8, "bits": 8, "bw_gbs": 1.5, "f_mhz": 150, "util": 0.6, "out_tokens": 64}
    result = ask_estimate(client, body)
    expected = estimate(profile, 8, 8, 150, 1.5, 0.6, 64)
    assert result["ttft_s"] == expected["ttft_s"]
    assert result["answer_s"] == expected["answer_s"]
    assert result["f_mhz"] == 150
    assert result["f_mhz_source"] == "user"


# ---- missing files / fallbacks -------------------------------------------------
def test_no_results_file(client):
    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    assert result["flags"]["results_available"] is False
    assert result["flags"]["results_placeholder"] is True
    assert result["f_mhz"] == 100.0
    assert result["f_mhz_source"] == "default (perf_model.py)"
    assert result["resources"]["luts"] is None
    assert result["resources"]["fits_zynq7020"] is None
    assert "energy_J" not in result
    assert result["energy_note"] is not None


def test_placeholder_profile_flag(client):
    config = client.get("/api/config").json()
    assert config["flags"]["profile_placeholder"] is True
    assert config["flags"]["profile_source"] == "perf/example_profile.json"
    assert config["flags"]["accuracy_pending"] is True


def test_hw_team_note_for_design_3(client):
    result = ask_estimate(client, {"P": 16, "bits": 16, "bw_gbs": 1.0})
    assert "all 220 DSPs" in result["hw_team_note"]

    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    assert result["hw_team_note"] is None


def test_results_file_with_nulls(client, fake_files):
    rows = []
    for P in ALL_P:
        for bits in ALL_BITS:
            rows.append({"P": P, "bits": bits, "luts": None, "ffs": None, "dsps": None, "bram": None,
                         "wns_ns": None, "fmax_mhz": None, "power_w": None, "fits_zynq7020": None})
    write_json(fake_files / "results.json", rows)

    result = ask_estimate(client, {"P": 4, "bits": 8, "bw_gbs": 1.0})
    assert result["flags"]["results_available"] is True
    assert result["f_mhz"] == 100.0
    assert result["resources"]["dsps"] is None
    assert "energy_J" not in result


def test_results_file_real_values_used(client, fake_files):
    rows = [{"P": 8, "bits": 8, "luts": 5000, "ffs": 6000, "dsps": 64, "bram": 0,
             "wns_ns": 1.0, "fmax_mhz": 111.1, "power_w": 0.25, "fits_zynq7020": True}]
    write_json(fake_files / "results.json", rows)

    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    expected = estimate(lucius_profile(), 8, 8, 111.1, 1.0, 0.8, 32, 0.25)
    assert result["f_mhz"] == 111.1
    assert result["f_mhz_source"] == "results.json (Fmax)"
    assert result["ttft_s"] == expected["ttft_s"]
    assert result["energy_J"] == expected["energy_J"]
    assert result["resources"]["dsps"] == 64
    assert result["resources"]["fits_zynq7020"] is True

    # the user's clock always wins
    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0, "f_mhz": 90})
    assert result["f_mhz"] == 90
    assert result["f_mhz_source"] == "user"


def test_eryc_profile_used_when_present(client, fake_files):
    profile = {"note": "profiled SmolVLM-256M, test image",
               "vision": {"params": 90000000, "macs": 50000000000},
               "lm": {"params": 130000000},
               "prefill_tokens": 100}
    write_json(fake_files / "profile_summary.json", profile)

    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    expected = estimate(profile, 8, 8, 100.0, 1.0, 0.8, 32)
    assert result["ttft_s"] == expected["ttft_s"]
    assert result["flags"]["profile_placeholder"] is False
    assert result["flags"]["profile_source"] == "eryc_model/profile_summary.json"


def test_accuracy_file(client, fake_files):
    response = client.get("/api/accuracy")
    assert response.json()["pending"] is True

    accuracy = {"16": {"score": 0.7}, "8": {"score": 0.69}, "4": {"score": 0.6},
                "metric": "test", "dataset": "test"}
    write_json(fake_files / "accuracy.json", accuracy)
    response = client.get("/api/accuracy")
    assert response.json()["pending"] is False
    assert response.json()["data"]["8"]["score"] == 0.69


# ---- bad input -----------------------------------------------------------------
def test_bad_inputs_give_422(client):
    bad_bodies = [
        {"P": 5, "bits": 8, "bw_gbs": 1.0},
        {"P": 8, "bits": 12, "bw_gbs": 1.0},
        {"P": 8, "bits": 8, "bw_gbs": 0},
        {"P": 8, "bits": 8, "bw_gbs": -1},
        {"P": 8, "bits": 8, "bw_gbs": 1.0, "util": 0},
        {"P": 8, "bits": 8, "bw_gbs": 1.0, "util": 1.5},
        {"P": 8, "bits": 8, "bw_gbs": 1.0, "f_mhz": -100},
        {"P": 8, "bits": 8, "bw_gbs": 1.0, "out_tokens": 0},
        {"bits": 8, "bw_gbs": 1.0},
        {"P": "big", "bits": 8, "bw_gbs": 1.0},
    ]
    for body in bad_bodies:
        response = client.post("/api/estimate", json=body)
        assert response.status_code == 422, body

    response = client.post("/api/bandwidth_curve", json={"P": 8, "points": 1})
    assert response.status_code == 422


# ---- ask + figures ---------------------------------------------------------------
def ask_model(client, question):
    files = {"image": ("test.png", b"fake image bytes", "image/png")}
    response = client.post("/api/ask", data={"question": question}, files=files)
    assert response.status_code == 200, response.text
    return response.json()


def write_fake_model(path, code):
    # a tiny stand-in for Eryc's eryc_model/vlm.py
    file = open(path, "w")
    file.write(code)
    file.close()


def test_ask_placeholder(client):
    body = ask_model(client, "What is in the picture?")
    assert body["connected"] is False
    assert body["answer"] is None
    assert body["time_s"] is None
    assert "not connected" in body["message"]
    assert "eryc_model/vlm.py" in body["message"]


def test_ask_with_fake_model(client, fake_files):
    code = "def answer(image_bytes, question):\n    return ' ' + question + ' / ' + str(len(image_bytes)) + ' '\n"
    write_fake_model(fake_files / "vlm.py", code)

    body = ask_model(client, "What is it?")
    assert body["connected"] is True
    assert body["answer"] == "What is it? / 16"
    assert body["message"] is None
    assert body["time_s"] >= 0


def test_ask_model_error(client, fake_files):
    code = "def answer(image_bytes, question):\n    raise ValueError('out of memory')\n"
    write_fake_model(fake_files / "vlm.py", code)

    body = ask_model(client, "What is it?")
    assert body["connected"] is True
    assert body["answer"] is None
    assert "out of memory" in body["message"]


def test_ask_model_file_that_cannot_load(client, fake_files):
    # e.g. torch is not installed yet
    write_fake_model(fake_files / "vlm.py", "import not_a_real_package\n")

    body = ask_model(client, "What is it?")
    assert body["connected"] is False
    assert body["answer"] is None
    assert "Could not load" in body["message"]


def test_ask_needs_image_and_question(client):
    files = {"image": ("test.png", b"fake image bytes", "image/png")}
    response = client.post("/api/ask", data={"question": "   "}, files=files)
    assert response.status_code == 422

    response = client.post("/api/ask", data={"question": "What is it?"})
    assert response.status_code == 422

    files = {"image": ("test.png", b"", "image/png")}
    response = client.post("/api/ask", data={"question": "What is it?"}, files=files)
    assert response.status_code == 422


def test_model_file_flag(client, fake_files):
    flags = client.get("/api/config").json()["flags"]
    assert flags["model_file_found"] is False

    write_fake_model(fake_files / "vlm.py", "def answer(image_bytes, question):\n    return 'ok'\n")
    flags = client.get("/api/config").json()["flags"]
    assert flags["model_file_found"] is True


def test_figures(client):
    response = client.get("/api/figures/tradeoff")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"

    response = client.get("/api/figures/dataflow")
    assert response.status_code == 200

    response = client.get("/api/figures/secret")
    assert response.status_code == 404


# ---- developer view ----------------------------------------------------------
def test_source_files_are_served(client):
    config = client.get("/api/config").json()
    assert "mac_pe.v" in config["sources"]
    for name in config["sources"]:
        response = client.get("/api/source/" + name)
        assert response.status_code == 200, name
        body = response.json()
        assert body["name"] == name
        assert len(body["text"]) > 0
        # the text is the real file from the repo
        path = os.path.join(data.REPO_ROOT, body["path"])
        file = open(path, "r", encoding="utf-8")
        assert body["text"] == file.read()
        file.close()


def test_source_rejects_other_files(client):
    for name in ["server.py", "..%2Fserver.py", "results.json", "secret.txt"]:
        response = client.get("/api/source/" + name)
        assert response.status_code == 404


def test_estimate_includes_workload(client):
    profile = lucius_profile()
    result = ask_estimate(client, {"P": 8, "bits": 8, "bw_gbs": 1.0})
    assert result["workload"]["vision_macs"] == profile["vision"]["macs"]
    assert result["workload"]["vision_params"] == profile["vision"]["params"]
    assert result["workload"]["lm_params"] == profile["lm"]["params"]
    assert result["workload"]["prefill_tokens"] == profile["prefill_tokens"]


def test_architecture_figure(client):
    response = client.get("/api/figures/architecture")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


# ---- Beginner animation -------------------------------------------------------
def test_systolic_frames(client):
    response = client.get("/api/systolic_frames")
    assert response.status_code == 200
    rec = response.json()
    P = rec["P"]
    K = rec["K"]
    # one frame per clock edge plus the cleared start, and the K + 2P - 2 latency rule
    assert rec["cycles"] == K + 2 * P - 2
    assert len(rec["frames"]) == rec["cycles"] + 1
    # the last frame's accumulators are A x B
    for i in range(P):
        for j in range(P):
            expected = 0
            for k in range(K):
                expected = expected + rec["A"][i][k] * rec["B"][k][j]
            assert rec["frames"][-1]["acc"][i][j] == expected
            assert rec["C"][i][j] == expected
            # every PE did exactly K multiply-adds
            assert len(rec["frames"][-1]["terms"][i][j]) == K


def test_systolic_frames_missing(client, monkeypatch, tmp_path):
    monkeypatch.setattr(data, "SYSTOLIC_FRAMES_PATH", str(tmp_path / "nope.json"))
    response = client.get("/api/systolic_frames")
    assert response.status_code == 404
    assert "export_frames.py" in response.json()["detail"]


# ---- Advanced level: custom designs --------------------------------------------------------
import json  # noqa: E402

import custom_design  # noqa: E402
import verilog_gen  # noqa: E402

LIMITS = {"luts": 53200, "dsps": 220, "ffs": 106400, "bram": 140}


@pytest.fixture
def real_client(client, monkeypatch):
    """Test client that reads the real results.json and Eryc's measured workload profile,
    so these tests check the numbers the Advanced page really shows."""
    real_profile = os.path.join(data.REPO_ROOT, "eryc_model", "profile_summary.json")
    if not os.path.exists(DEFAULT_RESULTS) or not os.path.exists(real_profile):
        pytest.skip("needs results.json and eryc_model/profile_summary.json")
    monkeypatch.setattr(data, "RESULTS_PATH", DEFAULT_RESULTS)
    monkeypatch.setattr(data, "ERYC_PROFILE_PATH", real_profile)
    data.clear_cache()
    return client


def real_rows():
    if not os.path.exists(DEFAULT_RESULTS):
        pytest.skip("no results.json yet")
    file = open(DEFAULT_RESULTS, "r")
    rows = json.load(file)
    file.close()
    return rows


def test_fit_line_is_exact_on_a_line():
    a, b = custom_design.fit_line([1, 2, 3], [5, 7, 9])
    assert abs(a - 3) < 1e-9 and abs(b - 2) < 1e-9


def test_synthesized_designs_use_real_vivado_numbers():
    rows = real_rows()
    for row in rows:
        hw = custom_design.estimate_hardware(row["P"], row["bits"], rows, LIMITS)
        assert hw["estimated"] is False
        assert hw["luts"] == row["luts"] and hw["fmax_mhz"] == row["fmax_mhz"]


def test_leave_one_out_error_is_small():
    # fit on two designs, predict the third: LUTs, FFs and power all within 10%
    check = custom_design.leave_one_out(real_rows())
    assert len(check["checks"]) == 6
    assert check["worst_error_pct"] < 10


def test_estimates_follow_the_hardware_rules():
    rows = real_rows()
    # 8-bit: no DSPs, LUTs grow with P, clock stays at the 8-bit Fmax
    small = custom_design.estimate_hardware(6, 8, rows, LIMITS)
    big = custom_design.estimate_hardware(12, 8, rows, LIMITS)
    assert small["estimated"] and small["dsps"] == 0 and big["luts"] > small["luts"]
    assert small["fmax_mhz"] == big["fmax_mhz"]
    # 16-bit: one DSP per PE while they last, then LUT spill and a slower clock
    in_dsps = custom_design.estimate_hardware(14, 16, rows, LIMITS)
    spilled = custom_design.estimate_hardware(20, 16, rows, LIMITS)
    assert in_dsps["dsps"] == 196 and in_dsps["fmax_mhz"] > 250
    assert spilled["dsps"] == 220 and spilled["fmax_mhz"] < 100
    # 8-bit stops fitting between 24x24 and 25x25
    assert custom_design.estimate_hardware(24, 8, rows, LIMITS)["fits_zynq7020"] is True
    assert custom_design.estimate_hardware(25, 8, rows, LIMITS)["fits_zynq7020"] is False


def test_custom_design_endpoint(real_client):
    response = real_client.post("/api/custom_design", json={"P": 12, "bits": 8, "bw_gbs": 1.0})
    assert response.status_code == 200
    body = response.json()
    design = body["design"]
    # same shape as /api/estimate, so the page can reuse its cards
    for key in ["ttft_s", "tokens_per_s", "answer_s", "energy_J", "phases", "resources", "f_mhz"]:
        assert key in design
    assert design["P"] == 12 and design["custom"] is True and design["resources"]["estimated"] is True
    # the perf model numbers agree with perf_model.estimate at the estimated clock and power
    profile = lucius_profile()
    expected = estimate(profile, 12, 8, design["f_mhz"], 1.0, 0.8, 32, design["resources"]["power_w"])
    assert abs(design["ttft_s"] - expected["ttft_s"]) < 1e-9
    assert len(body["designs"]) == 9
    assert body["ranking"]["ranks"]["ttft_s"]["of"] == 10
    assert len(body["explanations"]) >= 4
    assert "module edgevlm_top_p12_b8" in body["verilog"]["text"]
    assert body["commands"]["simulate_iverilog"].endswith("--sizes 12 --bits 8")


def test_custom_design_ranking_finds_dominating_design(real_client):
    # 12x12/8-bit is beaten on every metric by 16x16/8-bit (design 6)
    body = real_client.post("/api/custom_design", json={"P": 12, "bits": 8}).json()
    assert body["ranking"]["pareto"] is False
    assert 6 in [d["design"] for d in body["ranking"]["dominated_by"]]
    # and every design listed really is at least as good on all three metrics
    mine = body["design"]
    for d in body["ranking"]["dominated_by"]:
        assert d["ttft_s"] <= mine["ttft_s"] and d["tokens_per_s"] >= mine["tokens_per_s"]
        assert d["energy_J"] <= mine["energy_J"]
    # 14x14/16-bit (196 DSPs, full clock) has the fastest first word of all
    body = real_client.post("/api/custom_design", json={"P": 14, "bits": 16}).json()
    assert body["ranking"]["ranks"]["ttft_s"]["rank"] == 1
    assert body["ranking"]["pareto"] is True


def test_custom_design_bad_inputs(real_client):
    assert real_client.post("/api/custom_design", json={"P": 1, "bits": 8}).status_code == 422
    assert real_client.post("/api/custom_design", json={"P": 33, "bits": 8}).status_code == 422
    assert real_client.post("/api/custom_design", json={"P": 8, "bits": 12}).status_code == 422


def test_custom_design_needs_results(client):
    # without the Vivado sweep there is nothing to estimate from
    assert client.post("/api/custom_design", json={"P": 12, "bits": 8}).status_code == 409


def test_custom_design_validation_endpoint(real_client):
    body = real_client.get("/api/custom_design/validation").json()
    assert body["worst_error_pct"] < 10


def test_generated_verilog():
    text = verilog_gen.make_top(12, 8, ["test line"])
    assert "module edgevlm_top_p12_b8" in text
    assert "parameter P   = 12" in text and "parameter B   = 8" in text
    assert "systolic_array #(" in text and ".ACC(ACC)" in text
    assert text.count("module ") == 1 and text.count("endmodule") == 1
    assert text.count("(") == text.count(")")
    assert "// test line" in text
    assert verilog_gen.acc_bits(8) == 28
    # every port of systolic_array is connected
    file = open(os.path.join(data.REPO_ROOT, "hw", "rtl", "systolic_array.v"), "r")
    rtl = file.read()
    file.close()
    for port in ["clk", "rst", "clear", "in_valid", "a_col", "b_row", "c_flat", "busy"]:
        assert port in rtl and "." + port + "(" + port + ")" in text


def test_custom_design_mentions_accuracy(real_client, fake_files):
    # no accuracy.json yet: no accuracy line
    body = real_client.post("/api/custom_design", json={"P": 12, "bits": 4}).json()
    assert not any("test questions" in r["text"] for r in body["explanations"])
    # with accuracy.json: a line for this bit width, a warning when it drops a lot
    accuracy = {"full": {"score": 0.70}, "16": {"score": 0.70}, "8": {"score": 0.69},
                "4": {"score": 0.40}, "n": 100, "metric": "test", "dataset": "test"}
    write_json(fake_files / "accuracy.json", accuracy)
    body = real_client.post("/api/custom_design", json={"P": 12, "bits": 4}).json()
    lines = [r for r in body["explanations"] if "test questions" in r["text"]]
    assert len(lines) == 1 and "40%" in lines[0]["text"] and lines[0]["kind"] == "warning"
    body = real_client.post("/api/custom_design", json={"P": 12, "bits": 8}).json()
    lines = [r for r in body["explanations"] if "test questions" in r["text"]]
    assert lines[0]["kind"] == "info" and "69%" in lines[0]["text"]


def test_check_estimate_compare():
    # hw/scripts/check_estimate.py: estimate (from the 9 designs) next to Vivado's numbers
    sys.path.insert(0, os.path.join(data.REPO_ROOT, "hw", "scripts"))
    import check_estimate

    rows = real_rows()
    estimate = custom_design.estimate_hardware(12, 8, rows, LIMITS)
    vivado = {"luts": estimate["luts"] * 1.10, "ffs": estimate["ffs"], "dsps": 0,
              "fmax_mhz": 125.0, "power_w": estimate["power_w"]}
    entry = check_estimate.compare(12, 8, vivado, rows)
    assert entry["estimate"]["luts"] == estimate["luts"]
    assert entry["error_pct"]["luts"] == round((1 / 1.10 - 1) * 100, 1)
    assert entry["error_pct"]["ffs"] == 0.0
    assert entry["error_pct"]["dsps"] is None  # 0 DSPs: no percentage


def test_validation_includes_new_size_checks(real_client, monkeypatch, tmp_path):
    body = real_client.get("/api/custom_design/validation").json()
    monkeypatch.setattr(data, "ESTIMATE_CHECKS_PATH", str(tmp_path / "none.json"))
    body = real_client.get("/api/custom_design/validation").json()
    assert body["new_size_checks"] == []
    checks = [{"P": 12, "bits": 8, "estimate": {}, "vivado": {}, "error_pct": {"luts": 3.0}}]
    write_json(tmp_path / "checks.json", checks)
    monkeypatch.setattr(data, "ESTIMATE_CHECKS_PATH", str(tmp_path / "checks.json"))
    body = real_client.get("/api/custom_design/validation").json()
    assert body["new_size_checks"][0]["P"] == 12
