// The carbon budget — every gigatonne of CO₂ humanity has emitted since 1850, and the ones it
// can still emit, as a grid of squares that fills up over time. A square is a billion tonnes
// of CO₂ (1 GtCO₂). The grid is 60 squares wide and fills from the bottom up along a snake,
// one row left to right, the next right to left, so that a run of squares is always one
// connected block; the past sits at the bottom and what is left sits above it in grey. The
// remaining budgets for 1.5, 1.7 and 2 °C of warming are staircase lines across the grey,
// labelled at the right, and the grid stops at the 2 °C line: what would be emitted beyond it
// is not drawn.
//
// The fill can be laid out two ways. By region, the default, it is a stack: every square Asia
// has emitted, then Europe's, North America's, South America's, Africa's, the Middle East's
// and the rest of the world's, each region one colour and growing as the years pass, so that
// at any year the picture is a stacked bar of who has emitted what. Inside a region the
// countries are columns across the region's block, largest first from the left, each holding
// its share of the block's area, so every square belongs to a country and a country is a
// block rather than a thin run; hovering one outlines that country's whole contribution and
// names it. By year (or by decade) the fill is chronological instead: each year's emissions
// are one band, one level per year on a warm ramp from pale for 1850 to dark for the latest
// years (or one tab20 colour per decade), never a gradient. Either way the fill's height is
// the same, since it is the same squares, and a square that a year or a country only partly
// fills is cut at the exact fraction: nothing is rounded to fit the grid.
//
// The year slider runs the fill from 1850 to 2025, the last year the Global Carbon Budget
// covers; nothing is drawn that has not happened. Left alone, the figure plays the years
// through at a steady pace once the reader has scrolled to it, rests on the present, and goes
// round again. A click or a touch of the slider stops it; Play tour starts it again.
//
// The remaining budgets are from the beginning of 2026 at a 50 % likelihood, and the data
// file carries two versions of them, both as the Global Carbon Budget brings them forward to
// 2026: Forster et al. (2025), the more recent, which is the default, and the IPCC AR6
// budgets of 2021. Switching between them moves the three lines; the past does not move. The
// whole timeline is computed from the data file (budgetSeries, budgetThresholds), and both are
// exported so the page can print the same numbers the figure is drawn with.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.

const COLUMNS = 60;
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const GRID_MAX = 520;  // the grid's width cap, px; narrower figures shrink it
const ACCENT = "#0b57d0";
const EPS = 1e-9;

export const COLOUR_MODES = ["none", "region", "year", "decade"];

// Regions in the Okabe–Ito palette, which is safe for every kind of colour-vision
// deficiency; its pale yellow is left out because it vanishes against the white lattice, and
// the rest of the world is a grey darker than the unspent budget's. Time is coloured in
// discrete steps, never a gradient: one level per year in the year layout, sampled from the
// ramp below from pale for 1850 to dark for the latest years, so the recent past reads as
// the dark mass it is; and one of the eighteen tab20 colours per decade in the decade layout.
// With no colouring, the default, the fill is a plain dark grey. What is left is a lighter
// grey, a shade lighter again for each budget beyond the first.
export const COLOURS = {
  regions: {asia: "#D55E00", europe: "#0072B2", namerica: "#E69F00", samerica: "#009E73", africa: "#CC79A7", mideast: "#56B4E9", rest: "#7a7a7a"},
  ramp: ["#fde3b0", "#f8b95c", "#ee7f2f", "#d9482a", "#b0202f", "#7a1140", "#3d0c33"],
  // Decades: tab20's nine vibrant pairs (its grey pair left out), a dark and a light of one
  // hue each, ordered from cold to warm, so that a pair is twenty years and neighbouring
  // decades never share a hue.
  decades: [
    "#9467bd", "#c5b0d5",   // purple
    "#1f77b4", "#aec7e8",   // blue
    "#17becf", "#9edae5",   // cyan
    "#2ca02c", "#98df8a",   // green
    "#bcbd22", "#dbdb8d",   // olive
    "#ff7f0e", "#ffbb78",   // orange
    "#8c564b", "#c49c94",   // brown
    "#d62728", "#ff9896",   // red
    "#e377c2", "#f7b6d2",   // pink
  ],
  bands: ["#c9c9c9", "#d9d9d9", "#e7e7e7"],
  plain: "#4a4a4a",
  line: "#222",
};
const YEAR_CLASS = 1;   // the year layout has one level per year; decades one per decade
const FALLBACK_REGION = "#8c7a4e";

// ---- the numbers -------------------------------------------------------------------------------

// The years in order, each with the world's emissions in GtCO₂ and its [start, end) position
// in the chronological fill, which runs from zero at the start of 1850; and the regions, each
// with its countries, every one carrying its emissions by year (`byYear`) and its cumulative
// total at the end of each year (`cumulative`), the region's own being the sums. The last
// country of the last region absorbs the rounding so that the countries sum to the world's
// total exactly. `used` is the fill at the end of the data, where the remaining budgets are
// counted from.
export function budgetSeries(data) {
  const years = data.years.map(d => ({...d, total: d.fossil + d.landUse}));
  const nData = years.length;
  let pos = 0;
  for (const y of years) {
    y.start = pos;
    pos += y.total;
    y.end = pos;
  }
  const used = pos;
  const last = years[nData - 1];
  const n = nData;
  const regions = (data.regions ?? []).map(r => ({
    ...r,
    countries: r.countries.map(c => ({...c, byYear: years.map((y, k) => Math.max(0, c.byYear[k] ?? 0))})),
  }));
  const allCountries = regions.flatMap(r => r.countries);
  const fudge = allCountries[allCountries.length - 1];
  for (let k = 0; k < n && fudge; k++) {
    const sum = allCountries.reduce((s, c) => s + c.byYear[k], 0);
    fudge.byYear[k] = Math.max(0, fudge.byYear[k] + years[k].total - sum);
  }
  const cumulate = byYear => {
    const out = [];
    let c = 0;
    for (const v of byYear) out.push(c += v);
    return out;
  };
  for (const r of regions) {
    for (const c of r.countries) {
      c.cumulative = cumulate(c.byYear);
      c.total = c.cumulative[n - 1];
      c.region = r;
    }
    r.byYear = years.map((y, k) => r.countries.reduce((s, c) => s + c.byYear[k], 0));
    r.cumulative = cumulate(r.byYear);
    r.total = r.cumulative[n - 1];
  }
  return {years, regions, used, rate: last.total, firstYear: years[0].year, lastYear: last.year};
}

