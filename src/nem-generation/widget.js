// Electricity generation by source in Australia's National Electricity Market, or in one of its
// five regions, or in Western Australia's grid: a stacked area of coal, gas, hydro, wind, solar,
// batteries and the rest, month by month or year by year since the market began in December
// 1998, as a share of what was generated or in gigawatt hours. In GWh, the energy drawn from
// the grid to pump water uphill, charge batteries or export to a neighbouring state hangs below
// zero, and imports sit at the bottom of the stack; shares leave all of those out. There is no
// key and no pop-up: a probe stands at the latest month or year with each source's value
// written beside its band, for every source above one per cent. Move the pointer across the
// chart to read another time, click to pin it, and click a band to pick that source out, which
// also names a source too small to be labelled on its own. Drawn in the style of the Hickman
// and climate-funds widgets: a grey plate, a bold title in the corner, quiet gridlines with
// their labels on them, dark pill buttons, and the source in small type at the bottom right.
// The data are Open Electricity's (CC BY-NC 4.0), bundled by scripts/nem-generation.mjs and
// refreshed monthly. Self-contained: no d3, no imports.
//
// Options: {region: "NEM" | "NSW1" | "QLD1" | "SA1" | "TAS1" | "VIC1" | "WEM"} (short forms
// like "sa" and "nsw" work too), {interval: "year" | "month"}, {measure: "gwh" | "share"},
// {select: "wind"} to open with a source picked out (coal, gas, hydro, wind, solar, batteries,
// other, imports, pumps, battery_charging, exports); {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const GRID = "#b3b3b3";
const LINK = "#0b57d0";
const CHART_H = 270;
const MIN_LABEL_SHARE = 1;              // per cent of generation a source needs to be labelled unasked
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const INTERVALS = [
  {id: "year", label: "By year", title: "Calendar years, the complete ones"},
  {id: "month", label: "By month", title: "Every month since the record begins"},
];
export const MEASURES = [
  {id: "gwh", label: "GWh", title: "Gigawatt hours; pumping, battery charging and exports below zero"},
  {id: "share", label: "% of generation", title: "Each source as a percentage of the electricity generated"},
];

// The seven sources, in stacking order from the bottom, in Okabe and Ito's colours (coal black,
// gas orange, other vermilion, batteries blue, hydro sky blue, wind bluish green, solar
// yellow), and the fuel technologies each gathers; then imports, in reddish purple, and the
// three loads, each a tint of its source's colour. `kind` says how a series is treated:
// sources make up the generation that shares are shares of; imports are drawn in GWh under
// the sources but are another region's generation; loads hang below zero.
export const GROUPS = [
  {id: "imports", label: "Imports", colour: "#CC79A7", kind: "imports", members: ["imports"]},
  {id: "coal", label: "Coal", colour: "#000000", kind: "source", members: ["coal_brown", "coal_black"]},
  {id: "other", label: "Other", colour: "#D55E00", kind: "source", members: ["bioenergy_biogas", "bioenergy_biomass", "distillate"],
    long: "Bioenergy and distillate"},
  {id: "gas", label: "Gas", colour: "#E69F00", kind: "source", members: ["gas_steam", "gas_ccgt", "gas_ocgt", "gas_recip", "gas_wcmg"]},
  {id: "batteries", label: "Batteries", colour: "#0072B2", kind: "source", members: ["battery_discharging"]},
  {id: "hydro", label: "Hydro", colour: "#56B4E9", kind: "source", members: ["hydro"]},
  {id: "wind", label: "Wind", colour: "#009E73", kind: "source", members: ["wind"]},
  {id: "solar", label: "Solar", colour: "#F0E442", kind: "source", members: ["solar_utility", "solar_rooftop"]},
  {id: "pumps", label: "Pumping", colour: "#9AD2F2", kind: "load", members: ["pumps"], long: "Pumped hydro, pumping"},
  {id: "battery_charging", label: "Battery charging", colour: "#66AAD1", kind: "load", members: ["battery_charging"]},
  {id: "exports", label: "Exports", colour: "#995B7D", kind: "load", members: ["exports"]},
];
const REGION_ALIASES = {nem: "NEM", _all: "NEM", all: "NEM", nsw: "NSW1", qld: "QLD1", sa: "SA1", tas: "TAS1", vic: "VIC1", wa: "WEM", swis: "WEM"};

