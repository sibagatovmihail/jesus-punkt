#!/usr/bin/env python3
"""Fetch upcoming events from the public ChurchTools calendars into data/ct/events.json.

The jp.church.tools instance exposes its public calendars (2 "Öffentlicher Kalender",
3 "Kinder & Jugend") to anonymous readers, so no token is needed. Runs at deploy
(plus a daily cron in pages.yml) — the site never fetches ChurchTools directly
(no CORS on the API). Output shape == data/mock/events.json (the documented contract);
js/data.js falls back to the mock, then to the static markup, if this file is missing.

Usage: python3 tools/ct-events.py  (writes data/ct/events.json; exits non-zero on failure)
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

BASE = "https://jp.church.tools/api"
CALENDAR_IDS = [2, 3]          # public calendars (verified anonymous-readable 2026-07-09)
DAYS_AHEAD = 90
BERLIN = ZoneInfo("Europe/Berlin")

# CT appointment titles → the site's canonical event types/titles/metas
# (these exact strings drive the en/uk translation maps in js/data.js — keep in sync)
KNOWN = [
    ("gottesdienst", "gottesdienst", "Gottesdienst", "Kruseshofer Str. 20 · vor Ort und im Livestream"),
    ("elevate", "jugend", "Elevate Jugend", "Für Jugendliche zwischen 13 und 29 Jahren"),
    ("gebet", "gebet", "Gebet", "Gemeinsames Gebet · alle sind willkommen"),
    ("hauskreis", "hauskreis", "Hauskreis-Abend", "In Wohnzimmern in ganz Neubrandenburg"),
]


def classify(raw_title: str, subtitle: str | None) -> tuple[str, str, str]:
    low = raw_title.lower()
    for needle, ctype, title, meta in KNOWN:
        if needle in low:
            return ctype, title, meta
    return "sonstiges", raw_title.strip(), (subtitle or "").strip()


def extract_flyer(payload: dict, out_dir: Path, now: datetime) -> None:
    """Flyer convention: the team sets an IMAGE on an appointment in a public calendar —
    either one titled "Flyer" (dedicated carrier) or the next Gottesdienst. If such an
    image is exposed in the anonymous payload, download it and write flyer.json
    (data/mock/flyer.json stays the fallback when nothing is found)."""
    def img_url(base):
        img = base.get("image")
        if isinstance(img, dict):
            return img.get("fileUrl") or img.get("url") or img.get("imageUrl")
        if isinstance(img, str) and img.startswith("http"):
            return img
        return None

    candidates = []
    for item in payload.get("data", []):
        base = item.get("appointment", {}).get("base", {})
        calc = item.get("calculated", {})
        url = img_url(base)
        if not url:
            continue
        title = (base.get("title") or "").lower()
        rank = 0 if "flyer" in title else (1 if "gottesdienst" in title else 2)
        candidates.append((rank, calc.get("startDate") or "", url, base.get("title", "Flyer")))
    if not candidates:
        print("ct-events: no appointment image found — flyer keeps its fallback")
        return

    candidates.sort()
    _, _, url, title = candidates[0]
    req = urllib.request.Request(url, headers={"Accept": "image/*"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
        ctype = resp.headers.get("Content-Type", "")
    ext = {"image/png": ".png", "image/webp": ".webp"}.get(ctype.split(";")[0], ".jpg")
    (out_dir / f"flyer-aktuell{ext}").write_bytes(data)
    (out_dir / "flyer.json").write_text(
        json.dumps({
            "url": f"data/ct/flyer-aktuell{ext}",
            "alt": f"Aktueller Flyer: {title}",
            "updated": f"{now:%Y-%m-%dT%H:%M:%SZ}",
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"ct-events: flyer updated from appointment image ({len(data) // 1024} KB)")


def main() -> int:
    now = datetime.now(timezone.utc)
    params = [("calendar_ids[]", str(i)) for i in CALENDAR_IDS] + [
        ("from", now.date().isoformat()),
        ("to", (now + timedelta(days=DAYS_AHEAD)).date().isoformat()),
    ]
    url = f"{BASE}/calendars/appointments?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.load(resp)

    events = []
    for item in payload.get("data", []):
        base = item.get("appointment", {}).get("base", {})
        calc = item.get("calculated", {})
        start_utc = calc.get("startDate") or base.get("startDate")
        if not start_utc:
            continue
        start = (
            datetime.fromisoformat(start_utc.replace("Z", "+00:00"))
            .astimezone(BERLIN)
            .replace(tzinfo=None)
        )
        ctype, title, meta = classify(base.get("title", ""), base.get("subtitle"))
        events.append({
            "id": f"ct-{base.get('id')}-{start:%Y%m%d}",
            "start": start.isoformat(),
            "type": ctype,
            "title": title,
            "meta": meta,
        })

    if not events:
        print("ct-events: API returned 0 events — refusing to overwrite", file=sys.stderr)
        return 1

    events.sort(key=lambda e: e["start"])
    out = Path(__file__).resolve().parent.parent / "data" / "ct" / "events.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        extract_flyer(payload, out.parent, now)
    except Exception as exc:  # flyer is best-effort — never fail the events fetch over it
        print(f"ct-events: flyer extraction failed ({exc}) — fallback stays", file=sys.stderr)
    out.write_text(
        json.dumps(
            {
                "_source": f"jp.church.tools calendars {CALENDAR_IDS}, fetched {now:%Y-%m-%dT%H:%MZ}",
                "events": events,
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"ct-events: wrote {len(events)} events → {out.relative_to(out.parent.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
