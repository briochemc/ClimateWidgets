// Atmospheric CO₂ across every scale we have measured it on: the weekly Mauna Loa record,
// the Keeling curve since 1958, two centuries of Law Dome and Siple Station ice, and the
// 800,000-year Antarctic composite. One chart, one time axis that always ends at the latest
// week, and a "look back" slider that stretches the axis from a year to 800,000 years, so
// the reader zooms out from today's seasonal wiggle to the ice ages in one motion. The Play
// tour does that zoom by itself, stop by stop, after the second half of Andy Jacobson's
// NOAA animation (https://gml.noaa.gov/ccgg/trends/history.html); its first half, the
// months sweeping past on a latitude panel, is the co2-latitude widget.
//
// Self-contained on purpose: no d3, no other imports, so the script-tag embed is a single
// ES module import. The data file is built by scripts/co2-history.mjs; see its header for
// the layout of the packed monthly series.

const ACCENT = "#0b57d0";
const MLO_COLOR = "#d62728";
const SPO_COLOR = "#1f4fd6";
const LAW_COLOR = "#f28e2b";
const SIPLE_COLOR = "#8c564b";
// One colour per ice core in the Bereiter composite, keyed by the names the data file uses.
const CORE_COLORS = {
  "Law Dome": LAW_COLOR,
  "EPICA Dome C": "#2b3a9e",
  "Vostok": "#9467bd",
  "EDML": "#2ca02c",
  "Talos Dome": "#e377c2",
  "Siple Dome": "#bcbd22",
  "WAIS Divide": "#17becf",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH
// it stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Vertical layout is fixed so embed iframe heights stay put.
const PLOT_T = 10, PLOT_H = 320;
const PLOT_B = PLOT_T + PLOT_H;
const TOTAL_H = PLOT_B + 32;

const LOOK_MIN = 1;                  // years; the shortest window
const PREINDUSTRIAL = 278, ICE_AGE = 185;

// Landmarks that give the time axis a sense of scale, after xkcd's temperature timeline:
// a few words at the top of the plot with a thin line down to the CO₂ of the moment. The
// date is left to the axis. A label shows only while its event sits comfortably inside the
// window (not crammed against the right edge, not about to fall off the left), and the
// labels on screen are packed into rows so none overlap. Times are years CE; "years ago"
// events are counted from 1950, as the ice cores are.
const MILESTONES = [
  {t: 1958.2, label: "Keeling begins"},
  {t: 1770, label: "Industrial Revolution"},
  {t: 1680, label: "dodo extinct"},
  {t: -2050, label: "last woolly mammoths"},
  {t: 1950 - 11500, label: "farming begins"},
  {t: 1950 - 11700, label: "last ice age ends"},
  {t: 1950 - 40000, label: "last Neanderthals"},
  {t: 1950 - 300000, label: "first Homo sapiens"},
  {t: 1950 - 773000, label: "magnetic field flips"},
];

// Unpacks a monthly series {year, month, v: [...]} into [[decimalYear, ppm], ...],
// dropping the missing months.
export function unpackMonthly(packed) {
  if (!packed) return [];
  const out = [];
  const start = packed.year * 12 + (packed.month - 1);
  packed.v.forEach((val, i) => {
    if (val === null) return;
    const m = start + i;
    out.push([Math.floor(m / 12) + ((m % 12) + 0.5) / 12, val]);
  });
  return out;
}

// NOAA serves its Mauna Loa files with open CORS headers, so a page can fetch the weekly and
// monthly records live and hand them here to bring the bundled data up to date. Each series
// is replaced only when the live file reaches later than the bundled one; a failed or
// truncated fetch changes nothing. Returns true when anything was updated.
export function updateMaunaLoa(data, {weekly, monthly} = {}) {
  let changed = false;
  if (weekly) {
    const rows = noaaLines(weekly).map(c => [Math.round(c[3] * 10000) / 10000, Math.round(c[4] * 100) / 100])
      .filter(([, v]) => v > 0);
    const bundled = data.mlo.weekly;
    if (rows.length && (!bundled.length || rows[rows.length - 1][0] > bundled[bundled.length - 1][0])) {
      data.mlo.weekly = rows;
      changed = true;
    }
  }
  if (monthly) {
    const rows = noaaLines(monthly).filter(c => c[3] > 0);
    if (rows.length) {
      const first = rows[0][0] * 12 + (rows[0][1] - 1);
      const last = rows[rows.length - 1][0] * 12 + (rows[rows.length - 1][1] - 1);
      const b = data.mlo.monthly;
      const bundledLast = b ? b.year * 12 + (b.month - 1) + b.v.length - 1 : -Infinity;
      if (last > bundledLast) {
        const v = new Array(last - first + 1).fill(null);
        for (const c of rows) v[c[0] * 12 + (c[1] - 1) - first] = Math.round(c[3] * 100) / 100;
        data.mlo.monthly = {year: rows[0][0], month: rows[0][1], v};
        changed = true;
      }
    }
  }
  return changed;
}

// Data lines of a NOAA trends text file (`#` comments, whitespace-separated numbers).
function noaaLines(text) {
  return text.split(/\r?\n/)
    .filter(l => l.trim() && !l.startsWith("#"))
    .map(l => l.trim().split(/\s+/).map(Number))
    .filter(c => c.length >= 5 && c.every(Number.isFinite));
}

export function createCo2HistoryWidget({data, width = FIGURE_WIDTH, lookBack = null}) {
  // ---- data -----------------------------------------------------------------------------------
  const mloMonthly = unpackMonthly(data.mlo.monthly);
  const mloWeekly = data.mlo.weekly;
  const spoMonthly = unpackMonthly(data.spo.monthly);
  const lawSamples = data.lawDome.samples;                 // [ageCE, ppm, err]
  const lawSpline = data.lawDome.spline;                   // [ageCE, ppm]
  const siple = [
    ...data.siple.neftel.map(([t, lo, hi, v]) => [t, v, lo, hi]),
    ...data.siple.friedli.map(([t, v]) => [t, v, null, null]),
  ].sort((a, b) => a[0] - b[0]);
  const composite = data.composite.rows;                   // [yearCE, ppm, sigma, coreIndex], ascending
  const coreNames = data.composite.cores;

  const tEnd = mloWeekly.length ? mloWeekly[mloWeekly.length - 1][0] : mloMonthly[mloMonthly.length - 1][0];
  const tOldest = composite[0][0];
  // Wide enough for the oldest ice and for the oldest milestone to clear the left edge.
  const LOOK_MAX = Math.ceil(Math.max(tEnd - tOldest + 500, (tEnd - MILESTONES[MILESTONES.length - 1].t) * 1.06) / 1000) * 1000;
  // The milestones' ages, oldest last, and where the tour rests to show each one: the window
  // in which the event sits about two fifths of the way in from the left.
  const milestones = MILESTONES.map(m => ({...m, age: tEnd - m.t})).filter(m => m.age > 0 && m.age < LOOK_MAX)
    .sort((a, b) => a.age - b.age);
  const milestoneAlpha = m => fadeIn(m.age * 1.02, m.age * 1.06) * fadeOut(m.age * 5, m.age * 8);
  const tFirstObs = Math.min(mloMonthly[0]?.[0] ?? Infinity, spoMonthly[0]?.[0] ?? Infinity);
  const latest = mloMonthly[mloMonthly.length - 1];
  const latestLabel = `${monthName(latest[0])} ${Math.floor(latest[0])}: ${Math.round(latest[1])} ppm`;

  // The last time Mauna Loa's monthly mean was below 350 ppm — the video's callout.
  const last350 = (() => {
    for (let i = mloMonthly.length - 1; i >= 0; i--) if (mloMonthly[i][1] < 350) return mloMonthly[i];
    return null;
  })();

  // ---- state ----------------------------------------------------------------------------------
  const presets = [
    {label: "5 years", look: 5},
    {label: "Since 1958", look: tEnd - 1957.9},
    {label: "Since 1750", look: tEnd - 1749},
    {label: "2,000 years", look: 2000},
    {label: "10,000 years", look: 10000},
    {label: "800,000 years", look: LOOK_MAX},
  ];
  let look = clamp(lookBack ?? presets[1].look, LOOK_MIN, LOOK_MAX);   // years shown, ending at tEnd
  let hoverT = null;                    // where the pointer is over the chart, or null
  let yLo = 0, yHi = 1, yTargetLo = 0, yTargetHi = 1, ySnap = true;   // y range, animated

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const buttonCss =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 0 8px;";
  const presetButtons = presets.map(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = p.label;
    b.style.cssText = buttonCss;
    b.addEventListener("click", () => { stopTour(); glideLook(p.look); });
    controls.appendChild(b);
    return {el: b, preset: p};
  });
  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText = buttonCss + "margin-left:auto;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);
  container.appendChild(controls);

  // The look-back slider is logarithmic, the whole record at the left end and a year at the
  // right, so pulling it left goes back in time.
  const SLIDER_STEPS = 1000;
  const sliderField = document.createElement("label");
  sliderField.style.cssText = "display:flex;align-items:center;gap:8px;padding:0 0 6px;font-size:14px;cursor:pointer;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = SLIDER_STEPS;
  slider.step = 1;
  slider.style.cssText = `flex:1 1 120px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", "How far back in time the chart looks; left is further back");
  const sliderOut = document.createElement("span");
  sliderOut.style.cssText = "color:#333;min-width:7.5em;text-align:right;font-variant-numeric:tabular-nums;";
  sliderField.append("Look back", slider, sliderOut);
  slider.addEventListener("input", e => {
    e.stopPropagation();
    stopTour();
    setLook(sliderToLook(Number(slider.value)));
    emit();
  });
  container.appendChild(sliderField);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;touch-action:pan-y;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Atmospheric CO₂ against time");
  const context = canvas.getContext("2d");
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(canvas);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:1.4em;line-height:1.4;";
  container.appendChild(status);

  const HINT_IDLE =
    "Drag the slider to look further back, or pick a span above; hover the chart to read " +
    "the record under the cursor.";
  const HINT_TOUR =
    "Touring: zooming out from the last decades to the ice ages, pausing at each landmark — " +
    "click anything to take over; Play tour starts it again.";
  const hint = document.createElement("div");
  hint.style.cssText = "padding:4px 0 0;color:#888;font-size:14px;";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, marginL, marginR, plotL, plotR;
  let tickFont, noteFont, labelFont, dotR;

  function applyLayout(newW) {
    w = newW;
    const k = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * k);
    marginL = lerp(58, 68);   // tick labels, and the axis title left of them
    marginR = lerp(12, 20);
    plotL = marginL;
    plotR = w - marginR;
    tickFont = `${lerp(12, 14)}px sans-serif`;
    noteFont = `${lerp(11, 13)}px sans-serif`;
    labelFont = `bold ${lerp(12, 14)}px sans-serif`;
    dotR = lerp(3, 4);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = TOTAL_H * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = TOTAL_H + "px";
    context.scale(dpr, dpr);
  }
  applyLayout(maxW);

  // ---- scales ---------------------------------------------------------------------------------
  const tStart = () => tEnd - look;
  const x = t => plotL + ((t - tStart()) / look) * (plotR - plotL);
  x.invert = px => tStart() + ((px - plotL) / (plotR - plotL)) * look;
  const y = v => PLOT_B - ((v - yLo) / (yHi - yLo)) * PLOT_H;

  function sliderToLook(s) {
    return LOOK_MAX * Math.pow(LOOK_MIN / LOOK_MAX, s / SLIDER_STEPS);
  }
  function lookToSlider(l) {
    return Math.round(SLIDER_STEPS * Math.log(l / LOOK_MAX) / Math.log(LOOK_MIN / LOOK_MAX));
  }

  // Which records are drawn depends on how far back the chart looks: each fades in and out
  // over a band of look-back spans (in log space), so zooming never pops a layer on or off.
  function fadeIn(a, b) { return smooth((Math.log(look) - Math.log(a)) / (Math.log(b) - Math.log(a))); }
  function fadeOut(a, b) { return 1 - fadeIn(a, b); }
  const alphas = () => ({
    weekly: fadeOut(8, 16),
    monthly: fadeIn(6, 12),
    law: fadeIn(80, 160) * fadeOut(20000, 50000),
    siple: fadeIn(80, 160) * fadeOut(3000, 8000),
    composite: fadeIn(1200, 3000),
    preindustrial: fadeIn(120, 250),
    iceAge: fadeIn(15000, 40000),
    last350: last350 ? fadeIn(12, 20) * fadeOut(150, 400) : 0,
  });

  // ---- y ranges -------------------------------------------------------------------------------
  // The main chart's range follows the visible data: the min and max of every record that is
  // drawn, over the window, plus the reference lines when they show.
  function targetRange() {
    const a = alphas();
    const t0 = tStart(), t1 = tEnd + look * 0.02;
    let lo = Infinity, hi = -Infinity;
    const take = v => { if (v < lo) lo = v; if (v > hi) hi = v; };
    const scan = (pts, alpha) => {
      if (alpha <= 0.02) return;
      for (let i = lowerBound(pts, t0); i < pts.length && pts[i][0] <= t1; i++) take(pts[i][1]);
    };
    scan(mloWeekly, a.weekly);
    scan(mloMonthly, a.monthly);
    scan(spoMonthly, a.monthly);
    scan(lawSamples, a.law);
    scan(siple, a.siple);
    scan(composite, a.composite);
    if (a.preindustrial > 0.02) take(PREINDUSTRIAL);
    if (a.iceAge > 0.02) take(ICE_AGE);
    if (!Number.isFinite(lo)) { lo = 300; hi = 450; }
    const pad = Math.max(2, (hi - lo) * 0.08);
    return [lo - pad, hi + pad * 1.6];   // extra room above for the labels
  }

  // ---- lookups --------------------------------------------------------------------------------
  // The monthly value nearest a time, if there is one within a month of it.
  function seriesAt(pts, t) {
    if (!pts.length) return null;
    const i = lowerBound(pts, t);
    const cands = [pts[i - 1], pts[i]].filter(Boolean);
    let best = null;
    for (const p of cands) if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    return best && Math.abs(best[0] - t) < 1 / 12 + 1e-6 ? best : null;
  }

  // ---- rendering ------------------------------------------------------------------------------
  let raf = null;
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let lastFrame = 0;
  function frame(now) {
    raf = null;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    // The range chases its target; it snaps on the first frame and under reduced motion.
    const rate = ySnap || reduceMotion ? 1 : 1 - Math.exp(-dt * 10);
    yLo += (yTargetLo - yLo) * rate;
    yHi += (yTargetHi - yHi) * rate;
    ySnap = false;
    render();
    if (Math.abs(yTargetLo - yLo) + Math.abs(yTargetHi - yHi) >= 0.05) requestRender();
    else { yLo = yTargetLo; yHi = yTargetHi; lastFrame = 0; }
  }

  function render() {
    context.clearRect(0, 0, w, TOTAL_H);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, TOTAL_H);
    drawChart();
    updateStatus();
    updateButtons();
  }

  function drawChart() {
    const a = alphas();
    const t0 = tStart(), t1 = tEnd + look * 0.02;

    // Gridlines and axes.
    const yt = yTicks(yLo, yHi, PLOT_H);
    const xt = xTicks();
    context.strokeStyle = "rgba(0,0,0,0.1)";
    context.lineWidth = 1;
    for (const v of yt) line(plotL, y(v), plotR, y(v));
    for (const tk of xt) line(x(tk.t), PLOT_T, x(tk.t), PLOT_B);

    context.save();
    context.beginPath();
    context.rect(plotL, PLOT_T - 1, plotR - plotL, PLOT_H + 2);
    context.clip();

    // Reference lines, dashed, under the data; their labels come after it, so the halo
    // sits on top of the dots rather than under them.
    const references = [
      [a.preindustrial, PREINDUSTRIAL, "Preindustrial: about 278 ppm", LAW_COLOR],
      [a.iceAge, ICE_AGE, "Ice ages: about 185 ppm", CORE_COLORS["EPICA Dome C"]],
    ];
    for (const [alpha, v, , color] of references) {
      if (alpha <= 0.02) continue;
      context.globalAlpha = alpha;
      context.strokeStyle = color;
      context.setLineDash([4, 4]);
      line(plotL, y(v), plotR, y(v));
      context.setLineDash([]);
    }
    context.globalAlpha = 1;

    // Ice cores, oldest layers first so the modern records sit on top.
    if (a.composite > 0.02) drawComposite(a.composite, t0, t1);
    if (a.siple > 0.02) drawSiple(a.siple, t0, t1);
    if (a.law > 0.02) drawLawDome(a.law, t0, t1);
    if (a.monthly > 0.02) {
      strokeSeries(spoMonthly, t0, t1, SPO_COLOR, 1.5, a.monthly);
      strokeSeries(mloMonthly, t0, t1, MLO_COLOR, 1.5, a.monthly);
    }
    if (a.weekly > 0.02) strokeSeries(mloWeekly, t0, t1, MLO_COLOR, 1.5, a.weekly);

    context.font = labelFont;
    context.textAlign = "left"; context.textBaseline = "bottom";
    for (const [alpha, v, text, color] of references) {
      if (alpha <= 0.02) continue;
      context.globalAlpha = alpha;
      context.fillStyle = color;
      haloText(text, plotL + 6, y(v) - 3);
    }
    context.globalAlpha = 1;

    // The 350 ppm callout: a thin vertical rule at the last month below it.
    if (a.last350 > 0.02) {
      context.globalAlpha = a.last350;
      context.strokeStyle = MLO_COLOR;
      line(x(last350[0]), y(last350[1]), x(last350[0]), PLOT_B);
      context.fillStyle = MLO_COLOR;
      context.font = noteFont;
      context.textAlign = "left"; context.textBaseline = "top";
      const lx = x(last350[0]) + 5;
      const lines = [`${monthName(last350[0])} ${Math.floor(last350[0])}: Mauna Loa`, "sees 350 ppm", "for the last time"];
      lines.forEach((s, i) => haloText(s, lx, y(last350[1]) + 8 + i * 14));
      context.globalAlpha = 1;
    }

    // Latest month, labelled at the end of the record.
    context.font = labelFont;
    context.fillStyle = MLO_COLOR;
    context.textAlign = "right"; context.textBaseline = "bottom";
    const endX = x(latest[0]), endY = y(latest[1]);
    context.beginPath();
    context.arc(endX, endY, dotR, 0, 2 * Math.PI);
    context.fill();
    haloText(latestLabel, Math.min(plotR - 4, endX + 4), endY - dotR - 3);

    drawMilestones(a, t0, t1);

    // Hover cursor: a vertical rule at the pointer's time.
    if (hoverT !== null) {
      context.strokeStyle = "rgba(0,0,0,0.35)";
      line(x(hoverT), PLOT_T, x(hoverT), PLOT_B);
    }
    context.restore();

    // Axes and tick labels.
    context.strokeStyle = "#666"; context.fillStyle = "#333";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(plotL, PLOT_T); context.lineTo(plotL, PLOT_B); context.lineTo(plotR, PLOT_B);
    context.stroke();
    context.font = tickFont;
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yt) {
      line(plotL - 4, y(v), plotL, y(v));
      context.fillText(v, plotL - 7, y(v));
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (const tk of xt) {
      line(x(tk.t), PLOT_B, x(tk.t), PLOT_B + 5);
      const half = context.measureText(tk.label).width / 2 + 2;
      context.fillText(tk.label, clamp(x(tk.t), half, w - half), PLOT_B + 8);
    }
    context.save();
    context.translate(14, PLOT_T + PLOT_H / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("CO₂ (ppm)", 0, 0);
    context.restore();

    drawLegend(a, t0, t1);
  }

  // Short labels just above the curve, each with a leader line down to the record's value
  // at that moment, so the eye need not travel to the top of the plot. A label sits as close
  // above its point as it can: it moves up a line at a time until its box clears every label
  // already placed, the legend's corner, and their leaders, and no placed label sits over
  // its own leader.
  function drawMilestones(a, t0, t1) {
    const up = milestones.map(m => ({m, alpha: milestoneAlpha(m), mx: x(m.t)}))
      .filter(d => d.alpha > 0.02).sort((p, q) => p.mx - q.mx);
    if (!up.length) return;
    context.font = noteFont;
    const legend = legendItems(a, t0, t1);
    const boxes = [];   // placed boxes {x0, x1, y0, y1} and, for labels, their leader {mx, yTop, yBot}
    if (legend.length) {
      const legendW = Math.max(...legend.map(([n]) => context.measureText(n).width)) + 32;
      boxes.push({x0: plotL, x1: plotL + legendW, y0: PLOT_T, y1: PLOT_T + 4 + legend.length * 15});
    }
    const LIFT = 22, STEP = 16, H = 7;
    const clear = (x0, x1, y0, y1) => boxes.every(b => x1 < b.x0 || x0 > b.x1 || y1 < b.y0 || y0 > b.y1);
    const crosses = (mx, yTop, yBot) => boxes.some(b => mx >= b.x0 - 2 && mx <= b.x1 + 2 && yBot >= b.y0 && yTop <= b.y1);
    for (const d of up) {
      const v = co2At(d.m.t);
      d.py = v === null ? PLOT_B : y(v);
      const half = context.measureText(d.m.label).width / 2 + 4;
      d.lx = clamp(d.mx, plotL + half, plotR - half);
      const x0 = d.lx - half, x1 = d.lx + half;
      let ly = Math.min(d.py - LIFT, PLOT_B - LIFT);
      for (let k = 0; k < 20; k++, ly -= STEP) {
        if (ly - H < PLOT_T + 2) { ly = PLOT_T + 2 + H; break; }
        const leaderOk = !crosses(d.mx, ly + H, d.py - 3) &&
          // and no earlier leader passes through this box
          boxes.every(b => b.mx === undefined || b.mx < x0 - 2 || b.mx > x1 + 2 || b.yBot < ly - H || b.yTop > ly + H);
        if (clear(x0, x1, ly - H, ly + H) && leaderOk) break;
      }
      d.ly = ly;
      boxes.push({x0, x1, y0: ly - H, y1: ly + H, mx: d.mx, yTop: ly + H, yBot: d.py - 3});
    }
    // Leaders first, then the labels, whose halos cover any leader passing under them.
    for (const d of up) {
      context.globalAlpha = d.alpha;
      context.strokeStyle = "rgba(0,0,0,0.35)";
      context.lineWidth = 1;
      line(d.mx, d.ly + H + 1, d.mx, d.py - 3);
    }
    context.fillStyle = "#444";
    context.textAlign = "center"; context.textBaseline = "middle";
    for (const d of up) {
      context.globalAlpha = d.alpha;
      haloText(d.m.label, d.lx, d.ly);
    }
    context.globalAlpha = 1;
  }

  // The record's CO₂ at a time: Mauna Loa's monthly mean once it exists, the Law Dome
  // spline before that, and the ice-core composite before that.
  function co2At(t) {
    if (mloMonthly.length && t >= mloMonthly[0][0]) return interpAt(mloMonthly, t);
    if (lawSpline.length && t >= lawSpline[0][0] && t <= lawSpline[lawSpline.length - 1][0]) return interpAt(lawSpline, t);
    return composite.length ? interpAt(composite, t) : null;
  }

  function interpAt(pts, t) {
    const i = lowerBound(pts, t);
    if (i <= 0) return pts[0][1];
    if (i >= pts.length) return pts[pts.length - 1][1];
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }

  function strokeSeries(pts, t0, t1, color, lineWidth, alpha) {
    const i0 = Math.max(0, lowerBound(pts, t0) - 1);
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    context.beginPath();
    let first = true;
    for (let i = i0; i < pts.length; i++) {
      const [t, v] = pts[i];
      if (first) { context.moveTo(x(t), y(v)); first = false; } else context.lineTo(x(t), y(v));
      if (t > t1) break;
    }
    context.stroke();
    context.globalAlpha = 1;
    context.lineWidth = 1;
  }

  function drawComposite(alpha, t0, t1) {
    context.globalAlpha = alpha;
    // Thin joining lines per core, then the dots on top. Two points from different cores are
    // not joined, so the record reads as several overlapping cores rather than one curve.
    const i0 = Math.max(0, lowerBound(composite, t0) - 1);
    const r = look > 200000 ? 1.6 : look > 30000 ? 2.2 : dotR - 1;
    context.lineWidth = 1;
    let prev = null;
    for (let i = i0; i < composite.length && composite[i][0] <= t1; i++) {
      const p = composite[i];
      if (prev && prev[3] === p[3]) {
        context.strokeStyle = CORE_COLORS[coreNames[p[3]]] ?? "#666";
        line(x(prev[0]), y(prev[1]), x(p[0]), y(p[1]));
      }
      prev = p;
    }
    for (let i = i0; i < composite.length && composite[i][0] <= t1; i++) {
      const p = composite[i];
      context.fillStyle = CORE_COLORS[coreNames[p[3]]] ?? "#666";
      context.beginPath();
      context.arc(x(p[0]), y(p[1]), r, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawLawDome(alpha, t0, t1) {
    context.globalAlpha = alpha;
    context.strokeStyle = LAW_COLOR;
    context.lineWidth = 1.5;
    context.beginPath();
    let first = true;
    for (let i = Math.max(0, lowerBound(lawSpline, t0) - 1); i < lawSpline.length; i++) {
      const [t, v] = lawSpline[i];
      if (first) { context.moveTo(x(t), y(v)); first = false; } else context.lineTo(x(t), y(v));
      if (t > t1) break;
    }
    context.stroke();
    context.lineWidth = 1;
    context.fillStyle = LAW_COLOR;
    for (let i = lowerBound(lawSamples, t0); i < lawSamples.length && lawSamples[i][0] <= t1; i++) {
      const [t, v, err] = lawSamples[i];
      if (err > 0) line(x(t), y(v - err), x(t), y(v + err));
      context.beginPath();
      context.arc(x(t), y(v), dotR - 1.5, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawSiple(alpha, t0, t1) {
    context.globalAlpha = alpha;
    context.strokeStyle = SIPLE_COLOR;
    context.fillStyle = SIPLE_COLOR;
    context.lineWidth = 1;
    for (let i = lowerBound(siple, t0); i < siple.length && siple[i][0] <= t1; i++) {
      const [t, v, lo, hi] = siple[i];
      if (lo !== null) line(x(lo), y(v), x(hi), y(v));   // the air-enclosure date range
      context.beginPath();
      context.arc(x(t), y(v), dotR - 1, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // Lists the records on screen, top left, where the rising curve leaves room.
  function legendItems(a, t0, t1) {
    const items = [];
    if (a.weekly > 0.02 || a.monthly > 0.02) items.push(["Mauna Loa", MLO_COLOR]);
    if (a.monthly > 0.02) items.push(["South Pole", SPO_COLOR]);
    if (a.law > 0.02) items.push(["Law Dome", LAW_COLOR]);
    if (a.siple > 0.02) items.push(["Siple Station", SIPLE_COLOR]);
    if (a.composite > 0.02) {
      const seen = new Set();
      for (let i = lowerBound(composite, t0); i < composite.length && composite[i][0] <= t1; i++) seen.add(composite[i][3]);
      for (const k of [...seen].sort((p, q) => p - q)) {
        const name = coreNames[k];
        if (name === "Law Dome" && a.law > 0.02) continue;
        items.push([name, CORE_COLORS[name] ?? "#666"]);
      }
    }
    return items;
  }

  function drawLegend(a, t0, t1) {
    const items = legendItems(a, t0, t1);
    context.font = noteFont;
    context.textAlign = "left"; context.textBaseline = "middle";
    items.forEach(([name, color], i) => {
      const ly = PLOT_T + 12 + i * 15;
      context.fillStyle = color;
      context.fillRect(plotL + 8, ly - 4, 10, 8);
      context.fillStyle = "#333";
      haloText(name, plotL + 23, ly);
    });
  }

  // ---- ticks and formatting -------------------------------------------------------------------
  // Round steps for a CO₂ axis: as many gridlines as the height allows at ~45 px apart.
  function yTicks(lo, hi, height) {
    const target = Math.max(2, Math.floor(height / 45));
    const raw = (hi - lo) / target;
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  }

  // Time ticks follow the span: months across a few years, calendar years back to a few
  // thousand years, then "years ago" once the calendar stops meaning much.
  function xTicks() {
    const innerW = plotR - plotL;
    const t0 = tStart();
    const out = [];
    if (look <= 3) {
      // Month ticks, labelled with the month name, the year on January.
      const step = look <= 1.5 ? 1 : look <= 2.5 ? 2 : 3;
      const m0 = Math.ceil(t0 * 12);
      for (let m = m0; m / 12 <= tEnd + look * 0.02; m++) {
        if (m % step) continue;
        const t = m / 12, month = ((m % 12) + 12) % 12, year = Math.floor(t + 1e-9);
        out.push({t, label: month === 0 ? `${year}` : MONTHS[month]});
      }
      return out;
    }
    if (look <= 12000) {
      // Calendar years, negative ones as BCE.
      const step = niceStep(look, innerW, 62);
      for (let yr = Math.ceil(t0 / step) * step; yr <= tEnd + look * 0.02; yr += step) {
        out.push({t: yr, label: yr > 0 ? `${yr}` : yr === 0 ? "1 BCE" : `${-yr} BCE`});
      }
      return out;
    }
    // Years ago, counted from the end of the record, in round thousands.
    const step = niceStep(look, innerW, 110);
    for (let ago = 0; ago <= look; ago += step) {
      const t = tEnd - ago;
      if (t < t0) break;
      out.push({t, label: ago === 0 ? "now" : `${formatInt(ago)} years ago`});
    }
    return out;
  }

  // A 1-2-5 step in years such that labels sit at least `px` apart.
  function niceStep(span, innerW, px) {
    const maxTicks = Math.max(2, Math.floor(innerW / px));
    const raw = span / maxTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    for (const m of [1, 2, 5, 10]) if (m * mag >= raw) return m * mag;
    return 10 * mag;
  }

  function formatLook(l) {
    if (l < 1.5) return "1 year";
    if (l < 100) return `${Math.round(l)} years`;
    return `${formatInt(Number(l.toPrecision(l < 1000 ? 2 : 3)))} years`;
  }

  // How the read-out names a time: by month wherever there are monthly data, otherwise by
  // calendar year or, for the ice cores, years ago.
  function formatTime(t) {
    if (t >= tFirstObs - 1) return `${MONTHS_LONG[Math.min(11, Math.floor((t - Math.floor(t)) * 12))]} ${Math.floor(t)}`;
    if (look <= 12000) {
      const yr = Math.round(t);
      return yr > 0 ? `${yr}` : yr === 0 ? "1 BCE" : `${formatInt(-yr)} BCE`;
    }
    return `about ${formatInt(Number((tEnd - t).toPrecision(3)))} years ago`;
  }

  // ---- status line ----------------------------------------------------------------------------
  function updateStatus() {
    const t = hoverT ?? latest[0];
    const parts = [];
    if (t >= tFirstObs - 1) {
      const mlo = seriesAt(mloMonthly, t), spo = seriesAt(spoMonthly, t);
      if (mlo) parts.push(`Mauna Loa ${mlo[1].toFixed(1)} ppm`);
      if (spo) parts.push(`South Pole ${spo[1].toFixed(1)} ppm`);
    }
    if (!parts.length) {
      // Nearest ice-core value to the hovered time, from the composite or Law Dome.
      const pts = look > 3000 ? composite : lawSamples.length ? lawSamples : composite;
      const i = lowerBound(pts, t);
      const p = [pts[i - 1], pts[i]].filter(Boolean).sort((u, v) => Math.abs(u[0] - t) - Math.abs(v[0] - t))[0];
      if (p) {
        const src = pts === composite ? coreNames[p[3]] : "Law Dome";
        status.textContent = `${capitalise(formatTime(p[0]))}: ${Math.round(p[1])} ppm (${src} ice core)`;
      } else status.textContent = "";
      return;
    }
    status.textContent = `${capitalise(formatTime(t))}: ${parts.join(", ")}.`;
  }

  function updateButtons() {
    for (const b of presetButtons) {
      const on = Math.abs(Math.log(b.preset.look / look)) < 0.02;
      b.el.style.borderColor = on ? ACCENT : "#ccc";
      b.el.style.color = on ? ACCENT : "#333";
      b.el.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.el.setAttribute("aria-pressed", on);
    }
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }

  // ---- state changes --------------------------------------------------------------------------
  function setLook(l) {
    look = clamp(l, LOOK_MIN, LOOK_MAX);
    slider.value = lookToSlider(look);
    sliderOut.textContent = formatLook(look);
    [yTargetLo, yTargetHi] = targetRange();
    requestRender();
  }

  // Glides the look-back span to a target, in log space, over about a second.
  let glideFrame = null;
  function glideLook(target, duration = 900, done) {
    cancelAnimationFrame(glideFrame);
    if (reduceMotion || duration === 0) { setLook(target); emit(); done?.(); return; }
    const l0 = Math.log(look), l1 = Math.log(clamp(target, LOOK_MIN, LOOK_MAX)), start = performance.now();
    const step = now => {
      const k = Math.min(1, (now - start) / duration);
      setLook(Math.exp(l0 + (l1 - l0) * easeInOut(k)));
      if (k < 1) glideFrame = requestAnimationFrame(step);
      else { glideFrame = null; emit(); done?.(); }
    };
    glideFrame = requestAnimationFrame(step);
  }

  // ---- pointer --------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (TOTAL_H / r.height)};
  }

  // Hovering reads the record under the cursor; it does not interrupt the tour, a click does.
  canvas.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (touring) { canvas.style.cursor = "pointer"; return; }
    const over = py >= PLOT_T && py <= PLOT_B + 24 && px >= plotL - 4 && px <= plotR + 4;
    hoverT = over ? clamp(x.invert(px), tOldest, tEnd) : null;
    canvas.style.cursor = over ? "crosshair" : "default";
    requestRender();
  });
  canvas.addEventListener("pointerleave", () => {
    hoverT = null;
    requestRender();
  });
  canvas.addEventListener("pointerdown", () => stopTour());

  // ---- tour -----------------------------------------------------------------------------------
  // The video's zoom out, paced by the milestones: from the last five years, the chart widens
  // to show each landmark in turn, resting long enough to read it, until the whole 800,000
  // years are on screen. One way, then it stops; any click or drag ends it early.
  const TOUR_HOLD = 3200;
  const TOUR_GLIDE = 1600;
  // Milestones close in age share a stop, so the tour does not pause twice on one view.
  const tourStops = [5, ...milestones.map(m => m.age * 2.5).filter(l => l < LOOK_MAX / 1.5), LOOK_MAX]
    .filter((l, i, arr) => i === 0 || l > arr[i - 1] * 1.5 || i === arr.length - 1);
  let touring = false, tourTimer = null, tourWatcher = null;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    hint.textContent = HINT_IDLE;
    requestRender();
  }

  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
    hint.textContent = HINT_TOUR;
    requestRender();
    tourTimer = setTimeout(() => zoomStep(0), delay);
  }

  function zoomStep(i) {
    if (!touring) return;
    if (container.isConnected === false) return stopTour();
    if (i >= tourStops.length) return stopTour();
    glideLook(tourStops[i], TOUR_GLIDE, () => {
      if (!touring) return;
      tourTimer = setTimeout(() => zoomStep(i + 1), TOUR_HOLD);
    });
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    return {lookBack: look, from: tStart(), to: tEnd};
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- go -------------------------------------------------------------------------------------
  setLook(look);
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); requestRender(); }
    });
    ro.observe(container);
  }

  // Not under reduced motion, and not before the figure has scrolled into view.
  if (!reduceMotion && typeof requestAnimationFrame === "function") {
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

  // ---- canvas helpers (closures over `context`) -----------------------------------------------
  function line(x0, y0, x1, y1) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  }

  // Text with a white halo, for labels that sit on top of the data. Uses the current font,
  // alignment, fill and alpha; the stroke settings are restored afterwards.
  function haloText(text, tx, ty) {
    const {strokeStyle, lineWidth, lineJoin} = context;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 3.5;
    context.lineJoin = "round";
    context.strokeText(text, tx, ty);
    context.fillText(text, tx, ty);
    context.strokeStyle = strokeStyle; context.lineWidth = lineWidth; context.lineJoin = lineJoin;
  }
}

// ---- helpers ------------------------------------------------------------------------------------

// First index whose time is >= t, in an array of [t, ...] rows sorted by t.
function lowerBound(pts, t) {
  let lo = 0, hi = pts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function monthName(t) {
  return MONTHS[Math.min(11, Math.floor((t - Math.floor(t)) * 12))];
}

function formatInt(n) {
  return Math.round(n).toLocaleString("en-US");
}

function capitalise(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function smooth(k) {
  const s = clamp(k, 0, 1);
  return s * s * (3 - 2 * s);
}

function easeInOut(k) {
  return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
