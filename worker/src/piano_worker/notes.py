"""MIDI -> notes.json : format lu par la PWA."""

import logging
from pathlib import Path

import pretty_midi

log = logging.getLogger(__name__)

FORMAT_VERSION = 1
CHORD_WINDOW = 0.05  # s : notes attaquées ensemble = même accord
MIN_DURATION = 0.03  # s : en dessous, note fantôme
MIN_VELOCITY = 15
SMOOTHING = 0.3  # inertie des centres de main


def build(midi_path: Path, title: str, source: dict) -> dict:
    midi = pretty_midi.PrettyMIDI(str(midi_path))
    raw = [n for inst in midi.instruments for n in inst.notes]
    notes = sorted(
        (n for n in raw if n.end - n.start >= MIN_DURATION and n.velocity >= MIN_VELOCITY),
        key=lambda n: (n.start, n.pitch),
    )
    log.info("%d notes retenues sur %d", len(notes), len(raw))

    hands = split_hands(notes)
    pedals = [
        {"t": round(start, 3), "d": round(end - start, 3)}
        for inst in midi.instruments
        for start, end in sustain_spans(inst.control_changes)
    ]
    return {
        "version": FORMAT_VERSION,
        "title": title,
        "source": source,
        "duration": round(max((n.end for n in notes), default=0.0), 3),
        "range": {"min": min((n.pitch for n in notes), default=60), "max": max((n.pitch for n in notes), default=72)},
        "notes": [
            {"p": n.pitch, "t": round(n.start, 3), "d": round(n.end - n.start, 3), "v": n.velocity, "h": h}
            for n, h in zip(notes, hands)
        ],
        "pedals": pedals,
    }


def split_hands(notes: list[pretty_midi.Note]) -> list[str]:
    """Attribue chaque note à la main gauche (L) ou droite (R).

    K-means 1D en ligne : deux centres qui suivent la position de chaque main ;
    chaque note va au centre le plus proche, puis le centre glisse vers elle.
    """
    left, right = 48.0, 72.0
    hands: list[str] = []
    i = 0
    while i < len(notes):
        j = i
        while j < len(notes) and notes[j].start - notes[i].start <= CHORD_WINDOW:
            j += 1
        chord = sorted(notes[i:j], key=lambda n: n.pitch)
        assigned = {}
        for n in chord:
            assigned[id(n)] = "L" if abs(n.pitch - left) < abs(n.pitch - right) else "R"
        # Un accord étalé sur les deux mains : la note la plus grave revient à la gauche, la plus aiguë à la droite
        if len(chord) > 1:
            assigned[id(chord[0])] = "L" if chord[0].pitch < right else assigned[id(chord[0])]
            assigned[id(chord[-1])] = "R" if chord[-1].pitch > left else assigned[id(chord[-1])]
        for n in chord:
            if assigned[id(n)] == "L":
                left += SMOOTHING * (n.pitch - left)
            else:
                right += SMOOTHING * (n.pitch - right)
        # Les mains ne se croisent pas durablement
        if right - left < 7:
            mid = (left + right) / 2
            left, right = mid - 3.5, mid + 3.5
        hands.extend(assigned[id(n)] for n in notes[i:j])
        i = j
    return hands


def sustain_spans(changes: list[pretty_midi.ControlChange]):
    down = None
    for cc in sorted((c for c in changes if c.number == 64), key=lambda c: c.time):
        if cc.value >= 64 and down is None:
            down = cc.time
        elif cc.value < 64 and down is not None:
            yield down, cc.time
            down = None
