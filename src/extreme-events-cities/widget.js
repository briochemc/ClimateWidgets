// Extreme events in real cities: the simple widget's skewed bell over a histogram of real
// hot-season days, with the city picked on a small world map.
//
// The third of the extreme-events widgets. The data are ERA5 daily maximum temperatures
// (via the Open-Meteo historical weather API) at a shortlist of cities, the capitals of the
// countries that send the most students to Australia plus the four largest Australian
// cities, keeping each city's three hottest months of the year, from 1940 on;
// scripts/fetch-hot-season-tmax.py writes them to data/hot-season-tmax.json, in tenths of a
// degree, one array per season. The city is picked on a small Equal Earth map drawn as in
// the co2-latitude widget: d3-geo for the projection and the clipping at the antimeridian,
// topojson-client for the land outline from the repo's countries-110m.json, passed in as
// `world`.
//
// The histogram is always shown: one bar per degree, normalised to a density (fraction of
// days per °C) so that it is on the same scale as the curves, for the seasons inside the
// year window the reader picks with the two-handle slider. The gray curve is a Pearson III
// fitted by moments to the first thirty seasons on record, the baseline; the black curve is
// the same fit to the window, so it follows the slider. There are no curve sliders here:
// the reader's controls are the city and the years.
//
// The extremes are the baseline's hottest and coldest 1% of days, rounded to whole degrees,
// so each city gets thresholds of its own. The temperature axis is the same for every city,
// so that nothing jumps when one is picked, except that the two polar stations slide it
// down by 25 degrees (same width, animated, so the ticks are seen to move); the vertical
// scale is fixed at twice the
// baseline curve's peak, as in the other two widgets, and the histogram does not change it.
// The figures under the brackets, in numbers mode, are the data's: the share of the
// window's days beyond each threshold, against the baseline's share.

import {geoEqualEarth, geoPath} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import {pearson3, formatShare} from "../extreme-events/widget.js";

const BACKGROUND = "#f2f2f2";
const RED = "#e3120b";
const BLUE = "#0b57d0";
const ACCENT = "#0b57d0";
const GRAY_CURVE = "#9a9a9a", BLACK_CURVE = "#222";
const MID_FILL = "#e3e3e3";
const BAR_FILL = "rgba(60,60,60,0.12)", BAR_STROKE = "#555";
const LAND_FILL = "#d9d9d9", SEA_FILL = "#fbfbfb";
const TINT_BASE = 0.38, TINT_LOSS = 0.16;
const LEADER_BAND = 2;
const BASELINE_YEARS = 30;
const WINDOW_YEARS = 10;      // the window the slider opens on: the last ten years
const TAIL = 0.01;
const X_RANGE = [0, 50];      // the temperature axis, °C, the same for every city but the polar ones,
const POLAR_RANGE = [-25, 25]; // which slide it down by 25 degrees: same width, so the ticks just move
const POLAR_LAT = 60;
const SLIDE_MS = 700;         // how long the axis takes to slide between the two ranges

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const MAP_WIDTH = 300;        // the map at the full widget width; narrower widgets get it full-width
const SPHERE = {type: "Sphere"};
const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// Sample moments of a list of temperatures: mean, standard deviation, skewness.
export function moments(v) {
  const n = v.length;
  if (!n) return {mean: NaN, sd: NaN, skew: NaN, n};
  let m = 0;
  for (const x of v) m += x;
  m /= n;
  let s2 = 0, s3 = 0;
  for (const x of v) { const d = x - m; s2 += d * d; s3 += d * d * d; }
  const sd = Math.sqrt(s2 / (n - 1));
  const skew = (s3 / n) / (s2 / n) ** 1.5;
  return {mean: m, sd, skew, n};
}

