// CO₂ emissions per person, country by country, as a stack of bars. Every country is a
// horizontal bar whose height is its population and whose length is its emissions per
// person, so its area is its emissions in all; the bars are stacked from the bottom of the
// plot in order of emissions per person, the lowest at the bottom, so the population axis
// starts at zero like any other and, as the years play, the stack grows upwards and a country
// that climbs the ranking climbs the plot. Both scales are fixed so the frame never moves:
// the plot is as tall as the most people the stack ever holds (8.5 billion, rounded up from
// 2024), and as long as 35 tonnes a person a year (or 2,000 tonnes a person since 1850 in the
// cumulative view); whatever overshoots the length is cut at the edge and marked. Labels
// give the country and its emissions in all, the area of its bar: inside a bar tall and long
// enough to hold them, and beyond the end of a thinner one, as many as fit without touching,
// the top of the ranking and the biggest emitters first, and Australia's whenever it fits
// (the course is taught there); the bar under the pointer, or the one clicked, always gets
// its label, and any neighbour's that would clash fades. Until the reader touches anything,
// three annotations around China's bar say what height, length and area mean, with every
// other bar veiled so that China stands out; they come back whenever the view is switched. The tour, from 1850 to the latest year, plays only when asked, and stops
// at the end.
//
// The countries fall into five regions: the Americas, Europe and Russia, Asia and the Middle
// East, Oceania, and Africa, made here from the seven finer groups of the data file (which is
// the archived polar chart's, scripts/co2-per-capita.mjs). Emissions are fossil fuels and
// cement plus land-use change, as in the carbon-budget widgets. Self-contained: no d3, no
// imports.
//
// Options: {year} opens on that year (the latest by default); {mode: "cumulative"} on
// emissions since 1850; {timeline: false} fixes the year, with no slider and no tour, which is
// how the co2-per-capita-today page uses it.

const FIGURE_WIDTH = 960;   // half again the other widgets': the per-person axis wants the room
const MIN_WIDTH = 320;
const ACCENT = "#0b57d0";
const EPS = 1e-9;
const PX_PER_BILLION = 80;   // the population axis's scale; its top comes from the data
const SCALE_MAX = {year: 35, cumulative: 2000};   // tonnes per person, the plot's full length
const HELPER_CODE = "CHN";   // the bar the opening annotations hang on
const PINNED_CODE = "AUS";   // always labelled when its label fits: the course is Australian

export const MODES = ["year", "cumulative"];

export const REGIONS = [
  {id: "americas", name: "Americas"},
  {id: "europe", name: "Europe and Russia"},
  {id: "asia", name: "Asia and the Middle East"},
  {id: "oceania", name: "Oceania"},
  {id: "africa", name: "Africa"},
];
// Okabe–Ito, one per region.
export const REGION_COLOURS = {americas: "#009E73", europe: "#E69F00", asia: "#D55E00", oceania: "#0072B2", africa: "#56B4E9"};

// The data file groups Oceania's islands with Asia and keeps Australia and New Zealand apart;
// here they are all Oceania. Everything else maps group by group.
const OCEANIA = new Set(["AUS", "NZL", "PNG", "FJI", "SLB", "VUT", "NCL", "PYF", "WSM", "TON", "KIR", "FSM", "MHL", "PLW",
  "NRU", "TUV", "COK", "NIU", "WLF", "GUM", "ASM", "MNP", "TKL", "PCN", "NFK"]);
const GROUP_TO_REGION = {americas: "americas", europe: "europe", russia: "europe", mideast: "asia", asia: "asia", australia: "oceania", africa: "africa"};
export function regionOf(country) {
  return OCEANIA.has(country.code) ? "oceania" : GROUP_TO_REGION[country.group] ?? "asia";
}

