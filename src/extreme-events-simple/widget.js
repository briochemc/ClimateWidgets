// Extreme events, the simple version: one distribution, with temperatures on the axis.
//
// The companion to the extreme-events widget for a first-year audience, after a lecturer
// found that one too generic. There are no tabs and no σ units: the horizontal axis is a
// day's maximum temperature in °C, the vertical axis says "how often", and the one family
// is the skewed bell (a Pearson type III, which is the normal at zero skewness), so the three
// sliders are warming in °C, the spread in °C and the skewness. The numbers are made up: a
// place whose summer days peak at 25 °C on average, 4 °C either side, which is roughly a
// Sydney or Melbourne summer (ERA5 via Open-Meteo gives Sydney 24.5 °C ± 3.2 °C with a
// skewness of +0.8 for 1961–1990, Melbourne 24.5 °C ± 5.4 °C and +0.5).
//
// The extremes are fixed temperatures rather than percentiles, because "above 35 °C" is
// something a student can feel and "beyond the 99th percentile" is not: by default, days
// above 35 °C are extreme heat (red) and days below 15 °C extreme cold (blue), each 2.5
// standard deviations from the baseline mean (0.6% of days). As in the parent widget, the
// baseline's tails are faded, what the perturbed curve adds is painted in full colour and
// what it takes away paler still, and the multiplier over a tail appears once it passes two.
//
// The distribution, its cdf, the quantile finder and the share formatter are imported from
// the parent widget, so this module is small; a relative import resolves fine on jsDelivr
// (the script-tag embed) as it does in Framework.

import {pearson3, formatShare} from "../extreme-events/widget.js";

