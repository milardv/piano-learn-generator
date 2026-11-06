"""Version facile : mélodie seule à la main droite, une basse par demi-mesure à la main gauche."""

import logging
from pathlib import Path

log = logging.getLogger(__name__)

CHORD_WINDOW = 0.05  # s
MIN_MELODY_DURATION = 0.08  # s
SNAP_TOLERANCE = 0.25  # fraction de la grille en dessous de laquelle on recale sur la grille
RIGHT_RANGE = (60, 84)  # Do4 - Do6
LEFT_RANGE = (36, 59)  # Do2 - Si3
BEATS_PER_BASS = 2


def beats(wav: Path) -> list[float]:
    import librosa

    y, sr = librosa.load(str(wav), sr=22050, mono=True)
    _, frames = librosa.beat.beat_track(y=y, sr=sr)
    times = librosa.frames_to_time(frames, sr=sr).tolist()
    log.info("%d temps détectés", len(times))
    return times


def easy(notes: list[dict], beat_times: list[float]) -> list[dict]:
    melody = _melody([n for n in notes if n["h"] == "R"], beat_times)
    bass = _bass([n for n in notes if n["h"] == "L"] or notes, beat_times)
    result = sorted(melody + bass, key=lambda n: (n["t"], n["p"]))
    log.info("Version facile : %d notes (sur %d)", len(result), len(notes))
    return result


def _melody(right: list[dict], beat_times: list[float]) -> list[dict]:
    # « Skyline » : la note la plus aiguë de chaque attaque porte la mélodie
    tops: list[dict] = []
    for n in sorted(right, key=lambda n: (n["t"], -n["p"])):
        if tops and n["t"] - tops[-1]["t"] <= CHORD_WINDOW:
            continue
        tops.append(dict(n))
    grid = _grid(beat_times, subdivisions=2)
    for n in tops:
        n["t"] = _snap(n["t"], grid)
    tops = _one_per_beat(tops, beat_times)
    # Une seule note à la fois : chaque note s'arrête quand la suivante commence
    melody = []
    for i, n in enumerate(tops):
        if i + 1 < len(tops):
            n["d"] = min(n["d"], tops[i + 1]["t"] - n["t"])
        if n["d"] >= MIN_MELODY_DURATION:
            melody.append(n)
    melody = _merge_repeats(melody)
    shift = _octave_shift([n["p"] for n in melody], RIGHT_RANGE)
    return [{**n, "p": _fold(n["p"] + shift, RIGHT_RANGE), "d": round(n["d"], 3), "t": round(n["t"], 3), "h": "R"} for n in melody]


def _one_per_beat(notes: list[dict], beat_times: list[float]) -> list[dict]:
    """Au plus une note par temps : la plus marquée (vélocité puis durée)."""
    if len(beat_times) < 2:
        return notes
    kept, i = [], 0
    bounds = beat_times + [float("inf")]
    slot_notes: list[dict] = [n for n in notes if n["t"] < bounds[0]]
    kept.extend(slot_notes)
    for start, end in zip(bounds, bounds[1:]):
        while i < len(notes) and notes[i]["t"] < start:
            i += 1
        j = i
        while j < len(notes) and notes[j]["t"] < end:
            j += 1
        if j > i:
            kept.append(max(notes[i:j], key=lambda n: (n["v"], n["d"])))
        i = j
    return kept


def _merge_repeats(melody: list[dict]) -> list[dict]:
    """Notes répétées collées -> une seule note tenue."""
    merged: list[dict] = []
    for n in melody:
        prev = merged[-1] if merged else None
        if prev and prev["p"] == n["p"] and n["t"] - (prev["t"] + prev["d"]) < 0.05:
            prev["d"] = n["t"] + n["d"] - prev["t"]
        else:
            merged.append(dict(n))
    return merged


def _bass(left: list[dict], beat_times: list[float]) -> list[dict]:
    if len(beat_times) < 2:
        return []
    anchors = beat_times[::BEATS_PER_BASS]
    bass = []
    for i, start in enumerate(anchors):
        end = anchors[i + 1] if i + 1 < len(anchors) else start + (beat_times[-1] - beat_times[-2]) * BEATS_PER_BASS
        # Note la plus grave qui sonne pendant les premiers 40 % de la demi-mesure
        window_end = start + 0.4 * (end - start)
        candidates = [n for n in left if n["t"] < window_end and n["t"] + n["d"] > start]
        if not candidates:
            continue
        low = min(candidates, key=lambda n: n["p"])
        bass.append({"p": _fold(low["p"], LEFT_RANGE), "t": round(start, 3), "d": round(end - start, 3), "v": low["v"], "h": "L"})
    return bass


def _grid(beat_times: list[float], subdivisions: int) -> list[float]:
    grid = []
    for a, b in zip(beat_times, beat_times[1:]):
        grid.extend(a + (b - a) * k / subdivisions for k in range(subdivisions))
    if beat_times:
        grid.append(beat_times[-1])
    return grid


def _snap(t: float, grid: list[float]) -> float:
    if len(grid) < 2:
        return t
    nearest = min(grid, key=lambda g: abs(g - t))
    step = grid[1] - grid[0]
    return nearest if abs(nearest - t) <= SNAP_TOLERANCE * step else t


def _octave_shift(pitches: list[int], bounds: tuple[int, int]) -> int:
    if not pitches:
        return 0
    median = sorted(pitches)[len(pitches) // 2]
    center = (bounds[0] + bounds[1]) / 2
    return 12 * round((center - median) / 12)


def _fold(p: int, bounds: tuple[int, int]) -> int:
    while p < bounds[0]:
        p += 12
    while p > bounds[1]:
        p -= 12
    return p

