// Global temperature across every scale we have estimated it on, after Glen Fergus's figure
// "All palaeotemps" (https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg): the
// Berkeley Earth instrumental record, the Holocene stack of Marcott et al., the Greenland and
// Antarctic ice cores, the benthic stacks of Lisiecki and Raymo and of Zachos et al. read
// through Hansen et al., and Royer et al.'s Phanerozoic curves. One chart, one time axis that
// always ends at the thermometer record's latest month, and a "look back" slider under that
// axis that stretches it from a decade to 540 million years, so the reader zooms out from
// the last few years to the Cambrian in one motion. The Play tour does that zoom by itself,
// pausing at each of the figure's own landmarks (Holocene, YD, LGM, Eemian, ...), and stops
// at the end. Along the top run the geological periods, abbreviated as in the figure where
// they are narrow; hovering a period or a landmark spells it out, and clicking opens its
// Wikipedia page. The figure's own page on Commons explains the records and how they were
// scaled; this widget just plots them as the data file holds them.
//
// Same bones as the co2-history widget, and self-contained on purpose: no d3, no other
// imports, so the script-tag embed is a single ES module import. The data file is built by
// scripts/temperature-history.py; see its header for the layout.

const ACCENT = "#0b57d0";
// The figure's own colours, more or less.
const COLORS = {
  geocarb: "#e02020",
  proxies: "#222",
  band: "#ffc000",
  zachos: "#222",
  lr: "#6a51a3",
  epica: "#3333ff",
  ngrip: "#00b050",
  marcott: "#3d96ae",
  berkeley: "#e02020",
  berkeleyDecadal: "#a01010",
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH
// it stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Vertical layout is fixed so embed iframe heights stay put: the period band along the top,
// then the plot.
const BAND_T = 4, BAND_H = 18;
const PLOT_T = BAND_T + BAND_H + 6, PLOT_H = 302;
const PLOT_B = PLOT_T + PLOT_H;
const TOTAL_H = PLOT_B + 32;

const LOOK_MIN = 10;                 // years; the shortest window
const WIKI = "https://en.wikipedia.org/wiki/";
const COMMONS = "https://commons.wikimedia.org/wiki/File:All_palaeotemps.svg";

// The geological periods and epochs along the top of the figure, with the abbreviations it
// uses, their starts in years ago (ICS chart, 2023), and their Wikipedia pages.
const PERIODS = [
  {abbr: "Cm", name: "Cambrian", start: 538.8e6, page: "Cambrian"},
  {abbr: "O", name: "Ordovician", start: 486.85e6, page: "Ordovician"},
  {abbr: "S", name: "Silurian", start: 443.1e6, page: "Silurian"},
  {abbr: "D", name: "Devonian", start: 419.62e6, page: "Devonian"},
  {abbr: "C", name: "Carboniferous", start: 358.86e6, page: "Carboniferous"},
  {abbr: "P", name: "Permian", start: 298.9e6, page: "Permian"},
  {abbr: "Tr", name: "Triassic", start: 251.9e6, page: "Triassic"},
  {abbr: "J", name: "Jurassic", start: 201.4e6, page: "Jurassic"},
  {abbr: "K", name: "Cretaceous", start: 143.1e6, page: "Cretaceous"},
  {abbr: "Pal", name: "Paleocene", start: 66.0e6, page: "Paleocene"},
  {abbr: "Eocene", name: "Eocene", start: 56.0e6, page: "Eocene"},
  {abbr: "Ol", name: "Oligocene", start: 33.9e6, page: "Oligocene"},
  {abbr: "Miocene", name: "Miocene", start: 23.04e6, page: "Miocene"},
  {abbr: "Pliocene", name: "Pliocene", start: 5.333e6, page: "Pliocene"},
  {abbr: "Pleistocene", name: "Pleistocene", start: 2.58e6, page: "Pleistocene"},
  {abbr: "Holocene", name: "Holocene", start: 11700, page: "Holocene"},
];

// The figure's in-axis labels, as landmarks: a few words above the curve with a thin line
// down to the record's temperature at that moment. Ages are years before the present of the
// figure; each label anchors to one record, at the extreme of that record over a window
// around the age (the spike of the PETM, the bottom of the last ice age), or simply at the
// age. A label shows only while its event sits comfortably inside the window (not crammed
// against the right edge, not about to fall off the left), and the tour rests at each.
const LANDMARKS = [
  {abbr: "Holocene", name: "Holocene", page: "Holocene",
    age: 6000, series: "marcott", pick: "at"},
  {abbr: "YD", name: "Younger Dryas", page: "Younger_Dryas",
    age: 12300, series: "ngrip", pick: "min", window: [11700, 12900]},
  {abbr: "LGM", name: "Last Glacial Maximum", page: "Last_Glacial_Maximum",
    age: 21000, series: "epica", pick: "min", window: [19000, 26500]},
  {abbr: "Eemian", name: "Eemian, the last interglacial", page: "Eemian",
    age: 125000, series: "epica", pick: "max", window: [115000, 132000]},
  {abbr: "Early Eocene", name: "Early Eocene Climatic Optimum", page: "Early_Eocene_Climatic_Optimum",
    age: 51e6, series: "zachos", pick: "max", window: [49e6, 53e6]},
  {abbr: "PETM", name: "Paleocene–Eocene Thermal Maximum", page: "Paleocene%E2%80%93Eocene_Thermal_Maximum",
    age: 55.8e6, series: "zachos", pick: "max", window: [55.5e6, 56.3e6]},
  {abbr: "K-T", name: "Cretaceous–Paleogene (K-T) boundary", page: "Cretaceous%E2%80%93Paleogene_boundary",
    age: 66e6, series: "geocarb", pick: "at"},
  {abbr: "Permian", name: "Permian: the late Palaeozoic ice age", page: "Late_Paleozoic_icehouse",
    age: 300e6, series: "geocarb", pick: "min", window: [270e6, 330e6]},
];

export function createTemperatureHistoryWidget({data, width = FIGURE_WIDTH, lookBack = null}) {
  // ---- data -----------------------------------------------------------------------------------
  // Every series becomes [[yearCE, value, ...], ...] ascending in time. Ages in the file are
  // thousands of years before the figure's present.
  const present = data.present ?? 2015;
  const fromAges = rows => rows.map(([age, ...rest]) => [present - age * 1000, ...rest]).reverse();
  const zachos = fromAges(data.zachos);
  const lr = fromAges(data.lisieckiRaymo);
  const epica = fromAges(data.epica);
  const ngrip = fromAges(data.ngrip);
  const marcott = fromAges(data.marcott);                  // [t, T, sigma]
  const royer = fromAges(data.royer.rows);                 // [t, geocarb, proxies, lo, hi], nulls allowed
  const geocarb = royer.filter(r => r[1] !== null).map(r => [r[0], r[1]]);
  const proxies = royer.filter(r => r[2] !== null).map(r => [r[0], r[2]]);
  // The thermometer record: Berkeley Earth's monthly anomalies, which are against 1951–1980,
  // moved onto the figure's 1960–1990 baseline by the record's own mean over those years;
  // then the complete years' means, and the complete decades', the latter at the decade's
  // middle as the figure had them (1855 for the 1850s).
  const raw = unpackMonthly(data.berkeley);
  const shift = mean(raw.filter(([t]) => t >= 1960 && t < 1991).map(p => p[1]));
  const monthly = raw.map(([t, v]) => [t, v - shift]);
  const annual = periodMeans(monthly, 1);
  const decadal = periodMeans(monthly, 10);
  const berkeley = annual;
  const series = {zachos, lr, epica, ngrip, marcott, geocarb, proxies, berkeley};

  const tEnd = monthly[monthly.length - 1][0];
  // Wide enough for the start of the Cambrian to clear the left edge.
  const LOOK_MAX = Math.ceil((tEnd - (present - PERIODS[0].start)) * 1.01 / 1e6) * 1e6;
  const periods = PERIODS.map((p, i) => ({
    ...p, t0: present - p.start, t1: i + 1 < PERIODS.length ? present - PERIODS[i + 1].start : Infinity,
  }));
  // The landmarks' ages, youngest first, each with the point it anchors to and a fixed tier.
  const landmarks = LANDMARKS.map(m => ({...m, t: present - m.age, ...anchorPoint(m)}))
    .filter(m => m.age > 0 && m.age < LOOK_MAX)
    .sort((a, b) => a.age - b.age).map((m, i) => ({...m, tier: 1 + (i % 3)}));
  const landmarkAlpha = m => fadeIn(m.age * 1.02, m.age * 1.06) * fadeOut(m.age * 5, m.age * 8);
  const latest = monthly[monthly.length - 1];
  const latestLabel = `${monthName(latest[0])} ${Math.floor(latest[0])}: ${formatTemp(latest[1])}`;

  // The record's point a landmark hangs its leader on.
  function anchorPoint(m) {
    const pts = series[m.series];
    if (!pts?.length) return {pt: null, px: present - m.age, pv: 0};
    if (m.pick === "at") return {px: present - m.age, pv: interpAt(pts, present - m.age)};
    const [a0, a1] = m.window;
    let best = null;
    for (let i = lowerBound(pts, present - a1); i < pts.length && pts[i][0] <= present - a0; i++) {
      const p = pts[i];
      if (!best || (m.pick === "max" ? p[1] > best[1] : p[1] < best[1])) best = p;
    }
    best ??= [present - m.age, interpAt(pts, present - m.age)];
    return {px: best[0], pv: best[1]};
  }

  // ---- state ----------------------------------------------------------------------------------
  const DEFAULT_LOOK = 20000;         // the figure's last panel: the last ice age to now
  let look = clamp(lookBack ?? DEFAULT_LOOK, LOOK_MIN, LOOK_MAX);   // years shown, ending at tEnd
  let yLo = 0, yHi = 1, yTargetLo = 0, yTargetHi = 1, ySnap = true;   // y range, animated

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // Labels that can be hovered and clicked (the periods along the top, the landmarks) are
  // real links laid over the canvas, so they get a tooltip with the full name, a pointer
  // cursor, keyboard focus and a new tab, with no hit-testing of our own.
  const style = document.createElement("style");
  style.textContent = `
.th-overlay{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;}
.th-label{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;white-space:nowrap;
  text-decoration:none;color:#444;font:12px sans-serif;line-height:16px;padding:0 3px;border-radius:3px;}
.th-mark{background:rgba(255,255,255,0.85);}
.th-band{transform:none;padding:0;border-radius:0;color:#333;text-align:center;
  line-height:${BAND_H}px;overflow:visible;}
.th-label:hover,.th-label:focus-visible{color:${ACCENT};text-decoration:underline;outline:none;}
.th-label::after{content:attr(data-full);position:absolute;left:50%;top:calc(100% + 4px);
  transform:translateX(-50%);background:#333;color:#fff;font:12px sans-serif;line-height:16px;
  padding:3px 8px;border-radius:4px;white-space:nowrap;opacity:0;pointer-events:none;
  transition:opacity .12s;z-index:2;}
.th-mark::after{top:auto;bottom:calc(100% + 4px);}
.th-left::after{left:0;transform:none;}
.th-right::after{left:auto;right:0;transform:none;}
.th-label:hover::after,.th-label:focus-visible::after{opacity:1;}`;
  container.appendChild(style);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;touch-action:pan-y;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Global temperature against time");
  const context = canvas.getContext("2d");
  const overlay = document.createElement("div");
  overlay.className = "th-overlay";
  const stage = document.createElement("div");
  stage.style.cssText = "position:relative;";
  stage.append(canvas, overlay);
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(stage);
  container.appendChild(scroller);

  // The look-back slider sits under the time axis, its track exactly as wide as the axis
  // (laid out in applyLayout). It is logarithmic, the whole record at the left end and a
  // century at the right, so pulling it left goes back in time, the way the axis does.
  const SLIDER_STEPS = 1000;
  const sliderRow = document.createElement("div");
  sliderRow.style.cssText = "position:relative;height:24px;margin:2px 0 6px;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 0;
  slider.max = SLIDER_STEPS;
  slider.step = 1;
  slider.style.cssText = `position:absolute;top:0;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", "How far back in time the chart looks; left is further back");
  sliderRow.appendChild(slider);
  slider.addEventListener("input", e => {
    e.stopPropagation();
    stopTour();
    setLook(sliderToLook(Number(slider.value)));
    emit();
  });
  container.appendChild(sliderRow);

  // Under the slider: the Play tour button at the left, the credit at the right. The axis
  // says what the slider did.
  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;";
  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  const credit = document.createElement("span");
  credit.style.cssText = "font:12px sans-serif;color:#666;";
  credit.innerHTML = `After <a href="${COMMONS}" target="_blank" rel="noopener" ` +
    `style="color:${ACCENT};text-decoration:none;"><i>All palaeotemps</i></a> by Glen Fergus (CC BY-SA 3.0)`;
  footer.append(tourButton, credit);
  container.appendChild(footer);

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, marginL, marginR, plotL, plotR;
  let tickFont, noteFont, labelFont, dotR;
  const LABEL_FONT = "12px sans-serif";   // the overlay links, in CSS above

  function applyLayout(newW) {
    w = newW;
    const k = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * k);
    marginL = lerp(50, 58);   // tick labels, and the axis title left of them
    marginR = lerp(12, 20);
    plotL = marginL;
    plotR = w - marginR;
    // The thumb's centre reaches half a thumb short of the track's ends, so the track
    // overhangs the axis by that much on each side.
    slider.style.left = `${plotL - 8}px`;
    slider.style.width = `${plotR - plotL + 16}px`;
    tickFont = `${lerp(12, 14)}px sans-serif`;
    noteFont = `${lerp(11, 13)}px sans-serif`;
    labelFont = `bold ${lerp(12, 14)}px sans-serif`;
    dotR = lerp(3, 4);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = TOTAL_H * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = TOTAL_H + "px";
    overlay.style.width = w + "px";
    overlay.style.height = TOTAL_H + "px";
    context.scale(dpr, dpr);
  }
  applyLayout(maxW);

  // ---- scales ---------------------------------------------------------------------------------
  const tStart = () => tEnd - look;
  const x = t => plotL + ((t - tStart()) / look) * (plotR - plotL);
  const y = v => PLOT_B - ((v - yLo) / (yHi - yLo)) * PLOT_H;

  function sliderToLook(s) {
    return LOOK_MAX * Math.pow(LOOK_MIN / LOOK_MAX, s / SLIDER_STEPS);
  }
  function lookToSlider(l) {
    return Math.round(SLIDER_STEPS * Math.log(l / LOOK_MAX) / Math.log(LOOK_MIN / LOOK_MAX));
  }

  // Which records are drawn depends on how far back the chart looks: each fades in and out
  // over a band of look-back spans (in log space), so zooming never pops a layer on or off.
  // The order follows the figure's panels: each record shows at the scales its panel covers,
  // and a little beyond. The proxy records also stay out of the thermometer's own window,
  // where their youngest, least settled samples would only add noise.
  function fadeIn(a, b) { return smooth((Math.log(look) - Math.log(a)) / (Math.log(b) - Math.log(a))); }
  function fadeOut(a, b) { return 1 - fadeIn(a, b); }
  const alphas = () => ({
    monthly: fadeOut(40, 120),
    annual: fadeIn(25, 60) * fadeOut(1500, 5000),
    decadal: fadeIn(250, 700) * fadeOut(30000, 100000),
    marcott: fadeIn(400, 1200) * fadeOut(300000, 1e6),
    ngrip: fadeIn(800, 2500) * fadeOut(2e6, 6e6),
    epica: fadeIn(800, 2500) * fadeOut(10e6, 30e6),
    lr: fadeIn(20000, 50000) * fadeOut(100e6, 300e6),
    zachos: fadeIn(2e6, 6e6) * fadeOut(250e6, 450e6),
    royer: fadeIn(60e6, 150e6),
  });

  // ---- y ranges -------------------------------------------------------------------------------
  // The main chart's range follows the visible data: the min and max of every record that is
  // drawn, over the window.
  function targetRange() {
    const a = alphas();
    const t0 = tStart(), t1 = tEnd + look * 0.02;
    let lo = Infinity, hi = -Infinity;
    const take = v => { if (v < lo) lo = v; if (v > hi) hi = v; };
    const scan = (pts, alpha, cols = [1]) => {
      if (alpha <= 0.02) return;
      for (let i = Math.max(0, lowerBound(pts, t0) - 1); i < pts.length && (i === 0 || pts[i - 1][0] <= t1); i++) {
        for (const c of cols) if (pts[i][c] !== null && pts[i][c] !== undefined) take(pts[i][c]);
      }
    };
    scan(monthly, a.monthly);
    scan(annual, a.annual);
    scan(decadal, a.decadal);
    scan(marcott, a.marcott);
    scan(ngrip, a.ngrip);
    scan(epica, a.epica);
    scan(lr, a.lr);
    scan(zachos, a.zachos);
    scan(royer, a.royer, [1, 2, 3, 4]);
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    take(0);   // the 1960–1990 baseline is always in view
    const pad = Math.max(0.2, (hi - lo) * 0.08);
    return [lo - pad, hi + pad * 1.6];   // extra room above for the labels
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
    if (Math.abs(yTargetLo - yLo) + Math.abs(yTargetHi - yHi) >= 0.005) requestRender();
    else { yLo = yTargetLo; yHi = yTargetHi; lastFrame = 0; }
  }

  function render() {
    context.clearRect(0, 0, w, TOTAL_H);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, TOTAL_H);
    const shown = new Set();
    drawChart(shown);
    pruneLabels(shown);
    updateTourButton();
  }

  function drawChart(shown) {
    const a = alphas();
    const t0 = tStart(), t1 = tEnd + look * 0.02;

    // Gridlines and axes.
    const yt = yTicks(yLo, yHi, PLOT_H);
    const xt = xTicks();
    context.lineWidth = 1;
    for (const v of yt) {
      context.strokeStyle = v === 0 ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.1)";
      line(plotL, y(v), plotR, y(v));
    }
    context.strokeStyle = "rgba(0,0,0,0.1)";
    for (const tk of xt) line(x(tk.t), PLOT_T, x(tk.t), PLOT_B);

    drawPeriods(shown);

    context.save();
    context.beginPath();
    context.rect(plotL, PLOT_T - 1, plotR - plotL, PLOT_H + 2);
    context.clip();

    // Oldest records first so the modern ones sit on top.
    if (a.royer > 0.02) drawRoyer(a.royer, t0, t1);
    if (a.zachos > 0.02) strokeSeries(zachos, t0, t1, COLORS.zachos, 0.8, a.zachos);
    if (a.lr > 0.02) strokeSeries(lr, t0, t1, COLORS.lr, 1.2, a.lr);
    if (a.epica > 0.02) strokeSeries(epica, t0, t1, COLORS.epica, 1.2, a.epica);
    if (a.ngrip > 0.02) strokeSeries(ngrip, t0, t1, COLORS.ngrip, 1.2, a.ngrip);
    if (a.marcott > 0.02) drawMarcott(a.marcott, t0, t1);
    if (a.decadal > 0.02) strokeSeries(decadal, t0, t1, COLORS.berkeleyDecadal, 2, a.decadal);
    if (a.annual > 0.02) strokeSeries(annual, t0, t1, COLORS.berkeley, 1.5, a.annual);
    if (a.monthly > 0.02) drawMonthly(a.monthly, t0, t1);

    // Latest month, labelled at the end of the record.
    if (Math.max(a.monthly, a.annual) > 0.02) {
      context.globalAlpha = Math.max(a.monthly, a.annual);
      context.font = labelFont;
      context.fillStyle = COLORS.berkeley;
      context.textAlign = "right"; context.textBaseline = "bottom";
      const endX = x(latest[0]), endY = y(latest[1]);
      context.beginPath();
      context.arc(endX, endY, dotR, 0, 2 * Math.PI);
      context.fill();
      haloText(latestLabel, Math.min(plotR - 4, endX + 4), endY - dotR - 3);
      context.globalAlpha = 1;
    }

    drawLandmarks(shown);
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
      context.fillText(formatTick(v), plotL - 7, y(v));
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (const tk of xt) {
      line(x(tk.t), PLOT_B, x(tk.t), PLOT_B + 5);
      const half = context.measureText(tk.label).width / 2 + 2;
      context.fillText(tk.label, clamp(x(tk.t), half, w - half), PLOT_B + 8);
    }
    context.save();
    context.translate(12, PLOT_T + PLOT_H / 2);
    context.rotate(-Math.PI / 2);
    context.font = noteFont;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("°C vs 1960–1990 average", 0, 0);
    context.restore();

    drawLegend(a, t0, t1);
  }

  // The band of periods along the top: a grey bar with a separator at each boundary, and the
  // name of each period over the part of it that is on screen, spelled out if there is room,
  // abbreviated as in the figure if not, and dropped if even that will not fit. Hovering
  // spells it out in any case.
  function drawPeriods(shown) {
    const t0 = tStart();
    context.fillStyle = "#f2f2f2";
    context.fillRect(plotL, BAND_T, plotR - plotL, BAND_H);
    context.strokeStyle = "#999";
    context.lineWidth = 1;
    context.font = LABEL_FONT;
    for (const p of periods) {
      if (p.t1 < t0 || p.t0 > tEnd) continue;
      const x0 = Math.max(plotL, x(p.t0)), x1 = Math.min(plotR, x(p.t1));
      if (x(p.t0) >= plotL) line(x(p.t0) + 0.5, BAND_T, x(p.t0) + 0.5, BAND_T + BAND_H);
      const room = x1 - x0 - 6;
      const text = context.measureText(p.name).width <= room ? p.name
        : context.measureText(p.abbr).width <= room ? p.abbr : "";
      // The link covers the whole visible segment, so a period too narrow for even its
      // abbreviation can still be hovered and clicked.
      placeLabel(`period:${p.abbr}`, {text, full: p.name, page: p.page, cls: "th-band",
        lx: (x0 + x1) / 2, ly: BAND_T + BAND_H / 2, alpha: 1, box: [x0, BAND_T, x1 - x0, BAND_H]}, shown);
    }
    line(plotL, BAND_T + BAND_H + 0.5, plotR, BAND_T + BAND_H + 0.5);
  }

  // Short labels a little above the curve, each with a leader line down to the record's
  // value at that moment, so the eye need not travel to the top of the plot. Each label has
  // a fixed tier, one, two or three tenths of the plot's height above its point, cycling in
  // order of age, so that neighbours in time, the ones that come close on screen, never
  // share a height, and a label's position never jumps as the window widens: it only
  // follows its own point.
  function drawLandmarks(shown) {
    const up = landmarks.map(m => ({m, alpha: landmarkAlpha(m), mx: x(m.px)})).filter(d => d.alpha > 0.02);
    if (!up.length) return;
    context.font = LABEL_FONT;
    const H = 8;   // half the label's height
    for (const d of up) {
      d.py = y(d.m.pv);
      const half = context.measureText(d.m.abbr).width / 2 + 4;
      d.lx = clamp(d.mx, plotL + half, plotR - half);
      // Above its point, or below it when the point sits too near the top for its tier, so
      // that two peaks' labels never pile up against the top edge.
      const lift = d.m.tier * PLOT_H / 10;
      d.below = d.py - lift < PLOT_T + H + 2;
      d.ly = d.below ? Math.min(d.py + lift, PLOT_B - H) : d.py - lift;
    }
    for (const d of up) {
      context.globalAlpha = d.alpha;
      context.strokeStyle = "rgba(0,0,0,0.35)";
      context.lineWidth = 1;
      if (d.below) line(d.mx, d.py + 3, d.mx, d.ly - H - 1);
      else line(d.mx, d.ly + H + 1, d.mx, d.py - 3);
    }
    context.globalAlpha = 1;
    for (const d of up) {
      placeLabel(`mark:${d.m.abbr}`, {text: d.m.abbr, full: d.m.name, page: d.m.page, cls: "th-mark",
        lx: d.lx, ly: d.ly, alpha: d.alpha}, shown);
    }
  }

  // The overlay links, one per label on screen, reused across frames by key.
  const labels = new Map();
  function placeLabel(key, {text, full, page, cls, lx, ly, alpha, box}, shown) {
    let el = labels.get(key);
    if (!el) {
      el = document.createElement("a");
      el.target = "_blank";
      el.rel = "noopener";
      labels.set(key, el);
      overlay.appendChild(el);
    }
    el.className = `th-label ${cls} ${lx < 90 ? "th-left" : lx > w - 90 ? "th-right" : ""}`;
    el.href = WIKI + page;
    el.textContent = text;
    el.setAttribute("data-full", full);
    el.setAttribute("aria-label", full);
    if (box) {
      // A block covering a region of the canvas, its text centred.
      el.style.left = `${box[0]}px`;
      el.style.top = `${box[1]}px`;
      el.style.width = `${box[2]}px`;
      el.style.height = `${box[3]}px`;
    } else {
      el.style.left = `${lx}px`;
      el.style.top = `${ly}px`;
    }
    el.style.opacity = alpha;
    shown.add(key);
  }
  function pruneLabels(shown) {
    for (const [key, el] of labels) {
      if (shown.has(key)) continue;
      el.remove();
      labels.delete(key);
    }
  }

  function interpAt(pts, t) {
    const i = lowerBound(pts, t);
    if (i <= 0) return pts[0][1];
    if (i >= pts.length) return pts[pts.length - 1][1];
    const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
    return t1 === t0 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }

  // A line through the points of a series between t0 and t1 (plus one either side), with
  // any missing values breaking it.
  function strokeSeries(pts, t0, t1, color, lineWidth, alpha, col = 1, dash = null) {
    const i0 = Math.max(0, lowerBound(pts, t0) - 1);
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.lineJoin = "round";
    if (dash) context.setLineDash(dash);
    context.beginPath();
    let pen = false;
    for (let i = i0; i < pts.length; i++) {
      const t = pts[i][0], v = pts[i][col];
      if (v === null || v === undefined) { pen = false; }
      else if (pen) context.lineTo(x(t), y(v));
      else { context.moveTo(x(t), y(v)); pen = true; }
      if (t > t1) break;
    }
    context.stroke();
    if (dash) context.setLineDash([]);
    context.globalAlpha = 1;
    context.lineWidth = 1;
  }

  // Royer et al.: the orange band of the GEOCARB extremes under a thick red GEOCARB curve and
  // a dashed black proxy curve, as in the figure.
  function drawRoyer(alpha, t0, t1) {
    const i0 = Math.max(0, lowerBound(royer, t0) - 1);
    context.globalAlpha = alpha * 0.35;
    context.fillStyle = COLORS.band;
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        context.beginPath();
        run.forEach(([t, lo], i) => (i ? context.lineTo(x(t), y(lo)) : context.moveTo(x(t), y(lo))));
        for (let i = run.length - 1; i >= 0; i--) context.lineTo(x(run[i][0]), y(run[i][2]));
        context.closePath();
        context.fill();
      }
      run = [];
    };
    for (let i = i0; i < royer.length; i++) {
      const [t, , , lo, hi] = royer[i];
      if (lo === null || hi === null) flush(); else run.push([t, lo, hi]);
      if (t > t1) break;
    }
    flush();
    context.globalAlpha = 1;
    strokeSeries(royer, t0, t1, COLORS.geocarb, 2.5, alpha, 1);
    strokeSeries(royer, t0, t1, COLORS.proxies, 1.2, alpha, 2, [4, 4]);
  }

  // Marcott et al.: the stack with its one-sigma band.
  function drawMarcott(alpha, t0, t1) {
    const i0 = Math.max(0, lowerBound(marcott, t0) - 1);
    let i1 = i0;
    while (i1 < marcott.length - 1 && marcott[i1][0] <= t1) i1++;
    context.globalAlpha = alpha * 0.18;
    context.fillStyle = COLORS.marcott;
    context.beginPath();
    for (let i = i0; i <= i1; i++) {
      const [t, v, s] = marcott[i];
      if (i === i0) context.moveTo(x(t), y(v + s)); else context.lineTo(x(t), y(v + s));
    }
    for (let i = i1; i >= i0; i--) context.lineTo(x(marcott[i][0]), y(marcott[i][1] - marcott[i][2]));
    context.closePath();
    context.fill();
    context.globalAlpha = 1;
    strokeSeries(marcott, t0, t1, COLORS.marcott, 1.5, alpha);
  }

  // Berkeley Earth's months: a thin line, with a dot each while they are far enough apart.
  function drawMonthly(alpha, t0, t1) {
    strokeSeries(monthly, t0, t1, COLORS.berkeley, 1, alpha * 0.8);
    if (look > 25) return;
    context.globalAlpha = alpha;
    context.fillStyle = COLORS.berkeley;
    for (let i = lowerBound(monthly, t0); i < monthly.length && monthly[i][0] <= t1; i++) {
      context.beginPath();
      context.arc(x(monthly[i][0]), y(monthly[i][1]), 1.5, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // Lists the records on screen, under the period band, on whichever side the data leave
  // more room at the top: the records are warm at the left when the whole Phanerozoic is
  // on screen, and warm at the right across the last ice age.
  function legendItems(a) {
    const items = [];
    if (a.royer > 0.02) {
      items.push(["Royer et al. (2004), CO₂ from GEOCARB (×2)", COLORS.geocarb, "line"]);
      items.push(["Royer et al. (2004), CO₂ from proxies (×2)", COLORS.proxies, "dash"]);
    }
    if (a.zachos > 0.02) items.push(["Zachos et al. (2008) & Hansen et al. (2013)", COLORS.zachos, "thin"]);
    if (a.lr > 0.02) items.push(["Lisiecki & Raymo (2005) & Hansen et al. (2013)", COLORS.lr, "line"]);
    if (a.epica > 0.02) items.push(["EPICA Dome C, Antarctica (×0.5)", COLORS.epica, "line"]);
    if (a.ngrip > 0.02) items.push(["NGRIP, Greenland (×0.5)", COLORS.ngrip, "line"]);
    if (a.marcott > 0.02) items.push(["Marcott et al. (2013)", COLORS.marcott, "line"]);
    if (a.decadal > 0.02) items.push(["Berkeley Earth land-ocean, decades", COLORS.berkeleyDecadal, "line"]);
    if (a.annual > 0.02) items.push(["Berkeley Earth land-ocean, years", COLORS.berkeley, "line"]);
    if (a.monthly > 0.02) items.push(["Berkeley Earth land-ocean, months", COLORS.berkeley, "thin"]);
    return items;
  }

  function drawLegend(a, t0, t1) {
    const items = legendItems(a);
    if (!items.length) return;
    context.font = noteFont;
    const textW = Math.max(...items.map(([name]) => context.measureText(name).width));
    const boxW = textW + 24, boxH = items.length * 15 + 4;
    const right = legendOnRight(a, t0, t1, boxH);
    const lx = right ? plotR - 8 - boxW : plotL + 8;
    context.textAlign = "left"; context.textBaseline = "middle";
    items.forEach(([name, color, kind], i) => {
      const ly = PLOT_T + 12 + i * 15;
      context.strokeStyle = color;
      context.lineWidth = kind === "thin" ? 1 : 2;
      if (kind === "dash") context.setLineDash([3, 3]);
      line(lx, ly, lx + 14, ly);
      context.setLineDash([]);
      context.lineWidth = 1;
      context.fillStyle = "#333";
      haloText(name, lx + 19, ly);
    });
  }

  // True when the data under the top-left corner reach higher than under the top-right.
  function legendOnRight(a, t0, t1, boxH) {
    const split = t0 + look * 0.45;
    const yLimit = PLOT_T + boxH;
    let leftHigh = -Infinity, rightHigh = -Infinity;
    const scan = (pts, alpha) => {
      if (alpha <= 0.02) return;
      for (let i = lowerBound(pts, t0); i < pts.length && pts[i][0] <= t1; i++) {
        const v = pts[i][1];
        if (v === null) continue;
        if (pts[i][0] < split) { if (v > leftHigh) leftHigh = v; }
        else if (pts[i][0] > tEnd - look * 0.45) { if (v > rightHigh) rightHigh = v; }
      }
    };
    scan(monthly, a.monthly); scan(annual, a.annual); scan(decadal, a.decadal);
    scan(marcott, a.marcott); scan(ngrip, a.ngrip); scan(epica, a.epica);
    scan(lr, a.lr); scan(zachos, a.zachos); scan(royer, a.royer);
    // Only move if the left side would actually collide and the right side is clearer.
    return Number.isFinite(leftHigh) && y(leftHigh) < yLimit + 6 && (!Number.isFinite(rightHigh) || rightHigh < leftHigh);
  }

  // ---- ticks and formatting -------------------------------------------------------------------
  // Round steps for a temperature axis: as many gridlines as the height allows at ~45 px apart.
  function yTicks(lo, hi, height) {
    const target = Math.max(2, Math.floor(height / 45));
    const raw = (hi - lo) / target;
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10].find(s => s >= raw) ?? 10;
    const out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
    return out;
  }

  // Time ticks follow the span: calendar years back to a few thousand years, then "ago" in
  // kyr and Myr once the calendar stops meaning much.
  function xTicks() {
    const innerW = plotR - plotL;
    const t0 = tStart();
    const out = [];
    if (look <= 12000) {
      // Calendar years, negative ones as BCE.
      const step = niceStep(look, innerW, 62);
      for (let yr = Math.ceil(t0 / step) * step; yr <= tEnd + look * 0.02; yr += step) {
        out.push({t: yr, label: yr > 0 ? `${yr}` : yr === 0 ? "1 BCE" : `${-yr} BCE`});
      }
      return out;
    }
    // Years ago, counted from the end of the record, in round thousands or millions.
    const step = niceStep(look, innerW, 84);
    const unit = look >= 1e6 ? 1e6 : 1e3, suffix = unit === 1e6 ? "Myr" : "kyr";
    for (let ago = 0; ago <= look; ago += step) {
      const t = tEnd - ago;
      if (t < t0) break;
      out.push({t, label: ago === 0 ? "now" : `${formatNumber(ago / unit)} ${suffix} ago`});
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
    if (l < 1000) return `${Math.round(l)} years`;
    if (l < 1e6) return `${formatNumber(Number((l / 1e3).toPrecision(3)))} kyr`;
    return `${formatNumber(Number((l / 1e6).toPrecision(3)))} Myr`;
  }

  function updateTourButton() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }

  // ---- state changes --------------------------------------------------------------------------
  function setLook(l) {
    look = clamp(l, LOOK_MIN, LOOK_MAX);
    slider.value = lookToSlider(look);
    slider.setAttribute("aria-valuetext", `${formatLook(look)} back`);
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
  // A click or a touch on the chart ends the tour; the labels are links and look after themselves.
  canvas.addEventListener("pointerdown", () => stopTour());
  overlay.addEventListener("pointerdown", () => stopTour());

  // ---- tour -----------------------------------------------------------------------------------
  // The zoom out, paced by the landmarks: from the last fifteen years, then the whole
  // thermometer record, the chart widens to show each of the figure's landmarks in turn,
  // resting long enough to read it, until the whole Phanerozoic is on screen. One way, then
  // it stops and stays there; any click or drag ends it early. It starts by itself once,
  // when the figure first scrolls into view.
  const TOUR_HOLD = 3200;
  const TOUR_GLIDE = 1600;
  // Landmarks close in age share a stop, so the tour does not pause twice on one view.
  const tourStops = [15, 200, ...landmarks.map(m => m.age * 2.5).filter(l => l < LOOK_MAX / 1.5), LOOK_MAX]
    .filter((l, i, arr) => i === 0 || l > arr[i - 1] * 1.5 || i === arr.length - 1);
  let touring = false, tourTimer = null, tourWatcher = null;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    requestRender();
  }

  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
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

// Unpacks a monthly series {year, month, v: [...]} into [[decimalYear, value], ...], dropping
// the missing months.
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

// Means of a monthly series over calendar periods of `years` years (1 for years, 10 for
// decades), at the middle of each period, keeping only periods with every month present.
function periodMeans(monthly, years) {
  const sums = new Map();
  for (const [t, v] of monthly) {
    const k = Math.floor(Math.floor(t) / years);
    const s = sums.get(k) ?? {n: 0, sum: 0};
    s.n++; s.sum += v;
    sums.set(k, s);
  }
  return [...sums].filter(([, s]) => s.n === 12 * years)
    .map(([k, s]) => [(k + 0.5) * years, s.sum / s.n]).sort((a, b) => a[0] - b[0]);
}

function mean(values) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function monthName(t) {
  return MONTHS[Math.min(11, Math.floor((t - Math.floor(t)) * 12))];
}

// First index whose time is >= t, in an array of [t, ...] rows sorted by t.
function lowerBound(pts, t) {
  let lo = 0, hi = pts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// "+0.4 °C", "−5.3 °C".
function formatTemp(v) {
  return `${formatTick(Math.round(v * 10) / 10)} °C`;
}

// Signed, with a real minus sign, and no trailing zeros: "+5", "0", "−0.5".
function formatTick(v) {
  const s = formatNumber(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : "0";
}

function formatNumber(n) {
  return Number(n.toPrecision(6)).toLocaleString("en-US", {maximumFractionDigits: 3});
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
