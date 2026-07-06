# Jesus Punkt — Project Standards

Rules adopted from the akkermann stroy project, adapted to this codebase.
Design source of truth: `Jesus Punkt — Website (Heritage Gold).fig` (decoded spec in `docs/`).

## Don't Overengineer

- Match effort to the size of the task. A copy edit or one-line CSS fix needs a quick read, not a verification pipeline.
- Reserve heavy verification (running the app, screenshotting, automated checks) for genuinely complex or high-risk changes.

## Core Directive: 1:1 Design Fidelity

- **Strict adherence:** Implement an exact 1:1 copy of the Figma design. Do not add, remove, or "improve" any element.
- **Non-creative mode:** If it is not in the Figma design, it does not belong in the code. New subpages compose existing design-system components (`design-system.html`).
- **Style source:** Use only the tokens defined in `styles/tokens.css`. Never use framework defaults or arbitrary values.
- Exemplar states in the fig (first sermon card's shadow, first Kleingruppen row's grey fill + long arrow, the ink@0.32 carousel chevron) are hover/active/disabled states — implement them as such, not as static one-offs.

## Unit System

| Use | Rule |
|---|---|
| All sizing | `rem` (px ÷ 16) |
| 1px borders / dividers | `px` only exception |
| Viewport-relative | `dvh`, `dvw`, `svh` for hero/full-bleed |
| Never | Hard-coded `px` widths or heights |

## Layout Engines

- **CSS Grid** — page-level structure, multi-column grids (event grid, sermon cards, steps).
- **Flexbox** — component-level: navbar, buttons, event rows, icon+text pairs.
- **Positioning** — `relative` by default; `absolute` only for overlapping layers (hero background, navbar overlay, headline highlight).

## Container Pattern

Every section uses an inner `.container` div — never pad the section itself:

```css
.container {
  max-width: 71.25rem;             /* 1140px — from the fig (1440 − 2×150) */
  margin-inline: auto;
  padding-inline: var(--space-lg); /* 1.5rem — safety padding on small screens */
}
```

Example: `<section class="hero"><div class="container hero__container">…</div></section>`

## Responsive Breakpoints

Use these named tiers consistently across **all** stylesheets:

| Token name | Value | Context |
|---|---|---|
| Desktop | `> 64rem` (1024px) | Full layout — no overrides needed |
| Tablet landscape | `≤ 64rem` | Hamburger replaces the nav pill, 2-up card grids, two-column sections (groups, feature-grid) stack |
| Tablet portrait | `≤ 48rem` | Remaining columns stack, carousel becomes swipe |
| Phone | `≤ 37.5rem` | Type scale drops, buttons full-width where designed |
| Small phone | `≤ 30rem` | Final tightening |

**Never use single-step jumps.** Scale properties progressively across breakpoints. Use `clamp()` for fluid type.

## Header Rules

- Header is **fixed and always transparent** — no full-width strip. After 8px of scroll (`.is-scrolled`, toggled in `js/main.js`) the nav pill and burger get stronger white surfaces (88%) + hairline + shadow; the logo stays surface-free.
- **Hamburger order:** On mobile, hamburger must be the **rightmost** element.
- Nav pill (white 75% + `backdrop-filter: blur(1.25rem)`) is the desktop pattern; the mobile menu is a **fullscreen panel sliding down** with staggered links, no numbering (`html.menu-open` locks scroll — the one sanctioned overflow exception).
- Hover = one `#F9C855` glider pill that slides between links (JS-positioned `.nav-pill__glider`). Current page indicator = ink text + small gold dot after the label, **no background** — set `is-active` on both pill and panel links.

## Interaction Rules

- Every interactive element animates on hover (≤450ms, `--ease`); respect `prefers-reduced-motion`.
- Buttons: primary hovers to **accent** (`#F9C855` + ink text); outline hovers to **ink** fill + creme text; both lift −2px.
- Cards/rows lift with `--shadow-soft`/`--shadow-card`; kleingruppen rows indent + extend their arrow; textlinks slide their arrow.
- The sermon carousel is **full-bleed**: `width: 100vw` breakout, track aligned to the container, overflow visible to the screen edge, `padding-block` + negative margin so hover shadows are never clipped. Carousels init per `.carousel[id]` with `data-carousel-prev/next="<id>"` buttons.
- The Werte section is a **pinned scroll wheel**: sticky 100dvh stage inside a 420vh section (360vh phone), scroll progress steps the ring through all 7 values; tapping a value jumps the scroll position into its segment (seamless while pinned). All bubbles are sand; only the active one turns accent. On phones the wheel is intentionally wider than the screen (stage clips it) and the active bubble moves to the ring's center. `prefers-reduced-motion` collapses it to a static list.
- Tinted (`--creme`) sections are framed by **zig-zag strips** (`.zig--top` / `.zig--bottom`, conic-gradient mask) — a background-color change never happens on a straight line.

