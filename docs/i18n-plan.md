# Übersetzung / i18n Plan — Deutsch · English · Українська

> **Status 2026-07-07: T1–T3 executed.** Generator `tools/i18n-build.py`, dictionaries
> `data/i18n/{en,uk}.json` (173 strings each), switcher in header/menu/footer, hreflang,
> locale-aware `js/data.js`/`js/main.js`, Arimo-Cyrillic subset for uk. Open: native review
> of the uk/en copy (§7) and the Gottesdienst-translation question (§9.1).

Companion to `cms-integration-plan.md` (editing architecture) and `churchtools-integration.md`
(dynamic data). Goal: the site speaks **German (source of truth), English, and Ukrainian** —
without tripling maintenance or forking the markup.

Audience reality check: Ukrainian is not a nice-to-have here — part of the Gemeinde (and of the
team) is Ukrainian-speaking; English serves internationals/students. German remains the default
at `/`.

---

## 1 · Principles

1. **German markup is the single source.** `/en/` and `/uk/` are *generated*, never hand-edited —
   a layout fix lands once and ships in all three languages.
2. **Every string lives in exactly one place** (`data/i18n/*.json`); a missing key fails the
   build loudly and falls back to German, never to an empty node.
3. **Dynamic ChurchTools content stays honest:** we translate what we control (recurring event
   types, all UI), and clearly label what stays German (sermons, custom event titles).
4. Legal pages (**Impressum, Datenschutz**) remain German-only — linked unchanged from every
   locale (standard practice; a translated Impressum has no legal value).

## 2 · URLs & routing

```
/                → de (default, unchanged URLs — no /de/ prefix, no redirects, no SEO reset)
/en/…            → English mirror of every page (same directory structure)
/uk/…            → Ukrainian mirror
```

- `<html lang="de|en|uk">` per tree; `hreflang` alternate links (`de`, `en`, `uk`,
  `x-default → de`) in every head; localized `<title>`/`meta description`; one sitemap.
