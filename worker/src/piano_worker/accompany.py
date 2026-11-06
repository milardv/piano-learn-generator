"""Arrangement piano : la mélodie à la main droite, les accords à la main gauche.

- complet : mélodie harmonisée sur les temps forts, basse sur les temps 1 et 3, accord plaqué sur 2 et 4 ;
- facile : mélodie simplifiée, fondamentale tenue à chaque mesure ou changement d'accord.
"""

import logging

from . import chords as chords_mod
from . import simplify

log = logging.getLogger(__name__)

MELODY_RANGE = (60, 84)
BASS_LOW = 40  # Mi2 : la basse tient dans [Mi2, Ré#3]
CHORD_LOW = 52  # accords plaqués dans [Mi3, Ré#4]
EASY_LOW = 48  # main gauche facile dans [Do3, Si3]


def build(melody: list[dict], path: list[int], beats: list[float], downbeats: list[float] | None, end: float) -> dict:
    """Renvoie notes (complet), easy, marks."""
    beats = [b for b in beats if b < end]
    path = path[: len(beats)]
    if len(beats) < 2:
        raise ValueError("Pas assez de temps détectés pour arranger")
    bar_pos = _bar_positions(beats, path, downbeats)
    step = [b - a for a, b in zip(beats, beats[1:])]
    step.append(step[-1])

    shift = simplify._octave_shift([n["p"] for n in melody], MELODY_RANGE)
    right = [{**n, "p": simplify._fold(n["p"] + shift, MELODY_RANGE), "v": _clamp(n["v"], 65, 100), "h": "R"} for n in melody]
    right = [n for n in right if n["t"] < end]

    full = list(right) + _harmony(right, path, beats, bar_pos) + _left_full(path, beats, step, bar_pos)
    easy_right = simplify._melody([dict(n) for n in right], beats)
    easy = easy_right + _left_easy(path, beats, step, bar_pos, end)
    marks = [
        {"t": round(beats[i], 3), "label": chords_mod.chord_name(c)}
        for i, c in enumerate(path)
        if i == 0 or c != path[i - 1]
    ]
    log.info("Arrangement : %d notes (facile : %d), %d changements d'accord", len(full), len(easy), len(marks))
    return {"notes": _finish(full), "easy": _finish(easy), "marks": marks}


def _bar_positions(beats: list[float], path: list[int], downbeats: list[float] | None) -> list[int]:
    """Position de chaque temps dans sa mesure (0 = premier temps)."""
    if downbeats:
        firsts = {min(range(len(beats)), key=lambda i: abs(beats[i] - d)) for d in downbeats}
    else:
        # Sans mesure connue (audio) : 4/4, calée là où les accords changent le plus souvent
        changes = [i for i in range(1, len(path)) if path[i] != path[i - 1]]
        phase = max(range(4), key=lambda k: sum(1 for i in changes if i % 4 == k))
        firsts = {i for i in range(len(beats)) if i % 4 == phase}
    pos, current = [], 0
    for i in range(len(beats)):
        current = 0 if i in firsts else current + 1
        pos.append(current)
    return pos


def _left_full(path, beats, step, bar_pos) -> list[dict]:
    notes = []
    for i, (t, c) in enumerate(zip(beats, path)):
        change = i == 0 or c != path[i - 1]
        root, third, fifth = chords_mod.chord_pcs(c)
        if bar_pos[i] in (0, 2) or change:
            # Basse tenue jusqu'au prochain temps 1/3 ou changement d'accord
            j = i + 1
            while j < len(beats) and bar_pos[j] not in (0, 2) and path[j] == c:
                j += 1
            length = (beats[j] if j < len(beats) else t + step[i]) - t
            notes.append({"p": _place(root, BASS_LOW), "t": t, "d": 0.95 * length, "v": 72, "h": "L"})
        else:
            for pc in (root, third, fifth):
                notes.append({"p": _place(pc, CHORD_LOW), "t": t, "d": 0.85 * step[i], "v": 58, "h": "L"})
    return notes


def _left_easy(path, beats, step, bar_pos, end) -> list[dict]:
    notes = []
    starts = [i for i in range(len(beats)) if i == 0 or bar_pos[i] == 0 or path[i] != path[i - 1]]
    for k, i in enumerate(starts):
        stop = beats[starts[k + 1]] if k + 1 < len(starts) else min(end, beats[i] + 4 * step[i])
        root = chords_mod.chord_pcs(path[i])[0]
        notes.append({"p": _place(root, EASY_LOW), "t": beats[i], "d": 0.95 * (stop - beats[i]), "v": 68, "h": "L"})
    return notes


def _harmony(right, path, beats, bar_pos) -> list[dict]:
    """Sur les premiers temps, une note de l'accord sous la mélodie (tierce à sixte en dessous)."""
    added = []
    strong = [i for i in range(len(beats)) if bar_pos[i] in (0, 2)]
    k = 0
    for i in strong:
        t = beats[i]
        while k < len(right) and right[k]["t"] < t - 0.08:
            k += 1
        if k >= len(right) or abs(right[k]["t"] - t) > 0.08:
            continue
        top = right[k]
        pcs = chords_mod.chord_pcs(path[i])
        below = [p for p in range(top["p"] - 9, top["p"] - 2) if p % 12 in pcs and p >= MELODY_RANGE[0] - 5]
        if below:
            added.append({"p": max(below), "t": top["t"], "d": top["d"], "v": top["v"] - 15, "h": "R"})
    return added


def _place(pc: int, low: int) -> int:
    return low + (pc - low) % 12


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(v)))


def _finish(notes: list[dict]) -> list[dict]:
    out = [{**n, "t": round(n["t"], 3), "d": round(n["d"], 3), "v": int(n["v"])} for n in notes if n["d"] > 0.03]
    return sorted(out, key=lambda n: (n["t"], n["p"]))
