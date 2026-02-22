# Aegis Pick — Dota 2 Counterpick Assistant

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688)](https://fastapi.tiangolo.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> ML-powered draft assistant for Dota 2. Pick optimal counters based on enemy heroes, your MMR bracket, region, and game mode.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (CI)                                        │
│  ├── refresh_data.yml   — retrain every 12h                 │
│  └── patch_watch.yml    — detect new patch hourly           │
│          │ commits pre-computed JSONs to data/              │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Vercel)           Backend (Render free tier)     │
│  Next.js 16 + Tailwind  ──►  FastAPI                        │
│  - Draft board UI            - /api/suggestions             │
│  - Facet picker              - /api/heroes                  │
│  - localStorage cache        - /health (keep-alive)         │
│                │             - Serves pre-computed JSONs    │
│                └─► keeps Render awake via 4-min ping        │
└─────────────────────────────────────────────────────────────┘
```

**Zero ML at runtime.** All matchup model training happens on GitHub Actions free runners. Render only does fast dict lookups from pre-computed JSON files committed to `data/`.

---

## Quick Start

### Prerequisites
- Node.js 20+, npm
- Python 3.11+
- Git

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/aegis-pick.git
cd aegis-pick
```

### 2. Frontend (local dev)

```bash
cd frontend
cp .env.example .env.local   # edit NEXT_PUBLIC_BACKEND_URL if needed
npm install
npm run dev                  # → http://localhost:3000
```

### 3. Backend (local dev)

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 4. Generate initial data

```bash
pip install -r pipeline/requirements.txt
python pipeline/train.py     # fetches OpenDota, writes data/*.json
```

> First run takes ~5-10 minutes to fetch all matchup data from OpenDota.

---

## Project Structure

```
aegis-pick/
├── frontend/                  # Next.js app
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   │   ├── DraftBoard.tsx
│   │   │   ├── BanRow.tsx
│   │   │   ├── HeroSearch.tsx
│   │   │   ├── FacetPicker.tsx
│   │   │   ├── GameModeSelector.tsx
│   │   │   └── SuggestionPanel.tsx
│   │   └── lib/
│   │       ├── api.ts         # Backend API client + localStorage cache
│   │       ├── store.ts       # Zustand draft state
│   │       └── heroAliases.ts # 125+ alias map for search
│   └── messages/en.json       # i18n strings
│
├── backend/                   # FastAPI service
│   └── main.py                # Endpoints + scoring logic
│
├── pipeline/                  # ML training (runs on GitHub Actions)
│   ├── train.py               # Fetch OpenDota → train → write data/
│   └── patch_watch.py         # Detect new Dota patch
│
├── data/                      # Pre-computed outputs (committed)
│   ├── heroes.json            # Hero list (cached 30 days)
│   ├── facets.json            # Hero facets (cached 30 days)
│   ├── meta.json              # Patch info + last update timestamps
│   ├── synergy_scores.json
│   ├── ranked/matchup_scores_*.json
│   ├── cm/matchup_scores_*.json
│   └── turbo/matchup_scores_*.json
│
├── docs/
│   ├── ARCHITECTURE.md        # System design deep-dive
│   ├── PIPELINE.md            # ML pipeline details
│   └── DEPLOYMENT.md          # Step-by-step deploy guide
│
├── .github/workflows/
│   ├── refresh_data.yml       # Cron: retrain every 12 hours
│   └── patch_watch.yml        # Cron: check patch every hour
│
├── render.yaml                # Render deploy config
└── README.md
```

---

## Game Modes

| Mode | Bans | OpenDota `game_mode` | Notes |
|---|---|---|---|
| Ranked All Pick | 16 total | 22 (+ mode 1) | Primary ranked mode |
| Captains Mode | 7/side = 14 | 2 | Tournament/CM |
| Turbo | 1/player = 10 | 23 | Kept fully separate |

> Turbo data is **never mixed** with Ranked data — different balance, shorter games, non-strategic bans.

---

## Hero Facets (Patch 7.36+)

Every hero has 2–5 **facets** that meaningfully change their playstyle. Aegis Pick lets you select the facet each hero is running during the draft:

- Facets are fetched from OpenDota `/api/constants/hero_abilities`
- Deprecated facets are filtered out automatically
- The UI shows a colour-coded facet badge on each hero slot
- Suggestions include a ⚡ note for kit-changing facets vs. the current enemy lineup

---

## Caching

| Layer | Data | TTL |
|---|---|---|
| Pipeline (file system) | heroes, facets | 30 days (skip re-fetch if fresh) |
| Backend HTTP headers | heroes, facets | `Cache-Control: public, max-age=2592000` |
| Backend HTTP headers | suggestions | `Cache-Control: no-store` |
| Frontend localStorage | heroes, facets | 30 days |
| Frontend memory | draft state | Session-scoped (Zustand) |
| Matchup files | patch-keyed filename | Invalidated on new patch |

---

## Deployment

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for full instructions.

**Quick summary:**
1. Push repo to GitHub
2. Connect to [Vercel](https://vercel.com) → set `NEXT_PUBLIC_BACKEND_URL`
3. Connect to [Render](https://render.com) → auto-uses `render.yaml`
4. Add GitHub Secret `OPENDOTA_API_KEY` (optional, higher rate limits)
5. Trigger `Refresh Matchup Data` workflow manually for first data load

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Vercel / `.env.local` | Backend URL (default: `http://localhost:8000`) |
| `OPENDOTA_API_KEY` | GitHub Secrets | OpenDota API key (optional) |

---

## Contributing

```bash
# Run TypeScript check
cd frontend && npx tsc --noEmit

# Run backend locally
uvicorn backend.main:app --reload --port 8000

# Run pipeline manually
python pipeline/train.py --mode ranked
```

---

## License

MIT — see [LICENSE](LICENSE).
