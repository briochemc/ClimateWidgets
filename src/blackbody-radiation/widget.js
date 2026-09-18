// Black-body radiation — Planck's law as one curve of spectral radiance against wavelength,
// driven by a temperature slider that runs from the surface of Mars to a blue supergiant.
//
// The frame follows the curve: the x-axis always spans 0 to X_SPAN peak wavelengths and the
// y-axis 0 to Y_SPAN times the peak radiance. Planck's law is self-similar — B/B_peak depends
// only on λ/λ_peak — so in that frame the active curve is the same shape at every
// temperature, and what moves instead is everything around it: the tick marks (Wien's law on
// the x-axis, the T⁵ growth of the peak on the y-axis), the band of visible light sliding
// along the wavelength axis, and a family of gray reference curves for familiar objects that
// swell into the frame, get labelled at their peak while they are legible, and shoot out
// through the top as the slider passes them.
//
// Nothing here is animated by timers except the temperature itself, which eases toward the
// slider's value. Tick opacity, label opacity and every position are pure functions of the
// displayed temperature (see lodTicks), so the axes breathe in and out smoothly under a drag
// and retrace exactly when the drag reverses.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page. The physics is
// exported so the page text (and anyone checking the maths) can call the same functions the
// figure is drawn with.
//
// Inspired by David Ward's "Blackbody Radiation interactive" (https://space-charts.vercel.app/,
// https://github.com/gendelbendel/space-charts), whose Planck function this one was checked
// against; the constants, the window, the colour model and the reference objects differ.

// Exact SI values (2019 redefinition).
const H = 6.62607015e-34;  // Planck constant, J·s
const C = 299792458;       // speed of light, m/s
const KB = 1.380649e-23;   // Boltzmann constant, J/K

const C2 = (H * C) / KB;   // second radiation constant hc/k, m·K
// Root of x = 5(1 − e^−x): where the wavelength form of Planck's law peaks, in units of kT.
const WIEN_X = 4.965114231744276;
export const WIEN_B = C2 / WIEN_X; // Wien's displacement constant, 2.897771955e-3 m·K
export const SIGMA = (2 * Math.PI ** 5 * KB ** 4) / (15 * H ** 3 * C ** 2); // 5.670374419e-8 W·m⁻²·K⁻⁴

// Spectral radiance B_λ(λ, T) in W·m⁻²·sr⁻¹·m⁻¹, with λ in metres and T in kelvin. expm1
// rather than exp − 1 keeps the long-wavelength (Rayleigh–Jeans) tail accurate, where the
// exponent is small and the subtraction would cancel most of its digits.
export function planck(lambda, T) {
  if (!(lambda > 0) || !(T > 0)) return 0;
  const x = C2 / (lambda * T);
  if (x > 700) return 0; // e^x overflows; the true value is below 1e-290 of the peak
  return (2 * H * C * C) / lambda ** 5 / Math.expm1(x);
}

export const peakWavelength = T => WIEN_B / T;         // m
export const peakRadiance = T => planck(WIEN_B / T, T); // ∝ T⁵
export const radiantExitance = T => SIGMA * T ** 4;     // W·m⁻², all wavelengths, whole hemisphere

// Fraction of a black body's total power emitted at wavelengths shorter than λ. The integral
// of Planck's law from 0 to λ has no closed form, but with x = hc/λkT it is the rapidly
// converging series (15/π⁴) Σₙ e^(−nx) (x³/n + 3x²/n² + 6x/n³ + 6/n⁴).
export function fractionBelow(lambda, T) {
  if (!(lambda > 0)) return 0;
  const x = C2 / (lambda * T);
  let sum = 0;
  for (let n = 1; n <= 400; n++) {
    const term = Math.exp(-n * x) * (x ** 3 / n + (3 * x * x) / n ** 2 + (6 * x) / n ** 3 + 6 / n ** 4);
    sum += term;
    if (term < 1e-13 * sum) break;
  }
  return Math.min(1, (15 / Math.PI ** 4) * sum);
}

// The visible band. Its edges are conventions rather than physics; these are the ones
// Wikipedia's "Visible spectrum" article uses.
const VIS_LO = 380e-9, VIS_HI = 750e-9;

export function bandShares(T) {
  const uv = fractionBelow(VIS_LO, T);
  const upToRed = fractionBelow(VIS_HI, T);
  return {ultraviolet: uv, visible: upToRed - uv, infrared: 1 - upToRed};
}

