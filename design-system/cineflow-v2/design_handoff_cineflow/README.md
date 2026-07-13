# Handoff: Loboflix — Design System & App Build

## Overview
Loboflix is a premium, dark-first mobile app that answers one question: **"Which film should I watch tonight?"** Users add films to a personal list; the app builds a smart schedule based on free evenings, film runtimes, preferences, and history. Each film carries poster, backdrop, synopsis, YouTube trailer, IMDb / Rotten Tomatoes / audience ratings, streaming availability, runtime, genres, director, and cast.

The visual target: the calm, glassy, poster-led feel of Apple TV — but focused on personal organization, with Loboflix's own identity (Apple-TV electric-blue accent over a warm near-black canvas).

## About the design files
The files in this bundle are **design references created in HTML** — a living design-system document showing the intended look, tokens, and component behavior. They are **not production code to copy directly.** Your task is to **recreate these designs in the target app's environment** using its established patterns and libraries. If no codebase exists yet, choose the most appropriate stack for a premium mobile app (e.g. React Native / Expo, SwiftUI, or Flutter) and implement there.

- `Loboflix Design System.dc.html` — the full documentation (foundations + components + patterns). Open in a browser to see everything rendered. It uses a lightweight custom runtime (`support.js`); ignore the runtime — read it for the **design intent**, tokens, and component specs.
- `tokens.json` — **machine-readable design tokens.** This is the source of truth for colors, type, spacing, radius, elevation, grid, motion, and iconography. Wire these into your app's theme system first.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and motion are final. Recreate the UI faithfully using your codebase's component library, mapping each token in `tokens.json` to your theme layer.

## How to consume this handoff (recommended order)
1. Load `tokens.json` into your theme system as two theme objects (`dark`, `light`) with identical keys. Dark is the default.
2. Build the primitives: typography styles, spacing scale, radius scale, elevation/shadows.
3. Build shared components (see Components below).
4. Assemble the screens (see Screens below).
5. Apply motion and accessibility rules last, per component.

---

## Design tokens
See `tokens.json` for exact values. Summary:

- **Themes:** `dark` (default, canonical) and `light`. Same token names; switch via a single `data-theme` (or equivalent) at the root — no component markup changes.
- **Accent:** electric blue — dark `#0A84FF`, light `#0071E3`. Used ONLY for the single primary action per screen, active states, focus rings, and links. Do not spread it.
- **Neutrals:** warm near-black stack in dark (`#0B0B0E` → `#22222B`); warm off-white stack in light (`#F5F3EF` → `#FFFFFF`).
- **Semantic** (success/warning/danger/info) reserved for status only. Amber `#E9A23B` is IMDb/warning — keep it distinct from the accent.
- **Spacing:** 8-point base with a 4px half-step. Never use arbitrary values.
- **Radius:** xs 4 · sm 8 · md 12 (posters/cards) · lg 18 (sheets/modals) · xl 28 (hero/player) · full 999.
- **Type:** Space Grotesk (display/headings), Hanken Grotesk (body/UI), JetBrains Mono (data/labels). All from Google Fonts.
- **Motion:** durations 100/200/320/480ms; standard easing `cubic-bezier(0.2,0,0,1)`; spring for poster tap & FAB.

---

## Components
All components draw exclusively from tokens — no component invents its own color, spacing, or radius. Each has default / hover / pressed / focused / disabled states unless noted.

- **Button** — variants: Primary (accent fill, dark text), Secondary (elevated surface + border), Tertiary (text only), Danger (danger outline), Disabled. Sizes: Small 36 / Medium 44 (default, min touch) / Large 56 (full-width in sheets & detail CTAs). Radius sm–md. Verb-first labels. **One Primary per screen.**
- **IconButton** — 44px min hit area, visible container in dark UI. Radius sm or full.
- **FAB** — 56px, accent fill, radius-full, elevation with subtle accent glow. Hosts the single global action "Add a film". Present on Home & Library.
- **Cards:**
  - `Card/Poster` — 2:3 poster (radius-md) + title + meta line; optional saved-star overlay top-right. Used in rails & grids.
  - `Card/Movie/Horizontal` — 76×114 poster + title + meta + up to 2 rating chips + trailing add button. Library lists & search results.
  - `Card/Schedule` — 16:9 backdrop with bottom scrim + "TONIGHT" pill + title + time/runtime/streaming + full-width primary CTA. The Home hero.
- **Badges & Ratings:**
  - `Rating` — chip per source: star + score + source label (IMDb amber, RT green, audience blue). Interactive "your rating" = 5 accent stars.
  - `Badge/Streaming/*` — neutral pill + service-color dot (no logo lockups). Netflix/Prime/Disney+/Max/Apple TV+.
  - `Badge/Status` — overline pills (NEW/WATCHED/SCHEDULED) + numeric & dot badges for counts/unseen.
