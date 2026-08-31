// Shared country choropleth for the Vlasceanu et al. (2024) widgets, recreating the two
// panels of the paper's Fig. 4: belief in climate change (Table S5) and support for
// climate policy (Table S6), both 0–100 country-level posterior means from the
// supplementary materials. https://www.science.org/doi/10.1126/sciadv.adj5778
//
// The two widget modules (belief-map, policy-support-map) are thin wrappers around this file that
// fix the wording; everything the panels share — the Equal Earth map, the 0–100 BrBG
// scale, click behavior — lives here so it cannot drift between them.
//
// Rendered as SVG: one <path> per country makes click and tap hit-testing free, which is
// the whole point of these widgets. Interaction is click/tap-only, no hover — deliberate,
// so a phone and a laptop get exactly the same behavior (and because highlighting on
// hover proved buggy: raising the hovered path with appendChild re-inserts the element
// under the pointer, which can swallow the pointerleave event and leave every country the
// pointer ever crossed stuck highlighted).
//
// Unlike the canvas widgets this one imports d3, but by absolute jsDelivr URL, so the
// same file works both on the Framework site and as a raw script-tag embed. That adds no
// new failure mode to the embeds: the script-tag snippets already load the widget modules
// from the same CDN host, so any page that can run an embed at all can reach these too.
import {geoEqualEarth, geoPath} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import {interpolateBrBG} from "https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3/+esm";

// The grays of the reference figure (Makie's gray95/gray90/gray85): page-plate background,
// ocean, and countries outside the study, in that order.
const BACKGROUND = "#f2f2f2";
const OCEAN = "#e6e6e6";
const NO_DATA = "#d9d9d9";

// Both scores are percentage-like 0–100 values, and the reference figure fixes the color
// range to the full scale rather than stretching it over the observed range, so the maps
// stay comparable with each other and read as "most countries are high on this scale".
const DOMAIN = [0, 100];

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Table S5/S6 country names -> world-atlas (Natural Earth 110m) polygon names; only the
// mismatches are listed, everything else matches verbatim. Singapore has no 110m polygon
// at all — too small for that scale — which the widget pages disclose in prose.
const NAME_MAP = {
  "North Macedonia": "Macedonia",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
  USA: "United States of America",
};

// Tables S5 and S6 as shipped share one layout: one row per country with the posterior
// mean, sd, median, and HDI bounds. hdi_3%/hdi_97% delimit the 94% highest-density
// interval (the ArviZ default the paper's analysis code reports); the widgets show that
// pair and ignore the 97% one.
export function parseCountryStats(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`country stats CSV: no "${name}" column`);
    return i;
  };
  const cCountry = col("country"), cMean = col("mean"), cSd = col("sd");
  const cMedian = col("median"), cLo = col("hdi_3%"), cHi = col("hdi_97%");
  const out = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const row = {
      country: cells[cCountry],
      mean: Number(cells[cMean]),
      sd: Number(cells[cSd]),
      median: Number(cells[cMedian]),
      lo: Number(cells[cLo]),
      hi: Number(cells[cHi]),
    };
    if (row.country && [row.mean, row.sd, row.median, row.lo, row.hi].every(Number.isFinite)) {
      out.push(row);
    }
  }
  return out;
}

// SVG gradient ids are looked up document-wide, so two widgets on one page (both maps on
// a course page, a re-run notebook cell) must not share one.
let gradSeq = 0;

