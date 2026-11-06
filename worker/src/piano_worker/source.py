"""Récupération de l'audio source : vidéo YouTube ou fichier (enregistrement micro, upload)."""

import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path

log = logging.getLogger(__name__)


@dataclass
class SourceAudio:
    path: Path
    title: str
    source: dict


# Versions à écarter quand on cherche le morceau original sur SoundCloud
_NOT_ORIGINAL = re.compile(r"remix|nightcore|cover|mashup|live|bass ?boost|sped up|slowed|edit\b|bootleg|karaoke", re.I)


def from_youtube(url: str, work_dir: Path) -> SourceAudio:
    info, path = _download(url, work_dir, cookies=os.environ.get("PIANO_YT_COOKIES"))
    return SourceAudio(
        path=path,
        title=info.get("title") or info["id"],
        source={"type": "youtube", "url": f"https://www.youtube.com/watch?v={info['id']}", "videoId": info["id"]},
    )


def from_search(query: str, work_dir: Path) -> SourceAudio:
    """« Artiste - Titre » choisi dans l'autocomplétion : YouTube, sinon SoundCloud.

    YouTube refuse souvent les serveurs des runners GitHub (« confirm you're not a bot ») ;
    SoundCloud ne les bloque pas.
    """
    import yt_dlp

    try:
        audio = from_youtube(f"ytsearch1:{query} official audio", work_dir)
    except yt_dlp.utils.DownloadError as e:
        log.warning("YouTube indisponible (%s), recherche sur SoundCloud", e)
        audio = _from_soundcloud(query, work_dir)
    return SourceAudio(path=audio.path, title=query, source={**audio.source, "query": query})


def _from_soundcloud(query: str, work_dir: Path) -> SourceAudio:
    import yt_dlp

    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": "in_playlist"}) as ydl:
        results = ydl.extract_info(f"scsearch10:{query}", download=False)["entries"]
    # Les titres réservés aux abonnés ne donnent qu'un extrait de 30 s
    track = next(
        (t for t in results if (t.get("duration") or 0) >= 90 and not _NOT_ORIGINAL.search(t.get("title") or "")),
        None,
    )
    if not track:
        raise RuntimeError(f"Aucun enregistrement complet trouvé pour « {query} »")
    info, path = _download(track["url"], work_dir)
    return SourceAudio(path=path, title=info.get("title") or query, source={"type": "soundcloud", "url": info["webpage_url"]})


def _download(target: str, work_dir: Path, cookies: str | None = None) -> tuple[dict, Path]:
    import yt_dlp

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(work_dir / "%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    # Sur un runner cloud, YouTube réclame souvent une preuve « pas un bot » : cookies d'un compte secondaire
    if cookies:
        options["cookiefile"] = cookies
    log.info("Téléchargement de %s", target)
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(target, download=True)
        if "entries" in info:
            info = info["entries"][0]
        return info, Path(ydl.prepare_filename(info))


def from_file(path: Path, title: str | None) -> SourceAudio:
    if not path.is_file():
        raise FileNotFoundError(path)
    return SourceAudio(path=path, title=title or path.stem, source={"type": "upload", "file": path.name})
