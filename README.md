# Piano Coach

Apprendre n'importe quel morceau au piano à partir d'une vidéo YouTube ou d'un enregistrement micro.
Site : https://milardv.github.io/piano-learn-generator/
Les notes défilent sur un clavier, à la vitesse choisie. 100 % gratuit, utilisable sur téléphone, PC éteint.

```
PWA (téléphone) ──workflow_dispatch──▶ GitHub Actions (worker) ──commit──▶ songs/<id>.json ──▶ PWA
```

| Dossier | Rôle |
|---|---|
| `worker/` | Python : audio (recherche YouTube, URL ou fichier) → ffmpeg → Pop2Piano (chanson) ou Transkun (piano solo) → version complète + version facile |
| `.github/workflows/transcribe.yml` | Exécute le worker dans le cloud et commite le résultat |
| `.github/workflows/deploy.yml` | Publie la PWA et `songs/` sur GitHub Pages |
| `songs/` | Bibliothèque : un JSON par morceau + `index.json` |
| `uploads/` | Enregistrements micro en attente de transcription |
| `web/` | PWA React : bibliothèque, ajout avec autocomplétion (iTunes), suivi des générations, lecteur Facile/Complet |

## Worker en local

Prérequis : `uv`, `ffmpeg`.

```bash
cd worker
uv sync
uv run piano-worker --search "Daft Punk - Get Lucky" --out-dir ../songs          # chanson -> arrangement piano
uv run piano-worker --mode piano --youtube "https://www.youtube.com/watch?v=..." --out-dir ../songs
uv run piano-worker --file enregistrement.webm --title "Mon morceau" --out-dir ../songs
```

Chanson : ~45 s en local (Pop2Piano). Piano solo : ~0,6 × la durée du morceau (Transkun). Prévoir plus sur un runner GitHub (4 cœurs).

## Front en local

```bash
cd web
npm install
npm run dev
```

`web/public/songs` est un lien vers `songs/`.

## Déploiement (gratuit)

GitHub Pages + Actions, gratuits et illimités pour un dépôt public.

1. Une seule fois : *Settings → Pages → Build and deployment → Source : GitHub Actions*.
2. `.github/workflows/deploy.yml` publie le site à chaque push sur `web/` ou `songs/`,
   et après chaque transcription (appelé par `transcribe.yml`).
3. Site : https://milardv.github.io/piano-learn-generator/
4. Ajouter un morceau depuis l'appli : jeton GitHub *fine-grained* limité à ce dépôt, permission **Actions : Read and write**
   (https://github.com/settings/personal-access-tokens/new). Saisi une fois, il reste sur le téléphone.
5. Optionnel, si YouTube bloque le runner : secret `YT_COOKIES` (cookies Netscape d'un compte Google **secondaire**).

## Format `songs/<id>.json`

```json
{ "version": 2, "id": "...", "title": "...", "duration": 265.0,
  "range": { "min": 32, "max": 99 },
  "mode": "song", "cover": "https://…", "beats": [0.52, 1.05],
  "notes": [{ "p": 60, "t": 1.23, "d": 0.5, "v": 80, "h": "R" }],
  "easy": [{ "p": 72, "t": 1.05, "d": 0.53, "v": 80, "h": "R" }],
  "pedals": [{ "t": 1.2, "d": 2.0 }] }
```

`p` hauteur MIDI, `t` début (s), `d` durée (s), `v` vélocité, `h` main (`L`/`R`).
`easy` : mélodie (une note par temps max) à droite, une basse toutes les 2 temps à gauche.

## Prochaines étapes

- PWA : mode « Écouter » (micro → `uploads/`)
- Boucle A-B, mode attente (Web MIDI sur Android, micro sinon), niveaux de difficulté
- Réutiliser des partitions existantes (Lakh clean_midi, PDMX) avant de générer
