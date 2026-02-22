"""
Watches for new Dota 2 patches and triggers full retraining when detected.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import requests

DATA = Path(__file__).parent.parent / "data"
API_BASE = "https://api.opendota.com/api"


def get_latest_patch() -> str:
    resp = requests.get(f"{API_BASE}/constants/patch", timeout=15)
    resp.raise_for_status()
    patches = resp.json()
    return patches[-1]["name"]


def main():
    meta_path = DATA / "meta.json"
    meta = {}
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())

    stored_patch = meta.get("patch", "0.0")

    try:
        latest_patch = get_latest_patch()
    except Exception as e:
        print(f"Could not fetch latest patch: {e}. Exiting.")
        sys.exit(0)

    print(f"Stored patch: {stored_patch} | Latest patch: {latest_patch}")

    if stored_patch == latest_patch:
        print("No new patch. Nothing to do.")
        sys.exit(0)

    print(f"New patch detected: {stored_patch} → {latest_patch}. Running full retrain...")

    # Update patch in meta first
    meta["patch"] = latest_patch
    DATA.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(meta, indent=2))

    # Trigger full retrain
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "train.py")],
        check=False,
    )
    if result.returncode != 0:
        print("Training failed.")
        sys.exit(1)

    print(f"Retraining complete for patch {latest_patch}.")


if __name__ == "__main__":
    main()
