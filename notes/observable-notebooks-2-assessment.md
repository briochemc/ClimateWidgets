# "A new Observable" (Notebooks 2.0) — assessment for ClimateWidgets

*Written 2026-09-02. Decision: stay on Observable Framework; no changes made.*

## What the announcement is

[A new Observable](https://observablehq.com/@observablehq/a-new-observable) announces **Observable Notebooks 2.0**, a product line separate from Observable Framework (which this repo uses):

- An **open, HTML-based notebook file format**: a `<notebook>` root element with one `<script>` per cell; cell types include JS, TypeScript, Markdown, HTML, SQL, TeX, Graphviz, Python, R.
- **Vanilla JavaScript/TypeScript** instead of Observable JS — standard ES imports, top-level await, `html` instead of `htl.html`.
- **Observable Notebook Kit** (open source, npm `@observablehq/notebook-kit`): a CLI (`notebooks preview|build|download|query`) and a **Vite plugin** for building static sites from these notebooks, with `npm:`/`jsr:`/`observable:` resolvers, themes (including `light-dark(...)` pairs), data loaders and database drivers.
- **Observable Desktop** (macOS editor for local notebook files) and a rebuilt **observablehq.com** editor (now the platform default), both built on Notebook Kit, with AI features.

## What it means for this repo

**Nothing mandatory.** Framework is a distinct product; the announcement contains no deprecation of Framework and no migration guidance. This repo is on Framework 1.13.4 — still the latest release.

**But the trajectory is clear:** as of September 2026, Framework has had no feature release since March 2026 (dependency bumps only; repo not archived), while Notebook Kit ships actively. Observable's public focus is Notebooks 2.0 and Canvases. Framework is effectively in maintenance mode, though community commentary frames the two as coexisting products rather than a replacement.

**Migration exposure is low.** The Framework coupling here is shallow:

- No data loaders, no `Inputs`/`Mutable`/`Generators`, no `npm:` imports, no inline `${...}` markdown expressions.
- All six widgets are plain ES modules that run buildless (proven by `embed/*.html` and the jsDelivr script-tag embed path, which bypasses Framework entirely).
- What Framework actually provides: page shell/theme (`air`), sidebar/search/pager chrome, `FileAttachment` resolution, cross-block dataflow, hashed asset copying, and the stable `/<widget>/embed` URLs.
- Notebook Kit has **no equivalent multi-page site chrome** today (no sidebar/search/pager); recreating it would need a custom page template. In practice this matters little here: the homepage card gallery (plain HTML/CSS, fully portable — only ~20 lines of Framework CSS variables and `grid`/`card` utility classes to inline) is the real navigation.
- A migration would take roughly a day, with the risk concentrated in: the 8 embed pages' front matter + `#observablehq-*` CSS overrides; the stable public URLs `/embed`, `/embed-simple`, `/<widget>/embed`; and `scripts/take-thumbnails.sh` assuming `dist/<name>/embed.html`.

**Moodle embeds are safe under any migration.** The script-tag snippet loads `widget.js` and its data from jsDelivr straight out of the repo — no build tool involved. The iframe snippet just points at `https://briochemc.github.io/ClimateWidgets/<widget>/embed` and keeps working as long as any builder produces pages at those exact URLs. The copy-pastable HTML would be character-for-character identical in 2.0.

**Collections** are a hosted-observablehq.com feature, not part of Notebook Kit static builds — irrelevant to this self-hosted site.

**AI / Claude subscription:** Observable's online and Desktop AI is their own metered service (no bring-your-own-key, no Claude subscription support). But Notebooks 2.0 is local-first — plain HTML files editable with any tool, including Claude Code on one's own subscription — so the historical reason to avoid the platform (online-only editing) no longer applies. Framework and Notebook Kit are equivalent on this axis.

## Decision

**Stay on Framework 1.13.4.** Revisit if any of these happen:

1. Framework stops receiving even maintenance releases.
2. Notebook Kit gains multi-page site chrome (navigation/search across pages).
3. Observable posts official Framework migration guidance.

Optional in the meantime: use Observable Desktop for prototyping new widgets; keep new page and widget code in vanilla-ES-module style (already the norm here) so everything stays portable to the Notebooks 2.0 format.

## Sources

- [Observable Notebooks 2.0 Technology Preview](https://observablehq.com/notebook-kit/)
- [Notebook Kit documentation](https://observablehq.com/notebook-kit/kit)
- [Try the new Observable today (forum announcement)](https://talk.observablehq.com/t/try-the-new-observable-today/10698)
- [Previewing Observable Notebooks 2.0 (forum)](https://talk.observablehq.com/t/previewing-observable-notebooks-2-0/10483)
- [Tom MacWright: Observable Notebooks 2.0](https://macwright.com/2025/07/31/observable-notebooks-2)
- [Simon Willison's notes](https://simonwillison.net/2025/Aug/6/observable-notebooks-20/)
- [notebook-kit discussion #113 (AI workflows)](https://github.com/observablehq/notebook-kit/discussions/113)
