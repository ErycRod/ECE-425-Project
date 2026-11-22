"""Fake quantization: round a model's weights to B-bit integers and back, in place.

Our accelerator stores every weight as a signed B-bit integer. To see what that does to
answer quality without building B-bit kernels, we "fake quantize": each weight is divided
by a scale, rounded to the nearest B-bit integer, clamped to the B-bit range, and multiplied
back by the scale. The model then runs as usual, but every weight can only take one of
2^B values, exactly like on the hardware.

Scales:
  * per output channel (group_size=None): one scale per row of the weight matrix. This is what
    a simple accelerator would do (one multiply by the scale per output).
  * groups (group_size=128): one scale per 128 weights in a row. Finer scales keep more detail
    and are the standard trick that makes 4-bit models usable; the hardware would need one
    extra scale multiply per group.

Only the weights of nn.Linear layers (all the matrix multiplies the systolic array would run)
are rounded. Biases, norms and embeddings that aren't Linear layers stay in full precision.
"""
import torch
from torch import nn


def qmax_for(bits):
    """Largest positive value of a signed `bits`-bit integer (127 for 8-bit, 7 for 4-bit)."""
    return 2 ** (bits - 1) - 1


@torch.no_grad()
def fake_quantize(weight, bits, group_size=None):
    """Return a copy of a 2-D weight matrix rounded to signed `bits`-bit integers and back.

    Symmetric rounding: q = clamp(round(w / scale), -(qmax + 1), qmax), w' = q * scale,
    with scale = max(|w|) / qmax over each row (or each group of `group_size` in a row).
    """
    if weight.dim() != 2:
        raise ValueError("expected a 2-D weight matrix")
    qmax = qmax_for(bits)
    w = weight.float()
    rows, cols = w.shape

    if group_size is None or group_size >= cols:
        groups = w.reshape(rows, 1, cols)
    else:
        if cols % group_size != 0:
            # pad the last group with zeros so every group has the same size
            pad = group_size - cols % group_size
            w = torch.nn.functional.pad(w, (0, pad))
        groups = w.reshape(rows, -1, group_size)

    scale = groups.abs().amax(dim=2, keepdim=True) / qmax
    scale = torch.where(scale == 0, torch.ones_like(scale), scale)  # all-zero rows stay zero
    q = torch.clamp(torch.round(groups / scale), -(qmax + 1), qmax)
    rounded = (q * scale).reshape(rows, -1)[:, :cols]
    return rounded.to(weight.dtype)


def linear_layers(model):
    """(name, module) for every nn.Linear in the model."""
    found = []
    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            found.append((name, module))
    return found


@torch.no_grad()
def save_weights(model):
    """Copy of every Linear weight, so the model can be put back after quantizing."""
    saved = {}
    for name, module in linear_layers(model):
        saved[name] = module.weight.detach().clone()
    return saved


@torch.no_grad()
def restore_weights(model, saved):
    for name, module in linear_layers(model):
        module.weight.copy_(saved[name])


@torch.no_grad()
def quantize_model(model, saved, bits, group_size=None):
    """Put the original weights back, then round every Linear weight to `bits` bits.

    Returns how many layers and weights were rounded. bits=None means full precision.
    """
    restore_weights(model, saved)
    if bits is None:
        return {"layers": 0, "weights": 0}
    layers = 0
    weights = 0
    for name, module in linear_layers(model):
        module.weight.copy_(fake_quantize(saved[name], bits, group_size))
        layers = layers + 1
        weights = weights + module.weight.numel()
    return {"layers": layers, "weights": weights}
