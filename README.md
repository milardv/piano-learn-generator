# Piano Coach

Apprendre n'importe quel morceau au piano à partir d'une vidéo YouTube ou d'un enregistrement micro.
Les notes défilent sur un clavier, à la vitesse choisie. 100 % gratuit, utilisable sur téléphone, PC éteint.

```
PWA (téléphone) ──workflow_dispatch──▶ GitHub Actions (worker) ──commit──▶ songs/<id>.json ──▶ PWA
```

| Dossier | Rôle |
|---|---|
| `worker/` | Python : audio (yt-dlp ou fichier) → nettoyage ffmpeg → Transkun → `notes.json` |
| `.github/workflows/transcribe.yml` | Exécute le worker dans le cloud et commite le résultat |
| `songs/` | Bibliothèque : un JSON par morceau + `index.json` |
| `uploads/` | Enregistrements micro en attente de transcription |
| `web/` | PWA React : lecteur (notes qui tombent, vitesse, mains séparées) |

## Worker en local

Prérequis : `uv`, `ffmpeg`.

```bash
cd worker
uv sync
uv run piano-worker --youtube "https://www.youtube.com/watch?v=..." --out-dir ../songs
uv run piano-worker --file enregistrement.webm --title "Mon morceau" --out-dir ../songs
```

Environ 0,6 × la durée du morceau sur 20 cœurs ; prévoir ~10 min sur un runner GitHub.

## Front en local

```bash
cd web
npm install
npm run dev
```

`web/public/songs` est un lien vers `songs/`.

## Déploiement (gratuit)

1. Pousser ce dépôt sur GitHub (privé).
2. Cloudflare Pages : connecter le dépôt, racine `web`, commande `npm run build`, sortie `dist`.
   Chaque commit d'un morceau redéploie le site.
3. Optionnel, si YouTube bloque le runner : secret `YT_COOKIES` (cookies Netscape d'un compte Google **secondaire**).

## Format `songs/<id>.json`

```json
{ "version": 1, "id": "...", "title": "...", "duration": 265.0,
  "range": { "min": 32, "max": 99 },
  "notes": [{ "p": 60, "t": 1.23, "d": 0.5, "v": 80, "h": "R" }],
  "pedals": [{ "t": 1.2, "d": 2.0 }] }
```

`p` hauteur MIDI, `t` début (s), `d` durée (s), `v` vélocité, `h` main (`L`/`R`).

## Prochaines étapes

- PWA : déclencher le workflow (jeton GitHub fine-grained), mode « Écouter » (micro → `uploads/`), suivi du job
- Boucle A-B, mode attente (Web MIDI sur Android, micro sinon), niveaux de difficulté
- Chansons non-piano : Demucs / Pop2Piano
