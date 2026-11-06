"""Recherche d'une partition MIDI existante (Lakh MIDI Dataset, sous-ensemble « clean_midi »).

Environ 19 000 fichiers rangés « Artiste/Titre.mid », souvent en plusieurs versions.
Quand le morceau y est, on lit la vraie mélodie et les vrais accords au lieu de les deviner dans l'audio.
"""

import io
import logging
import os
import re
import tarfile
import unicodedata
import urllib.request
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import pretty_midi

from . import chords

log = logging.getLogger(__name__)

URL = "http://hog.ee.columbia.edu/craffel/lmd/clean_midi.tar.gz"
ARCHIVE = Path(os.environ.get("PIANO_LMD", Path.home() / ".cache/piano-worker/clean_midi.tar.gz"))
MIN_SIMILARITY = 0.88
MAX_VERSIONS = 8
MELODY_NAME = re.compile(r"melod|vocal|voice|voix|lead|sing|chant|vox|lyric|solo", re.I)
# Programmes General MIDI souvent utilisés pour la voix : chœurs, sax, flûte, synthé lead
MELODY_PROGRAMS = {52, 53, 54, 64, 65, 66, 67, 68, 71, 73, 80, 81, 85}


@dataclass
class Score:
    file: str
    melody: list[dict]
    chords: list[int]  # un accord par temps
    beats: list[float]
    downbeats: list[float]
    duration: float


def find(query: str) -> Score | None:
    names = _index()
    artist, _, title = query.partition(" - ")
    if not title:
        artist, title = "", artist
    want_artist, want_title = _norm(artist), _norm(title)

    matches = []
    for name in names:
        parts = name.split("/")
        if len(parts) != 3:
            continue
        cand_artist = _norm(parts[1])
        cand_title = _norm(re.sub(r"(\.\d+)?\.mid$", "", parts[2], flags=re.I))
        if want_artist:
            sim = min(_sim(want_artist, cand_artist), _sim(want_title, cand_title))
        else:
            sim = _sim(want_title, f"{cand_artist} {cand_title}")
        if sim >= MIN_SIMILARITY:
            matches.append((sim, name))
    if not matches:
        log.info("Aucune partition pour « %s »", query)
        return None
    matches.sort(reverse=True)
    best_sim = matches[0][0]
    versions = [n for s, n in matches if s >= best_sim - 0.02][:MAX_VERSIONS]
    log.info("%d version(s) de partition trouvée(s) : %s", len(versions), versions[0])

    best = None
    # Lecture séquentielle : dans un .tar.gz, revenir en arrière oblige à tout redécompresser
    with tarfile.open(ARCHIVE, "r|gz") as tar:
        for member in tar:
            if member.name not in versions:
                continue
            try:
                midi = pretty_midi.PrettyMIDI(io.BytesIO(tar.extractfile(member).read()))
            except Exception as e:  # fichiers parfois corrompus
                log.warning("%s illisible : %s", member.name, e)
                continue
            track, quality = _melody_track(midi)
            if track is not None and (best is None or quality > best[0]):
                best = (quality, member.name, midi, track)
    if best is None:
        log.info("Aucune version avec une mélodie identifiable")
        return None
    quality, name, midi, track = best
    log.info("Version retenue : %s (piste « %s », qualité %.2f)", name, track.name.strip(), quality)
    return _to_score(name, midi, track)


def _to_score(name: str, midi: pretty_midi.PrettyMIDI, melody_track: pretty_midi.Instrument) -> Score:
    beats = midi.get_beats().tolist()
    path = chord_path(midi, beats, melody_track)
    melody = _skyline(melody_track.notes)
    return Score(name.removeprefix("clean_midi/"), melody, path, beats, midi.get_downbeats().tolist(), midi.get_end_time())


def chord_path(midi: pretty_midi.PrettyMIDI, beats: list[float], melody_track: pretty_midi.Instrument | None = None) -> list[int]:
    """Un accord par temps, d'après toutes les notes jouées (la mélodie compte moitié)."""
    bounds = beats + [midi.get_end_time()]
    profiles = np.zeros((len(beats), 12))
    bass = np.zeros((len(beats), 12))
    for inst in midi.instruments:
        if inst.is_drum:
            continue
        weight = 0.5 if inst is melody_track else 1.0
        for n in inst.notes:
            first = max(0, np.searchsorted(bounds, n.start, side="right") - 1)
            for i in range(first, len(beats)):
                if bounds[i] >= n.end:
                    break
                overlap = min(n.end, bounds[i + 1]) - max(n.start, bounds[i])
                if overlap <= 0:
                    continue
                profiles[i, n.pitch % 12] += weight * overlap * n.velocity
                if n.pitch < 55 and inst is not melody_track:
                    bass[i, n.pitch % 12] += overlap * n.velocity
    return chords.decode(profiles, bass)


def _melody_track(midi: pretty_midi.PrettyMIDI) -> tuple[pretty_midi.Instrument | None, float]:
    end = max(midi.get_end_time(), 1.0)
    best, best_score = None, 0.0
    for inst in midi.instruments:
        if inst.is_drum or len(inst.notes) < 30:
            continue
        notes = sorted(inst.notes, key=lambda n: n.start)
        overlapping = sum(1 for a, b in zip(notes, notes[1:]) if b.start < a.end - 0.5 * (a.end - a.start) and abs(b.start - a.start) < 0.03)
        mono = 1 - overlapping / len(notes)
        median = float(np.median([n.pitch for n in notes]))
        coverage = (notes[-1].end - notes[0].start) / end
        score = (
            (2.0 if MELODY_NAME.search(inst.name or "") else 0.0)
            + (0.5 if inst.program in MELODY_PROGRAMS else 0.0)
            + 2.0 * mono
            + (1.0 if 57 <= median <= 79 else 0.0)
            + coverage
        )
        if mono < 0.7:
            continue
        if score > best_score:
            best, best_score = inst, score
    return best, best_score


def _skyline(notes: list[pretty_midi.Note]) -> list[dict]:
    """Une seule note à la fois : la plus aiguë de chaque attaque, coupée à l'attaque suivante."""
    tops: list[pretty_midi.Note] = []
    for n in sorted(notes, key=lambda n: (n.start, -n.pitch)):
        if tops and n.start - tops[-1].start < 0.03:
            continue
        tops.append(n)
    result = []
    for i, n in enumerate(tops):
        end = min(n.end, tops[i + 1].start) if i + 1 < len(tops) else n.end
        if end - n.start >= 0.05:
            result.append({"p": n.pitch, "t": n.start, "d": end - n.start, "v": n.velocity})
    return result


def _index() -> list[str]:
    if not ARCHIVE.exists():
        log.info("Téléchargement de l'index de partitions (%s)", URL)
        ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
        tmp = ARCHIVE.with_suffix(".part")
        urllib.request.urlretrieve(URL, tmp)
        tmp.rename(ARCHIVE)
    listing = ARCHIVE.with_suffix(".txt")
    if not listing.exists():
        with tarfile.open(ARCHIVE) as tar:
            listing.write_text("\n".join(n for n in tar.getnames() if n.lower().endswith(".mid")), encoding="utf-8")
    return listing.read_text(encoding="utf-8").splitlines()


def _norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    value = re.sub(r"\(.*?\)|\[.*?\]|\b(feat|ft)\b.*$|\s-\s.*(remaster|version|edit|live|mix).*$", "", value)
    value = re.sub(r"&", " and ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value).strip()
    return re.sub(r"^the ", "", value)


def _sim(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0