export function createNemGenerationWidget({
  data, width = FIGURE_WIDTH, region: initialRegion, interval: initialInterval, measure: initialMeasure, select: initialSelect,
} = {}) {
  if (!data?.regions) throw new Error("createNemGenerationWidget needs {data}: the contents of nem-generation.json");
  const regionById = new Map(data.regions.map(r => [r.id, r]));

  // ---- state ----------------------------------------------------------------------------------
  let region = resolveRegion(initialRegion) ?? "NEM";
  let interval = INTERVALS.some(i => i.id === initialInterval) ? initialInterval : /^(1m|month|monthly|1M)$/.test(String(initialInterval ?? "")) ? "month" : "year";
  let measure = MEASURES.some(m => m.id === initialMeasure) ? initialMeasure : /^(share|percent|%)$/.test(String(initialMeasure ?? "")) ? "share" : "gwh";
  let selected = GROUPS.some(g => g.id === initialSelect) ? initialSelect : null;   // the source picked out
  let pinned = null;      // the step the probe is pinned to, or null for the latest
  let probe = null;       // the step under the pointer, or null
  let hovered = null;     // the source under the pointer

  function resolveRegion(id) {
    if (!id) return null;
    const s = String(id).trim();
    if (regionById.has(s.toUpperCase())) return s.toUpperCase();
    return REGION_ALIASES[s.toLowerCase()] ?? null;
  }

  // ---- the series on screen -------------------------------------------------------------------
  // The time steps for the region and interval: every month of the record, or the complete
  // calendar years, each with a date and each group's energy in GWh.
  function steps() {
    const r = regionById.get(region);
    const [y0, m0] = r.monthly.start.split("-").map(Number);
    const n = Object.values(r.monthly.values)[0]?.length ?? 0;
    const groupMonthly = GROUPS.map(g => {
      const arr = new Array(n).fill(null);
      for (const id of g.members) {
        const src = r.monthly.values[id];
        if (!src) continue;
        for (let i = 0; i < n; i++) if (src[i] !== null) arr[i] = (arr[i] ?? 0) + src[i];
      }
      return arr;
    });
    if (interval === "month") {
      const dates = Array.from({length: n}, (_, i) => new Date(Date.UTC(y0, m0 - 1 + i, 1)));
      return {kind: "month", dates, values: groupMonthly, n};
    }
    const years = [];
    for (let i = 0; i < n; i++) if ((m0 - 1 + i) % 12 === 0 && i + 11 < n) years.push(i);
    const dates = years.map(i => new Date(Date.UTC(y0 + Math.floor((m0 - 1 + i) / 12), 0, 1)));
    const values = groupMonthly.map(arr => years.map(i0 => {
      let s = null;
      for (let i = i0; i < i0 + 12; i++) if (arr[i] !== null) s = (s ?? 0) + arr[i];
      return s;
    }));
    return {kind: "year", dates, values, n: dates.length};
  }

  // Stacks the series for the current state: per step each group's value (GWh, or % of the
  // generation), the generation total, and the band each drawn group occupies.
  function compute() {
    const st = steps();
    const rows = GROUPS.map((g, k) => ({g, v: st.values[k], present: st.values[k].some(v => v !== null && v !== 0)}));
    const total = new Array(st.n).fill(0);
    for (const row of rows) if (row.g.kind === "source") for (let i = 0; i < st.n; i++) total[i] += Math.max(0, row.v[i] ?? 0);
    const share = (row, i) => total[i] > 0 ? 100 * Math.max(0, row.v[i] ?? 0) / total[i] : 0;
    const drawn = rows.filter(row => row.present && (measure === "gwh" || row.g.kind === "source"));
    const up = new Array(st.n).fill(0), down = new Array(st.n).fill(0);
    for (const row of drawn) {
      row.y0 = new Array(st.n); row.y1 = new Array(st.n);
      for (let i = 0; i < st.n; i++) {
        const v = measure === "share" ? share(row, i) : Math.max(0, row.v[i] ?? 0);
        if (row.g.kind === "load") { row.y1[i] = -down[i]; down[i] += v; row.y0[i] = -down[i]; }
        else { row.y0[i] = up[i]; up[i] += v; row.y1[i] = up[i]; }
      }
    }
    return {st, rows, drawn, total, share, up, down};
  }

  // ---- layout ---------------------------------------------------------------------------------
  const ctx = document.createElement("canvas").getContext("2d");
  function textWidth(text, px, weight = "normal") {
    ctx.font = `${weight} ${px}px sans-serif`;
    return ctx.measureText(text).width;
  }
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, titleFont, sourceFont, tickFont, labelFont;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = lerp(16, 22);
    sourceFont = lerp(7.5, 9);
    tickFont = lerp(10, 11);
    labelFont = lerp(10.5, 12);
    plotL = 8;
    plotR = w - 8;
    plotT = 22;                           // room for the probe's date above the plot
    plotB = plotT + CHART_H;
    svgH = plotB + 26 + sourceFont + 10 + (w < 480 ? sourceFont + 4 : 0);
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px ${CARD_PAD}px ${CARD_PAD}px;` +
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;`;
  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 2px;";
  container.appendChild(heading);
  const subheading = document.createElement("div");
  subheading.style.cssText = "font-size:12px;color:#666;padding:0 0 10px;";
  container.appendChild(subheading);

  // Each choice is a segmented control: its options joined into one pill, the one chosen dark,
  // so that it reads as one thing or the other.
  const regionRow = document.createElement("div");
  regionRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 6px;";
  container.appendChild(regionRow);
  const updateRegionButtons = segmented(regionRow, data.regions.map(r => ({id: r.id, label: r.short, title: r.name})), setRegion);
  const optionsRow = document.createElement("div");
  optionsRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 8px;";
  container.appendChild(optionsRow);
  const updateIntervalButtons = segmented(optionsRow, INTERVALS, setInterval_);
  const updateMeasureButtons = segmented(optionsRow, MEASURES, setMeasure);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "nem-generation");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:crosshair;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const F = v => (Math.round(v * 100) / 100).toString();

  // ---- drawing --------------------------------------------------------------------------------
  let gridGroup, areaGroup, labelGroup, axisGroup, probeGroup, sourceGroup;
  let current = null, xOf, yOf, slot = 1;

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    gridGroup = svgEl("g", {"pointer-events": "none"}, svg);
    areaGroup = svgEl("g", {}, svg);
    // The gridlines' labels sit over the areas, haloed in the plate's grey.
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "stroke-linejoin": "round"}, svg);
    axisGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    probeGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    sourceGroup = svgEl("g", {"font-family": "sans-serif"}, svg);
    render();
  }

  function render() {
    const c = compute();
    current = c;
    const {st, drawn, up, down} = c;
    const r = regionById.get(region);
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
    heading.textContent = `Electricity generation in ${r.id === "NEM" ? "the " : ""}${r.name}`;
    subheading.textContent = `${st.kind === "month" ? "Month by month" : "Year by year"}, ${spanLabel(st)}, ` +
      (measure === "share" ? "each source as a share of the electricity generated." : `gigawatt hours per ${st.kind}.`) +
      " Point at the chart for another time, click to pin it, click a band to pick a source out.";

    const n = st.n;
    slot = (plotR - plotL) / Math.max(1, n);
    xOf = i => plotL + (i + 0.5) * slot;
    const top = measure === "share" ? 100 : Math.max(1, ...up);
    const bottom = measure === "share" ? 0 : -Math.max(0, ...down);
    const yStep = niceStep((top - bottom) / 5);
    const yMax = measure === "share" ? 100 : Math.ceil(top / yStep) * yStep;
    // The floor hugs the loads, which are small, rather than dropping to a whole gridline step.
    const yMin = measure === "share" || bottom >= 0 ? 0 : -Math.ceil(-bottom / (yStep / 5)) * (yStep / 5);
    yOf = v => plotB - (v - yMin) / (yMax - yMin) * CHART_H;

    gridGroup.replaceChildren();
    labelGroup.replaceChildren();
    for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + 1e-9; v += yStep) {
      const y = yOf(v);
      svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: v === 0 ? "#888" : GRID, "stroke-width": v === 0 ? 1 : 0.8}, gridGroup);
      const tl = svgEl("text", {x: F(plotL + 2), y: F(y - 3), "font-size": tickFont, fill: "#666"}, labelGroup);
      tl.textContent = measure === "share" ? `${Math.round(v)}%` : formatGwh(v);
    }

    // The areas, one path per group: along the top forward, back along the bottom. A group
    // picked out keeps its colour and the rest fade.
    areaGroup.replaceChildren();
    const pick = hovered ?? selected;
    for (const row of drawn) {
      let d = "";
      for (let i = 0; i < n; i++) d += `${i ? "L" : "M"}${F(xOf(i))},${F(yOf(row.y1[i]))}`;
      for (let i = n - 1; i >= 0; i--) d += `L${F(xOf(i))},${F(yOf(row.y0[i]))}`;
      d += "Z";
      const path = svgEl("path", {d, fill: row.g.colour, "data-id": row.g.id, opacity: pick && pick !== row.g.id ? 0.35 : 1,
        ...(pick === row.g.id ? {stroke: "#111", "stroke-width": 1.2, "stroke-linejoin": "round"} : {})}, areaGroup);
      svgEl("title", {}, path).textContent = row.g.long ?? row.g.label;
    }

    drawXAxis(st);
    drawSources(st);
    drawProbe();
    describe(c);
  }

  // Years along the bottom, thinned to fit.
  function drawXAxis(st) {
    axisGroup.replaceChildren();
    const firstIdx = new Map();
    st.dates.forEach((d, i) => { const yr = d.getUTCFullYear(); if (!firstIdx.has(yr) && (st.kind === "year" || d.getUTCMonth() === 0)) firstIdx.set(yr, i); });
    const every = [1, 2, 5, 10].find(e => (firstIdx.size / e) * 40 <= plotR - plotL) ?? 10;
    for (const [yr, i] of firstIdx) {
      const x = st.kind === "year" ? xOf(i) : xOf(i) - slot / 2;
      const minor = yr % every !== 0;
      svgEl("path", {d: `M${F(x)},${F(plotB)}v${minor ? 3 : 5}`, stroke: GRID, "stroke-width": 1}, axisGroup);
      if (minor) continue;
      const tl = svgEl("text", {x: F(x), y: F(plotB + 14), "font-size": tickFont, fill: "#666", "text-anchor": st.kind === "year" ? "middle" : "start"}, axisGroup);
      tl.textContent = `${yr}`;
    }
    svgEl("path", {d: `M${F(plotL)},${F(plotB)}H${F(plotR)}`, stroke: "#888", "stroke-width": 1}, axisGroup);
  }

  // The source line at the bottom right, Open Electricity's licence as it asks, in one or two
  // lines right-aligned by the browser itself.
  function drawSources(st) {
    sourceGroup.replaceChildren();
    const pieces = [
      {text: "Data: "},
      {text: "Open Electricity (The Superpower Institute)", url: data.source?.url ?? "https://openelectricity.org.au/"},
      {text: ", "},
      {text: data.source?.licence ?? "CC BY-NC 4.0", url: data.source?.licenceUrl},
      {text: `, to ${stepLabel(st, st.n - 1)}`},
    ].map(p => ({...p, w: textWidth(p.text, sourceFont)}));
    const lines = [];
    let line = [], lineW = 0;
    for (const p of pieces) {
      if (line.length && lineW + p.w > plotR - plotL) { lines.push(line); line = []; lineW = 0; }
      line.push(p);
      lineW += p.w;
    }
    if (line.length) lines.push(line);
    const lineH = sourceFont + 4;
    const y0 = svgH - 4 - (lines.length - 1) * lineH;
    lines.forEach((ln, i) => {
      const tx = svgEl("text", {x: F(plotR), y: F(y0 + i * lineH), "text-anchor": "end", "font-size": sourceFont.toFixed(1), fill: "#808080", "xml:space": "preserve"}, sourceGroup);
      for (const p of ln) {
        let parent = tx;
        if (p.url) {
          parent = svgEl("a", {href: p.url, target: "_blank", rel: "noopener"}, tx);
          parent.style.cssText = "cursor:pointer;";
        }
        svgEl("tspan", p.url ? {fill: LINK, "text-decoration": "underline"} : {}, parent).textContent = p.text;
      }
    });
  }

  // ---- the probe ------------------------------------------------------------------------------
  // A vertical line at the step shown, its date above the plot, and beside each band its
  // source's value there: the share, or the GWh with the share after it. Sources under one
  // per cent are named only when picked out. Labels are laid out down the probe without
  // overlapping, each joined to its band's middle by a short leader when it had to move.
  function stepShown() {
    const n = current?.st.n ?? 0;
    if (!n) return null;
    if (probe !== null) return clamp(probe, 0, n - 1);
    if (pinned !== null) return clamp(pinned, 0, n - 1);
    return n - 1;
  }
  function drawProbe() {
    probeGroup.replaceChildren();
    const c = current;
    const i = stepShown();
    if (i === null) return;
    const x = xOf(i);
    const pick = hovered ?? selected;
    svgEl("path", {d: `M${F(x)},${F(plotT - 4)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": pinned === null && probe === null ? "" : "3 3"}, probeGroup);
    const dateLabel = svgEl("text", {x: F(x), y: F(plotT - 8), "font-size": labelFont, "font-weight": "bold", fill: "#111",
      "text-anchor": x > plotR - 60 ? "end" : x < plotL + 60 ? "start" : "middle"}, probeGroup);
    dateLabel.textContent = stepLabel(c.st, i) + (c.total[i] > 0 && measure === "share" ? ` · ${formatGwh(c.total[i])} GWh generated` : "");

    // One label per band worth labelling, at the band's middle.
    const labels = [];
    for (const row of c.drawn) {
      const v = row.v[i] ?? 0;
      const sh = row.g.kind === "source" ? c.share(row, i) : c.total[i] > 0 ? 100 * Math.max(0, v) / c.total[i] : 0;
      const picked = pick === row.g.id;
      if (!picked && sh < MIN_LABEL_SHARE) continue;
      if (row.y1[i] === row.y0[i] && !picked) continue;
      const text = measure === "share"
        ? `${row.g.label} ${formatPct(sh)}`
        : `${row.g.label} ${formatGwh(Math.max(0, v))} GWh${row.g.kind === "source" ? ` (${formatPct(sh)})` : ""}`;
      labels.push({row, text, y: (yOf(row.y0[i]) + yOf(row.y1[i])) / 2, picked});
    }
    // Lay them out top to bottom with a minimum gap, then push back up if they ran off the end.
    const gap = labelFont + 4;
    labels.sort((a, b) => a.y - b.y);
    for (const l of labels) l.ly = l.y;
    for (let k = 1; k < labels.length; k++) labels[k].ly = Math.max(labels[k].ly, labels[k - 1].ly + gap);
    const overflow = labels.length ? labels[labels.length - 1].ly - (plotB + 8) : 0;
    if (overflow > 0) {
      for (const l of labels) l.ly -= overflow;
      for (let k = labels.length - 2; k >= 0; k--) labels[k].ly = Math.min(labels[k].ly, labels[k + 1].ly - gap);
    }
    // Labels go to the right of the probe, or to the left near the right edge.
    const widest = Math.max(0, ...labels.map(l => textWidth(l.text, labelFont, l.picked ? "bold" : "normal")));
    const right = x + 10 + widest <= plotR;
    const lx = right ? x + 10 : x - 10;
    for (const l of labels) {
      if (Math.abs(l.ly - l.y) > 2) {
        svgEl("path", {d: `M${F(x)},${F(l.y)}L${F(right ? x + 6 : x - 6)},${F(l.ly)}`, stroke: "#555", "stroke-width": 0.8, fill: "none"}, probeGroup);
      }
      svgEl("circle", {cx: F(x), cy: F(l.y), r: 2.4, fill: l.row.g.colour, stroke: "#fff", "stroke-width": 1}, probeGroup);
      const tx = svgEl("text", {x: F(lx), y: F(l.ly + labelFont * 0.35), "font-size": labelFont, "font-weight": l.picked ? "bold" : "normal",
        "text-anchor": right ? "start" : "end", fill: "#111", "paint-order": "stroke", stroke: "rgba(255,255,255,0.85)", "stroke-width": 3.5, "stroke-linejoin": "round"}, probeGroup);
      tx.textContent = l.text;
    }
  }

  // ---- pointer --------------------------------------------------------------------------------
  function indexAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (w / rect.width);
    if (!current) return null;
    return clamp(Math.floor((x - plotL) / slot), 0, current.st.n - 1);
  }
  const idOf = e => e.target?.getAttribute?.("data-id") ?? null;
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const i = indexAt(e.clientX), id = idOf(e);
    if (i !== probe || id !== hovered) { probe = i; hovered = id; refreshAreas(); drawProbe(); }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse") return;
    probe = null; hovered = null;
    refreshAreas(); drawProbe();
  });
  // A click pins the probe where it lands; on a band, it also picks that source out, or lets
  // it go if it was picked already. A click on a pinned probe's step, off any band, unpins it.
  svg.addEventListener("pointerdown", e => {
    const i = indexAt(e.clientX), id = idOf(e);
    if (id) selected = id === selected ? null : id;
    pinned = !id && pinned === i ? null : i;
    probe = null;
    if (e.pointerType !== "mouse") hovered = null;
    refreshAreas(); drawProbe();
    emit();
  });
  function refreshAreas() {
    const pick = hovered ?? selected;
    for (const path of areaGroup.children) {
      const id = path.getAttribute("data-id");
      path.setAttribute("opacity", pick && pick !== id ? 0.35 : 1);
      if (pick === id) { path.setAttribute("stroke", "#111"); path.setAttribute("stroke-width", 1.2); path.setAttribute("stroke-linejoin", "round"); }
      else { path.removeAttribute("stroke"); path.removeAttribute("stroke-width"); }
    }
  }

  // ---- read-out for assistive technology -------------------------------------------------------
  function describe(c) {
    const r = regionById.get(region);
    const i = c.st.n - 1;
    const parts = c.rows.filter(x => x.g.kind === "source" && x.present).map(x => ({name: x.g.label, share: c.share(x, i)}))
      .sort((a, b) => b.share - a.share).map(p => `${p.name} ${formatPct(p.share)}`).join(", ");
    svg.setAttribute("aria-label", `Electricity generation by source in ${r.name}, ${c.st.kind} by ${c.st.kind} since ${c.st.dates[0].getUTCFullYear()}, as stacked areas. ` +
      `In ${stepLabel(c.st, i)}: ${parts}.`);
  }

  // ---- state changes --------------------------------------------------------------------------
  function afterChange() {
    probe = null; hovered = null;
    applyLayout(w);
    build();
    emit();
  }
  function setRegion(id) { if (id === region) return; region = id; pinned = null; updateRegionButtons(region); afterChange(); }
  function setInterval_(id) { if (id === interval) return; interval = id; pinned = null; updateIntervalButtons(interval); afterChange(); }
  function setMeasure(id) { if (id === measure) return; measure = id; updateMeasureButtons(measure); afterChange(); }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const c = current;
    const i = c ? (pinned ?? c.st.n - 1) : -1;
    return {
      region, interval, measure, selected,
      at: c && i >= 0 ? {
        step: stepLabel(c.st, i), generatedGWh: Math.round(c.total[i]),
        shares: Object.fromEntries(c.rows.filter(r => r.g.kind === "source" && r.present).map(r => [r.g.id, Math.round(c.share(r, i) * 10) / 10])),
      } : null,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- formatting -----------------------------------------------------------------------------
  function stepLabel(st, i) {
    const d = st.dates[i];
    return st.kind === "year" ? `${d.getUTCFullYear()}` : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  function spanLabel(st) {
    return `${stepLabel(st, 0)} to ${stepLabel(st, st.n - 1)}`;
  }

  // ---- go -------------------------------------------------------------------------------------
  updateRegionButtons(region);
  updateIntervalButtons(interval);
  updateMeasureButtons(measure);
  build();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); build(); }
    });
    ro.observe(container);
  }
  return container;
}

// ---- helpers --------------------------------------------------------------------------------
// A segmented control: the choices as one row of joined buttons, rounded at the ends, the one
// chosen dark with white type. Returns a function that marks the current choice.
export function segmented(parent, choices, onPick) {
  const box = document.createElement("div");
  box.setAttribute("role", "group");
  box.style.cssText = "display:inline-flex;flex-wrap:wrap;border-radius:999px;";
  const buttons = choices.map((choice, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = choice.label;
    if (choice.title) b.title = choice.title;
    b.style.cssText = "font:13px sans-serif;padding:5px 12px;cursor:pointer;white-space:nowrap;border:1px solid #333;" +
      `margin-left:${i ? -1 : 0}px;border-radius:${i === 0 ? "999px 0 0 999px" : i === choices.length - 1 ? "0 999px 999px 0" : "0"};` +
      "transition:background-color .15s,color .15s;";
    b.addEventListener("click", () => onPick(choice.id));
    box.appendChild(b);
    return b;
  });
  parent.appendChild(box);
  return current => buttons.forEach((b, i) => {
    const active = choices[i].id === current;
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.style.position = active ? "relative" : "static";   // the dark one's border over its neighbours'
    b.setAttribute("aria-pressed", String(active));
  });
}

export function formatGwh(v) {
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 10) return v.toFixed(1);
  if (a === 0) return "0";
  return v.toFixed(2);
}
export function formatPct(p) {
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}
function niceStep(v) {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
