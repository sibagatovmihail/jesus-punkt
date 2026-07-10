#!/usr/bin/env python3
"""Generate the /en/ and /uk/ page trees from the German source pages.

German markup is the single source of truth. Dictionaries in data/i18n/<loc>.json
map the exact German string (whitespace-normalized) to its translation; anything
without an entry stays German (visible fallback, warned about, never broken).

Usage:
  python3 tools/i18n-build.py                       # local preview (origin http://localhost:8000)
  python3 tools/i18n-build.py --origin <url>        # CI: absolute origin for hreflang links
  python3 tools/i18n-build.py --patch-de            # CI only: inject hreflang into German pages
  python3 tools/i18n-build.py --extract             # dump untranslated German strings
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ["en", "uk"]
PAGES = {  # source file -> locale-relative page path ('' = home)
    "index.html": "",
    "ueber-uns/index.html": "ueber-uns/",
    "events/index.html": "events/",
    "gemeindeleben/index.html": "gemeindeleben/",
    "angebote/index.html": "angebote/",
    "spenden/index.html": "spenden/",
    "kontakt/index.html": "kontakt/",
}
# Impressum/Datenschutz stay German-only; asset paths must never be prefixed.
LOCALIZED_LINKS = ("ueber-uns/", "events/", "gemeindeleben/", "angebote/", "spenden/", "kontakt/")
TRANSLATABLE_ATTRS = ("alt", "aria-label", "content", "placeholder", "title")
TAG_RE = re.compile(r"(<[^>]*>)")
# strings that are correct untranslated — silences the fallback warning
IGNORE = {
    "Jesus Punkt", "ELEVATE", "Elevate Youth", "YouTube", "Facebook", "Instagram", "PayPal",
    "Kruseshofer Str. 20", "17036 Neubrandenburg", "Kruseshofer Str. 20 · 17036 Neubrandenburg",
    "+49 156 79133367", "info@jesus-punkt.de", "VIA Movement e.V.",
    "Jesus Punkt · VIA Movement e.V.", "DE·· ···· ···· ···· ···· ··", "IBAN",
    "DE", "EN", "UK", "Deutsch", "English", "Українська", "Made by viasmedia",
    "Website",  # honeypot label (visually hidden)
    "Impressum", "Datenschutz",  # legal links point at German pages — labels stay German
    "Philipp Strauch", "Tymur Sheikh", "Arne Brockmann", "Lydia Wegner", "Anja Maas",
    "Claus Wittnebel", "Ulrike Huhn", "Günther Seidt", "Saskia Lobert", "Yurii Uglov",
    "Lydia Wegner &amp; Anja Maas", "Claus, Philipp, Mykhailo &amp; Natan",
    "Annette &amp; Rainer Dwornik", "Ruth &amp; Stephan Fuhrer", "Simeon Schütz",
    "Friederike &amp; Claus", "Oststadt", "Innenstadt", "Broda", "Süd",
    "Welcome Home", "Spende Jesus Punkt", "Weißes Kreuz Beratungsstelle",
    "© 2026 Jesus Punkt", "© 2026 Jesus Punkt ·", "Elevate Youth",
    # sermon fallback cards — German recordings keep German titles
    "Kirche neu erleben", "Mehr als Sonntag", "Der Herr ist mein Hirte", "Neuanfang",
    "Die Freude an Gott", "Philipp Strauch · Pastor",
    "Gott sei Dank und Ehre!", "→", "·", "©", "01", "02", "03", "04", "05", "06", "07",
}
# date-ish fallback strings that JS re-renders locale-aware at runtime
IGNORE_RE = re.compile(r"^(\w{2} \d{2}\. \w{3}|\d{2}\. \w{3} 2026)$")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def has_words(s: str) -> bool:
    if IGNORE_RE.match(s):
        return False
    return len(re.findall(r"[A-Za-zÄÖÜäöüß]", s)) >= 3


CONTENT_KEYS: set = set()  # keys merged from data/content — used by the bake/JS, not (only) markup


def load_dict(loc: str) -> dict:
    p = ROOT / "data" / "i18n" / f"{loc}.json"
    table = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    merge_content_translations(table, loc)
    return table


def merge_content_translations(table: dict, loc: str) -> None:
    """CMS content (data/content/*.json, Sveltia single-file i18n layout) carries its
    own translations per field — merge each German value → locale value pair into the
    table so CMS-managed strings can never produce fallback warnings."""
    def walk(de_node, loc_node):
        if isinstance(de_node, dict):
            for k, v in de_node.items():
                walk(v, loc_node.get(k) if isinstance(loc_node, dict) else None)
        elif isinstance(de_node, list):
            for i, v in enumerate(de_node):
                walk(v, loc_node[i] if isinstance(loc_node, list) and i < len(loc_node) else None)
        elif isinstance(de_node, str) and isinstance(loc_node, str) and de_node.strip() and loc_node.strip():
            table.setdefault(norm(de_node), loc_node)
            CONTENT_KEYS.add(norm(de_node))

    for p in sorted((ROOT / "data" / "content").glob("*.json")):
        data = json.loads(p.read_text(encoding="utf-8"))
        if "de" in data:
            walk(data["de"], data.get(loc, {}))


def split_segments(html: str):
    """Yield (is_tag, chunk) preserving everything; skips nothing yet."""
    for chunk in TAG_RE.split(html):
        yield (chunk.startswith("<"), chunk)


def translate_page(html: str, loc: str, page: str, table: dict, origin: str, report: dict) -> str:
    out = []
    in_skip = 0  # inside <script>/<style>
    for is_tag, chunk in split_segments(html):
        if is_tag:
            low = chunk.lower()
            if low.startswith(("<script", "<style")):
                in_skip += 1
            elif low.startswith(("</script", "</style")):
                in_skip = max(0, in_skip - 1)
            out.append(process_tag(chunk, loc, page, table, report))
            continue
        if in_skip or not chunk.strip():
            out.append(chunk)
            continue
        key = norm(chunk)
        if key in table:
            lead = chunk[: len(chunk) - len(chunk.lstrip())]
            tail = chunk[len(chunk.rstrip()):]
            out.append(lead + table[key] + tail)
            report["used"].add(key)
        else:
            if has_words(key) and key not in IGNORE:
                report["missing"].add(key)
            out.append(chunk)
    html = "".join(out)

    html = html.replace('<html lang="de">', f'<html lang="{loc}">', 1)
    html = inject_hreflang(html, page, origin)
    return html


def process_tag(tag: str, loc: str, page: str, table: dict, report: dict) -> str:
    # translatable attributes
    def attr_sub(m):
        name, val = m.group(1), m.group(2)
        key = norm(val)
        if key in table:
            report["used"].add(key)
            return f'{name}="{table[key]}"'
        if has_words(key) and key not in IGNORE and name != "content":
            report["missing"].add(key)
        return m.group(0)

    tag = re.sub(r'\b(' + "|".join(TRANSLATABLE_ATTRS) + r')="([^"]*)"', attr_sub, tag)

    # language switcher links: fix active state, never prefix
    if "data-lang-link" in tag:
        tag = tag.replace(" is-active", "").replace('is-active ', '')
        tag = re.sub(r'class="([^"]*)"', lambda m: f'class="{m.group(1)}"', tag)
        if f'hreflang="{loc}"' in tag:
            tag = re.sub(r'class="((?:nav-panel__lang-link|lang-switch__link|nav-pill__lang-link)[^"]*)"',
                         r'class="\1 is-active"', tag)
        return tag

    # internal page links -> locale tree
    def href_sub(m):
        href = m.group(1)
        if href == "/" or href.startswith(tuple("/" + p for p in LOCALIZED_LINKS)):
            return f'href="/{loc}{href}"'
        return m.group(0)

    if tag.lower().startswith("<a "):
        tag = re.sub(r'href="([^"]*)"', href_sub, tag)
    return tag


def hreflang_block(page: str, origin: str) -> str:
    de = f"{origin}/{page}"
    return (
        f'  <link rel="alternate" hreflang="de" href="{de}">\n'
        f'  <link rel="alternate" hreflang="en" href="{origin}/en/{page}">\n'
        f'  <link rel="alternate" hreflang="uk" href="{origin}/uk/{page}">\n'
        f'  <link rel="alternate" hreflang="x-default" href="{de}">\n'
    )


def inject_hreflang(html: str, page: str, origin: str) -> str:
    if 'rel="alternate"' in html:
        return html
    return html.replace("</head>", hreflang_block(page, origin) + "</head>", 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--origin", default="http://localhost:8000")
    ap.add_argument("--patch-de", action="store_true", help="inject hreflang into the German pages (CI only)")
    ap.add_argument("--extract", action="store_true", help="list German strings missing from the dictionaries")
    args = ap.parse_args()
    origin = args.origin.rstrip("/")

    warnings = 0
    for loc in LOCALES:
        table = load_dict(loc)
        report = {"used": set(), "missing": set()}
        for src, page in PAGES.items():
            html = (ROOT / src).read_text(encoding="utf-8")
            result = translate_page(html, loc, page, table, origin, report)
            dest = ROOT / loc / src
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(result, encoding="utf-8")
        unused = set(table) - report["used"] - CONTENT_KEYS  # content keys serve the bake/JS, not (only) markup
        if args.extract:
            for s in sorted(report["missing"]):
                print(f"[{loc}] MISSING: {s}")
        else:
            for s in sorted(report["missing"]):
                print(f"WARN [{loc}] untranslated (German fallback shown): {s[:90]}", file=sys.stderr)
                warnings += 1
        for s in sorted(unused):
            print(f"WARN [{loc}] unused dictionary key: {s[:90]}", file=sys.stderr)
        print(f"[{loc}] {len(PAGES)} pages generated · {len(report['used'])} strings translated"
              f" · {len(report['missing'])} fallbacks · {len(unused)} unused keys")

    if args.patch_de:
        for src, page in PAGES.items():
            p = ROOT / src
            html = p.read_text(encoding="utf-8")
            p.write_text(inject_hreflang(html, page, origin), encoding="utf-8")
        print("[de] hreflang injected into source pages (deploy artifact only!)")


if __name__ == "__main__":
    main()
