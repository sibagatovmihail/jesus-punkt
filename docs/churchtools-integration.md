# ChurchTools API — Integration Plan

Goal from the docx: the team updates content **once in ChurchTools** (flyer, Termine, Gruppen) and the website reflects it automatically. This plan maps every dynamic element of the Heritage Gold pages to a ChurchTools (CT) source, defines the auth/caching architecture, and stages the rollout.

Assumed instance: `https://<gemeinde>.church.tools` (CT hosted) with the standard REST API (`/api/*`, OpenAPI at `/api/docs`).

## 1. Architecture

```
Browser ──> /api/* (serverless proxy, e.g. Vercel functions) ──> ChurchTools REST API
             │  - holds the CT login token (env var, never in the client)
             │  - shapes CT responses into the small JSON the components need
             │  - caches: Cache-Control s-maxage=300, stale-while-revalidate=3600
             └─ on failure: client keeps the statically rendered fallback content
```

- **Auth:** create a dedicated read-only CT user ("website"), give it *view* permission only on the public calendars/groups, generate a permanent **login token**. The proxy sends `Authorization: Login <token>`. Never expose the token client-side; never use a personal account.
- **Why a proxy (not direct fetch):** hides the token, solves CORS, lets us cache (CT rate limits), and decouples the markup from CT schema changes.
- **Client contract:** each dynamic region in the HTML carries `data-ct="<slot>"`; `js/ct.js` (phase 2) fetches `/api/<slot>`, renders into the slot, and silently leaves the pre-rendered mock/fallback content when the fetch fails. Mock payloads in `data/mock/*.json` define the exact response shapes.

## 2. Element → endpoint map

