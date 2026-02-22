# Architecture — Aegis Pick

## Overview

Aegis Pick is a **read-heavy, low-latency** application. The architecture is designed around one principle: **do all expensive computation offline, serve pre-computed results at runtime**.

```
┌──────────────────────────────────────────────────────────┐
│  GitHub Actions (free runners, cron)                     │
│                                                          │
│  ┌────────────────┐     ┌──────────────────────────┐    │
│  │ refresh_data   │     │ patch_watch              │    │
│  │ (every 12h)    │     │ (every 1h)               │    │
│  │                │     │                          │    │
│  │ pipeline/      │     │ pipeline/                │    │
│  │ train.py       │     │ patch_watch.py           │    │
│  └───────┬────────┘     └──────────┬───────────────┘    │
│          │ git commit data/*.json  │ if new patch →      │
│          └────────────────────────┘ trigger train.py     │
└────────────────────┬─────────────────────────────────────┘
                     │  push triggers Render redeploy
     ┌───────────────┼──────────────────────┐
     │               │                      │
     ▼               ▼                      ▼
┌─────────┐   ┌──────────────┐   ┌──────────────────┐
│ data/   │   │   Backend    │   │    Frontend      │
│ JSONs   │──►│   (Render)   │◄──│    (Vercel)      │
│ (Git)   │   │   FastAPI    │   │    Next.js 16    │
└─────────┘   └──────────────┘   └──────────────────┘
                     ▲                      │
                     └──── keep-alive ping ─┘
                           every 4 minutes
```

## Data Flow

### Draft suggestion request
```
User picks enemy hero(es)
        │
        ▼
Zustand store updates (ally_slots, enemy_slots, bans, facets)
        │
        ▼
useEffect debounce (300ms)
        │
        ▼
POST /api/suggestions
  { ally_ids, enemy_ids, banned_ids, ally_facets, enemy_facets,
    mmr_bracket, game_mode, region }
        │
        ▼
Backend loads data/ranked/matchup_scores_{patch}.json (already in RAM)
        │
        ▼
Score each un-played, un-banned hero:
  score = Σ matchup_score[hero][enemy] × ally_synergy[hero][ally]
        │  × bracket_weight × role_fit_bonus
        ▼
Return top-15 heroes ranked by score
        │
        ▼
SuggestionPanel renders with confidence bars
```

### Hero/facet boot load
```
Page load
  │
  ├─ Check localStorage["aegis:heroes"] (TTL: 30 days)
  │      hit? → use cached             miss? → GET /api/heroes
  │
  └─ Check localStorage["aegis:facets"] (TTL: 30 days)
         hit? → use cached             miss? → GET /api/facets
```

## Scoring Formula

```
base_score(hero, enemies) =
  Σ_e  matchup_score[hero][e]            # how well hero counters each enemy
  + α × Σ_a synergy_score[hero][a]       # how well hero synergises with allies
  + β × role_fit(hero, open_roles)        # fills a needed role

bracket_weight(bracket) =
  { herald: 0.7, guardian: 0.75, crusader: 0.8, archon: 0.85,
    legend: 0.9, ancient: 0.95, divine: 0.98, immortal: 1.0 }

final_score = base_score × bracket_weight × patch_recency_weight
confidence   = min(1.0, sample_count / 500 matches)
```

Parameters α = 0.35, β = 0.15 learned from ranked match data (patch-specific).

## Caching Policy

| Resource         | TTL         | Cache location         | Invalidation           |
|------------------|-------------|------------------------|------------------------|
| Hero list        | 30 days     | localStorage + CDN     | New hero release       |
| Facet data       | 30 days     | localStorage + CDN     | New hero or rework     |
| Matchup scores   | Per-patch   | File (patch in name)   | New patch detected     |
| Suggestions API  | No cache    | —                      | Always fresh           |
| Patch meta       | 1 hour      | Browser Cache-Control  | Hourly cron re-checks  |

## Why Not a Database?

For V1, pre-computed JSON committed to Git is simpler and faster than a DB:
- Render free tier has no persistent disk → DB would need external hosting  
- JSON reads are O(1) dict lookups — same speed as any DB cache hit
- Git history provides free audit trail of every data version

A DB (Postgres/Redis) becomes worthwhile in V2 when per-player recommendations require personalisation.
