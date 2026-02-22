"""
Aegis Pick — ML Training Pipeline
===================================
Trains three separate matchup models (ranked, cm, turbo) and writes
pre-computed score JSON files to data/{mode}/.

Caching:
  heroes.json and facets.json are only re-fetched if older than 30 days
  (or if --force is passed). Matchup files are patch-keyed; a new patch
  automatically triggers a full retrain via GitHub Actions.

Usage:
  python pipeline/train.py              # all modes, skip if fresh
  python pipeline/train.py --force      # retrain regardless of age
  python pipeline/train.py --mode ranked
"""
from __future__ import annotations

import argparse
import json
import time
from collections import deque
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import requests
from sklearn.ensemble import GradientBoostingRegressor
from joblib import dump as joblib_dump

DATA = Path(__file__).parent.parent / "data"
API_BASE = "https://api.opendota.com/api"

# ── Hero data cache TTL ──────────────────────────────────────────────────────
HERO_CACHE_DAYS = 30

REGIONS = ["SEA", "CN", "EU", "NA", "SA", "EEU", "ME"]

REGION_MAP = {
    1: "US_WEST", 2: "US_EAST", 3: "EU_WEST", 4: "EU_EAST",
    5: "RUSSIA", 6: "SEA", 7: "SA", 8: "DUBAI",
    9: "AUSTRALIA", 10: "SOUTH_AFRICA", 11: "CHINA", 12: "CHINA2",
}

REGION_GROUP = {
    "US_WEST": "NA", "US_EAST": "NA",
    "EU_WEST": "EU", "EU_EAST": "EEU", "RUSSIA": "EEU",
    "SEA": "SEA", "AUSTRALIA": "SEA",
    "SA": "SA",
    "DUBAI": "ME",
    "CHINA": "CN", "CHINA2": "CN",
}

BRACKET_PRIORITY = {
    "herald": 1, "guardian": 2, "crusader": 3, "archon": 4,
    "legend": 5, "ancient": 6, "divine": 7, "immortal": 8,
}

GAME_MODE_FILTERS = {
    "ranked": {"game_mode": [22, 1], "significant": 1},
    "cm":     {"game_mode": [2],     "significant": 1},
    "turbo":  {"game_mode": [23],    "significant": 0},
}


# ── Rate limiter ─────────────────────────────────────────────────────────────
# OpenDota public API: 60 calls/minute (unauthenticated).
# We cap at RATE_LIMIT_CALLS per RATE_LIMIT_WINDOW seconds with a small margin.

RATE_LIMIT_CALLS  = 58          # stay 2 under the hard cap for safety
RATE_LIMIT_WINDOW = 60.0        # seconds
_call_times: deque[float] = deque()  # timestamps of recent calls


def _rate_limit_wait() -> None:
    """
    Block until we are below RATE_LIMIT_CALLS within the rolling window.
    Prunes timestamps older than RATE_LIMIT_WINDOW before checking.
    """
    while True:
        now = time.monotonic()
        # Evict timestamps outside the current window
        while _call_times and now - _call_times[0] >= RATE_LIMIT_WINDOW:
            _call_times.popleft()

        if len(_call_times) < RATE_LIMIT_CALLS:
            _call_times.append(now)
            return  # safe to proceed

        # Window is full — sleep until the oldest call falls out
        sleep_for = RATE_LIMIT_WINDOW - (now - _call_times[0]) + 0.05
        print(f"  [rate-limit] window full ({len(_call_times)}/{RATE_LIMIT_CALLS}), "
              f"sleeping {sleep_for:.1f}s...")
        time.sleep(sleep_for)


# ── HTTP helper ───────────────────────────────────────────────────────────────

def api_get(path: str, params: dict | None = None) -> Any:
    """
    GET from OpenDota API.

    Features:
    - Sliding-window rate limiter (58 calls/60s) applied BEFORE every request
    - 429 responses: immediate 65s back-off then retry (resets the window)
    - Other failures: exponential back-off (5s, 10s, 15s) then give up
    - Returns None if all attempts fail (caller handles missing data gracefully)
    """
    url = f"{API_BASE}{path}"
    for attempt in range(4):
        _rate_limit_wait()  # ensure we respect the rate limit before every call
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code == 429:
                retry_after = int(r.headers.get("Retry-After", 65))
                print(f"  [429] Rate limited. Backing off {retry_after}s before retry...")
                # Drain the rate-limit window so subsequent calls don't rush
                _call_times.clear()
                time.sleep(retry_after)
                continue  # retry without counting this as a failed attempt
            r.raise_for_status()
            return r.json()
        except requests.exceptions.HTTPError:
            raise  # already handled 429; other HTTP errors fall through
        except Exception as e:
            wait = 5 * (attempt + 1)
            print(f"  [warn] {url} attempt {attempt+1} failed: {e} — retrying in {wait}s")
            time.sleep(wait)
    print(f"  [error] {url} failed after all retries, skipping.")
    return None


