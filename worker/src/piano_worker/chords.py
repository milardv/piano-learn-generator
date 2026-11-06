"""Reconnaissance d'accords (majeurs / mineurs) temps par temps, à partir de profils de hauteurs.

Les profils viennent soit d'un fichier MIDI (durée des notes par classe de hauteur),
soit de l'audio (chroma). Un Viterbi lisse le résultat : on ne change d'accord que si c'est net.
"""

import logging
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
CHANGE_PENALTY = 0.18  # coût d'un changement d'accord, en points de similarité
BASS_WEIGHT = 0.35  # bonus quand la basse joue la fondamentale


def chord_name(idx: int) -> str:
    return NAMES[idx % 12] + ("m" if idx >= 12 else "")


def chord_pcs(idx: int) -> tuple[int, int, int]:
    """Fondamentale, tierce, quinte (classes de hauteur)."""
    root = idx % 12
    return root, (root + (3 if idx >= 12 else 4)) % 12, (root + 7) % 12


def _templates() -> np.ndarray:
    t = np.zeros((24, 12))
    for idx in range(24):
        root, third, fifth = chord_pcs(idx)
        t[idx, [root, third, fifth]] = [1.0, 0.8, 0.7]
    return t / np.linalg.norm(t, axis=1, keepdims=True)


TEMPLATES = _templates()


def decode(profiles: np.ndarray, bass: np.ndarray | None = None) -> list[int]:
    """profiles, bass : (n_temps, 12). Renvoie un indice d'accord (0-23) par temps."""
    n = len(profiles)
    if n == 0:
        return []
    norm = profiles / np.maximum(np.linalg.norm(profiles, axis=1, keepdims=True), 1e-9)
    scores = norm @ TEMPLATES.T
    if bass is not None:
        bass_norm = bass / np.maximum(bass.sum(axis=1, keepdims=True), 1e-9)
        roots = np.array([chord_pcs(i)[0] for i in range(24)])
        scores += BASS_WEIGHT * bass_norm[:, roots]
    # Temps sans aucune note : on garde l'accord précédent (score neutre)
    scores[profiles.sum(axis=1) == 0] = 0

    best = scores[0].copy()
    back = np.zeros((n, 24), dtype=int)
    for i in range(1, n):
        stay = best
        jump = best.max() - CHANGE_PENALTY
        back[i] = np.where(stay >= jump, np.arange(24), best.argmax())
        best = np.maximum(stay, jump) + scores[i]
    path = [int(best.argmax())]
    for i in range(n - 1, 0, -1):
        path.append(int(back[i, path[-1]]))
    return path[::-1]


def from_audio(wav: Path, beat_times: list[float]) -> list[int]:
    """Un accord par temps, d'après le chroma de l'audio."""
    import librosa

    y, sr = librosa.load(str(wav), sr=22050, mono=True)
    harmonic = librosa.effects.harmonic(y)
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=harmonic, sr=sr, hop_length=hop)
    # Basse : trois octaves à partir de Do1
    cqt = np.abs(librosa.cqt(harmonic, sr=sr, hop_length=hop, fmin=librosa.note_to_hz("C1"), n_bins=36))
    bass = cqt.reshape(3, 12, -1).sum(axis=0)
    frames = librosa.time_to_frames(beat_times, sr=sr, hop_length=hop)
    sync = lambda m: librosa.util.sync(m, frames, aggregate=np.median, pad=False).T  # noqa: E731
    profiles, bass_profiles = sync(chroma), sync(bass)
    path = decode(profiles, bass_profiles)
    log.info("Accords (audio) : %s", " ".join(chord_name(c) for c in _changes(path)[:24]))
    return path[: len(beat_times)] + [path[-1]] * max(0, len(beat_times) - len(path))


def _changes(path: list[int]) -> list[int]:
    return [c for i, c in enumerate(path) if i == 0 or c != path[i - 1]]
