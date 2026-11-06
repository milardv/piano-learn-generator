"""Recherche d'une partition pour piano dans PDMX (partitions MuseScore du domaine public ou sous Creative Commons).

Environ 200 000 partitions pour piano : surtout du classique et du traditionnel, quelques arrangements pop.
On ne garde que les partitions écrites pour piano seul, converties ensuite telles quelles pour l'app.
"""

import csv
import gzip
import logging
import math
import os
import tarfile
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from .score import _norm, _sim

log = logging.getLogger(__name__)

RECORD = "https://zenodo.org/api/records/15571083/files"
CACHE = Path(os.environ.get("PIANO_SCORES", Path.home() / ".cache/piano-worker"))
MIN_SIMILARITY = 0.88
FIELDS = ("song", "artist", "composer", "title", "mid", "popularity", "license")


@dataclass
class PianoScore:
    midi: bytes
    title: str
    artist: str
    license: str
    path: str


def find(query: str) -> PianoScore | None:
    artist, _, title = query.partition(" - ")
    if not title:
        artist, title = "", artist
    want_artist, want_title = _norm(artist), _norm(title)
    want_tokens = set(want_title.split())

    matches = []
    for row in _index():
        titles = {_norm(row["song"]), _norm(row["title"].split(" - ")[0])} - {""}
        if not any(want_tokens & set(t.split()) for t in titles):
            continue
        title_sim = max(_sim(want_title, t) for t in titles)
        if want_artist:
            artist_sim = max(_artist_sim(want_artist, _norm(row["artist"])), _artist_sim(want_artist, _norm(row["composer"])))
            sim = min(title_sim, artist_sim)
        else:
            sim = title_sim
        if sim >= MIN_SIMILARITY:
            matches.append((sim, float(row["popularity"]), row))
    if not matches:
        log.info("Aucune partition piano PDMX pour « %s »", query)
        return None
    best_sim = max(m[0] for m in matches)
    _, _, row = max((m for m in matches if m[0] >= best_sim - 0.02), key=lambda m: m[1])
    log.info("Partition piano PDMX : « %s » (%s, %s) parmi %d", row["title"], row["artist"], row["license"], len(matches))
    return PianoScore(_extract(row["mid"]), row["title"], row["artist"], row["license"], row["mid"])


def _artist_sim(want: str, candidate: str) -> float:
    """« chopin » correspond à « frederic chopin »."""
    if want and set(want.split()) <= set(candidate.split()):
        return 1.0
    return _sim(want, candidate)


def _extract(path: str) -> bytes:
    archive = _download("mid.tar.gz")
    # Lecture séquentielle : plus rapide que la table des matières d'un .tar.gz
    with tarfile.open(archive, "r|gz") as tar:
        for member in tar:
            if member.name == path:
                return tar.extractfile(member).read()
    raise FileNotFoundError(path)


def _index() -> list[dict]:
    index = CACHE / "pdmx-piano.tsv.gz"
    if not index.exists():
        _build_index(index)
    with gzip.open(index, "rt", encoding="utf-8") as f:
        return [dict(zip(FIELDS, line.rstrip("\n").split("\t"))) for line in f]


def _build_index(index: Path) -> None:
    """Ne garde du CSV de 225 Mo que les partitions pour piano seul (programmes General MIDI 0 à 7)."""
    source = _download("PDMX.csv")
    csv.field_size_limit(1 << 30)
    rows = 0
    with open(source, newline="", encoding="utf-8") as f, gzip.open(index, "wt", encoding="utf-8") as out:
        for r in csv.DictReader(f):
            programs = r["tracks"].split("-") if r["tracks"] not in ("", "NA") else []
            if not programs or len(programs) > 2 or not all(p.isdigit() and int(p) < 8 for p in programs):
                continue
            popularity = math.log1p(_num(r["n_views"])) + _num(r["rating"]) + 0.5 * math.log1p(_num(r["n_favorites"]))
            values = [r["song_name"], r["artist_name"], r["composer_name"], r["title"], r["mid"].removeprefix("./"), f"{popularity:.2f}", r["license"]]
            out.write("\t".join(v.replace("\t", " ").replace("\n", " ") if v != "NA" else "" for v in values) + "\n")
            rows += 1
    source.unlink()
    log.info("Index PDMX : %d partitions pour piano", rows)


def _download(name: str) -> Path:
    path = CACHE / name
    if not path.exists():
        log.info("Téléchargement de %s (PDMX)", name)
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        urllib.request.urlretrieve(f"{RECORD}/{name}/content", tmp)
        tmp.rename(path)
    return path


def _num(value: str) -> float:
    try:
        return float(value)
    except ValueError:
        return 0.0
