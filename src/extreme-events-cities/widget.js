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
// The extremes are the baseline's hottest and coldest 1% of days, to a tenth of a degree,
// so each city gets thresholds of its own. The temperature axis is the same for every city,
// so that nothing jumps when one is picked, except that a city with days below 0 °C (the
// polar stations) slides it down, in steps of 5 degrees, just far enough to hold its coldest
// day: same width, so the ticks are seen to move. The vertical scale is fixed at twice the
// baseline curve's peak, as in the other two widgets, and the histogram does not change it.
// The figures under the brackets, in numbers mode, are the data's: the share of the
// window's days beyond each threshold, against the baseline's share.
//
// Picking a city is a sequence rather than a cut: the curves (with their painted tails and
// labels) fade out, the bars of the city being left sink to the axis, the new city's bars
// rise from it (the axis sliding under them when its range differs), and the curves fade
// back in. Two things carry it: `alpha`, the curves' opacity, and `wave`, how far the bars
// are through their sink or rise, which each bin joins a little after the one to its left.

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
// The record starts in 1950, although the data file runs from 1940: ERA5's 1940s rest on
// the sparse observations of the war years and come out a degree or two too warm at
// several unrelated cities (Sydney, Beijing, Islamabad), which, as a third of the baseline,
// inflated every "was" figure.
const FIRST_YEAR = 1950;
const TAIL = 0.01;
const X_RANGE = [0, 55];      // the temperature axis, °C (Baghdad's days pass 52), the same for every city
const RANGE_STEP = 5;         // but one with colder days, which slides it down by this much at a time
const FADE_MS = 220;          // the curves fading out before a city change, and back in after it
const DROP_MS = 520;          // the old city's bars sinking to the axis
const RISE_MS = 640;          // the new city's rising from it
const SLIDE_MS = 1400;        // the same rise when the axis has to slide to a new range as well
// The bars do not all move at once: each starts a little after its neighbour to the left, so
// the sink and the rise run across the axis as a wave. This is the stagger from the first bin
// to the last, as a fraction of one bin's own travel time: the last bin sets off when the
// first has long finished, so the wave is most of the motion.
const WAVE = 2.4;

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
// temperature axis in °C, which a city with colder days slides down to fit them; `firstYear`
// is where the record starts.
export function createCityExtremesWidget({data, world, city = "Sydney", xRange = X_RANGE, firstYear = FIRST_YEAR, showNumbers = false, width = FIGURE_WIDTH} = {}) {
  if (!data?.cities?.length) throw new Error("createCityExtremesWidget needs the hot-season-tmax data");
  const uid = `extreme-events-cities-${++instances}`;
  const cities = data.cities.map(c => {
    const keep = c.years.map(y => y >= firstYear);
    const seasons = c.days.filter((_, i) => keep[i]).map(d => d.map(t => t / 10));
    let coldest = Infinity;
    for (const s of seasons) for (const t of s) if (t < coldest) coldest = t;
    return {...c, years: c.years.filter((_, i) => keep[i]), seasons, coldest};
  });
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
  // The axis, or the same width slid down in whole steps to a degree below the city's coldest day.
  const rangeFor = x => {
    const lo = x.coldest - 1 < xRange[0] ? Math.floor((x.coldest - 1) / RANGE_STEP) * RANGE_STEP : xRange[0];
    return [lo, lo + xRange[1] - xRange[0]];
  };
  let [xMin, xMax] = rangeFor(c);   // the axis as drawn now, which may be mid-slide
  // The bars' motion on a city change: null at rest (full height), else which way they are
  // going and how far along, 0 to 1, with each bin's own height worked out from that (binHeight).
  let wave = null;
  let alpha = 1;                    // the curves' opacity: 0 while the bars are on the move
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

  // Everything the figure needs for a city, worked out without touching the state, so that a
  // city change can know its destination (for the captions) before the figure gets there.
  function analyse(x) {
    const y0 = x.years[0], y1 = x.years[Math.min(BASELINE_YEARS, x.years.length) - 1];
    const days = x.seasons.slice(0, x.years.indexOf(y1) + 1).flat();
    const b = {from: y0, to: y1, ...moments(days)};
    // The thresholds are the baseline's 1% quantiles to a tenth of a degree: rounding to a
    // whole degree looked friendlier but, in a tropical city where the spread is under two
    // degrees, it could move the baseline share from 1% to 0.1% and the multiplier tenfold.
    const [lo, hi] = rangeFor(x);
    const hiT = clamp(Math.round(10 * quantileOf(days, 1 - TAIL)) / 10, lo, hi);
    const loT = clamp(Math.round(10 * quantileOf(days, TAIL)) / 10, lo, hi);
    b.hiShare = days.filter(t => t > hiT).length / (days.length || 1);
    b.loShare = days.filter(t => t < loT).length / (days.length || 1);
    // The window the slider opens on: the last ten years.
    const t1 = x.years[x.years.length - 1], t0 = x.years[Math.max(0, x.years.length - WINDOW_YEARS)];
    const w = moments(x.seasons.slice(x.years.indexOf(t0), x.years.indexOf(t1) + 1).flat());
    return {c: x, base: b, thrHi: hiT, thrLo: loT, ref: pearson3(b.mean, b.sd, b.skew), from: t0, to: t1, win: w, cur: pearson3(w.mean, w.sd, w.skew)};
  }
  let preview = null; // where a city change is heading, for the captions, until the figure arrives
  function setCity(next) {
    ({c, base, thrHi, thrLo, ref, from, to, win, cur} = analyse(next));
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
  title.textContent = "The hottest days\nare getting more common";
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

  // The two-handle slider: a track, the span between the handles, a wide invisible strip over
  // the span by which the whole window is dragged along, and the handles.
  const rangeTrack = svgEl("line", {y1: RANGE_H / 2, y2: RANGE_H / 2, stroke: "#c8c8c8", "stroke-width": 4, "stroke-linecap": "round"}, yearsSvg);
  const rangeSpan = svgEl("line", {y1: RANGE_H / 2, y2: RANGE_H / 2, stroke: BAR_STROKE, "stroke-width": 4, "stroke-linecap": "round"}, yearsSvg);
  const rangeGrip = svgEl("line", {y1: RANGE_H / 2, y2: RANGE_H / 2, stroke: "#000", "stroke-opacity": 0, "stroke-width": RANGE_H}, yearsSvg);
  rangeGrip.style.cursor = "grab";
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
  // A press between the handles grabs the whole window and drags it along, its width kept;
  // a press on the track outside them jumps the nearer handle there. Decided by position,
  // not by which element was hit, since an invisible stroke is not hit-tested everywhere.
  yearsSvg.addEventListener("pointerdown", e => {
    if (e.target.tagName === "circle") return;
    e.preventDefault();
    const x = e.clientX - yearsSvg.getBoundingClientRect().left;
    if (x > yearX(from) + HANDLE_R && x < yearX(to) - HANDLE_R) {
      yearsSvg.setPointerCapture(e.pointerId);
      rangeGrip.style.cursor = "grabbing";
      const y0 = yearAt(e.clientX), from0 = from, span = to - from;
      const first = c.years[0], last = c.years[c.years.length - 1];
      const move = ev => {
        const d = clamp(yearAt(ev.clientX) - y0, first - from0, last - span - from0);
        if (from0 + d === from) return;
        from = from0 + d;
        to = from + span;
        update();
      };
      yearsSvg.addEventListener("pointermove", move);
      yearsSvg.addEventListener("pointerup", () => {
        yearsSvg.removeEventListener("pointermove", move);
        rangeGrip.style.cursor = "grab";
      }, {once: true});
      return;
    }
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
    setAttrs(rangeGrip, {x1: x0.toFixed(1), x2: x1.toFixed(1)});
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
    "years of the record, the baseline. Extreme heat and cold are the hottest and coldest 1% of baseline days. " +
    "Data: ERA5 reanalysis via Open-Meteo, at the city's grid point, from 1950.";
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
  // `picked` is the city the map shows as chosen: the one the figure is heading for, during a change.
  function updateMap(picked = c) {
    for (const d of dots) {
      const on = d.city === picked;
      setAttrs(d.el, {r: on ? 5 : 3.5, fill: on ? ACCENT : "#fff", stroke: on ? ACCENT : "#333"});
      d.el.setAttribute("aria-pressed", on);
      if (on) {
        // The name to the right of the dot, or to the left near the map's right edge.
        const left = d.x > mapW - 70;
        setAttrs(mapLabel, {x: (d.x + (left ? -8 : 8)).toFixed(1), y: (d.y + 4).toFixed(1), "text-anchor": left ? "end" : "start"});
        mapLabel.textContent = picked.name;
      }
    }
    // The chosen dot drawn last, so that neighbours do not cover it.
    const chosen = dots.find(d => d.city === picked);
    if (chosen) mapSvg.insertBefore(chosen.el, mapLabel);
  }
  // Four beats: the curves fade out, the bars of the city being left sink to the axis, the
  // new city's bars rise from it with the axis sliding to its range under them when the
  // range differs (the whole figure is rebuilt on the moving axis each frame, so the ticks
  // are seen to move), and the curves fade back in. A cut when motion is unwanted. A pick
  // during any beat starts the sequence again from wherever the opacity and heights are.
  function pick(x) {
    if (x === c) return;
    const [toMin, toMax] = rangeFor(x);
    const arrive = () => {
      preview = null;
      setCity(x);
      updateMap();
      updateRange();
      emit();
    };
    if (reducedMotion() || typeof requestAnimationFrame !== "function") {
      arrive();
      wave = null; alpha = 1; xMin = toMin; xMax = toMax;
      build();
      return;
    }
    // The captions say where the figure is going from the first frame.
    preview = analyse(x);
    updateMap(x);
    // A pick mid-sequence starts the sink from about where the bars are: a rise part way up
    // reads as a sink that is the same part way from done.
    const a0 = alpha;
    const u0 = wave === null ? 0 : wave.down ? wave.u : 1 - wave.u;
    animate(FADE_MS * a0, e => { alpha = a0 * (1 - e); render(); }, () =>
      animate(DROP_MS * (1 - u0), (e, u) => { wave = {down: true, u: u0 + (1 - u0) * u}; render(); }, () => {
        arrive();
        wave = {down: true, u: 1}; alpha = 0;
        build();
        const fromMin = xMin, fromMax = xMax, moving = fromMin !== toMin || fromMax !== toMax;
        animate(moving ? SLIDE_MS : RISE_MS, (e, u) => {
          xMin = fromMin + (toMin - fromMin) * e;
          xMax = fromMax + (toMax - fromMax) * e;
          wave = {down: false, u};
          if (moving) build(); else render();
        }, () => {
          wave = null; xMin = toMin; xMax = toMax;
          build();
          animate(FADE_MS, e => { alpha = e; render(); }, () => { alpha = 1; render(); });
        });
      }));
  }

  let anim = null;
  const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = u => (u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2); // in and out
  // Runs `onFrame(eased, raw)` from 0 to 1 over `ms`, then `onDone`; a new animation replaces a running one.
  function animate(ms, onFrame, onDone) {
    if (anim) cancelAnimationFrame(anim);
    const t0 = performance.now();
    const step = now => {
      const u = ms > 0 ? Math.min(1, (now - t0) / ms) : 1;
      onFrame(ease(u), u);
      if (u < 1) { anim = requestAnimationFrame(step); return; }
      anim = null;
      onDone?.();
    };
    anim = requestAnimationFrame(step);
  }

  // Bin i of n during a wave: its own eased travel, started later the further right it is,
  // the last bin beginning WAVE travel times after the first (the whole move, first bin
  // setting off to last bin arriving, is 1 + WAVE travel times, fitted into the beat).
  function binHeight(i, n) {
    if (wave === null) return 1;
    const e = ease(clamp(wave.u * (1 + WAVE) - (i / Math.max(1, n - 1)) * WAVE, 0, 1));
    return wave.down ? 1 - e : e;
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
      const y = (plotB - binHeight(i, counts.length) * (plotB - ys(cnt / n))).toFixed(1); // scaled during a city change
      d += `L${xs(k0 + i).toFixed(1)},${y}L${xs(k0 + i + 1).toFixed(1)},${y}`;
    });
    return d + `L${xs(k1 + 1).toFixed(1)},${plotB}Z`;
  }

  // ---- scaffolding, rebuilt on resize and city change ------------------------------------------
  let refCurve, curCurve, areaEls, betweenEls, clipRefArea, clipCurArea, bars, caption1, caption2, caption3;
  let refLabel, curLabel, fading = [];
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
    caption1 = svgEl("text", {x: plotL + 8, y: plotT + 12, "font-size": tickFont + 1, "font-weight": "bold", fill: "#555"}, svg);
    caption2 = svgEl("text", {x: plotL + 8, y: plotT + 12 + tickFont + 4, "font-size": tickFont, fill: "#777"}, svg);
    caption3 = svgEl("text", {x: plotL + 8, y: plotT + 12 + 2 * (tickFont + 4), "font-size": tickFont, fill: "#777"}, svg);

    for (const [side, colour] of [["lo", BLUE], ["hi", RED]]) {
      const hi = side === "hi";
      const g = svgEl("g", {}, svg);
      const x1 = hi ? xs(thrHi) : plotL, x2 = hi ? plotR : xs(thrLo);
      const t = {
        group: g,
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
    // Everything that belongs to the curves and the thresholds rather than the bars, faded
    // together on a city change: the painted areas, the curves and their labels, the two
    // brackets with their labels and leaders.
    fading = [...areaEls, ...betweenEls, refCurve, curCurve, refLabel, curLabel, tails.lo.group, tails.hi.group];

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
    for (const el of fading) el.setAttribute("opacity", alpha.toFixed(3));

    const days = daysIn(from, to);
    bars.setAttribute("d", histogramPath(days));
    // The captions, top left, are the first thing to change on a city change: they describe
    // the destination while the figure is still on its way there.
    const cap = preview ?? {c, from, to, base, win};
    caption1.textContent = narrow()
      ? `${cap.c.name}: days in ${cap.c.season}`
      : `${cap.c.name}, ${cap.c.country}: days in ${cap.c.season}, its three hottest months`;
    caption2.textContent = narrow()
      ? `bars, black: ${cap.from}–${cap.to}; gray: ${cap.base.from}–${cap.base.to}`
      : `bars and black curve: ${cap.from}–${cap.to}; gray curve: ${cap.base.from}–${cap.base.to}, the baseline`;
    caption3.textContent = !numbers ? "" : narrow()
      ? `${cap.win.mean.toFixed(1)} ± ${cap.win.sd.toFixed(1)} °C (was ${cap.base.mean.toFixed(1)} ± ${cap.base.sd.toFixed(1)})`
      : `fits: ${cap.win.mean.toFixed(1)} ± ${cap.win.sd.toFixed(1)} °C, skewness ${signed(cap.win.skew, 2)} (baseline ${cap.base.mean.toFixed(1)} ± ${cap.base.sd.toFixed(1)} °C, ${signed(cap.base.skew, 2)})`;

    const dataShare = {hi: share(days, true), lo: share(days, false)};
    const stats = {lo: tailStats("lo", dataShare.lo), hi: tailStats("hi", dataShare.hi)};
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

  // A tail's multiplier is the data's: the window's share of days beyond the threshold over
  // the baseline's. (The fitted curves' shares would do in the middle, but a skewed fit has
  // a hard bound that can sit past a threshold where the data still have days.) The leader
  // still stands where the area between the two curves is.
  function tailStats(side, fNow) {
    const hi = side === "hi";
    const t = hi ? thrHi : thrLo;
    const fWas = hi ? base.hiShare : base.loShare;
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

  // The multiplier over a tail, shown once it is outside the band from half to double, and
  // always with the numbers; "0×" when the window has no such days at all.
  function placeLeader(side, st) {
    const t = tails[side];
    // Not while the curves are faded for a city change: a leader to nothing says nothing.
    const show = alpha === 1 && st.cx != null && Number.isFinite(st.ratio) && (numbers || st.ratio >= LEADER_BAND || st.ratio <= 1 / LEADER_BAND);
    t.leader.style.display = t.leaderLabel.style.display = show ? "" : "none";
    if (!show) return;
    const px = clamp(xs(st.cx), plotL + 24, plotR - 24);
    const top = Math.max(plotT + labelFont + 4, ys(Math.max(cur.pdf(st.cx), ref.pdf(st.cx))) - 10);
    setAttrs(t.leader, {x1: px.toFixed(1), x2: px.toFixed(1), y1: ys(st.cy).toFixed(1), y2: top.toFixed(1)});
    setAttrs(t.leaderLabel, {x: px.toFixed(1), y: (top - 4).toFixed(1)});
    t.leaderLabel.textContent = st.fNow === 0 ? "0×" : `${formatMultiplier(st.ratio)}×`;
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