// `name` is the widget's slug — it becomes the SVG's class, which the thumbnail script
// greps the rendered DOM for. `noun` is the measured quantity as it reads in a sentence
// ("belief", "policy support"); `barLabel` is the colorbar caption.
export function createChoroplethWidget({data, world, width = FIGURE_WIDTH, name, noun, barLabel}) {
  const countries = feature(world, world.objects.countries).features;
  const geoNames = new Set(countries.map(f => f.properties.name));

  const byGeoName = new Map(data.map(row => [NAME_MAP[row.country] ?? row.country, row]));
  const missing = data.filter(row => !geoNames.has(NAME_MAP[row.country] ?? row.country));
  // Not thrown: a data country without a polygon (Singapore) degrades to prose, but a new
  // CSV or geometry file that silently unmapped ten countries should be loud somewhere.
  if (missing.length) {
    console.warn(`${name}: no polygon for`, missing.map(r => r.country).join(", "));
  }

  const color = row => interpolateBrBG((row.mean - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0]));

  // The width param is a cap, not a fixed size: the figure fills its container up to it.
  const maxW = Math.max(MIN_WIDTH, Math.round(width));

  const container = document.createElement("div");
  // position:relative anchors the tooltip; the font is inherited by every SVG <text>.
  container.style.cssText = "font:16px sans-serif;color:#333;position:relative;";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", name);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    `World map with countries shaded by mean ${noun}, 0 to 100`);
  svg.style.display = "block";

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position:absolute;pointer-events:none;background:rgba(255,255,255,0.95);" +
    "border:1px solid #ccc;border-radius:6px;padding:4px 9px;font-size:13px;line-height:1.4;" +
    "color:#333;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap;";
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:2.8em;";
  container.appendChild(status);

  const HINT = `Click a country to see its ${noun} score.`;

  const gradId = `${name}-gradient-${gradSeq++}`;

  // Selection is data-space state (a polygon name), so it survives resize rebuilds.
  let selected = null;
  let w = null, totalH = 0;
  let pathByName = new Map();

  const fmt = v => v.toFixed(1);

  function rowFor(polygonName) {
    return byGeoName.get(polygonName) ?? null;
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Rebuilds the whole SVG for a given width. Cheap enough to do per resize step: the
  // 110m file holds ~180 polygons, and reprojecting them is the only real work.
  function build(newW) {
    w = newW;

    const projection = geoEqualEarth().fitWidth(w, {type: "Sphere"});
    const path = geoPath(projection);
    const mapH = Math.ceil(path.bounds({type: "Sphere"})[1][1]);

    // Colorbar block below the map, matching the reference figure: a short horizontal bar
    // with ticks at 0..100 by 25 and the label underneath.
    const barW = Math.max(180, Math.round(w * 0.4));
    const barX = Math.round((w - barW) / 2);
    const barY = mapH + 10;
    const barH = 10;
    const tickY = barY + barH + 16;
    const labelY = tickY + 19;
    totalH = labelY + 6;

    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    // The tooltip is anchored to the coordinates of a past click, which a reflow makes
    // stale; the selection itself is width-independent and survives in the status line.
    tooltip.hidden = true;

    const defs = svgEl("defs", {});
    const grad = svgEl("linearGradient", {id: gradId, x1: 0, y1: 0, x2: 1, y2: 0});
    for (let i = 0; i <= 10; i++) {
      grad.appendChild(svgEl("stop", {offset: `${i * 10}%`, "stop-color": interpolateBrBG(i / 10)}));
    }
    defs.appendChild(grad);
    svg.appendChild(defs);

    svg.appendChild(svgEl("rect", {width: w, height: totalH, fill: BACKGROUND}));
    // The projection clips to the sphere, so this one path is the smooth curved ocean
    // boundary the reference figure builds by hand from a densely-sampled globe outline.
    svg.appendChild(svgEl("path", {d: path({type: "Sphere"}), fill: OCEAN}));

    const g = svgEl("g", {stroke: "#000", "stroke-width": 0.25, "stroke-linejoin": "round"});
    pathByName = new Map();
    for (const f of countries) {
      const d = path(f);
      if (!d) continue;
      const polygonName = f.properties.name;
      const row = rowFor(polygonName);
      const p = svgEl("path", {d, fill: row ? color(row) : NO_DATA, cursor: "pointer"});
      p.addEventListener("click", e => {
        selected = selected === polygonName ? null : polygonName;
        refreshStrokes();
        if (selected === null) tooltip.hidden = true;
        else showTooltip(e, polygonName, row);
        emit();
        e.stopPropagation();
      });
      g.appendChild(p);
      pathByName.set(polygonName, p);
    }
    svg.appendChild(g);

    const bar = svgEl("g", {"font-size": 12, fill: "#333"});
    bar.appendChild(svgEl("rect", {
      x: barX, y: barY, width: barW, height: barH,
      fill: `url(#${gradId})`, stroke: "#999", "stroke-width": 0.5,
    }));
    for (let v = DOMAIN[0]; v <= DOMAIN[1]; v += 25) {
      const tx = barX + (barW * (v - DOMAIN[0])) / (DOMAIN[1] - DOMAIN[0]);
      bar.appendChild(svgEl("line", {
        x1: tx, y1: barY + barH, x2: tx, y2: barY + barH + 4, stroke: "#333", "stroke-width": 1,
      }));
      const t = svgEl("text", {x: tx, y: tickY, "text-anchor": "middle"});
      t.textContent = v;
      bar.appendChild(t);
    }
    const label = svgEl("text", {x: barX + barW / 2, y: labelY, "text-anchor": "middle", "font-size": 13});
    label.textContent = barLabel;
    bar.appendChild(label);
    svg.appendChild(bar);

    refreshStrokes();
  }

  // Clicking the ocean (or the plate around it) unpins; country clicks stopPropagation.
  svg.addEventListener("click", () => {
    if (selected === null) return;
    selected = null;
    tooltip.hidden = true;
    refreshStrokes();
    emit();
  });

  function refreshStrokes() {
    for (const [polygonName, p] of pathByName) {
      p.setAttribute("stroke-width", selected === polygonName ? 1.25 : 0.25);
    }
    if (selected !== null) {
      const p = pathByName.get(selected);
      if (p) p.parentNode.appendChild(p);
    }
    renderStatus();
  }

  function showTooltip(e, polygonName, row) {
    tooltip.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = polygonName;
    tooltip.appendChild(strong);
    tooltip.appendChild(document.createElement("br"));
    tooltip.appendChild(document.createTextNode(
      row ? `${capitalize(noun)} ${fmt(row.mean)} %` : "Not in the study"));
    tooltip.hidden = false;

    // Offset to the lower right of the click point, flipped left when it would overrun
    // the container — measured after the content is set, so the flip uses the real width.
    const r = container.getBoundingClientRect();
    let tx = e.clientX - r.left + 12;
    const ty = e.clientY - r.top + 14;
    if (tx + tooltip.offsetWidth > r.width - 4) tx = e.clientX - r.left - tooltip.offsetWidth - 12;
    tooltip.style.left = `${Math.max(0, tx)}px`;
    tooltip.style.top = `${ty}px`;
  }

  function renderStatus() {
    if (selected === null) {
      status.textContent = HINT;
      return;
    }
    const row = rowFor(selected);
    status.textContent = row
      ? `${selected}: mean ${noun} ${fmt(row.mean)} out of 100 ` +
        `(94% HDI ${fmt(row.lo)}–${fmt(row.hi)}). Click the country again to unpin.`
      : `${selected}: not one of the study's 63 countries. Click it again to unpin.`;
  }

  function value() {
    if (selected === null) return null;
    const row = rowFor(selected);
    return row ? {...row, geoName: selected} : {country: null, geoName: selected};
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  build(maxW);
  renderStatus();
  container.value = value();

  // Reflow with the container, same contract as the other widgets: the observer watches
  // the widget's own container div so the script-tag embed, which has no Observable
  // runtime, is responsive too. A detached, hidden, or not-yet-inserted container
  // measures zero; keep the current layout rather than reading that as "no room".
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) build(fitted);
    });
    ro.observe(container);
  }

  return container;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