// `data` is the parsed data/hot-season-tmax.json, `world` the parsed countries-110m.json
// (without it the map has no land). `city` is a name from the data; `xRange` the
// temperature axis in °C, and `polarRange` the one for cities beyond 60° of latitude.
export function createCityExtremesWidget({data, world, city = "Sydney", xRange = X_RANGE, polarRange = POLAR_RANGE, showNumbers = false, width = FIGURE_WIDTH} = {}) {
  if (!data?.cities?.length) throw new Error("createCityExtremesWidget needs the hot-season-tmax data");
  const uid = `extreme-events-cities-${++instances}`;
  const cities = data.cities.map(c => ({...c, seasons: c.days.map(d => d.map(t => t / 10))}));
  const land = world?.objects?.land ? feature(world, world.objects.land) : null;

  // Vertical layout as in the simple widget, with two caption lines at the top of the plot.
  const plotT = 12, plotH = 236, plotB = plotT + plotH;
  const ticksY = plotB + 17;
  const axisTitleY = plotB + 34;
  const bracketY = plotB + 42;
  const LINE_H = 17;
  const totalH = bracketY + 6 + 15 + 2 * LINE_H + 8;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont, mapW, mapH, projection, mapPath;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(30, 38);
    plotR = w - lerp(14, 22);
    plotW = plotR - plotL;
    tickFont = lerp(11, 12);
    labelFont = lerp(12, 14);
    titleFont = lerp(14, 20);
    // Beside the title when there is room for both, else full width under it. Equal Earth,
    // as wide as the map, its top left at the map's top left, as in the co2-latitude widget.
    mapW = w >= 560 ? MAP_WIDTH : w;
    projection = geoEqualEarth().fitWidth(mapW, SPHERE);
    const bounds = geoPath(projection).bounds(SPHERE);
    const [tx, ty] = projection.translate();
    projection.translate([tx - bounds[0][0], ty - bounds[0][1]]);
    mapPath = geoPath(projection);
    mapH = Math.ceil(bounds[1][1] - bounds[0][1]);
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let c = cities.find(x => x.name === city) ?? cities[0];
  let base;                       // the baseline: its years, days, moments, shares
  let from, to;                   // the window, inclusive season years
  let numbers = Boolean(showNumbers);
  let ref, cur, win;              // the two curves and the window's moments
  const rangeFor = x => (Math.abs(x.lat) >= POLAR_LAT ? polarRange : xRange);
  let [xMin, xMax] = rangeFor(c);   // the axis as drawn now, which may be mid-slide
  let thrHi, thrLo;

  const yearIndex = y => c.years.indexOf(y);
  const daysIn = (y0, y1) => c.seasons.slice(yearIndex(y0), yearIndex(y1) + 1).flat();
  const share = (days, hi) => {
    let k = 0;
    for (const x of days) if (hi ? x > thrHi : x < thrLo) k++;
    return days.length ? k / days.length : 0;
  };
  const quantileOf = (days, p) => {
    const s = [...days].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
  };

  function setCity(next) {
    c = next;
    const y0 = c.years[0], y1 = c.years[Math.min(BASELINE_YEARS, c.years.length) - 1];
    const days = daysIn(y0, y1);
    base = {from: y0, to: y1, ...moments(days)};
    const [lo, hi] = rangeFor(c);
    thrHi = clamp(Math.round(quantileOf(days, 1 - TAIL)), lo, hi);
    thrLo = clamp(Math.round(quantileOf(days, TAIL)), lo, hi);
    base.hiShare = share(days, true);
    base.loShare = share(days, false);
    ref = pearson3(base.mean, base.sd, base.skew);
    resetWindow();
  }
  function resetWindow() {
    to = c.years[c.years.length - 1];
    from = c.years[Math.max(0, c.years.length - WINDOW_YEARS)];
    fitWindow();
  }
  // The black curve: the same fit as the baseline's, to the window's days.
  function fitWindow() {
    win = moments(daysIn(from, to));
    cur = pearson3(win.mean, win.sd, win.skew);
  }
  setCity(c);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;` +
    `box-sizing:border-box;max-width:${maxW + 24}px;`;

  // The title at the left and the map at the right, the map dropping under the title when
  // the widget is too narrow for both.
  const header = document.createElement("div");
  header.style.cssText = "display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:6px 16px;";
  container.appendChild(header);
  const title = document.createElement("div");
  title.style.cssText = "font-weight:bold;color:#111;line-height:1.2;white-space:pre-line;padding:0 0 6px;flex:1 1 200px;";
  title.textContent = "The hottest days of the year\nare getting more common";
  header.appendChild(title);

  const mapSvg = document.createElementNS(SVG_NS, "svg");
  mapSvg.setAttribute("role", "group");
  mapSvg.setAttribute("aria-label", "Pick a city");
  mapSvg.style.cssText = "display:block;flex:0 0 auto;";
  header.appendChild(mapSvg);

  // The year window, the numbers toggle and the reset button, on one row.
  const toolRow = document.createElement("div");
  toolRow.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;border-top:1px solid #cfcfcf;" +
    "padding:8px 0 4px;font-size:13px;color:#555;";
  container.appendChild(toolRow);

  const yearsName = document.createElement("span");
  yearsName.textContent = "Years";
  yearsName.style.cssText = "color:#333;white-space:nowrap;";
  const yearsSvg = document.createElementNS(SVG_NS, "svg");
  const RANGE_H = 24, HANDLE_R = 7;
  yearsSvg.setAttribute("height", RANGE_H);
  yearsSvg.style.cssText = "display:block;flex:1 1 140px;min-width:120px;overflow:visible;touch-action:none;";
  yearsSvg.setAttribute("role", "group");
  yearsSvg.setAttribute("aria-label", "Years in the histogram");
  const yearsOut = document.createElement("span");
  yearsOut.style.cssText = "min-width:5.5em;text-align:right;font-variant-numeric:tabular-nums;color:#333;";
  toolRow.append(yearsName, yearsSvg, yearsOut);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;align-items:center;gap:12px;margin-left:auto;";
  const numbersField = document.createElement("label");
  numbersField.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;";
  const numbersBox = document.createElement("input");
  numbersBox.type = "checkbox";
  numbersBox.checked = numbers;
  numbersBox.style.cssText = `margin:0;accent-color:${ACCENT};`;
  numbersBox.addEventListener("input", e => e.stopPropagation());
  numbersBox.addEventListener("change", () => { numbers = numbersBox.checked; render(); emit(); });
  numbersField.append(numbersBox, "Show numbers");
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  resetButton.title = "Back to the last ten years";
  resetButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;";
  resetButton.addEventListener("click", () => { resetWindow(); update(); });
  right.append(numbersField, resetButton);
  toolRow.appendChild(right);

  // The two-handle slider: a track, the span between the handles, and the handles.
  const rangeTrack = svgEl("line", {y1: RANGE_H / 2, y2: RANGE_H / 2, stroke: "#c8c8c8", "stroke-width": 4, "stroke-linecap": "round"}, yearsSvg);
  const rangeSpan = svgEl("line", {y1: RANGE_H / 2, y2: RANGE_H / 2, stroke: BAR_STROKE, "stroke-width": 4, "stroke-linecap": "round"}, yearsSvg);
  const handles = {};
  for (const key of ["from", "to"]) {
    const h = svgEl("circle", {cy: RANGE_H / 2, r: HANDLE_R, fill: "#fff", stroke: BAR_STROKE, "stroke-width": 2, tabindex: 0,
      role: "slider", "aria-label": key === "from" ? "First year" : "Last year"}, yearsSvg);
    h.style.cursor = "ew-resize";
    h.addEventListener("focus", () => h.setAttribute("stroke", ACCENT));
    h.addEventListener("blur", () => h.setAttribute("stroke", BAR_STROKE));
    h.addEventListener("keydown", e => {
      const d = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
      if (!d) return;
      e.preventDefault();
      setYear(key, (key === "from" ? from : to) + d * (e.shiftKey ? 10 : 1));
    });
    h.addEventListener("pointerdown", e => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      h.focus();
      const move = ev => setYear(key, yearAt(ev.clientX));
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", () => h.removeEventListener("pointermove", move), {once: true});
    });
    handles[key] = h;
  }
  yearsSvg.addEventListener("pointerdown", e => {
    if (e.target.tagName === "circle") return;
    const y = yearAt(e.clientX);
    const key = Math.abs(y - from) <= Math.abs(y - to) ? "from" : "to";
    setYear(key, y);
    handles[key].focus();
  });
  const rangeWidth = () => yearsSvg.getBoundingClientRect().width || 200;
  const yearX = y => HANDLE_R + ((y - c.years[0]) / (c.years[c.years.length - 1] - c.years[0])) * (rangeWidth() - 2 * HANDLE_R);
  const yearAt = clientX => {
    const r = yearsSvg.getBoundingClientRect();
    const t = clamp((clientX - r.left - HANDLE_R) / (r.width - 2 * HANDLE_R), 0, 1);
    return c.years[Math.round(t * (c.years.length - 1))];
  };
  function setYear(key, y) {
    y = clamp(y, c.years[0], c.years[c.years.length - 1]);
    if (key === "from") from = Math.min(y, to); else to = Math.max(y, from);
    update();
  }
  function updateRange() {
    const x0 = yearX(from), x1 = yearX(to), W = rangeWidth();
    setAttrs(rangeTrack, {x1: HANDLE_R, x2: W - HANDLE_R});
    setAttrs(rangeSpan, {x1: x0.toFixed(1), x2: x1.toFixed(1)});
    handles.from.setAttribute("cx", x0.toFixed(1));
    handles.to.setAttribute("cx", x1.toFixed(1));
    for (const key of ["from", "to"]) {
      setAttrs(handles[key], {"aria-valuemin": c.years[0], "aria-valuemax": c.years[c.years.length - 1], "aria-valuenow": key === "from" ? from : to});
    }
    yearsOut.textContent = `${from}–${to}`;
  }

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "extreme-events-cities");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const note = document.createElement("div");
  note.style.cssText = "padding:10px 0 0;color:#888;font-size:14px;";
  note.textContent =
    "Click a city on the map. The bars are its real days in the three hottest months of the year, one bar per degree, " +
    "for the years chosen with the slider; the black curve is fitted to them, and the gray curve to the first thirty " +
    "years on record, the baseline. Extreme heat and cold are the hottest and coldest 1% of baseline days, rounded to " +
    "the degree. Data: ERA5 reanalysis via Open-Meteo, at the city's grid point, from 1940.";
  container.appendChild(note);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const halo = {stroke: BACKGROUND, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

  // ---- the map ------------------------------------------------------------------------------------
  // Equal Earth: the ocean, the land, the sphere's edge, a dot per city. The chosen city's
  // dot is filled and named; the others name themselves on hover. Dots are focusable, Enter
  // or Space picks one, and the arrow keys walk the list.
  let dots = [], mapLabel;
  function buildMap() {
    mapSvg.setAttribute("width", mapW);
    mapSvg.setAttribute("height", mapH);
    mapSvg.replaceChildren();
    svgEl("path", {d: mapPath(SPHERE), fill: SEA_FILL}, mapSvg);
    if (land) svgEl("path", {d: mapPath(land), fill: LAND_FILL}, mapSvg);
    svgEl("path", {d: mapPath(SPHERE), fill: "none", stroke: "#bbb", "stroke-width": 0.75}, mapSvg);
    dots = cities.map((x, i) => {
      const [cx, cy] = projection([x.lon, x.lat]);
      const dot = svgEl("circle", {cx: cx.toFixed(1), cy: cy.toFixed(1), r: 3.5, fill: "#fff", stroke: "#333", "stroke-width": 1.25,
        tabindex: 0, role: "button", "aria-label": `${x.name}, ${x.country}`}, mapSvg);
      dot.style.cursor = "pointer";
      const t = svgEl("title", {}, dot);
      t.textContent = `${x.name}, ${x.country}`;
      dot.addEventListener("click", () => pick(x));
      dot.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(x); }
        else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); dots[(i + 1) % dots.length].el.focus(); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); dots[(i + dots.length - 1) % dots.length].el.focus(); }
      });
      dot.addEventListener("pointerenter", () => { if (x !== c) dot.setAttribute("r", 5); });
      dot.addEventListener("pointerleave", () => { if (x !== c) dot.setAttribute("r", 3.5); });
      dot.addEventListener("focus", () => dot.setAttribute("stroke", ACCENT));
      dot.addEventListener("blur", () => dot.setAttribute("stroke", x === c ? ACCENT : "#333"));
      return {el: dot, x: cx, y: cy, city: x};
    });
    mapLabel = svgEl("text", {"font-size": 12, "font-weight": "bold", fill: ACCENT, stroke: SEA_FILL, "stroke-width": 3, "paint-order": "stroke"}, mapSvg);
    updateMap();
  }
  function updateMap() {
    for (const d of dots) {
      const on = d.city === c;
      setAttrs(d.el, {r: on ? 5 : 3.5, fill: on ? ACCENT : "#fff", stroke: on ? ACCENT : "#333"});
      d.el.setAttribute("aria-pressed", on);
      if (on) {
        // The name to the right of the dot, or to the left near the map's right edge.
        const left = d.x > mapW - 70;
        setAttrs(mapLabel, {x: (d.x + (left ? -8 : 8)).toFixed(1), y: (d.y + 4).toFixed(1), "text-anchor": left ? "end" : "start"});
        mapLabel.textContent = c.name;
      }
    }
    // The chosen dot drawn last, so that neighbours do not cover it.
    const chosen = dots.find(d => d.city === c);
    if (chosen) mapSvg.insertBefore(chosen.el, mapLabel);
  }
  function pick(x) {
    if (x === c) return;
    setCity(x);
    updateMap();
    slideAxis(rangeFor(c));
    updateRange();
    emit();
  }

  // The axis slides to the new city's range, the whole figure redrawn on it each frame so
  // the ticks are seen to move; it jumps when the range is the same or motion is unwanted.
  let slide = null;
  function slideAxis([toMin, toMax]) {
    if (slide) { cancelAnimationFrame(slide); slide = null; }
    const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if ((xMin === toMin && xMax === toMax) || reduced || typeof requestAnimationFrame !== "function") {
      xMin = toMin; xMax = toMax;
      build();
      return;
    }
    const fromMin = xMin, fromMax = xMax, t0 = performance.now();
    const step = now => {
      const u = Math.min(1, (now - t0) / SLIDE_MS);
      const e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2; // ease in and out
      xMin = fromMin + (toMin - fromMin) * e;
      xMax = fromMax + (toMax - fromMax) * e;
      build();
      slide = u < 1 ? requestAnimationFrame(step) : null;
    };
    slide = requestAnimationFrame(step);
  }

  // ---- scales and sampling ----------------------------------------------------------------------
  const xs = x => plotL + ((x - xMin) / (xMax - xMin)) * plotW;
  let yMax = 1;
  const ys = v => plotB - (Math.min(v, 1e3) / yMax) * plotH;

  let samples;
  function buildSamples() {
    const n = Math.max(200, Math.round(2 * plotW));
    samples = [];
    for (let i = 0; i <= n; i++) samples.push(xMin + ((xMax - xMin) * i) / n);
  }
  function curvePoints(dist) {
    const pts = [];
    for (const x of samples) {
      if (dist.lower > xMin && x > dist.lower && pts.length && pts[pts.length - 1][0] < dist.lower) {
        pts.push([dist.lower, 0], [dist.lower, dist.pdf(dist.lower + 1e-9)]);
      }
      pts.push([x, dist.pdf(x)]);
    }
    return pts;
  }
  const P = ([x, v]) => `${xs(x).toFixed(1)},${ys(v).toFixed(1)}`;
  const toPath = pts => pts.map((p, i) => `${i ? "L" : "M"}${P(p)}`).join("");
  const areaPath = pts => `M${xs(pts[0][0]).toFixed(1)},${plotB}${pts.map(p => `L${P(p)}`).join("")}L${xs(pts[pts.length - 1][0]).toFixed(1)},${plotB}Z`;
  const betweenPath = (a, b) => `M${a.map(P).join("L")}L${[...b].reverse().map(P).join("L")}Z`;

  // The histogram of the window's days as a step outline: one bin per whole degree, the
  // height a density (fraction of days per degree), on the same scale as the curves.
  function histogramPath(days) {
    const k0 = Math.floor(xMin), k1 = Math.ceil(xMax);
    const counts = new Array(k1 - k0 + 1).fill(0);
    for (const x of days) {
      const k = Math.floor(x) - k0;
      if (k >= 0 && k < counts.length) counts[k]++;
    }
    const n = days.length || 1;
    let d = `M${xs(k0).toFixed(1)},${plotB}`;
    counts.forEach((cnt, i) => {
      const y = ys(cnt / n).toFixed(1);
      d += `L${xs(k0 + i).toFixed(1)},${y}L${xs(k0 + i + 1).toFixed(1)},${y}`;
    });
    return d + `L${xs(k1 + 1).toFixed(1)},${plotB}Z`;
  }

  // ---- scaffolding, rebuilt on resize and city change ------------------------------------------
  let refCurve, curCurve, areaEls, betweenEls, clipRefArea, clipCurArea, bars, caption2, caption3;
  let refLabel, curLabel;
  const tails = {};

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    buildSamples();

    svgEl("rect", {width: w, height: totalH, fill: BACKGROUND}, svg);
    const defs = svgEl("defs", {}, svg);
    const clip = (name, child) => {
      const cp = svgEl("clipPath", {id: `${uid}-${name}`}, defs);
      cp.appendChild(child);
      return child;
    };
    const url = name => `url(#${uid}-${name})`;
    clip("plot", svgEl("rect", {x: plotL - 1, y: plotT, width: plotW + 2, height: plotH}));
    const xLo = xs(thrLo), xHi = xs(thrHi);
    clip("lo", svgEl("rect", {x: plotL - 1, y: plotT, width: xLo - plotL + 1, height: plotH}));
    clip("mid", svgEl("rect", {x: xLo, y: plotT, width: xHi - xLo, height: plotH}));
    clip("hi", svgEl("rect", {x: xHi, y: plotT, width: plotR + 1 - xHi, height: plotH}));
    clipRefArea = clip("ref-area", svgEl("path", {}));
    clipCurArea = clip("cur-area", svgEl("path", {}));

    const plot = svgEl("g", {"clip-path": url("plot")}, svg);
    const mid = svgEl("g", {"clip-path": url("mid")}, plot);
    areaEls = [svgEl("path", {fill: MID_FILL}, mid), svgEl("path", {fill: MID_FILL}, mid)];
    betweenEls = [];
    for (const [side, colour] of [["lo", BLUE], ["hi", RED]]) {
      const g = svgEl("g", {"clip-path": url(side)}, plot);
      areaEls.push(svgEl("path", {fill: tint(colour, TINT_BASE)}, g));
      betweenEls.push(svgEl("path", {fill: tint(colour, TINT_LOSS), "clip-path": url("ref-area")}, g));
      betweenEls.push(svgEl("path", {fill: colour, "clip-path": url("cur-area")}, g));
    }
    // The bars sit over the painted areas and under the curves, translucent so the tails'
    // colours show through them.
    bars = svgEl("path", {fill: BAR_FILL, stroke: BAR_STROKE, "stroke-width": 1, "stroke-linejoin": "miter"}, plot);
    refCurve = svgEl("path", {fill: "none", stroke: GRAY_CURVE, "stroke-width": 2, "stroke-linejoin": "round"}, plot);
    curCurve = svgEl("path", {fill: "none", stroke: BLACK_CURVE, "stroke-width": 2.5, "stroke-linejoin": "round"}, plot);

    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#555", "stroke-width": 1.25}, svg);
    svgEl("line", {x1: plotL, x2: plotL, y1: plotB, y2: plotT + 6, stroke: "#555", "stroke-width": 1.25}, svg);
    svgEl("path", {d: `M${plotL - 4},${plotT + 10}L${plotL},${plotT + 2}L${plotL + 4},${plotT + 10}`, fill: "none", stroke: "#555", "stroke-width": 1.25}, svg);
    const yTitle = svgEl("text", {
      x: plotL - 8, y: (plotT + plotB) / 2, "text-anchor": "middle", "font-size": tickFont, fill: "#555",
      transform: `rotate(-90 ${plotL - 8} ${(plotT + plotB) / 2})`,
    }, svg);
    yTitle.textContent = "How often (share of days per °C)";

    for (let t = Math.ceil(xMin / 10) * 10; t <= xMax; t += 10) {
      const x = xs(t).toFixed(1);
      svgEl("line", {x1: x, x2: x, y1: plotB, y2: plotB + 4, stroke: "#777"}, svg);
      const el = svgEl("text", {x, y: ticksY, "text-anchor": "middle", "font-size": tickFont, fill: "#555"}, svg);
      el.textContent = `${t}`;
    }
    const xTitle = svgEl("text", {x: xs((xMin + xMax) / 2).toFixed(1), y: axisTitleY, "text-anchor": "middle", "font-size": tickFont, fill: "#555"}, svg);
    xTitle.textContent = "Daily maximum temperature (°C)";

    // Caption lines, top left: the city and its hot season; what the bars and the gray curve
    // are; and, with the numbers, the two fits.
    const caption1 = svgEl("text", {x: plotL + 8, y: plotT + 12, "font-size": tickFont + 1, "font-weight": "bold", fill: "#555"}, svg);
    caption1.textContent = narrow() ? `${c.name}: days in ${c.season}` : `${c.name}, ${c.country}: days in ${c.season}, its three hottest months`;
    caption2 = svgEl("text", {x: plotL + 8, y: plotT + 12 + tickFont + 4, "font-size": tickFont, fill: "#777"}, svg);
    caption3 = svgEl("text", {x: plotL + 8, y: plotT + 12 + 2 * (tickFont + 4), "font-size": tickFont, fill: "#777"}, svg);

    for (const [side, colour] of [["lo", BLUE], ["hi", RED]]) {
      const hi = side === "hi";
      const g = svgEl("g", {}, svg);
      const x1 = hi ? xs(thrHi) : plotL, x2 = hi ? plotR : xs(thrLo);
      const t = {
        lines: [],
        leader: svgEl("line", {stroke: colour, "stroke-width": 1.25}, g),
        leaderLabel: svgEl("text", {"text-anchor": "middle", "font-size": labelFont, "font-weight": "bold", fill: colour, ...halo}, g),
        cx: (x1 + x2) / 2,
      };
      svgEl("path", {
        d: `M${x1.toFixed(1)},${bracketY}L${x1.toFixed(1)},${bracketY + 6}L${x2.toFixed(1)},${bracketY + 6}L${x2.toFixed(1)},${bracketY}`,
        fill: "none", stroke: "#000", "stroke-width": 1.5,
      }, g);
      tails[side] = t;
      for (let i = 0; i < 3; i++) {
        t.lines.push(svgEl("text", {
          y: bracketY + 6 + 15 + i * LINE_H, "text-anchor": "middle", "font-size": labelFont,
          fill: i === 0 ? colour : "#555", "font-weight": i === 0 ? "bold" : "normal", ...halo,
        }, g));
      }
    }
    fitLines(0, {lo: "extreme cold", hi: "extreme heat"});
    fitLines(1, {lo: `below ${fmtDeg(thrLo)}`, hi: `above ${fmtDeg(thrHi)}`});

    refLabel = svgEl("text", {"font-size": labelFont, fill: GRAY_CURVE, ...halo}, svg);
    curLabel = svgEl("text", {"font-size": labelFont, "font-weight": "bold", fill: BLACK_CURVE, ...halo}, svg);

    render();
  }

  // ---- per-frame drawing ----------------------------------------------------------------------
  function render() {
    const refPts = curvePoints(ref), curPts = curvePoints(cur);
    const peak = pts => pts.reduce((m, [, v]) => Math.max(m, Math.min(v, 1e3)), 0);
    const refPeak = peak(refPts);
    yMax = refPeak * clamp((1.08 * peak(curPts)) / refPeak, 2, 3);

    refCurve.setAttribute("d", toPath(refPts));
    curCurve.setAttribute("d", toPath(curPts));
    const refArea = areaPath(refPts), curArea = areaPath(curPts), between = betweenPath(curPts, refPts);
    clipRefArea.setAttribute("d", refArea);
    clipCurArea.setAttribute("d", curArea);
    const [midRef, midCur, loBase, hiBase] = areaEls;
    midRef.setAttribute("d", refArea);
    midCur.setAttribute("d", curArea);
    loBase.setAttribute("d", refArea);
    hiBase.setAttribute("d", refArea);
    for (const el of betweenEls) el.setAttribute("d", between);

    const days = daysIn(from, to);
    bars.setAttribute("d", histogramPath(days));
    caption2.textContent = narrow()
      ? `bars, black: ${from}–${to}; gray: ${base.from}–${base.to}`
      : `bars and black curve: ${from}–${to}; gray curve: ${base.from}–${base.to}, the baseline`;
    caption3.textContent = !numbers ? "" : narrow()
      ? `${win.mean.toFixed(1)} ± ${win.sd.toFixed(1)} °C (was ${base.mean.toFixed(1)} ± ${base.sd.toFixed(1)})`
      : `fits: ${win.mean.toFixed(1)} ± ${win.sd.toFixed(1)} °C, skewness ${signed(win.skew, 2)} (baseline ${base.mean.toFixed(1)} ± ${base.sd.toFixed(1)} °C, ${signed(base.skew, 2)})`;

    const stats = {lo: tailStats("lo"), hi: tailStats("hi")};
    const dataShare = {hi: share(days, true), lo: share(days, false)};
    for (const side of ["lo", "hi"]) placeLeader(side, stats[side]);
    const of = narrow() ? "" : " of days"; // two full lines do not fit side by side on a phone
    fitLines(2, {
      lo: numbers ? `${formatShare(dataShare.lo)}${of} (was ${formatShare(base.loShare)})` : "",
      hi: numbers ? `${formatShare(dataShare.hi)}${of} (was ${formatShare(base.hiShare)})` : "",
    });
    placeCurveLabels(refPts, curPts);

    svg.setAttribute("aria-label",
      `${c.name} daily maximum temperatures in ${c.season}, ${from} to ${to}, as a histogram with a fitted curve, against a ` +
      `curve fitted to ${base.from}–${base.to}. The average moved from ${base.mean.toFixed(1)} to ${win.mean.toFixed(1)} °C. ` +
      `Days above ${fmtDeg(thrHi)} are ${formatShare(dataShare.hi)} of days (were ${formatShare(base.hiShare)}); ` +
      `days below ${fmtDeg(thrLo)} ${formatShare(dataShare.lo)} (were ${formatShare(base.loShare)}).`);
  }

  // One line of the two brackets' labels, each centred on its bracket, nudged apart when the
  // two would overlap (the thresholds can be close on the shared axis) and kept inside the
  // figure.
  function fitLines(i, text) {
    const hw = {lo: labelHalfWidth(text.lo, labelFont) + 3, hi: labelHalfWidth(text.hi, labelFont) + 3};
    let xLo = tails.lo.cx, xHi = tails.hi.cx;
    const overlap = xLo + hw.lo - (xHi - hw.hi);
    if (overlap > 0) { xLo -= overlap / 2; xHi += overlap / 2; }
    xLo = clamp(xLo, hw.lo, w - hw.lo);
    xHi = clamp(xHi, hw.hi, w - hw.hi);
    tails.lo.lines[i].textContent = text.lo;
    tails.lo.lines[i].setAttribute("x", xLo.toFixed(1));
    tails.hi.lines[i].textContent = text.hi;
    tails.hi.lines[i].setAttribute("x", xHi.toFixed(1));
  }
  const narrow = () => w < 480;

  function tailStats(side) {
    const hi = side === "hi";
    const t = hi ? thrHi : thrLo;
    const fNow = clamp(hi ? 1 - cur.cdf(t) : cur.cdf(t), 0, 1);
    const fWas = clamp(hi ? 1 - ref.cdf(t) : ref.cdf(t), 0, 1);
    const ratio = fWas > 0 ? fNow / fWas : fNow > 0 ? Infinity : 1;
    let sw = 0, sx = 0, sy = 0;
    for (const x of samples) {
      if (hi ? x <= t : x >= t) continue;
      const a = Math.min(cur.pdf(x), 1e3), b = Math.min(ref.pdf(x), 1e3);
      const d = Math.abs(a - b);
      sw += d; sx += d * x; sy += (d * (a + b)) / 2;
    }
    return {t, fNow, fWas, ratio, cx: sw > 1e-12 ? sx / sw : null, cy: sw > 1e-12 ? sy / sw : 0};
  }

  // The multiplier over a tail is the fitted curves', shown once it is outside the band from
  // half to double, and always with the numbers.
  function placeLeader(side, st) {
    const t = tails[side];
    const show = st.cx != null && Number.isFinite(st.ratio) && (numbers || st.ratio >= LEADER_BAND || st.ratio <= 1 / LEADER_BAND);
    t.leader.style.display = t.leaderLabel.style.display = show ? "" : "none";
    if (!show) return;
    const px = clamp(xs(st.cx), plotL + 24, plotR - 24);
    const top = Math.max(plotT + labelFont + 4, ys(Math.max(cur.pdf(st.cx), ref.pdf(st.cx))) - 10);
    setAttrs(t.leader, {x1: px.toFixed(1), x2: px.toFixed(1), y1: ys(st.cy).toFixed(1), y2: top.toFixed(1)});
    setAttrs(t.leaderLabel, {x: px.toFixed(1), y: (top - 4).toFixed(1)});
    t.leaderLabel.textContent = `${formatMultiplier(st.ratio)}×`;
  }

  // The curves are named by their years, each label on the side away from the other and
  // kept inside the figure. When the window is the baseline there is one curve, so one label.
  function placeCurveLabels(refPts, curPts) {
    const peakOf = pts => pts.reduce((m, p) => (p[1] > m[1] ? p : m));
    const rp = peakOf(refPts), cp = peakOf(curPts);
    const same = from === base.from && to === base.to;
    refLabel.style.display = same ? "none" : "";
    refLabel.textContent = `${base.from}–${base.to}`;
    curLabel.textContent = same ? `${from}–${to}, the baseline` : `${from}–${to}`;
    const refLeft = rp[0] <= cp[0];
    const place = (el, [x, v], left) => {
      const width = 2 * labelHalfWidth(el.textContent, labelFont);
      const px = left ? Math.max(xs(x) - 7, width + 2) : Math.min(xs(x) + 7, w - width - 2);
      setAttrs(el, {
        x: px.toFixed(1),
        y: clamp(ys(v) - 6, plotT + 12, plotB - 4).toFixed(1),
        "text-anchor": left ? "end" : "start",
      });
    };
    place(refLabel, rp, refLeft);
    place(curLabel, cp, !refLeft);
  }

  // ---- changes ----------------------------------------------------------------------------------
  function update() {
    fitWindow();
    render();
    updateRange();
    emit();
  }

  function value() {
    const days = daysIn(from, to);
    return {
      city: c.name, country: c.country, season: c.season, from, to,
      baseline: {from: base.from, to: base.to, mean: base.mean, sd: base.sd, skewness: base.skew, days: base.n},
      window: {mean: win.mean, sd: win.sd, skewness: win.skew, days: win.n},
      hotThreshold: thrHi, coldThreshold: thrLo,
      hotShare: share(days, true), hotShareBaseline: base.hiShare,
      coldShare: share(days, false), coldShareBaseline: base.loShare,
      showNumbers: numbers,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function layoutControls() {
    title.style.fontSize = `${titleFont}px`;
    title.style.marginLeft = `${plotL}px`;
    toolRow.style.margin = `0 ${w - plotR}px 0 ${plotL}px`;
  }

  layoutControls();
  buildMap();
  build();
  updateRange();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); layoutControls(); buildMap(); build(); }
      updateRange(); // the year slider's track follows its row's width
    });
    ro.observe(container);
  }

  return container;
}

// ---- formatting ---------------------------------------------------------------------------------

function signed(v, digits = 2) {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s.slice(1)}` : s;
}
const fmtDeg = t => `${Number.isInteger(t) ? t : t.toFixed(1)} °C`;
function formatMultiplier(r) {
  if (r >= 10) return Math.round(r).toLocaleString("en-US");
  if (r >= 1) return r.toFixed(1);
  if (r < 0.001) return "<0.001";
  return String(Number(r.toPrecision(1)));
}

// ---- small helpers ------------------------------------------------------------------------------

function setAttrs(el, attrs) {
  for (const k in attrs) el.setAttribute(k, attrs[k]);
}
function labelHalfWidth(text, fontSize) {
  return (text.length * fontSize * 0.56) / 2;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16), b = parseInt(BACKGROUND.slice(1), 16);
  const ch = s => Math.round(((b >> s) & 255) + (((n >> s) & 255) - ((b >> s) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