// CIE 1931 2° colour-matching functions, from the multi-lobe Gaussian fit of Wyman, Sloan &
// Shirley (2013), "Simple analytic approximations to the CIE XYZ color matching functions",
// JCGT 2(2). λ in nanometres.
function cieXYZ(nm) {
  const g = (mu, s1, s2) => {
    const t = (nm - mu) / (nm < mu ? s1 : s2);
    return Math.exp(-0.5 * t * t);
  };
  return [
    1.056 * g(599.8, 37.9, 31.0) + 0.362 * g(442.0, 16.0, 26.7) - 0.065 * g(501.1, 20.4, 26.2),
    0.821 * g(568.8, 46.9, 40.5) + 0.286 * g(530.9, 16.3, 31.1),
    1.217 * g(437.0, 11.8, 36.0) + 0.681 * g(459.0, 26.0, 13.8),
  ];
}

// XYZ to linear sRGB (D65), with the largest channel scaled to 1. A negative channel means a
// colour more saturated than the screen can show. For a black body that only happens below
// about 1900 K, by a hair, and the channel is clipped to 0. A pure spectral colour is far
// outside the gamut, and clipping would flatten the spectrum into three slabs of blue, green
// and red; `desaturate` instead adds just enough white to lift the lowest channel to 0,
// which keeps the hue and so keeps the cyans and yellows in between.
function xyzToUnitRgb([X, Y, Z], desaturate = false) {
  let rgb = [
    3.2406 * X - 1.5372 * Y - 0.4986 * Z,
    -0.9689 * X + 1.8758 * Y + 0.0415 * Z,
    0.0557 * X - 0.204 * Y + 1.057 * Z,
  ];
  const floor = Math.min(0, ...rgb);
  rgb = rgb.map(v => (desaturate ? v - floor : Math.max(0, v)));
  const m = Math.max(...rgb) || 1;
  return rgb.map(v => v / m);
}

const srgbEncode = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// The hue of a black body at temperature T, at full brightness: Planck's law weighted by the
// colour-matching functions and integrated across the visible. Returns [r, g, b] in 0–255.
export function blackbodyRgb(T) {
  const xyz = [0, 0, 0];
  for (let nm = 380; nm <= 780; nm += 5) {
    const b = planck(nm * 1e-9, T);
    const cmf = cieXYZ(nm);
    for (let i = 0; i < 3; i++) xyz[i] += b * cmf[i];
  }
  return xyzToUnitRgb(xyz).map(v => Math.round(255 * srgbEncode(v)));
}

// How bright that hue is shown, 0 to 1. Real visible output climbs by many orders of
// magnitude between a kettle and a filament, far more than a screen can show, so this is a
// display choice, not physics: black until just short of the Draper point (798 K, where a
// solid first shows a dim red glow), full brightness from 1400 K.
const GLOW_FROM = 650, GLOW_FULL = 1400;
export const glow = T => smoothstep(GLOW_FROM, GLOW_FULL, T);

export function blackbodyCss(T) {
  const k = glow(T);
  const [r, g, b] = blackbodyRgb(T).map(v => Math.round(v * k));
  return `rgb(${r},${g},${b})`;
}

// Reference objects, coldest first. Temperatures are sourced on the widget's page. Real
// objects are not perfect black bodies — a flame or a gas least of all — so each gray curve
// is the black body at that object's temperature, which is an upper bound on what the
// object itself emits.
export const OBJECTS = [
  {name: "Mars", T: 210},
  {name: "Earth from space", T: 255},
  {name: "Ice", T: 273},
  {name: "Earth's surface", T: 288},
  {name: "Human body", T: 306},
  {name: "Kettle", T: 373},
  {name: "Oven", T: 523},
  {name: "First red glow", T: 798},
  {name: "Cigarette", T: 1100},
  {name: "Lava", T: 1450},
  {name: "Molten iron", T: 1811},
  {name: "Light bulb", T: 2700},
  {name: "Betelgeuse", T: 3600},
  {name: "Sun", T: 5772},
  {name: "Sirius", T: 9940},
  {name: "Rigel", T: 12100},
];

const T_MIN = 180, T_MAX = 20000;
const X_SPAN = 5;   // x-axis runs from 0 to this many peak wavelengths
const Y_SPAN = 1.5; // y-axis runs from 0 to this many peak radiances
const SAMPLES = 360;

const ACCENT = "#0b57d0"; // the blue a default range slider paints its track and thumb
const FOLLOW_TAU = 80;    // ms; how closely the displayed temperature trails a drag or a key

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH it
// stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0; // gradient and clip-path ids must be unique per page, not per widget

