#!/usr/bin/env python3
"""Bake CMS content (data/content/*.json) into the marked HTML elements.

Runs in CI before the i18n build (see .github/workflows/pages.yml). The checked-in
German markup keeps the real copy as a readable fallback; this step overwrites the
text of every element carrying data-content="file.path" with the current German
value from data/content/<file>.json — so a CMS commit reaches the pages without
anyone editing HTML. Unknown markers fail the build loudly: the site never
half-renders.

Extras:
- data-content-href="tel|mailto" also rewrites the element's href from the value.
- `<!-- bake:werte-lines -->` becomes an inline JSON block with the 7 value lines
  in all locales; js/main.js prefers it over its built-in copy.

Content files use the Sveltia i18n single-file layout: {"de": {...}, "en": {...}, "uk": {...}}.
"""
from __future__ import annotations

import html as htmllib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["index.html", "ueber-uns/index.html", "events/index.html", "gemeindeleben/index.html",
         "angebote/index.html", "spenden/index.html", "kontakt/index.html", "impressum/index.html",
         "datenschutz/index.html"]
MARKER_RE = re.compile(r'(<([a-z0-9]+)\b[^>]*\bdata-content="([^"]+)"[^>]*>)(.*?)(</\2>)', re.S)
HREF_RE = re.compile(r'\bhref="[^"]*"')


def load_content() -> dict:
    content = {}
    for p in sorted((ROOT / "data" / "content").glob("*.json")):
        if p.stem == "team":  # rendered by js/data.js, not baked
            continue
        content[p.stem] = json.loads(p.read_text(encoding="utf-8"))
    return content


def resolve(content: dict, key: str, locale: str = "de"):
    file_key, _, path = key.partition(".")
    node = content.get(file_key, {}).get(locale)
    for part in path.split("."):
        if node is None:
            return None
        node = node[int(part)] if isinstance(node, list) else node.get(part) if isinstance(node, dict) else None
    return node


def main() -> int:
    content = load_content()
    errors, replaced = [], 0

    for page in PAGES:
        path = ROOT / page
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")

        def sub(m):
            nonlocal replaced
            open_tag, _, key, inner, close_tag = m.groups()
            if "<" in inner:
                errors.append(f"{page}: marker {key} wraps nested markup — markers are for plain text")
                return m.group(0)
            value = resolve(content, key)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{page}: marker {key} has no value in data/content/")
                return m.group(0)
            href_m = re.search(r'\bdata-content-href="(tel|mailto)"', open_tag)
            if href_m:
                scheme = href_m.group(1)
                target = re.sub(r"[^\d+]", "", value) if scheme == "tel" else value
                open_tag = HREF_RE.sub(f'href="{scheme}:{target}"', open_tag, count=1)
            replaced += 1
            return open_tag + htmllib.escape(value, quote=False) + close_tag

        text = MARKER_RE.sub(sub, text)

        if "<!-- bake:werte-lines -->" in text:
            werte = content.get("werte", {})
            lines = {loc: [v["line"] for v in werte.get(loc, {}).get("values", [])]
                     for loc in ("de", "en", "uk")}
            block = ('<script type="application/json" id="werte-lines">'
                     + json.dumps(lines, ensure_ascii=False) + "</script>")
            text = text.replace("<!-- bake:werte-lines -->", block, 1)
            replaced += 1

        path.write_text(text, encoding="utf-8")

    if errors:
        for e in errors:
            print(f"content-bake: ERROR {e}", file=sys.stderr)
        return 1
    print(f"content-bake: {replaced} slots baked from data/content/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