# ── Cache helpers ─────────────────────────────────────────────────────────────

def _is_fresh(path: Path, max_age_days: int) -> bool:
    """Return True if file exists and is younger than max_age_days."""
    if not path.exists():
        return False
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return datetime.now(tz=timezone.utc) - mtime < timedelta(days=max_age_days)


# ── Hero fetch (cache-aware) ──────────────────────────────────────────────────

def fetch_heroes(force: bool = False) -> list[dict]:
    """
    Fetch hero list from OpenDota.
    Skips fetch and returns cached data if heroes.json is < HERO_CACHE_DAYS old.
    """
    heroes_path = DATA / "heroes.json"
    if not force and _is_fresh(heroes_path, HERO_CACHE_DAYS):
        print(f"  Heroes cached ({heroes_path.stat().st_mtime:.0f}), skipping fetch.")
        return json.loads(heroes_path.read_text())

    print("  Fetching hero list from OpenDota...")
    raw = api_get("/heroes") or []
    stats = api_get("/heroStats") or []
    stats_map = {h["id"]: h for h in stats}

    heroes: list[dict] = []
    for h in raw:
        s = stats_map.get(h["id"], {})
        heroes.append({
            "id": h["id"],
            "localized_name": h.get("localized_name", ""),
            "primary_attr": h.get("primary_attr", "agi"),
            "img": f"https://cdn.cloudflare.steamstatic.com{h.get('img', '')}",
            "icon": f"https://cdn.cloudflare.steamstatic.com{h.get('icon', '')}",
            "attack_type": h.get("attack_type", "Melee"),
            # win rates per bracket from heroStats (1=herald … 8=immortal)
            **{f"{b}_{k}": s.get(f"{b}_{k}", 0 if k == "win" else 1)
               for b in range(1, 9) for k in ("pick", "win")},
            "pro_win": s.get("pro_win", 0),
            "pro_pick": s.get("pro_pick", 1),
            "sample_size": s.get("8_pick", 500),
        })

    DATA.mkdir(parents=True, exist_ok=True)
    heroes_path.write_text(json.dumps(heroes, indent=2))
    print(f"  {len(heroes)} heroes written to {heroes_path}")
    return heroes


# ── Facet fetch (cache-aware) ─────────────────────────────────────────────────