// The budgets of one estimate as positions in the fill: the limit, what is left from the
// start of the year after the data, where in the fill that runs out, and how many years that
// is at the last data year's rate.
export function budgetThresholds(data, series, estimateId) {
  const estimate = data.budgets.estimates.find(e => e.id === estimateId) ?? data.budgets.estimates[0];
  return data.budgets.thresholds.map((limit, i) => {
    const budget = estimate.GtCO2[i];
    return {limit, label: formatLimit(limit), budget, total: series.used + budget, years: budget / series.rate, estimate};
  });
}

// Time is continuous: t = 1990 is the end of 1990, and t = 1990.5 is that plus half of
// 1991's emissions, taken as spread evenly over the year. The fill of a series of yearly
// amounts (`byYear`, with its running total `cumulative`) at t:
function fillOf(series, byYear, cumulative, t) {
  const k = Math.floor(t + EPS) - series.firstYear;
  if (k < 0) return 0;
  const n = byYear.length;
  return cumulative[Math.min(k, n - 1)] + (k + 1 < n ? clamp(t - series.years[k].year, 0, 1) * byYear[k + 1] : 0);
}

// ---- geometry ---------------------------------------------------------------------------------
// Squares are numbered from zero along the snake: row r from the bottom holds squares r·60 to
// r·60 + 59, left to right in even rows and right to left in odd ones. Drawing coordinates
// have y downward from the top of the grid, so a row's y is counted from the top in `rows`.

// An interval [a, b) of the fill as rectangles in square units, one per row it touches; a
// partial square is cut vertically, at the exact fraction.
function rowRects(a, b, rows) {
  const out = [];
  if (!(b > a + EPS)) return out;
  for (let r = Math.floor(a / COLUMNS + EPS); r * COLUMNS < b - EPS; r++) {
    const lo = Math.max(a, r * COLUMNS) - r * COLUMNS;
    const hi = Math.min(b, (r + 1) * COLUMNS) - r * COLUMNS;
    if (hi <= lo + EPS) continue;
    const [x0, x1] = r % 2 ? [COLUMNS - hi, COLUMNS - lo] : [lo, hi];
    out.push({x0, x1, y0: rows - 1 - r, y1: rows - r});
  }
  return out;
}

// The area of the rectangles left of x.
function areaLeft(rects, x) {
  let a = 0;
  for (const r of rects) a += Math.max(0, Math.min(x, r.x1) - r.x0) * (r.y1 - r.y0);
  return a;
}

// The x positions that cut a set of rectangles into vertical slabs holding the given
// cumulative fractions of its area, found by bisection (the area left of x is monotone).
function columnCuts(rects, fractions) {
  const total = rects.reduce((a, r) => a + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
  return fractions.map(f => {
    if (!(total > EPS)) return 0;
    let lo = 0, hi = COLUMNS;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (areaLeft(rects, mid) < f * total) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  });
}

// The parts of the rectangles between x = xa and x = xb.
function clipRects(rects, xa, xb) {
  return rects.map(r => ({...r, x0: Math.max(r.x0, xa), x1: Math.min(r.x1, xb)})).filter(r => r.x1 > r.x0 + EPS);
}

function rectsPath(rects, cell) {
  const P = v => (v * cell).toFixed(2);
  return rects.map(r => `M${P(r.x0)},${P(r.y0)}H${P(r.x1)}V${P(r.y1)}H${P(r.x0)}Z`).join("");
}

// The line across the grid at fill position T: along the top of the filled part of the row T
// falls in, down one square at T, and on across the rest of that row's bottom edge. Returns
// the path and the y of its right-hand end, where its label goes.
function stepLine(T, rows, cell) {
  const r = Math.floor(T / COLUMNS + EPS), c = T - r * COLUMNS;
  const yTop = (rows - 1 - r) * cell, yBot = (rows - r) * cell;
  const xr = COLUMNS * cell;
  const F = v => v.toFixed(2);
  if (c < EPS) return {d: `M0,${F(yBot)}H${F(xr)}`, y: yBot};
  if (r % 2) return {d: `M${F(xr)},${F(yTop)}H${F((COLUMNS - c) * cell)}V${F(yBot)}H0`, y: yTop};
  return {d: `M0,${F(yTop)}H${F(c * cell)}V${F(yBot)}H${F(xr)}`, y: yBot};
}

// The outline of a union of rectangles: the parts of their edges that no other rectangle of
// the set lies against, as separate segments with square caps to close the corners.
function outlinePath(rects, cell) {
  const P = v => (v * cell).toFixed(2);
  let d = "";
  const segments = (lo, hi, covers) => {
    const parts = [[lo, hi]];
    for (const [c0, c1] of covers) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const [p0, p1] = parts[i];
        if (c1 <= p0 + EPS || c0 >= p1 - EPS) continue;
        parts.splice(i, 1);
        if (c0 > p0 + EPS) parts.push([p0, c0]);
        if (c1 < p1 - EPS) parts.push([c1, p1]);
      }
    }
    return parts;
  };
  for (const r of rects) {
    const others = rects.filter(o => o !== r);
    for (const [x, side] of [[r.x0, "x1"], [r.x1, "x0"]]) {
      const covers = others.filter(o => Math.abs(o[side] - x) < EPS).map(o => [o.y0, o.y1]);
      for (const [y0, y1] of segments(r.y0, r.y1, covers)) d += `M${P(x)},${P(y0)}V${P(y1)}`;
    }
    for (const [y, side] of [[r.y0, "y1"], [r.y1, "y0"]]) {
      const covers = others.filter(o => Math.abs(o[side] - y) < EPS).map(o => [o.x0, o.x1]);
      for (const [x0, x1] of segments(r.x0, r.x1, covers)) d += `M${P(x0)},${P(y)}H${P(x1)}`;
    }
  }
  return d;
}

