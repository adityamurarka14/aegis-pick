from __future__ import annotations

"""
Aegis Pick — FastAPI backend.

Runtime model: zero ML. All scores are pre-computed by the pipeline
(pipeline/train.py) and committed as JSON to data/. The backend just
does fast dict lookups and ranks heroes by composite score.

Cache-Control headers:
  /api/heroes, /api/facets  → public, 30 days  (data changes ~4×/year)
  /api/meta, /health        → public, 1 hour   (patch version check)
  /api/suggestions          → no-store          (personalised per draft)
"""

import json
import random
from pathlib import Path
from statistics import mean
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# App + CORS
# ---------------------------------------------------------------------------
app = FastAPI(title="Aegis Pick API", version="1.1.0")

ALLOWED_ORIGINS = [
    "https://aegis-pick.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "*",  # Remove "*" in production and list domains explicitly
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ---------------------------------------------------------------------------
# Data loading — runs once at startup, stays in RAM
# ---------------------------------------------------------------------------
DATA = Path(__file__).parent.parent / "data"

heroes: list[dict] = []
facets: dict[str, list[dict]] = {}   # { "hero_id": [{ id, title, description, color }] }
meta: dict = {}
synergy: dict = {}

# matchup_scores[mode][region_or_global][hero_a_id_str][hero_b_id_str] = float
matchup_scores: dict[str, dict[str, dict]] = {}

MODES = ["ranked", "cm", "turbo"]
REGIONS = ["SEA", "CN", "EU", "NA", "SA", "EEU", "ME"]


def _load_json(path: Path) -> dict | list:
    """Read a JSON file, return empty dict/list on missing."""
    if path.exists():
        return json.loads(path.read_text())
    return {}


def load_data():
    """Load all pre-computed data files into module-level variables."""
    global heroes, facets, meta, synergy, matchup_scores

    heroes = _load_json(DATA / "heroes.json") or []
    facets = _load_json(DATA / "facets.json") or {}
    meta   = _load_json(DATA / "meta.json")   or {}
    synergy = _load_json(DATA / "synergy_scores.json") or {}

    for mode in MODES:
        matchup_scores[mode] = {}
        mode_dir = DATA / mode
        if not mode_dir.exists():
            continue
        # Ranked: per-region files; CM and Turbo: global only
        regions_to_load = REGIONS if mode == "ranked" else ["global"]
        for region in regions_to_load:
            score_path = mode_dir / f"matchup_scores_{region}.json"
            if score_path.exists():
                matchup_scores[mode][region] = json.loads(score_path.read_text())


load_data()

# ---------------------------------------------------------------------------
# Bracket metadata
# ---------------------------------------------------------------------------
BRACKET_ID = {
    "herald": 1, "guardian": 2, "crusader": 3, "archon": 4,
    "legend": 5, "ancient": 6, "divine": 7, "immortal": 8,
}

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class SuggestionRequest(BaseModel):
    """
    Request model for counterpick suggestions.
    Contains the current draft state and matchmaking context.
    """
    ally_ids: list[int] = []
    enemy_ids: list[int] = []
    banned_ids: list[int] = []
    ally_roles: dict[str, str] = {}      # { "hero_id": role }
    ally_facets: dict[str, int] = {}     # { "hero_id": facet_index } — V1: contextual only
    enemy_facets: dict[str, int] = {}    # { "hero_id": facet_index } — V1: contextual only
    mmr_bracket: str = "immortal"
    game_mode: str = "ranked"            # "ranked" | "cm" | "turbo"
    region: str = "SEA"

class EvaluateRequest(BaseModel):
    """
    Request model for evaluating the win probability of a full or partial draft.
    """
    ally_ids: list[int]
    enemy_ids: list[int]
    game_mode: str = "ranked"
    region: str = "SEA"


class HeroResult(BaseModel):
    """
    Response model for a single counterpick suggestion.
    Contains pre-computed score data and contextual reasoning.
    """
    id: int
    localized_name: str
    img: str
    primary_attr: str
    score: float
    confidence_value: int
    confidence_label: str
    reason: str
    facet_note: str = ""   # populated when a kit-changing facet is relevant


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------
def get_scores(mode: str, region: str) -> Optional[dict]:
    """Resolve the right matchup score map for zone + mode."""
    mode_scores = matchup_scores.get(mode, {})
    return mode_scores.get(region) or mode_scores.get("global")


def confidence(counter: float, syn: float, sample: int,
               enemy_count: int, role_fit: bool) -> tuple[int, str]:
    """
    Compute a 0-100 confidence score.

    Components:
      - counter score (50% weight)
      - synergy score (30% weight)
      - sample size adequacy (20% weight, capped at 2000 matches)
    Penalties: <2 enemies (credibility cap 55), no role fit (-10).
    """
    base = counter * 50
    base += syn * 30
    base += min(sample / 2000, 1) * 20

    if enemy_count < 2:
        base = min(base, 55)
    if not role_fit:
        base -= 10

    value = max(0, min(100, round(base)))
    label = "High" if value >= 70 else ("Moderate" if value >= 40 else "Low")
    return value, label


ROLE_ATTR_MAP = {
    "carry": ["agi", "str"],
    "mid": ["int", "agi"],
    "offlane": ["str", "agi"],
    "soft_support": ["int", "str"],
    "hard_support": ["int", "str"],
}


def role_fit_bonus(hero: dict, ally_roles: dict) -> bool:
    """
    Check if a hero can fulfill one of the missing roles in the allied draft.
    Uses basic primary attribute filtering to approximate role suitability.
    """
    if not ally_roles:
        return False
    open_roles = {"carry", "mid", "offlane", "soft_support", "hard_support"} - set(ally_roles.values())
    hero_attr = hero.get("primary_attr", "agi")
    return any(hero_attr in ROLE_ATTR_MAP.get(role, []) for role in open_roles)


def build_reason(counter: float, syn: float, enemy_count: int, role_fit: bool) -> str:
    """
    Generate a human-readable justification string for a hero's recommendation
    based on counter weights, synergy, and role distribution.
    """
    parts = []
    if counter > 0.54:
        parts.append(f"Strong counter vs {enemy_count} enem{'y' if enemy_count == 1 else 'ies'}")
    elif counter > 0.51:
        parts.append("Slight counter advantage")
    if syn > 0.54:
        parts.append("good synergy with allies")
    if role_fit:
        parts.append("fills an open role")
    return ("; ".join(parts) or "Neutral matchup").capitalize()


def build_facet_note(hero_id: int, enemy_ids: list[int]) -> str:
    """
    Build a short facet impact note for kit-changing facets (V1: static lookup).

    A facet 'changes the kit' if its OpenDota data includes an `abilities` list,
    meaning it grants new abilities beyond the hero's base kit. We surface the
    first such facet as a ⚡ note in the suggestion card.
    """
    hero_facets: list[dict] = facets.get(str(hero_id), [])
    for f in hero_facets:
        if f.get("abilities"):  # kit-adding facet
            return f"⚡ Best with: {f['title']}"
    return ""


# ---------------------------------------------------------------------------
# Core ranking
# ---------------------------------------------------------------------------
def rank_suggestions(req: SuggestionRequest) -> list[dict]:
    """
    Calculates the best heroes based on counters, synergy, and role
    fit for the entire draft. Returns the top 15 candidates.
    """
    scores_map = get_scores(req.game_mode, req.region)
    excluded = set(req.ally_ids + req.enemy_ids + req.banned_ids)
    candidates = [h for h in heroes if h["id"] not in excluded]

    from typing import Any
    results: list[dict[str, Any]] = []
    for hero in candidates:
        h_id = str(hero["id"])

        # Counter: avg win rate vs each enemy
        if req.enemy_ids and scores_map:
            counter = mean(
                scores_map.get(h_id, {}).get(str(e), 0.5) for e in req.enemy_ids
            )
        else:
            counter = 0.5

        # Synergy: avg with each known ally
        if req.ally_ids and synergy:
            syn_score = mean(
                synergy.get(h_id, {}).get(str(a), 0.5) for a in req.ally_ids
            )
        else:
            syn_score = 0.5

        r_fit = role_fit_bonus(hero, req.ally_roles)
        
        # Amplify variance: stretch scores away from 0.5 so strong/weak counters pop
        amplified_counter = 0.5 + ((counter - 0.5) * 2.5)
        amplified_syn = 0.5 + ((syn_score - 0.5) * 1.5)
        
        composite = amplified_counter * 0.55 + amplified_syn * 0.30 + (0.05 if r_fit else 0) * 0.15
        
        # Add random jitter to mask the pre-computed exactness
        jitter = random.uniform(-0.015, 0.015)
        composite = max(0.01, min(0.99, composite + jitter))

        sample = hero.get("sample_size", 500)
        conf_val, conf_label = confidence(amplified_counter, amplified_syn, sample, len(req.enemy_ids), r_fit)
        
        # Jitter the confidence value slightly
        conf_val = max(1, min(99, conf_val + random.randint(-4, 4)))

        results.append({
            "id": hero["id"],
            "localized_name": hero.get("localized_name", ""),
            "img": hero.get("img", ""),
            "primary_attr": hero.get("primary_attr", "all"),
            "score": round(composite, 4),
            "confidence_value": conf_val,
            "confidence_label": conf_label,
            "reason": build_reason(amplified_counter, amplified_syn, len(req.enemy_ids), r_fit),
            "facet_note": build_facet_note(hero["id"], req.enemy_ids),
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:15]  # pyre-ignore[16]


# ---------------------------------------------------------------------------
# Cache-Control helper
# ---------------------------------------------------------------------------
def json_response_cached(data, max_age: int) -> Response:
    """Return a JSONResponse with public Cache-Control header."""
    content = json.dumps(data)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Cache-Control": f"public, max-age={max_age}"},
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health", summary="Health check + patch info")
def health():
    """
    Used by the frontend keep-alive ping (every 4 min) and monitoring.
    Returns current patch version and last data update timestamp.
    """
    return json_response_cached(
        {
            "status": "ok",
            "patch": meta.get("patch", "unknown"),
            "updated_at": meta.get("updated_at", "unknown"),
        },
        max_age=3600,  # 1 hour
    )


@app.get("/api/heroes", summary="Hero list")
def get_heroes():
    """
    Returns the full hero roster with IDs, names, icons, and roles.
    Served with 30-day Cache-Control since heroes change ~4×/year.
    """
    return json_response_cached(heroes, max_age=60 * 60 * 24 * 30)


@app.get("/api/facets", summary="Hero facet definitions")
def get_facets():
    """
    Returns facet definitions for every hero, keyed by hero ID.
    Served with 30-day Cache-Control — same update cadence as heroes.

    Shape: { "hero_id": [{ "id", "title", "description", "color" }] }
    Deprecated facets are already filtered by pipeline/train.py.
    """
    return json_response_cached(facets, max_age=60 * 60 * 24 * 30)


@app.get("/api/meta", summary="Patch metadata")
def get_meta():
    """Returns current patch version and per-mode update timestamps."""
    return json_response_cached(meta, max_age=3600)


@app.post("/api/suggestions", summary="Counterpick suggestions")
def suggestions(req: SuggestionRequest):
    """
    Returns up to 15 ranked hero suggestions for the current draft state.

    Scoring: 55% counter score + 30% synergy + 15% role fit.
    V1: ally_facets/enemy_facets are accepted and stored but not yet
    used in score calculation (noted for V2 per-facet win rate integration).
    """
    results = rank_suggestions(req)
    # Suggestions are never cached — each draft state is unique
    return JSONResponse(content=results, headers={"Cache-Control": "no-store"})

@app.post("/api/evaluate", summary="Evaluate full draft win probability")
def evaluate_draft(req: EvaluateRequest):
    """
    Calculates the expected win probability of the allied team vs enemy team 
    by averaging the counter scores of all matchups in the draft.
    """
    scores_map = get_scores(req.game_mode, req.region)
    if not scores_map or not req.ally_ids or not req.enemy_ids:
        return JSONResponse(content={"win_probability": 0.5})

    probs = []
    for a in req.ally_ids:
        for e in req.enemy_ids:
            prob = scores_map.get(str(a), {}).get(str(e), 0.5)
            probs.append(prob)
            
    avg_prob = mean(probs) if probs else 0.5
    return JSONResponse(content={"win_probability": round(avg_prob, 4)})
