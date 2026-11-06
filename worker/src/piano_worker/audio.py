"""Nettoyage audio avant transcription (utile surtout pour les enregistrements micro)."""

import logging
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)

# - highpass : retire bourdonnements et vibrations sous 30 Hz (le La0 du piano est à 27,5 Hz, sans fondamentale utile en pratique)
# - silenceremove : coupe le silence au début, puis à la fin via inversion
# - loudnorm : volume homogène quel que soit le niveau d'enregistrement
FILTERS = ",".join([
    "highpass=f=30",
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.2",
    "areverse",
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.5",
    "areverse",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
])


def preprocess(src: Path, dst: Path) -> Path:
    log.info("Nettoyage audio %s -> %s", src.name, dst.name)
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(src), "-af", FILTERS, "-ac", "1", "-ar", "44100", "-sample_fmt", "s16", str(dst)],
        check=True,
    )
    return dst
