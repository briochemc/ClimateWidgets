// Atmospheric transmission — an interactive version of Robert Rohde's figure of the same
// name: what fraction of the light at each wavelength gets straight through a clear
// atmosphere, gas by gas, and what that does to sunlight on its way down and to the
// Earth's own glow on its way out.
//
// Three panels share one logarithmic wavelength axis, the black-body widget's, 0.05 to
// 100 μm. The top panel draws the Planck curves of the Sun (5772 K) and of the Earth's
// surface (288 K), each scaled to its own peak, and fills in the part of each that the
// atmosphere lets through: the curve times the total transmittance. The middle panel is
// that total transmittance, 0 to 100%. The bottom panel is one row per constituent, each
// row the fraction that constituent alone absorbs (1 − T_g), with a box to include it or
// not; the total is the product of the included rows. Carbon dioxide has three amounts
// to choose from (1750, today, doubled), which is the cleanest way to see that its 15 μm
// band widens as there is more of it rather than "saturating".
//
// Every spectrum comes from data/transmission.json, precomputed offline by
// scripts/atmospheric-transmission.py from the HITRAN line list through a layered
// standard atmosphere (see the page's "About the figure"). The widget only multiplies:
// on toggling a gas its optical depth is eased from 0 to full (T_g^w with w from 0 to 1),
// and switching CO₂ amount eases between two precomputed columns the same way, so bands
// deepen and widen rather than pop. The two read-outs are the Planck-weighted integrals
// of the total transmittance over the axis: the share of sunlight that reaches the ground
// and the share of the surface's glow that escapes straight to space.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.

// Exact SI values (2019 redefinition); the same Planck function as the black-body widget.
const H = 6.62607015e-34, C = 299792458, KB = 1.380649e-23;
const C2 = (H * C) / KB;
export function planck(lambda, T) {
  if (!(lambda > 0) || !(T > 0)) return 0;
  const x = C2 / (lambda * T);
  if (x > 700) return 0;
  return (2 * H * C * C) / lambda ** 5 / Math.expm1(x);
}

export const T_SUN = 5772, T_EARTH = 288;
const VIS_LO = 0.38, VIS_HI = 0.75; // μm

// One hue per constituent, in row order; checked for colour-vision-deficiency separation
// between neighbours. Rows are also labelled, so colour is never the only cue.
const COLORS = {
  h2o: "#2f6fd6", co2: "#d9541e", o3: "#8a3fc0", ch4: "#2a9d3f", n2o: "#c2306e", o2: "#8f7a10", rayleigh: "#3a9fd0",
};
const SUN_FILL = "#f2b01e", EARTH_FILL = "#c8503a";

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const ACCENT = "#0b57d0";
const FOLLOW_TAU = 160; // ms; how quickly a band deepens after its box is ticked
const Y_SPAN = 1.4;     // the top panel runs to this many peak radiances, leaving room for labels

const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// Fraction of the Planck curve at T that gets through, weighted over the axis: the transmitted
// power divided by the emitted power, both restricted to the wavelengths the axis covers.
export function transmittedFraction(lam, dlam, total, T) {
  let num = 0, den = 0;
  for (let i = 0; i < lam.length; i++) {
    const w = planck(lam[i] * 1e-6, T) * dlam[i];
    num += w * total[i];
    den += w;
  }
  return den > 0 ? num / den : 0;
}

