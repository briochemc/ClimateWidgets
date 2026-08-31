// Daily global sea surface temperature explorer.
//
// NOAA OISST v2.1 daily global-mean SST (world ocean, 60°S–60°N) drawn in polar
// coordinates: the day of the year is the angle and the temperature is the radius. Because
// 31 December meets 1 January at the same place on the circle, the whole record since 1981
// is one continuous spiral rather than 46 separate curves, and the years drifting outwards
// is the warming.
//
// Hovering near any loop promotes it: it redraws bold with a small white halo so it lifts
// off the others, and the day under the pointer is annotated against the 1991–2020 average
// with a signed anomaly arrow. Clicking keeps that year on screen; keep several and they
// are coloured along a heat ramp in calendar order, so a handful of years can be compared
// at once. While any are kept the pointer only moves the day round them.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.

// The figure fills its container up to FIGURE_WIDTH and reflows below it — the polar
// geometry already scales with the width, and the fonts and ring padding shrink with it.
// Below MIN_WIDTH it stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Every series in the source JSON is 366 entries long, and the index is simply the day of
// the year counted from zero: index 243 of 1981 is 1 September 1981, the first day OISST
// covers. A 365-day year therefore fills indices 0–364 and leaves 365 null as padding —
// the padding is at the end, not at 29 February — so `yearLength` is what bounds a year,
// never DAYS.
const DAYS = 366;
const CLIM_NAME = "1991-2020";

const GRAY_RGB = [110, 110, 110];
const GRAY_ALPHA = 0.45;
const GRAY = `rgba(${GRAY_RGB},${GRAY_ALPHA})`;
const GRAY_WIDTH = 1.25;  // every year, until it is selected
const SEL_WIDTH = 3.6;    // and then thicker, in its own colour
const SEL_HALO = 6;

// The five featured years each own a colour along a heat ramp, darkest for the hottest year
// down to pale for the fifth, so the buttons stand as the legend and a year's colour never
// changes with what else is selected. A line is grey until it is selected, and then takes
// its colour and thickens. Any year outside the five stays grey when it is picked out —
// thicker and solid, but never coloured.
const RAMP = ["#3c0d03", "#8d1c06", "#e67424", "#ed9b49", "#f5c34d"];
const NEUTRAL = "#777777";

// Tour timings: every leg of the tour takes the same time on screen no matter how many
// years separate the two peaks, so the pace itself carries the information — seven years
// between records races through the dates, one year ambles.
const TOUR_LEG = 3800;
const TOUR_HOLD = 1600;
const TOP_COUNT = 5;  // warmest years shown as buttons and cycled by the tour

const MONTH_START = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];
const CLIM_LABEL_DAY = 181;  // start of July: the quietest stretch of the ring for a label

export function sstUnavailableNotice() {
  const div = document.createElement("div");
  div.style.cssText =
    "font:16px sans-serif;color:#8a1f11;background:#fdf2f0;border:1px solid #e8c4bd;" +
    "border-radius:8px;padding:12px 16px;max-width:640px;";
  div.textContent =
    "Could not load the daily sea surface temperature data from climatereanalyzer.org. " +
    "Reload the page to try again.";
  return div;
}

function isLeap(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function yearLength(year) {
  return isLeap(year) ? 366 : 365;
}

function dateAt(year, i) {
  return new Date(Date.UTC(year, 0, 1 + i));
}

function fmtDate(year, i) {
  return dateAt(year, i).toISOString().slice(0, 10);
}

function firstIndex(values) {
  for (let i = 0; i < values.length; i++) if (values[i] != null) return i;
  return -1;
}

function lastIndex(values) {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] != null) return i;
  return -1;
}

// Probes a handful of neighbouring days so hovering or stepping onto a day that has no
// value yet still lands on real data instead of nothing.
function valueAt(values, i) {
  for (const d of [0, -1, 1, -2, 2]) {
    const j = i + d;
    if (j >= 0 && j < values.length && values[j] != null) return {i: j, v: values[j]};
  }
  return null;
}

// Clamps a day into the span this year actually has data for before probing, so running
// the pointer past the end of the current year pins to its latest observation rather than
// falling off the end of it.
function dayAt(values, i) {
  const lo = firstIndex(values);
  if (lo < 0) return null;
  return valueAt(values, clamp(i, lo, lastIndex(values)));
}

