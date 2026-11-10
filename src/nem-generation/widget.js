// Electricity generation by source in Australia's National Electricity Market, or in one of its
// five regions, or in Western Australia's grid: a stacked area of each fuel technology's
// energy, week by week over the last year, month by month over five years or since the market
// began in December 1998, or year by year, as a share of what was generated or in gigawatt
// hours. Pumping, battery charging and exports draw energy from the grid, so in GWh they hang
// below zero and in shares they are left out, as are imports, which are not generation.
// Click a source in the key to hide or show it (or "All" to bring them back); the Renewables
// switch lays the share of hydro, wind, solar and bioenergy over the top as a line; Simple
// gathers the sources into coal, gas, hydro, wind, solar, batteries and other. Hover (or
// touch) a week, month or year for every source's energy and share. Drawn in the style of the
// Hickman and climate-funds widgets: a grey plate, a bold title in the corner, quiet gridlines
// with their labels on them, dark pill buttons, and the source in small type at the bottom
// right. The data are Open Electricity's (CC BY-NC 4.0), bundled by scripts/nem-generation.mjs
// and refreshed monthly. Self-contained: no d3, no imports.
//
// Options: {region: "NEM" | "NSW1" | "QLD1" | "SA1" | "TAS1" | "VIC1" | "WEM"} (short forms
// like "sa" and "nsw" work too), {period: "1y" | "5y" | "all" | "all-yearly"} (or {range,
// interval} as the embed URL has them), {measure: "share" | "gwh"}, {grouping: "detailed" |
// "simple"}, {only: ["wind"]} or {hide: [...]} to isolate or hide sources (fuel technologies
// or groups), {renewables: true} for the overlay; {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const GRID = "#b3b3b3";
const LINK = "#0b57d0";
const RENEWABLES_COLOUR = "#1b7f3b";
const CHART_H = 250;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PERIODS = [
  {id: "1y", label: "Last year", sub: "by week", title: "The last 52 weeks, week by week"},
  {id: "5y", label: "5 years", sub: "by month", title: "The last five years, month by month"},
  {id: "all", label: "All years", sub: "by month", title: "Since the record begins, month by month"},
  {id: "all-yearly", label: "All years", sub: "by year", title: "Since the record begins, calendar year by year"},
];
export const MEASURES = [
  {id: "share", label: "Share of generation", title: "Each source as a percentage of the electricity generated"},
  {id: "gwh", label: "GWh", title: "Gigawatt hours; pumping, battery charging and exports below zero"},
];
export const GROUPINGS = [
  {id: "detailed", label: "Detailed", title: "Every fuel technology Open Electricity reports"},
  {id: "simple", label: "Simple", title: "Coal, gas, hydro, wind, solar, batteries and other"},
];

// The simple grouping: each group's id, name and colour; sources and loads keep apart.
const GROUPS = {
  coal: {label: "Coal", colour: "#251C00"},
  gas: {label: "Gas", colour: "#E78114"},
  other: {label: "Other (bioenergy, distillate)", colour: "#0B757C"},
  batteries: {label: "Batteries", colour: "#3145CE"},
  hydro: {label: "Hydro", colour: "#ACE9FE"},
  wind: {label: "Wind", colour: "#2A7E3F"},
  solar: {label: "Solar", colour: "#FECE00"},
  exchange: {label: "Imports", colour: "#CFA7FF"},
};
const REGION_ALIASES = {nem: "NEM", _all: "NEM", all: "NEM", nsw: "NSW1", qld: "QLD1", sa: "SA1", tas: "TAS1", vic: "VIC1", wa: "WEM", swis: "WEM"};

