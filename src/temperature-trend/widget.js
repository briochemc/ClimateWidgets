// GISTEMP global-mean temperature trend explorer.
//
// Draws the annual land-ocean temperature anomaly and lets the reader pick a year range
// with a two-handle slider rendered on the chart's own x-scale, so the selection lines up
// with the data it selects. The least-squares trend over that range is drawn as a line
// segment, which is what makes trend cherry-picking visible: a 16-year window starting at
// the 1998 El Niño flattens a record that is unambiguously warming.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.

const ACCENT = "#0b57d0";   // the blue a default range slider paints its track and thumb
const BAND_ALPHA = 0.05;    // selection band; deliberately faint so the data reads through it
const WINDOW_YEARS = 16;    // span of both cited cherry-picks, counted inclusively
const MIN_SPAN = 2;         // shortest selectable range in years, i.e. three data points

// The figure fills its container up to FIGURE_WIDTH and reflows below it: margins, font
// sizes and tick density are recomputed from the width, so the labels that used to collide
// at narrow widths shrink or thin out instead. Below MIN_WIDTH the figure stops shrinking
// and scrolls sideways inside its own wrapper, as the fixed-size version always did.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// The GISTEMP table is a CSV with a one-line title above the header, and marks values that
// do not exist yet (the current, incomplete year) with `***`. `J-D` is the annual mean over
// January–December; `Year` and `J-D` are the only columns this widget needs.
export function parseGistemp(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[1].split(",");
  const yearCol = header.indexOf("Year");
  const anomCol = header.indexOf("J-D");
  if (yearCol < 0 || anomCol < 0) throw new Error("GISTEMP CSV: no Year and/or J-D column");
  const out = [];
  for (const line of lines.slice(2)) {
    if (!line.trim()) continue;
    const cells = line.split(",");
    // Guard against empty cells explicitly: Number("") is 0, which would smuggle a
    // spurious zero-anomaly year past the isFinite check and flatten trends across it.
    const yearCell = (cells[yearCol] ?? "").trim();
    const anomCell = (cells[anomCol] ?? "").trim();
    if (!yearCell || !anomCell) continue;
    const year = Number(yearCell);
    const anom = Number(anomCell);
    if (Number.isFinite(year) && Number.isFinite(anom)) out.push({year, anom});
  }
  return out.sort((a, b) => a.year - b.year);
}

