# CMS × ChurchTools — Integration Plan

Companion to `churchtools-integration.md` (endpoint map, proxy contracts, CT auth). That doc
answers *how the website reads ChurchTools*. This one answers the remaining question: **how does
every kind of content get edited, by whom, in a tool they can learn in minutes — without two
systems fighting over the same data?**

Ground rule (unchanged): **one editing surface per content type, no duplication.**

```
                       ┌───────────────────────────────┐
   weekly content      │  ChurchTools (already in use) │  Termine · Flyer · Hauskreise
   ────────────────►   │  calendars · files · groups   │
                       └──────────────┬────────────────┘
                                      │ read-only token
                       ┌──────────────▼────────────────┐
                       │  API proxy (Cloudflare Worker)│  /events /flyer /groups /sermons
                       │  cache 5–30 min · shapes JSON │◄─── YouTube Data API (Predigten)
                       └──────────────┬────────────────┘
                                      │ fetch at page load (js/data.js, data-ct slots)
                       ┌──────────────▼────────────────┐
   rare content        │  Static site (GitHub Pages)   │
   ────────────────►   │  repo: sibagatovmihail/…      │
   Git-based CMS       │  deploy: GitHub Actions       │  CMS commit → auto-deploy ≈ 1 min
   (browser editor)    └───────────────────────────────┘
```

---

## 1 · Who edits what (target state)

| Content | Changes | Edited in | Reaches the site via | Who |
|---|---|---|---|---|
| Termine / Kalender | weekly | ChurchTools Kalender | proxy `/events` (cache ≤ 5 min) | Sekretariat / Bereichsleiter |
| Sonntags-Flyer | weekly | Anhang am GoDi-Termin in CT | proxy `/flyer` | Sekretariat |
| Predigten | weekly | YouTube-Upload (Beschreibungs­konvention) | proxy `/sermons` | Technik-Team |
| Hauskreise | monthly | ChurchTools Gruppen | proxy `/groups` | Hauskreis-Koordination |
| **Team-Seite** (Namen, Rollen, Fotos) | few ×/year | **CMS** (`data/team.json` + Foto-Upload) | commit → deploy | Gemeindeleitung |
| **Statische Texte** (Hero, Werte, Glaube, Angebote, Spenden-IBAN, Kontakt) | few ×/year | **CMS** (`data/content/*.json`) | commit → bake → deploy | Website-Team |
| Layout / Design / neue Seiten | rare | Repo (Entwickler) | PR → deploy | Entwickler |

**Deliberate change vs. the earlier sketch:** the team page moves to the **CMS permanently**, not
to CT persons. Reason: publishing member photos needs explicit consent (DSGVO); CT profile photos
are internal by default. A CMS-curated `team.json` — where a photo only exists because someone
deliberately uploaded it for the website — is the consent boundary itself. CT stays the source
for *who has which role*; the CMS entry mirrors it in seconds when it changes.

## 2 · CMS choice

Requirements: free · no server to run · edits the repo's JSON/Markdown directly (git = versioning,
rollback, same deploy pipeline) · form-style editor a non-technical person learns in minutes ·
image upload for team/gallery photos.

| | **Sveltia CMS** (recommended) | Pages CMS | Decap CMS |
|---|---|---|---|
| Hosting | one static `/admin/` page in this repo | hosted app (pagescms.org) | static `/admin/` page |
| Auth | GitHub OAuth via tiny Cloudflare Worker | GitHub App (zero infra) | OAuth worker (older) |
| Editor quality | modern, fast, i18n/German UI | clean, simple | dated, quirky |
| Third-party dependency | none (self-hosted) | pagescms.org uptime | none |
| Media uploads | ✓ into `img/` | ✓ | ✓ |

**Recommendation: Sveltia CMS.** It lives at `jesus-punkt.de/admin/`, has a German UI, no external
service to depend on — and its GitHub-OAuth helper is a ~40-line Cloudflare Worker that can live
in the **same Worker** we already need as the ChurchTools proxy (one deployment, two routes).
Fallback if OAuth setup annoys: Pages CMS works with this exact repo layout unchanged — the
`config.yml` content model below transfers 1:1.

## 3 · Content model (what becomes editable)

New folder `data/content/`, one small JSON per page area; `admin/config.yml` defines the form
fields (German labels, hints, required flags):

```
data/content/
  home.json         hero eyebrow parts, hero title + highlight word, section intros
  werte.json        the 7 values: { num, name, line } ×7   ← single source (see §4)
  glaube.json       "Was wir glauben" paragraphs
  angebote.json     offer cards (label, title, text, link)
  spenden.json      Kontoinhaber, IBAN, Verwendungszweck, Anschrift   ← kills the IBAN-TODO
  kontakt.json      phone, mail, service time, address
  team.json         (moved from data/mock/) people: name, roles[], photo, featured, note
img/team/           CMS photo uploads (3:4, consent confirmed via required checkbox field)
```