export function createBlackbodyRadiationWidget({temperature = 5772, width = FIGURE_WIDTH} = {}) {
  const uid = `blackbody-radiation-${++instances}`;

  // Vertical layout is constant, so the SVG's height never changes; only horizontal metrics
  // and fonts are recomputed on resize (applyLayout, below).
  const plotT = 28, plotH = 330, plotB = plotT + plotH;
  const trackY = plotB + 68; // slider centre line, clear of the x-axis ticks and title
  const trackH = 8, handleR = 9;
  const totalH = trackY + 40;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont, sliderFont, xTickGap;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(46, 56);
    plotR = w - lerp(12, 18);
    plotW = plotR - plotL;
    tickFont = lerp(9, 11);
    labelFont = lerp(10, 12);
    titleFont = lerp(10, 12);
    sliderFont = lerp(12, 14);
    xTickGap = lerp(34, 42); // px between x ticks at which a tick level starts to appear
  }
  applyLayout(maxW);

  // State. `target` is what the slider says; `shown` is what the figure is drawn at, and
  // eases toward it. Both live in ln T, the scale the slider is linear in and the one in
  // which a constant speed looks constant on these axes.
  const lnMin = Math.log(T_MIN), lnMax = Math.log(T_MAX);
  let target = clamp(temperature, T_MIN, T_MAX);
  let shownLn = Math.log(target);
  let dragging = false;
  let raf = null, lastFrame = 0, tween = null;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // No role="img": like the Six Americas figure, this SVG is keyboard-focusable and behaves
  // as a slider, so an aria-label kept current in updateTarget (below) is what it exposes.
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "blackbody-radiation");
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
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:4.2em;line-height:1.4;";
  container.appendChild(status);

  const chipBar = document.createElement("div");
  chipBar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;padding:8px 0 0;";
  container.appendChild(chipBar);

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  hint.textContent =
    "Drag the slider or pick an object. With the figure focused, ← and → change the " +
    "temperature by 1% (10% with Shift); Page Up and Page Down step between the objects.";
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- scales -------------------------------------------------------------------------------
  // u = λ/λ_peak and v = B/B_peak of the displayed temperature: the frame's own coordinates.
  const ux = u => plotL + (u / X_SPAN) * plotW;
  const vy = v => plotB - (v / Y_SPAN) * plotH;
  const sliderX = T => plotL + ((Math.log(T) - lnMin) / (lnMax - lnMin)) * plotW;
  const sliderT = px => Math.exp(lnMin + clamp((px - plotL) / plotW, 0, 1) * (lnMax - lnMin));

  // Sample positions in u, squared so they crowd toward the origin: that is where a hotter
  // reference curve has its whole rising limb, compressed into a few pixels.
  const US = Array.from({length: SAMPLES + 1}, (_, i) => X_SPAN * (i / SAMPLES) ** 2);

  // Path of the black body at Tref, in the frame of the displayed temperature T.
  function curvePath(Tref, T, close) {
    const lamPeak = peakWavelength(T), bPeak = peakRadiance(T);
    let d = "";
    for (let i = 0; i <= SAMPLES; i++) {
      const v = Math.min(1e3, planck(US[i] * lamPeak, Tref) / bPeak); // clipped far above the frame
      d += `${i ? "L" : "M"}${ux(US[i]).toFixed(1)},${vy(v).toFixed(1)}`;
    }
    return close ? `${d}L${plotR},${plotB}L${plotL},${plotB}Z` : d;
  }

  // ---- static scaffolding, rebuilt on resize ------------------------------------------------
  let refPaths, refLabels, curve, curveFill, curveLabel, visTint, visUnder, visStrip, visGrad;
  let visLabelIn, visLabelOut, uvLabel, irLabel, xTickG, yTickG;
  let handleG, handleDot, focusRing, sliderLabel, endLabels;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();

    const defs = svgEl("defs", {}, svg);
    svgEl("rect", {x: plotL, y: plotT, width: plotW, height: plotH},
      svgEl("clipPath", {id: `${uid}-plot`}, defs));
    // The active curve never moves in this frame, so the region under it is a fixed clip.
    svgEl("path", {d: curvePath(1000, 1000, true)}, svgEl("clipPath", {id: `${uid}-under`}, defs));

    // The spectrum, one stop per 10 nm. Hue from the colour-matching functions; the ends
    // fade to transparent the way the eye's sensitivity does, instead of to black.
    visGrad = svgEl("linearGradient", {id: `${uid}-vis`, gradientUnits: "userSpaceOnUse", y1: 0, y2: 0}, defs);
    for (let nm = 380; nm <= 750; nm += 10) {
      const [r, g, b] = xyzToUnitRgb(cieXYZ(nm), true).map(v => Math.round(255 * srgbEncode(v)));
      const a = Math.min(smoothstep(380, 430, nm), 1 - smoothstep(670, 750, nm));
      svgEl("stop", {
        offset: (nm - 380) / 370, "stop-color": `rgb(${r},${g},${b})`, "stop-opacity": a.toFixed(3),
      }, visGrad);
    }

    // The slider track is the black-body colour scale itself.
    const trackGrad = svgEl("linearGradient", {
      id: `${uid}-track`, gradientUnits: "userSpaceOnUse", x1: plotL, x2: plotR, y1: 0, y2: 0,
    }, defs);
    for (let i = 0; i <= 48; i++) {
      svgEl("stop", {offset: i / 48, "stop-color": blackbodyCss(sliderT(plotL + (i / 48) * plotW))}, trackGrad);
    }

    // Plot contents, bottom to top: visible band, gridlines, references, active curve, labels.
    const plot = svgEl("g", {"clip-path": `url(#${uid}-plot)`}, svg);
    visTint = svgEl("rect", {y: plotT, height: plotH, fill: `url(#${uid}-vis)`, opacity: 0.1}, plot);
    yTickG = svgEl("g", {}, svg);
    xTickG = svgEl("g", {}, svg);

    const refs = svgEl("g", {"clip-path": `url(#${uid}-plot)`, fill: "none", "stroke-width": 1}, svg);
    refPaths = OBJECTS.map(() => svgEl("path", {}, refs));

    const active = svgEl("g", {"clip-path": `url(#${uid}-plot)`}, svg);
    curveFill = svgEl("path", {d: curvePath(1000, 1000, true), fill: "rgba(0,0,0,0.04)"}, active);
    visUnder = svgEl("rect", {
      y: plotT, height: plotH, fill: `url(#${uid}-vis)`, opacity: 0.85, "clip-path": `url(#${uid}-under)`,
    }, active);
    visStrip = svgEl("rect", {y: plotB - 4, height: 4, fill: `url(#${uid}-vis)`}, active);
    curve = svgEl("path", {
      d: curvePath(1000, 1000, false), fill: "none", stroke: "#222", "stroke-width": 2, "stroke-linejoin": "round",
    }, active);

    svgEl("line", {x1: plotL, x2: plotL, y1: plotT, y2: plotB, stroke: "#666"}, svg);
    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#666"}, svg);

    const halo = {stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};
    const bandLabel = () => svgEl("text", {y: plotT + 13, "font-size": tickFont, fill: "#777", ...halo}, svg);
    uvLabel = bandLabel(); uvLabel.textContent = "ultraviolet";
    irLabel = bandLabel(); irLabel.textContent = "infrared";
    visLabelIn = bandLabel(); visLabelIn.textContent = "visible";
    visLabelOut = bandLabel(); visLabelOut.textContent = "← visible";
    for (const el of [uvLabel, irLabel, visLabelIn]) el.setAttribute("text-anchor", "middle");

    refLabels = OBJECTS.map(o => {
      const t = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, fill: "#555", ...halo}, svg);
      t.textContent = o.name;
      return t;
    });
    curveLabel = svgEl("text", {
      "text-anchor": "middle", "font-size": labelFont + 1, "font-weight": "bold", fill: "#222", ...halo,
    }, svg);

    const yTitle = svgEl("text", {x: 0, y: 12, "font-size": titleFont, fill: "#555"}, svg);
    yTitle.textContent = "↑ Spectral radiance (W·m⁻²·sr⁻¹·µm⁻¹)";
    const xTitle = svgEl("text", {x: plotR, y: plotB + 36, "text-anchor": "end", "font-size": titleFont, fill: "#555"}, svg);
    xTitle.textContent = "Wavelength (µm) →";

    // Slider: the track, a tick per reference object, end labels, handle.
    svgEl("rect", {
      x: plotL - trackH / 2, y: trackY - trackH / 2, width: plotW + trackH, height: trackH, rx: trackH / 2,
      fill: `url(#${uid}-track)`, stroke: "#888", "stroke-width": 0.75,
    }, svg);
    for (const o of OBJECTS) {
      const px = sliderX(o.T);
      svgEl("line", {x1: px, x2: px, y1: trackY - 13, y2: trackY - 8, stroke: "#888", "stroke-width": 1}, svg);
    }
    endLabels = [[plotL, "start", T_MIN], [plotR, "end", T_MAX]].map(([x, anchor, T]) => {
      const t = svgEl("text", {x, y: trackY + handleR + 16, "text-anchor": anchor, "font-size": tickFont, fill: "#888"}, svg);
      t.textContent = formatK(T);
      return t;
    });

    handleG = svgEl("g", {}, svg);
    focusRing = svgEl("circle", {r: handleR + 4, fill: "none", stroke: hexToRgba(ACCENT, 0.35), "stroke-width": 3}, handleG);
    focusRing.style.display = document.activeElement === svg ? "" : "none";
    svgEl("circle", {r: handleR + 1, fill: "#fff", stroke: "#444", "stroke-width": 1}, handleG);
    handleDot = svgEl("circle", {r: handleR - 2}, handleG);
    sliderLabel = svgEl("text", {
      y: trackY + handleR + 17, "text-anchor": "middle", "font-size": sliderFont, "font-weight": "bold", fill: "#222",
    }, svg);

    render();
  }

  // ---- ticks --------------------------------------------------------------------------------
  // Level-of-detail ticks on an axis from 0 to `domain`, `length` px long. Tick values come
  // from the 1–2–5 ladder; a level starts to appear when its ticks are `gap` px apart and is
  // fully opaque at 1.8 × gap, so as the domain grows ticks slide toward the origin, the
  // finest level fades out as it crowds, and coarser ones take over — all as a function of
  // the domain alone, with no timers, so it is smooth under a drag and exactly reversible.
  //
  // The ladder is not nested at one rung: multiples of 5 are not multiples of 2. Shown
  // together they would put 4, 5 and 6 side by side, so the 5-level waits for the 2-level
  // to go: its weight is multiplied by (1 − the 2-level's weight), a cross-fade.
  function lodTicks(domain, length, gap) {
    const full = 1.8 * gap;
    const n0 = Math.floor(Math.log10((gap * domain) / length)); // decade just too fine to show
    const unit = 10 ** n0;
    const pxPer = (unit * length) / domain;
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const raw = steps.map(s => smoothstep(gap, full, s * pxPer));
    const weight = steps.map((s, i) => (i % 3 === 2 ? raw[i] * (1 - raw[i - 1]) : raw[i]));

    const ticks = [];
    const last = Math.floor(domain / unit + 1e-9);
    for (let k = 0; k <= last; k++) {
      let opacity = k === 0 ? 1 : 0;
      for (let i = 0; i < steps.length && opacity < 1; i++) {
        if (k % steps[i] === 0) opacity = Math.max(opacity, weight[i]);
      }
      // Ticks fade in over the last few pixels before the far end rather than popping in.
      opacity *= clamp((length - k * pxPer) / 14, 0, 1);
      if (opacity > 0.01) ticks.push({value: Number((k * unit).toPrecision(12)), pos: k * pxPer, opacity});
    }
    return ticks;
  }

  // Elements are pooled by index and rewritten each frame; nothing relies on their identity.
  function drawTicks(g, ticks, place) {
    while (g.children.length < ticks.length) {
      const item = svgEl("g", {}, g);
      svgEl("line", {stroke: "#000", "stroke-width": 1}, item);
      svgEl("line", {stroke: "#666", "stroke-width": 1}, item);
      svgEl("text", {"font-size": tickFont, fill: "#666"}, item);
    }
    [...g.children].forEach((item, i) => {
      if (i >= ticks.length) { item.style.display = "none"; return; }
      item.style.display = "";
      item.setAttribute("opacity", ticks[i].opacity.toFixed(3));
      place(item.children[0], item.children[1], item.children[2], ticks[i]);
    });
  }

  function placeY(grid, tick, text, t) {
    const y = (plotB - t.pos).toFixed(1);
    setAttrs(grid, {x1: plotL, x2: plotR, y1: y, y2: y, "stroke-opacity": t.value ? 0.1 : 0});
    setAttrs(tick, {x1: plotL - 5, x2: plotL, y1: y, y2: y});
    setAttrs(text, {x: plotL - 8, y, "text-anchor": "end", "dominant-baseline": "middle"});
    text.textContent = formatRadiance(t.value);
  }

  function placeX(grid, tick, text, t) {
    const x = (plotL + t.pos).toFixed(1);
    setAttrs(grid, {x1: x, x2: x, y1: plotT, y2: plotB, "stroke-opacity": t.value ? 0.06 : 0});
    setAttrs(tick, {x1: x, x2: x, y1: plotB, y2: plotB + 5});
    setAttrs(text, {x, y: plotB + 18, "text-anchor": "middle"});
    text.textContent = String(t.value);
  }

  // ---- per-frame drawing: everything that depends on the displayed temperature --------------
  function render() {
    const T = Math.exp(shownLn);
    const lamPeakUm = peakWavelength(T) * 1e6;

    drawTicks(yTickG, lodTicks(Y_SPAN * peakRadiance(T) * 1e-6, plotH, 24), placeY);
    drawTicks(xTickG, lodTicks(X_SPAN * lamPeakUm, plotW, xTickGap), placeX);

    // Visible band, in pixels. Unclamped on purpose: the gradient must keep its true extent
    // even when part of the band is outside the frame, and the plot clip trims the rest.
    const v0 = ux(VIS_LO * 1e6 / lamPeakUm), v1 = ux(VIS_HI * 1e6 / lamPeakUm);
    setAttrs(visGrad, {x1: v0.toFixed(1), x2: v1.toFixed(1)});
    for (const r of [visTint, visUnder, visStrip]) setAttrs(r, {x: v0.toFixed(1), width: (v1 - v0).toFixed(1)});

    // Band names along the top. "visible" sits inside its band while it fits, and steps out
    // to the right with an arrow when the band is a sliver; the two cross-fade on band width.
    const bandW = v1 - v0, fits = smoothstep(40, 56, bandW);
    const visRight = Math.min(v1, plotR), visLeft = Math.max(v0, plotL);
    setAttrs(visLabelIn, {x: ((visLeft + visRight) / 2).toFixed(1), opacity: (fits * smoothstep(40, 56, visRight - visLeft)).toFixed(3)});
    setAttrs(visLabelOut, {x: (v1 + 4).toFixed(1), opacity: (1 - fits).toFixed(3)});
    setAttrs(uvLabel, {x: ((plotL + v0) / 2).toFixed(1), opacity: smoothstep(64, 96, v0 - plotL).toFixed(3)});
    const irFrom = v1 + (1 - fits) * 56; // leave room for "← visible" when it is showing
    setAttrs(irLabel, {x: ((irFrom + plotR) / 2).toFixed(1), opacity: smoothstep(60, 90, plotR - irFrom).toFixed(3)});

    // The active curve's own label: the temperature, and the object's name when it is one.
    // Set first, because the reference labels below are laid out around it.
    // Rounded only while gliding: once settled it is the target, which may be an object's
    // exact temperature (5772 K, not 5770 K).
    const Tround = Math.abs(T - target) < 0.5 ? target : roundK(T);
    const match = OBJECTS.find(o => Math.abs(o.T - T) < 0.5);
    curveLabel.textContent = match ? `${match.name} · ${formatK(match.T)}` : formatK(Tround);
    const ownHalf = labelHalfWidth(curveLabel.textContent, labelFont + 1);
    const ownX = clamp(ux(1), plotL + ownHalf + 3, plotR - ownHalf - 3), ownY = vy(1) - 8;
    setAttrs(curveLabel, {x: ownX.toFixed(1), y: ownY.toFixed(1)});

    // Reference curves and their labels. p is a reference's peak height and 1/r its peak
    // position, both in units of the active curve's.
    const placed = [{x: ownX, y: ownY, half: ownHalf}];
    const order = OBJECTS.map((o, i) => ({o, i, r: o.T / T})).sort((a, b) => Math.abs(Math.log(a.r)) - Math.abs(Math.log(b.r)));
    for (const {o, i, r} of order) {
      const p = r ** 5;
      // Flatter than a pixel, or so hot that even its tail clears the top of the frame.
      const visible = p * plotH / Y_SPAN > 0.5 && r < 40;
      refPaths[i].style.display = visible ? "" : "none";
      let opacity = 0;
      if (visible) {
        // Legible means the peak is inside the frame and the curve is not pressed flat.
        opacity = smoothstep(0.05, 0.11, p) * (1 - smoothstep(1.22, 1.4, p));
        const half = labelHalfWidth(o.name, labelFont);
        const x = clamp(ux(1 / r), plotL + half + 3, plotR - half - 3), y = vy(p) - 7;
        // Closest-in-temperature labels are placed first; a later one that would overprint
        // an earlier one fades out in proportion to how much they overlap vertically.
        for (const q of placed) {
          if (Math.abs(q.x - x) < q.half + half + 4) opacity *= smoothstep(9, 15, Math.abs(q.y - y));
        }
        if (opacity > 0.01) placed.push({x, y, half});
        setAttrs(refLabels[i], {x: x.toFixed(1), y: y.toFixed(1)});
        refPaths[i].setAttribute("d", curvePath(o.T, T, false));
        // Unlabelled curves stay in view but recede, so a fan of hotter objects crossing the
        // frame reads as background and the one or two labelled neighbours stand out.
        refPaths[i].setAttribute("stroke", mixGray(0xd0, 0x80, opacity));
      }
      refLabels[i].setAttribute("opacity", opacity.toFixed(3));
    }

    // The handle tracks the pointer exactly while dragging, and the figure otherwise.
    const hx = sliderX(dragging ? target : T);
    handleG.setAttribute("transform", `translate(${hx.toFixed(1)},${trackY})`);
    handleDot.setAttribute("fill", blackbodyCss(dragging ? target : T));
    const lx = clamp(hx, plotL + 24, plotR - 24);
    sliderLabel.setAttribute("x", lx.toFixed(1));
    sliderLabel.textContent = formatK(dragging ? target : Tround);
    endLabels[0].setAttribute("opacity", smoothstep(70, 100, lx - plotL).toFixed(3));
    endLabels[1].setAttribute("opacity", smoothstep(80, 110, plotR - lx).toFixed(3));
  }

  // ---- status line and chips: depend on the target only, so they do not flicker mid-glide ---
  const swatch = document.createElement("span");
  swatch.style.cssText =
    "display:inline-block;width:1.15em;height:1.15em;border-radius:4px;background:#111;" +
    "vertical-align:-0.22em;margin-right:0.4em;position:relative;";
  const swatchDot = document.createElement("span");
  swatchDot.style.cssText = "position:absolute;inset:3px;border-radius:50%;";
  swatch.appendChild(swatchDot);
  const statusHead = document.createElement("strong");
  statusHead.style.color = "#222";
  const statusBody = document.createElement("span");
  status.append(swatch, statusHead, statusBody);

  const chips = OBJECTS.map(o => {
    const b = document.createElement("button");
    b.type = "button";
    b.style.cssText =
      "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
      "padding:3px 10px 3px 6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;";
    const dot = document.createElement("span");
    const c = blackbodyCss(o.T);
    dot.style.cssText =
      `width:12px;height:12px;border-radius:50%;background:${c};border:2px solid #111;box-sizing:border-box;` +
      `box-shadow:0 0 0 1px #111${glow(o.T) > 0.05 ? `,0 0 5px ${c}` : ""};`;
    const temp = document.createElement("span");
    temp.style.cssText = "color:#888;font-size:12px;";
    temp.textContent = formatK(o.T);
    b.append(dot, o.name, temp);
    b.addEventListener("click", () => setTarget(o.T, "tween"));
    chipBar.appendChild(b);
    return b;
  });

  function updateTarget() {
    const T = target;
    const lam = peakWavelength(T);
    const where = lam < VIS_LO ? "in the ultraviolet" : lam <= VIS_HI ? "in the visible" : "in the infrared";
    const s = bandShares(T);
    const match = OBJECTS.find(o => o.T === T);
    const glowing = glow(T) > 0.02;

    swatchDot.style.background = blackbodyCss(T);
    swatchDot.style.boxShadow = glowing ? `0 0 4px ${blackbodyCss(T)}` : "none";
    statusHead.textContent = `${formatK(T)} (${formatC(T)})${match ? ` — ${match.name}` : ""}. `;
    const text =
      `Peak at ${formatWavelength(lam)}, ${where}. Radiates ${formatPower(radiantExitance(T))} per m² of ` +
      `surface: ${formatShare(s.ultraviolet)} ultraviolet, ${formatShare(s.visible)} visible, ` +
      `${formatShare(s.infrared)} infrared.` + (glowing ? "" : " No visible glow: too cold to see by its own light.");
    statusBody.textContent = text;
    svg.setAttribute("aria-label",
      `Black-body spectrum at ${formatK(T)}${match ? `, ${match.name}` : ""}. ${text} ` +
      "Arrow keys change the temperature; Page Up and Page Down step between reference objects.");

    chips.forEach((b, i) => {
      const on = OBJECTS[i].T === T;
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.setAttribute("aria-pressed", on);
    });
  }

  // ---- motion -------------------------------------------------------------------------------
  // "follow": the figure trails the slider with a short exponential lag, so a drag, a key
  // press or a click on the track all glide. "tween": a fixed-duration ease for the chips,
  // long enough to watch the axes travel across several decades.
  function setTarget(T, mode) {
    T = clamp(T, T_MIN, T_MAX);
    if (T !== target) {
      target = T;
      updateTarget();
      emit();
    }
    const to = Math.log(target);
    if (reduceMotion || mode === "none") {
      shownLn = to;
      tween = null;
      render();
      return;
    }
    tween = mode === "tween"
      ? {from: shownLn, to, start: performance.now(), duration: clamp(350 + 450 * Math.abs(to - shownLn), 350, 1600)}
      : null;
    if (raf === null) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
    if (dragging) render(); // the handle must not wait for the next frame
  }

  function frame(now) {
    raf = null;
    // A cell that re-runs leaves the previous widget detached; do not keep animating it.
    if (container.isConnected === false) return;
    const to = Math.log(target);
    if (tween) {
      const s = clamp((now - tween.start) / tween.duration, 0, 1);
      shownLn = tween.from + (tween.to - tween.from) * easeInOutCubic(s);
      if (s >= 1) tween = null;
    } else {
      shownLn += (to - shownLn) * (1 - Math.exp(-(now - lastFrame) / FOLLOW_TAU));
    }
    lastFrame = now;
    const settled = !tween && Math.abs(to - shownLn) < 2e-4;
    if (settled) shownLn = to;
    render();
    if (!settled) raf = requestAnimationFrame(frame);
  }

  // ---- input --------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (totalH / r.height)};
  }
  const overSlider = py => Math.abs(py - trackY) <= 20;

  // A reference object within a few pixels of the pointer wins, so its exact temperature
  // can be reached by dragging; otherwise the value is rounded to about three figures.
  function temperatureAt(px) {
    let best = null, bestDist = 2.5;
    for (const o of OBJECTS) {
      const d = Math.abs(sliderX(o.T) - px);
      if (d <= bestDist) { best = o; bestDist = d; }
    }
    return best ? best.T : roundK(sliderT(px));
  }

  svg.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    if (!overSlider(py)) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    svg.focus();
    setTarget(temperatureAt(px), "follow");
    render(); // even if the temperature did not change, the handle now follows the pointer
    e.preventDefault();
  });

  svg.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (!dragging) {
      svg.style.cursor = overSlider(py) ? "ew-resize" : "default";
      return;
    }
    setTarget(temperatureAt(px), "follow");
  });

  for (const type of ["pointerup", "pointercancel"]) {
    svg.addEventListener(type, e => {
      if (!dragging) return;
      dragging = false;
      svg.releasePointerCapture(e.pointerId);
      render();
    });
  }

  svg.addEventListener("keydown", e => {
    const factor = e.shiftKey ? 1.1 : 1.01;
    let T = target;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") T = roundK(target / factor, target, -1);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") T = roundK(target * factor, target, 1);
    else if (e.key === "PageDown") T = [...OBJECTS].reverse().find(o => o.T < target)?.T ?? T_MIN;
    else if (e.key === "PageUp") T = OBJECTS.find(o => o.T > target)?.T ?? T_MAX;
    else if (e.key === "Home") T = T_MIN;
    else if (e.key === "End") T = T_MAX;
    else return;
    e.preventDefault();
    setTarget(T, e.key.startsWith("Page") || e.key === "Home" || e.key === "End" ? "tween" : "follow");
  });

  svg.addEventListener("focus", () => { focusRing.style.display = ""; });
  svg.addEventListener("blur", () => { focusRing.style.display = "none"; });

  function value() {
    const s = bandShares(target);
    return {
      temperature: target,
      object: OBJECTS.find(o => o.T === target)?.name ?? null,
      peakWavelength: peakWavelength(target),   // m
      peakRadiance: peakRadiance(target),       // W·m⁻²·sr⁻¹·m⁻¹
      radiantExitance: radiantExitance(target), // W·m⁻²
      ...s,
    };
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  updateTarget();
  build();
  container.value = value();

  // Reflow with the container; synchronous in the callback, and zero-width readings are
  // ignored (a detached or hidden container measures zero, which is not "no room").
  // Resizing never emits "input": the temperature is unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); build(); }
    });
    ro.observe(container);
  }

  return container;
}

