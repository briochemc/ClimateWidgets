const colors = {
  HL: "#E744F6",
  H:  "#a41212",
  M:  "#fc7b03",
  ML: "#dec820",
  L:  "#20A359",
  LN: "#22e5db",
  VL: "#16188F",
};

// Two stacked panels: atmospheric CO₂ on top, CO₂ fluxes below. Units are folded into the
// y-tick labels and the axis titles sit inside the plot frame, so the chart stays legible
// projected on a lecture screen, and the two bottom-panel curves are named by leader-line
// callouts anchored in the historical period rather than by labels at the right edge.

// The figure fills its container up to FIGURE_WIDTH and reflows below it: margins, fonts
// and tick density are recomputed from the width, and at narrow widths the right-edge
// scenario labels shrink to their bare codes (the select is the legend) and the y-tick
// units move into the axis titles. Below MIN_WIDTH the figure stops shrinking and scrolls
// sideways inside its own wrapper, as the fixed-size version always did.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

export function createClimateWidget({co2, pco2, d3, width = FIGURE_WIDTH}) {
  const YEAR_START = 1900, SCENARIO_START = 2024, YEAR_END = 2150;
  const YEAR_STEP = 25;
  const GT_MIN = -20, GT_MAX = 70;
  const K = 7.82; // Gt CO2 per ppm
  const HIST_COLOR = "#666";
  const CALLOUT_YEAR = 1960; // historical, so both callouts show before anything is drawn
  const PANEL_BG = "#f2f5f8"; // gentle tint behind each panel's plotting area

  const codes = ["VL", "LN", "L", "ML", "M", "H", "HL"];
  const names = { VL: "Very Low", LN: "Low-to-Negative", L: "Low", ML: "Medium-Low", M: "Medium", H: "High", HL: "High-to-Low" };

  const measure = document.createElement("canvas").getContext("2d");

  // Vertical layout is constant — applyLayout recomputes only the horizontal metrics,
  // fonts and label tiers when the container width changes — so embed heights stay put.
  const gap = 40; // vertical breathing room between the two panels
  const topT = 56, topH = 220;
  const botT = topT + topH + gap;
  const botH = 300;
  const totalH = botT + botH + 56;

  // The width param is a cap, not a fixed size: the figure fills its container up to it.
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, innerW, marginL, marginR, x;
  let LABEL_FONT, CALLOUT_FONT, TITLE_FONT;
  let LABEL_GAP;   // annotate() offset from the end of the curve
  let LABEL_LEAD;  // minimum vertical spacing between stacked right-edge labels
  let LEADER, CALLOUT_DX, YEAR_LABEL_STEP;
  let compact, scenarioLabel, userLabel, histHeader, futHeader;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;";

  const controls = document.createElement("div");
  controls.style.cssText = "padding:6px 0;display:flex;gap:20px;align-items:center;flex-wrap:wrap;";

  const sel = document.createElement("select");
  for (const c of codes) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} — ${names[c]}`;
    if (c === "ML") opt.selected = true;
    sel.appendChild(opt);
  }
  const selLabel = document.createElement("label");
  selLabel.appendChild(document.createTextNode("Scenario: "));
  selLabel.appendChild(sel);
  controls.appendChild(selLabel);

  container.appendChild(controls);

  let drawingFinished = false;

  const context = (() => {
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.touchAction = "pan-y";
    return canvas.getContext("2d");
  })();
  const canvas = context.canvas;

  function applyLayout(newW) {
    w = newW;
    const t = Math.max(0, Math.min(1, (w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH)));
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    // Two discrete tiers on top of the continuous scaling — discrete so labels do not
    // shimmer while the container is resized: below 600px the right-edge labels shrink to
    // the bare scenario codes (the select above already spells each one out), and below
    // 480px the panel headers shorten and the y-tick units move into the axis titles.
    const bareLabels = w < 600;
    compact = w < 480;
    scenarioLabel = bareLabels ? (c => c) : (c => `${names[c]} (${c})`);
    userLabel = bareLabels ? "my pCO₂" : "my pCO₂ trajectory";
    histHeader = compact ? "Historical" : "Historical trajectory";
    futHeader = compact ? "Future" : "Future trajectory";

    LABEL_FONT = `${lerp(13, 16)}px sans-serif`;
    CALLOUT_FONT = `bold ${lerp(13, 16)}px sans-serif`;
    TITLE_FONT = `bold ${lerp(20, 32)}px sans-serif`;
    LABEL_GAP = lerp(4, 6);
    LABEL_LEAD = lerp(16, 20);
    LEADER = lerp(18, 26);
    CALLOUT_DX = lerp(-15, -30);

    // Both margins are measured rather than guessed, at this tier's own strings and font:
    // the widest right-edge label, and the widest y-tick label either panel can produce —
    // templates rather than live tick values, so the margin cannot shift when a drawn
    // trajectory changes the top panel's tick range.
    measure.font = LABEL_FONT;
    const widestLabel = Math.max(
      ...codes.map(c => measure.measureText(scenarioLabel(c)).width),
      measure.measureText(userLabel).width,
    );
    marginR = Math.ceil(widestLabel) + LABEL_GAP + 8;
    const tickTemplates = compact ? ["1000", "−20"] : ["1000 ppm", "−20 Gt/yr"];
    marginL = Math.ceil(Math.max(...tickTemplates.map(s => measure.measureText(s).width))) + 13;

    innerW = w - marginL - marginR;
    x = d3.scaleLinear().domain([YEAR_START, YEAR_END]).range([marginL, marginL + innerW]);

    // Gridlines every YEAR_STEP, but a year label only every other one — and only every
    // fourth once the plotting area is too narrow for "1900" and "1950" to stay apart.
    YEAR_LABEL_STEP = innerW >= 240 ? 50 : 100;

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

  const status = document.createElement("div");
  status.style.cssText = "padding:6px 0;color:#555;min-height:1.4em;";
  container.appendChild(status);

  const yBot = d3.scaleLinear().domain([GT_MIN, GT_MAX]).range([botT + botH, botT]);
  const curve = d3.curveCatmullRom(context);

  // Linear interpolation along the stroke, in year space: the stroke is monotone in year
  // by construction, so the first point at or past the asked-for year closes the bracket.
  function sampleStrokeAt(s, year) {
    if (s.length < 2) return null;
    if (year < s[0].year || year > s[s.length - 1].year) return null;
    for (let i = 1; i < s.length; i++) {
      if (s[i].year >= year) {
        const p0 = s[i - 1], p1 = s[i];
        if (p1.year === p0.year) return p1.gt;
        const t = (year - p0.year) / (p1.year - p0.year);
        return p0.gt * (1 - t) + p1.gt * t;
      }
    }
    return s[s.length - 1].gt;
  }

  // Net CO₂ sink diagnosed from the stock change: S(t) = E(t) − K·(pCO₂(t+1) − pCO₂(t)).
  // Derived from true emissions and true CO₂ stock, so it is fixed per scenario. It can go
  // negative — net outgassing — when atmospheric CO₂ declines, which is physically expected.
  function trueSinks(sc) {
    const emByYr = new Map(co2[sc].map(p => [p.year, p.gt]));
    const ppmByYr = new Map(pco2[sc].map(p => [p.year, p.ppm]));
    const out = [];
    for (const p of pco2[sc]) {
      const em = emByYr.get(p.year);
      const nextPpm = ppmByYr.get(p.year + 1);
      if (em === undefined || nextPpm === undefined) continue;
      out.push({ year: p.year, gt: em - K * (nextPpm - p.ppm) });
    }
    return out;
  }

  function scenarioData(sc) {
    const co2Series = co2[sc];
    const pco2Series = pco2[sc];
    const emByYr = new Map(co2Series.map(p => [p.year, p.gt]));
    const ppmByYr = new Map(pco2Series.map(p => [p.year, p.ppm]));
    const split = SCENARIO_START - 1;
    const sinks = trueSinks(sc);
    const sinkByYr = new Map(sinks.map(s => [s.year, s.gt]));
    return {
      co2Series, pco2Series, emByYr, ppmByYr, sinkByYr,
      historical: co2Series.filter(p => p.year <= split),
      co2Future: co2Series.filter(p => p.year >= split),
      pco2Historical: pco2Series.filter(p => p.year <= split),
      pco2Future: pco2Series.filter(p => p.year >= split),
      sinksHistorical: sinks.filter(s => s.year <= split),
      sinksFuture: sinks.filter(s => s.year >= split),
      startPoint: co2Series.find(p => p.year === SCENARIO_START),
    };
  }

  // The stroke lives in data coordinates ({year, gt}), not canvas pixels, so a re-layout
  // can re-project it through the new scales and the emitted value never depends on the
  // figure's size.
  let data = scenarioData("ML");
  let start = data.startPoint;
  let currentStroke = [{year: start.year, gt: start.gt}];

  function frame(t, h, yScale, yTicks, ylabel, drawXTicks, yFormat = String) {
    // Painted first so gridlines, curves and labels all sit on top of it.
    context.fillStyle = PANEL_BG;
    context.fillRect(marginL, t, innerW, h);
    context.strokeStyle = "rgba(0,0,0,0.12)"; context.lineWidth = 1;
    for (const v of yTicks) {
      const py = yScale(v);
      context.beginPath();
      context.moveTo(marginL, py); context.lineTo(marginL + innerW, py); context.stroke();
    }
    for (let year = YEAR_START; year <= YEAR_END; year += YEAR_STEP) {
      const px = x(year);
      context.beginPath();
      context.moveTo(px, t); context.lineTo(px, t + h); context.stroke();
    }
    context.strokeStyle = "#666"; context.fillStyle = "#333"; context.font = LABEL_FONT;
    context.beginPath();
    context.moveTo(marginL, t);
    context.lineTo(marginL, t + h);
    context.stroke();
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yTicks) {
      const py = yScale(v);
      context.beginPath();
      context.moveTo(marginL - 5, py); context.lineTo(marginL, py); context.stroke();
      context.fillText(yFormat(v), marginL - 8, py);
    }
    if (drawXTicks) {
      context.textAlign = "center"; context.textBaseline = "top";
      for (let year = YEAR_START; year <= YEAR_END; year += YEAR_STEP) {
        const px = x(year);
        context.beginPath();
        context.moveTo(px, t + h); context.lineTo(px, t + h + 5); context.stroke();
        if ((year - YEAR_START) % YEAR_LABEL_STEP === 0) context.fillText(year, px, t + h + 8);
      }
    }
    // Axis title inside the frame, top-left, nudged in off the corner.
    context.font = TITLE_FONT;
    context.textAlign = "left"; context.textBaseline = "top";
    context.fillText(ylabel, marginL + 10, t + 10);
    context.font = LABEL_FONT;
  }

  function signed(v) {
    if (v === 0) return "0";
    return v > 0 ? `+${v}` : `−${-v}`;
  }

  function annotate(px, py, text, color) {
    context.fillStyle = color;
    context.font = LABEL_FONT;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(text, px + LABEL_GAP, py);
  }

  // Right-edge labels sit at their curve's final value, so curves that converge (VL and L,
  // typically) print on top of each other. Spread them apart in y while preserving their
  // vertical order, then shift the whole stack back inside the panel if spreading overflowed.
  function spreadLabels(labels, top, bottom) {
    const s = [...labels].sort((a, b) => a.y - b.y);
    for (let i = 1; i < s.length; i++) {
      if (s[i].y - s[i - 1].y < LABEL_LEAD) s[i].y = s[i - 1].y + LABEL_LEAD;
    }
    if (s.length) {
      const over = s[s.length - 1].y - bottom;
      if (over > 0) for (const l of s) l.y -= over;
      const under = top - s[0].y;
      if (under > 0) for (const l of s) l.y += under;
    }
    return s;
  }

  function drawLabels(labels, top, bottom) {
    for (const l of spreadLabels(labels, top, bottom)) annotate(l.x, l.y, l.text, l.color);
  }

  // Label offset from a point on a curve, joined to it by a leader line that slants across
  // to wherever the label ends up. side = -1 puts the label above the curve, +1 below; dx
  // shifts it sideways. The label is clamped inside the plotting area, so asking for more
  // offset than there is room for slides it up against the axis instead of past it.
  function callout(px, py, text, color, side, dx = 0) {
    context.font = CALLOUT_FONT;
    const half = context.measureText(text).width / 2;
    const cx = Math.max(marginL + 4 + half, Math.min(marginL + innerW - 4 - half, px + dx));
    const tipY = py + side * 5;
    const endY = py + side * LEADER;
    context.strokeStyle = color; context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(px, tipY); context.lineTo(cx, endY);
    context.stroke();
    context.lineWidth = 1;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = side < 0 ? "bottom" : "top";
    context.fillText(text, cx, endY + side * 3);
    context.font = LABEL_FONT;
  }

  function drawSeries(series, yValue, yScale, color, dash, thickness = 4) {
    context.strokeStyle = color; context.lineWidth = thickness;
    if (dash) context.setLineDash(dash);
    context.beginPath();
    d3.line()
      .x(d => x(d.year))
      .y(d => yScale(yValue(d)))
      .curve(d3.curveMonotoneX)
      .context(context)(series);
    context.stroke();
    if (dash) context.setLineDash([]);
    context.lineWidth = 1;
  }

  function inferredPCO2() {
    if (currentStroke.length < 2) return [];
    const startPpm = data.ppmByYr.get(SCENARIO_START);
    if (startPpm === undefined) return [];
    const out = [{ year: SCENARIO_START, ppm: startPpm }];
    let ppm = startPpm;
    const lastYear = Math.floor(currentStroke[currentStroke.length - 1].year);
    const stopYear = Math.min(YEAR_END, lastYear);
    for (let t = SCENARIO_START; t < stopYear; t++) {
      const eUser = sampleStrokeAt(currentStroke, t);
      if (eUser === null) break;
      const s = data.sinkByYr.get(t);
      if (s === undefined) break;
      ppm += (eUser - s) / K;
      out.push({ year: t + 1, ppm });
    }
    return out;
  }

  const scenarioColor = () => colors[sel.value];

  function render() {
    context.clearRect(0, 0, w, totalH);
    const sc = sel.value;
    const scColor = scenarioColor();

    context.fillStyle = "#333"; context.font = LABEL_FONT;
    context.textAlign = "center"; context.textBaseline = "middle";
    const histMidX = (x(YEAR_START) + x(SCENARIO_START)) / 2;
    const futMidX  = (x(SCENARIO_START) + x(YEAR_END)) / 2;
    context.fillText(histHeader, histMidX, 14);
    context.fillText(futHeader, futMidX, 14);
    context.strokeStyle = "#666"; context.lineWidth = 1;
    for (const [xa, xb] of [[x(YEAR_START), x(SCENARIO_START)], [x(SCENARIO_START), x(YEAR_END)]]) {
      context.beginPath();
      context.moveTo(xa + 2, 26); context.lineTo(xb - 2, 26); context.stroke();
      context.beginPath();
      context.moveTo(xa + 2, 24); context.lineTo(xa + 2, 30); context.stroke();
      context.beginPath();
      context.moveTo(xb - 2, 24); context.lineTo(xb - 2, 30); context.stroke();
    }

    const otherColor = "rgba(0,0,0,0.10)";
    const splitYear = SCENARIO_START - 1;

    const inf = drawingFinished ? inferredPCO2() : [];
    const ppmVals = [];
    for (const sc2 of codes) for (const p of pco2[sc2]) ppmVals.push(p.ppm);
    if (inf.length >= 2) for (const p of inf) ppmVals.push(p.ppm);
    const yTop = d3.scaleLinear().domain(d3.extent(ppmVals)).range([topT + topH, topT]).nice();
    frame(topT, topH, yTop, yTop.ticks(5), compact ? "CO₂ (ppm)" : "Atmospheric CO₂", false,
          v => compact ? String(v) : `${v} ppm`);

    drawSeries(data.pco2Historical, d => d.ppm, yTop, HIST_COLOR);

    const ppmLabels = [];
    for (const sc2 of codes) {
      if (sc2 === sc) continue;
      const future = pco2[sc2].filter(p => p.year >= splitYear);
      drawSeries(future, d => d.ppm, yTop, otherColor, undefined, 2);
      const last = future[future.length - 1];
      ppmLabels.push({x: x(last.year), y: yTop(last.ppm), text: scenarioLabel(sc2), color: otherColor});
    }

    drawSeries(data.pco2Future, d => d.ppm, yTop, scColor);
    const lastPco2 = data.pco2Future[data.pco2Future.length - 1];
    ppmLabels.push({x: x(lastPco2.year), y: yTop(lastPco2.ppm), text: scenarioLabel(sc), color: scColor});

    if (inf.length >= 2) {
      drawSeries(inf, d => d.ppm, yTop, "red");
      const lastInf = inf[inf.length - 1];
      ppmLabels.push({x: x(lastInf.year), y: yTop(lastInf.ppm), text: userLabel, color: "red"});
    }
    drawLabels(ppmLabels, topT, topT + topH);

    frame(botT, botH, yBot, yBot.ticks(5), compact ? "CO₂ fluxes (Gt/yr)" : "CO₂ fluxes", true,
          v => compact ? signed(v) : `${signed(v)} Gt/yr`);
    context.strokeStyle = "#ddd";
    context.beginPath();
    context.moveTo(marginL, yBot(0)); context.lineTo(marginL + innerW, yBot(0));
    context.stroke();
    drawSeries(data.sinksHistorical, d => d.gt, yBot, HIST_COLOR, [5, 4]);
    drawSeries(data.sinksFuture, d => d.gt, yBot, scColor, [5, 4]);
    drawSeries(data.historical, d => d.gt, yBot, HIST_COLOR);
    if (drawingFinished) {
      drawSeries(data.co2Future, d => d.gt, yBot, scColor);
    }
    // Anchored in the historical period, so both labels are present from the start —
    // the future emissions curve only appears once the user has drawn something.
    const em = data.emByYr.get(CALLOUT_YEAR);
    const sk = data.sinkByYr.get(CALLOUT_YEAR);
    if (em !== undefined) callout(x(CALLOUT_YEAR), yBot(em), "emissions", HIST_COLOR, -1, CALLOUT_DX);
    if (sk !== undefined) callout(x(CALLOUT_YEAR), yBot(sk), "natural sink", HIST_COLOR, +1);

    context.strokeStyle = "rgba(0,0,0,0.3)"; context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(x(SCENARIO_START), topT);
    context.lineTo(x(SCENARIO_START), botT + botH);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = "red"; context.lineWidth = 4;
    context.beginPath();
    curve.lineStart();
    for (const p of currentStroke) curve.point(x(p.year), yBot(p.gt));
    curve.lineEnd();
    context.stroke();
    context.lineWidth = 1;

    const startX = x(start.year), startY = yBot(start.gt);
    context.beginPath();
    context.arc(startX, startY, 5, 0, 2 * Math.PI);
    context.fillStyle = "red";
    context.fill();

    context.fillStyle = "red";
    context.font = LABEL_FONT;
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText("Draw from here!", startX - 2, startY - 8);

    context.fillStyle = "#333";
    context.textAlign = "center"; context.textBaseline = "bottom";
    context.fillText("Year", marginL + innerW / 2, totalH - 4);

    if (currentStroke.length <= 1) {
      status.textContent = "Drag on the bottom panel to draw a future emissions trajectory.";
    } else {
      const last = currentStroke[currentStroke.length - 1];
      status.textContent = `Drew ${currentStroke.length} points, reached year ${Math.round(last.year)} at ${last.gt.toFixed(1)} Gt CO₂/yr.`;
    }
  }

  function updateValue() {
    container.value = currentStroke.map(p => ({ year: p.year, gt: p.gt }));
    container.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }

  sel.addEventListener("change", () => {
    data = scenarioData(sel.value);
    start = data.startPoint;
    currentStroke = [{year: start.year, gt: start.gt}];
    drawingFinished = false;
    render();
    updateValue();
  });

  // Drawing is a plain pointer capture rather than d3-drag: the mapping below corrects for
  // a canvas whose CSS size differs from its logical size (host CSS, or mid-resize), which
  // d3's own event coordinates do not, and pointer capture keeps the stroke going when a
  // finger wanders off the canvas.
  let drawing = false;

  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {
      px: (e.clientX - r.left) * (w / r.width),
      py: (e.clientY - r.top) * (totalH / r.height),
    };
  }

  function inDrawPanel(py) {
    return py >= botT && py <= botT + botH;
  }

  // Points are converted to data space as they are captured, and only ever extend the
  // stroke rightwards in time, so the stroke stays monotone in year.
  function extendStroke(px, py) {
    const year = Math.min(x.invert(px), YEAR_END);
    if (year > currentStroke[currentStroke.length - 1].year) {
      const gt = Math.max(GT_MIN, Math.min(GT_MAX, yBot.invert(py)));
      currentStroke.push({year, gt});
    }
    render();
    updateValue();
  }

  canvas.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    if (!inDrawPanel(py)) return;
    drawing = true;
    drawingFinished = false;
    // Every press starts the stroke over from the scenario's start point, which is what
    // d3-drag's subject callback used to do.
    currentStroke = [{year: start.year, gt: start.gt}];
    canvas.setPointerCapture(e.pointerId);
    extendStroke(px, py);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", e => {
    if (!drawing) return;
    const {px, py} = pointerAt(e);
    extendStroke(px, py);
  });

  for (const type of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(type, e => {
      if (!drawing) return;
      drawing = false;
      drawingFinished = true;
      canvas.releasePointerCapture(e.pointerId);
      render();
      updateValue();
    });
  }

  // touch-action pan-y keeps vertical swipes over the top panel scrolling the host page,
  // and preventDefault on touchstart — pointerdown's would not do it — stops the pan only
  // when the touch begins inside the drawing panel, so drawing does not fight scrolling.
  canvas.addEventListener("touchstart", e => {
    const t = e.touches[0];
    if (!t) return;
    const r = canvas.getBoundingClientRect();
    if (inDrawPanel((t.clientY - r.top) * (totalH / r.height))) e.preventDefault();
  }, {passive: false});

  // Reflow with the container. The observer watches the widget's own container div so the
  // script-tag embed, which has no Observable runtime, is responsive too. Laying out
  // synchronously in the callback is deliberate: the observer already fires at most once
  // per frame, after layout and before paint, and the canvas sits in a max-width:100%
  // wrapper so re-laying it out can never change the container's own width and loop.
  // Resizing never emits "input": the stroke lives in data coordinates and simply
  // re-projects through the new scales.
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

  render();
  container.value = currentStroke.map(p => ({ year: p.year, gt: p.gt }));
  return container;
}
