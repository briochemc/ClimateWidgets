// Reproduces Fig. 1 of Andre, Boneva, Chopra & Falk (2024), "Globally representative
// evidence on the actual and perceived support for climate action", Nature Climate
// Change 14, 253-259 (the Global Climate Change Survey, 125 countries) as one widget: a
// bar chart plus a choropleth, with three buttons switching between the figure's three
// rows (willingness to contribute income, social norms, demand for government action).
// Data: src/climate-action-support/data/climate-action-support.csv, produced by
// scripts/climate-action-support.jl from https://doi.org/10.15185/gccs.1.
//
// The map reuses the Equal Earth + BrBG(0-100) + click-only conventions of
// ../components/choropleth-map.js (shared by belief-map and policy-support-map), but is
// not built on that module: this widget swaps which of three columns colors the map and
// sizes the bars, which choropleth-map's single-metric contract does not support, and its
// tooltip wording assumes the Vlasceanu study's HDI-bearing rows, which this CSV has none
// of. Switching rows mutates the same SVG in place (new `fill`/`y`/`height` attributes on
// the existing elements, no rebuild), so the CSS transitions below animate every switch:
// the Framework runtime itself does not offer this — a reactive Framework cell re-runs
// its whole block and replaces the DOM outright, discarding any mid-animation state.
import {geoEqualEarth, geoPath} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import {interpolateBrBG} from "https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3/+esm";

const BACKGROUND = "#f2f2f2";
const OCEAN = "#e6e6e6";
const NO_DATA = "#d9d9d9";
const BAR_FILL = "#555";
const DOMAIN = [0, 100];

const MAP_WIDTH = 640;
const MIN_MAP_WIDTH = 280;
const BAR_AXIS_W = 32; // left gutter for the bar chart's percentage labels
const BAR_PLOT_TOP = 20; // headroom for the 100% label and a full bar's value label
const BAR_TICK_H = 24; // the "No"/"Yes" row under the plot
// A bar only has to seat its own value label ("100%") and its "No"/"Yes" tick, so it is
// sized to those rather than to the panel; the panel is then whatever they add up to.
const BAR_THICKNESS = 48;
const BAR_GAP = 16;
const BAR_WIDTH = BAR_AXIS_W + 2 * BAR_THICKNESS + BAR_GAP;

const TRANSITION = "480ms ease";

// CSV country names -> world-atlas (Natural Earth 110m) polygon names; only the
// mismatches are listed. Hong Kong, Singapore, Malta and Mauritius have no 110m polygon
// at all (too small for that scale), which the widget page discloses in prose.
const NAME_MAP = {
  "United States": "United States of America",
  "Czech Republic": "Czechia",
  "Bosnia Herzegovina": "Bosnia and Herz.",
  "Congo Brazzaville": "Congo",
  "Dominican Republic": "Dominican Rep.",
  "Ivory Coast": "Côte d'Ivoire",
  "North Macedonia": "Macedonia",
};

// `title` is the one caption the figure carries, above the bars and the map; `mapTitle`
// survives only as the map's screen-reader label, now that the colorbar has no caption.
// `question` is the survey item verbatim (the norm item named the respondent's own
// country, which is what the brackets stand in for).
const METRICS = [
  {
    key: "wtp",
    button: "Willingness to contribute income",
    question: "Would you be willing to contribute 1% of your household income every month to fight global warming?",
    title: "Willingness to contribute 1% of income",
    mapTitle: "Share willing to contribute 1% of income",
  },
  {
    key: "norm",
    button: "People should try to fight global warming",
    question: "Do you think that people in [your country] should try to fight global warming?",
    title: "People should try to fight global warming",
    mapTitle: "Share who think people should try to fight global warming",
  },
  {
    key: "government",
    button: "Government should do more",
    question: "Do you think the national government should do more to fight global warming?",
    title: "Government should do more",
    mapTitle: "Share who think the government should do more",
  },
];

// One row per country: iso3, country, n, and a 0-100 share (or NaN) for each metric key.
export function parseClimateActionSupport(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`climate-action-support CSV: no "${name}" column`);
    return i;
  };
  const cIso = col("iso3"), cCountry = col("country"), cN = col("n");
  const cMetric = Object.fromEntries(METRICS.map(m => [m.key, col(m.key)]));
  const num = s => (s === "" || s === undefined ? NaN : Number(s));

  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const row = {
      iso3: cells[cIso],
      country: cells[cCountry],
      n: num(cells[cN]),
    };
    for (const m of METRICS) row[m.key] = num(cells[cMetric[m.key]]);
    rows.push(row);
  }

  const world = rows.find(r => r.iso3 === "WLD");
  if (!world) throw new Error('climate-action-support CSV: no "WLD" global row');
  return {world, countries: rows.filter(r => r.iso3 !== "WLD")};
}

