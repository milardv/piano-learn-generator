"""Récupération de l'audio source : vidéo YouTube ou fichier (enregistrement micro, upload)."""

import logging
import os
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass
class SourceAudio:
    path: Path
    title: str
    source: dict


def from_youtube(url: str, work_dir: Path) -> SourceAudio:
    import yt_dlp

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(work_dir / "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    # Sur un runner cloud, YouTube réclame souvent une preuve « pas un bot » : cookies d'un compte secondaire
    cookies = os.environ.get("PIANO_YT_COOKIES")
    if cookies:
        options["cookiefile"] = cookies
    log.info("Téléchargement de %s", url)
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)
        path = Path(ydl.prepare_filename(info))
    return SourceAudio(
        path=path,
        title=info.get("title") or info["id"],
        source={"type": "youtube", "url": url, "videoId": info["id"]},
    )


def from_file(path: Path, title: str | None) -> SourceAudio:
    if not path.is_file():
        raise FileNotFoundError(path)
    return SourceAudio(path=path, title=title or path.stem, source={"type": "upload", "file": path.name})