// The index of the first element of a sorted array greater than v.
function upperBound(arr, v) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] > v) hi = mid; else lo = mid + 1;
  }
  return lo;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// `year` is where the slider starts (the last data year by default); `estimate` the id of
// one of the data file's remaining-budget estimates (its first by default); `colour` one of
// COLOUR_MODES ("none" by default: the fill in plain dark grey, stacked by region and country).
export function createCarbonBudgetWidget({data, width = FIGURE_WIDTH, year, estimate, colour} = {}) {
  if (!data?.years || !data?.budgets) throw new Error("createCarbonBudgetWidget needs {data}: the contents of data/carbon-budget.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- state ------------------------------------------------------------------------------------
  const series = budgetSeries(data);
  const {years, regions, firstYear, lastYear, used} = series;
  const yearEnds = years.map(y => y.end);
  const worldByYear = years.map(y => y.total), worldCumulative = yearEnds;
  const ESTIMATES = data.budgets.estimates;
  let estimateId = ESTIMATES.some(e => e.id === estimate) ? estimate : ESTIMATES[0].id;
  let thresholds = budgetThresholds(data, series, estimateId);
  const modes = regions.length ? COLOUR_MODES : ["year", "decade"];
  let mode = modes.includes(colour) ? colour : modes[0];
  // The top of the grid: the largest 2 °C total any estimate reaches, so switching estimates
  // never changes the grid's shape.
  const reach = Math.max(...ESTIMATES.map(e => used + Math.max(...e.GtCO2)));
  const rows = Math.ceil(reach / COLUMNS - EPS);
  let t = clamp(Math.round(Number(year)) || lastYear, firstYear, lastYear);
  let shownYear = null; // the integer year last drawn in full, chronological layout
  let selected = null;  // the block picked by a click or tap (see hitAt), or null
  let hovered = null;   // the block under a mouse pointer, shown over the selection, or null
  const shown = () => hovered ?? selected;
  let glide = null, raf = null; // the animation in flight

  const fillAt = tt => fillOf(series, worldByYear, worldCumulative, tt);
  const blockFill = (block, tt) => fillOf(series, block.byYear, block.cumulative, tt);
  const stacked = () => mode === "none" || mode === "region";

  // ---- layout -----------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, gridW, cell, gridH, latticeW, labelFont;
  function applyLayout(newW) {
    w = newW;
    gridW = Math.min(GRID_MAX, w);
    cell = gridW / COLUMNS;
    gridH = rows * cell;
    latticeW = clamp(cell * 0.12, 0.6, 1.6); // the white gap between squares
    labelFont = clamp(Math.round(cell * 1.4), 11, 13);
  }
  applyLayout(maxW);

  // ---- DOM --------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;" +
    "padding:0 0 8px;font-size:13px;";
  container.appendChild(controls);

  // A row of joined buttons, like the atmospheric-composition widget's water-vapour toggle.
  function buttonRow(label, choices, onPick) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:6px;color:#666;";
    bar.append(label);
    const buttons = choices.map((choice, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      if (choice.title) b.title = choice.title;
      const first = i === 0, last = i === choices.length - 1;
      b.style.cssText =
        "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;position:relative;" +
        `border-radius:${first ? "999px 0 0 999px" : last ? "0 999px 999px 0" : "0"};${first ? "" : "margin-left:-1px;"}`;
      b.addEventListener("click", () => { stopTour(); onPick(choice.id); });
      bar.appendChild(b);
      return b;
    });
    const update = current => buttons.forEach((b, i) => {
      const on = choices[i].id === current;
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.color = on ? ACCENT : "#333";
      b.style.zIndex = on ? 1 : 0;
      b.setAttribute("aria-pressed", on);
    });
    controls.appendChild(bar);
    return update;
  }

  const MODE_LABELS = {none: "None", region: "Region", year: "Year", decade: "Decade"};
  const updateModeButtons = buttonRow("Colour", modes.map(m => ({id: m, label: MODE_LABELS[m]})), setMode);
  const updateEstimateButtons = buttonRow("Budget", ESTIMATES.map(e => ({
    id: e.id, label: e.short ?? e.name,
    title: `${e.name}: ${e.GtCO2.map((g, k) => `${g} GtCO₂ for ${formatLimit(data.budgets.thresholds[k])}`).join(", ")}`,
  })), setEstimate);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;margin-left:auto;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);

  // The year and the running total, HTML above the SVG so that the SVG holds nothing but the
  // grid; the unit on the right, in the space over the labels.
  const header = document.createElement("div");
  header.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;padding:0 0 4px;";
  const yearLabel = document.createElement("span");
  yearLabel.style.cssText = "font-weight:bold;font-size:24px;color:#222;min-width:3.2em;";
  // The year slider sits beside the year it sets.
  const sliderRow = document.createElement("label");
  sliderRow.style.cssText = "display:flex;flex:1 1 160px;align-items:center;gap:8px;font-size:13px;color:#666;cursor:pointer;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = firstYear;
  slider.max = lastYear;
  slider.step = 1;
  slider.value = Math.floor(t + EPS);
  slider.style.cssText = `flex:1 1 100px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", `Year, ${firstYear} to ${lastYear}`);
  slider.addEventListener("input", e => { e.stopPropagation(); stopTour(); setTime(Number(slider.value)); });
  sliderRow.append(String(firstYear), slider, String(lastYear));
  const totalLabel = document.createElement("span");
  totalLabel.style.cssText = "color:#333;";
  const unitLabel = document.createElement("span");
  unitLabel.style.cssText = "margin-left:auto;color:#666;font-size:13px;";
  unitLabel.textContent = "1 square = 1 GtCO₂, a billion tonnes";
  header.append(yearLabel, sliderRow, totalLabel, unitLabel);
  container.appendChild(header);

  // The key: a swatch and running total per region, or the ramp with its end years.
  const legend = document.createElement("div");
  legend.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:0 0 8px;font-size:13px;color:#333;min-height:1.4em;";
  container.appendChild(legend);
  // Each region's entry is a button: it selects the whole region, outlined on the grid.
  const legendItems = new Map();
  for (const region of regions) {
    const item = document.createElement("button");
    item.type = "button";
    item.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font:inherit;color:inherit;" +
      "background:none;border:1px solid transparent;border-radius:999px;padding:1px 6px 1px 4px;margin:-2px -6px -2px -4px;cursor:pointer;";
    const swatch = document.createElement("span");
    swatch.style.cssText = `width:11px;height:11px;border-radius:2px;background:${regionColour(region.id)};flex:none;`;
    const text = document.createElement("span");
    item.append(swatch, text);
    item.title = `${region.note ? `${region.name}, ${region.note}` : region.name}: click to outline it on the grid`;
    item.addEventListener("click", () => {
      stopTour();
      const hit = {kind: "region", region};
      selected = sameBlock(hit, selected) ? null : hit;
      hovered = null;
      updateHover();
      emit();
    });
    legendItems.set(region.id, {item, text});
  }
  function updateLegendButtons() {
    for (const [id, {item}] of legendItems) {
      const on = selected?.kind === "region" && selected.region.id === id;
      item.style.borderColor = on ? ACCENT : "transparent";
      item.style.color = on ? ACCENT : "inherit";
      item.setAttribute("aria-pressed", on);
    }
  }
  const rampItem = document.createElement("span");
  rampItem.style.cssText = "display:inline-flex;align-items:center;gap:6px;color:#666;";
  const rampBar = document.createElement("span");
  rampBar.style.cssText = "display:inline-flex;width:160px;height:11px;border-radius:2px;overflow:hidden;";
  rampItem.append(String(firstYear), rampBar, String(lastYear));

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "carbon-budget");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:pointer;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = "padding:10px 0 0;color:#555;min-height:2.8em;line-height:1.4;";
  const statusHead = document.createElement("strong");
  statusHead.style.color = "#222";
  const statusBody = document.createElement("span");
  status.append(statusHead, statusBody);
  container.appendChild(status);

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  const HINT_IDLE = "Click or tap a square to see whose it is, or a region in the key; click again to let go. Drag the slider to a year.";
  const HINT_TOUR = "Playing the years through — move the slider or click anything to take over; Play tour starts it again.";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- building the figure -------------------------------------------------------------------
  // The chronological layout has a path per year (`yearPaths`, with the full-length `d` in
  // `fullD`, since the year in progress is cut short); the stacked layout a path per region
  // (`regionPaths`), redrawn at every step of time.
  let yearPaths = [], fullD = [], regionPaths = [], hoverHalo = null, hoverPath = null, hoverLabel = null;
  const halo = {stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

  function build() {
    svg.setAttribute("width", gridW.toFixed(0));
    svg.setAttribute("height", Math.ceil(gridH + 2));
    svg.replaceChildren();

    // What is left, in a band per budget: from the end of the data to each line in turn. The
    // grid ends at the last line. Drawn from zero so that, at an earlier year, the squares
    // not yet emitted by then are grey too: they were the budget of their day.
    const bands = svgEl("g", {}, svg);
    let from = 0;
    thresholds.forEach((th, i) => {
      const d = rectsPath(rowRects(from, th.total, rows), cell);
      if (d) svgEl("path", {d, fill: COLOURS.bands[Math.min(i, COLOURS.bands.length - 1)]}, bands);
      from = th.total;
    });

    const top = thresholds[thresholds.length - 1].total;
    const fills = svgEl("g", {}, svg);
    yearPaths = [];
    fullD = [];
    years.forEach(y => {
      const d = rectsPath(rowRects(y.start, Math.min(y.end, top), rows), cell);
      fullD.push(d);
      yearPaths.push(svgEl("path", {d, "data-year": y.year}, fills));
    });
    regionPaths = regions.map(r => svgEl("path", {fill: regionColour(r.id), "data-region": r.id}, fills));

    // The squares themselves: a white lattice over the fills, heavier every ten so that a
    // block of a hundred can be counted at a glance.
    let thin = "", thick = "";
    const H = gridH.toFixed(2), W = gridW.toFixed(2);
    for (let c = 1; c < COLUMNS; c++) {
      const p = (c * cell).toFixed(2);
      if (c % 10 === 0) thick += `M${p},0V${H}`; else thin += `M${p},0V${H}`;
    }
    for (let r = 1; r < rows; r++) {
      const p = (r * cell).toFixed(2);
      if ((rows - r) % 10 === 0) thick += `M0,${p}H${W}`; else thin += `M0,${p}H${W}`;
    }
    svgEl("path", {d: thin, stroke: "#fff", "stroke-width": latticeW.toFixed(2), fill: "none", "pointer-events": "none"}, svg);
    svgEl("path", {d: thick, stroke: "#fff", "stroke-width": (2 * latticeW).toFixed(2), fill: "none", "pointer-events": "none"}, svg);

    // The budgets: a dashed line each, labelled just above its right-hand end (below it for a
    // line too close to the top), the label haloed in white so that it reads on the grey.
    const lines = svgEl("g", {"pointer-events": "none"}, svg);
    for (const th of thresholds) {
      const {d, y} = stepLine(th.total, rows, cell);
      svgEl("path", {d, stroke: COLOURS.line, "stroke-width": 1.5, "stroke-dasharray": "5 3", fill: "none"}, lines);
      const above = y - 4 >= labelFont;
      const label = svgEl("text", {
        x: (gridW - 4).toFixed(1), y: (above ? y - 4 : y + labelFont + 2).toFixed(1), "text-anchor": "end",
        "font-size": labelFont, "font-weight": "bold", fill: COLOURS.line, ...halo,
      }, lines);
      label.textContent = th.label;
    }

    // The block picked out: a country's contribution, a region's or a year's, outlined with a
    // white halo under the line so that it shows on the dark blocks, and named on the grid.
    hoverHalo = svgEl("path", {fill: "none", stroke: "#fff", "stroke-width": 3, "stroke-linecap": "square", "pointer-events": "none"}, svg);
    hoverPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.25, "stroke-linecap": "square", "pointer-events": "none"}, svg);
    hoverLabel = svgEl("text", {
      "text-anchor": "middle", "dominant-baseline": "central", "font-size": labelFont, "font-weight": "bold",
      fill: "#111", "pointer-events": "none", ...halo,
    }, svg);

    shownYear = null;
    applyColours();
    updateHover();
  }

  // ---- colours ----------------------------------------------------------------------------------
  function regionColour(id) {
    return COLOURS.regions[id] ?? FALLBACK_REGION;
  }

  // The ramp sampled at a point s in [0, 1].
  function rampRgb(s) {
    const stops = COLOURS.ramp;
    const p = clamp(s, 0, 1) * (stops.length - 1);
    const i = Math.min(Math.floor(p), stops.length - 2);
    return mixRgb(hexToRgb(stops[i]), hexToRgb(stops[i + 1]), p - i);
  }

  // Time in classes: class k of n gets the ramp's colour at k / (n − 1), and every year in
  // the class gets that one colour, so the fill steps rather than shades.
  const classCount = size => Math.ceil((lastYear - firstYear + 1) / size);
  const classRgb = (year, size) => size === 10 ? decadeRgb(year)
    : rampRgb(Math.floor((year - firstYear) / size) / Math.max(1, classCount(size) - 1));
  const yearRgb = year => classRgb(year, YEAR_CLASS);
  const decadeRgb = year => hexToRgb(COLOURS.decades[Math.floor((year - firstYear) / 10) % COLOURS.decades.length]);

  function applyColours() {
    yearPaths.forEach((p, k) => p.setAttribute("fill", cssRgb(mode === "decade" ? decadeRgb(years[k].year) : yearRgb(years[k].year))));
    regionPaths.forEach((p, i) => p.setAttribute("fill", mode === "region" ? regionColour(regions[i].id) : COLOURS.plain));
    // The key for the mode: regions with their running totals, the ramp, or nothing.
    legend.replaceChildren();
    legend.style.display = mode === "none" ? "none" : "";
    if (mode === "region") {
      for (const {item} of legendItems.values()) legend.appendChild(item);
    } else if (!stacked()) {
      // One swatch per class, in a row, with the first and last year at the ends.
      const size = mode === "decade" ? 10 : YEAR_CLASS;
      rampBar.replaceChildren();
      rampBar.style.gap = size >= 10 ? "1px" : "0";
      for (let k = 0; k < classCount(size); k++) {
        const sw = document.createElement("span");
        sw.style.cssText = `flex:1 1 0;height:11px;background:${cssRgb(classRgb(firstYear + k * size, size))};`;
        sw.title = `${firstYear + k * size}–${Math.min(firstYear + (k + 1) * size - 1, lastYear)}`;
        rampBar.appendChild(sw);
      }
      legend.appendChild(rampItem);
    }
    shownYear = null;
    applyTime();
  }

  // ---- time -------------------------------------------------------------------------------------
  // Where each block of a stack starts at time t: the fill of the blocks before it.
  function bases(blocks, tt) {
    const out = [];
    let at = 0;
    for (const b of blocks) {
      out.push(at);
      at += blockFill(b, tt);
    }
    return out;
  }

  // Draw the fill up to t. Chronological: whole years as built, the year in progress cut at
  // its fraction. Stacked: each region's block from its base, and the totals in the key.
  function applyTime() {
    const y = Math.floor(t + EPS), frac = t - y;
    const top = thresholds[thresholds.length - 1].total;
    const cum = fillAt(t);
    if (stacked()) {
      if (shownYear === null) yearPaths.forEach(p => { p.style.display = "none"; });
      const at = bases(regions, t);
      regions.forEach((r, i) => {
        const fill = blockFill(r, t);
        regionPaths[i].setAttribute("d", rectsPath(rowRects(at[i], Math.min(at[i] + fill, top), rows), cell));
        legendItems.get(r.id).text.textContent = r.short ?? r.name;
      });
      shownYear = y;
    } else {
      if (shownYear === null) regionPaths.forEach(p => p.setAttribute("d", ""));
      if (shownYear !== y) {
        yearPaths.forEach((p, k) => {
          const shown = years[k].year <= y;
          p.style.display = shown ? "" : "none";
          if (shown) p.setAttribute("d", fullD[k]);
        });
        shownYear = y;
      }
      const k = y + 1 - firstYear;
      if (k < yearPaths.length) {
        const yr = years[k];
        const d = frac > EPS ? rectsPath(rowRects(yr.start, Math.min(yr.start + frac * yr.total, top), rows), cell) : "";
        yearPaths[k].setAttribute("d", d);
        yearPaths[k].style.display = d ? "" : "none";
      }
    }

    yearLabel.textContent = y;
    totalLabel.textContent = `${formatGt(cum)} GtCO₂ since ${firstYear}${years[y - firstYear].projected ? " (projected)" : ""}`;
    if (String(slider.value) !== String(y)) slider.value = y;
    if (shown() === null) updateStatus();
    else updateHover(); // the outlined block may have moved or grown
  }

  // ---- hit-testing ------------------------------------------------------------------------------
  // The square under a pointer event as a continuous position along the fill, or null off the
  // grid.
  function squareAt(e) {
    const box = svg.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    if (x < 0 || x >= gridW || y < 0 || y >= gridH) return null;
    const r = rows - 1 - Math.floor(y / cell);
    const along = r % 2 ? COLUMNS - x / cell : x / cell;
    const square = r * COLUMNS + along;
    return square < thresholds[thresholds.length - 1].total ? square : null;
  }

  // What is at a position in the fill, for the current layout and time: {kind, ...}. Stacked:
  // a country (with its region), or "grey" for a square not yet reached. Chronological: a
  // year, which for a square past the fill is the year that will emit it; past the data,
  // "grey". A block is identified by what it is, not where it is, since a country's block
  // moves and grows as time passes; rectsOf finds it again.
  function hitAt(square) {
    if (stacked()) {
      if (square >= fillAt(t) - EPS) return {square, kind: "grey"};
      const at = bases(regions, t);
      let i = regions.length - 1;
      while (i > 0 && square < at[i] - EPS) i--;
      const region = regions[i];
      // Countries are columns across the region's block: which one is a matter of x.
      const r = Math.floor(square / COLUMNS + EPS), along = square - r * COLUMNS;
      const x = r % 2 ? COLUMNS - along : along;
      const cuts = countryCuts(region, t);
      let j = region.countries.length - 1;
      while (j > 0 && (x < cuts[j] - EPS || blockFill(region.countries[j], t) <= EPS)) j--;
      return {square, kind: "country", country: region.countries[j], region};
    }
    if (square >= used - EPS) return {square, kind: "grey"};
    return {square, kind: "year", year: years[upperBound(yearEnds, square)]};
  }

  // A region's block at time tt as rectangles, and the x positions where its countries'
  // columns begin: every country a vertical slab of the block, largest first from the left,
  // each holding its share of the region's area, so that countries are blocks rather than the
  // thin runs a snake would give them.
  function regionRects(region, tt) {
    const from = bases(regions, tt)[regions.indexOf(region)];
    const top = thresholds[thresholds.length - 1].total;
    return rowRects(from, Math.min(from + blockFill(region, tt), top), rows);
  }
  function countryCuts(region, tt) {
    const fill = blockFill(region, tt);
    return columnCuts(regionRects(region, tt), bases(region.countries, tt).map(c => (fill > EPS ? c / fill : 0)));
  }

  // A block's rectangles on the grid at the current time: a region, a country's column of
  // it, or a year; none for a block the layout does not have (a country in the chronological
  // layout, a year in the stacked one, or grey).
  function rectsOf(h) {
    const top = thresholds[thresholds.length - 1].total;
    if (h.kind === "region" && stacked()) return regionRects(h.region, t);
    if (h.kind === "country" && stacked()) {
      const j = h.region.countries.indexOf(h.country);
      const cuts = countryCuts(h.region, t);
      const fill = blockFill(h.region, t);
      const end = fill > EPS ? (bases(h.region.countries, t)[j] + blockFill(h.country, t)) / fill : 0;
      const [xb] = columnCuts(regionRects(h.region, t), [end]);
      return clipRects(regionRects(h.region, t), cuts[j], xb);
    }
    if (h.kind === "year" && !stacked()) return rowRects(h.year.start, Math.min(h.year.end, top), rows);
    return [];
  }

  const sameBlock = (a, b) => a === b || (a && b && a.kind === b.kind && a.country === b.country && a.year === b.year &&
    (a.kind !== "region" || a.region === b.region) && (a.kind !== "grey" || Math.floor(a.square) === Math.floor(b.square)));

  // A click or tap selects the block, and stays selected until the block is clicked again or
  // a grey square is; this is what works on a touch screen. A mouse also previews the block
  // it is over, on top of the selection, and lets go of the preview when it leaves the grid.
  svg.addEventListener("click", e => {
    const square = squareAt(e);
    const hit = square === null ? null : hitAt(square);
    const next = hit === null || hit.kind === "grey" || sameBlock(hit, selected) ? null : hit;
    if (sameBlock(next, selected) && hovered === null) return;
    selected = next;
    hovered = null;
    updateHover();
    emit();
  });
  svg.addEventListener("pointerdown", () => stopTour());
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const square = squareAt(e);
    const next = square === null ? null : hitAt(square);
    if (!sameBlock(next, hovered)) {
      hovered = next;
      updateHover();
    }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse" || hovered === null) return;
    hovered = null;
    updateHover();
  });

  // ---- read-outs ------------------------------------------------------------------------------
  // What is left at the end of the shown year, and how long it lasts at that year's rate.
  function describeDefault() {
    const y = Math.floor(t + EPS);
    const cum = fillAt(y);
    const yr = years[y - firstYear];
    const amounts = thresholds.map((th, i) => `${formatGt(th.total - cum)}${i === 0 ? " GtCO₂" : ""} for ${th.label}`);
    const lasts = thresholds.map(th => formatYears((th.total - cum) / yr.total));
    return {
      head: `End of ${y}${yr.projected ? " (projected)" : ""}. `,
      body: `Left: ${joinList(amounts)}, which is ${joinList(lasts)} years at ${y}'s rate of ${formatGt(yr.total)} GtCO₂ a year.`,
    };
  }

  // The block picked out: a country and what it has emitted so far, or a year and what was
  // emitted in it.
  function describeBlock(h) {
    const y = Math.floor(t + EPS);
    if (h.kind === "grey") {
      const i = thresholds.findIndex(th => h.square < th.total - EPS);
      const where = i === 0 ? `inside the ${thresholds[0].label} budget` : `past the ${thresholds[i - 1].label} budget, inside ${thresholds[i].label}`;
      return {head: "Not yet emitted. ", body: `This square is ${where}.`};
    }
    if (h.kind === "region") {
      const {region} = h;
      const fill = blockFill(region, t), cum = fillAt(t);
      const k = y - firstYear;
      const top = region.countries.filter(c => !c.members && c.cumulative[k] > 0).slice(0, 3).map(c => `${c.name} ${formatGt(c.cumulative[k])}`);
      return {
        head: `${region.name}${region.note ? ` (${region.note})` : ""}. `,
        body: `${formatGt(fill)} GtCO₂ since ${firstYear}: ${formatPercent(fill / cum)} of the world's ${formatGt(cum)}` +
          (top.length ? `; most of it ${joinList(top)}` : "") + `. ${formatGt(region.byYear[k])} GtCO₂ in ${y}.`,
      };
    }
    if (h.kind === "country") {
      const {country, region} = h;
      const fill = blockFill(country, t), regionFill = blockFill(region, t), cum = fillAt(t);
      const who = country.members ? `${country.name}, ${country.members} smaller countr${country.members > 1 ? "ies" : "y"}` : country.name;
      return {
        head: `${who}. `,
        body: `${formatGt(fill)} GtCO₂ since ${firstYear}: ${formatPercent(fill / cum)} of the world's ${formatGt(cum)}, ` +
          `and ${formatPercent(fill / regionFill)} of ${region.name}'s ${formatGt(regionFill)}. ${formatGt(country.byYear[y - firstYear])} GtCO₂ in ${y}.`,
      };
    }
    const yr = h.year;
    const k = yr.year - firstYear;
    const shares = regions.map(r => `${r.short ?? r.name} ${formatGt(r.byYear[k])}`);
    return {
      head: `${yr.year}${yr.projected ? " (projected)" : ""}. `,
      body: `${formatGt(yr.total)} GtCO₂ that year: ${formatGt(yr.fossil)} from fossil fuels and cement, ${formatGt(yr.landUse)} from land use` +
        (shares.length ? `; by region, ${shares.join(", ")}` : "") + "." +
        (yr.year > y ? ` Still to come at the end of ${y}.` : ""),
    };
  }

  function updateStatus() {
    const dflt = describeDefault();
    const {head, body} = shown() === null ? dflt : describeBlock(shown());
    statusHead.textContent = head;
    statusBody.textContent = body;
    const th = thresholds.map(th => `${th.budget} GtCO₂ for ${th.label}`).join(", ");
    svg.setAttribute("aria-label",
      `Cumulative CO₂ emissions since ${firstYear} as a grid of ${COLUMNS} squares a row, one square per gigatonne, ` +
      `filled to the end of ${Math.floor(t + EPS)}${stacked() ? ", stacked by region and country" : ", by year"}; the remaining budgets from ` +
      `${data.budgets.from} (${thresholds[0].estimate.name}) are ${th}. ${dflt.head}${dflt.body}`);
  }

  function updateHover() {
    const h = shown();
    const rects = h === null ? [] : rectsOf(h);
    const d = outlinePath(rects, cell);
    hoverHalo.setAttribute("d", d);
    hoverPath.setAttribute("d", d);
    // The name, at the middle of the block: the rectangle around the block's centre of area,
    // kept inside the grid.
    const name = h === null ? "" : h.kind === "country" ? h.country.name : h.kind === "region" ? h.region.name : h.kind === "year" ? String(h.year.year) : "";
    if (rects.length && name) {
      const area = r => (r.x1 - r.x0) * (r.y1 - r.y0);
      const total = rects.reduce((a, r) => a + area(r), 0);
      const cy = rects.reduce((a, r) => a + area(r) * (r.y0 + r.y1) / 2, 0) / total;
      const best = rects.find(r => cy >= r.y0 && cy < r.y1) ?? rects.reduce((a, b) => (area(b) > area(a) ? b : a));
      const half = name.length * labelFont * 0.56 / 2 + 3;
      const x = clamp((best.x0 + best.x1) / 2 * cell, half, gridW - half);
      const y = clamp((best.y0 + best.y1) / 2 * cell, labelFont * 0.7, gridH - labelFont * 0.7);
      hoverLabel.setAttribute("x", x.toFixed(1));
      hoverLabel.setAttribute("y", y.toFixed(1));
      hoverLabel.textContent = name;
    } else {
      hoverLabel.textContent = "";
    }
    updateLegendButtons();
    updateStatus();
  }

  // ---- time, estimate and colour ------------------------------------------------------------
  function setTime(v) {
    v = clamp(v, firstYear, lastYear);
    const before = Math.floor(t + EPS);
    t = v;
    applyTime();
    if (Math.floor(t + EPS) !== before) emit();
  }

  function setEstimate(id) {
    if (id === estimateId || !ESTIMATES.some(e => e.id === id)) return;
    estimateId = id;
    thresholds = budgetThresholds(data, series, estimateId);
    updateEstimateButtons(estimateId);
    build();
    emit();
  }

  function setMode(m) {
    if (m === mode || !modes.includes(m)) return;
    mode = m;
    updateModeButtons(mode);
    // A country means nothing in the chronological layout, nor a year in the stacked one.
    selected = null;
    hovered = null;
    applyColours();
    updateHover();
    emit();
  }

  // Glide to a year over `ms`, linearly in time so that the pace of the years is steady and
  // the acceleration of the emissions shows.
  function glideTo(target, ms) {
    target = clamp(target, firstYear, lastYear);
    if (reduceMotion || ms <= 0 || target === t) {
      glide = null;
      setTime(target);
      return;
    }
    glide = {from: t, to: target, start: performance.now(), duration: ms};
    if (raf === null) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = null;
    if (container.isConnected === false) return; // a re-run cell left this widget behind
    if (!glide) return;
    const p = clamp((now - glide.start) / glide.duration, 0, 1);
    setTime(glide.from + (glide.to - glide.from) * p);
    if (p >= 1) glide = null;
    else raf = requestAnimationFrame(frame);
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const y = Math.floor(t + EPS);
    const cum = fillAt(y);
    return {
      year: y,
      estimate: estimateId,
      colour: mode,
      selected: selected === null ? null
        : selected.kind === "country" ? {country: selected.country.name, region: selected.region.name}
        : selected.kind === "region" ? {region: selected.region.name} : {year: selected.year.year},
      emitted: Math.round(cum),
      remaining: Object.fromEntries(thresholds.map(th => [th.limit, Math.round(th.total - cum)])),
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  updateModeButtons(mode);
  updateEstimateButtons(estimateId);
  build();
  container.value = value();

  // Reflow with the container; a detached or hidden container measures zero, which is not
  // "no room". Resizing never emits "input": nothing about the state changes.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); build(); }
    });
    ro.observe(container);
  }

  // ---- tour ------------------------------------------------------------------------------------
  // Left alone, the figure goes back to 1850 and plays the years through at one steady pace,
  // rests on the last year, and goes round again. It stops at the first click, and the Play
  // tour button brings it back. Same manners as the other widgets' tours.
  const MS_PER_YEAR = 65;
  const TOUR_HOLD = 2600;
  let touring = false, tourTimer = null, tourWatcher = null;

  // The stops: 1850, for a moment to see the empty grid, and the last year.
  const TOUR_STOPS = [{to: firstYear, ms: 0, hold: 900}, {to: lastYear, ms: (lastYear - firstYear) * MS_PER_YEAR, hold: TOUR_HOLD}];

  function tourStep(i) {
    if (!touring) return;
    if (container.isConnected === false) return stopTour();
    const stop = TOUR_STOPS[i % TOUR_STOPS.length];
    glideTo(stop.to, stop.ms);
    tourTimer = setTimeout(() => tourStep((i + 1) % TOUR_STOPS.length), (reduceMotion ? 0 : stop.ms) + stop.hold);
  }

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    if (glide) { glide = null; setTime(Math.round(t)); }
    hint.textContent = HINT_IDLE;
    showTouring();
  }

  function showTouring() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }

  // `delay` is the pause before the first move: a rest on the opening frame when the tour
  // starts by itself, none when the reader has just asked for it.
  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
    // Nothing stays picked out while the years play through.
    selected = null;
    hovered = null;
    updateHover();
    hint.textContent = HINT_TOUR;
    showTouring();
    tourTimer = setTimeout(() => tourStep(0), delay);
  }

  // Not under reduced motion (an unrequested animation, and what keeps the thumbnail capture
  // on the opening frame), and not before the figure has scrolled into view.
  if (!reduceMotion) {
    if (typeof IntersectionObserver === "function") {
      tourWatcher = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        tourWatcher.disconnect();
        tourWatcher = null;
        startTour();
      }, {threshold: 0.3});
      tourWatcher.observe(container);
    } else {
      startTour();
    }
  }

  return container;
}

// ---- formatting -------------------------------------------------------------------------------

// "1.5 °C", "2 °C".
export function formatLimit(limit) {
  return `${Number(limit)} °C`;
}

// Whole gigatonnes with a thousands separator, two significant figures below ten.
export function formatGt(v) {
  if (Math.abs(v) < 10) return Number(v.toPrecision(2)).toLocaleString("en-US");
  return Math.round(v).toLocaleString("en-US");
}

// "20%", "3.5%", "0.4%": whole numbers from ten up, one decimal below.
function formatPercent(f) {
  const p = 100 * f;
  return `${p >= 9.95 ? Math.round(p) : Number(p.toPrecision(2))}%`;
}

// Years left at a rate: whole years, "under 1" for less than half a year.
function formatYears(v) {
  return v < 0.5 ? "under 1" : Math.round(v).toLocaleString("en-US");
}

function joinList(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// ---- small helpers ----------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex, alpha) {
  return `rgba(${hexToRgb(hex).join(",")},${alpha})`;
}

function mixRgb(A, B, s) {
  return A.map((v, i) => Math.round(v + (B[i] - v) * s));
}

function cssRgb(rgb) {
  return `rgb(${rgb.join(",")})`;
}
