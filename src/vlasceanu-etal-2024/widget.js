// Recreates the country maps of Vlasceanu et al. (2024), "Addressing climate change with
// behavioral science: A global intervention tournament in 63 countries", Science Advances
// 10, eadj5778 — as one widget with four buttons, one per outcome the study measured:
// climate beliefs (Table S5), policy support (S6), social media sharing (S7) and
// tree-planting effort (S8). The paper's own Fig. 4 maps only the first two.
//
// The four supplementary tables ship verbatim under data/, and everything drawn here is
// computed from them in the browser: this is a reading interface for published numbers,
// not a re-analysis. Each value is a posterior mean from the authors' Bayesian
// hierarchical models, so it is not the arithmetic average of their respondents — the raw
// participant means run about four points lower on belief, for instance. The global bar is
// therefore the unweighted mean of the 63 country scores, which is the same quantity the
// map is colored by, rather than a respondent-level average that would not match it.
//
// Switching outcomes mutates the same SVG in place (new `fill`/`y`/`height` attributes on
// the existing elements, no rebuild), so the CSS transitions below animate every switch:
// the Framework runtime itself does not offer this — a reactive Framework cell re-runs its
// whole block and replaces the DOM outright, discarding any mid-animation state.
import {geoEqualEarth, geoPath} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import {interpolateYlGnBu} from "https://cdn.jsdelivr.net/npm/d3-scale-chromatic@3/+esm";

const BACKGROUND = "#f2f2f2";
const OCEAN = "#e6e6e6";
const NO_DATA = "#d9d9d9";
const BAR_FILL = "#555";

const MAP_WIDTH = 640;
const MIN_MAP_WIDTH = 280;
const BAR_AXIS_W = 36; // left gutter for the bar chart's axis labels
const BAR_PLOT_TOP = 20; // headroom for the top axis label and the bar's value label
const BAR_TICK_H = 24; // the caption row under the plot
const BAR_THICKNESS = 56;
const BAR_WIDTH = BAR_AXIS_W + BAR_THICKNESS + 14;

const TRANSITION = "480ms ease";

// Table country names -> world-atlas (Natural Earth 110m) polygon names; only the
// mismatches are listed. Singapore has no 110m polygon at all — too small for that
// scale — which the widget page discloses in prose.
const NAME_MAP = {
  "North Macedonia": "Macedonia",
  UK: "United Kingdom",
  UAE: "United Arab Emirates",
  USA: "United States of America",
};

// `domain` is the color scale, trimmed to the range each outcome actually occupies so the
// ramp is spent on real variation; `barMax` is the bar chart's axis, which always starts
// at zero because a bar cut off at 70 would misread as a much bigger difference than it is.
// Values outside `domain` are clamped, so a future table revision degrades rather than
// breaking.
const METRICS = [
  {
    key: "belief",
    button: "Climate beliefs",
    title: "Belief in climate change",
    domain: [70, 100], tickStep: 5,
    barMax: 100, barTickStep: 25,
    axisFmt: v => `${v}`,
    short: v => v.toFixed(1),
    long: v => `${v.toFixed(1)} out of 100`,
  },
  {
    key: "policy",
    button: "Policy support",
    title: "Support for climate policy",
    domain: [55, 85], tickStep: 5,
    barMax: 100, barTickStep: 25,
    axisFmt: v => `${v}`,
    short: v => v.toFixed(1),
    long: v => `${v.toFixed(1)} out of 100`,
  },
  {
    key: "sharing",
    button: "Social media sharing",
    title: "Willingness to share climate information",
    domain: [15, 95], tickStep: 10,
    barMax: 100, barTickStep: 25,
    axisFmt: v => `${v}%`,
    short: v => `${v.toFixed(1)}%`,
    long: v => `${v.toFixed(1)}% of social media users`,
  },
  {
    key: "wept",
    button: "Tree-planting effort",
    title: "Pages completed to plant trees",
    domain: [1, 7], tickStep: 1,
    barMax: 8, barTickStep: 2,
    axisFmt: v => `${v}`,
    short: v => v.toFixed(2),
    long: v => `${v.toFixed(2)} of 8 pages`,
  },
];