export function createAtmosphericTransmissionWidget({data, width = FIGURE_WIDTH, co2, gases, tour = true} = {}) {
  if (!data?.gases) throw new Error("createAtmosphericTransmissionWidget needs {data}: the contents of data/transmission.json");
  const uid = `atmospheric-transmission-${++instances}`;

  // ---- the data -------------------------------------------------------------------------------
  const N = data.bins, LAMBDA_MIN = data.lambdaMin, LAMBDA_MAX = data.lambdaMax;
  const LOG_SPAN = Math.log(LAMBDA_MAX / LAMBDA_MIN);
  const DECADES = Math.log10(LAMBDA_MAX / LAMBDA_MIN);
  const lam = new Float64Array(N), dlam = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    lam[i] = LAMBDA_MIN * Math.exp(((i + 0.5) / N) * LOG_SPAN);
    dlam[i] = lam[i] * (LOG_SPAN / N);
  }
  // Each gas: its columns (one, or one per CO₂ amount), whether it is included (`on`, the
  // target) and how much of it is currently applied (`w`, eased toward 0 or 1). A gas with
  // variants also eases between two of them: `from` and `to`, with `s` the blend.
  const GASES = data.gases.map(g => ({
    key: g.key, name: g.name, formula: g.formula, amount: g.amount ?? "",
    columns: g.variants ? g.variants.map(v => Float64Array.from(v.transmittance)) : [Float64Array.from(g.transmittance)],
    labels: g.variants ? g.variants.map(v => v.note ? `${v.label} (${v.note})` : v.label) : null,
    color: COLORS[g.key] ?? "#666",
    on: true, w: 1, from: g.default ?? 0, to: g.default ?? 0, s: 1,
    cur: new Float64Array(N),
  }));
  const byKey = Object.fromEntries(GASES.map(g => [g.key, g]));
  const CO2 = GASES.find(g => g.columns.length > 1);
  if (gases) for (const g of GASES) { g.on = gases.includes(g.key); g.w = g.on ? 1 : 0; }
  if (CO2 && co2 != null) {
    const i = typeof co2 === "number" && co2 < CO2.columns.length ? co2 : CO2.labels.findIndex(l => l.startsWith(String(co2)));
    if (i >= 0) CO2.from = CO2.to = i;
  }
  const total = new Float64Array(N);

  // Layout: constant vertically; horizontal metrics recomputed on resize (applyLayout).
  const bandY = 13;
  const pA = {title: 34, t: 40, h: 150}; pA.b = pA.t + pA.h;
  const pB = {title: pA.b + 24, t: pA.b + 30, h: 70}; pB.b = pB.t + pB.h;
  const ROW_H = 28, ROW_GAP = 6;
  const pC = {title: pB.b + 24, t: pB.b + 30}; pC.b = pC.t + GASES.length * (ROW_H + ROW_GAP) - ROW_GAP;
  const totalH = pC.b + 42;
  const rowTop = i => pC.t + i * (ROW_H + ROW_GAP);

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont, labelMinorTicks;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(78, 92); // room for a row's box and formula, and for "100%"
    plotR = w - lerp(12, 18);
    plotW = plotR - plotL;
    tickFont = lerp(9, 11);
    labelFont = lerp(10, 12);
    titleFont = lerp(10, 12);
    labelMinorTicks = plotW / DECADES >= 110;
  }
  applyLayout(maxW);

  const lx = um => plotL + (Math.log10(Math.max(um, 1e-9) / LAMBDA_MIN) / DECADES) * plotW;
  const lxInvert = px => LAMBDA_MIN * 10 ** (((px - plotL) / plotW) * DECADES);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;" +
    "padding:0 0 6px;font-size:13px;color:#666;";
  container.appendChild(controls);

  const buttonCss =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";

  // Presets on the left, the tour button on the right.
  const presets = document.createElement("div");
  presets.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;";
  presets.append("Include");
  const PRESETS = [
    ["All", () => GASES.map(g => g.key)],
    ["None", () => []],
    ["CO₂ only", () => ["co2"]],
    ["Water only", () => ["h2o"]],
  ];
  for (const [label, pick] of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = buttonCss;
    b.addEventListener("click", () => { stopTour(); setGases(pick()); });
    presets.appendChild(b);
  }
  controls.appendChild(presets);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText = buttonCss;
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);

  // The CO₂ amount, a segmented control on its own row of the controls.
  let co2Buttons = [];
  if (CO2) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex-basis:100%;";
    bar.append(`${CO2.formula} amount`);
    const seg = document.createElement("div");
    seg.style.cssText = "display:inline-flex;";
    co2Buttons = CO2.labels.map((label, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      const first = i === 0, last = i === CO2.labels.length - 1;
      b.style.cssText =
        "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;position:relative;" +
        `border-radius:${first ? "999px 0 0 999px" : last ? "0 999px 999px 0" : "0"};${first ? "" : "margin-left:-1px;"}`;
      b.addEventListener("click", () => { stopTour(); setCo2(i); });
      seg.appendChild(b);
      return b;
    });
    bar.appendChild(seg);
    controls.appendChild(bar);
  }
  function updateCo2Buttons() {
    co2Buttons.forEach((b, i) => {
      const on = i === CO2.to;
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.color = on ? ACCENT : "#333";
      b.style.zIndex = on ? 1 : 0;
      b.setAttribute("aria-pressed", on);
    });
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "atmospheric-transmission");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  svg.style.touchAction = "pan-y";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:4.2em;line-height:1.4;";
  container.appendChild(status);

  // One toggle per constituent under the figure, the accessible twin of the boxes in the
  // figure's margin: real buttons, with the gas's name and how much of it there is.
  const chipBar = document.createElement("div");
  chipBar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 0;";
  container.appendChild(chipBar);
  const chips = GASES.map(g => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText =
      "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
      "padding:3px 10px 3px 6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;";
    const dot = document.createElement("span");
    dot.style.cssText = `width:12px;height:12px;border-radius:3px;background:${g.color};box-sizing:border-box;`;
    const amount = document.createElement("span");
    amount.style.cssText = "color:#888;font-size:12px;";
    b.append(dot, g.name, amount);
    b.addEventListener("click", () => { stopTour(); toggle(g); });
    chipBar.appendChild(b);
    return {button: b, dot, amount};
  });

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  const HINT_IDLE =
    "Tick a gas in the figure or press its button to include it or leave it out; hover or touch " +
    "the figure to read the transmittance at any wavelength.";
  const HINT_TOUR =
    "Touring: an empty atmosphere, then the gases one at a time, then carbon dioxide from 1750 to " +
    "doubled — press anything to take over; Play tour starts it again.";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const halo = {stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

  // ---- sampling for drawing ---------------------------------------------------------------------
  // Two samples per pixel column; each is the mean of the bins that fall in it. The bins are
  // uniform in log wavelength and so is the axis, so a sample is a fixed run of bins.
  let S, sampleX, sampleBins; // sampleBins[s] = [first bin, one past last]
  function buildSamples() {
    S = Math.max(64, Math.round(2 * plotW));
    sampleX = new Float64Array(S);
    sampleBins = [];
    for (let s = 0; s < S; s++) {
      const b0 = Math.floor((s * N) / S), b1 = Math.max(b0 + 1, Math.floor(((s + 1) * N) / S));
      sampleBins.push([b0, b1]);
      const mid = ((b0 + b1) / 2 / N) * LOG_SPAN;
      sampleX[s] = plotL + (mid / LOG_SPAN) * plotW;
    }
  }
  function sampled(arr, s) {
    const [b0, b1] = sampleBins[s];
    let sum = 0;
    for (let i = b0; i < b1; i++) sum += arr[i];
    return sum / (b1 - b0);
  }
  // A filled path from the baseline `base` up to `value(s)` scaled by `scale` px.
  function areaPath(value, base, scale) {
    let d = `M${sampleX[0].toFixed(1)},${base}`;
    for (let s = 0; s < S; s++) d += `L${sampleX[s].toFixed(1)},${(base - scale * value(s)).toFixed(1)}`;
    return d + `L${sampleX[S - 1].toFixed(1)},${base}Z`;
  }
  function linePath(value, base, scale) {
    let d = "";
    for (let s = 0; s < S; s++) d += `${s ? "L" : "M"}${sampleX[s].toFixed(1)},${(base - scale * value(s)).toFixed(1)}`;
    return d;
  }

  // The two Planck curves, scaled to their own peaks, on the bins.
  const sunB = new Float64Array(N), earthB = new Float64Array(N);
  {
    let ms = 0, me = 0;
    for (let i = 0; i < N; i++) {
      sunB[i] = planck(lam[i] * 1e-6, T_SUN); ms = Math.max(ms, sunB[i]);
      earthB[i] = planck(lam[i] * 1e-6, T_EARTH); me = Math.max(me, earthB[i]);
    }
    for (let i = 0; i < N; i++) { sunB[i] /= ms; earthB[i] /= me; }
  }

  // ---- static scaffolding, rebuilt on resize -----------------------------------------------------
  let sunFill, earthFill, totalFill, totalLine, rowFills, rowBoxes, rowChecks, rowLabels, rowGroups;
  let sunLabel, earthLabel, sunLabel2, earthLabel2, rule, ruleLabel, ruleDots;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    buildSamples();

    const defs = svgEl("defs", {}, svg);
    for (const [name, t, h] of [["a", pA.t, pA.h], ["b", pB.t, pB.h]]) {
      svgEl("rect", {x: plotL, y: t, width: plotW, height: h}, svgEl("clipPath", {id: `${uid}-${name}`}, defs));
    }

    const visL = lx(VIS_LO), visR = lx(VIS_HI);
    // The visible band, tinted through the two upper panels and labelled along the top.
    for (const p of [pA, pB]) {
      svgEl("rect", {x: visL.toFixed(1), y: p.t, width: (visR - visL).toFixed(1), height: p.h, fill: "#f6d21a", opacity: 0.18}, svg);
    }
    const bandLabel = (text, x, anchor, opacity) => {
      if (opacity < 0.05) return;
      const t = svgEl("text", {x: x.toFixed(1), y: bandY, "text-anchor": anchor, "font-size": tickFont, fill: "#777", opacity: opacity.toFixed(3), ...halo}, svg);
      t.textContent = text;
    };
    const textW = text => 2 * labelHalfWidth(text, tickFont);
    bandLabel("ultraviolet", (plotL + visL) / 2, "middle", smoothstep(0.85, 1.05, (visL - plotL) / textW("ultraviolet")));
    bandLabel("visible", (visL + visR) / 2, "middle", 1);
    bandLabel("infrared", (visR + plotR) / 2, "middle", 1);

    // Gridlines at the decades, through every panel, and the wavelength ticks under the last row.
    const gridRanges = [[pA.t, pA.b], [pB.t, pB.b], [pC.t, pC.b]];
    for (let n = Math.floor(Math.log10(LAMBDA_MIN)); n <= Math.ceil(Math.log10(LAMBDA_MAX)); n++) {
      for (let m = 1; m <= 9; m++) {
        const um = Number((m * 10 ** n).toPrecision(12));
        if (um < LAMBDA_MIN * 0.999 || um > LAMBDA_MAX * 1.001) continue;
        const px = lx(um);
        if (px < plotL - 0.5 || px > plotR + 0.5) continue;
        const x = px.toFixed(1);
        const major = m === 1;
        if (major) for (const [y1, y2] of gridRanges) svgEl("line", {x1: x, x2: x, y1, y2, stroke: "#000", "stroke-opacity": 0.07}, svg);
        svgEl("line", {x1: x, x2: x, y1: pC.b, y2: pC.b + (major ? 6 : 3), stroke: "#666"}, svg);
        if (major || (labelMinorTicks && (m === 2 || m === 5))) {
          const t = svgEl("text", {x, y: pC.b + 18, "text-anchor": "middle", "font-size": tickFont, fill: major ? "#444" : "#888", ...halo}, svg);
          t.textContent = String(um);
        }
      }
    }
    const xTitle = svgEl("text", {x: (plotL + plotR) / 2, y: pC.b + 36, "text-anchor": "middle", "font-size": titleFont, fill: "#555"}, svg);
    xTitle.textContent = "Wavelength (μm, log scale)";

    // Panel titles, in the gap above each panel; the shorter wording where the long one
    // would run past the frame.
    const title = (long, short, y) => {
      const text = 2 * labelHalfWidth(long, titleFont) <= plotW ? long : short;
      const t = svgEl("text", {x: plotL, y, "font-size": titleFont, "font-weight": "bold", fill: "#333"}, svg);
      t.textContent = text;
      return t;
    };
    title("Sunlight and the Earth's glow, each scaled to its own peak; filled where it gets through",
      "Sunlight and Earth's glow; filled where it gets through", pA.title);
    title("Fraction that gets through the whole atmosphere", "Fraction that gets through", pB.title);
    title("Fraction each constituent absorbs on its own (tick to include it)", "Absorbed by each (tick to include)", pC.title);

    // Panel A: the curves and, under them, the part that gets through.
    const gA = svgEl("g", {"clip-path": `url(#${uid}-a)`}, svg);
    sunFill = svgEl("path", {fill: SUN_FILL, opacity: 0.75}, gA);
    earthFill = svgEl("path", {fill: EARTH_FILL, opacity: 0.7}, gA);
    const scaleA = pA.h / Y_SPAN;
    svgEl("path", {d: linePath(s => sampled(sunB, s), pA.b, scaleA), fill: "none", stroke: "#8a6400", "stroke-width": 1.5}, gA);
    svgEl("path", {d: linePath(s => sampled(earthB, s), pA.b, scaleA), fill: "none", stroke: "#7a2a1c", "stroke-width": 1.5}, gA);
    const label2 = (fill) => {
      const a = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, "font-weight": "bold", fill, ...halo}, svg);
      const b = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, fill: "#444", ...halo}, svg);
      return [a, b];
    };
    [sunLabel, sunLabel2] = label2("#7a5800");
    [earthLabel, earthLabel2] = label2("#7a2a1c");
    sunLabel.textContent = "Sunlight (5772 K)";
    earthLabel.textContent = "Earth's glow (288 K)";

    // Panel B: the total, with 0 and 100% marked.
    const gB = svgEl("g", {"clip-path": `url(#${uid}-b)`}, svg);
    totalFill = svgEl("path", {fill: "#777", opacity: 0.35}, gB);
    totalLine = svgEl("path", {fill: "none", stroke: "#333", "stroke-width": 1.2}, gB);
    for (const [v, text] of [[0, "0"], [0.5, "50%"], [1, "100%"]]) {
      const y = (pB.b - v * pB.h).toFixed(1);
      if (v > 0) svgEl("line", {x1: plotL, x2: plotR, y1: y, y2: y, stroke: "#000", "stroke-opacity": v === 1 ? 0.15 : 0.07}, svg);
      const t = svgEl("text", {x: plotL - 8, y, "text-anchor": "end", "dominant-baseline": "middle", "font-size": tickFont, fill: "#666"}, svg);
      t.textContent = text;
    }

    // Panel C: one row per gas. The row's shape is fixed (it is what the gas alone absorbs),
    // except carbon dioxide's, which follows the chosen amount; being included or not only
    // changes how the row is painted. The margin holds a box and the formula; the whole row
    // is the box's hit area.
    rowFills = []; rowBoxes = []; rowChecks = []; rowLabels = []; rowGroups = [];
    GASES.forEach((g, i) => {
      const t = rowTop(i), b = t + ROW_H;
      const grp = svgEl("g", {}, svg);
      grp.style.cursor = "pointer";
      svgEl("rect", {x: 0, y: t - ROW_GAP / 2, width: w, height: ROW_H + ROW_GAP, fill: "transparent"}, grp);
      svgEl("line", {x1: plotL, x2: plotR, y1: b, y2: b, stroke: "#999", "stroke-width": 0.75}, grp);
      const fill = svgEl("path", {fill: g.color}, grp);
      rowFills.push(fill);
      const bx = 10, by = t + ROW_H / 2 - 7;
      rowBoxes.push(svgEl("rect", {x: bx, y: by, width: 14, height: 14, rx: 3, fill: "#fff", stroke: "#555", "stroke-width": 1.2}, grp));
      rowChecks.push(svgEl("path", {d: `M${bx + 3},${by + 7.5}l3,3l5.5,-6.5`, fill: "none", stroke: "#fff", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round"}, grp));
      const label = svgEl("text", {x: bx + 21, y: t + ROW_H / 2, "dominant-baseline": "central", "font-size": labelFont, "font-weight": 600, fill: "#333"}, grp);
      label.textContent = g.formula;
      rowLabels.push(label);
      grp.addEventListener("click", () => { stopTour(); toggle(g); });
      rowGroups.push(grp);
      if (g.columns.length === 1) fill.setAttribute("d", areaPath(s => 1 - sampled(g.columns[0], s), b, ROW_H));
    });

    // The frames.
    for (const p of [pA, pB]) {
      svgEl("line", {x1: plotL, x2: plotL, y1: p.t, y2: p.b, stroke: "#666"}, svg);
      svgEl("line", {x1: plotL, x2: plotR, y1: p.b, y2: p.b, stroke: "#666"}, svg);
    }
    svgEl("line", {x1: plotL, x2: plotR, y1: pC.b, y2: pC.b, stroke: "#666"}, svg);

    // The hover rule, through every panel, with the wavelength read out on the axis under it
    // (its halo covers whatever tick label is there) and a dot on each row where the rule
    // crosses the gas's absorption.
    rule = svgEl("g", {opacity: 0}, svg);
    rule.style.pointerEvents = "none";
    svgEl("line", {y1: pA.t, y2: pC.b + 6, stroke: "#222", "stroke-width": 1, "stroke-dasharray": "3 3"}, rule);
    ruleLabel = svgEl("text", {y: pC.b + 18, "text-anchor": "middle", "font-size": tickFont + 1, "font-weight": "bold", fill: "#222", ...halo, "stroke-width": 4}, rule);
    ruleDots = GASES.map(() => svgEl("circle", {r: 3.5, fill: "#fff", stroke: "#222", "stroke-width": 1.2}, rule));

    render(true);
  }

  // ---- per-frame drawing --------------------------------------------------------------------------
  // `full` rebuilds everything that depends on the applied amounts (the fills in the two upper
  // panels, the read-outs, and carbon dioxide's row); the rows' paint is always refreshed.
  let sunFrac = 0, earthFrac = 0;
  function render(full = true) {
    if (full) {
      // Each gas's current transmittance: the chosen column, or a blend of two, raised to
      // the power of how much of the gas is applied.
      for (const g of GASES) {
        const a = g.columns[g.from], b = g.columns[g.to];
        for (let i = 0; i < N; i++) {
          const t = g.s >= 1 ? b[i] : g.s <= 0 ? a[i] : a[i] ** (1 - g.s) * b[i] ** g.s;
          g.cur[i] = g.w >= 1 ? t : g.w <= 0 ? 1 : t ** g.w;
        }
      }
      total.fill(1);
      for (const g of GASES) if (g.w > 0) for (let i = 0; i < N; i++) total[i] *= g.cur[i];
      sunFrac = transmittedFraction(lam, dlam, total, T_SUN);
      earthFrac = transmittedFraction(lam, dlam, total, T_EARTH);

      const scaleA = pA.h / Y_SPAN;
      sunFill.setAttribute("d", areaPath(s => sampled(sunB, s) * sampled(total, s), pA.b, scaleA));
      earthFill.setAttribute("d", areaPath(s => sampled(earthB, s) * sampled(total, s), pA.b, scaleA));
      totalFill.setAttribute("d", areaPath(s => sampled(total, s), pB.b, pB.h));
      totalLine.setAttribute("d", linePath(s => sampled(total, s), pB.b, pB.h));
      GASES.forEach((g, i) => {
        if (g.columns.length > 1) {
          // The row shows the gas at full strength for the chosen amount, whatever `w` is.
          const a = g.columns[g.from], b = g.columns[g.to];
          const at = s => { const [b0, b1] = sampleBins[s]; let sum = 0; for (let k = b0; k < b1; k++) sum += g.s >= 1 ? b[k] : a[k] ** (1 - g.s) * b[k] ** g.s; return 1 - sum / (b1 - b0); };
          rowFills[i].setAttribute("d", areaPath(at, rowTop(i) + ROW_H, ROW_H));
        }
      });
      placeReadouts();
    }
    GASES.forEach((g, i) => {
      // Paint follows the applied amount, so a row fades in or out as its band deepens.
      const k = g.w;
      rowFills[i].setAttribute("opacity", (0.18 + 0.62 * k).toFixed(3));
      rowFills[i].setAttribute("fill", k > 0.5 ? g.color : "#8a8a8a");
      rowBoxes[i].setAttribute("fill", k > 0.5 ? g.color : "#fff");
      rowBoxes[i].setAttribute("stroke", k > 0.5 ? g.color : "#777");
      rowChecks[i].style.display = k > 0.5 ? "" : "none";
      rowLabels[i].setAttribute("fill", k > 0.5 ? "#222" : "#777");
    });
  }

  // The read-outs sit above their curves, "Sunlight" over the Sun's peak and "Earth's glow"
  // over the Earth's, unless the two would collide, in which case they go to the two ends.
  function placeReadouts() {
    sunLabel2.textContent = `${formatShare(sunFrac)} reaches the ground`;
    earthLabel2.textContent = `${formatShare(earthFrac)} escapes to space`;
    const halfS = Math.max(labelHalfWidth(sunLabel.textContent, labelFont), labelHalfWidth(sunLabel2.textContent, labelFont));
    const halfE = Math.max(labelHalfWidth(earthLabel.textContent, labelFont), labelHalfWidth(earthLabel2.textContent, labelFont));
    let xs = clamp(lx(0.5), plotL + halfS + 2, plotR - halfS - 2);
    let xe = clamp(lx(10), plotL + halfE + 2, plotR - halfE - 2);
    if (xe - halfE < xs + halfS + 8) { xs = plotL + halfS + 2; xe = plotR - halfE - 2; }
    const y1 = pA.t + labelFont + 2, y2 = y1 + labelFont + 3;
    setAttrs(sunLabel, {x: xs.toFixed(1), y: y1}); setAttrs(sunLabel2, {x: xs.toFixed(1), y: y2});
    setAttrs(earthLabel, {x: xe.toFixed(1), y: y1}); setAttrs(earthLabel2, {x: xe.toFixed(1), y: y2});
  }

  // ---- status line and chips: depend on the targets only --------------------------------------------
  function updateStatus() {
    const off = GASES.filter(g => !g.on).map(g => g.name.toLowerCase());
    const on = GASES.filter(g => g.on);
    const co2Text = CO2 && on.includes(CO2) ? ` Carbon dioxide at ${CO2.labels[CO2.to]}.` : "";
    const gasText = on.length === 0 ? "No atmosphere at all." :
      off.length === 0 ? `All ${GASES.length} constituents included.${co2Text}` :
      on.length <= 2 ? `Only ${on.map(g => g.name.toLowerCase()).join(" and ")}.${co2Text}` :
      `Without ${off.join(", ")}.${co2Text}`;
    status.textContent = `${gasText} ${formatShare(sunFrac)} of the sunlight reaches the ground, and ` +
      `${formatShare(earthFrac)} of the surface's glow escapes straight to space.`;
    svg.setAttribute("aria-label",
      `Atmospheric transmission by wavelength, 0.05 to 100 micrometres. ${status.textContent}`);
    chips.forEach(({button, amount}, i) => {
      const g = GASES[i];
      button.style.borderColor = g.on ? ACCENT : "#ccc";
      button.style.background = g.on ? hexToRgba(ACCENT, 0.08) : "#fff";
      button.style.color = g.on ? "#222" : "#777";
      button.setAttribute("aria-pressed", g.on);
      amount.textContent = g.columns.length > 1 ? CO2.labels[CO2.to] : g.amount;
    });
    if (CO2) updateCo2Buttons();
  }

  // ---- motion --------------------------------------------------------------------------------------
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let raf = null, lastFrame = 0;
  function animate() {
    if (raf !== null) return;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = null;
    if (container.isConnected === false) return;
    const k = reduceMotion ? 1 : 1 - Math.exp(-(now - lastFrame) / FOLLOW_TAU);
    lastFrame = now;
    let settled = true;
    for (const g of GASES) {
      const wTo = g.on ? 1 : 0;
      g.w += (wTo - g.w) * k;
      if (Math.abs(g.w - wTo) < 0.004) g.w = wTo; else settled = false;
      g.s += (1 - g.s) * k;
      if (g.s > 0.996) { g.s = 1; g.from = g.to; } else settled = false;
    }
    render(true);
    if (!settled) raf = requestAnimationFrame(frame);
    else { updateStatus(); emit(); }
  }

  function toggle(g) { setGases(GASES.filter(x => (x === g ? !x.on : x.on)).map(x => x.key)); }
  function setGases(keys) {
    let changed = false;
    for (const g of GASES) {
      const on = keys.includes(g.key);
      if (on !== g.on) { g.on = on; changed = true; }
    }
    if (!changed) return;
    updateStatus();
    animate();
  }
  function setCo2(i) {
    if (!CO2 || i === CO2.to) return;
    // Mid-blend, start the new blend from where the old one is: the current mixture is
    // close enough to the nearer column that a restart from it is not visible.
    CO2.from = CO2.s < 0.5 ? CO2.from : CO2.to;
    CO2.to = i;
    CO2.s = 0;
    updateStatus();
    animate();
  }

  // ---- hover ---------------------------------------------------------------------------------------
  function showRule(px) {
    const um = lxInvert(clamp(px, plotL, plotR));
    const i = clamp(Math.floor((Math.log(um / LAMBDA_MIN) / LOG_SPAN) * N), 0, N - 1);
    const x = clamp(px, plotL, plotR).toFixed(1);
    rule.setAttribute("opacity", 1);
    rule.setAttribute("transform", `translate(${x},0)`);
    ruleLabel.textContent = formatWavelength(um);
    // Keep the label inside the figure: shift it, not the rule.
    const half = labelHalfWidth(ruleLabel.textContent, tickFont + 1);
    ruleLabel.setAttribute("x", (clamp(Number(x), plotL + half, plotR - half) - Number(x)).toFixed(1));
    const parts = [];
    GASES.forEach((g, k) => {
      const a = g.columns[g.to][i]; // the gas at full strength, at the chosen amount
      ruleDots[k].setAttribute("cy", (rowTop(k) + ROW_H - ROW_H * (1 - a)).toFixed(1));
      ruleDots[k].setAttribute("stroke", g.on ? g.color : "#999");
      if (1 - a >= 0.005) parts.push({g, absorbed: 1 - a});
    });
    parts.sort((p, q) => q.absorbed - p.absorbed);
    const who = parts.length === 0 ? "nothing here absorbs" :
      parts.map(({g, absorbed}) => `${g.name.toLowerCase()} ${formatShare(absorbed)}${g.on ? "" : " (left out)"}`).join(", ");
    status.textContent = `At ${formatWavelength(um)}: ${formatShare(total[i])} gets through. ` +
      `Absorbed by each on its own: ${who}.`;
  }
  function hideRule() {
    rule.setAttribute("opacity", 0);
    updateStatus();
  }
  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (totalH / r.height)};
  }
  svg.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (px >= plotL && px <= plotR && py >= pA.t && py <= pC.b) showRule(px); else hideRule();
  });
  svg.addEventListener("pointerleave", hideRule);

  // ---- value ---------------------------------------------------------------------------------------
  function value() {
    return {
      gases: Object.fromEntries(GASES.map(g => [g.key, g.on])),
      co2: CO2 ? CO2.labels[CO2.to] : null,
      sunlightToGround: sunFrac,
      glowToSpace: earthFrac,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  build();
  updateStatus();
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

  // ---- tour ----------------------------------------------------------------------------------------
  // An empty atmosphere first, then the constituents one at a time in row order, then carbon
  // dioxide taken from its 1750 amount to double, and back to today. Same manners as the other
  // widgets' tours: it loops until the reader touches anything, and Play tour brings it back.
  const TOUR_HOLD = 2600;
  const STEPS = [];
  {
    const acc = [];
    STEPS.push({gases: [], co2: CO2?.from ?? 0});
    for (const g of GASES) { acc.push(g.key); STEPS.push({gases: [...acc], co2: CO2?.from ?? 0}); }
    if (CO2) for (const i of [0, 1, 2, 1]) if (i < CO2.columns.length) STEPS.push({gases: GASES.map(g => g.key), co2: i});
  }
  let touring = false, tourTimer = null, tourWatcher = null;
  function showTouring() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }
  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    hint.textContent = HINT_IDLE;
    showTouring();
  }
  function tourStep(i) {
    if (!touring) return;
    if (container.isConnected === false) return stopTour();
    const step = STEPS[i];
    setGases(step.gases);
    if (CO2) setCo2(step.co2);
    tourTimer = setTimeout(() => tourStep((i + 1) % STEPS.length), TOUR_HOLD);
  }
  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
    hint.textContent = HINT_TOUR;
    showTouring();
    tourTimer = setTimeout(() => tourStep(0), delay);
  }
  if (tour && !reduceMotion) {
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

// ---- formatting ---------------------------------------------------------------------------------

function formatShare(f) {
  const pct = 100 * f;
  if (pct < 0.05) return "0%";
  if (pct > 99.95) return "100%";
  return pct < 1 || pct > 99 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}

function formatWavelength(um) {
  return um < 1 ? `${Math.round(um * 1000)} nm` : `${um.toPrecision(3).replace(/\.?0+$/, "")} μm`;
}

// ---- small helpers --------------------------------------------------------------------------------

function setAttrs(el, attrs) {
  for (const k in attrs) el.setAttribute(k, attrs[k]);
}

function labelHalfWidth(text, fontSize) {
  return (text.length * fontSize * 0.56) / 2;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(e0, e1, v) {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