export function createTemperatureTrendWidget({data, width = FIGURE_WIDTH}) {
  const series = [...data].sort((a, b) => a.year - b.year);
  if (series.length < MIN_SPAN + 1) throw new Error("GISTEMP series is too short to fit a trend");
  const firstYear = series[0].year;
  const lastYear = series[series.length - 1].year;

  const plotT = 26, plotH = 320;
  const plotB = plotT + plotH;
  const trackY = plotB + 52;      // slider centre line, clear of the x-axis tick labels
  const handleR = 9;
  const totalH = trackY + 44;

  // The width param is a cap, not a fixed size: the figure fills its container up to it.
  const maxW = Math.max(MIN_WIDTH, Math.round(width));

  // Everything horizontal is recomputed by applyLayout whenever the container width
  // changes; the vertical layout above is constant so embed iframe heights stay put.
  let w, innerW, marginL, marginR, x;
  let X_TICK_STEP, xTickStart;
  let tickFont, noteFont, slopeFont, sliderFont;
  let LIFT, HALF_H, labelClearance;

  // Anomalies are tenths of a degree, so snap the axis to 0.2 °C and count in integer
  // steps — accumulating 0.2 in a float walks off the tick positions.
  const Y_STEP = 0.2;
  const kLo = Math.floor(Math.min(...series.map(d => d.anom)) / Y_STEP);
  const kHi = Math.ceil(Math.max(...series.map(d => d.anom)) / Y_STEP);
  const yTicks = [];
  for (let k = kLo; k <= kHi; k++) yTicks.push(k * Y_STEP);

  const y = linear(kLo * Y_STEP, kHi * Y_STEP, plotB, plotT);

  function linear(d0, d1, r0, r1) {
    const f = v => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.invert = p => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    return f;
  }

  // Ordinary least squares of anomaly against year, over the inclusive range [from, to].
  function fit(from, to) {
    const pts = series.filter(d => d.year >= from && d.year <= to);
    const n = pts.length;
    let mx = 0, my = 0;
    for (const d of pts) { mx += d.year; my += d.anom; }
    mx /= n; my /= n;
    let sxy = 0, sxx = 0;
    for (const d of pts) { const dx = d.year - mx; sxy += dx * (d.anom - my); sxx += dx * dx; }
    const slope = sxx === 0 ? 0 : sxy / sxx;
    return {from, to, n, slope, intercept: my - slope * mx};
  }

  // Every WINDOW_YEARS-long window, scanned once, to find the flattest and steepest.
  // A 16-year window is what both cited cherry-picks use, so the extremes are the honest
  // answer to "what is the most and least warming a window that size can be made to show?"
  const extremes = (() => {
    let min = null, max = null;
    for (let from = firstYear; from + WINDOW_YEARS - 1 <= lastYear; from++) {
      const f = fit(from, from + WINDOW_YEARS - 1);
      if (min === null || f.slope < min.slope) min = f;
      if (max === null || f.slope > max.slope) max = f;
    }
    return {min, max};
  })();

  const fullRecord = fit(firstYear, lastYear);

  // extremes.min is null when the series is shorter than one window — possible for a
  // caller passing their own data — in which case the two extreme presets just vanish.
  const presets = [
    {label: "Malcolm Roberts cherry pick", from: 1998, to: 2013},
    {label: "Lewandowsky et al. (2015)", from: 1992, to: 2007},
    ...(extremes.min ? [
      {label: `Minimum ${WINDOW_YEARS}-year trend`, from: extremes.min.from, to: extremes.min.to},
      {label: `Maximum ${WINDOW_YEARS}-year trend`, from: extremes.max.from, to: extremes.max.to},
    ] : []),
  ].filter(p => p.from >= firstYear && p.to <= lastYear);

  let from = firstYear, to = lastYear;
  let dragging = null;      // "from" | "to" while a pointer is down
  let keyHandle = "to";     // handle the arrow keys move
  let focused = false;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const context = (() => {
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    // pan-y, not none: vertical swipes over the chart must still scroll the host page
    // (this widget can fill a phone's viewport inside a Moodle iframe), while horizontal
    // movement is left to the pointer handlers so the slider handles stay draggable.
    canvas.style.touchAction = "pan-y";
    canvas.tabIndex = 0;
    canvas.style.outline = "none";
    return canvas.getContext("2d");
  })();
  const canvas = context.canvas;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    marginL = lerp(64, 84);
    marginR = lerp(12, 28);
    innerW = w - marginL - marginR;
    x = linear(firstYear - 1, lastYear + 1, marginL, marginL + innerW);

    // Year labels need ~55px at the full-size font and ~46px at the smallest, so once the
    // plotting area is too narrow every other 20-year tick is dropped rather than squeezed.
    // Stepwise, not continuous, so labels do not shimmer while the container is resized.
    X_TICK_STEP = innerW >= 340 ? 20 : 40;
    xTickStart = Math.ceil(firstYear / X_TICK_STEP) * X_TICK_STEP;

    tickFont = `${lerp(13, 16)}px sans-serif`;
    noteFont = `${lerp(11, 13)}px sans-serif`;
    slopeFont = `bold ${lerp(13, 16)}px sans-serif`;
    sliderFont = `bold ${lerp(13, 15)}px sans-serif`;
    LIFT = lerp(24, 30);
    HALF_H = lerp(10, 12);
    labelClearance = lerp(46, 56);

    // Re-read dpr each time: the window may have moved to a screen with a different one.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;       // also resets the context transform
    canvas.height = totalH * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = totalH + "px";
    context.scale(dpr, dpr);
  }
  applyLayout(maxW);

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(canvas);
  container.appendChild(scroller);

  const buttons = document.createElement("div");
  buttons.style.cssText = "padding:10px 0 2px;display:flex;gap:8px;flex-wrap:wrap;";
  const buttonEls = presets.map(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText =
      "font:inherit;font-size:14px;line-height:1.25;text-align:left;padding:6px 10px;" +
      "border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;";
    b.appendChild(document.createTextNode(p.label));
    const sub = document.createElement("div");
    sub.textContent = `${p.from}–${p.to}`;
    sub.style.cssText = "font-size:13px;color:#777;";
    b.appendChild(sub);
    b.addEventListener("click", () => { stopTour(); from = p.from; to = p.to; render(); emit(); });
    buttons.appendChild(b);
    return {el: b, sub, preset: p};
  });
  container.appendChild(buttons);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:1.4em;";
  container.appendChild(status);

  const HINT_IDLE =
    "Drag the two handles below the chart to choose a period, or pick one above. " +
    "With the chart focused, ← and → move a handle and ↑/↓ switch between them.";
  const HINT_TOUR = "Cycling through the presets — click a button or drag a handle to take over.";

  const hint = document.createElement("div");
  hint.style.cssText = "padding:2px 0 0;color:#888;font-size:14px;";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function fmtSlope(v) {
    const sign = v > 0.005 ? "+" : v < -0.005 ? "−" : "±";
    return `${sign}${Math.abs(v).toFixed(2)}`;
  }

  function render() {
    const trend = fit(from, to);
    const xFrom = x(from), xTo = x(to);

    context.clearRect(0, 0, w, totalH);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, totalH);

    // Selection band, behind everything, spanning the full height of the plotting area.
    context.fillStyle = hexToRgba(ACCENT, BAND_ALPHA);
    context.fillRect(xFrom, plotT, Math.max(1, xTo - xFrom), plotH);
    context.strokeStyle = hexToRgba(ACCENT, 0.25);
    context.lineWidth = 1;
    for (const px of [xFrom, xTo]) {
      context.beginPath();
      context.moveTo(px, plotT); context.lineTo(px, plotB); context.stroke();
    }

    context.strokeStyle = "rgba(0,0,0,0.12)";
    for (const v of yTicks) {
      const py = y(v);
      context.beginPath();
      context.moveTo(marginL, py); context.lineTo(marginL + innerW, py); context.stroke();
    }
    for (let year = xTickStart; year <= lastYear; year += X_TICK_STEP) {
      const px = x(year);
      context.beginPath();
      context.moveTo(px, plotT); context.lineTo(px, plotB); context.stroke();
    }

    // The zero line is the 1951–1980 baseline the anomalies are measured against, so it
    // carries more meaning than the other gridlines and is drawn darker.
    context.strokeStyle = "rgba(0,0,0,0.35)";
    context.beginPath();
    context.moveTo(marginL, y(0)); context.lineTo(marginL + innerW, y(0)); context.stroke();
    context.fillStyle = "#999";
    context.font = noteFont;
    context.textAlign = "right"; context.textBaseline = "bottom";
    context.fillText("1951–1980 average", marginL + innerW - 4, y(0) - 4);

    // The whole record in light grey, then the selected years redrawn darker on top, so
    // the data the trend is actually fitted to stands out from the years it ignores.
    strokeSeries(series, "#b0b0b0", 1.5);
    strokeSeries(series.filter(d => d.year >= from && d.year <= to), "#333", 2);

    context.strokeStyle = ACCENT;
    context.lineWidth = 3.5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(xFrom, y(trend.intercept + trend.slope * from));
    context.lineTo(xTo, y(trend.intercept + trend.slope * to));
    context.stroke();
    context.lineCap = "butt";
    context.lineWidth = 1;

    drawSlopeLabel(trend, xFrom, xTo);

    context.strokeStyle = "#666"; context.fillStyle = "#333";
    context.font = tickFont;
    context.beginPath();
    context.moveTo(marginL, plotT);
    context.lineTo(marginL, plotB);
    context.lineTo(marginL + innerW, plotB);
    context.stroke();
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yTicks) {
      const py = y(v);
      context.beginPath();
      context.moveTo(marginL - 5, py); context.lineTo(marginL, py); context.stroke();
      context.fillText(v.toFixed(1).replace("-", "−"), marginL - 8, py);
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (let year = xTickStart; year <= lastYear; year += X_TICK_STEP) {
      const px = x(year);
      context.beginPath();
      context.moveTo(px, plotB); context.lineTo(px, plotB + 5); context.stroke();
      context.fillText(year, px, plotB + 8);
    }
    context.save();
    context.translate(18, plotT + plotH / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center"; context.textBaseline = "top";
    context.fillText("Temperature anomaly (°C)", 0, 0);
    context.restore();

    drawSlider(xFrom, xTo);

    const years = to - from + 1;
    status.textContent =
      `${from}–${to} (${years} year${years === 1 ? "" : "s"}): ` +
      `${fmtSlope(trend.slope * 10)} °C per decade. ` +
      `The full record, ${firstYear}–${lastYear}, warms at ${fmtSlope(fullRecord.slope * 10)} °C per decade.`;

    for (const b of buttonEls) {
      const active = b.preset.from === from && b.preset.to === to;
      b.el.style.borderColor = active ? ACCENT : "#ccc";
      b.el.style.color = active ? ACCENT : "#333";
      b.el.style.background = active ? hexToRgba(ACCENT, 0.06) : "#fff";
      b.sub.style.color = active ? ACCENT : "#777";
    }
  }

  function strokeSeries(points, color, lineWidth) {
    if (points.length < 2) return;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.beginPath();
    points.forEach((d, i) =>
      i ? context.lineTo(x(d.year), y(d.anom)) : context.moveTo(x(d.year), y(d.anom)));
    context.stroke();
    context.lineWidth = 1;
  }

  // Sits at the midpoint of the trend segment, flipped below it when there is no room
  // above, on a translucent white plate so it stays legible over the data.
  function drawSlopeLabel(trend, xFrom, xTo) {
    const text = `${fmtSlope(trend.slope * 10)} °C/decade`;
    context.font = slopeFont;
    const tw = context.measureText(text).width;
    const midYear = (from + to) / 2;
    const cx = clamp((xFrom + xTo) / 2, marginL + tw / 2 + 6, marginL + innerW - tw / 2 - 6);
    const yMid = y(trend.intercept + trend.slope * midYear);
    // LIFT is measured to the label's centre, so the visible gap to the trend line is
    // LIFT − HALF_H − half the line width. Sitting it below is the fallback for a trend
    // running along the top of the panel, where there is no room above it.
    const above = yMid - LIFT - HALF_H > plotT;
    const cy = clamp(above ? yMid - LIFT : yMid + LIFT,
                     plotT + HALF_H + 2, plotB - HALF_H - 2);
    context.fillStyle = "rgba(255,255,255,0.85)";
    context.fillRect(cx - tw / 2 - 5, cy - HALF_H, tw + 10, HALF_H * 2);
    context.fillStyle = ACCENT;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(text, cx, cy);
    context.font = tickFont;
  }

  function drawSlider(xFrom, xTo) {
    context.lineCap = "round";
    context.strokeStyle = "#d7dce3";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(x(firstYear), trackY); context.lineTo(x(lastYear), trackY); context.stroke();
    context.strokeStyle = ACCENT;
    context.beginPath();
    context.moveTo(xFrom, trackY); context.lineTo(xTo, trackY); context.stroke();
    context.lineCap = "butt";

    for (const [name, px] of [["from", xFrom], ["to", xTo]]) {
      if (focused && keyHandle === name) {
        context.strokeStyle = hexToRgba(ACCENT, 0.35);
        context.lineWidth = 3;
        context.beginPath();
        context.arc(px, trackY, handleR + 4, 0, 2 * Math.PI);
        context.stroke();
      }
      context.beginPath();
      context.arc(px, trackY, handleR, 0, 2 * Math.PI);
      context.fillStyle = ACCENT;
      context.fill();
      context.strokeStyle = "#fff";
      context.lineWidth = 2;
      context.stroke();
    }
    context.lineWidth = 1;

    // Nudge the two year labels apart when the handles are close enough to overlap them.
    const gap = xTo - xFrom;
    const spread = gap < labelClearance ? (labelClearance - gap) / 2 : 0;
    context.font = sliderFont;
    context.fillStyle = ACCENT;
    context.textAlign = "center"; context.textBaseline = "top";
    context.fillText(from, clamp(xFrom - spread, marginL, marginL + innerW), trackY + handleR + 6);
    context.fillText(to, clamp(xTo + spread, marginL, marginL + innerW), trackY + handleR + 6);
    context.font = tickFont;
  }

  function setHandle(name, year) {
    const v = clamp(Math.round(year), firstYear, lastYear);
    if (name === "from") from = Math.min(v, to - MIN_SPAN);
    else to = Math.max(v, from + MIN_SPAN);
  }

  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) * (w / r.width),
      py: (e.clientY - r.top) * (totalH / r.height),
    };
  }

  function nearestHandle(px) {
    return Math.abs(px - x(from)) <= Math.abs(px - x(to)) ? "from" : "to";
  }

  function onSlider(py) {
    return Math.abs(py - trackY) <= 20;
  }

  canvas.addEventListener("pointerdown", e => {
    stopTour();
    const {px, py} = pointerAt(e);
    if (!onSlider(py)) return;
    dragging = keyHandle = nearestHandle(px);
    canvas.setPointerCapture(e.pointerId);
    canvas.focus();
    setHandle(dragging, x.invert(px));
    render();
    emit();
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (!dragging) {
      canvas.style.cursor = onSlider(py) ? "ew-resize" : "default";
      return;
    }
    setHandle(dragging, x.invert(px));
    render();
    emit();
  });

  for (const type of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(type, e => {
      if (!dragging) return;
      dragging = null;
      canvas.releasePointerCapture(e.pointerId);
    });
  }

  canvas.addEventListener("keydown", e => {
    stopTour();
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const delta = e.key === "ArrowLeft" ? -step : step;
      setHandle(keyHandle, (keyHandle === "from" ? from : to) + delta);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      keyHandle = keyHandle === "from" ? "to" : "from";
    } else {
      return;
    }
    e.preventDefault();
    render();
    emit();
  });

  canvas.addEventListener("focus", () => { focused = true; render(); });
  canvas.addEventListener("blur", () => { focused = false; render(); });

  // Tour: glide through the presets on load so the point of the widget — that the same
  // record can be made to look flat or steep depending on the window — lands without anyone
  // having to click. The first sign of the reader taking over ends it for good; it never
  // restarts, because a control that moves on its own under your cursor is maddening.
  const TOUR_HOLD = 2000;    // ms resting on each preset
  const TOUR_GLIDE = 900;    // ms gliding between two presets
  let touring = false, tourTimer = null, tourFrame = null, tourWatcher = null;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    cancelAnimationFrame(tourFrame);
    tourTimer = tourFrame = null;
    hint.textContent = HINT_IDLE;
    render();
  }

  function glideTo(target, done) {
    const from0 = from, to0 = to, t0 = performance.now();
    const frame = now => {
      const k = Math.min(1, (now - t0) / TOUR_GLIDE);
      const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); // ease in and out
      // Both ends are clamped rather than trusted: rounding each independently can shave a
      // year off the span even though every preset itself respects MIN_SPAN.
      from = clamp(Math.round(from0 + (target.from - from0) * e), firstYear, lastYear - MIN_SPAN);
      to = clamp(Math.round(to0 + (target.to - to0) * e), from + MIN_SPAN, lastYear);
      render();
      // Kept truthful every frame, but no "input" event until the glide settles — one
      // event per preset rather than one per frame.
      container.value = value();
      if (k < 1) tourFrame = requestAnimationFrame(frame);
      else done();
    };
    tourFrame = requestAnimationFrame(frame);
  }

  function tourStep(i) {
    if (!touring) return;
    // A cell that re-runs leaves the previous widget detached but still holding a timer;
    // without this it would animate into an orphaned canvas for the life of the page.
    // Compared against false so a host without isConnected (a test stub) still runs.
    if (container.isConnected === false) return stopTour();
    glideTo(presets[i], () => {
      if (!touring) return;
      emit();
      tourTimer = setTimeout(() => tourStep((i + 1) % presets.length), TOUR_HOLD);
    });
  }

  function startTour() {
    if (touring) return;
    touring = true;
    hint.textContent = HINT_TOUR;
    render();
    tourTimer = setTimeout(() => tourStep(0), TOUR_HOLD);
  }

  function value() {
    const trend = fit(from, to);
    return {
      from, to,
      years: to - from + 1,
      slope: trend.slope,
      slopePerDecade: trend.slope * 10,
      intercept: trend.intercept,
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  render();
  container.value = value();

  // Reflow with the container. The observer watches the widget's own container div so the
  // script-tag embed, which has no Observable runtime, is responsive too. Laying out
  // synchronously in the callback is deliberate: the observer already fires at most once
  // per frame, after layout and before paint, and the canvas sits in a max-width:100%
  // wrapper so re-laying it out can never change the container's own width and loop.
  // Resizing never emits "input" and never stops the tour: the selected years are
  // data-space state, unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      // A container that is detached, hidden, or not yet inserted measures zero. Keep the
      // current layout rather than reading that as "no room" and snapping to the cap.
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); render(); }
    });
    ro.observe(container);
  }

  // Two reasons not to start: a reader who has asked the system for reduced motion should
  // not get an animation they never requested, and starting while the widget is off-screen
  // would run the whole tour before it is ever looked at. (Inside an iframe the observer
  // only sees the iframe's own viewport, so an embed below the fold can still start early.)
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const canAnimate = typeof requestAnimationFrame === "function" && typeof performance === "object";
  if (presets.length > 1 && !reduceMotion && canAnimate) {
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

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
