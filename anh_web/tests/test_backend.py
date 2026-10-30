"""Tests for the website backend.

The main thing we check: every number the website shows is exactly what
Lucius's perf_model.py gives back. The backend must not change his numbers.
"""
import os

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