def fetch_facets(heroes: list[dict], force: bool = False) -> dict[str, list[dict]]:
    """
    Fetch and clean hero facet definitions from /constants/hero_abilities.

    Returns { "hero_id": [{ id, title, description, color, abilities? }] }

    Filtering rules:
      - Skip facets where deprecated is truthy (string "true", "1", True, bool True)
      - Skip facets with empty title (removed/placeholder facets)
      - Keep abilities list for kit-changing facets (used in facet_note logic)
    """
    facets_path = DATA / "facets.json"
    if not force and _is_fresh(facets_path, HERO_CACHE_DAYS):
        print(f"  Facets cached, skipping fetch.")
        return json.loads(facets_path.read_text())

    print("  Fetching facet data from OpenDota /constants/hero_abilities...")
    raw: dict = api_get("/constants/hero_abilities") or {}

    # Build hero_name → hero_id lookup
    # Note: backslashes not allowed inside f-string expressions in Python < 3.12;
    # extract the apostrophe character to a plain variable first.
    _apos = "'"
    name_to_id: dict[str, int] = {
        f"npc_dota_hero_{h['localized_name'].lower().replace(' ', '_').replace(_apos, '')}": h["id"]
        for h in heroes
    }
    # OpenDota uses the npc_ name as keys; we fall back to matching via localized
    # name, but the API key is the actual npc name like "npc_dota_hero_antimage"
    # Build a second map from npc name directly from hero data
    for h in heroes:
        # heroStats give us the npc_name via localized_name transformations
        # but heroes endpoint gives us npc_name-based img path like "/apps/dota2/images/dota_react/heroes/antimage_vert.jpg"
        # Extract hero slug from img: "/apps/dota2/images/.../heroes/{slug}_vert.jpg"
        img = h.get("img", "")
        parts = img.split("/heroes/")
        if len(parts) == 2:
            slug = parts[1].replace("_vert.jpg", "").replace("_full.png", "")
            npc_key = f"npc_dota_hero_{slug}"
            name_to_id[npc_key] = h["id"]

    facets: dict[str, list[dict]] = {}

    for npc_name, hero_data in raw.items():
        hero_id = name_to_id.get(npc_name)
        if hero_id is None:
            continue  # unknown hero, skip

        raw_facets: list[dict] = hero_data.get("facets", [])
        cleaned: list[dict] = []

        for f in raw_facets:
            # Filter out deprecated facets
            dep = f.get("deprecated", False)
            if dep and str(dep).lower() not in ("false", "0", ""):
                continue
            title = f.get("title", "")
            if not title:  # blank placeholder facet
                continue

            entry: dict = {
                "id": f["id"],
                "title": title,
                "description": f.get("description", ""),
                "color": f.get("color", "Gray"),
            }
            # Keep abilities list for kit-changing facet detection
            if f.get("abilities"):
                entry["abilities"] = f["abilities"]

            cleaned.append(entry)

        if cleaned:
            facets[str(hero_id)] = cleaned

    facets_path.write_text(json.dumps(facets, indent=2))
    print(f"  Facet data for {len(facets)} heroes written to {facets_path}")
    return facets


# ── Matchup + synergy fetches ─────────────────────────────────────────────────

def fetch_all_matchups(heroes: list[dict]) -> dict[int, dict]:
    """Fetch per-hero matchup data from /heroes/{id}/matchups."""
    matchups: dict[int, dict] = {}
    total = len(heroes)
    for i, hero in enumerate(heroes):
        hid = hero["id"]
        print(f"  Matchups {i+1}/{total} — {hero['localized_name']}")
        data = api_get(f"/heroes/{hid}/matchups") or []
        matchups[hid] = {
            m["hero_id"]: {
                "wins": m.get("wins", 0),
                "games_played": m.get("games_played", 1),
            }
            for m in data
        }
        time.sleep(0.1)  # respect rate limits
    return matchups


def fetch_synergy(heroes: list[dict]) -> dict[str, dict[str, float]]:
    """
    Approximate synergy scores.
    OpenDota does not expose ally pair win rates via the public API.
    Seeded with 0.5 (neutral) for V1; extend in V2 with match-level parsing.
    """
    hero_ids = [str(h["id"]) for h in heroes]
    syn = {hid: {eid: 0.5 for eid in hero_ids} for hid in hero_ids}
    print("  Synergy seeded with 0.5 (extend with match-level combos in V2).")
    return syn


# ── ML training ───────────────────────────────────────────────────────────────

def build_training_matrix(heroes: list[dict], matchups: dict, mode: str):
    """Build (X, y, weights) arrays for GradientBoostingRegressor."""
    rows_X, rows_y, weights_w = [], [], []
    hero_map = {h["id"]: h for h in heroes}
    ATTR_ENC = {"agi": 0, "str": 1, "int": 2, "all": 3}

    for h_a_id, a_matchups in matchups.items():
        a_data = hero_map.get(h_a_id, {})
        for h_b_id, mu in a_matchups.items():
            games = mu.get("games_played", 0)
            if games < 20:
                continue
            b_data = hero_map.get(h_b_id, {})
            raw_wr = mu["wins"] / games

            for bracket in range(1, 9):
                a_wr = (a_data.get(f"{bracket}_win", 0) /
                        max(a_data.get(f"{bracket}_pick", 1), 1))
                rows_X.append([
                    h_a_id, h_b_id, bracket,
                    ATTR_ENC.get(a_data.get("primary_attr", "agi"), 0),
                    ATTR_ENC.get(b_data.get("primary_attr", "agi"), 0),
                    games, a_wr,
                ])
                rows_y.append(raw_wr)
                weights_w.append(1.0 if mode == "turbo" else float(bracket))

    X = np.array(rows_X, dtype=float)
    y = np.array(rows_y, dtype=float)
    w = np.array(weights_w, dtype=float)
    return X, y, w


