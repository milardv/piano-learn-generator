"""Point d'entrée : piano-worker (--search Q | --youtube URL | --file PATH) [--mode song|piano] [--id ID] [--title T]."""

import argparse
import json
import logging
import re
import shutil
import tempfile
from pathlib import Path

from . import accompany, arrange, audio, chords, notes, pdmx, score, simplify, source, transcribe

log = logging.getLogger("piano_worker")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
    parser = argparse.ArgumentParser(description="Génère songs/<id>.json à partir d'une vidéo YouTube ou d'un fichier audio")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--search", metavar="QUERY", help="« Artiste - Titre » : premier résultat YouTube")
    src.add_argument("--youtube", metavar="URL")
    src.add_argument("--file", type=Path, metavar="PATH", help="enregistrement micro ou fichier audio")
    parser.add_argument(
        "--mode", choices=["song", "piano"], default="song",
        help="song : chanson -> reprise piano (Pop2Piano) ; piano : transcription fidèle d'un enregistrement de piano (Transkun)",
    )
    parser.add_argument("--id", help="identifiant du morceau (défaut : id YouTube ou nom du fichier)")
    parser.add_argument("--title")
    parser.add_argument("--cover", help="URL de la pochette (autocomplétion de la PWA)")
    parser.add_argument("--out-dir", type=Path, default=Path("songs"))
    parser.add_argument("--keep-midi", action="store_true", help="copie aussi le .mid à côté du .json")
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="piano-worker-") as tmp:
        work = Path(tmp)
        midi = None
        # Une partition existante prime sur l'écoute de l'audio : d'abord pour piano (PDMX), puis MIDI complet (Lakh)
        query = args.title or args.search
        piano_score = pdmx.find(query) if query and not args.file else None
        found = score.find(query) if query and not piano_score and args.mode == "song" and not args.file else None
        if piano_score:
            title = args.title or args.search
            song_id = slugify(args.id or title)
            midi = work / "score.mid"
            midi.write_bytes(piano_score.midi)
            song = {"id": song_id, "mode": "piano", "cover": args.cover, **from_piano_score(midi, piano_score, title)}
        elif found:
            title = args.title or args.search
            song_id = slugify(args.id or title)
            song = {"id": song_id, "mode": "song", "cover": args.cover, **from_score(found, title)}
        else:
            if args.search:
                audio_src = source.from_search(args.search, work)
            elif args.youtube:
                audio_src = source.from_youtube(args.youtube, work)
            else:
                audio_src = source.from_file(args.file, args.title)
            title = args.title or audio_src.title
            song_id = slugify(args.id or audio_src.source.get("videoId") or args.file.stem)

            wav = audio.preprocess(audio_src.path, work / "clean.wav")
            beat_times = simplify.beats(wav)
            if args.mode == "song":
                midi = arrange.to_midi(wav, work / "song.mid")
                song = notes.build(midi, title, audio_src.source, beat_times)
                # Mélodie de la reprise Pop2Piano, accords reconnus dans l'audio d'origine
                melody = [n for n in song["notes"] if n["h"] == "R"]
                song |= accompany.build(_top_line(melody), chords.from_audio(wav, beat_times), beat_times, None, song["duration"])
                pitches = [n["p"] for n in song["notes"]]
                song["range"] = {"min": min(pitches), "max": max(pitches)}
            else:
                midi = transcribe.to_midi(wav, work / "song.mid", args.device)
                song = notes.build(midi, title, audio_src.source, beat_times)
            song = {"id": song_id, "mode": args.mode, "cover": args.cover, **song}

        args.out_dir.mkdir(parents=True, exist_ok=True)
        out = args.out_dir / f"{song_id}.json"
        out.write_text(json.dumps(song, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if args.keep_midi and midi:
            shutil.copy(midi, args.out_dir / f"{song_id}.mid")
    update_index(args.out_dir)
    log.info("%s écrit : %d notes, %.0f s", out, len(song["notes"]), song["duration"])


def from_piano_score(midi: Path, found: pdmx.PianoScore, title: str) -> dict:
    import pretty_midi

    beats = pretty_midi.PrettyMIDI(str(midi)).get_beats().tolist()
    src = {"type": "score", "dataset": "pdmx", "file": found.path, "license": found.license}
    song = notes.build(midi, title, src, beats)
    path = score.chord_path(pretty_midi.PrettyMIDI(str(midi)), beats)
    song["marks"] = [
        {"t": round(beats[i], 3), "label": chords.chord_name(c)} for i, c in enumerate(path) if i == 0 or c != path[i - 1]
    ]
    return song


def from_score(found: score.Score, title: str) -> dict:
    song = {
        "version": notes.FORMAT_VERSION,
        "title": title,
        "source": {"type": "score", "dataset": "lakh", "file": found.file},
        "duration": round(found.duration, 3),
        "beats": [round(b, 3) for b in found.beats],
        "pedals": [],
        **accompany.build(found.melody, found.chords, found.beats, found.downbeats, found.duration),
    }
    pitches = [n["p"] for n in song["notes"]]
    song["range"] = {"min": min(pitches), "max": max(pitches)}
    return song


def _top_line(notes_: list[dict]) -> list[dict]:
    """Note la plus aiguë de chaque attaque, sans chevauchement : la ligne mélodique."""
    tops: list[dict] = []
    for n in sorted(notes_, key=lambda n: (n["t"], -n["p"])):
        if tops and n["t"] - tops[-1]["t"] < 0.05:
            continue
        tops.append(dict(n))
    for a, b in zip(tops, tops[1:]):
        a["d"] = min(a["d"], b["t"] - a["t"])
    return [n for n in tops if n["d"] >= 0.06]


def update_index(out_dir: Path) -> None:
    """songs/index.json : la bibliothèque affichée par la PWA."""
    entries = []
    for path in sorted(out_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        song = json.loads(path.read_text(encoding="utf-8"))
        entries.append(
            {k: song.get(k) for k in ("id", "title", "mode", "cover", "source", "duration")}
            | {"notes": len(song["notes"]), "easy": len(song.get("easy", []))}
        )
    (out_dir / "index.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-") or "song"


if __name__ == "__main__":
    main()
