"""Point d'entrée : piano-worker (--youtube URL | --file PATH) --id ID [--title T]."""

import argparse
import json
import logging
import re
import shutil
import tempfile
from pathlib import Path

from . import audio, notes, source, transcribe

log = logging.getLogger("piano_worker")


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
    parser = argparse.ArgumentParser(description="Génère songs/<id>.json à partir d'une vidéo YouTube ou d'un fichier audio")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--youtube", metavar="URL")
    src.add_argument("--file", type=Path, metavar="PATH", help="enregistrement micro ou fichier audio")
    parser.add_argument("--id", help="identifiant du morceau (défaut : id YouTube ou nom du fichier)")
    parser.add_argument("--title")
    parser.add_argument("--out-dir", type=Path, default=Path("songs"))
    parser.add_argument("--keep-midi", action="store_true", help="copie aussi le .mid à côté du .json")
    parser.add_argument("--device", default="cpu")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="piano-worker-") as tmp:
        work = Path(tmp)
        audio_src = source.from_youtube(args.youtube, work) if args.youtube else source.from_file(args.file, args.title)
        title = args.title or audio_src.title
        song_id = slugify(args.id or audio_src.source.get("videoId") or args.file.stem)

        wav = audio.preprocess(audio_src.path, work / "clean.wav")
        midi = transcribe.to_midi(wav, work / "song.mid", args.device)
        song = {"id": song_id, **notes.build(midi, title, audio_src.source)}

        args.out_dir.mkdir(parents=True, exist_ok=True)
        out = args.out_dir / f"{song_id}.json"
        out.write_text(json.dumps(song, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        if args.keep_midi:
            shutil.copy(midi, args.out_dir / f"{song_id}.mid")
    update_index(args.out_dir)
    log.info("%s écrit : %d notes, %.0f s", out, len(song["notes"]), song["duration"])


def update_index(out_dir: Path) -> None:
    """songs/index.json : la bibliothèque affichée par la PWA."""
    entries = []
    for path in sorted(out_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        song = json.loads(path.read_text(encoding="utf-8"))
        entries.append({k: song[k] for k in ("id", "title", "source", "duration")} | {"notes": len(song["notes"])})
    (out_dir / "index.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", value).strip("-") or "song"


if __name__ == "__main__":
    main()