export function createNemGenerationWidget({
  data, width = FIGURE_WIDTH, region: initialRegion, period: initialPeriod, range, interval,
  measure: initialMeasure, grouping: initialGrouping, only, hide, renewables: initialRenewables = false,
} = {}) {
  if (!data?.regions || !data?.fuelTechs) throw new Error("createNemGenerationWidget needs {data}: the contents of nem-generation.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- data -----------------------------------------------------------------------------------
  const fuelTechs = data.fuelTechs;
  const fuelById = new Map(fuelTechs.map(f => [f.id, f]));
  const regionById = new Map(data.regions.map(r => [r.id, r]));

  // ---- state ----------------------------------------------------------------------------------
  let region = resolveRegion(initialRegion) ?? "NEM";
  let period = PERIODS.some(p => p.id === initialPeriod) ? initialPeriod : periodFrom(range, interval);
  let measure = MEASURES.some(m => m.id === initialMeasure) ? initialMeasure : "share";
  let grouping = GROUPINGS.some(g => g.id === initialGrouping) ? initialGrouping : "detailed";
  let renewables = !!initialRenewables;
  const hidden = new Set();
  let hoverIndex = null;

  function resolveRegion(id) {
    if (!id) return null;
    const s = String(id).trim();
    if (regionById.has(s.toUpperCase())) return s.toUpperCase();
    return REGION_ALIASES[s.toLowerCase()] ?? null;
  }
  function periodFrom(range, interval) {
    const r = String(range ?? "").toLowerCase(), i = String(interval ?? "").toLowerCase();
    if (r === "5y") return "5y";
    if (r === "all" || r === "10y" || r === "20y") return i === "1y" || i === "yearly" || i === "year" ? "all-yearly" : "all";
    return "1y";
  }

  // ---- the series on screen -------------------------------------------------------------------
  // The series for the grouping: in detailed mode each fuel technology, in simple mode the
  // groups, each with its members, in stacking order (loads first, then sources from the
  // bottom of the stack up). The stacking goes by the data file's order of fuel technologies.
  function seriesList() {
    if (grouping === "detailed") return fuelTechs.map(f => ({...f, members: [f.id]}));
    const list = [], seen = new Map();
    for (const f of fuelTechs) {
      const key = f.kind === "source" ? f.group : f.kind === "imports" ? "exchange" : `load:${f.id}`;
      let s = seen.get(key);
      if (!s) {
        s = f.kind === "source" ? {id: f.group, label: GROUPS[f.group]?.label ?? f.group, colour: GROUPS[f.group]?.colour ?? f.colour, kind: "source",
            renewable: f.renewable, members: []}
          : f.kind === "imports" ? {id: "imports", label: "Imports", colour: f.colour, kind: "imports", members: []}
          : {id: f.id, label: f.label, colour: f.colour, kind: "load", members: []};
        seen.set(key, s);
        list.push(s);
      }
      s.members.push(f.id);
    }
    return list;
  }

  // The time steps for the region and period, each a label and a value per fuel technology.
  // Weekly from the API's 52 weeks; monthly from the history, the last 60 months or all;
  // yearly as sums of complete calendar years.
  function steps() {
    const r = regionById.get(region);
    const values = {};
    let labels, kind;
    if (period === "1y") {
      kind = "week";
      const [y, m, d] = r.weekly.start.split("-").map(Number);
      const n = Object.values(r.weekly.values)[0]?.length ?? 0;
      labels = Array.from({length: n}, (_, i) => new Date(Date.UTC(y, m - 1, d + 7 * i)));
      for (const f of fuelTechs) values[f.id] = r.weekly.values[f.id] ?? null;
    } else {
      const [y0, m0] = r.monthly.start.split("-").map(Number);
      const n = Object.values(r.monthly.values)[0]?.length ?? 0;
      const months = Array.from({length: n}, (_, i) => new Date(Date.UTC(y0, m0 - 1 + i, 1)));
      if (period === "all-yearly") {
        kind = "year";
        // Complete calendar years only.
        const years = [];
        for (let i = 0; i < n; i++) {
          const dt = months[i];
          if (dt.getUTCMonth() === 0 && i + 11 < n) years.push({year: dt.getUTCFullYear(), i0: i});
        }
        labels = years.map(yr => new Date(Date.UTC(yr.year, 0, 1)));
        for (const f of fuelTechs) {
          const src = r.monthly.values[f.id];
          values[f.id] = src ? years.map(yr => { let s = 0, any = false; for (let i = yr.i0; i < yr.i0 + 12; i++) if (src[i] !== null) { s += src[i]; any = true; } return any ? s : null; }) : null;
        }
      } else {
        kind = "month";
        const from = period === "5y" ? Math.max(0, n - 60) : 0;
        labels = months.slice(from);
        for (const f of fuelTechs) values[f.id] = r.monthly.values[f.id]?.slice(from) ?? null;
      }
    }
    return {kind, labels, values, n: labels.length};
  }

  // Stacks the series for the current state: per step, every series' value (GWh, or % of the
  // generation), the generation total, and the renewable share. Hidden series are dropped
  // from the stack but not from the totals, so a share stays a share of everything generated.
  function compute() {
    const st = steps();
    const list = seriesList();
    const rows = list.map(s => ({s, v: new Array(st.n).fill(0), present: false}));
    for (const row of rows) {
      for (const id of row.s.members) {
        const arr = st.values[id];
        if (!arr) continue;
        for (let i = 0; i < st.n; i++) if (arr[i] !== null && arr[i] !== undefined) { row.v[i] += arr[i]; row.present = true; }
      }
    }
    const present = rows.filter(r => r.present);
    const total = new Array(st.n).fill(0), green = new Array(st.n).fill(0);
    for (const row of present) {
      if (row.s.kind !== "source") continue;
      for (let i = 0; i < st.n; i++) {
        const v = Math.max(0, row.v[i]);
        total[i] += v;
        if (row.s.renewable) green[i] += v;
      }
    }
    const share = (row, i) => total[i] > 0 ? 100 * Math.max(0, row.v[i]) / total[i] : 0;
    const drawn = present.filter(row => !hidden.has(row.s.id) && (measure === "gwh" || row.s.kind === "source"));
    // Stack: sources upwards from zero, loads downwards.
    const up = new Array(st.n).fill(0), down = new Array(st.n).fill(0);
    for (const row of drawn) {
      row.y0 = new Array(st.n); row.y1 = new Array(st.n);
      for (let i = 0; i < st.n; i++) {
        const v = measure === "share" ? share(row, i) : row.v[i];
        if (row.s.kind === "load") { row.y1[i] = -down[i]; down[i] += Math.max(0, v); row.y0[i] = -down[i]; }
        else { row.y0[i] = up[i]; up[i] += Math.max(0, v); row.y1[i] = up[i]; }
      }
    }
    const renewShare = total.map((t, i) => t > 0 ? 100 * green[i] / t : null);
    return {st, list, rows, present, drawn, total, renewShare, share, up, down};
  }

  // ---- layout ---------------------------------------------------------------------------------
  const ctx = document.createElement("canvas").getContext("2d");
  function textWidth(text, px, weight = "normal") {
    ctx.font = `${weight} ${px}px sans-serif`;
    return ctx.measureText(text).width;
  }
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, titleFont, sourceFont, tickFont;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = lerp(16, 22);
    sourceFont = lerp(7.5, 9);
    tickFont = lerp(10, 11);
    plotL = 8;
    plotR = w - (renewables && measure === "gwh" ? 36 : 8);
    plotT = 14;
    plotB = plotT + CHART_H;
    // Room under the axis for the source line, which wraps onto two lines when narrow.
    svgH = plotB + 26 + sourceFont + 10 + (w < 480 ? sourceFont + 4 : 0);
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px ${CARD_PAD}px ${CARD_PAD}px;` +
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;position:relative;`;

  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 2px;";
  container.appendChild(heading);
  const subheading = document.createElement("div");
  subheading.style.cssText = "font-size:12px;color:#666;padding:0 0 10px;";
  container.appendChild(subheading);

  const PILL = "font:13px sans-serif;padding:5px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;" +
    "display:inline-flex;align-items:center;gap:6px;transition:background-color .15s,color .15s,border-color .15s,opacity .15s;";
  function stylePill(b, active, enabled = true) {
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.style.opacity = enabled ? "1" : "0.4";
    b.style.cursor = enabled ? "pointer" : "default";
    b.setAttribute("aria-pressed", String(active));
    b.setAttribute("aria-disabled", String(!enabled));
  }
  function buttonRow(parent, choices, onPick, render = c => c.label) {
    const buttons = choices.map(choice => {
      const b = document.createElement("button");
      b.type = "button";
      const r = render(choice);
      if (typeof r === "string") b.textContent = r; else b.append(...r);
      if (choice.title) b.title = choice.title;
      b.style.cssText = PILL;
      b.addEventListener("click", () => onPick(choice.id));
      parent.appendChild(b);
      return b;
    });
    return current => buttons.forEach((b, i) => stylePill(b, choices[i].id === current));
  }
  const row = (gap = "6px") => {
    const d = document.createElement("div");
    d.style.cssText = `display:flex;flex-wrap:wrap;align-items:center;gap:${gap};padding:0 0 6px;`;
    container.appendChild(d);
    return d;
  };
  const regionRow = row();
  const updateRegionButtons = buttonRow(regionRow, data.regions.map(r => ({id: r.id, label: r.short, title: r.name})), setRegion);
  const periodRow = row();
  const updatePeriodButtons = buttonRow(periodRow, PERIODS, setPeriod, p => {
    const small = document.createElement("span");
    small.textContent = p.sub;
    small.style.cssText = "font-size:11px;opacity:.75;";
    return [document.createTextNode(p.label + " "), small];
  });
  const optionsRow = row("6px 14px");
  const measureGroup = document.createElement("div");
  measureGroup.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  const updateMeasureButtons = buttonRow(measureGroup, MEASURES, setMeasure);
  const groupingGroup = document.createElement("div");
  groupingGroup.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  const updateGroupingButtons = buttonRow(groupingGroup, GROUPINGS, setGrouping);
  const renewablesButton = document.createElement("button");
  renewablesButton.type = "button";
  renewablesButton.style.cssText = PILL;
  renewablesButton.title = "Lay the share of hydro, wind, solar and bioenergy over the chart as a line";
  const renewSwatch = document.createElement("span");
  renewSwatch.style.cssText = `width:14px;height:0;border-top:2px solid ${RENEWABLES_COLOUR};flex:none;`;
  renewablesButton.append(renewSwatch, "Renewables");
  renewablesButton.addEventListener("click", () => { renewables = !renewables; afterChange(); });
  optionsRow.append(measureGroup, groupingGroup, renewablesButton);

  // The key: one pill per series on screen, clicked to hide or show it, and "All".
  const key = document.createElement("div");
  key.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:2px 0 8px;";
  container.appendChild(key);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "nem-generation");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;position:relative;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // The read-out that follows the pointer, an HTML box over the chart.
  const tip = document.createElement("div");
  tip.style.cssText = "position:absolute;display:none;z-index:2;pointer-events:none;background:rgba(255,255,255,0.96);color:#222;" +
    "font:11px/1.35 sans-serif;padding:6px 8px;border-radius:4px;border:1px solid #ddd;box-shadow:0 1px 4px rgba(0,0,0,.12);white-space:nowrap;";
  scroller.appendChild(tip);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const F = v => (Math.round(v * 100) / 100).toString();

  // ---- drawing --------------------------------------------------------------------------------
  let plate, gridGroup, areaGroup, labelGroup, lineGroup, axisGroup, hoverGroup, sourceGroup, hitRect;
  let current = null;   // the last compute(), for the hover
  let yMin = 0, yMax = 100, xOf, yOf;

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    plate = svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    gridGroup = svgEl("g", {"pointer-events": "none"}, svg);
    areaGroup = svgEl("g", {}, svg);
    // The gridlines' labels sit over the areas, with a halo of the plate's grey, so a stack
    // that fills the plot does not hide them.
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "stroke-linejoin": "round"}, svg);
    lineGroup = svgEl("g", {"pointer-events": "none"}, svg);
    axisGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    hoverGroup = svgEl("g", {"pointer-events": "none"}, svg);
    hitRect = svgEl("rect", {x: F(plotL), y: F(plotT), width: F(plotR - plotL), height: F(CHART_H), fill: "transparent", cursor: "crosshair"}, svg);
    sourceGroup = svgEl("g", {"font-family": "sans-serif"}, svg);
    render();
  }

  function render() {
    const c = compute();
    current = c;
    const {st, drawn, up, down, renewShare} = c;
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
    const r = regionById.get(region);
    heading.textContent = `Electricity generation in ${r.id === "NEM" ? "the " : ""}${r.name}`;
    subheading.textContent = `${PERIODS.find(p => p.id === period).title}, ${spanLabel(st)}; ` +
      (measure === "share" ? "each source as a share of the electricity generated" : "gigawatt hours per " + st.kind);

    // Scales: the x axis has a slot per step; y runs from the deepest load to the tallest stack.
    const n = st.n;
    const slot = (plotR - plotL) / Math.max(1, n);
    xOf = i => plotL + (i + 0.5) * slot;
    const top = measure === "share" ? 100 : Math.max(1, ...up);
    const bottom = measure === "share" ? 0 : -Math.max(0, ...down);
    const yStep = niceStep((top - bottom) / 5);
    yMax = measure === "share" ? 100 : Math.ceil(top / yStep) * yStep;
    yMin = measure === "share" ? 0 : Math.floor(bottom / yStep) * yStep;
    yOf = v => plotB - (v - yMin) / (yMax - yMin) * CHART_H;

    // Gridlines with their labels on them, grey, no spine.
    gridGroup.replaceChildren();
    labelGroup.replaceChildren();
    for (let v = yMin; v <= yMax + 1e-9; v += yStep) {
      const y = yOf(v);
      svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: v === 0 ? "#888" : GRID, "stroke-width": v === 0 ? 1 : 0.8}, gridGroup);
      const tl = svgEl("text", {x: F(plotL + 2), y: F(y - 3), "font-size": tickFont, fill: "#666"}, labelGroup);
      tl.textContent = measure === "share" ? `${Math.round(v)}%` : formatGwh(v);
    }
    if (renewables && measure === "gwh") {
      for (let p = 0; p <= 100; p += 25) {
        const y = plotB - p / 100 * CHART_H;
        const tl = svgEl("text", {x: F(plotR + 4), y: F(y + 3.5), "font-size": tickFont, fill: RENEWABLES_COLOUR}, labelGroup);
        tl.textContent = `${p}%`;
      }
    }

    // The areas, one path per series: along the top forward, back along the bottom.
    areaGroup.replaceChildren();
    for (const row of drawn) {
      let d = "";
      for (let i = 0; i < n; i++) d += `${i ? "L" : "M"}${F(xOf(i))},${F(yOf(row.y1[i]))}`;
      for (let i = n - 1; i >= 0; i--) d += `L${F(xOf(i))},${F(yOf(row.y0[i]))}`;
      d += "Z";
      const path = svgEl("path", {d, fill: row.s.colour, "data-id": row.s.id}, areaGroup);
      svgEl("title", {}, path).textContent = row.s.label;
    }

    // The renewables line, on the share axis (the left one in share mode, the right in GWh).
    lineGroup.replaceChildren();
    if (renewables) {
      const yPct = p => measure === "share" ? yOf(p) : plotB - p / 100 * CHART_H;
      let d = "", pen = false;
      for (let i = 0; i < n; i++) {
        const p = renewShare[i];
        if (p === null) { pen = false; continue; }
        d += `${pen ? "L" : "M"}${F(xOf(i))},${F(yPct(p))}`;
        pen = true;
      }
      svgEl("path", {d, fill: "none", stroke: "#fff", "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round", opacity: 0.7}, lineGroup);
      svgEl("path", {d, fill: "none", stroke: RENEWABLES_COLOUR, "stroke-width": 1.8, "stroke-linejoin": "round", "stroke-linecap": "round"}, lineGroup);
      const last = [...renewShare].reverse().findIndex(p => p !== null);
      if (last >= 0) {
        const i = n - 1 - last;
        const tx = svgEl("text", {x: F(Math.min(xOf(i) + 4, plotR - 2)), y: F(yPct(renewShare[i]) - 6), "font-size": 11, "font-weight": "bold", fill: RENEWABLES_COLOUR,
          "text-anchor": xOf(i) + 60 > plotR ? "end" : "start", "paint-order": "stroke", stroke: "#fff", "stroke-width": 3}, lineGroup);
        tx.textContent = `Renewables ${Math.round(renewShare[i])}%`;
      }
    }

    drawXAxis(st, slot);
    drawSources();
    updateKey(c);
    drawHover();
    describe(c);
  }

  // Time ticks: for weeks, the months (the year at January); for months, the years, thinned
  // to fit; for years, every year, five or ten.
  function drawXAxis(st, slot) {
    axisGroup.replaceChildren();
    const y = plotB + 14;
    const ticks = [];
    if (st.kind === "week") {
      let lastMonth = -1;
      st.labels.forEach((d, i) => {
        const m = d.getUTCMonth();
        if (m !== lastMonth) { lastMonth = m; if (i > 0 || d.getUTCDate() <= 7) ticks.push({i, label: m === 0 ? `${d.getUTCFullYear()}` : MONTHS[m], minor: true}); }
      });
      const every = Math.ceil(ticks.length * 34 / (plotR - plotL));
      ticks.forEach((t, k) => { t.minor = k % every !== 0; });
    } else {
      const years = st.labels.map(d => d.getUTCFullYear());
      const firstIdx = new Map();
      years.forEach((yr, i) => { if (!firstIdx.has(yr) && (st.kind === "year" || st.labels[i].getUTCMonth() === 0)) firstIdx.set(yr, i); });
      const nYears = firstIdx.size;
      const every = [1, 2, 5, 10].find(e => (nYears / e) * 40 <= plotR - plotL) ?? 10;
      for (const [yr, i] of firstIdx) ticks.push({i, label: `${yr}`, minor: yr % every !== 0});
    }
    for (const t of ticks) {
      const x = st.kind === "year" ? xOf(t.i) : xOf(t.i) - slot / 2;
      svgEl("path", {d: `M${F(x)},${F(plotB)}v${t.minor ? 3 : 5}`, stroke: GRID, "stroke-width": 1}, axisGroup);
      if (t.minor) continue;
      const tl = svgEl("text", {x: F(x), y: F(y), "font-size": tickFont, fill: "#666", "text-anchor": st.kind === "year" ? "middle" : "start"}, axisGroup);
      tl.textContent = t.label;
    }
    svgEl("path", {d: `M${F(plotL)},${F(plotB)}H${F(plotR)}`, stroke: "#888", "stroke-width": 1}, axisGroup);
  }

  // The source line at the bottom right, Open Electricity's licence as it asks, wrapped
  // into two lines where the width needs it, a piece never split.
  function drawSources() {
    sourceGroup.replaceChildren();
    const pieces = [
      {text: "Data: "},
      {text: `Open Electricity (The Superpower Institute)`, url: data.source?.url ?? "https://openelectricity.org.au/"},
      {text: ", "},
      {text: data.source?.licence ?? "CC BY-NC 4.0", url: data.source?.licenceUrl},
      {text: `, to ${lastStepLabel(current.st)}`},
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
    // Each line is one text element, right-aligned by the browser itself, its pieces tspans.
    lines.forEach((ln, i) => {
      const tx = svgEl("text", {x: F(plotR), y: F(y0 + i * lineH), "text-anchor": "end", "font-size": sourceFont.toFixed(1), fill: "#808080", "xml:space": "preserve"}, sourceGroup);
      for (const p of ln) {
        let parent = tx;
        if (p.url) {
          parent = svgEl("a", {href: p.url, target: "_blank", rel: "noopener"}, tx);
          parent.style.cssText = "cursor:pointer;";
        }
        const span = svgEl("tspan", p.url ? {fill: LINK, "text-decoration": "underline"} : {}, parent);
        span.textContent = p.text;
      }
    });
  }

  // The key: a swatch and name per series present, with its average share over the window
  // when shares are shown; faded when hidden. "All" brings every source back.
  function updateKey(c) {
    key.replaceChildren();
    const all = document.createElement("button");
    all.type = "button";
    all.textContent = "All";
    all.style.cssText = PILL + "padding:3px 9px;font-size:12px;";
    stylePill(all, hidden.size === 0);
    all.addEventListener("click", () => { hidden.clear(); afterChange(); });
    key.appendChild(all);
    const n = c.st.n;
    for (const row of c.present) {
      if (measure === "share" && row.s.kind !== "source") continue;
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = PILL + "padding:3px 9px 3px 7px;font-size:12px;";
      const sw = document.createElement("span");
      sw.style.cssText = `width:11px;height:11px;border-radius:2px;background:${row.s.colour};flex:none;`;
      let text = row.s.label;
      if (row.s.kind === "source" && measure === "share") {
        const tot = c.total.reduce((s, v) => s + v, 0);
        const mine = row.v.reduce((s, v) => s + Math.max(0, v), 0);
        if (tot > 0) text += ` ${formatPct(100 * mine / tot)}`;
      }
      b.append(sw, text);
      b.title = hidden.has(row.s.id) ? `Show ${row.s.label}` : `Hide ${row.s.label}`;
      stylePill(b, false, !hidden.has(row.s.id));
      b.style.textDecoration = hidden.has(row.s.id) ? "line-through" : "none";
      b.addEventListener("click", () => { if (hidden.has(row.s.id)) hidden.delete(row.s.id); else hidden.add(row.s.id); afterChange(); });
      key.appendChild(b);
    }
  }

  // ---- hover ----------------------------------------------------------------------------------
  function drawHover() {
    hoverGroup.replaceChildren();
    const c = current;
    if (hoverIndex === null || !c || hoverIndex >= c.st.n) { tip.style.display = "none"; return; }
    const i = hoverIndex;
    const x = xOf(i);
    svgEl("path", {d: `M${F(x)},${F(plotT)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": "3 3"}, hoverGroup);
    // The read-out: the step, then each drawn series from the top of the stack down.
    const lines = [`<b>${stepLabel(c.st, i)}</b>`];
    const sources = c.present.filter(r => r.s.kind === "source" && !hidden.has(r.s.id)).reverse();
    for (const r of sources) {
      const v = r.v[i];
      lines.push(`<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${r.s.colour};margin-right:5px;vertical-align:-1px"></span>` +
        `${r.s.label}: <b>${formatPct(c.share(r, i))}</b> · ${formatGwh(v)} GWh`);
    }
    if (measure === "gwh") {
      for (const r of c.present.filter(r => r.s.kind !== "source" && !hidden.has(r.s.id))) {
        lines.push(`<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${r.s.colour};margin-right:5px;vertical-align:-1px"></span>` +
          `${r.s.label}: ${formatGwh(r.v[i])} GWh${r.s.kind === "load" ? " drawn" : ""}`);
      }
    }
    lines.push(`<span style="color:#666">Generated: ${formatGwh(c.total[i])} GWh` +
      (c.renewShare[i] !== null ? ` · renewables ${formatPct(c.renewShare[i])}` : "") + "</span>");
    tip.innerHTML = lines.join("<br>");
    tip.style.display = "block";
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const left = x + 12 + tw > w ? Math.max(0, x - 12 - tw) : x + 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, Math.min(plotT + 6, svgH - th))}px`;
  }

  function indexAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (w / rect.width);
    if (!current) return null;
    const slot = (plotR - plotL) / Math.max(1, current.st.n);
    return clamp(Math.floor((x - plotL) / slot), 0, current.st.n - 1);
  }
  svg.addEventListener("pointermove", e => {
    const i = indexAt(e.clientX);
    if (i !== hoverIndex) { hoverIndex = i; drawHover(); }
  });
  svg.addEventListener("pointerdown", e => {
    const i = indexAt(e.clientX);
    hoverIndex = i === hoverIndex && e.pointerType !== "mouse" ? null : i;
    drawHover();
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse") return;
    hoverIndex = null;
    drawHover();
  });

  // ---- read-out for assistive technology -------------------------------------------------------
  function describe(c) {
    const r = regionById.get(region);
    const tot = c.total.reduce((s, v) => s + v, 0);
    const parts = c.present.filter(x => x.s.kind === "source").map(x => ({name: x.s.label, share: 100 * x.v.reduce((s, v) => s + Math.max(0, v), 0) / (tot || 1)}))
      .sort((a, b) => b.share - a.share).slice(0, 5).map(p => `${p.name} ${formatPct(p.share)}`).join(", ");
    svg.setAttribute("aria-label", `Electricity generation by source in ${r.name}, ${PERIODS.find(p => p.id === period).title.toLowerCase()}, as stacked areas. ` +
      `Over the period shown the largest sources are ${parts}.`);
  }

  // ---- state changes --------------------------------------------------------------------------
  function afterChange() {
    hoverIndex = null;
    applyLayout(w);
    stylePill(renewablesButton, renewables);
    build();
    emit();
  }
  function setRegion(id) { if (id === region) return; region = id; updateRegionButtons(region); afterChange(); }
  function setPeriod(id) { if (id === period) return; period = id; updatePeriodButtons(period); afterChange(); }
  function setMeasure(id) { if (id === measure) return; measure = id; updateMeasureButtons(measure); afterChange(); }
  function setGrouping(id) { if (id === grouping) return; grouping = id; hidden.clear(); updateGroupingButtons(grouping); afterChange(); }

  // `only` and `hide` from the options: fuel technologies or groups, by id, in either grouping.
  function applyIsolation() {
    const list = seriesList();
    const matches = (s, name) => s.id === name || s.members.includes(name) || fuelById.get(s.members[0])?.group === name;
    const names = arr => (Array.isArray(arr) ? arr : String(arr).split(",")).map(x => x.trim().toLowerCase()).filter(Boolean);
    if (only) {
      const keep = names(only);
      for (const s of list) if (!keep.some(k => matches(s, k))) hidden.add(s.id);
    }
    if (hide) for (const s of list) if (names(hide).some(k => matches(s, k))) hidden.add(s.id);
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const c = current;
    const i = c ? c.st.n - 1 : -1;
    return {
      region, period, measure, grouping, renewables, hidden: [...hidden],
      latest: c && i >= 0 ? {step: stepLabel(c.st, i), generatedGWh: Math.round(c.total[i]), renewablesShare: c.renewShare[i] === null ? null : Math.round(c.renewShare[i] * 10) / 10} : null,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- formatting -----------------------------------------------------------------------------
  function stepLabel(st, i) {
    const d = st.labels[i];
    if (st.kind === "year") return `${d.getUTCFullYear()}`;
    if (st.kind === "month") return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const end = new Date(d.getTime() + 6 * 86400e3);
    return `Week of ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${d.getUTCFullYear() !== end.getUTCFullYear() ? ` ${d.getUTCFullYear()}` : ""} to ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }
  function lastStepLabel(st) {
    const d = st.labels[st.n - 1];
    if (st.kind === "year") return `${d.getUTCFullYear()}`;
    if (st.kind === "month") return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    const end = new Date(d.getTime() + 6 * 86400e3);
    return `${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }
  function spanLabel(st) {
    const a = st.labels[0], b = st.labels[st.n - 1];
    if (st.kind === "year") return `${a.getUTCFullYear()} to ${b.getUTCFullYear()}`;
    if (st.kind === "month") return `${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()} to ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    const end = new Date(b.getTime() + 6 * 86400e3);
    return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()} to ${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }

  // ---- go -------------------------------------------------------------------------------------
  applyIsolation();
  updateRegionButtons(region);
  updatePeriodButtons(period);
  updateMeasureButtons(measure);
  updateGroupingButtons(grouping);
  stylePill(renewablesButton, renewables);
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
export function formatGwh(v) {
  const a = Math.abs(v);
  if (a >= 10000) return Math.round(v).toLocaleString("en-US");
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
