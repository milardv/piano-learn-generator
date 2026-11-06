"""Transcription audio -> MIDI avec Transkun (piano, CPU)."""

import logging
import subprocess
import sys
import time
from pathlib import Path

log = logging.getLogger(__name__)


def to_midi(wav: Path, midi: Path, device: str = "cpu") -> Path:
    log.info("Transcription de %s (device=%s)", wav.name, device)
    started = time.monotonic()
    transkun = Path(sys.executable).with_name("transkun")
    subprocess.run([str(transkun), str(wav), str(midi), "--device", device], check=True)
    log.info("Transcription terminée en %.0f s", time.monotonic() - started)
    return midi