const BACKGROUND = "#f2f2f2"; // the plate the survey widgets sit on
const RED = "#e3120b";        // extreme heat
const BLUE = "#0b57d0";       // extreme cold
const ACCENT = "#0b57d0";     // focus ring, active controls
const GRAY_CURVE = "#9a9a9a", BLACK_CURVE = "#222";
const MID_FILL = "#e3e3e3";   // under both curves between the extremes
const TINT_BASE = 0.38, TINT_LOSS = 0.16;
const LEADER_BAND = 2;        // a tail's multiplier is labelled outside [1/LEADER_BAND, LEADER_BAND]
const SKEW_MAX = 1.5;         // where a Pearson III stops being a bell (±2 is an exponential)

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// `mean` and `sd` are the baseline's, in °C; `skew0` its skewness (0 is the plain bell).
// `hot` and `cold` are the thresholds in °C. `warming` is where the warming slider starts,
// a little above zero so the red wedge is there to be seen before anything is touched.
export function createSimpleExtremesWidget({
  mean: mean0 = 25, sd: sd0 = 4, skew0 = 0, hot = 35, cold = 15, warming = 1,
  showNumbers = false, quantity = "Daily maximum temperature", width = FIGURE_WIDTH,
} = {}) {
  const uid = `extreme-events-simple-${++instances}`;

  // Vertical layout is constant; only horizontal metrics and fonts follow the width. Below
  // the axis: the °C ticks, the axis title, then the two brackets with their names under
  // them and a third line kept free for the figures in numbers mode.
  const plotT = 12, plotH = 236, plotB = plotT + plotH;
  const ticksY = plotB + 17;
  const axisTitleY = plotB + 34;
  const bracketY = plotB + 42;
  const LINE_H = 17;
  const totalH = bracketY + 6 + 15 + 2 * LINE_H + 8;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(30, 38); // room for the vertical axis and its rotated label
    plotR = w - lerp(14, 22);
    plotW = plotR - plotL;
    tickFont = lerp(11, 12);
    labelFont = lerp(12, 14);
    titleFont = lerp(14, 20);
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let shift, sd, skew;            // the black curve: warming in °C, spread in °C, skewness
  let numbers = Boolean(showNumbers);
  const ref = pearson3(mean0, sd0, skew0);
  let cur;
  const xMin = mean0 - 4.5 * sd0, xMax = mean0 + 4.5 * sd0;
  const thrHi = clamp(hot, xMin, xMax), thrLo = clamp(cold, xMin, xMax);
  const SHIFT_MIN = -0.75 * sd0, SHIFT_MAX = 1.5 * sd0;
  const SD_MIN = 0.5 * sd0, SD_MAX = 2 * sd0;

  function resetParams() {
    shift = 0; sd = sd0; skew = skew0;
  }
  function makeDistribution() {
    cur = pearson3(mean0 + shift, sd, skew);
  }
  resetParams();
  shift = clamp(Number(warming) || 0, SHIFT_MIN, SHIFT_MAX);
  makeDistribution();

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;` +
    `box-sizing:border-box;max-width:${maxW + 24}px;`;

  const title = document.createElement("div");
  title.style.cssText = "font-weight:bold;color:#111;line-height:1.2;white-space:pre-line;padding:0 0 6px;";
  title.textContent = "A little warming of the average\nmakes extreme heat much more common";
  container.appendChild(title);

  // The numbers toggle and the reset button, on one row above the sliders.
  const toolRow = document.createElement("div");
  toolRow.style.cssText =
    "display:flex;align-items:center;gap:14px;justify-content:flex-end;border-bottom:1px solid #cfcfcf;" +
    "padding:0 0 6px;font-size:13px;color:#666;";
  container.appendChild(toolRow);
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
  resetButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;";
  resetButton.addEventListener("click", () => { resetParams(); update(); });
  toolRow.append(numbersField, resetButton);

  // The three sliders, one row each: name, slider, read-out. The read-outs are always shown
  // here, because "+1.0 °C" is the number the figure is about.
  const sliderBox = document.createElement("div");
  sliderBox.style.cssText =
    "display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center;padding:8px 0 2px;font-size:13px;color:#555;";
  container.appendChild(sliderBox);

  const SLIDERS = [
    {key: "warming", name: "Warming", step: 0.1, min: SHIFT_MIN, max: SHIFT_MAX, get: () => shift, set: v => (shift = v),
      format: v => `${signed(v, 1)} °C`},
    {key: "spread", name: "Spread", step: 0.1, min: SD_MIN, max: SD_MAX, get: () => sd, set: v => (sd = v),
      format: v => `± ${v.toFixed(1)} °C`},
    {key: "skew", name: "Skewness (asymmetry)", short: "Skewness", step: 0.05, min: -SKEW_MAX, max: SKEW_MAX, get: () => skew, set: v => (skew = v),
      format: v => signed(v, 2)},
  ];
  const sliderRows = SLIDERS.map(s => {
    const name = document.createElement("label");
    name.textContent = s.name;
    name.style.cssText = "color:#333;white-space:nowrap;";
    const input = document.createElement("input");
    input.type = "range";
    input.min = s.min;
    input.max = s.max;
    input.step = s.step;
    input.style.cssText = `margin:0;width:100%;min-width:90px;accent-color:${BLACK_CURVE};cursor:pointer;`;
    input.setAttribute("aria-label", s.name);
    name.htmlFor = input.id = `${uid}-${s.key}`;
    input.addEventListener("input", e => {
      e.stopPropagation();
      s.set(Number(input.value));
      update();
    });
    const out = document.createElement("span");
    out.style.cssText = "min-width:5.5em;text-align:right;font-variant-numeric:tabular-nums;color:#333;";
    sliderBox.append(name, input, out);
    return {s, name, input, out};
  });
  function updateSliders() {
    for (const {s, name, input, out} of sliderRows) {
      // The long name squeezes the slider out at phone widths.
      name.textContent = w < 480 && s.short ? s.short : s.name;
      const v = s.get();
      if (document.activeElement !== input) input.value = clamp(v, s.min, s.max);
      out.textContent = s.format(v);
    }
  }

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "extreme-events-simple");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const note = document.createElement("div");
  note.style.cssText = "padding:10px 0 0;color:#888;font-size:14px;";
  note.textContent =
    "The gray curve is the climate before, the black curve after you move the sliders. " +
    `Days above ${fmtDeg(hot)} count as extreme heat (red) and days below ${fmtDeg(cold)} as extreme cold (blue). ` +
    "The temperatures are made up for the example.";
  container.appendChild(note);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const halo = {stroke: BACKGROUND, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

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
  // The density as points, with the support's bound (a skewed curve has one) added exactly.
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

  // ---- scaffolding, rebuilt on resize ----------------------------------------------------------
  let refCurve, curCurve, areaEls, betweenEls, clipRefArea, clipCurArea;
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
      const c = svgEl("clipPath", {id: `${uid}-${name}`}, defs);
      c.appendChild(child);
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
    refCurve = svgEl("path", {fill: "none", stroke: GRAY_CURVE, "stroke-width": 2, "stroke-linejoin": "round"}, plot);
    curCurve = svgEl("path", {fill: "none", stroke: BLACK_CURVE, "stroke-width": 2.5, "stroke-linejoin": "round"}, plot);

    // The two axes. The vertical one has no ticks, only an arrow and the word for what it
    // measures, because a probability density's numbers mean nothing to this audience.
    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#555", "stroke-width": 1.25}, svg);
    svgEl("line", {x1: plotL, x2: plotL, y1: plotB, y2: plotT + 6, stroke: "#555", "stroke-width": 1.25}, svg);
    svgEl("path", {d: `M${plotL - 4},${plotT + 10}L${plotL},${plotT + 2}L${plotL + 4},${plotT + 10}`, fill: "none", stroke: "#555", "stroke-width": 1.25}, svg);
    const yTitle = svgEl("text", {
      x: plotL - 8, y: (plotT + plotB) / 2, "text-anchor": "middle", "font-size": tickFont, fill: "#555",
      transform: `rotate(-90 ${plotL - 8} ${(plotT + plotB) / 2})`,
    }, svg);
    yTitle.textContent = "How often (frequency of days)";

    // °C ticks every 5 degrees, always shown: they are what replaces the σ scale.
    for (let t = Math.ceil(xMin / 5) * 5; t <= xMax; t += 5) {
      const x = xs(t).toFixed(1);
      svgEl("line", {x1: x, x2: x, y1: plotB, y2: plotB + 4, stroke: "#777"}, svg);
      const el = svgEl("text", {x, y: ticksY, "text-anchor": "middle", "font-size": tickFont, fill: "#555"}, svg);
      el.textContent = `${t}`;
    }
    const xTitle = svgEl("text", {x: xs((xMin + xMax) / 2).toFixed(1), y: axisTitleY, "text-anchor": "middle", "font-size": tickFont, fill: "#555"}, svg);
    xTitle.textContent = `${quantity} (°C)`;

    // Each tail: a square bracket under the axis, its name and threshold under it, and a
    // third line for its figures in numbers mode, plus a leader up to its multiplier.
    for (const [side, colour] of [["lo", BLUE], ["hi", RED]]) {
      const hi = side === "hi";
      const g = svgEl("g", {}, svg);
      const x1 = hi ? xs(thrHi) : plotL, x2 = hi ? plotR : xs(thrLo);
      const t = {
        lines: [],
        leader: svgEl("line", {stroke: colour, "stroke-width": 1.25}, g),
        leaderLabel: svgEl("text", {"text-anchor": "middle", "font-size": labelFont, "font-weight": "bold", fill: colour, ...halo}, g),
      };
      svgEl("path", {
        d: `M${x1.toFixed(1)},${bracketY}L${x1.toFixed(1)},${bracketY + 6}L${x2.toFixed(1)},${bracketY + 6}L${x2.toFixed(1)},${bracketY}`,
        fill: "none", stroke: "#000", "stroke-width": 1.5,
      }, g);
      // The label lines are centred on the bracket; a line only moves off centre when it
      // would otherwise run past the edge of the figure.
      t.cx = (x1 + x2) / 2;
      tails[side] = t;
      const lines = [hi ? "extreme heat" : "extreme cold", hi ? `above ${fmtDeg(hot)}` : `below ${fmtDeg(cold)}`, ""];
      lines.forEach((text, i) => {
        const el = svgEl("text", {
          y: bracketY + 6 + 15 + i * LINE_H, "text-anchor": "middle", "font-size": labelFont,
          fill: i === 0 ? colour : "#555", "font-weight": i === 0 ? "bold" : "normal", ...halo,
        }, g);
        t.lines.push(el);
        fitLine(side, i, text);
      });
    }

    refLabel = svgEl("text", {"font-size": labelFont, fill: GRAY_CURVE, ...halo}, svg);
    curLabel = svgEl("text", {"font-size": labelFont, "font-weight": "bold", fill: BLACK_CURVE, ...halo}, svg);
    refLabel.textContent = "before";
    curLabel.textContent = "after";

    render();
  }

  // ---- per-frame drawing ----------------------------------------------------------------------
  function render() {
    const refPts = curvePoints(ref), curPts = curvePoints(cur);
    const peak = pts => pts.reduce((m, [, v]) => Math.max(m, Math.min(v, 1e3)), 0);
    const refPeak = peak(refPts);
    // Twice the baseline peak, stretched only when the black curve would overflow.
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

    const stats = {lo: tailStats("lo"), hi: tailStats("hi")};
    for (const side of ["lo", "hi"]) {
      placeLeader(side, stats[side]);
      fitLine(side, 2, numbers ? `${formatShare(stats[side].fNow)} of days (was ${formatShare(stats[side].fWas)})` : "");
    }
    placeCurveLabels(refPts, curPts);

    svg.setAttribute("aria-label",
      `${quantity} before and after a change of ${signed(shift, 1)} °C in the average, ± ${sd.toFixed(1)} °C of spread ` +
      `and a skewness of ${signed(skew, 2)}. Days above ${fmtDeg(hot)} happen ${formatShare(stats.hi.fNow)} of the time, ` +
      `${formatRatio(stats.hi.ratio)}; days below ${fmtDeg(cold)} ${formatShare(stats.lo.fNow)} of the time, ${formatRatio(stats.lo.ratio)}.`);
  }

  // A label line under a bracket: centred on it, nudged inward only if it would overflow.
  function fitLine(side, i, text) {
    const el = tails[side].lines[i];
    el.textContent = text;
    const hw = labelHalfWidth(text, labelFont) + 2;
    el.setAttribute("x", clamp(tails[side].cx, hw, w - hw).toFixed(1));
  }

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

  function placeCurveLabels(refPts, curPts) {
    const peakOf = pts => pts.reduce((m, p) => (p[1] > m[1] ? p : m));
    const rp = peakOf(refPts), cp = peakOf(curPts);
    const refLeft = rp[0] <= cp[0];
    const place = (el, [x, v], left) => {
      setAttrs(el, {
        x: (xs(x) + (left ? -7 : 7)).toFixed(1),
        y: clamp(ys(v) - 6, plotT + 12, plotB - 4).toFixed(1),
        "text-anchor": left ? "end" : "start",
      });
    };
    place(refLabel, rp, refLeft);
    place(curLabel, cp, !refLeft);
  }

  // ---- changes ----------------------------------------------------------------------------------
  function update() {
    makeDistribution();
    render();
    updateSliders();
    emit();
  }

  function value() {
    const hi = tailStats("hi"), lo = tailStats("lo");
    return {
      warming: shift, sd, skewness: skew,
      hotThreshold: hot, coldThreshold: cold,
      hotFraction: hi.fNow, hotRatio: hi.ratio,
      coldFraction: lo.fNow, coldRatio: lo.ratio,
      showNumbers: numbers,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function layoutControls() {
    sliderBox.style.margin = `0 ${w - plotR}px 0 ${plotL}px`;
    title.style.fontSize = `${titleFont}px`;
    title.style.marginLeft = `${plotL}px`;
  }

  layoutControls();
  build();
  updateSliders();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); layoutControls(); build(); updateSliders(); }
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

function formatRatio(r) {
  if (!Number.isFinite(r)) return r > 1 ? "from almost never" : "";
  if (r >= 1.05) return `${formatMultiplier(r)}× as often`;
  if (r <= 0.95) return `${formatMultiplier(1 / r)}× rarer`;
  return "about as often";
}
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