- No automatic IP/Accept-Language redirects — a visible switcher beats guessing (and GitHub
  Pages couldn't do it anyway). Optional later: one line of JS on `/` suggesting `/uk/` via a
  dismissible hint when `navigator.language` starts with `uk`.

## 3 · Architecture: generate at deploy (extends the existing bake step)

Same mechanism, same workflow file as the CMS bake (`.github/workflows/pages.yml`):

1. Translatable elements carry `data-i18n="nav.events"` markers; the checked-in German text
   doubles as fallback and as the extraction reference. (Pages already marked `data-content`
   for the CMS reuse the same key space — one marker system, two dictionaries.)
2. `data/i18n/de.json` is generated/verified from the markup (extraction script, CI check —
   guarantees no orphan keys). `en.json` / `uk.json` hold the translations.
3. The deploy step renders each German page twice more into `/en/` and `/uk/`: replaces marked
   text, sets `lang`, rewrites internal links (`/ueber-uns/` → `/en/ueber-uns/`), injects
   hreflang + localized meta, marks the switcher's active language.
4. Local dev unchanged: the repo serves German; `python3 tools/i18n-build.py` previews locales.

**Considered and rejected:** hand-copied page trees (3× drift on every change); client-side JS
translation (SEO, flash, no-JS); migrating to a static site generator (rewrites a working
codebase — revisit only if a fourth language or heavy content growth arrives).

URL slugs stay German in all locales (`/en/ueber-uns/`) — stable IDs, zero mapping complexity;
the visible navigation is what's translated. (Localized slugs are a possible later vanity step.)

## 4 · Dynamic content (data.js)

`js/data.js` becomes locale-aware via `document.documentElement.lang` — small, contained changes:

- **Dates:** the existing `Intl.DateTimeFormat('de-DE', …)` formatters take the page locale
  (`en-GB`, `uk-UA`). Already possible thanks to the ISO `start` refactor. „So 12. Juli" →
  “Sun 12 July” → «нд 12 липня».
- **Recurring events translate by `type`:** `gottesdienst → Service / Богослужіння`,
  `jugend → Youth night / Молодіжка`, `gebet → Prayer / Молитва`, `hauskreis → Home group /
  Домашня група` — titles *and* the standard meta lines. Custom CT titles (e.g. „Gemeindegrillen")
  pass through in German — correct, because the event itself happens in German.
- **Sermons stay German** (they are German recordings); the section intro in en/uk says so
  („Predigten auf Deutsch / проповіді німецькою — субтитри YouTube можуть допомогти").
- Calendar month label, empty-month message, aria-labels: from the i18n dictionaries.

## 5 · Typography — the Cyrillic problem (hard blocker, check first)

- **Raveo** (display) and **Sinkin Sans** (body) almost certainly ship **no Cyrillic glyphs**;
  **Arimo does** (full Cyrillic, Arial-metric). Task 0 of the Ukrainian phase: glyph-coverage
  audit (`fonttools ttx` on the woff2 files).
- Strategy if coverage is missing (expected): per-locale font stacks — `:root[lang="uk"]`
  overrides `--font-display`/`--font-body` to a Cyrillic-capable pairing (candidates with the
  right character: *Unbounded* or *Golos Text* for display, *Golos Text*/Arimo for body — both
  OFL, self-hostable, subset to Cyrillic+Latin). English runs on the existing fonts untouched.
- Fallback until then: `uk` uses Arimo for everything — correct, readable, launchable.

## 6 · Language switcher UX

- **Desktop:** compact `DE · EN · UK` text switcher right of the nav pill (same 75%-white chip
  treatment on scroll); active locale ink + gold dot — the pattern the nav already uses.
- **Mobile:** a row in the fullscreen menu above the Livestream CTA, full-width tap targets.
- **Footer:** repeated as plain links (crawlability + reachability without JS).
- Switching keeps the current page (`/gemeindeleben/` ↔ `/uk/gemeindeleben/`), no cookies.

## 7 · Translation workflow & ownership

1. **Glossary first** (one page, decided once, by Gemeindeleitung + native speakers):
   Gottesdienst, Hauskreis, Kleingruppe, Lobpreis, Gebet, „Welcome Home“, the seven Werte.
   Theological terms are identity — they must not drift per page.
2. Machine-drafted translations (whole dictionary in one pass) → **native review**: Ukrainian
   in-house (team has native speakers), English by a designated reviewer.
3. Sensitive texts (**Glaube/creed, the seven Werte**) get explicit Gemeindeleitung sign-off.
4. Ongoing: a new/changed German string lands as a `TODO:` value in `en/uk.json` → build warns;
   the site ships with German fallback until the translation lands. CMS phase 3+ : Sveltia's
   native i18n shows DE/EN/UK fields side-by-side, so editors keep locales in sync in one form.

## 8 · Phases & effort

| Phase | Scope | Effort |
|---|---|---|
| **T1 — foundation** | marker pass over all pages, extraction script, `de.json`, generator step in the workflow, switcher UI, hreflang/meta plumbing; ship `/en/` (English fully reviewed) | 2–3 days |
| **T2 — Ukrainian** | font audit → per-locale stacks (subset + self-host if needed), `uk.json` translated + native review, layout pass for text expansion (nav widths, event rows, wheel bubble names, fact strips) | 1.5–2 days + review time |
| **T3 — dynamic polish** | `data.js` locale dates + type-based event translation, localized calendar/aria strings | 0.5 day |
| **T4 — CMS merge** | i18n fields in Sveltia config (depends on CMS phase 3), editor guide update | 0.5 day |

T1+T2 are independent of the ChurchTools go-live and can precede or follow it.

## 9 · Open questions for the team

1. **Is there Ukrainian translation during the Gottesdienst** (headsets/liveübersetzung)? This
   changes the uk landing copy fundamentally — it's the #1 thing a Ukrainian visitor needs to know.
2. Who is the English reviewer? Ukrainian review: which native speakers own the glossary?
3. Scope check: all six pages in en/uk, or launch uk with home + events + kontakt first?
4. Budget/appetite for a proper Cyrillic display font vs. the pragmatic Arimo fallback?

## 10 · Risks

- **Cyrillic font gap discovered late** → it's Task 0, before any translation work.
- **Text expansion breaks tight spots** (nav, wheel bubbles ~14 chars max, event-row dates) →
  the T2 layout pass tests with the longest real strings, not lorem ipsum.
- **Stale translations after German edits** → build-time key diff, `TODO` warnings, German
  fallback — the site is never *wrong*, at worst partially German.
- **Tone drift in sensitive texts** → glossary + sign-off rule (§7).