Editor rules encoded in the config: max lengths where layout is tight (value lines, card titles),
`pattern` for IBAN, required alt-texts for uploads, no rich text anywhere (plain strings only —
the design system owns all formatting).

## 4 · How CMS content reaches the pages: bake at deploy, not fetch at runtime

Static copy must not become JS-rendered (SEO, no-JS fallback, no flash). Instead the **existing
Pages workflow** gets one more step — the same pattern as the path-prefixer already in
`.github/workflows/pages.yml`:

1. Elements carry markers: `<h3 data-content="werte.0.name">Authentisch</h3>` (checked-in HTML
   keeps real copy as fallback — repo stays readable).
2. A ~40-line dependency-free Python step replaces each marked element's text from
   `data/content/*.json` during deploy. Wrong path → build fails loudly, site never half-renders.
3. `js/main.js` reads the Werte lines from a `<script type="application/json">` block the bake
   step injects — removing today's duplication of the 7 value lines (HTML + `LINES` array).

Local dev keeps working with the checked-in fallback copy; the bake only runs in CI. Flow:
**CMS save → commit on `main` → Actions bake + deploy → live in ≈ 1 minute.** Every change is a
commit: who/what/when, one-click revert.

## 5 · ChurchTools side (delta to churchtools-integration.md)

Everything in that doc stands, with two updates:

- **Proxy host = Cloudflare Worker** (not Vercel functions): GitHub Pages hosts no functions, and
  a Worker is independent of wherever the static site lives — it survives the later move to
  jesus-punkt.de unchanged. Free tier (100k req/day) is orders of magnitude above need. Routes:
  `/events`, `/flyer`, `/flyer/file`, `/groups`, `/sermons` + `/oauth` (Sveltia). Env:
  `CT_BASE_URL`, `CT_TOKEN`, `CT_CAL_IDS`, `YT_API_KEY`, `GH_OAUTH_ID/SECRET`.
- **`js/data.js` stays the single client**: go-live = point its URL map at the Worker
  (`https://api.jesus-punkt.de/…`), set `NOW = null`, delete nothing — the mock files remain the
  documented contract + local fixtures. The proxy emits **ISO `start` + `type`** (today's mock
  schema), not the pre-formatted strings from the older doc — date formatting stays client-side
  in `data.js` where it already works (calendar needs real dates anyway).

## 6 · Rollout phases

| Phase | Scope | Effort | Blockers |
|---|---|---|---|
| **0 — done** | mock data layer, `data-ct` slots incl. calendar + team, Pages auto-deploy | — | — |
| **1 — CT live** | Worker proxy: `/events` `/flyer` `/flyer/file` `/groups`; CT read-only user + token; team conventions (Flyer-Anhang, Kalender öffentlich, Feld „Treffzeit"); switch `data.js` URL map | 1–2 days | CT instance URL, API user (§7) |
| **2 — Predigten** | `/sermons` via YouTube Data API (uploads playlist → title/date/speaker/thumbnail); description convention "Name · Rolle" | 0.5–1 day | YT API key |
| **3 — CMS** | Sveltia `/admin/` + OAuth route on the Worker; `data/content/*.json` + `config.yml`; bake step in workflow; move team.json under CMS with photo upload + consent field; 1-page German editor guide with screenshots | 2–3 days | GitHub OAuth app |
| **4 — Domain** | jesus-punkt.de → Pages custom domain; prefix step auto-skips (root); Worker on `api.jesus-punkt.de`; repo → church GitHub org, editors invited with write access | 0.5 day | DNS access |

Sequencing note: **Phase 1 delivers the most visible value** (the docx goal: „einmal in
ChurchTools pflegen") and needs no CMS. Phase 3 is independent and can run in parallel once the
Worker exists.

## 7 · Open decisions (carried + new)

1. CT instance URL + who creates the read-only API user (info@ access is still via Günther).
2. Which calendars are public: Gottesdienst, Elevate/Opendoor, Gebet, Hauskreise?
3. YouTube: who owns the Google Cloud project for the API key?
4. GitHub org for the Gemeinde (repo currently under the personal account) — needed before
   editors get CMS access; also decides who approves the OAuth app.
5. Photo consent process for the team page: form or verbal + checkbox in the CMS entry?

## 8 · Risks & mitigations

- **Drift between CMS copy and checked-in fallback** → bake step fails the build on unknown
  markers; quarterly `diff` check is one command.
- **CT schema/API changes** → only the Worker knows CT shapes; contracts to the client are ours.
- **Worker down** → client keeps pre-rendered fallback content (existing behavior, already tested).
- **Editor breaks layout with long text** → field max-lengths in `config.yml`; no rich text.
- **Token leakage** → token only in Worker env; read-only CT user; rotate on personnel change.
- **Bus factor** → everything is in the repo (incl. this plan); any web developer can take over
  with `git clone` + one page of docs.