let gradSeq = 0;

export function createClimateActionSupportWidget({data, world, width = MAP_WIDTH + 16 + BAR_WIDTH}) {
  const {world: globalRow, countries} = data;
  const geoFeatures = feature(world, world.objects.countries).features;
  const geoNames = new Set(geoFeatures.map(f => f.properties.name));

  const byGeoName = new Map(countries.map(row => [NAME_MAP[row.country] ?? row.country, row]));
  const missing = countries.filter(row => !geoNames.has(NAME_MAP[row.country] ?? row.country));
  if (missing.length) {
    console.warn("climate-action-support: no polygon for", missing.map(r => r.country).join(", "));
  }

  const color = value => Number.isFinite(value) ? interpolateBrBG((value - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) : NO_DATA;

  let metricIndex = 0;
  let selected = null; // pinned polygon name
  let mapW = null;

  // The plate runs under the whole widget, not just the map. The map SVG keeps painting
  // its own background rect in the same color, so the two merge seamlessly here and the
  // SVG still stands on its own if it is ever pulled out on its own.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // --- metric buttons (assembled at the bottom of the plate, see below) ---
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;";
  const buttonEls = METRICS.map((m, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = m.button;
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "transition:background-color " + TRANSITION + ",color " + TRANSITION + ",border-color " + TRANSITION + ";";
    b.addEventListener("click", () => {
      if (metricIndex === i) return;
      metricIndex = i;
      update();
    });
    buttons.appendChild(b);
    return b;
  });

  // The figure's one caption, heading the plate above the two panels it applies to. It
  // replaces the colorbar caption and the bar chart's axis title, which said the same
  // thing twice.
  const titleEl = document.createElement("div");
  titleEl.style.cssText = "font-weight:700;font-size:17px;margin:2px 0 10px;color:#222;";

  function styleButtons() {
    buttonEls.forEach((b, i) => {
      const active = i === metricIndex;
      b.setAttribute("aria-pressed", String(active));
      b.style.border = active ? "1px solid #333" : "1px solid #ccc";
      b.style.background = active ? "#333" : "#fff";
      b.style.color = active ? "#fff" : "#333";
    });
  }

  // --- row: bar chart + map ---
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;";

  const barWrap = document.createElement("div");
  barWrap.style.cssText = "flex:0 0 auto;";
  row.appendChild(barWrap);

  const mapWrap = document.createElement("div");
  mapWrap.style.cssText = "flex:1 1 " + MIN_MAP_WIDTH + "px;min-width:" + MIN_MAP_WIDTH + "px;position:relative;";
  row.appendChild(mapWrap);

  const status = document.createElement("div");
  status.style.cssText = "padding:10px 0 0;color:#555;min-height:2.8em;";

  // Top to bottom: what you are looking at, the figure, what you clicked, and the
  // controls that change it.
  container.append(titleEl, row, status, buttons);

  const HINT = "Click a country to see its share.";

  // --- bar chart ---
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  const barX = [BAR_AXIS_W, BAR_AXIS_W + BAR_THICKNESS + BAR_GAP];

  const barSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  barSvg.setAttribute("width", BAR_WIDTH);
  barSvg.setAttribute("role", "img");
  barWrap.appendChild(barSvg);

  let plotBottom = 0, plotHeight = 0;
  let barRects = [], barLabels = [];

  // The two shares, "No" first, for whichever row is selected.
  function barValues() {
    const yes = globalRow[METRICS[metricIndex].key];
    return [100 - yes, yes];
  }

  // Rebuilt with the map, to the height the map ends up at, so the two panels line up top
  // and bottom. Bars are created already at their current height: a resize should resize
  // them, not replay the grow-from-zero that a row switch animates.
  function buildBars(totalHeight) {
    plotHeight = Math.max(60, totalHeight - BAR_PLOT_TOP - BAR_TICK_H);
    plotBottom = BAR_PLOT_TOP + plotHeight;
    barSvg.setAttribute("height", totalHeight);
    barSvg.replaceChildren();

    // Gridlines at 0/25/50/75/100%, darker than they would be on white: #f2f2f2 swallows
    // the faint grays the other widgets use on a white page.
    for (let v = 0; v <= 100; v += 25) {
      const y = plotBottom - (v / 100) * plotHeight;
      barSvg.appendChild(svgEl("line", {
        x1: BAR_AXIS_W, x2: BAR_WIDTH, y1: y, y2: y, stroke: "#d5d5d5", "stroke-width": 1,
      }));
      const t = svgEl("text", {
        x: BAR_AXIS_W - 6, y, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": 10, fill: "#666",
      });
      t.textContent = `${v}%`;
      barSvg.appendChild(t);
    }

    const values = barValues();
    barRects = values.map((v, i) => {
      const h = (v / 100) * plotHeight;
      const r = svgEl("rect", {
        x: barX[i], y: plotBottom - h, width: BAR_THICKNESS, height: h, fill: BAR_FILL,
      });
      r.style.transition = `y ${TRANSITION}, height ${TRANSITION}`;
      barSvg.appendChild(r);
      return r;
    });
    barLabels = values.map((v, i) => {
      const h = (v / 100) * plotHeight;
      const t = svgEl("text", {
        x: barX[i] + BAR_THICKNESS / 2, y: plotBottom - h - 6,
        "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
      });
      t.style.transition = `y ${TRANSITION}`;
      t.textContent = `${Math.round(v)}%`;
      barSvg.appendChild(t);
      return t;
    });
    // Constant across rows — the point of asking every question as a yes/no.
    ["No", "Yes"].forEach((label, i) => {
      const t = svgEl("text", {
        x: barX[i] + BAR_THICKNESS / 2, y: plotBottom + 16, "text-anchor": "middle", "font-size": 12,
      });
      t.textContent = label;
      barSvg.appendChild(t);
    });
  }

  function updateBars() {
    barValues().forEach((v, i) => {
      const h = (v / 100) * plotHeight;
      barRects[i].setAttribute("y", plotBottom - h);
      barRects[i].setAttribute("height", h);
      barLabels[i].setAttribute("y", plotBottom - h - 6);
      barLabels[i].textContent = `${Math.round(v)}%`;
    });
  }

  // --- map ---
  const mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.setAttribute("class", "climate-action-support");
  mapSvg.setAttribute("role", "img");
  mapSvg.style.display = "block";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(mapSvg);
  mapWrap.appendChild(scroller);

  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position:absolute;pointer-events:none;background:rgba(255,255,255,0.95);" +
    "border:1px solid #ccc;border-radius:6px;padding:4px 9px;font-size:13px;line-height:1.4;" +
    "color:#333;box-shadow:0 1px 4px rgba(0,0,0,0.15);white-space:nowrap;";
  tooltip.hidden = true;
  mapWrap.appendChild(tooltip);

  const gradId = `climate-action-support-gradient-${gradSeq++}`;
  let totalH = 0;
  let pathByName = new Map();
  // Where the tooltip is pinned, in mapWrap-relative coordinates. Kept separate from what
  // the tooltip says so that switching rows under a pinned country can rewrite the text in
  // place, with no pointer event to take fresh coordinates from.
  let pinPoint = null;
  const fmt = v => v.toFixed(1);

  function rowFor(polygonName) {
    return byGeoName.get(polygonName) ?? null;
  }

  function buildMap(newW) {
    mapW = newW;
    const projection = geoEqualEarth().fitWidth(mapW, {type: "Sphere"});
    const path = geoPath(projection);
    const mapH = Math.ceil(path.bounds({type: "Sphere"})[1][1]);

    const barW2 = Math.max(180, Math.round(mapW * 0.4));
    const barX2 = Math.round((mapW - barW2) / 2);
    const barY = mapH + 10;
    const barH = 10;
    const tickY = barY + barH + 16;
    totalH = tickY + 6; // the colorbar's ticks end the SVG; its caption is the title above

    mapSvg.setAttribute("width", mapW);
    mapSvg.setAttribute("height", totalH);
    mapSvg.replaceChildren();
    // The pin is anchored to the coordinates of a past click, which a reflow makes stale;
    // the selection itself is width-independent and survives in the status line.
    hideTooltip();

    const defs = svgEl("defs", {});
    const grad = svgEl("linearGradient", {id: gradId, x1: 0, y1: 0, x2: 1, y2: 0});
    for (let i = 0; i <= 10; i++) {
      grad.appendChild(svgEl("stop", {offset: `${i * 10}%`, "stop-color": interpolateBrBG(i / 10)}));
    }
    defs.appendChild(grad);
    mapSvg.appendChild(defs);

    mapSvg.appendChild(svgEl("rect", {width: mapW, height: totalH, fill: BACKGROUND}));
    mapSvg.appendChild(svgEl("path", {d: path({type: "Sphere"}), fill: OCEAN}));

    const g = svgEl("g", {stroke: "#000", "stroke-width": 0.25, "stroke-linejoin": "round"});
    pathByName = new Map();
    const metric = METRICS[metricIndex];
    for (const f of geoFeatures) {
      const d = path(f);
      if (!d) continue;
      const polygonName = f.properties.name;
      const dataRow = rowFor(polygonName);
      const value = dataRow ? dataRow[metric.key] : NaN;
      const p = svgEl("path", {d, fill: color(value), cursor: "pointer"});
      p.style.transition = `fill ${TRANSITION}`;
      p.addEventListener("click", e => {
        selected = selected === polygonName ? null : polygonName;
        refreshStrokes();
        if (selected === null) hideTooltip();
        else showTooltip(e);
        emit();
        e.stopPropagation();
      });
      g.appendChild(p);
      pathByName.set(polygonName, p);
    }
    mapSvg.appendChild(g);

    const bar = svgEl("g", {"font-size": 12, fill: "#333"});
    bar.appendChild(svgEl("rect", {
      x: barX2, y: barY, width: barW2, height: barH,
      fill: `url(#${gradId})`, stroke: "#999", "stroke-width": 0.5,
    }));
    for (let v = DOMAIN[0]; v <= DOMAIN[1]; v += 25) {
      const tx = barX2 + (barW2 * (v - DOMAIN[0])) / (DOMAIN[1] - DOMAIN[0]);
      bar.appendChild(svgEl("line", {
        x1: tx, y1: barY + barH, x2: tx, y2: barY + barH + 4, stroke: "#333", "stroke-width": 1,
      }));
      const t = svgEl("text", {x: tx, y: tickY, "text-anchor": "middle"});
      t.textContent = `${v}%`;
      bar.appendChild(t);
    }
    mapSvg.appendChild(bar);

    // The bar chart is sized to whatever the map came out at, so the two panels share a
    // top and a bottom edge at every width.
    buildBars(totalH);

    refreshStrokes();
  }

  function updateMapColors() {
    const metric = METRICS[metricIndex];
    for (const [polygonName, p] of pathByName) {
      const dataRow = rowFor(polygonName);
      const value = dataRow ? dataRow[metric.key] : NaN;
      p.setAttribute("fill", color(value));
    }
    mapSvg.setAttribute("aria-label", `World map with countries shaded by ${metric.mapTitle.toLowerCase()}, 0 to 100`);
  }

  mapSvg.addEventListener("click", () => {
    if (selected === null) return;
    selected = null;
    hideTooltip();
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

  function showTooltip(e) {
    const r = mapWrap.getBoundingClientRect();
    pinPoint = {x: e.clientX - r.left, y: e.clientY - r.top};
    renderTooltip();
  }

  function hideTooltip() {
    tooltip.hidden = true;
    pinPoint = null;
  }

  function renderTooltip() {
    if (selected === null || pinPoint === null) return;
    const metric = METRICS[metricIndex];
    const dataRow = rowFor(selected);
    const value = dataRow ? dataRow[metric.key] : NaN;

    // One short line: the survey's own country name (shorter than the polygon's, which is
    // what the status line underneath uses) and a whole-number percentage. Which row the
    // number belongs to is already on the buttons, the bar chart and the colorbar.
    const name = dataRow?.country ?? selected;
    tooltip.textContent = Number.isFinite(value)
      ? `${name}: ${Math.round(value)}%`
      : `${name}: not asked`;
    tooltip.hidden = false;

    // Offset to the lower right of the pin, flipped left when it would overrun the map.
    // Measured after the content is set and recomputed on every render, so a row whose
    // line is longer than the last one flips when it needs to.
    const w = mapWrap.getBoundingClientRect().width;
    let tx = pinPoint.x + 12;
    if (tx + tooltip.offsetWidth > w - 4) tx = pinPoint.x - tooltip.offsetWidth - 12;
    tooltip.style.left = `${Math.max(0, tx)}px`;
    tooltip.style.top = `${pinPoint.y + 14}px`;
  }

  function renderStatus() {
    if (selected === null) {
      status.textContent = HINT;
      return;
    }
    const metric = METRICS[metricIndex];
    const dataRow = rowFor(selected);
    if (!dataRow) {
      status.textContent = `${selected}: not one of the survey's 125 countries. Click it again to unpin.`;
      return;
    }
    const value = dataRow[metric.key];
    status.textContent = Number.isFinite(value)
      ? `${selected}: ${fmt(value)}% (n=${dataRow.n}) — ${metric.question} Click the country again to unpin.`
      : `${selected}: this question was not asked in this country. Click the country again to unpin.`;
  }

  function value() {
    if (selected === null) return null;
    const dataRow = rowFor(selected);
    return {
      geoName: selected,
      metric: METRICS[metricIndex].key,
      ...(dataRow ?? {country: null}),
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function update() {
    styleButtons();
    titleEl.textContent = METRICS[metricIndex].title;
    updateBars();
    updateMapColors();
    renderStatus();
    // A pinned country keeps its pin across a row switch, so its tooltip has to be
    // rewritten for the new row rather than left showing the old row's number.
    if (!tooltip.hidden) renderTooltip();
    emit();
  }

  buildMap(Math.max(MIN_MAP_WIDTH, Math.round(width - BAR_WIDTH - 16)));
  update();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || mapWrap.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_MAP_WIDTH, Math.min(MAP_WIDTH, Math.floor(avail)));
      if (fitted !== mapW) buildMap(fitted);
    });
    ro.observe(mapWrap);
  }

  return container;
}
