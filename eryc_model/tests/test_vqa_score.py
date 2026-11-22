import sys
from pathlib import Path

# import quantize.py / vqa_score.py from eryc_model/ (no conftest.py here, so this folder can be
# tested together with anh_web/tests, whose conftest.py has the same module name)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vqa_score import accuracy, is_correct, normalize


def test_normalize():
    assert normalize("The TWO dogs.") == "2 dogs"
    assert normalize("Yes, it is!") == "yes it is"
    assert normalize("A red bus\nwith people") == "red bus"
    assert normalize("") == ""


def test_matches():
    assert is_correct("Yes.", "yes")
    assert is_correct("two", "2")
    assert is_correct("2 dogs", "2")
    assert is_correct("The kitchen", "kitchen")
    assert is_correct("doesn't", "doesnt")


def test_mismatches():
    assert not is_correct("no", "yes")
    assert not is_correct("20", "2")        # whole words only
    assert not is_correct("blue", "light blue")
    assert not is_correct("anything", "")


def test_accuracy():
    assert accuracy(["yes", "no", "3"], ["yes", "yes", "three"]) == 2 / 3
    assert accuracy([], []) == 0.0
