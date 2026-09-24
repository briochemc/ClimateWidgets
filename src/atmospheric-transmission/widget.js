// Atmospheric transmission — an interactive version of Robert Rohde's figure of the same
// name: what fraction of the light at each wavelength gets straight through a clear
// atmosphere, gas by gas, and what that does to sunlight on its way down and to the
// Earth's own glow on its way out.
//
// Three panels share one logarithmic wavelength axis, the blackbody widget's, 0.05 to
// 100 μm. The top panel draws the Planck curves of the Sun (5772 K) and of the Earth's
// surface (288 K by default; a slider moves it between 210 and 310 K), each scaled to its
// own peak, as faint fills, and fills in solidly the part of each that the atmosphere lets
// through: the curve times the total transmittance. The middle panel is the fraction the
// whole atmosphere absorbs, 0 to 100%. The bottom panel is one row per constituent, in two
// groups (what mostly stops sunlight on the way in; the greenhouse gases, which mostly stop
// the Earth's glow on the way out), each row the fraction that constituent alone absorbs
// (1 − T_g), with a box to include it or not; the total transmittance is the product of the
// included rows. Carbon dioxide, methane and nitrous oxide each have three amounts to
// choose from (1750, today, doubled), which is the cleanest way to see that a band widens
// as there is more of the gas rather than "saturating".
//
// Every spectrum comes from data/transmission.json, precomputed offline by
// scripts/atmospheric-transmission.py from the HITRAN line list through a layered
// standard atmosphere (see the page's "About the figure"). The widget only multiplies:
// on toggling a gas its optical depth is eased from 0 to full (T_g^w with w from 0 to 1),
// and switching a gas's amount eases between two precomputed columns the same way, so
// bands deepen and widen rather than pop. The two read-outs are the Planck-weighted integrals
// of the total transmittance over the axis: the share of sunlight that reaches the ground
// and the share of the surface's glow that escapes straight to space.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page. The gas colours
// and the spectrum under the visible band are copied from the atmospheric-composition and
// blackbody widgets rather than imported, for the same reason.

// Exact SI values (2019 redefinition); the same Planck function as the blackbody widget.
const H = 6.62607015e-34, C = 299792458, KB = 1.380649e-23;
const C2 = (H * C) / KB;
export function planck(lambda, T) {
  if (!(lambda > 0) || !(T > 0)) return 0;
  const x = C2 / (lambda * T);
  if (x > 700) return 0;
  return (2 * H * C * C) / lambda ** 5 / Math.expm1(x);
}
export const WIEN_B = C2 / 4.965114231744276; // Wien's displacement constant, m·K
export const peakWavelength = T => WIEN_B / T; // m

export const T_SUN = 5772, T_EARTH = 288;
export const EARTH_MIN = 210, EARTH_MAX = 310; // the surface temperature slider's range, K
const VIS_LO = 0.38, VIS_HI = 0.75; // μm

// The fills are the atmospheric-composition widget's palette (COLOURS there), so that a gas
// is the same colour on both pages; Rayleigh scattering, which is not a gas, is the blue of
// the sky it makes, softened to sit with the rest. Rows are also labelled, so colour is never
// the only cue. Each row's line is its fill at the same hue and saturation, darkened
// (lineColour, below).
const FILLS = {
  h2o: "#f2a97e", co2: "#f5c07d", o3: "#f1d675", ch4: "#f4a094", n2o: "#dcaacd", o2: "#b3c6d9", rayleigh: "#8ec5e8",
};
const SUN_FILL = "#f2b01e", EARTH_FILL = "#c8503a";
const SUN_TEXT = "#7a5800", EARTH_TEXT = "#7a2a1c";

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const ACCENT = "#0b57d0";
const FOLLOW_TAU = 160; // ms; how quickly a band deepens after its box is ticked
const Y_SPAN = 1.4;     // the top panel runs to this many peak radiances, leaving room for labels
// The data is rounded to 3 decimals, so a transmittance of 0 means "under 0.0005". That is
// the value eased from and to: 0 to any positive power is 0, so without a floor a saturated
// band would stay black while its gas faded out and then vanish in one jump.
const T_FLOOR = 5e-4;

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

