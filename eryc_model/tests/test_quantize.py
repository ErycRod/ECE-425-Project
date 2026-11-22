import sys
from pathlib import Path

# import quantize.py / vqa_score.py from eryc_model/ (no conftest.py here, so this folder can be
# tested together with anh_web/tests, whose conftest.py has the same module name)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

torch = pytest.importorskip("torch")

from quantize import fake_quantize, quantize_model, qmax_for, save_weights  # noqa: E402


def test_qmax():
    assert qmax_for(8) == 127 and qmax_for(4) == 7 and qmax_for(16) == 32767


def test_values_fit_in_b_bits():
    torch.manual_seed(0)
    w = torch.randn(16, 64)
    for bits in [8, 4]:
        q = fake_quantize(w, bits)
        scale = w.abs().amax(dim=1, keepdim=True) / qmax_for(bits)
        levels = torch.round(q / scale)
        # every weight is an integer level within the signed B-bit range
        assert torch.allclose(levels * scale, q, atol=1e-6)
        assert levels.min() >= -(qmax_for(bits) + 1) and levels.max() <= qmax_for(bits)
        # each row keeps at most 2^B different values
        for row in levels:
            assert len(torch.unique(row)) <= 2 ** bits


def test_more_bits_less_error():
    torch.manual_seed(1)
    w = torch.randn(32, 256)
    errors = [(fake_quantize(w, b) - w).abs().mean().item() for b in [16, 8, 4]]
    assert errors[0] < errors[1] < errors[2]
    assert errors[0] < 1e-3


def test_groups_help_4_bit():
    torch.manual_seed(2)
    w = torch.randn(8, 512)
    w[:, 0] = 50.0  # one big weight per row makes a single per-row scale coarse
    per_row = (fake_quantize(w, 4) - w).abs().mean()
    grouped = (fake_quantize(w, 4, group_size=128) - w).abs().mean()
    assert grouped < per_row


def test_zero_rows_and_odd_sizes():
    w = torch.zeros(3, 10)
    assert torch.equal(fake_quantize(w, 4), w)
    w = torch.randn(3, 200)
    assert fake_quantize(w, 4, group_size=128).shape == (3, 200)


def test_quantize_and_restore_model():
    model = torch.nn.Sequential(torch.nn.Linear(8, 8), torch.nn.ReLU(), torch.nn.Linear(8, 4))
    original = [m.weight.clone() for m in model if isinstance(m, torch.nn.Linear)]
    saved = save_weights(model)
    info = quantize_model(model, saved, 4)
    assert info["layers"] == 2 and info["weights"] == 8 * 8 + 8 * 4
    assert not torch.equal(model[0].weight, original[0])
    quantize_model(model, saved, None)  # back to full precision
    assert torch.equal(model[0].weight, original[0]) and torch.equal(model[2].weight, original[1])
