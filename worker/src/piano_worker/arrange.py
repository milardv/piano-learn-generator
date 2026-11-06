"""Chanson (pop, rock, etc.) -> reprise au piano avec Pop2Piano (CPU)."""

import logging
import time
from pathlib import Path

log = logging.getLogger(__name__)

MODEL = "sweetcocoa/pop2piano"
SAMPLE_RATE = 44100


def to_midi(wav: Path, midi: Path, composer: str = "composer1") -> Path:
    import librosa
    from transformers import Pop2PianoForConditionalGeneration, Pop2PianoProcessor

    log.info("Arrangement piano de %s (%s)", wav.name, composer)
    started = time.monotonic()
    model = Pop2PianoForConditionalGeneration.from_pretrained(MODEL)
    processor = Pop2PianoProcessor.from_pretrained(MODEL)
    audio, sr = librosa.load(str(wav), sr=SAMPLE_RATE)
    inputs = processor(audio=audio, sampling_rate=sr, return_tensors="pt")
    tokens = model.generate(input_features=inputs["input_features"], composer=composer)
    result = processor.batch_decode(token_ids=tokens, feature_extractor_output=inputs)
    result["pretty_midi_objects"][0].write(str(midi))
    log.info("Arrangement terminé en %.0f s", time.monotonic() - started)
    return midi
