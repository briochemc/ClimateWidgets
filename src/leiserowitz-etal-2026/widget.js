// Global Warming's Six Americas — the Yale/George Mason segmentation of the U.S. public
// into six climate-opinion audiences, tracked across 32 survey waves from Nov 2008 to
// Nov 2025.
//
// Left: a stacked-area timeseries reproducing the program's own SASSY-trends figure
// (https://climatecommunication.yale.edu/app/uploads/2016/02/SASSY-trends-2015-2025-1024x805.png),
// but over the full record rather than just its last decade, with a time slider (drawn on
// the chart's own x-scale, the way temperature-trend's year-range slider is) beneath it.
// Right: a horizontal bar chart of the selected wave's six shares, which animate as the
// slider moves. The vertical arrow beside the bars carries the same "which end means what"
// annotation as the program's bubble chart
// (https://climatecommunication.yale.edu/app/uploads/2016/02/bubble_chart.png), rotated to
// run alongside the bars instead of under them.
//
// One root SVG holds all four pieces (area, slider, bars, arrow) rather than splitting them
// across elements: the slider needs the area chart's x-scale, and the arrow's labels need to
// know exactly where the bar rows land, so one coordinate space is simpler than keeping two
// or three in sync. Self-contained on purpose — no d3, no other imports — so the script-tag
// embed on the widget's page is a single ES module import that works from any page; the
// stacked bands are hand-rolled polygons (straight segments between waves, matching how the
// reference figure itself is drawn) rather than a d3.stack/d3.area call.
//
// Data: src/leiserowitz-etal-2026/data/leiserowitz-etal-2026.csv, produced by
// scripts/leiserowitz-etal-2026.jl from the program's public trends spreadsheet.

// Sampled from the bubble chart's PNG, so the two figures agree exactly. Order here is the
// display order, top to bottom in both the area chart's stack and the bar panel; the area
// chart stacks bottom-up, so buildArea reverses it.
const SEGMENTS = [
  {key: "alarmed", label: "Alarmed", color: "#066676"},
  {key: "concerned", label: "Concerned", color: "#369b91"},
  {key: "cautious", label: "Cautious", color: "#c99d6c"},
  {key: "disengaged", label: "Disengaged", color: "#818589"},
  {key: "doubtful", label: "Doubtful", color: "#a56c6a"},
  {key: "dismissive", label: "Dismissive", color: "#725e74"},
];

// The unobtrusive band at the top of the stack: the screener's "no segment" residual (0-4%,
// almost all before 2016) plus ordinary rounding, so the stack always closes at 100% even
// though the six published shares alone sometimes sum to 98 or 99.
const NO_SEGMENT_COLOR = "#ececec";

const ACCENT = "#0b57d0"; // the blue a default range slider paints its track and thumb
const TRANSITION = "220ms ease"; // bar width/label glide as the slider moves or the tour plays

// Every wave's six shares fall under 35%, so 40 leaves headroom without wasting much of the
// bar's length on empty range.
const BAR_X_MAX = 40;

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH it
// stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// One row per wave: wave label, ISO month, respondent count, the six shares, and the
// no-segment residual. `t` is the wave's month as a UTC timestamp, for a time-proportional
// x-scale that renders the record's genuinely irregular spacing (14 months between the first
// two waves, roughly six to seven months apart since) honestly instead of evenly.
export function parseLeiserowitzEtal2026(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`leiserowitz-etal-2026 CSV: no "${name}" column`);
    return i;
  };
  const cWave = col("wave"), cDate = col("date"), cN = col("n"), cNoSeg = col("no_segment");
  const cSeg = Object.fromEntries(SEGMENTS.map(s => [s.key, col(s.key)]));

  const waves = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const date = cells[cDate];
    const [y, m] = date.split("-").map(Number);
    const values = {};
    for (const s of SEGMENTS) values[s.key] = Number(cells[cSeg[s.key]]);
    waves.push({
      wave: cells[cWave], date, t: Date.UTC(y, m - 1, 1),
      n: Number(cells[cN]), values, noSegment: Number(cells[cNoSeg]),
    });
  }
  if (!waves.length) throw new Error("leiserowitz-etal-2026 CSV: no data rows");
  return waves.sort((a, b) => a.t - b.t);
}

