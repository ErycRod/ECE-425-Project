import json
import os
import sys

import pytest

# Don't leave a __pycache__ folder inside perf/ (that folder is not ours)
sys.dont_write_bytecode = True

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(os.path.dirname(TESTS_DIR), "backend")
sys.path.insert(0, BACKEND_DIR)

import data
import server
from fastapi.testclient import TestClient


@pytest.fixture
def fake_files(tmp_path, monkeypatch):
    """Point the teammates' data files at a temporary folder.

    Tests write their own results.json / profile / accuracy files in there,
    so nothing is ever written into the real repo. Lucius's placeholder
    profile (perf/example_profile.json) is still read from the repo.
    """
    monkeypatch.setattr(data, "RESULTS_PATH", str(tmp_path / "results.json"))
    monkeypatch.setattr(data, "ERYC_PROFILE_PATH", str(tmp_path / "profile_summary.json"))
    monkeypatch.setattr(data, "ACCURACY_PATH", str(tmp_path / "accuracy.json"))
    data.clear_cache()
    yield tmp_path
    data.clear_cache()


@pytest.fixture
def client(fake_files):
    return TestClient(server.app)


def write_json(path, content):
    file = open(path, "w")
    json.dump(content, file)
    file.close()