export function createCo2PerCapitaBarsWidget({data, width = FIGURE_WIDTH, year, mode: initialMode, timeline = true} = {}) {
  if (!data?.years || !data?.countries) throw new Error("createCo2PerCapitaBarsWidget needs {data}: the contents of co2-per-capita.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- data -----------------------------------------------------------------------------------
  const years = data.years;
  const firstYear = years[0], lastYear = years[years.length - 1];
  const regions = new Map(REGIONS.map(r => [r.id, r]));
  const countries = data.countries.map(c => {
    const cum = [];
    let s = 0;
    for (const v of c.co2) cum.push(s += v ?? 0);
    return {...c, cum, region: regionOf(c)};
  });
  const byCode = new Map(countries.map(c => [c.code, c]));

  function at(arr, tt) {
    const k = Math.floor(tt + EPS) - firstYear;
    if (k < 0 || k >= arr.length || arr[k] === null) return null;
    const f = tt - years[k];
    if (f <= EPS || k + 1 >= arr.length || arr[k + 1] === null) return arr[k];
    return arr[k] + (arr[k + 1] - arr[k]) * f;
  }

  // The population axis runs from zero to the most people the stack ever holds, rounded up
  // to the next half billion (millions).
  const popTop = (() => {
    let most = 0;
    years.forEach((_, k) => {
      let s = 0;
      for (const c of countries) if (c.pop[k] > 0 && c.co2[k] !== null) s += c.pop[k];
      most = Math.max(most, s);
    });
    return Math.max(500, Math.ceil(most / 500) * 500);
  })();
  const PLOT_H = PX_PER_BILLION * popTop / 1000;

  // ---- state ----------------------------------------------------------------------------------
  let mode = MODES.includes(initialMode) ? initialMode : "year";
  let t = clamp(Math.round(Number(year)) || lastYear, firstYear, lastYear);
  let selected = null, hovered = null;
  const shown = () => hovered ?? selected;
  let keyRegion = null;
  const layout = new Map();   // code → {y0, h, x, alpha}: where each bar is now, chasing its target
  let glide = null, raf = null, lastFrame = 0;
  let helpersOn = true;       // the opening annotations, until the first interaction

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, labelRoom;
  function applyLayout(newW) {
    w = newW;
    labelRoom = clamp(Math.round(w * 0.18), 90, 150);   // beyond the plot, for the bar labels
    plotL = 44;                                           // tick labels, and the axis title snug against them
    plotR = w - labelRoom;
    plotT = 16;
    plotB = plotT + PLOT_H;
    svgH = plotB + 48;                                    // tick labels, then the axis title clear of them
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;padding:0 0 8px;font-size:13px;";
  container.appendChild(controls);

  function buttonRow(choices, onPick) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:6px;color:#666;";
    const buttons = choices.map((choice, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      if (choice.title) b.title = choice.title;
      const first = i === 0, last = i === choices.length - 1;
      b.style.cssText =
        "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;position:relative;" +
        `border-radius:${first ? "999px 0 0 999px" : last ? "0 999px 999px 0" : "0"};${first ? "" : "margin-left:-1px;"}`;
      b.addEventListener("click", () => { stopTour(); dismissHelpers(); onPick(choice.id); });
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
  const updateModeButtons = buttonRow([
    {id: "year", label: "Yearly emissions", title: "The year's emissions divided by the year's population"},
    {id: "cumulative", label: "Cumulative emissions", title: `Everything emitted since ${firstYear}, divided by the population of the year shown`},
  ], setMode);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText = "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;margin-left:auto;";
  tourButton.addEventListener("click", () => { dismissHelpers(); touring ? stopTour() : startTour(0); });
  if (timeline) controls.appendChild(tourButton);

  // The year and its slider. Without the timeline the year is fixed and this row is not shown.
  const header = document.createElement("div");
  header.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;padding:0 0 4px;";
  const yearLabel = document.createElement("span");
  yearLabel.style.cssText = "font-weight:bold;font-size:24px;color:#222;min-width:3.2em;";
  const sliderRow = document.createElement("label");
  sliderRow.style.cssText = "display:flex;flex:1 1 160px;align-items:center;gap:8px;font-size:13px;color:#666;cursor:pointer;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = firstYear;
  slider.max = lastYear;
  slider.step = 1;
  slider.value = t;
  slider.style.cssText = `flex:1 1 100px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", `Year, ${firstYear} to ${lastYear}`);
  slider.addEventListener("input", e => { e.stopPropagation(); stopTour(); dismissHelpers(); setTime(Number(slider.value)); });
  sliderRow.append(String(firstYear), slider, String(lastYear));
  header.append(yearLabel, sliderRow);
  if (timeline) container.appendChild(header);

  const key = document.createElement("div");
  key.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:0 0 6px;font-size:13px;color:#333;";
  const keyItems = REGIONS.map(r => {
    const item = document.createElement("button");
    item.type = "button";
    item.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font:inherit;color:inherit;" +
      "background:none;border:1px solid transparent;border-radius:999px;padding:1px 6px 1px 4px;margin:-2px -6px -2px -4px;cursor:pointer;";
    const swatch = document.createElement("span");
    swatch.style.cssText = `width:11px;height:11px;border-radius:2px;background:${REGION_COLOURS[r.id] ?? "#888"};flex:none;`;
    item.append(swatch, r.name);
    item.addEventListener("click", () => { stopTour(); dismissHelpers(); keyRegion = keyRegion === r.id ? null : r.id; updateKey(); requestRender(); });
    key.appendChild(item);
    return {item, id: r.id};
  });
  function updateKey() {
    for (const {item, id} of keyItems) {
      const on = keyRegion === id;
      item.style.borderColor = on ? ACCENT : "transparent";
      item.style.color = on ? ACCENT : "inherit";
      item.setAttribute("aria-pressed", on);
    }
  }
  container.appendChild(key);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "co2-per-capita-bars");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:pointer;";
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

  // ---- the numbers at a time ------------------------------------------------------------------
  function stateAt(tt) {
    const rows = [];
    let pop = 0, co2 = 0;
    for (const c of countries) {
      const p = at(c.pop, tt);
      const e = at(mode === "year" ? c.co2 : c.cum, tt);
      if (p === null || e === null || !(p > 0)) continue;
      rows.push({c, pop: p, co2: e, v: e / p});
      pop += p;
      co2 += e;
    }
    rows.sort((a, b) => b.v - a.v || b.pop - a.pop);
    return {rows, pop, co2, world: pop > 0 ? co2 / pop : 0, vMax: SCALE_MAX[mode]};
  }

  // Emissions in all, as the labels write them: a rate in the yearly view, a total in the
  // cumulative one.
  const totalText = mt => mode === "year" ? `${formatTotal(mt)}/yr` : formatTotal(mt);

  // ---- geometry -------------------------------------------------------------------------------
  const F = v => v.toFixed(2);
  const xOf = v => plotL + (plotR - plotL) * clamp(v / SCALE_MAX[mode], 0, 1);
  const hOf = pop => PLOT_H * pop / popTop;

  // ---- drawing --------------------------------------------------------------------------------
  let barGroup, axisGroup, labelGroup, helperGroup, pickPath, cornerYear;
  const barEls = new Map();

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    const defs = svgEl("defs", {}, svg);
    const marker = svgEl("marker", {id: "co2-bars-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse"}, defs);
    svgEl("path", {d: "M0,0L10,5L0,10Z", fill: "#222"}, marker);
    axisGroup = svgEl("g", {"pointer-events": "none"}, svg);
    barGroup = svgEl("g", {}, svg);
    barEls.clear();
    pickPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.5, "pointer-events": "none"}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    helperGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    if (helpersOn) helperGroup.style.opacity = "1";
    cornerYear = svgEl("text", {
      x: F(plotR - 8), y: F(plotB - 10), "text-anchor": "end", "font-size": 40, "font-weight": "bold", fill: "#222",
      stroke: "#fff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round", "pointer-events": "none",
    }, svg);
    snapLayout();
    render();
  }

  // The stack rests on the axis: the lowest emitters per person at the bottom, the highest
  // on top.
  function snapLayout() {
    const s = stateAt(t);
    layout.clear();
    let y = plotB - hOf(s.pop);
    for (const row of s.rows) {
      const h = hOf(row.pop);
      layout.set(row.c.code, {y0: y, h, x: xOf(row.v), alpha: 1});
      y += h;
    }
  }

  // One frame: every bar moves some way towards its place and length, arrivals grow out of
  // theirs, departures shrink away; then draw.
  function frame(now) {
    raf = null;
    if (container.isConnected === false) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (glide) {
      const p = clamp((now - glide.start) / glide.duration, 0, 1);
      t = glide.from + (glide.to - glide.from) * p;
      if (p >= 1) glide = null;
      syncTime();
    }
    const s = stateAt(t);
    const rate = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    const seen = new Set();
    let y = plotB - hOf(s.pop), moving = false;
    for (const row of s.rows) {
      const h = hOf(row.pop);
      const target = {y0: y, h, x: xOf(row.v), alpha: 1};
      let cur = layout.get(row.c.code);
      if (!cur) { cur = {y0: y, h: 0, x: plotL, alpha: 0}; layout.set(row.c.code, cur); }
      for (const k of ["y0", "h", "x", "alpha"]) {
        const d = target[k] - cur[k];
        if (Math.abs(d) > 1e-3) moving = true;
        cur[k] += d * rate;
      }
      seen.add(row.c.code);
      y += h;
    }
    for (const [code, cur] of layout) {
      if (seen.has(code)) continue;
      cur.h += (0 - cur.h) * rate;
      cur.alpha += (0 - cur.alpha) * rate;
      if (cur.h < 1e-3 && cur.alpha < 0.01) layout.delete(code); else moving = true;
    }
    render(s);
    if (moving || glide) raf = requestAnimationFrame(frame);
    else lastFrame = 0;
  }
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  function render(s = stateAt(t)) {
    const rowByCode = new Map(s.rows.map(r => [r.c.code, r]));
    for (const [code, el] of barEls) if (!layout.has(code)) { el.remove(); barEls.delete(code); }
    for (const [code, cur] of layout) {
      let el = barEls.get(code);
      const c = byCode.get(code);
      if (!el) {
        el = svgEl("rect", {"data-code": code}, barGroup);
        el.setAttribute("fill", REGION_COLOURS[c.region] ?? "#888");
        barEls.set(code, el);
      }
      el.setAttribute("x", F(plotL));
      el.setAttribute("y", F(cur.y0));
      el.setAttribute("width", F(Math.max(0, cur.x - plotL)));
      el.setAttribute("height", F(Math.max(0, cur.h)));
      const dim = keyRegion && c.region !== keyRegion;
      el.setAttribute("opacity", (cur.alpha * (dim ? 0.18 : 1)).toFixed(3));
    }
    drawAxes();
    const helpers = helpersOn ? helperGeometry(rowByCode) : null;
    const inside = drawLabels(s, rowByCode, helpers?.boxes ?? []);
    if (helpersOn) drawHelpers(helpers, inside);
    const code = shown(), cur = code && layout.get(code);
    pickPath.setAttribute("d", cur ? `M${F(plotL)},${F(cur.y0)}H${F(cur.x)}V${F(cur.y0 + cur.h)}H${F(plotL)}Z` : "");
    // With the year fixed, the corner says what the year is of, in the same large type,
    // shrunk only when the plot is too narrow for the words.
    const year = Math.floor(t + EPS);
    const corner = timeline ? String(year) : `${mode === "year" ? "Yearly emissions" : "Cumulative emissions as of"} ${year}`;
    cornerYear.textContent = corner;
    cornerYear.setAttribute("font-size", Math.min(40, (plotR - plotL - 16) / (0.6 * corner.length)).toFixed(1));
    yearLabel.textContent = year;
    if (String(slider.value) !== String(Math.floor(t + EPS))) slider.value = Math.floor(t + EPS);
    describe(s, rowByCode);
  }

  // The population scale up the left, a gridline and a label every billion; the per-person
  // scale along the bottom; each axis titled clear of its tick labels.
  function drawAxes() {
    axisGroup.replaceChildren();
    const vMax = SCALE_MAX[mode];
    svgEl("path", {d: `M${F(plotL)},${F(plotT)}V${F(plotB)}H${F(plotR)}`, stroke: "#222", "stroke-width": 1.2, fill: "none"}, axisGroup);
    for (let p = 0; p <= popTop; p += 1000) {
      const y = plotB - hOf(p);
      if (p > 0) svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: "rgba(0,0,0,0.08)", "stroke-width": 1}, axisGroup);
      svgEl("path", {d: `M${F(plotL - 4)},${F(y)}H${F(plotL)}`, stroke: "#222", "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(plotL - 7), y: F(y), "text-anchor": "end", "dominant-baseline": "central", "font-size": 11, fill: "#333"}, axisGroup);
      tl.textContent = String(p / 1000);
    }
    const ycap = svgEl("text", {
      x: 14, y: F(plotT + PLOT_H / 2), "text-anchor": "middle", "dominant-baseline": "central", "font-size": 12, fill: "#333",
      transform: `rotate(-90 14 ${F(plotT + PLOT_H / 2)})`,
    }, axisGroup);
    ycap.textContent = "population (billions of people)";
    const step = niceStep(vMax / 7);
    for (let v = 0; v <= vMax + EPS; v += step) {
      const x = xOf(v);
      svgEl("path", {d: `M${F(x)},${F(plotB)}V${F(plotB + 4)}`, stroke: "#222", "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(x), y: F(plotB + 8), "text-anchor": "middle", "dominant-baseline": "hanging", "font-size": 11, fill: "#333"}, axisGroup);
      tl.textContent = formatTick(v);
    }
    const xcap = svgEl("text", {x: F((plotL + plotR) / 2), y: F(plotB + 30), "text-anchor": "middle", "dominant-baseline": "hanging", "font-size": 12, fill: "#333"}, axisGroup);
    xcap.textContent = mode === "year" ? "emissions per capita (tCO₂ / yr / person)" : `cumulative emissions per capita (tCO₂ / person, since ${firstYear})`;
  }

  // Labels, the country and its emissions in all: inside a bar tall and long enough for them;
  // otherwise just beyond the bar's end, as many as fit without touching, the top of the
  // ranking and the biggest emitters first, the font shrunk for one that would run off the
  // edge. The bar picked out (hovered or clicked) always gets its label, in the same type but
  // bold and black, and the neighbours it would clash with fade instead of it; Australia's
  // comes next in line, so it is there whenever it fits at all. `keepOut` is where the
  // opening annotations are, which no label may cross. Returns, for each label drawn inside
  // its bar, where the number sits, for the annotations' arrow.
  const OUT_FONT = 10, OUT_MIN_FONT = 7, CHAR = 0.56;
  function drawLabels(s, rowByCode, keepOut) {
    labelGroup.replaceChildren();
    const vMax = SCALE_MAX[mode];
    const pick = shown();
    const inside = new Map();
    const outside = [];
    for (const [code, cur] of layout) {
      const row = rowByCode.get(code);
      if (!row || cur.alpha < 0.5 || cur.h < 0.5) continue;
      if (keyRegion && row.c.region !== keyRegion && code !== pick) continue;
      const name = row.c.name, number = totalText(row.co2), text = `${name} ${number}`;
      const yc = cur.y0 + cur.h / 2;
      const insideFont = Math.min(14, cur.h * 0.8, (cur.x - plotL - 8) / (CHAR * text.length));
      if (insideFont >= 9) {
        const tx = svgEl("text", {x: F(plotL + 6), y: F(yc), "font-size": insideFont.toFixed(1), "font-weight": "bold", fill: "#fff", "dominant-baseline": "central"}, labelGroup);
        tx.textContent = text;
        inside.set(code, {numX: plotL + 6 + CHAR * insideFont * (name.length + 1 + number.length / 2), yc, font: insideFont, text});
      } else {
        outside.push({row, cur, text, yc, pick: code === pick, pinned: code === PINNED_CODE});
      }
      if (row.v > vMax + EPS) svgEl("circle", {cx: F(plotR + 3), cy: F(yc), r: 2, fill: "#111"}, labelGroup);
    }
    const lead = new Set(outside.filter(it => it.row.pop >= 1).sort((p, q) => q.row.v - p.row.v).slice(0, 8));
    outside.sort((p, q) => (q.pick - p.pick) || (q.pinned - p.pinned) || (lead.has(q) - lead.has(p)) || (q.row.co2 - p.row.co2));
    const placed = [];
    for (const it of outside) {
      const x0 = (it.row.v > vMax ? plotR + 8 : it.cur.x) + 4, room = w - 4 - x0;
      let font = Math.min(OUT_FONT, room / (CHAR * it.text.length));
      if (font < OUT_MIN_FONT) continue;
      const len = CHAR * font * it.text.length;
      if (!it.pick && keepOut.some(b => x0 < b[2] && b[0] < x0 + len && it.yc - font * 0.6 < b[3] && b[1] < it.yc + font * 0.6)) continue;
      const clashes = p => Math.abs(p.yc - it.yc) < Math.max(font, p.font) * 1.15 && x0 < p.x0 + p.len && p.x0 < x0 + len;
      const withPick = placed.length && placed[0].pick && clashes(placed[0]);
      if (!withPick && placed.some(clashes)) continue;
      placed.push({yc: it.yc, x0, len, font, pick: it.pick});
      const tx = svgEl("text", {
        x: F(x0), y: F(it.yc), "font-size": font.toFixed(1), "dominant-baseline": "central",
        fill: it.pick ? "#111" : REGION_COLOURS[it.row.c.region] ?? "#333",
        stroke: "#fff", "stroke-width": 2.5, "paint-order": "stroke", "stroke-linejoin": "round",
      }, labelGroup);
      if (it.pick) tx.setAttribute("font-weight", "bold");
      if (withPick) tx.setAttribute("opacity", 0.2);
      tx.textContent = it.text;
    }
    return inside;
  }

  // Three annotations around one bar, China's, for the reader's first look: a bracket for its
  // height, a bracket for its length, and a curved arrow to the number inside it, over a veil
  // that dims every other bar. They go on the first interaction of any kind. Where they sit,
  // and the boxes their words take up (so the bar labels keep clear of them); null when the
  // bar is too small to hang them on, as it is at phone width.
  const HELPER_FONT = 12;
  const HELPER_NOTE = ["total emissions = area", "= population × per-capita emissions"];
  function helperGeometry(rowByCode) {
    const cur = layout.get(HELPER_CODE), row = rowByCode.get(HELPER_CODE);
    if (!cur || !row || cur.alpha < 0.99 || cur.h < 24 || cur.x - plotL < 40 || plotR - plotL < 400) return null;
    const x1 = cur.x, y0 = cur.y0, y1 = cur.y0 + cur.h, yc = (y0 + y1) / 2;
    const em = CHAR * HELPER_FONT;
    const bx = x1 + 10, by = y1 + 12;
    const dyLen = em * "population".length, dxLen = em * "emissions per capita".length;
    const noteLen = Math.max(...HELPER_NOTE.map(s => em * s.length));
    const noteX = Math.min(bx + 7 + dyLen + 24, w - 4 - noteLen), noteY = y0 - 30;
    return {
      x1, y0, y1, yc, bx, by, noteX, noteY,
      boxes: [
        [bx + 7, yc - 8, bx + 7 + dyLen, yc + 8],
        [(plotL + x1 - dxLen) / 2, by + 4, (plotL + x1 + dxLen) / 2, by + 20],
        [noteX, noteY - 8, noteX + noteLen, noteY + 14 + 8],
      ],
    };
  }
  function drawHelpers(g, inside) {
    helperGroup.replaceChildren();
    if (!g) return;
    const {x1, y0, y1, yc, bx, by, noteX, noteY} = g;
    const ink = {stroke: "#222", "stroke-width": 1.2, fill: "none"};
    const type = {"font-size": HELPER_FONT, fill: "#222", stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};
    // The veil, with China's bar and its label drawn again on top of it.
    svgEl("rect", {x: F(plotL), y: F(plotT), width: F(w - plotL), height: F(plotB - plotT), fill: "#fff", "fill-opacity": 0.6}, helperGroup);
    svgEl("rect", {x: F(plotL), y: F(y0), width: F(x1 - plotL), height: F(y1 - y0), fill: REGION_COLOURS[byCode.get(HELPER_CODE)?.region] ?? "#888"}, helperGroup);
    const num = inside.get(HELPER_CODE);
    if (num) {
      const again = svgEl("text", {x: F(plotL + 6), y: F(yc), "font-size": num.font.toFixed(1), "font-weight": "bold", fill: "#fff", "dominant-baseline": "central"}, helperGroup);
      again.textContent = num.text;
    }
    // dy: the population, as a bracket down the right of the bar.
    svgEl("path", {d: `M${F(bx - 4)},${F(y0)}H${F(bx)}V${F(y1)}H${F(bx - 4)}`, ...ink}, helperGroup);
    const dy = svgEl("text", {x: F(bx + 7), y: F(yc), "dominant-baseline": "central", ...type}, helperGroup);
    dy.textContent = "population";
    // dx: the emissions per person, as a bracket under the bar.
    svgEl("path", {d: `M${F(plotL)},${F(by - 4)}V${F(by)}H${F(x1)}V${F(by - 4)}`, ...ink}, helperGroup);
    const dx = svgEl("text", {x: F((plotL + x1) / 2), y: F(by + 6), "text-anchor": "middle", "dominant-baseline": "hanging", ...type}, helperGroup);
    dx.textContent = "emissions per capita";
    // Area: a curved arrow from a note above and to the right, down to the number in the bar
    // (or, when the bar is too small to carry its label, to the bar itself).
    HELPER_NOTE.forEach((s, i) => {
      const tx = svgEl("text", {x: F(noteX), y: F(noteY + i * 14), "dominant-baseline": "central", ...type}, helperGroup);
      tx.textContent = s;
    });
    const tipX = num ? num.numX : (plotL + x1) / 2, tipY = num ? num.yc - num.font * 0.6 - 2 : y0 - 2;
    const sx = noteX - 6, sy = noteY + 7;
    svgEl("path", {d: `M${F(sx)},${F(sy)}Q${F(tipX + 8)},${F(sy)} ${F(tipX + 2)},${F(tipY)}`, "marker-end": "url(#co2-bars-arrow)", ...ink}, helperGroup);
  }

  function dismissHelpers() {
    if (!helpersOn) return;
    helpersOn = false;
    const g = helperGroup;
    g.style.transition = reduceMotion ? "none" : "opacity 0.7s";
    g.style.opacity = "0";
    setTimeout(() => { if (g.isConnected && !helpersOn) g.replaceChildren(); }, 800);
  }
  function showHelpers() {
    helpersOn = true;
    helperGroup.style.transition = "none";
    helperGroup.style.opacity = "1";
    requestRender();
  }

  // ---- read-outs (for assistive technology only; nothing is printed) --------------------------
  function describe(s, rowByCode) {
    const y = Math.floor(t + EPS);
    const code = shown();
    const row = code ? rowByCode.get(code) : null;
    let text;
    if (row) {
      const c = row.c, r = regions.get(c.region);
      text = mode === "year"
        ? `${c.name} (${r?.name ?? c.region}): ${formatPerPerson(row.v)} tonnes of CO₂ per person in ${y}, ${formatTotal(row.co2)} that year from ${formatPop(row.pop)} people, ` +
          `${formatPercent(row.co2 / s.co2)} of the world's ${formatTotal(s.co2)}.`
        : `${c.name} (${r?.name ?? c.region}): ${formatPerPerson(row.v)} tonnes of CO₂ per person, ${formatTotal(row.co2)} emitted from ${firstYear} to ${y}, shared out among ` +
          `its ${formatPop(row.pop)} people of ${y}; ${formatPercent(row.co2 / s.co2)} of the world's ${formatTotal(s.co2)}.`;
    } else {
      text = mode === "year"
        ? `${y}: ${formatTotal(s.co2)} of CO₂ from ${formatPop(s.pop)} people, ${formatPerPerson(s.world)} tonnes each.`
        : `${y}: ${formatTotal(s.co2)} of CO₂ since ${firstYear}, shared out among the ${formatPop(s.pop)} people of ${y}, ${formatPerPerson(s.world)} tonnes each.`;
    }
    svg.setAttribute("aria-label", `CO₂ emissions per person by country in ${y}, as bars stacked from the bottom in order of emissions per person, each as tall as its population and as long as its emissions per person. ${text}`);
  }

  // ---- pointer --------------------------------------------------------------------------------
  const codeOf = e => e.target?.getAttribute?.("data-code") ?? null;
  svg.addEventListener("click", e => {
    const code = codeOf(e);
    selected = code === null || code === selected ? null : code;
    hovered = null;
    requestRender();
    emit();
  });
  svg.addEventListener("pointerdown", () => { stopTour(); dismissHelpers(); });
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const code = codeOf(e);
    if (code !== hovered) { hovered = code; requestRender(); }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse" || hovered === null) return;
    hovered = null;
    requestRender();
  });

  // ---- state changes --------------------------------------------------------------------------
  function syncTime() {
    const y = Math.floor(t + EPS);
    if (String(slider.value) !== String(y)) slider.value = y;
  }
  let lastEmittedYear = null;
  function setTime(v) {
    t = clamp(v, firstYear, lastYear);
    glide = null;
    syncTime();
    requestRender();
    const y = Math.floor(t + EPS);
    if (y !== lastEmittedYear) { lastEmittedYear = y; emit(); }
  }
  function setMode(m) {
    if (m === mode || !MODES.includes(m)) return;
    mode = m;
    updateModeButtons(mode);
    selected = null;
    hovered = null;
    // Either view is a new picture, so the annotations come back to read it by.
    showHelpers();
    requestRender();
    emit();
  }
  function glideTo(target, ms) {
    target = clamp(target, firstYear, lastYear);
    if (reduceMotion || ms <= 0 || target === t) { setTime(target); return; }
    glide = {from: t, to: target, start: performance.now(), duration: ms};
    requestRender();
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const y = Math.floor(t + EPS);
    const s = stateAt(y);
    return {
      year: y, mode, selected: selected ? byCode.get(selected)?.name ?? null : null,
      worldPerPerson: Number(s.world.toFixed(2)), population: Math.round(s.pop), co2: Math.round(s.co2),
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  updateModeButtons(mode);
  updateKey();
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

  // ---- tour -----------------------------------------------------------------------------------
  // Back to the first year, then the years at a steady pace to the last, where it stops. It
  // plays only when asked.
  const MS_PER_YEAR = 120;
  const TOUR_STOPS = [{to: firstYear, ms: 0, hold: 1200}, {to: lastYear, ms: (lastYear - firstYear) * MS_PER_YEAR, hold: 0}];
  let touring = false, tourTimer = null;

  function tourStep(i) {
    if (!touring) return;
    if (container.isConnected === false || i >= TOUR_STOPS.length) return stopTour();
    const stop = TOUR_STOPS[i];
    glideTo(stop.to, stop.ms);
    tourTimer = setTimeout(() => tourStep(i + 1), (reduceMotion ? 0 : stop.ms) + stop.hold);
  }
  function stopTour() {
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    if (glide) setTime(Math.round(t));
    showTouring();
  }
  function showTouring() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }
  function startTour(delay = 0) {
    if (touring || !timeline) return;
    touring = true;
    selected = null;
    hovered = null;
    showTouring();
    requestRender();
    tourTimer = setTimeout(() => tourStep(0), delay);
  }

  return container;
}

// ---- formatting -----------------------------------------------------------------------------

export function formatPerPerson(v) {
  const a = Math.abs(v);
  return a >= 100 ? Math.round(v).toLocaleString("en-US") : a >= 10 ? v.toFixed(1) : v.toFixed(2);
}
// Emissions in all, as compactly as the label can carry them.
export function formatTotal(mt) {
  const a = Math.abs(mt);
  if (a >= 1000) return `${(mt / 1000).toFixed(a >= 10000 ? 0 : 1)} GtCO₂`;
  if (a >= 10) return `${Math.round(mt)} MtCO₂`;
  return `${mt.toFixed(a >= 1 ? 1 : 2)} MtCO₂`;
}
function formatPop(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} billion` : `${Math.round(m).toLocaleString("en-US")} million`;
}
function formatPercent(f) {
  const p = 100 * f;
  return `${p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1) : p.toFixed(2)}%`;
}
function formatTick(v) {
  return Number(v.toPrecision(3)).toLocaleString("en-US");
}
function niceStep(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * mag >= v - EPS) return m * mag;
  return 10 * mag;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