export function createLeiserowitzEtal2026Widget({data, width = FIGURE_WIDTH}) {
  const waves = data;

  // Vertical layout is constant, so embed iframe heights stay put; only horizontal metrics,
  // fonts and tick density are recomputed on resize (applyLayout, below).
  const plotT = 30, plotH = 300, plotB = plotT + plotH; // chart + bars both span 30..330
  const rowH = plotH / 6; // one bar row per segment
  const trackY = plotB + 46; // slider centre line, clear of the x-axis tick labels
  const handleR = 8;
  const totalH = trackY + 36;

  const y = linear(0, 100, plotB, plotT); // percent -> pixel; width-independent

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, marginL, chartRight, innerW, x, barsX, barX0, barMax, arrowX, barThickness;
  let tickFont, labelFont, arrowFont, sliderFont, xTickStep;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    marginL = lerp(30, 40);
    const barsW = lerp(150, 230);
    const labelW = lerp(52, 78);
    const gap = 14;
    barsX = w - barsW;
    chartRight = barsX - gap;
    innerW = chartRight - marginL;
    x = linear(waves[0].t, waves[waves.length - 1].t, marginL, chartRight);

    arrowX = w - 14;
    barX0 = barsX + labelW + 6;
    barMax = Math.max(20, (arrowX - 10) - barX0);
    barThickness = lerp(20, 28);

    tickFont = lerp(9, 11);
    labelFont = lerp(10, 12);
    arrowFont = lerp(8, 10);
    sliderFont = lerp(12, 14);

    // Below this the year labels start to crowd, so every other one is dropped rather than
    // squeezed. Stepwise, not continuous, so labels do not shimmer while resizing.
    xTickStep = innerW >= 260 ? 2 : 4;
  }
  applyLayout(maxW);

  let index = waves.length - 1; // latest wave: the default the widget opens on
  let dragging = false;
  let markerG, handleG, focusRing, sliderLabel, barRects, barLabels;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // No role="img": unlike the click-only map widgets, this SVG is keyboard-focusable and
  // behaves like a slider, so an aria-label kept current in updateSelection (below) is what
  // it exposes, the same way temperature-trend's focusable canvas carries no role either.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "leiserowitz-etal-2026");
  svg.style.display = "block";
  svg.style.outline = "none";
  svg.style.touchAction = "pan-y";
  svg.tabIndex = 0;

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:1.4em;";
  container.appendChild(status);

  const HINT_IDLE =
    "Drag the slider or click the chart to pick a survey wave. With the chart focused, " +
    "← and → step between waves; Home and End jump to the ends.";
  const HINT_TOUR = "Playing through the surveys — drag the slider or press a key to take over.";
  const hint = document.createElement("div");
  hint.style.cssText = "padding:2px 0 0;color:#888;font-size:14px;";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // Cumulative stack per wave, bottom to top: Dismissive first (bottom of the reference
  // figure) up through Alarmed, then whatever is left over to 100% as the no-segment band.
  function buildArea() {
    const order = [...SEGMENTS].reverse();
    const stacked = waves.map(wv => {
      let c0 = 0;
      const bands = {};
      for (const seg of order) {
        const c1 = c0 + wv.values[seg.key];
        bands[seg.key] = [c0, c1];
        c0 = c1;
      }
      bands.noSegment = [c0, Math.max(c0, 100)];
      return bands;
    });

    const keys = [...order.map(s => s.key), "noSegment"];
    const colorOf = key => (key === "noSegment" ? NO_SEGMENT_COLOR : SEGMENTS.find(s => s.key === key).color);

    for (const key of keys) {
      const upper = waves.map((wv, i) => `${x(wv.t)},${y(stacked[i][key][1])}`);
      const lower = waves.map((wv, i) => `${x(wv.t)},${y(stacked[i][key][0])}`).reverse();
      const d = `M${upper.join("L")}L${lower.join("L")}Z`;
      const fill = colorOf(key);
      // A matching stroke closes the antialiasing hairlines that otherwise show as thin
      // gaps between adjacent bands.
      svg.appendChild(svgEl("path", {d, fill, stroke: fill, "stroke-width": 0.5}));
    }

    markerG = svgEl("g", {});
    markerG.appendChild(svgEl("line", {
      y1: plotT, y2: plotB, stroke: "rgba(0,0,0,0.55)", "stroke-width": 1.5,
    }));
    svg.appendChild(markerG);
  }

  function buildAxes() {
    for (let v = 0; v <= 100; v += 20) {
      const py = y(v);
      svg.appendChild(svgEl("line", {
        x1: marginL, x2: chartRight, y1: py, y2: py, stroke: "rgba(0,0,0,0.35)", "stroke-width": 0.5,
      }));
      const t = svgEl("text", {
        x: marginL - 6, y: py, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": tickFont, fill: "#666",
      });
      t.textContent = `${v}%`;
      svg.appendChild(t);
    }
    svg.appendChild(svgEl("line", {x1: marginL, x2: marginL, y1: plotT, y2: plotB, stroke: "#666", "stroke-width": 1}));

    const firstYear = new Date(waves[0].t).getUTCFullYear();
    const lastYear = new Date(waves[waves.length - 1].t).getUTCFullYear();
    const tickStart = Math.ceil(firstYear / xTickStep) * xTickStep;
    for (let yr = tickStart; yr <= lastYear; yr += xTickStep) {
      const px = x(Date.UTC(yr, 0, 1));
      if (px < marginL || px > chartRight) continue;
      svg.appendChild(svgEl("line", {x1: px, x2: px, y1: plotB, y2: plotB + 5, stroke: "#666", "stroke-width": 1}));
      // The last tick before the panel edge is dropped rather than squeezed against it.
      if (chartRight - px > 18) {
        const t = svgEl("text", {x: px, y: plotB + 8, "text-anchor": "middle", "font-size": tickFont, fill: "#666"});
        t.textContent = yr;
        svg.appendChild(t);
      }
    }
  }

  function buildSlider() {
    svg.appendChild(svgEl("line", {
      x1: marginL, x2: chartRight, y1: trackY, y2: trackY,
      stroke: "#d7dce3", "stroke-width": 6, "stroke-linecap": "round",
    }));

    handleG = svgEl("g", {});
    focusRing = svgEl("circle", {
      cx: 0, cy: 0, r: handleR + 4, fill: "none", stroke: hexToRgba(ACCENT, 0.35), "stroke-width": 3,
    });
    focusRing.style.display = "none";
    handleG.appendChild(focusRing);
    handleG.appendChild(svgEl("circle", {cx: 0, cy: 0, r: handleR, fill: ACCENT, stroke: "#fff", "stroke-width": 2}));
    svg.appendChild(handleG);

    sliderLabel = svgEl("text", {
      y: trackY + handleR + 17, "text-anchor": "middle", "font-size": sliderFont,
      "font-weight": "bold", fill: ACCENT,
    });
    svg.appendChild(sliderLabel);
  }

  // Bars are created already at the current wave's widths (not zero), so a resize resizes
  // them instead of replaying the grow-from-zero animation that a wave change animates.
  function buildBars() {
    const wv = waves[index];
    barRects = [];
    barLabels = [];
    SEGMENTS.forEach((seg, i) => {
      const rowY = plotT + i * rowH + rowH / 2;
      const v = wv.values[seg.key];
      const bw = (v / BAR_X_MAX) * barMax;

      const label = svgEl("text", {
        x: barX0 - 6, y: rowY, "text-anchor": "end", "dominant-baseline": "middle",
        "font-size": labelFont, fill: "#333",
      });
      label.textContent = seg.label;
      svg.appendChild(label);

      const rect = svgEl("rect", {
        x: barX0, y: rowY - barThickness / 2, width: Math.max(0, bw), height: barThickness, fill: seg.color,
      });
      rect.style.transition = `width ${TRANSITION}`;
      svg.appendChild(rect);
      barRects.push(rect);

      const valueLabel = svgEl("text", {
        x: barX0 + bw + 4, y: rowY, "dominant-baseline": "middle", "font-size": labelFont, "font-weight": "bold",
      });
      valueLabel.style.transition = `x ${TRANSITION}`;
      valueLabel.textContent = `${v}%`;
      svg.appendChild(valueLabel);
      barLabels.push(valueLabel);
    });
  }

  function updateBars() {
    const wv = waves[index];
    SEGMENTS.forEach((seg, i) => {
      const v = wv.values[seg.key];
      const bw = Math.max(0, (v / BAR_X_MAX) * barMax);
      barRects[i].setAttribute("width", bw);
      barLabels[i].setAttribute("x", barX0 + bw + 4);
      barLabels[i].textContent = `${v}%`;
    });
  }

  // The bubble chart's own annotation, rotated: what the Alarmed end of the scale means at
  // top, what the Dismissive end means at bottom. Right-anchored so at narrow widths the
  // text simply extends further left over the empty headroom above and below the chart,
  // rather than clipping.
  function buildArrow() {
    svg.appendChild(svgEl("line", {x1: arrowX, x2: arrowX, y1: plotT + 4, y2: plotB - 4, stroke: "#888", "stroke-width": 1.5}));
    svg.appendChild(svgEl("path", {d: `M${arrowX - 4},${plotT + 9}L${arrowX},${plotT}L${arrowX + 4},${plotT + 9}Z`, fill: "#888"}));
    svg.appendChild(svgEl("path", {d: `M${arrowX - 4},${plotB - 9}L${arrowX},${plotB}L${arrowX + 4},${plotB - 9}Z`, fill: "#888"}));

    const labelX = arrowX - 8;
    const draw = (lines, y0) => lines.forEach((line, i) => {
      const t = svgEl("text", {x: labelX, y: y0 + i * 11, "text-anchor": "end", "font-size": arrowFont, fill: "#666"});
      t.textContent = line;
      svg.appendChild(t);
    });
    draw(["Highest belief in global warming,", "most concerned, most motivated"], 10);
    draw(["Lowest belief in global warming,", "least concerned, least motivated"], plotB + 12);
  }

  function nearestIndex(px) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < waves.length; i++) {
      const d = Math.abs(x(waves[i].t) - px);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  // Handle and marker move without a transition (they must track the pointer exactly); only
  // the bars animate, via the CSS transition set on their width/x above.
  function updateSelection(shouldEmit) {
    const wv = waves[index];
    const px = x(wv.t);
    markerG.setAttribute("transform", `translate(${px},0)`);
    handleG.setAttribute("transform", `translate(${px},${trackY})`);
    sliderLabel.setAttribute("x", clamp(px, marginL + 28, chartRight - 28));
    sliderLabel.textContent = wv.wave;
    updateBars();

    const nStr = wv.n.toLocaleString();
    const parts = SEGMENTS.map(s => `${s.label} ${wv.values[s.key]}%`).join(", ");
    svg.setAttribute("aria-label", `Global Warming's Six Americas, ${wv.wave} (n = ${nStr}): ${parts}.`);
    status.textContent = `${wv.wave} (n = ${nStr}): ${parts}.`;

    container.value = value();
    if (shouldEmit) emit();
  }

  function overSlider(py) { return Math.abs(py - trackY) <= 20; }
  function overChart(px, py) { return py >= plotT && py <= plotB && px >= marginL && px <= chartRight; }

  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) * (w / r.width),
      py: (e.clientY - r.top) * (totalH / r.height),
    };
  }

  svg.addEventListener("pointerdown", e => {
    stopTour();
    const {px, py} = pointerAt(e);
    if (!overSlider(py) && !overChart(px, py)) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    svg.focus();
    index = nearestIndex(px);
    updateSelection(true);
    e.preventDefault();
  });

  svg.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (!dragging) {
      svg.style.cursor = overSlider(py) || overChart(px, py) ? "ew-resize" : "default";
      return;
    }
    const newIndex = nearestIndex(px);
    if (newIndex !== index) { index = newIndex; updateSelection(true); }
  });

  for (const type of ["pointerup", "pointercancel"]) {
    svg.addEventListener(type, e => {
      if (!dragging) return;
      dragging = false;
      svg.releasePointerCapture(e.pointerId);
    });
  }

  svg.addEventListener("keydown", e => {
    let newIndex = index;
    if (e.key === "ArrowLeft") newIndex = Math.max(0, index - 1);
    else if (e.key === "ArrowRight") newIndex = Math.min(waves.length - 1, index + 1);
    else if (e.key === "Home") newIndex = 0;
    else if (e.key === "End") newIndex = waves.length - 1;
    else return;
    stopTour();
    e.preventDefault();
    if (newIndex !== index) { index = newIndex; updateSelection(true); }
  });

  svg.addEventListener("focus", () => { focusRing.style.display = ""; });
  svg.addEventListener("blur", () => { focusRing.style.display = "none"; });

  function value() {
    const wv = waves[index];
    return {
      index, wave: wv.wave, date: wv.date, n: wv.n,
      alarmed: wv.values.alarmed, concerned: wv.values.concerned, cautious: wv.values.cautious,
      disengaged: wv.values.disengaged, doubtful: wv.values.doubtful, dismissive: wv.values.dismissive,
      noSegment: wv.noSegment,
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function buildAll(newW) {
    applyLayout(newW);
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    buildArea();
    buildAxes();
    buildSlider();
    buildBars();
    buildArrow();
    updateSelection(false);
  }

  buildAll(maxW);
  container.value = value();

  // Reflow with the container; synchronous in the callback, same rationale as
  // temperature-trend's observer. Resizing never emits "input": the selected wave is
  // data-space state, unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) buildAll(fitted);
    });
    ro.observe(container);
  }

  // Autoplay: hold on the earliest wave, step forward one at a time to the latest, hold
  // there, jump back to the earliest and repeat — for as long as nobody touches the widget.
  // Unlike temperature-trend's tour (which stops for good after one pass through its
  // presets), this one loops indefinitely: the point here is the shape of the trend line
  // over the whole record, which a single forward pass shows once but a loop keeps in view.
  const TOUR_STEP = 260; // ms per wave while stepping forward
  const TOUR_HOLD = 1400; // ms resting at each end of the sweep
  let touring = false, tourTimer = null, tourWatcher = null;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    hint.textContent = HINT_IDLE;
  }

  function tourStep() {
    if (!touring) return;
    // A cell that re-runs leaves the previous widget detached but still holding a timer;
    // without this it would keep animating an orphaned SVG for the life of the page.
    if (container.isConnected === false) return stopTour();
    if (index >= waves.length - 1) {
      index = 0;
      updateSelection(false);
      emit(); // settled back at the start of a fresh sweep
      tourTimer = setTimeout(tourStep, TOUR_HOLD);
    } else {
      index++;
      updateSelection(false);
      const atEnd = index === waves.length - 1;
      if (atEnd) emit(); // settled at the end
      tourTimer = setTimeout(tourStep, atEnd ? TOUR_HOLD : TOUR_STEP);
    }
  }

  function startTour() {
    if (touring) return;
    touring = true;
    hint.textContent = HINT_TOUR;
    index = 0;
    updateSelection(false);
    emit();
    tourTimer = setTimeout(tourStep, TOUR_HOLD);
  }

  // Two reasons not to start: a reader who has asked the system for reduced motion should
  // not get an animation they never requested, and starting while the widget is off-screen
  // would run the tour before it is ever looked at. This is also what keeps the thumbnail
  // script deterministic: it forces reduced motion, so every capture is the same canonical
  // frame — the latest wave, which is where the widget opens.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
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

function linear(d0, d1, r0, r1) {
  const f = v => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.invert = p => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