export function createSstDailyWidget({data, width = FIGURE_WIDTH}) {
  const years = data
    .filter(d => /^\d{4}$/.test(d.name))
    .map(d => ({year: +d.name, values: d.data.slice()}))
    .sort((a, b) => a.year - b.year);
  const clim = data.find(d => d.name === CLIM_NAME)?.data;
  if (!years.length || !clim) {
    throw new Error(`SST JSON: missing year series or "${CLIM_NAME}" climatology`);
  }

  // The most recent ~2 weeks land in a separate "Preliminary" series before being folded
  // into the year proper; merge them into the latest year here so the chart and the tour
  // always show the freshest observation, with the eventual official value winning if the
  // two ever disagree.
  const prelim = data.find(d => d.name === "Preliminary")?.data;
  if (prelim) {
    const latest = years[years.length - 1];
    for (let i = 0; i < yearLength(latest.year); i++) {
      if (latest.values[i] == null && prelim[i] != null) latest.values[i] = prelim[i];
    }
  }

  const firstYear = years[0].year;
  const lastYear = years[years.length - 1].year;
  const byYear = new Map(years.map(d => [d.year, d.values]));

  // Every year's warmest day, then the few years whose warmest day was the hottest of all.
  // Derived rather than listed, so the buttons and the tour stay right as the ranking
  // changes. Each keeps the rank it earned — rank 0 is the hottest day ever recorded — and
  // the list is then put back into calendar order, because the tour walks forward in time
  // from one peak to the next.
  const warmestYears = (() => {
    const peaks = [];
    for (const {year, values} of years) {
      let max = -Infinity, at = -1;
      for (let i = 0; i < yearLength(year); i++) {
        const v = values[i];
        if (v != null && v > max) { max = v; at = i; }
      }
      if (at >= 0) peaks.push({year, max, index: at});
    }
    return peaks
      .sort((a, b) => b.max - a.max)
      .slice(0, TOP_COUNT)
      .map((peak, rank) => ({...peak, rank}))
      .sort((a, b) => a.year - b.year);
  })();
  // The buttons read as a leaderboard: hottest year first, and the ramp runs with it.
  const byRank = [...warmestYears].sort((a, b) => a.rank - b.rank);

  // Polar layout: the day of the year is the angle and the temperature is the radius, so
  // 31 December of one year meets 1 January of the next at the same angle and the whole
  // record reads as one continuous spiral rather than 46 separate curves.
  //
  // The width param is a cap, not a fixed size: the figure fills its container up to it,
  // and everything below is recomputed by applyLayout whenever the container width changes.
  // The height tracks the width — the figure is square-ish — so a narrow embed simply
  // leaves blank space under the chart rather than scrolling.
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  const titleH = 44;
  let w, totalH, cx, cy, R, R_INNER, ringPad, monthRingLift;
  let tickFont, monthFont, climFont, titleFont, anomFont;
  let centreYearFont, centreDateFont, centreTempFont, centreYearDy, centreDateDy, centreTempDy;

  const allValues = [];
  for (const d of years) for (const v of d.values) if (v != null) allValues.push(v);
  for (const v of clim) if (v != null) allValues.push(v);
  const T_STEP = 0.5;
  const kLo = Math.floor(Math.min(...allValues) / T_STEP);
  const kHi = Math.ceil(Math.max(...allValues) / T_STEP);
  const tLo = kLo * T_STEP, tHi = kHi * T_STEP;
  const tTicks = [];
  for (let k = kLo; k <= kHi; k++) tTicks.push(k * T_STEP);

  const TAU = Math.PI * 2;

  // Angles run clockwise from midnight on 1 January at the top, the way a calendar year is
  // usually pictured going round.
  function angleAt(fraction) {
    return -Math.PI / 2 + TAU * fraction;
  }

  // A day sits at the middle of its own slice of the circle — (doy − ½) / length counting
  // days from one — and each year is divided by its own length. So a 365-day year and a
  // 366-day year both fill the circle exactly, and the step from 31 December to 1 January
  // is one day wide like every other step, with no seam and nothing to skip.
  function angleFor(doy, length) {
    return angleAt((doy + 0.5) / length);
  }

  function angleOf(year, i) {
    return angleFor(i, yearLength(year));
  }

  function radiusOf(v) {
    return R_INNER + ((v - tLo) / (tHi - tLo)) * (R - R_INNER);
  }

  function pointOf(year, i, v) {
    const a = angleOf(year, i), r = radiusOf(v);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  // Where round the circle the pointer is, as a fraction of a year.
  function fractionFromPointer(px, py) {
    const a = Math.atan2(py - cy, px - cx) + Math.PI / 2;
    return (((a % TAU) + TAU) % TAU) / TAU;
  }

  // That fraction as a slot in a particular year, which is what the year's own length makes
  // it mean.
  function indexAtFraction(year, f) {
    const len = yearLength(year);
    return clamp(Math.floor(f * len), 0, len - 1);
  }

  // The whole record as one running day count, so the tour can walk from any date to any
  // later date without having to know where the years divide.
  const yearOffset = new Map();
  let recordDays = 0;
  for (const {year} of years) {
    yearOffset.set(year, recordDays);
    recordDays += yearLength(year);
  }

  function globalDayOf(year, i) {
    return yearOffset.get(year) + i;
  }

  function fromGlobalDay(g) {
    let year = years[0].year;
    for (const d of years) {
      if (yearOffset.get(d.year) <= g) year = d.year; else break;
    }
    return {year, i: clamp(g - yearOffset.get(year), 0, yearLength(year) - 1)};
  }

  let selYear = lastYear;
  let selIndex = lastIndex(byYear.get(lastYear));
  // Years kept on screen at once. While any are kept the pointer only moves the day; the
  // last one added is `selYear`, and owns the marker, the arrow and the centre read-out.
  let kept = [];
  let focused = false;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // `context` is a variable rather than a constant because the static layer below is
  // painted by the same drawing functions, with this pointed at it for the duration.
  let context = (() => {
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    // pan-y, not none: vertical swipes over the chart must still scroll the host page
    // (this widget can fill a phone's viewport inside a Moodle iframe).
    canvas.style.touchAction = "pan-y";
    canvas.tabIndex = 0;
    canvas.style.outline = "none";
    return canvas.getContext("2d");
  })();
  const canvas = context.canvas;

  // The spiral is ~17,000 line segments and none of it changes: only the highlighted year
  // and the read-out do. So the fixed part is painted once into this off-screen layer and
  // blitted each frame, which is what keeps the tour smooth while it animates at 60fps.
  const baseCanvas = document.createElement("canvas");

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    // One multiplier for every fixed pixel size: the geometry is already proportional to
    // the width, so the type and the read-out offsets just scale along with it.
    const fs = 0.8 + 0.2 * t;
    const px = n => Math.round(n * fs);

    ringPad = lerp(26, 34);          // room outside the plot circle for the month ring
    monthRingLift = lerp(15, 20);    // how far beyond R the month names sit
    totalH = w + 20;
    cx = w / 2;
    cy = titleH + (totalH - titleH) / 2;
    R = Math.min(cx, (totalH - titleH) / 2) - ringPad;
    R_INNER = Math.round(R * 0.3);   // hole in the middle, so the coldest days stay legible

    tickFont = `${px(12)}px sans-serif`;
    monthFont = `${px(13)}px sans-serif`;
    climFont = `${px(13)}px sans-serif`;
    titleFont = `bold ${px(17)}px sans-serif`;
    anomFont = `bold ${px(15)}px sans-serif`;
    centreYearFont = `bold ${px(26)}px sans-serif`;
    centreDateFont = `${px(15)}px sans-serif`;
    centreTempFont = `bold ${px(18)}px sans-serif`;
    centreYearDy = -px(22);
    centreDateDy = px(2);
    centreTempDy = px(26);

    // Re-read dpr each time: the window may have moved to a screen with a different one.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;          // also resets the context transform
    canvas.height = totalH * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = totalH + "px";
    context.scale(dpr, dpr);

    // Follow the figure width, so the prose keeps wrapping in step with the chart.
    controls.style.maxWidth = `${w}px`;
    hint.style.maxWidth = `${w}px`;
  }

  // The base layer is sized separately from the live canvas: resizing a canvas clears it,
  // so during a continuous resize the stale base keeps being blitted, stretched — soft but
  // correct — and is only repainted at the new size once the resizing settles.
  function resizeBase() {
    const dpr = window.devicePixelRatio || 1;
    baseCanvas.width = w * dpr;
    baseCanvas.height = totalH * dpr;
    baseCanvas.getContext("2d").scale(dpr, dpr);
  }

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(canvas);
  container.appendChild(scroller);

  // Everything below the figure is capped at the figure's own width (set by applyLayout),
  // so the prose wraps in step with the chart instead of running out to the full page
  // width beside it.
  const controls = document.createElement("div");
  controls.style.cssText = "padding:10px 0 0;";
  container.appendChild(controls);

  const controlsLabel = document.createElement("div");
  controlsLabel.textContent = `The ${warmestYears.length} years with the hottest day on record:`;
  controlsLabel.style.cssText = "color:#555;font-size:14px;padding-bottom:6px;";
  controls.appendChild(controlsLabel);

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  const buttonEls = byRank.map(r => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText =
      "font:inherit;font-size:14px;line-height:1.25;text-align:left;padding:6px 10px;" +
      "border:solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;" +
      // Border-box plus a floor on the width so neither the bolder label nor the thicker
      // border shifts the row around as years are kept and dropped.
      "box-sizing:border-box;min-width:86px;";
    b.appendChild(document.createTextNode(String(r.year)));
    const sub = document.createElement("div");
    sub.textContent = `${r.max.toFixed(2)} °C`;
    sub.style.cssText = "font-size:13px;color:#777;";
    b.appendChild(sub);
    // Adds the year at its hottest day, which is the number on the button; clicking a year
    // that is already up drops it again.
    b.addEventListener("click", () => {
      stopTour();
      if (kept.includes(r.year)) {
        kept = kept.filter(y => y !== r.year);
        if (kept.length) selYear = kept[kept.length - 1];
      } else {
        kept = [...kept, r.year];
        selYear = r.year;
        selIndex = r.index;
      }
      render();
      emit();
    });
    buttons.appendChild(b);
    return {el: b, sub, record: r};
  });
  // Deliberately asking for the tour again is not the same as it restarting on its own,
  // which is why this is the only thing that ever starts it a second time.
  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.textContent = "↻ Replay";
  resetBtn.style.cssText =
    "font:inherit;font-size:14px;padding:6px 12px;margin-left:auto;align-self:stretch;" +
    "border:1px solid #ccc;border-radius:6px;background:#fff;color:#555;cursor:pointer;" +
    "box-sizing:border-box;";
  resetBtn.addEventListener("click", () => {
    stopTour();
    kept = [];
    selYear = lastYear;
    selIndex = lastIndex(byYear.get(lastYear));
    render();
    emit();
    startTour();
  });
  buttons.appendChild(resetBtn);

  controls.appendChild(buttons);

  const HINT_IDLE =
    "Hover over any loop to highlight that year. Click it — or pick a year above — to keep " +
    "it on screen, and keep as many as you want to compare.";
  const HINT_TOUR =
    "Touring the warmest years — hover the chart or pick a year above to take over.";
  const hintKept = () =>
    `${[...kept].sort((a, b) => a - b).join(", ")} kept — move the pointer to read any date. ` +
    "Click a kept loop to drop it, or press Esc to clear.";

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function fmtSigned(v) {
    const sign = v > 0 ? "+" : v < 0 ? "−" : "±";
    return `${sign}${Math.abs(v).toFixed(2)}`;
  }

  // Canvas has no text-outline property, but stroking the glyphs in white before filling
  // them is the same effect: a halo that keeps a label legible over the curves without a
  // plate blanking out the data behind it. Round joins keep the stroke from spiking at
  // sharp corners of the glyphs.
  function outlinedText(text, px, py, font, color, align = "center", baseline = "middle") {
    context.font = font;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.lineWidth = 3.5;
    context.lineJoin = "round";
    context.miterLimit = 2;
    context.strokeStyle = "#fff";
    context.strokeText(text, px, py);
    context.fillStyle = color;
    context.fillText(text, px, py);
    context.lineWidth = 1;
  }

  // One year's arc. Lifts the pen on a null day rather than bridging across it, which is
  // what 1981's leading nulls, Feb 29 in non-leap years, and the current year's not-yet-
  // observed tail all need.
  function strokeYear(year, values, color, lineWidth) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.beginPath();
    let pen = false;
    for (let i = 0; i < yearLength(year); i++) {
      const v = values[i];
      if (v == null) { pen = false; continue; }
      const [X, Y] = pointOf(year, i, v);
      if (pen) context.lineTo(X, Y); else context.moveTo(X, Y);
      pen = true;
    }
    context.stroke();
    context.lineWidth = 1;
  }

  // The 1991–2020 average is a full leap-length loop of its own, closed back on itself.
  function strokeClimatology(color, lineWidth) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.beginPath();
    for (let i = 0; i < DAYS; i++) {
      const v = clim[i];
      if (v == null) continue;
      const a = angleFor(i, DAYS), r = radiusOf(v);
      const X = cx + r * Math.cos(a), Y = cy + r * Math.sin(a);
      i === 0 ? context.moveTo(X, Y) : context.lineTo(X, Y);
    }
    context.closePath();
    context.stroke();
    context.lineWidth = 1;
  }

  // The whole record as a single unbroken path: the pen is deliberately not lifted between
  // years, so 31 December runs straight into 1 January and the spiral is continuous.
  function strokeSpiral(color, lineWidth) {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.beginPath();
    let pen = false;
    for (const {year, values} of years) {
      for (let i = 0; i < yearLength(year); i++) {
        const v = values[i];
        if (v == null) { pen = false; continue; }
        const [X, Y] = pointOf(year, i, v);
        if (pen) context.lineTo(X, Y); else context.moveTo(X, Y);
        pen = true;
      }
    }
    context.stroke();
    context.lineWidth = 1;
  }

  // Everything that never changes: the rings, the spiral itself, the 1991–2020 average and
  // the surrounding labels. Painted once into baseCanvas through the shared drawing code.
  function paintBase() {
    const live = context;
    context = baseCanvas.getContext("2d");
    context.clearRect(0, 0, w, totalH);
    drawGrid();
    // The whole spiral underneath; a highlighted year goes over the top of it later — the
    // wider accent stroke covers its own faint copy, so there is nothing to leave out.
    strokeSpiral(GRAY, GRAY_WIDTH);
    context.setLineDash([6, 4]);
    strokeClimatology("#111", 2);
    context.setLineDash([]);
    drawClimLabel();
    drawMonthRing();
    drawTitle();
    context = live;
  }

  function render() {
    context.clearRect(0, 0, w, totalH);
    context.drawImage(baseCanvas, 0, 0, w, totalH);

    // The year the read-out is about goes on last, so it sits above the rest of the set.
    const shown = years
      .filter(d => isPickedOut(d.year))
      .sort((a, b) => (a.year === selYear) - (b.year === selYear));
    for (const d of shown) drawHighlighted(d.year, d.values);

    drawAnnotation();

    for (const b of buttonEls) {
      const on = kept.includes(b.record.year) || b.record.year === selYear;
      const color = colorOf(b.record.year);
      b.el.style.color = color;
      b.sub.style.color = color;
      b.el.style.borderColor = color;
      // The swatch is the line: same colour, and the same width the curve is drawn at.
      b.el.style.borderWidth = `${on ? SEL_WIDTH : GRAY_WIDTH}px`;
      b.el.style.fontWeight = on ? "700" : "400";
      b.el.style.background = on ? "#fafafa" : "#fff";
    }

    hint.textContent = touring ? HINT_TOUR : kept.length ? hintKept() : HINT_IDLE;
  }

  // Whether a year is drawn out of the spiral at all: kept by the reader, or the one the
  // read-out is about.
  function isPickedOut(year) {
    return kept.includes(year) || year === selYear;
  }

  // Colour is the year's rank among the warmest, so it belongs to the year rather than to
  // the act of selecting it: nothing shifts hue as years come and go, and the buttons stand
  // as the legend.
  function colorOf(year) {
    const peak = warmestYears.find(r => r.year === year);
    if (!peak) return NEUTRAL;
    return rampColor(warmestYears.length === 1 ? 0 : peak.rank / (warmestYears.length - 1));
  }

  // A picked-out year is the same line, thicker and in its own colour, over a white halo
  // that lifts it clear of the spiral it belongs to.
  function drawHighlighted(year, values) {
    strokeYear(year, values, "rgba(255,255,255,0.9)", SEL_HALO);
    strokeYear(year, values, colorOf(year), SEL_WIDTH);
  }

  // Temperature rings and month spokes, plus the temperature read off along the 1 January
  // radius. Only the outermost ring carries the unit.
  function drawGrid() {
    context.strokeStyle = "rgba(0,0,0,0.12)";
    context.lineWidth = 1;
    for (const v of tTicks) {
      context.beginPath();
      context.arc(cx, cy, radiusOf(v), 0, TAU);
      context.stroke();
    }
    for (const m of MONTH_START) {
      const a = angleAt(m / DAYS);
      context.beginPath();
      context.moveTo(cx + R_INNER * Math.cos(a), cy + R_INNER * Math.sin(a));
      context.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      context.stroke();
    }
    for (const v of tTicks) {
      const label = v === tTicks[tTicks.length - 1] ? `${v.toFixed(1)} °C` : v.toFixed(1);
      outlinedText(label, cx, cy - radiusOf(v), tickFont, "#666");
    }
  }

  function drawMonthRing() {
    for (let m = 0; m < 12; m++) {
      const next = m === 11 ? DAYS : MONTH_START[m + 1];
      drawCurvedText(MONTH_NAMES[m], angleAt((MONTH_START[m] + next) / 2 / DAYS),
                     () => R + monthRingLift, monthFont, "#555");
    }
  }

  function drawTitle() {
    context.fillStyle = "#333";
    context.font = titleFont;
    context.textAlign = "center"; context.textBaseline = "alphabetic";
    context.fillText("Global mean sea surface temperature", cx, 26);
  }

  function dayFromAngle(a) {
    const f = ((((a + Math.PI / 2) % TAU) + TAU) % TAU) / TAU;
    return clamp(Math.round(f * DAYS - 0.5), 0, DAYS - 1);
  }

  // Sets text along the ring, letter by letter: each glyph sits at its own angle, at
  // whatever radius `radiusAt` gives for it, turned to the local tangent. In the bottom half
  // the glyphs have to run the other way round to stay the right way up, so the label is
  // laid out backwards from its centre.
  function drawCurvedText(text, mid, radiusAt, font, color) {
    context.font = font;
    const chars = [...text];
    const widths = chars.map(ch => context.measureText(ch).width);
    const rMid = radiusAt(mid);
    const dir = Math.sin(mid) > 0 ? -1 : 1;
    let a = mid - dir * (widths.reduce((x, y) => x + y, 0) / rMid) / 2;
    for (let n = 0; n < chars.length; n++) {
      a += dir * (widths[n] / 2) / rMid;
      const r = radiusAt(a);
      context.save();
      context.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
      context.rotate(a + dir * Math.PI / 2);
      outlinedText(chars[n], 0, 0, font, color);
      context.restore();
      a += dir * (widths[n] / 2) / rMid;
    }
  }

  // Set along the average's own loop, the way a contour is labelled on a map: the white
  // outline of the glyphs breaks the dashed line behind them, so no leader line is needed.
  function drawClimLabel() {
    drawCurvedText("1991–2020 average", angleFor(CLIM_LABEL_DAY, DAYS),
                   a => radiusOf(valueAt(clim, dayFromAngle(a))?.v ?? tLo),
                   climFont, "#333");
  }

  // Keeps a label on the canvas: the caller asks for a spot, this nudges it back inside.
  function outlinedTextClamped(text, px, py, font, color) {
    context.font = font;
    const half = context.measureText(text).width / 2;
    outlinedText(text, clamp(px, half + 4, w - half - 4), clamp(py, 12, totalH - 12),
                 font, color);
  }

  function drawAnnotation() {
    const selHit = valueAt(byYear.get(selYear), selIndex);
    if (!selHit) return;
    // Read the climatology at the same effective day as the year's own point (which can
    // differ from selIndex if that day was null and got probed to a neighbour), so the
    // marker, the arrow and the labels all sit on one radius.
    const climHit = valueAt(clim, selHit.i);

    const a = angleOf(selYear, selHit.i);
    const dx = Math.cos(a), dy = Math.sin(a);
    const rSel = radiusOf(selHit.v);
    const px = cx + rSel * dx, py = cy + rSel * dy;
    const color = colorOf(selYear);

    if (climHit) {
      const rClim = radiusOf(climHit.v);
      // The average itself carries no marker or read-out — the arrow rising off it is
      // enough, and a second labelled dot chasing the pointer was just clutter. Skipped
      // when the two radii are too close together for an arrow to read cleanly.
      if (Math.abs(rSel - rClim) >= 24) {
        const dir = rSel > rClim ? 1 : -1;          // outward when the year is above average
        const rTail = rClim + dir * 6;              // just clear of the average
        const rTip = rSel - dir * 8;                // stops just short of the marker
        const rBase = rTip - dir * 7;               // where the head meets the shaft

        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(cx + rTail * dx, cy + rTail * dy);
        context.lineTo(cx + rBase * dx, cy + rBase * dy);
        context.stroke();
        context.lineWidth = 1;

        // Arrow head, built on the radius and its perpendicular so it points along the arrow
        // whatever time of year it is.
        const ox = -dy, oy = dx;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(cx + rTip * dx, cy + rTip * dy);
        context.lineTo(cx + rBase * dx - 4 * ox, cy + rBase * dy - 4 * oy);
        context.lineTo(cx + rBase * dx + 4 * ox, cy + rBase * dy + 4 * oy);
        context.closePath();
        context.fill();

        // Sits directly above or below the marker, whichever keeps it on the outside of
        // the circle: above in the top half of the year, below in the bottom half. Straight
        // up and down reads as a label; angled off the radius read as part of the arrow.
        const topHalf = Math.sin(a) < 0;
        outlinedTextClamped(fmtSigned(selHit.v - climHit.v) + " °C",
                            px, py + (topHalf ? -18 : 18),
                            anomFont, color);
      }
    }

    context.fillStyle = color;
    context.beginPath();
    context.arc(px, py, 4.5, 0, TAU);
    context.fill();
    context.strokeStyle = "#fff";
    context.lineWidth = 2;
    context.stroke();
    context.lineWidth = 1;
    if (focused) {
      context.strokeStyle = `rgba(${rgbOf(color)},0.35)`;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(px, py, 8, 0, TAU);
      context.stroke();
      context.lineWidth = 1;
    }

    drawCentre(selHit);
  }

  // The read-out lives in the hole in the middle of the spiral: it is the one place that is
  // always empty, always in the same spot, and near enough to the marker wherever the marker
  // happens to be. A label chasing the point round the circle was the alternative, and it
  // could never settle anywhere that stayed legible.
  function drawCentre(hit) {
    const date = dateAt(selYear, hit.i);
    outlinedText(String(selYear), cx, cy + centreYearDy, centreYearFont, colorOf(selYear));
    outlinedText(`${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`, cx, cy + centreDateDy,
                 centreDateFont, "#555");
    outlinedText(`${hit.v.toFixed(2)} °C`, cx, cy + centreTempDy, centreTempFont, "#333");
  }

  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) * (w / r.width),
      py: (e.clientY - r.top) * (totalH / r.height),
    };
  }

  function inPlot(px, py) {
    return Math.hypot(px - cx, py - cy) <= R + 18;
  }

  // Nearest year along the radius the pointer is on. The pointer's angle already fixes the
  // day, so how far each year's point for that day is from the pointer, radially, is the
  // honest "which loop am I over" test; no threshold, the closest one always wins.
  function nearestYearAt(px, py) {
    const f = fractionFromPointer(px, py);
    const pr = Math.hypot(px - cx, py - cy);
    let best = null;
    for (const {year, values} of years) {
      const hit = valueAt(values, indexAtFraction(year, f));
      if (!hit) continue;
      const d = Math.abs(pr - radiusOf(hit.v));
      if (!best || d < best.d) best = {year, i: hit.i, d};
    }
    return best;
  }

  canvas.addEventListener("pointermove", e => {
    // Hover is the takeover gesture for this widget's tour, so any movement over the
    // canvas ends it — unlike temperature-trend, where only a click or key does.
    stopTour();
    const {px, py} = pointerAt(e);
    const inside = inPlot(px, py);
    canvas.style.cursor = inside ? (kept.length ? "move" : "crosshair") : "default";
    if (!inside) return;
    if (kept.length) {
      // Pinned: the year stays put and the day follows the pointer round the circle.
      const hit = dayAt(byYear.get(selYear), indexAtFraction(selYear, fractionFromPointer(px, py)));
      if (hit && hit.i !== selIndex) { selIndex = hit.i; render(); emit(); }
      return;
    }
    const best = nearestYearAt(px, py);
    if (best && (best.year !== selYear || best.i !== selIndex)) {
      selYear = best.year;
      selIndex = best.i;
      render();
      emit();
    }
  });

  canvas.addEventListener("pointerdown", e => {
    stopTour();
    canvas.focus();
    const {px, py} = pointerAt(e);
    if (!inPlot(px, py)) return;
    const best = nearestYearAt(px, py);
    if (!best) return;
    // Clicking a kept year drops it; clicking any other adds it to the set, so several
    // years can be held side by side and compared.
    if (kept.includes(best.year)) {
      kept = kept.filter(y => y !== best.year);
      if (kept.length) selYear = kept[kept.length - 1];
    } else {
      kept = [...kept, best.year];
      selYear = best.year;
      selIndex = best.i;
    }
    render();
    emit();
  });

  canvas.addEventListener("keydown", e => {
    stopTour();
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "Escape") {
      if (!kept.length) return;
      kept = [];
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const day = selIndex + (e.key === "ArrowLeft" ? -step : step);
      const hit = dayAt(byYear.get(selYear), clamp(day, 0, yearLength(selYear) - 1));
      if (!hit) return;
      selIndex = hit.i;
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // Choosing a year by keyboard is as deliberate as clicking one, so it pins too.
      const yr = clamp(selYear + (e.key === "ArrowUp" ? 1 : -1), firstYear, lastYear);
      const hit = dayAt(byYear.get(yr), clamp(selIndex, 0, yearLength(yr) - 1));
      // Steps the year being read out, swapping it in place if it is one of the kept ones.
      kept = kept.length ? kept.map(y => (y === selYear ? yr : y)) : [yr];
      selYear = yr;
      selIndex = hit ? hit.i : lastIndex(byYear.get(yr));
    } else {
      return;
    }
    e.preventDefault();
    render();
    emit();
  });

  canvas.addEventListener("focus", () => { focused = true; render(); });
  canvas.addEventListener("blur", () => { focused = false; render(); });

  function value() {
    const hit = valueAt(byYear.get(selYear), selIndex);
    const climHit = hit ? valueAt(clim, hit.i) : null;
    return {
      year: selYear,
      date: hit ? fmtDate(selYear, hit.i) : null,
      dayIndex: hit ? hit.i : null,
      sst: hit ? hit.v : null,
      climatology: climHit ? climHit.v : null,
      anomaly: hit && climHit ? hit.v - climHit.v : null,
      kept: [...kept].sort((a, b) => a - b),
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // Tour: walk the calendar from one of the hottest years' peak days to the next, so the
  // widget's point — that the warmest day on record keeps being beaten, and lately by a lot
  // — lands without anyone having to hover. The first pointer movement over the canvas ends
  // it for good; it never restarts, because a highlight that moves on its own under your
  // cursor is maddening.
  let touring = false, tourTimer = null, tourFrame = null, tourWatcher = null;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    cancelAnimationFrame(tourFrame);
    tourTimer = tourFrame = null;
    // The set the tour built up was its own illustration, not the reader's choice. Handing
    // it over intact would leave them in keeping mode before they had kept anything, unable
    // to just hover around, so the slate is wiped and they start from nothing.
    kept = [];
    render();
  }

  // Runs `frame(p)` with p going 0→1 over `duration`, then `done()`. Bails silently the
  // moment the tour is called off, so a half-finished leg never lands.
  function animate(duration, frame, done) {
    const t0 = performance.now();
    const tick = now => {
      if (!touring) return;
      const p = Math.min(1, (now - t0) / duration);
      frame(p < 1 ? p : 1);
      if (p < 1) tourFrame = requestAnimationFrame(tick);
      else done();
    };
    tourFrame = requestAnimationFrame(tick);
  }


  // One unbroken walk from one peak day to a later one, counted in real days across the
  // whole record, so the marker passes through every date in between — including the cooler
  // years the peaks are not adjacent to. It is a single animation rather than one per year:
  // nothing pauses at New Year, the highlight simply belongs to whichever year the marker
  // has reached. Eased in and out over a fixed duration, so each leg takes the
  // same time and a long gap between records is felt as a rush through the calendar.
  function walkTo(fromYear, fromIndex, toYear, toIndex, done) {
    const g0 = globalDayOf(fromYear, fromIndex);
    const g1 = globalDayOf(toYear, toIndex);
    animate(TOUR_LEG, p => {
      const at = fromGlobalDay(Math.round(g0 + (g1 - g0) * ease(p)));
      selYear = at.year;
      selIndex = at.i;
      // Selection follows the marker: the year it has left drops back into the spiral the
      // moment it crosses into the next one, rather than lingering behind it.
      kept = [at.year];
      render();
      // Kept truthful every frame, but no "input" event until the walk settles — one event
      // per peak rather than one per frame.
      container.value = value();
    }, done);
  }

  function ease(p) {
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // cubic, in and out
  }

  function tourStep(k) {
    if (!touring) return;
    // A cell that re-runs leaves the previous widget detached but still holding a timer;
    // without this it would keep animating into an orphaned canvas for the life of the page.
    // Compared against false so a host without isConnected (a test stub) still runs.
    if (container.isConnected === false) return stopTour();

    // Hottest first, then second hottest, and so on down the ranking. Because that order
    // is not the calendar's, a leg can run backwards through the years as readily as
    // forwards; either way the marker travels every date in between.
    const peak = byRank[k];
    // One year at a time: the tour is showing each peak in turn, not building a set, so
    // arriving replaces whatever it was holding rather than adding to it.
    const arrive = () => {
      selYear = peak.year;
      selIndex = peak.index;
      kept = [peak.year];
      render();
      emit();
      tourTimer = setTimeout(() => tourStep((k + 1) % byRank.length), TOUR_HOLD);
    };
    if (selYear === peak.year && selIndex === peak.index) return arrive();
    walkTo(selYear, selIndex, peak.year, peak.index, arrive);
  }

  function startTour() {
    if (touring) return;
    touring = true;
    render();
    tourTimer = setTimeout(() => tourStep(0), TOUR_HOLD);
  }

  applyLayout(maxW);
  resizeBase();
  paintBase();
  render();
  container.value = value();

  // Reflow with the container. The observer watches the widget's own container div so the
  // script-tag embed, which has no Observable runtime, is responsive too. Laying out
  // synchronously in the callback is deliberate: the observer already fires at most once
  // per frame, after layout and before paint, and the canvas sits in a max-width:100%
  // wrapper so re-laying it out can never change the container's own width and loop. The
  // expensive base layer is the one thing deferred — until it is repainted render() blits
  // the stale one, stretched. Resizing never emits "input" and never stops the tour: the
  // selection is data-space state, unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    let settle = null;
    const ro = new ResizeObserver(entries => {
      // A container that is detached, hidden, or not yet inserted measures zero. Keep the
      // current layout rather than reading that as "no room" and snapping to the cap.
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted === w) return;
      applyLayout(fitted);
      render();
      clearTimeout(settle);
      settle = setTimeout(() => { resizeBase(); paintBase(); render(); }, 150);
    });
    ro.observe(container);
  }

  // Two reasons not to start: a reader who has asked the system for reduced motion should
  // not get an animation they never requested, and starting while the widget is off-screen
  // would run the whole tour before it is ever looked at.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const canAnimate = typeof requestAnimationFrame === "function" && typeof performance === "object";
  if (warmestYears.length > 1 && !reduceMotion && canAnimate) {
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}



// Piecewise-linear walk along the heat ramp.
function rampColor(t) {
  const span = clamp(t, 0, 1) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(span));
  const f = span - i;
  const a = hexToRgb(RAMP[i]), b = hexToRgb(RAMP[i + 1]);
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f))})`;
}

function rgbOf(color) {
  return color.startsWith("#") ? hexToRgb(color) : color.match(/\d+/g).slice(0, 3).map(Number);
}