def precompute_and_save(model: Any, heroes: list[dict], mode: str, patch: str):
    """Run model on every hero pair and write matchup_scores_{region}_{patch}.json."""
    hero_ids = [str(h["id"]) for h in heroes]
    hero_map = {str(h["id"]): h for h in heroes}
    ATTR_ENC = {"agi": 0, "str": 1, "int": 2, "all": 3}
    regions = REGIONS if mode == "ranked" else ["global"]
    mode_dir = DATA / mode
    mode_dir.mkdir(parents=True, exist_ok=True)

    for region in regions:
        scores: dict[str, dict] = {}
        for h_a_id in hero_ids:
            a_data = hero_map[h_a_id]
            scores[h_a_id] = {}
            for h_b_id in hero_ids:
                if h_a_id == h_b_id:
                    scores[h_a_id][h_b_id] = 0.5
                    continue
                b_data = hero_map[h_b_id]
                feat = np.array([[
                    int(h_a_id), int(h_b_id), 8,
                    ATTR_ENC.get(a_data.get("primary_attr", "agi"), 0),
                    ATTR_ENC.get(b_data.get("primary_attr", "agi"), 0),
                    500,
                    a_data.get("8_win", 0) / max(a_data.get("8_pick", 1), 1),
                ]])
                scores[h_a_id][h_b_id] = round(float(model.predict(feat)[0]), 4)

        # Patch-keyed filename: matchup_scores_SEA_7.37e.json
        # Backend loads the latest file via glob; old files kept as fallback
        out = mode_dir / f"matchup_scores_{region}_{patch}.json"
        out.write_text(json.dumps(scores))
        print(f"  Saved {out}")


# ── Entry point ───────────────────────────────────────────────────────────────

def run(modes: list[str], force: bool):
    print("=== Aegis Pick Training Pipeline ===")
    DATA.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Heroes (cache-aware) ──────────────────────────────────────────
    heroes = fetch_heroes(force=force)
    print(f"  {len(heroes)} heroes available.")

    # ── Step 2: Facets (cache-aware) ──────────────────────────────────────────
    facets = fetch_facets(heroes, force=force)
    print(f"  Facets loaded for {len(facets)} heroes.")

    # ── Step 3: Determine current patch ───────────────────────────────────────
    meta_path = DATA / "meta.json"
    meta: dict = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    patch = meta.get("patch", "unknown")
    print(f"  Current patch: {patch}")

    # ── Step 4: Matchup data ──────────────────────────────────────────────────
    print("Fetching matchup data (this may take several minutes)...")
    matchups = fetch_all_matchups(heroes)

    # ── Step 5: Synergy ───────────────────────────────────────────────────────
    print("Computing synergy scores...")
    synergy = fetch_synergy(heroes)
    (DATA / "synergy_scores.json").write_text(json.dumps(synergy))

    # ── Step 6: Per-mode training ──────────────────────────────────────────────
    now = datetime.now(timezone.utc).isoformat()
    for mode in modes:
        print(f"\n--- Training: {mode} ---")
        X, y, w = build_training_matrix(heroes, matchups, mode)
        if len(X) == 0:
            print(f"  No training data for {mode}, skipping.")
            continue
        print(f"  {len(X)} samples. Training GBR...")
        model = GradientBoostingRegressor(
            n_estimators=300, max_depth=4, learning_rate=0.05, subsample=0.8,
            random_state=42,
        )
        model.fit(X, y, sample_weight=w)
        precompute_and_save(model, heroes, mode, patch)
        model_path = DATA / mode / "model.pkl"
        joblib_dump(model, model_path)
        print(f"  Model saved: {model_path}")
        meta[f"{mode}_updated_at"] = now

    # ── Step 7: Update meta ───────────────────────────────────────────────────
    meta["updated_at"] = now
    meta["modes_updated"] = modes
    meta_path.write_text(json.dumps(meta, indent=2))

    print("\n=== Pipeline complete. Commit data/ to trigger backend redeploy. ===")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Aegis Pick training pipeline")
    parser.add_argument(
        "--mode", choices=["ranked", "cm", "turbo", "all"], default="all",
        help="Which mode to train (default: all)"
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Skip cache checks and re-fetch hero/facet data"
    )
    args = parser.parse_args()

    modes = ["ranked", "cm", "turbo"] if args.mode == "all" else [args.mode]
    run(modes=modes, force=args.force)
