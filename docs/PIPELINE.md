# ML Pipeline — Aegis Pick

## Overview

The pipeline runs entirely on **GitHub Actions free runners** (Ubuntu, 2 vCPU, 7 GB RAM). It fetches match data from the OpenDota API, trains lightweight matchup models, and commits pre-computed JSON files to the repository.

## Data Sources

| Endpoint | Data | Rate limit (no key) |
|---|---|---|
| `GET /api/heroes` | Hero list | 60/min |
| `GET /api/constants/hero_abilities` | Facet definitions | 60/min |
| `GET /api/heroes/{id}/matchups` | Hero vs. hero win rates | 60/min |
| `GET /api/proMatches` | Pro match IDs (for CM model) | 60/min |

Set `OPENDOTA_API_KEY` in GitHub Secrets to get 1200/min.

## Training Modes

Three separate models are trained to avoid contaminating win rate signals:

### Ranked (game_mode=22 + mode=1, lobby_type=7)
- Primary mode for most users
- Highest data volume → most reliable confidence scores
- Bracket weighting applied: immortal matches weighted 2× vs herald

### Captains Mode (game_mode=2)
- Trained only on pro/qualifier matches
- Much smaller dataset → lower baseline confidence
- Per-side ban order tracked (side with 1st pick bans 3+2+2)

### Turbo (game_mode=23)
- Completely separate — hero balance differs (items cheaper, some abilities scaled)
- `significant=0` required in OpenDota queries (turbo matches are not "significant")
- Lower confidence by design

## Pipeline Steps

```
train.py
  │
  ├─ 1. Fetch heroes            → cache if < 30 days old
  ├─ 2. Fetch facets            → cache if < 30 days old
  ├─ 3. Check current patch     → read data/meta.json
  │
  ├─ For each mode (ranked, cm, turbo):
  │   ├─ 4. Fetch matchup data  → GET /heroes/{id}/matchups per hero
  │   ├─ 5. Build matchup matrix (hero × hero win rate deltas)
  │   ├─ 6. Build synergy matrix (ally pair win rate uplift)
  │   ├─ 7. Apply bracket weights
  │   └─ 8. Write data/{mode}/matchup_scores_{patch}.json
  │
  └─ 9. Update data/meta.json (patch, updated_at)
       10. data/heroes.json, data/facets.json
```

## Output Files

```
data/
├── heroes.json             # [{ id, name, localized_name, icon, roles }]
├── facets.json             # { "1": [{ id, title, description, color }] }
├── meta.json               # { patch, ranked_updated_at, cm_updated_at, ... }
├── synergy_scores.json     # { "hero_a_id:hero_b_id": 0.03 }
├── ranked/
│   └── matchup_scores_7.37e.json  # { "hero_id": { "enemy_id": score } }
├── cm/
│   └── matchup_scores_7.37e.json
└── turbo/
    └── matchup_scores_7.37e.json
```

### Score format

Matchup scores are **win rate deltas** relative to baseline (not raw win rates):
- Positive = hero wins more games against this enemy than average
- Range: approximately -0.15 to +0.15
- Already normalised across brackets

## Patch Detection

`patch_watch.py` polls `GET /api/metadata` every hour. When `game_version` changes:
1. Sets `PATCH_CHANGED=true` in GitHub Actions output
2. The `patch_watch.yml` workflow triggers `train.py` with `--force`

## Running Locally

```bash
pip install -r pipeline/requirements.txt

# Full retrain (all modes)
python pipeline/train.py

# Single mode
python pipeline/train.py --mode ranked

# Force retrain even if data is fresh
python pipeline/train.py --force

# Check for new patch (exits 0 if changed, 1 if same)
python pipeline/patch_watch.py
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OPENDOTA_API_KEY` | None | API key for higher rate limits |
| `DATA_DIR` | `../data` | Path to data output directory |