// The colours of the visible band, as in the blackbody widget: the CIE 1931 2° colour-
// matching functions (the multi-lobe Gaussian fit of Wyman, Sloan & Shirley 2013) to XYZ,
// then linear sRGB with just enough white added to lift the lowest channel to 0, which
// keeps the hue (clipping would flatten the spectrum into three slabs), scaled to full
// brightness and gamma-encoded. λ in nanometres; returns [r, g, b] in 0–255.
function spectralRgb(nm) {
  const g = (mu, s1, s2) => { const t = (nm - mu) / (nm < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const X = 1.056 * g(599.8, 37.9, 31.0) + 0.362 * g(442.0, 16.0, 26.7) - 0.065 * g(501.1, 20.4, 26.2);
  const Y = 0.821 * g(568.8, 46.9, 40.5) + 0.286 * g(530.9, 16.3, 31.1);
  const Z = 1.217 * g(437.0, 11.8, 36.0) + 0.681 * g(459.0, 26.0, 13.8);
  let rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  const floor = Math.min(0, ...rgb);
  rgb = rgb.map(v => v - floor);
  const m = Math.max(...rgb) || 1;
  return rgb.map(v => v / m).map(v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
}

// The rows, in two groups: what mostly stops sunlight on its way in (oxygen, ozone and the
// scattering by the air itself), then the greenhouse gases, which mostly stop the Earth's
// glow on its way out, strongest first. The tour starts from the first group alone and adds
// the second one gas at a time. Any constituent the data has that is not listed here goes
// at the end of the second group.
const GROUPS = [
  {title: "Mostly the incoming sunlight", keys: ["o2", "o3", "rayleigh"]},
  {title: "Greenhouse gases: mostly the outgoing glow", keys: ["h2o", "co2", "ch4", "n2o"]},
];

// `amounts` picks a variant for each gas that has them, by key: {co2: 278, ch4: "today"},
// an index, a label prefix or a note. (`co2` alone is accepted too, for old embeds.)
export function createAtmosphericTransmissionWidget({data, width = FIGURE_WIDTH, co2, amounts = {}, gases, earthTemperature = T_EARTH, tour = true} = {}) {
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
    notes: g.variants ? g.variants.map(v => v.note ?? v.label) : null,
    fill: FILLS[g.key] ?? "#c0c8d0",
    line: lineColour(FILLS[g.key] ?? "#c0c8d0"),
    on: true, w: 1, from: g.default ?? 0, to: g.default ?? 0, s: 1,
    cur: new Float64Array(N),
    group: 0,
  }));
  // Rows in GROUPS order; a constituent GROUPS does not name keeps the data's order, last.
  const RANK = new Map(GROUPS.flatMap(G => G.keys).map((k, i) => [k, i]));
  for (const g of GASES) {
    const i = GROUPS.findIndex(G => G.keys.includes(g.key));
    g.group = i < 0 ? GROUPS.length - 1 : i;
  }
  GASES.sort((a, b) => (RANK.get(a.key) ?? RANK.size) - (RANK.get(b.key) ?? RANK.size));
  const VARIANT = GASES.filter(g => g.columns.length > 1); // the gases with an amount to choose
  if (gases) for (const g of GASES) { g.on = gases.includes(g.key); g.w = g.on ? 1 : 0; }
  for (const g of VARIANT) {
    const want = amounts[g.key] ?? (g.key === "co2" ? co2 : undefined);
    if (want == null) continue;
    const i = typeof want === "number" && Number.isInteger(want) && want < g.columns.length ? want :
      g.labels.findIndex((l, k) => l.startsWith(String(want)) || g.notes[k] === String(want));
    if (i >= 0) g.from = g.to = i;
  }
  const total = new Float64Array(N);
  let earthT = clamp(Math.round(Number(earthTemperature)) || T_EARTH, EARTH_MIN, EARTH_MAX);

  // The transmittance of a gas at blend s between two of its columns, and at a fraction w of
  // its full amount: T^w, the optical depth scaled. Floored (T_FLOOR) so that a saturated
  // band eases like any other.
  const blend = (a, b, s) => (s >= 1 ? b : s <= 0 ? a : Math.max(a, T_FLOOR) ** (1 - s) * Math.max(b, T_FLOOR) ** s);
  const applied = (t, w) => (w >= 1 ? t : w <= 0 ? 1 : Math.max(t, T_FLOOR) ** w);

  // Layout: constant vertically; horizontal metrics recomputed on resize (applyLayout).
  // The rows sit in their groups, each group under a caption of its own.
  const bandY = 12;
  const pA = {t: 18, h: 210}; pA.b = pA.t + pA.h;
  const pB = {t: pA.b + 14, h: 70}; pB.b = pB.t + pB.h;
  const ROW_H = 28, ROW_GAP = 6, GROUP_HEAD = 20;
  const rowTops = [];
  const groupSpans = GROUPS.map(() => null); // [top of first row, bottom of last] per group
  {
    let y = pB.b + 8, prev = -1;
    GASES.forEach((g, i) => {
      if (g.group !== prev) { y += GROUP_HEAD; prev = g.group; }
      rowTops.push(y);
      groupSpans[g.group] = [groupSpans[g.group]?.[0] ?? y, y + ROW_H];
      y += ROW_H + ROW_GAP;
    });
  }
  const pC = {t: rowTops[0], b: rowTops[rowTops.length - 1] + ROW_H};
  const totalH = pC.b + 42;
  const rowTop = i => rowTops[i];

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont, labelMinorTicks;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(46, 58); // room for the rotated title, for "100%", and for a row's box
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

  // The amounts on the first row of the controls, one segmented control per gas that has
  // them (they wrap when there is no room). The buttons say when (1750, today, doubled);
  // the amount itself is in the button's tooltip and in the gas's row. The second row is
  // the surface temperature slider, with the tour button at its right.
  const amountButtons = new Map(); // gas -> its buttons
  if (VARIANT.length) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;flex-basis:100%;";
    bar.append("Amounts");
    for (const g of VARIANT) {
      const group = document.createElement("div");
      group.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
      group.append(g.formula);
      const seg = document.createElement("div");
      seg.style.cssText = "display:inline-flex;";
      amountButtons.set(g, g.labels.map((label, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = g.notes[i];
        b.title = `${g.name} at ${label}`;
        b.setAttribute("aria-label", `${g.name} at ${label}`);
        const first = i === 0, last = i === g.labels.length - 1;
        b.style.cssText =
          "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;position:relative;" +
          `border-radius:${first ? "999px 0 0 999px" : last ? "0 999px 999px 0" : "0"};${first ? "" : "margin-left:-1px;"}`;
        b.addEventListener("click", () => { stopTour(); setAmount(g, i); });
        seg.appendChild(b);
        return b;
      }));
      group.appendChild(seg);
      bar.appendChild(group);
    }
    controls.appendChild(bar);
  }
  function updateAmountButtons() {
    for (const [g, buttons] of amountButtons) {
      buttons.forEach((b, i) => {
        const on = i === g.to;
        b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
        b.style.borderColor = on ? ACCENT : "#ccc";
        b.style.color = on ? ACCENT : "#333";
        b.style.zIndex = on ? 1 : 0;
        b.setAttribute("aria-pressed", on);
      });
    }
  }

  // The Earth's surface temperature, a slider on the last row of the controls: it moves the
  // Earth's curve along the axis (Wien's law) under the fixed bands, which is the point.
  const earthField = document.createElement("label");
  earthField.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;flex:1 1 auto;cursor:pointer;";
  const earthSlider = document.createElement("input");
  earthSlider.type = "range";
  earthSlider.min = EARTH_MIN;
  earthSlider.max = EARTH_MAX;
  earthSlider.step = 1;
  earthSlider.value = earthT;
  earthSlider.style.cssText = `flex:1 1 120px;max-width:260px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  earthSlider.setAttribute("aria-label", "Earth's surface temperature, kelvin");
  const earthOut = document.createElement("span");
  earthOut.style.cssText = "color:#333;min-width:3.6em;";
  earthField.append("Earth's surface", earthSlider, earthOut);
  earthSlider.addEventListener("input", e => { e.stopPropagation(); stopTour(); setEarth(Number(earthSlider.value)); });
  controls.appendChild(earthField);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText = buttonCss;
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);

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

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  const HINT_IDLE =
    "Tick a row to include that constituent or leave it out (each row is a checkbox, so Tab and " +
    "Space work too); hover or touch the figure to read the absorption at any wavelength.";
  const HINT_TOUR =
    "Touring: oxygen, ozone and the air's own scattering first, then the greenhouse gases added " +
    "one at a time, strongest first — press anything to take over; Play tour starts it again.";
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
  // A filled path from the baseline `base` up to `value(s)` scaled by `scale` px, and the
  // line along its top.
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
  // What a gas alone absorbs, sampled: 1 − its transmittance at full strength, at the
  // current blend of its columns.
  function rowValue(g) {
    const a = g.columns[g.from], b = g.columns[g.to], s = g.s;
    return k => {
      const [b0, b1] = sampleBins[k];
      let sum = 0;
      for (let i = b0; i < b1; i++) sum += blend(a[i], b[i], s);
      return 1 - sum / (b1 - b0);
    };
  }

  // The two Planck curves, scaled to their own peaks, on the bins.
  const sunB = new Float64Array(N), earthB = new Float64Array(N);
  function normalisedPlanck(out, T) {
    let m = 0;
    for (let i = 0; i < N; i++) { out[i] = planck(lam[i] * 1e-6, T); m = Math.max(m, out[i]); }
    for (let i = 0; i < N; i++) out[i] /= m;
  }
  normalisedPlanck(sunB, T_SUN);
  normalisedPlanck(earthB, earthT);

  // ---- static scaffolding, rebuilt on resize -----------------------------------------------------
  let sunFull, earthFull, sunFill, earthFill, sunLine, earthLine, sunClip, totalFill, totalLine;
  let rowFills, rowLines, rowBoxes, rowChecks, rowLabels, rowRings;
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
    // The part of the sunlight that gets through, which the spectrum is painted into.
    sunClip = svgEl("path", {}, svgEl("clipPath", {id: `${uid}-sun`}, defs));

    // The spectrum, one stop per 10 nm, placed by log wavelength like everything else; the
    // ends fade to transparent the way the eye's sensitivity does. As in the blackbody widget.
    const visL = lx(VIS_LO), visR = lx(VIS_HI);
    const visGrad = svgEl("linearGradient", {
      id: `${uid}-vis`, gradientUnits: "userSpaceOnUse", x1: visL, x2: visR, y1: 0, y2: 0,
    }, defs);
    for (let nm = 380; nm <= 750; nm += 10) {
      const [r, g, b] = spectralRgb(nm);
      const a = Math.min(smoothstep(380, 430, nm), 1 - smoothstep(670, 750, nm));
      svgEl("stop", {
        offset: ((lx(nm / 1000) - visL) / (visR - visL)).toFixed(4),
        "stop-color": `rgb(${r},${g},${b})`, "stop-opacity": a.toFixed(3),
      }, visGrad);
    }
    // The visible band, faintly tinted with it through the two upper panels, and labelled
    // along the top with its neighbours.
    const visRect = {x: visL.toFixed(1), width: (visR - visL).toFixed(1), fill: `url(#${uid}-vis)`};
    for (const p of [pA, pB]) svgEl("rect", {...visRect, y: p.t, height: p.h, opacity: 0.1}, svg);
    const bandLabel = (text, x, anchor, opacity) => {
      if (opacity < 0.05) return;
      const t = svgEl("text", {x: x.toFixed(1), y: bandY, "text-anchor": anchor, "font-size": tickFont, fill: "#777", opacity: opacity.toFixed(3), ...halo}, svg);
      t.textContent = text;
    };
    const textW = text => 2 * labelHalfWidth(text, tickFont);
    bandLabel("ultraviolet", (plotL + visL) / 2, "middle", smoothstep(0.85, 1.05, (visL - plotL) / textW("ultraviolet")));
    bandLabel("visible", (visL + visR) / 2, "middle", 1);
    bandLabel("infrared", (visR + plotR) / 2, "middle", 1);

    // Gridlines at the decades, through every panel and each group of rows, and the
    // wavelength ticks under the last row.
    const gridRanges = [[pA.t, pA.b], [pB.t, pB.b], ...groupSpans.filter(Boolean)];
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
    xTitle.textContent = "Wavelength (μm)";

    // The top panel's axis title, the blackbody widget's, reading bottom to top in two
    // lines: the everyday words, then the proper name. No units: each curve is drawn
    // relative to its own peak. Rotated text hangs to the left of its baseline, so the
    // inner line's baseline sits just off the axis and the outer line's one line further out.
    const yMid = pA.t + pA.h / 2;
    const rotated = (x, attrs) => svgEl("text", {
      x, y: yMid, transform: `rotate(-90 ${x} ${yMid})`, "text-anchor": "middle", ...attrs,
    }, svg);
    const unitFont = titleFont - 1;
    rotated(plotL - 6 - unitFont - 4, {"font-size": titleFont, "font-weight": "bold", fill: "#333"})
      .textContent = "Brightness at each wavelength";
    rotated(plotL - 6, {"font-size": unitFont, fill: "#888"})
      .textContent = "spectral radiance (peak = 1)";

    // Panel A: each curve as a faint fill, the part of it that gets through as a solid one
    // with a line along its top, and the spectrum painted into the sunlight that gets
    // through in the visible band.
    const gA = svgEl("g", {"clip-path": `url(#${uid}-a)`}, svg);
    sunFull = svgEl("path", {fill: SUN_FILL, opacity: 0.22}, gA);
    earthFull = svgEl("path", {fill: EARTH_FILL, opacity: 0.2}, gA);
    sunFill = svgEl("path", {fill: SUN_FILL, opacity: 0.75}, gA);
    earthFill = svgEl("path", {fill: EARTH_FILL, opacity: 0.7}, gA);
    svgEl("rect", {...visRect, y: pA.t, height: pA.h, opacity: 0.85, "clip-path": `url(#${uid}-sun)`}, gA);
    sunLine = svgEl("path", {fill: "none", stroke: SUN_TEXT, "stroke-width": 1.2, "stroke-linejoin": "round"}, gA);
    earthLine = svgEl("path", {fill: "none", stroke: EARTH_TEXT, "stroke-width": 1.2, "stroke-linejoin": "round"}, gA);
    const label2 = (fill) => {
      const a = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, "font-weight": "bold", fill, ...halo}, svg);
      const b = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, fill: "#444", ...halo}, svg);
      return [a, b];
    };
    [sunLabel, sunLabel2] = label2(SUN_TEXT);
    [earthLabel, earthLabel2] = label2(EARTH_TEXT);
    sunLabel.textContent = `Sunlight (${T_SUN} K)`;

    // Panel B: what the whole atmosphere absorbs, with 0, 50 and 100% marked and its title
    // inside the frame, haloed so that it reads over the fill.
    const gB = svgEl("g", {"clip-path": `url(#${uid}-b)`}, svg);
    totalFill = svgEl("path", {fill: "#777", opacity: 0.35}, gB);
    totalLine = svgEl("path", {fill: "none", stroke: "#333", "stroke-width": 1.2}, gB);
    for (const [v, text] of [[0, "0"], [0.5, "50%"], [1, "100%"]]) {
      const y = (pB.b - v * pB.h).toFixed(1);
      if (v > 0) svgEl("line", {x1: plotL, x2: plotR, y1: y, y2: y, stroke: "#000", "stroke-opacity": v === 1 ? 0.15 : 0.07}, svg);
      const t = svgEl("text", {x: plotL - 8, y, "text-anchor": "end", "dominant-baseline": "middle", "font-size": tickFont, fill: "#666"}, svg);
      t.textContent = text;
    }
    const bTitleLong = "Fraction absorbed by the atmosphere", bTitleShort = "Fraction absorbed";
    const bTitle = svgEl("text", {
      x: plotL + 6, y: pB.t + titleFont + 4, "font-size": titleFont, "font-weight": "bold", fill: "#333", ...halo, "stroke-width": 4,
    }, svg);
    bTitle.textContent = 2 * labelHalfWidth(bTitleLong, titleFont) <= plotW - 12 ? bTitleLong : bTitleShort;

    // Panel C: the rows, in their groups, each group captioned. A row's shape is fixed (it
    // is what the gas alone absorbs) except for a gas with amounts, whose row follows the
    // chosen amount; being included or not only changes how the row is painted. The margin
    // holds the box; the gas's name and amount are inside the row, haloed like the middle
    // panel's title; and the whole row is the box, a checkbox to the keyboard as well.
    GROUPS.forEach((G, k) => {
      if (!groupSpans[k]) return;
      const t = svgEl("text", {x: plotL, y: groupSpans[k][0] - 6, "font-size": tickFont, fill: "#777", ...halo}, svg);
      t.textContent = G.title;
    });
    rowFills = []; rowLines = []; rowBoxes = []; rowChecks = []; rowLabels = []; rowRings = [];
    GASES.forEach((g, i) => {
      const t = rowTop(i), b = t + ROW_H;
      const grp = svgEl("g", {tabindex: 0, role: "checkbox", "aria-label": g.name}, svg);
      grp.style.cursor = "pointer";
      grp.style.outline = "none";
      svgEl("rect", {x: 0, y: t - ROW_GAP / 2, width: w, height: ROW_H + ROW_GAP, fill: "transparent"}, grp);
      svgEl("line", {x1: plotL, x2: plotR, y1: b, y2: b, stroke: "#999", "stroke-width": 0.75}, grp);
      rowFills.push(svgEl("path", {fill: g.fill}, grp));
      rowLines.push(svgEl("path", {fill: "none", stroke: g.line, "stroke-width": 1, "stroke-linejoin": "round"}, grp));
      const bx = plotL - 24, by = t + ROW_H / 2 - 7;
      const ring = svgEl("rect", {x: bx - 3, y: by - 3, width: 20, height: 20, rx: 5, fill: "none", stroke: hexToRgba(ACCENT, 0.5), "stroke-width": 2.5}, grp);
      ring.style.display = "none";
      rowRings.push(ring);
      rowBoxes.push(svgEl("rect", {x: bx, y: by, width: 14, height: 14, rx: 3, fill: "#fff", stroke: "#555", "stroke-width": 1.2}, grp));
      rowChecks.push(svgEl("path", {d: `M${bx + 3},${by + 7.5}l3,3l5.5,-6.5`, fill: "none", stroke: "#fff", "stroke-width": 2.2, "stroke-linecap": "round", "stroke-linejoin": "round"}, grp));
      rowLabels.push(svgEl("text", {
        x: plotL + 6, y: t + labelFont + 3, "font-size": labelFont, "font-weight": 600, fill: "#222", ...halo, "stroke-width": 4,
      }, grp));
      grp.addEventListener("click", () => { stopTour(); toggle(g); });
      grp.addEventListener("keydown", e => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        stopTour();
        toggle(g);
      });
      grp.addEventListener("focus", () => { ring.style.display = ""; });
      grp.addEventListener("blur", () => { ring.style.display = "none"; });
      if (g.columns.length === 1) {
        const value = rowValue(g);
        rowFills[i].setAttribute("d", areaPath(value, b, ROW_H));
        rowLines[i].setAttribute("d", linePath(value, b, ROW_H));
      }
    });
    updateRowLabels();

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
      // Each gas's current transmittance: the chosen column, or a blend of two, at the
      // fraction of the gas that is applied.
      for (const g of GASES) {
        const a = g.columns[g.from], b = g.columns[g.to];
        for (let i = 0; i < N; i++) g.cur[i] = applied(blend(a[i], b[i], g.s), g.w);
      }
      total.fill(1);
      for (const g of GASES) if (g.w > 0) for (let i = 0; i < N; i++) total[i] *= g.cur[i];
      sunFrac = transmittedFraction(lam, dlam, total, T_SUN);
      earthFrac = transmittedFraction(lam, dlam, total, earthT);

      const scaleA = pA.h / Y_SPAN;
      sunFull.setAttribute("d", areaPath(s => sampled(sunB, s), pA.b, scaleA));
      earthFull.setAttribute("d", areaPath(s => sampled(earthB, s), pA.b, scaleA));
      const sunThrough = s => sampled(sunB, s) * sampled(total, s);
      const earthThrough = s => sampled(earthB, s) * sampled(total, s);
      const sunD = areaPath(sunThrough, pA.b, scaleA);
      sunFill.setAttribute("d", sunD);
      sunClip.setAttribute("d", sunD);
      sunLine.setAttribute("d", linePath(sunThrough, pA.b, scaleA));
      earthFill.setAttribute("d", areaPath(earthThrough, pA.b, scaleA));
      earthLine.setAttribute("d", linePath(earthThrough, pA.b, scaleA));
      totalFill.setAttribute("d", areaPath(s => 1 - sampled(total, s), pB.b, pB.h));
      totalLine.setAttribute("d", linePath(s => 1 - sampled(total, s), pB.b, pB.h));
      GASES.forEach((g, i) => {
        if (g.columns.length > 1) {
          // The row shows the gas at full strength for the chosen amount, whatever `w` is.
          const value = rowValue(g);
          rowFills[i].setAttribute("d", areaPath(value, rowTop(i) + ROW_H, ROW_H));
          rowLines[i].setAttribute("d", linePath(value, rowTop(i) + ROW_H, ROW_H));
        }
      });
      placeReadouts();
    }
    GASES.forEach((g, i) => {
      // Paint follows the applied amount, so a row fades in or out as its band deepens.
      const k = g.w, on = k > 0.5;
      rowFills[i].setAttribute("opacity", (0.25 + 0.6 * k).toFixed(3));
      rowFills[i].setAttribute("fill", on ? g.fill : "#9a9a9a");
      rowLines[i].setAttribute("opacity", (0.35 + 0.65 * k).toFixed(3));
      rowLines[i].setAttribute("stroke", on ? g.line : "#888");
      rowBoxes[i].setAttribute("fill", on ? g.line : "#fff");
      rowBoxes[i].setAttribute("stroke", on ? g.line : "#777");
      rowChecks[i].style.display = on ? "" : "none";
      rowLabels[i].setAttribute("fill", on ? "#222" : "#777");
    });
  }

  // Each row's label: the formula and the amount, no more ("CO₂, 428 ppm"); the full name
  // is what the row announces to assistive technology.
  function updateRowLabels() {
    GASES.forEach((g, i) => {
      const amount = g.labels ? g.labels[g.to].split(" (")[0] : g.amount;
      rowLabels[i].textContent = amount ? `${g.formula}, ${amount}` : g.formula;
      rowLabels[i].parentNode.setAttribute("aria-checked", g.on);
      rowLabels[i].parentNode.setAttribute("aria-label", `${g.name}${amount ? `, ${amount}` : ""}`);
    });
  }

  // The read-outs sit above their curves, "Sunlight" over the Sun's peak and "Earth's glow"
  // over the Earth's, unless the two would collide, in which case they go to the two ends.
  function placeReadouts() {
    earthLabel.textContent = `Earth's glow (${earthT} K)`;
    sunLabel2.textContent = `${formatShare(sunFrac)} reaches the ground`;
    earthLabel2.textContent = `${formatShare(earthFrac)} escapes to space`;
    const halfS = Math.max(labelHalfWidth(sunLabel.textContent, labelFont), labelHalfWidth(sunLabel2.textContent, labelFont));
    const halfE = Math.max(labelHalfWidth(earthLabel.textContent, labelFont), labelHalfWidth(earthLabel2.textContent, labelFont));
    let xs = clamp(lx(peakWavelength(T_SUN) * 1e6), plotL + halfS + 2, plotR - halfS - 2);
    let xe = clamp(lx(peakWavelength(earthT) * 1e6), plotL + halfE + 2, plotR - halfE - 2);
    if (xe - halfE < xs + halfS + 8) { xs = plotL + halfS + 2; xe = plotR - halfE - 2; }
    const y1 = pA.t + labelFont + 2, y2 = y1 + labelFont + 3;
    setAttrs(sunLabel, {x: xs.toFixed(1), y: y1}); setAttrs(sunLabel2, {x: xs.toFixed(1), y: y2});
    setAttrs(earthLabel, {x: xe.toFixed(1), y: y1}); setAttrs(earthLabel2, {x: xe.toFixed(1), y: y2});
  }

  // ---- status line, row labels and buttons: depend on the targets only -------------------------------
  function updateStatus() {
    const off = GASES.filter(g => !g.on).map(g => g.name.toLowerCase());
    const on = GASES.filter(g => g.on);
    // The amounts of the variant gases that are included, the gases at the same amount's
    // note (today, doubled, mean…) gathered into one phrase.
    const shown = VARIANT.filter(g => g.on);
    const notes = [...new Set(shown.map(g => g.notes[g.to]))];
    const amountText = notes.map(note => {
      const these = shown.filter(g => g.notes[g.to] === note);
      return ` ${these.map(g => g.formula).join(", ")} at ${these.map(g => g.labels[g.to].split(" (")[0]).join(", ")} (${note}).`;
    }).join("");
    const gasText = on.length === 0 ? "No atmosphere at all." :
      off.length === 0 ? `All ${GASES.length} constituents included.${amountText}` :
      on.length <= 2 ? `Only ${on.map(g => g.name.toLowerCase()).join(" and ")}.${amountText}` :
      `Without ${off.join(", ")}.${amountText}`;
    status.textContent = `${gasText} ${formatShare(sunFrac)} of the sunlight reaches the ground, and ` +
      `${formatShare(earthFrac)} of the glow of the ${earthT} K surface escapes straight to space.`;
    svg.setAttribute("aria-label",
      `Atmospheric absorption by wavelength, 0.05 to 100 micrometres. ${status.textContent}`);
    earthOut.textContent = `${earthT} K`;
    updateRowLabels();
    updateAmountButtons();
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
  function setAmount(g, i) {
    if (!g.labels || i === g.to) return;
    // Mid-blend, start the new blend from where the old one is: the current mixture is
    // close enough to the nearer column that a restart from it is not visible.
    g.from = g.s < 0.5 ? g.from : g.to;
    g.to = i;
    g.s = 0;
    updateStatus();
    animate();
  }
  // The slider drives the Earth's curve directly, with no easing: it is under the finger.
  function setEarth(T) {
    T = clamp(Math.round(T), EARTH_MIN, EARTH_MAX);
    if (T === earthT) return;
    earthT = T;
    earthSlider.value = T;
    normalisedPlanck(earthB, earthT);
    render(true);
    updateStatus();
    emit();
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
      ruleDots[k].setAttribute("stroke", g.on ? g.line : "#999");
      if (1 - a >= 0.005) parts.push({g, absorbed: 1 - a});
    });
    parts.sort((p, q) => q.absorbed - p.absorbed);
    const who = parts.length === 0 ? "nothing here absorbs" :
      parts.map(({g, absorbed}) => `${g.name.toLowerCase()} ${formatShare(absorbed)}${g.on ? "" : " (left out)"}`).join(", ");
    status.textContent = `At ${formatWavelength(um)}: ${formatShare(1 - total[i])} absorbed, ${formatShare(total[i])} gets through. ` +
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
      amounts: Object.fromEntries(VARIANT.map(g => [g.key, g.labels[g.to]])),
      earthTemperature: earthT,
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
  // One way only: the first group alone (what mostly stops sunlight), then one greenhouse gas
  // added per step, strongest first, until all are in, then round again. The amounts and the
  // surface temperature stay as they are. Same manners as the other widgets' tours: it loops
  // until the reader touches anything, and Play tour brings it back.
  const TOUR_HOLD = 2600;
  const STEPS = [GASES.filter(g => g.group === 0).map(g => g.key)];
  for (const g of GASES) if (g.group !== 0) STEPS.push([...STEPS[STEPS.length - 1], g.key]);
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
    setGases(STEPS[i]);
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

// The same hue and saturation as a fill, at a lightness that reads as a line on white.
function lineColour(hex, lightness = 0.42) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return `hsl(${h.toFixed(0)},${(100 * s).toFixed(0)}%,${(100 * lightness).toFixed(0)}%)`;
}
