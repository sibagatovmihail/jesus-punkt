#!/usr/bin/env python3
"""Fetch the latest sermons from a YouTube playlist into data/ct/sermons.json.

Same pattern as tools/ct-events.py: runs at deploy (plus the daily cron in
pages.yml), no client-side API key, no CORS problem. Output shape ==
data/mock/sermons.json (the documented contract); js/data.js falls back to
the mock, then to the static markup, if this file is missing.

Needs two GitHub Actions repo secrets:
  YT_API_KEY      — Google Cloud API key with the YouTube Data API v3 enabled
  YT_PLAYLIST_ID  — the "Streams" (or Uploads) playlist to pull from

Speaker convention (docs/churchtools-integration.md): first line of the video
description reads "Name · Rolle" — anything else and the field stays empty.

Usage: python3 tools/yt-sermons.py  (writes data/ct/sermons.json; exits non-zero on failure)
"""
from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://www.googleapis.com/youtube/v3/playlistItems"
LIMIT = 9
BERLIN = ZoneInfo("Europe/Berlin")
MONTHS_DE = [
    "", "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
]


def german_date(iso: str) -> str:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(BERLIN)
    return f"{dt.day:02d}. {MONTHS_DE[dt.month]} {dt.year}"


def extract_speaker(description: str) -> str:
    first_line = (description or "").strip().splitlines()[0].strip() if description else ""
    return first_line if " · " in first_line else ""


def main() -> int:
    api_key = os.environ.get("YT_API_KEY")
    playlist_id = os.environ.get("YT_PLAYLIST_ID")
    if not api_key or not playlist_id:
        print("yt-sermons: YT_API_KEY / YT_PLAYLIST_ID not set — skipping, mock stays the fallback", file=sys.stderr)
        return 1

    params = {
        "part": "snippet",
        "playlistId": playlist_id,
        "maxResults": str(LIMIT),
        "key": api_key,
    }
    url = f"{API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.load(resp)

    sermons = []
    for item in payload.get("items", []):
        snippet = item.get("snippet", {})
        video_id = snippet.get("resourceId", {}).get("videoId")
        published = snippet.get("publishedAt")
        if not video_id or not published:
            continue
        thumbs = snippet.get("thumbnails", {})
        thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url")
        sermons.append({
            "date": german_date(published),
            "title": snippet.get("title", "").strip(),
            "speaker": extract_speaker(snippet.get("description", "")),
            "thumb": thumb,
            "url": f"https://youtu.be/{video_id}",
        })

    if not sermons:
        print("yt-sermons: playlist returned 0 videos — refusing to overwrite", file=sys.stderr)
        return 1

    sermons.sort(key=lambda s: s["date"], reverse=True)
    now = datetime.now(timezone.utc)
    out = Path(__file__).resolve().parent.parent / "data" / "ct" / "sermons.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "_source": f"YouTube playlist {playlist_id}, fetched {now:%Y-%m-%dT%H:%MZ}",
                "sermons": sermons[:LIMIT],
            },
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )
    print(f"yt-sermons: wrote {len(sermons)} sermons → {out.relative_to(out.parent.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
