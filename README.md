# Climate Widgets

Small, self-contained interactive figures for teaching climate science, built with [Observable Framework](https://observablehq.com/framework/) and published at **https://briochemc.github.io/ClimateWidgets/**.

Each widget is one page. The page explains the figure, says where its numbers come from, and ends with a copy-pastable snippet for dropping the widget into your own site or LMS, either as an `<iframe>` or as a `<script type="module">` tag that renders it inline (the module is served from jsDelivr straight out of this repository).

Widgets so far: drawing your own future CO₂ emissions, global temperature trends, daily sea surface temperature, several surveys of what people believe about climate change and what a probability word means to them, black-body radiation, and what the air is made of.

## Running the site locally

You need [Node.js](https://nodejs.org/) (version 18 or later).

```sh
npm install
npm run dev
```

Then open http://localhost:3000. The preview reloads as you edit files under `src/`.

`npm run build` writes the static site to `dist/`. Pushing to `main` deploys it to GitHub Pages through `.github/workflows/deploy.yml`.

## Layout

- `src/<widget>/index.md`: the widget's page, with the prose and the embed snippet.
- `src/<widget>/embed.md`: the same widget with no site chrome, for iframes.
- `src/<widget>/widget.js`: the figure itself, a `create…Widget()` factory that returns a DOM node with a `.value` and fires `input` events, so it works with Framework's `view()` and on its own.
- `src/<widget>/data/`: the committed data the figure draws from.
- `scripts/`: the Julia and Node scripts that produced those data files (never run by the site), and `take-thumbnails.mjs`, which re-captures the homepage cards with `npm run thumbnails` after a build.
- `observablehq.config.js`: the sidebar, one entry per widget.

Most widgets have no runtime dependencies beyond the browser. The exceptions are *Draw the future*, which uses d3 v5, and the two world-map widgets, which import d3-geo, d3-scale-chromatic and topojson-client from a CDN.