- **Chips** — filter/genre pills; selected = accent fill, unselected = surface+border; removable variant has trailing ✕. Horizontal scroll, never wrap on mobile.
- **Inputs:** text field (default/focused with accent ring + 3px glow / error with danger border + message); `Input/Search` (prominent, with add button); `Dropdown` (select + menu popover, elevation-2); `Calendar` & date picker (accent pill = selected day, accent dot = day with a scheduled film).
- **Navigation:** `TabBar` (bottom, frosted glass, 4 items max: Home/Schedule/Library/Profile; active = filled icon + accent label; FAB overlaps center); `AppBar` (back chevron + title + trailing actions); `ProgressBar` (accent fill on surface track).
- **Overlays:** `BottomSheet` (preferred on mobile — slides up 320ms/decelerate, scrim to 72%, drag-to-dismiss with rubber-band); `Dialog` (center, elevation-3, for destructive confirms); `Snackbar` (actionable, undo, 5s); `Toast` (info, 3s).
- **Feedback:** `Skeleton` (shimmer, in the exact shape of incoming content — preferred over spinners); `Spinner` (accent, full-screen blocking loads only); `EmptyState` (one line-icon in soft container + one warm sentence + one action).
- **Content blocks:** `HeroBanner` (full-bleed backdrop + gradient scrims + title/ratings + Play trailer CTA); `Carousel` (horizontal poster rail, next poster peeks); `Avatar` (accent-gradient initials / icon / stacked group); `List` (icon · title · description · trailing control); `Divider` (1px border.subtle, 24px inset).
- **FloatingPlayer:** `Player/Mini` (docks above tab bar; poster thumb + title + play/close + progress; swipe down to dismiss) and `Player/Expanded` (16:9 YouTube trailer + full controls; expands from mini via shared-element transition).

---

## Screens / Views
Every screen: contextual top bar → scrolling content column on the 4-col mobile grid → persistent bottom tab bar. Content leads, chrome is thin, one primary action per view.

- **Home** — "Tonight's pick" HeroBanner above the fold → "Continue your week" carousel → recommended rails. FAB present.
- **Schedule** — week strip / calendar on top (accent dots on scheduled days) → the day's planned films as `Card/Schedule`. Tapping a day opens a bottom sheet to assign/swap a film.
- **Library** — pinned search + filter chips → 3-up poster grid (denser on tablet/desktop). FAB present.
- **Detail** — full-bleed backdrop (parallax, 0.5× scroll, darkens as content rises) → title + ratings → primary CTA (Add to schedule / Play trailer) → synopsis, cast, streaming badges.
- **Profile** — avatar + name → watch stats (films, hours, streak) → taste summary → entry to Settings.
- **Settings** — grouped lists with clear section labels; toggles for reminders, auto-schedule, appearance (theme).

---

## Interactions & behavior
- **Shared-element poster → detail:** tapped poster scales/translates into the detail hero (320ms/standard) while backdrop cross-fades behind. Poster is never re-loaded.
- **Poster press:** scale to 0.96 + slight brightness lift on press-down (100ms), spring back on release.
- **Bottom sheet:** slide up (320ms/decelerate), scrim to 72%, 1:1 drag-to-dismiss with rubber-band at top.
- **Detail parallax:** backdrop scrolls at 0.5× and darkens as the reading surface rises.
- **Tab re-tap:** scroll to top, then to root.
- **Reduced motion:** cross-fades replace all transforms; no parallax/spring/shared-element.

## Navigation model
Flat & shallow. Bottom nav (Home/Schedule/Library/Profile), tab state persists independently. Detail & sheets push over the current tab; back returns via reverse shared-element. Deep links: `loboflix://film/{id}`, `/schedule/{date}`, `/tonight`.

## State (minimum)
- `theme` (dark|light) · `filmList` (saved films + metadata) · `schedule` (date → filmId assignments) · `filters` (active genre/runtime chips + sort) · `player` (current trailer, position, mini|expanded) · `watchHistory` + derived stats.
- Data fetching: film metadata, ratings, streaming availability, and YouTube trailer per film (from your chosen film-data provider, e.g. TMDB).

## Accessibility (ship-blocking)
- All text pairs clear WCAG AA (dark primary clears AAA). Touch targets ≥44px with 8px gaps.
- 3px accent focus ring on every focusable element; logical tab order; ESC closes overlays; arrows move within carousels/calendar.
- Posters carry film title as alt text; rating chips announce "IMDb 8.4 out of 10"; decorative gradients aria-hidden; live regions announce snackbars.
- Dynamic Type to 200% (reflow + graceful truncation, no fixed-height text). Status is never color-only.

## Naming convention
Components `Category/Type/Variant` (e.g. `Button/Primary/Large`, `Card/Movie/Horizontal`, `Badge/Streaming/Netflix`). Tokens dot-notation `role.property.state` (e.g. `color.accent.primary`, `space.4`, `radius.md`). State is a variant property, not part of the name.

## Assets
- Fonts: Space Grotesk, Hanken Grotesk, JetBrains Mono (Google Fonts).
- Icons: Lucide, 1.5px stroke.
- No bundled image assets — posters/backdrops/trailers come from your film-data API at runtime.

## Files in this bundle
- `tokens.json` — design tokens (source of truth).
- `Loboflix Design System.dc.html` — full rendered design-system reference.
- `README.md` — this document (self-sufficient).