// Each table ships as published: one row per country with the posterior mean, sd, median
// and two HDI pairs. hdi_3%/hdi_97% delimit the 94% highest-density interval (the ArviZ
// default the paper's analysis code reports); the widget shows that pair and ignores the
// 97% one.
function parseTable(text, label) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`${label}: no "${name}" column`);
    return i;
  };
  const cCountry = col("country"), cMean = col("mean"), cSd = col("sd");
  const cMedian = col("median"), cLo = col("hdi_3%"), cHi = col("hdi_97%");
  const out = new Map();
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const row = {
      mean: Number(cells[cMean]), sd: Number(cells[cSd]),
      median: Number(cells[cMedian]), lo: Number(cells[cLo]), hi: Number(cells[cHi]),
    };
    if (cells[cCountry] && Number.isFinite(row.mean)) out.set(cells[cCountry], row);
  }
  return out;
}

// Takes the four tables' text, keyed by metric: {belief, policy, sharing, wept}.
export function parseVlasceanuEtal2024(tables) {
  const parsed = {};
  for (const m of METRICS) {
    if (typeof tables[m.key] !== "string") {
      throw new Error(`vlasceanu-etal-2024: missing the "${m.key}" table`);
    }
    parsed[m.key] = parseTable(tables[m.key], `vlasceanu-etal-2024 ${m.key} table`);
  }

  // The four tables cover the same 63 countries; take the belief table as the roll and
  // warn rather than throw if a future revision diverges, so the map still draws.
  const names = [...parsed.belief.keys()];
  const countries = names.map(country => {
    const row = {country};
    for (const m of METRICS) row[m.key] = parsed[m.key].get(country) ?? null;
    return row;
  });
  for (const m of METRICS) {
    const missing = names.filter(c => !parsed[m.key].has(c));
    if (missing.length) console.warn(`vlasceanu-etal-2024: ${m.key} table lacks`, missing.join(", "));
  }

  // Unweighted mean of the country scores — the same quantity the map is colored by.
  const means = {};
  for (const m of METRICS) {
    const vals = countries.map(r => r[m.key]?.mean).filter(Number.isFinite);
    means[m.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  return {countries, means};
}

let gradSeq = 0;

export function createVlasceanuEtal2024Widget({data, world, width = MAP_WIDTH + 16 + BAR_WIDTH}) {
  const {countries, means} = data;
  const geoFeatures = feature(world, world.objects.countries).features;
  const geoNames = new Set(geoFeatures.map(f => f.properties.name));

  const byGeoName = new Map(countries.map(row => [NAME_MAP[row.country] ?? row.country, row]));
  const missing = countries.filter(row => !geoNames.has(NAME_MAP[row.country] ?? row.country));
  if (missing.length) {
    console.warn("vlasceanu-etal-2024: no polygon for", missing.map(r => r.country).join(", "));
  }

  let metricIndex = 0;
  let selected = null; // pinned polygon name
  let mapW = null;

  const metric = () => METRICS[metricIndex];
  const ramp = t => interpolateYlGnBu(Math.max(0, Math.min(1, t)));
  const color = value => {
    if (!Number.isFinite(value)) return NO_DATA;
    const [lo, hi] = metric().domain;
    return ramp((value - lo) / (hi - lo));
  };

  // The plate runs under the whole widget, not just the map. The map SVG keeps painting
  // its own background rect in the same color, so the two merge seamlessly here and the
  // SVG still stands on its own if it is ever pulled out.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // --- outcome buttons (assembled at the bottom of the plate, see below) ---
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

  const HINT = "Click a country to see its score.";

  // --- bar chart ---
  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  const barSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  barSvg.setAttribute("width", BAR_WIDTH);
  barSvg.setAttribute("role", "img");
  barWrap.appendChild(barSvg);

  let plotBottom = 0, plotHeight = 0;
  let axisG = null, barRect = null, barLabel = null;

  // Rebuilt with the map, to the height the map ends up at, so the two panels line up top
  // and bottom. The rect and its label are created once here and then only ever mutated,
  // which is what lets an outcome switch animate them; the axis behind them is redrawn
  // outright, since its scale changes between outcomes and there is nothing to tween.
  function buildBars(totalHeight) {
    plotHeight = Math.max(60, totalHeight - BAR_PLOT_TOP - BAR_TICK_H);
    plotBottom = BAR_PLOT_TOP + plotHeight;
    barSvg.setAttribute("height", totalHeight);
    barSvg.replaceChildren();

    axisG = svgEl("g", {});
    barSvg.appendChild(axisG);

    const {value, h} = barGeometry();
    barRect = svgEl("rect", {
      x: BAR_AXIS_W, y: plotBottom - h, width: BAR_THICKNESS, height: h, fill: BAR_FILL,
    });
    barRect.style.transition = `y ${TRANSITION}, height ${TRANSITION}`;
    barSvg.appendChild(barRect);

    barLabel = svgEl("text", {
      x: BAR_AXIS_W + BAR_THICKNESS / 2, y: plotBottom - h - 6,
      "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
    });
    barLabel.style.transition = `y ${TRANSITION}`;
    barLabel.textContent = metric().short(value);
    barSvg.appendChild(barLabel);

    const caption = svgEl("text", {
      x: BAR_AXIS_W + BAR_THICKNESS / 2, y: plotBottom + 16,
      "text-anchor": "middle", "font-size": 11, fill: "#555",
    });
    caption.textContent = "63 countries";
    barSvg.appendChild(caption);

    drawBarAxis();
  }

  function barGeometry() {
    const m = metric();
    const value = means[m.key];
    return {value, h: (value / m.barMax) * plotHeight};
  }

  // Gridlines on the bar's own zero-based axis, darker than they would be on white:
  // #f2f2f2 swallows the faint grays the other widgets use on a white page.
  function drawBarAxis() {
    const m = metric();
    axisG.replaceChildren();
    for (let v = 0; v <= m.barMax; v += m.barTickStep) {
      const y = plotBottom - (v / m.barMax) * plotHeight;
      axisG.appendChild(svgEl("line", {
        x1: BAR_AXIS_W, x2: BAR_WIDTH, y1: y, y2: y, stroke: "#d5d5d5", "stroke-width": 1,
      }));
      const t = svgEl("text", {
        x: BAR_AXIS_W - 6, y, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": 10, fill: "#666",
      });
      t.textContent = m.axisFmt(v);
      axisG.appendChild(t);
    }
  }

  function updateBars() {
    const {value, h} = barGeometry();
    barRect.setAttribute("y", plotBottom - h);
    barRect.setAttribute("height", h);
    barLabel.setAttribute("y", plotBottom - h - 6);
    barLabel.textContent = metric().short(value);
  }

  // --- map ---
  const mapSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  mapSvg.setAttribute("class", "vlasceanu-etal-2024");
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

  // SVG gradient ids are looked up document-wide, so two of these widgets on one page must
  // not share one.
  const gradId = `vlasceanu-etal-2024-gradient-${gradSeq++}`;
  let totalH = 0;
  let pathByName = new Map();
  // The colorbar's gradient is the same for every outcome, but its domain and ticks are
  // not, so the strip is kept in its own group and refilled on each switch.
  let colorbarG = null, colorbarGeom = null;
  // Where the tooltip is pinned, in mapWrap-relative coordinates. Kept separate from what
  // the tooltip says so that switching outcomes under a pinned country can rewrite the
  // text in place, with no pointer event to take fresh coordinates from.
  let pinPoint = null;

  function rowFor(polygonName) {
    return byGeoName.get(polygonName) ?? null;
  }

  function valueFor(polygonName) {
    const dataRow = rowFor(polygonName);
    const cell = dataRow ? dataRow[metric().key] : null;
    return cell ? cell.mean : NaN;
  }

  function buildMap(newW) {
    mapW = newW;
    const projection = geoEqualEarth().fitWidth(mapW, {type: "Sphere"});
    const path = geoPath(projection);
    const mapH = Math.ceil(path.bounds({type: "Sphere"})[1][1]);

    const barW = Math.max(220, Math.round(mapW * 0.5));
    const barX = Math.round((mapW - barW) / 2);
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
      grad.appendChild(svgEl("stop", {offset: `${i * 10}%`, "stop-color": ramp(i / 10)}));
    }
    defs.appendChild(grad);
    mapSvg.appendChild(defs);

    mapSvg.appendChild(svgEl("rect", {width: mapW, height: totalH, fill: BACKGROUND}));
    mapSvg.appendChild(svgEl("path", {d: path({type: "Sphere"}), fill: OCEAN}));

    const g = svgEl("g", {stroke: "#000", "stroke-width": 0.25, "stroke-linejoin": "round"});
    pathByName = new Map();
    for (const f of geoFeatures) {
      const d = path(f);
      if (!d) continue;
      const polygonName = f.properties.name;
      const p = svgEl("path", {d, fill: color(valueFor(polygonName)), cursor: "pointer"});
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

    colorbarGeom = {x: barX, y: barY, w: barW, h: barH, tickY};
    colorbarG = svgEl("g", {"font-size": 11, fill: "#333"});
    mapSvg.appendChild(colorbarG);
    rebuildColorbar();

    // The bar chart is sized to whatever the map came out at, so the two panels share a
    // top and a bottom edge at every width.
    buildBars(totalH);

    refreshStrokes();
  }

  function rebuildColorbar() {
    if (!colorbarG) return;
    const m = metric();
    const {x, y, w, h, tickY} = colorbarGeom;
    colorbarG.replaceChildren();
    colorbarG.appendChild(svgEl("rect", {
      x, y, width: w, height: h, fill: `url(#${gradId})`, stroke: "#999", "stroke-width": 0.5,
    }));
    for (let v = m.domain[0]; v <= m.domain[1]; v += m.tickStep) {
      const tx = x + (w * (v - m.domain[0])) / (m.domain[1] - m.domain[0]);
      colorbarG.appendChild(svgEl("line", {
        x1: tx, y1: y + h, x2: tx, y2: y + h + 4, stroke: "#333", "stroke-width": 1,
      }));
      const t = svgEl("text", {x: tx, y: tickY, "text-anchor": "middle"});
      t.textContent = m.axisFmt(v);
      colorbarG.appendChild(t);
    }
  }

  function updateMapColors() {
    for (const [polygonName, p] of pathByName) {
      p.setAttribute("fill", color(valueFor(polygonName)));
    }
    const m = metric();
    mapSvg.setAttribute("aria-label",
      `World map with countries shaded by ${m.title.toLowerCase()}, ${m.axisFmt(m.domain[0])} to ${m.axisFmt(m.domain[1])}`);
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
    const dataRow = rowFor(selected);
    const value = valueFor(selected);
    const name = dataRow?.country ?? selected;
    tooltip.textContent = Number.isFinite(value)
      ? `${name}: ${metric().short(value)}`
      : `${name}: not in the study`;
    tooltip.hidden = false;

    // Offset to the lower right of the pin, flipped left when it would overrun the map.
    // Measured after the content is set and recomputed on every render, so an outcome
    // whose line is longer than the last one flips when it needs to.
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
    const dataRow = rowFor(selected);
    const cell = dataRow ? dataRow[metric().key] : null;
    if (!cell) {
      status.textContent = `${selected}: not one of the study's 63 countries. Click it again to unpin.`;
      return;
    }
    const m = metric();
    status.textContent =
      `${dataRow.country}: ${m.long(cell.mean)} ` +
      `(94% HDI ${m.short(cell.lo)}–${m.short(cell.hi)}). Click the country again to unpin.`;
  }

  function value() {
    if (selected === null) return null;
    const dataRow = rowFor(selected);
    return {
      geoName: selected,
      metric: metric().key,
      country: dataRow?.country ?? null,
      ...(dataRow?.[metric().key] ?? {}),
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function update() {
    styleButtons();
    titleEl.textContent = metric().title;
    drawBarAxis();
    updateBars();
    rebuildColorbar();
    updateMapColors();
    renderStatus();
    // A pinned country keeps its pin across a switch, so its tooltip has to be rewritten
    // for the new outcome rather than left showing the old one's number.
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