## Typography

Self-hosted fonts in `fonts/` (see `styles/tokens.css` for the stacks):

| Role | Font | Usage |
|---|---|---|
| Display / headings / brand text | **Raveo** Bold & Regular | h1–h3, event rows, footer links, eyebrow |
| Body copy | **Sinkin Sans** 300 (body) / 400 (nav) | paragraphs, nav items |
| UI / buttons / small labels | **Arimo** (variable 400–700, Arial-metric) | buttons, role chips, fact keys, legal |

Raveo and Sinkin Sans are copied from the designer's local library — **verify webfont licensing before going live** (see docs/design spec §Fonts).

## HTML Semantics

Use semantic tags: `<header>`, `<main>`, `<section>`, `<nav>`, `<footer>`, `<article>`.
Wrap all text elements (`span`, `p`, headings, `a`) in a `<div>` cover element — apply layout/spacing styles to the cover, not the text node directly. Apply this rule to forms as well.

## Asset Handling

- Images live in `img/`, named for content (`hero-dome.jpg`, not generic names). Strip metadata, verify extension with `file`.
- Logo: `img/logo.png` (light bg) / `img/logo-dark.png` (footer) — exported from the fig at 651×374, displayed at 4.375rem × 2.5rem.
- The hero photo renders under a 50% white wash at 48% opacity — compress it aggressively (visible artifacts are washed out).

## ChurchTools Integration

Dynamic slots are marked in the HTML with `data-ct` attributes (flyer, events + calendar, sermons, kleingruppen, team).
`js/data.js` renders them from `data/mock/*.json` — swapping to live ChurchTools means changing only its URL map. Static markup inside the slots is the no-JS fallback; keep it in sync with the mock data. See `docs/churchtools-integration.md` for the endpoint map, auth model, rollout plan, and the content-curation strategy (Content-Pflege). Do not hardcode content into those slots without keeping the `data-ct` markers.

## Anti-Pattern Guardrails

- No creative additions beyond what the client has asked for — the Werte scroll wheel, the interaction layer, per-page heroes, the events calendar, and the team cards were explicit requests on top of the fig.
- No `px` widths/heights (except 1px borders).
- No Tailwind defaults or framework color palettes.
- No `overflow: hidden` on `<body>` or `<html>` — the single exception is the state-scoped `html.menu-open` scroll lock while the fullscreen menu is open.
- Gold `#C9A227` is decorative/on-dark only — never colored text on light backgrounds below AA (use `--gold-text #7A5F12` / `--gold-meta #AC7A06` for small gold text).

## Repo Layout

```
index.html            homepage
ueber-uns/ events/ gemeindeleben/ angebote/ spenden/ kontakt/ impressum/
                      subpages (directory URLs, shared header/footer shell)
design-system.html    living styleguide (tokens + components)
styles/               tokens.css → base.css → components.css → home.css | pages.css
js/main.js            header state, nav glider, fullscreen nav, carousels, Werte wheel, galleries — no frameworks
js/data.js            renders data-ct slots from data/mock/*.json (swap URL map for live ChurchTools)
img/  fonts/  data/   assets; data/ holds mock JSON mirroring ChurchTools responses
docs/  tools/         design spec, site structure, CT plan · fig parser + screenshot CDP tool
site/                 ARCHIVED v3 prototype (pre-Heritage-Gold) — do not extend
assets/               source material (fig exports, current-site photos, renders)
```

All asset/link paths are **root-absolute** (`/styles/…`, `/img/…`) — serve over HTTP (`python3 -m http.server`), not `file://`. Open TODOs before launch: IBAN on /spenden/, Vereinsregister on /impressum/, Raveo webfont license, real team/gallery/hero photos (current ones are placeholders).