// ---- formatting -------------------------------------------------------------------------------

const SUPERSCRIPT = "⁰¹²³⁴⁵⁶⁷⁸⁹";

// Radiance tick labels: plain below 10,000, otherwise mantissa × 10ⁿ in real superscripts.
function formatRadiance(v) {
  if (v === 0) return "0";
  if (v < 1e4) return String(v);
  const exp = Math.floor(Math.log10(v) + 1e-9);
  const mant = Number((v / 10 ** exp).toPrecision(3));
  const sup = String(exp).split("").map(d => SUPERSCRIPT[d]).join("");
  return `${mant === 1 ? "" : `${mant}×`}10${sup}`;
}

function formatK(T) {
  return `${Math.round(T).toLocaleString("en-US")} K`;
}

function formatC(T) {
  return `${Math.round(T - 273.15).toLocaleString("en-US")} °C`.replace("-", "−");
}

function formatWavelength(lambda) {
  const um = lambda * 1e6;
  return um < 1 ? `${um.toPrecision(3)} µm (${Math.round(um * 1000)} nm)` : `${um.toPrecision(3)} µm`;
}

function formatPower(watts) {
  const units = [[1e9, "GW"], [1e6, "MW"], [1e3, "kW"], [1, "W"]];
  const [scale, unit] = units.find(([s]) => watts >= s) ?? units[3];
  return `${Number((watts / scale).toPrecision(3))} ${unit}`;
}

function formatShare(f) {
  const pct = 100 * f;
  if (pct < 0.05) return "0%";
  if (pct > 99.95) return "100%";
  return pct < 1 || pct > 99 ? `${pct.toFixed(1)}%` : `${Math.round(pct)}%`;
}

// Slider values are rounded to about three figures. `from` and `dir` make a key press always
// move: a 1% step from 200 K would otherwise round straight back to 200 K.
function roundK(T, from, dir) {
  const q = T < 1000 ? 1 : T < 10000 ? 10 : 100;
  let r = Math.round(T / q) * q;
  if (dir && r === from) r += dir * q;
  return r;
}

// ---- small helpers ----------------------------------------------------------------------------

function setAttrs(el, attrs) {
  for (const k in attrs) el.setAttribute(k, attrs[k]);
}

// Estimated, not measured: getBBox forces layout, and this runs for every label every frame.
function labelHalfWidth(text, fontSize) {
  return (text.length * fontSize * 0.56) / 2;
}

function mixGray(from, to, t) {
  const v = Math.round(from + (to - from) * t);
  return `rgb(${v},${v},${v})`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function smoothstep(e0, e1, v) {
  const t = clamp((v - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeInOutCubic(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