| Page element (slot) | CT source | Endpoint(s) | Notes |
|---|---|---|---|
| **Sonntags-Flyer** (`data-ct="flyer"`, homepage Veranstaltungen; später auch Next-Steps-Seite) | File attached to the next Sunday service **appointment** | `GET /api/calendars/{id}/appointments?from=&to=` → appointment `id` → `GET /api/files/appointment/{id}` | Workflow für das Team: Flyer-Bild einfach an den Gottesdienst-Termin (oder einen fixen Serien-Termin „Flyer") anhängen — genau der im docx gewünschte Ablauf. Proxy liefert die Datei-URL + Alt-Text (Dateiname), wählt das neueste Attachment. |
| **Veranstaltungen rows** (`data-ct="events"`) | Public calendars | `GET /api/calendars` (einmalig, IDs konfigurieren) · `GET /api/calendars/{ids}/appointments?from=today&to=+21d` | Map → `{weekday, date, time, title, meta}`. Erste Zeile = nächster Termin → accent row. Nur öffentliche Kalender (Gottesdienst, Elevate, Gebet, …). |
| **„Alle Termine im Kalender"** | CT public calendar page | Link auf `/events/veranstaltungen/` (eigene Seite, gleiche `/api/events?days=90`-Quelle) | Kein iframe-Embed — Design bleibt konsistent. |
| **Predigten cards** (`data-ct="sermons"`) | Primär **YouTube** (Streams @jesuspunkt), CT nur falls Predigt-Modul gepflegt wird | YouTube Data API v3: `playlistItems` der Uploads/Streams-Playlist → `{date, title, speaker, thumbnail, url}` | Speaker aus Videobeschreibung (Konvention: erste Zeile „Name · Rolle"). Proxy-Route `/api/sermons?limit=9`. Thumbnail ersetzt den grauen Platzhalter der Cards. |
| **Kleingruppen/Hauskreise list** (`data-ct="groups"`) | CT groups | `GET /api/groups?group_type_ids[]=<Hauskreis>` + `GET /api/publicgroups` (Anmeldeformular-Links) | Map → `{name, meeting: "dienstags · 19:30", signupUrl}`. Treffzeit aus Gruppen-Feld „Treffzeit" (Konvention festlegen) oder `information`. |
| **Elevate-Kalender** (Jugend-Subpage) | CT calendar „Opendoor" | wie events, aber calendar-ID Opendoor; docx: *nur* Opendoor-Termine | Feld „Wann?": statisch „Jeden Freitag 18:30–21:30, außer Ferienzeit". |
| **Next-Steps-Flyer** (Subpage) | wie Sonntags-Flyer | gleiche Flyer-Route mit anderem Termin/Serie | docx: Termine via CT-Flyer statt festem Datum. |
| **Team-Seite** (optional, Phase 3) | CT persons/groups | `GET /api/groups/{leitungsteam}/members` + `GET /api/persons/{id}` (+avatar) | Nur wenn Fotos/Rollen in CT gepflegt werden; sonst statisch. |
| Hero times / Kontakt / Footer | statisch | — | Ändert sich selten; bewusst nicht dynamisch (Performance, Robustheit). |

## 3. Response shaping (proxy contracts)

```jsonc
// GET /api/events  → data/mock/events.json ist das Referenzformat
{ "events": [ { "id": 123, "weekday": "So", "date": "29. Jun", "time": "10:00",
                "title": "Gottesdienst", "meta": "Kruseshofer Str. 20 · vor Ort und im Livestream",
                "highlight": true } ] }

// GET /api/flyer
{ "url": "/api/flyer/file", "alt": "Flyer Sonntagsgottesdienst", "updated": "2026-07-01T09:12:00Z" }

// GET /api/sermons?limit=9
{ "sermons": [ { "date": "15. Jun 2026", "title": "Kirche neu erleben",
                 "speaker": "Philipp Strauch · Pastor", "thumb": "https://i.ytimg.com/...",
                 "url": "https://youtu.be/..." } ] }

// GET /api/groups
{ "groups": [ { "name": "Oststadt", "meeting": "dienstags · 19:30", "signupUrl": "https://..." } ] }
```

Dates are pre-formatted German strings server-side (`Intl.DateTimeFormat('de-DE')`) so the client stays dumb and the design's exact date shapes ("So 29. Jun", "15. Jun 2026") are guaranteed.

## 4. Failure & cache behavior

- Proxy caches per route (5 min events/flyer, 30 min sermons/groups) + `stale-while-revalidate`.
- Client fetch timeout 4s; on error/timeout the pre-rendered static content stays — the site never shows an empty or broken section.
- Flyer file is streamed through the proxy (`/api/flyer/file`) so CT auth stays server-side; long-cache with the file's mtime as ETag.

## 5. Rollout phases

1. **Now (done):** static homepage with `data-ct` markers + `data/mock/*.json` reference shapes.
2. **Wire-up:** deploy on Vercel; add `api/events.js`, `api/flyer.js`, `api/sermons.js`, `api/groups.js`; env `CT_BASE_URL`, `CT_TOKEN`, `YT_API_KEY`, `CT_CAL_IDS`, `CT_FLYER_APPOINTMENT`; add `js/ct.js` hydration (progressive enhancement, ~60 lines).
3. **Team conventions in CT:** Flyer als Anhang am Gottesdienst-Termin; Kalender-Sichtbarkeit prüfen; Gruppenfeld „Treffzeit"; YouTube-Beschreibungskonvention für Speaker.
4. **Subpages:** Veranstaltungs-Kalenderseite, Elevate (Opendoor), Next-Steps-Flyer, optional Team aus CT.

## 6. Open questions for the team

- CT-Instanz-URL + wer legt den API-User an? (Zugriff auf info@jesus-punkt.de läuft laut docx noch über Günther.)
- Welche Kalender sind öffentlich freigegeben (Gottesdienst, Elevate/Opendoor, Gebet, Hauskreise)?
- Wird das CT-Predigt-/Beiträge-Modul gepflegt, oder bleibt YouTube die Predigtquelle?

## Content-Pflege (Kurationsstrategie)

**Grundsatz: ChurchTools ist die einzige Pflegeoberfläche für alles, was sich wöchentlich ändert.**
Termine, Flyer, Predigten, Hauskreise und Personen/Rollen werden dort gepflegt, wo das Team
ohnehin täglich arbeitet — niemand muss ein neues System lernen. Die Website liest diese Daten
nur (Endpoint-Map oben); `js/data.js` rendert sie in die `data-ct`-Slots.

| Inhalt | Pflegeort | Wer |
|---|---|---|
| Termine / Kalender | ChurchTools Kalender | Sekretariat / Bereichsleiter |
| Flyer | Anhang am Sonntags-Termin | Sekretariat |
| Predigten | YouTube (Proxy zieht Metadaten) | Technik-Team |
| Hauskreise | ChurchTools Gruppen | Hauskreis-Koordination |
| Team-Seite (Personen + Rollen) | ChurchTools Personen/Gruppenrollen | Gemeindeleitung |
| Statische Texte (Hero, Werte, Glaube …) | Repo (Entwickler) | Website-Team |

**Bewusst NICHT geplant:** ein vollwertiges Headless-CMS (Strapi, Sanity, Contentful).
Gründe: zweites System neben ChurchTools (doppelte Pflege, Drift), Hosting-/Lizenzkosten,
Einarbeitung. Statische Texte ändern sich selten genug, dass der Weg über das Website-Team
schneller ist als jede CMS-Schulung.

**Ausbau beschlossen → siehe `docs/cms-integration-plan.md`:** ein Git-basiertes Mini-CMS
(Sveltia) für statische Texte und die Team-Seite, kombiniert mit dem CT-Proxy auf einem
Cloudflare Worker. Der Plan dort ersetzt Abschnitt 1/5 dieser Datei, wo sie sich widersprechen
(Worker statt Vercel; ISO-Daten statt vorformatierter Strings).
