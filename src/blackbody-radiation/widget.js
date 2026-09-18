// Black-body radiation — Planck's law as one curve of spectral radiance against wavelength,
// driven by a temperature slider that runs from a blue supergiant to the surface of Mars.
//
// The wavelength axis is fixed and logarithmic, and the slider lies along it. Wien's law puts
// the peak at λ = b/T, so on a log axis the peak's position is linear in log T: a slider that
// is linear in log T can be drawn on the wavelength axis itself, with its handle directly
// under the peak it controls. Dragging the handle drags the peak. The price is direction:
// wavelength grows to the right, so temperature grows to the left.
//
// A toggle swaps the log axis for a linear one, 0 to LINEAR_MAX μm, and the slider stays
// under the peak: it is always the wavelength scale read through Wien's law, whatever that
// scale is. Linear is the textbook picture, and it suits the hot end of the range. It also
// shows at once why the default is log: anything cooler than about 720 K peaks beyond the
// end of the axis, so its curve is not in the picture at all, and the slider, which can
// only reach the wavelengths the axis has, stops there too (the buttons and the keyboard
// still go colder). The switch is a morph, not a cut: the scale is a blend of the two,
// `mix`, eased from 0 to 1, so every curve, tick and label travels to its new place.
//
// Only the radiance axis follows the curve, running from 0 to Y_SPAN times the peak. The
// peak grows as T⁵, nine orders of magnitude over the slider's range, so its tick marks are
// level-of-detail (see lodTicks): their opacity and position are pure functions of the
// displayed temperature, with no timers, so the axis breathes in and out smoothly under a
// drag and retraces exactly when the drag reverses. Around the active curve sits a family of
// gray reference curves for familiar objects. On a log wavelength axis every one of them is
// the same shape, shifted sideways and scaled by T⁵, so as the slider passes them they swell
// up from the axis, get labelled at their peak while they are legible, and leave through the
// top. The only thing animated by a timer is the temperature itself, which eases toward the
// slider's value.
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
// The fixed wavelength axis, μm. The peak travels from 0.145 μm at T_MAX to 16 μm at T_MIN,
// and the curve has a short rise on the blue side of its peak and a long tail on the red
// side, so the axis needs margin at both ends, more on the right. But every decade of
// margin also shortens the slider, which only spans the stretch the peak can reach, so the
// margins are no wider than it takes for the curve to be down to about 1% at either edge.
const LAMBDA_MIN = 0.05, LAMBDA_MAX = 100;
// The linear alternative runs from 0 to this, μm. No choice holds both ends of the slider.
// This one is for the hot end: the Sun's curve fills the left third with its tail in view,
// a filament or molten iron fills the frame, and everything that peaks beyond 4 μm (cooler
// than 724 K, which includes the Earth) is simply off the axis.
const LINEAR_MAX = 4;
const MORPH_MS = 650;
const Y_SPAN = 1.5; // y-axis runs from 0 to this many peak radiances
const SAMPLES = 480;

const ACCENT = "#0b57d0"; // the blue a default range slider paints its track and thumb
const FOLLOW_TAU = 80;    // ms; how closely the displayed temperature trails a drag or a key

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH it
// stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0; // gradient and clip-path ids must be unique per page, not per widget

export function createBlackbodyRadiationWidget({temperature = 5772, scale = "log", width = FIGURE_WIDTH} = {}) {
  const uid = `blackbody-radiation-${++instances}`;

  // Vertical layout is constant, so the SVG's height never changes; only horizontal metrics
  // and fonts are recomputed on resize (applyLayout, below).
  const plotT = 28, plotH = 330, plotB = plotT + plotH;
  const trackY = plotB + 68; // slider centre line, clear of the x-axis ticks and title
  const trackH = 8, handleR = 9;
  const totalH = trackY + 40;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, tickFont, labelFont, titleFont, sliderFont, labelMinorTicks;

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
    // 2 and 5 are labelled between the decades only where there is room for them.
    labelMinorTicks = plotW / Math.log10(LAMBDA_MAX / LAMBDA_MIN) >= 110;
  }
  applyLayout(maxW);

  // State. `target` is what the slider says; `shown` is what the figure is drawn at, and
  // eases toward it, in ln T: the scale the slider is linear in, so a glide moves the peak
  // across the wavelength axis at a steady pace.
  let target = clamp(temperature, T_MIN, T_MAX);
  let shownLn = Math.log(target);
  let dragging = false;
  let raf = null, lastFrame = 0, tween = null;
  // The wavelength scale: 0 is log, 1 is linear, and in between only during a switch.
  let xScale = scale === "linear" ? "linear" : "log";
  let mix = xScale === "linear" ? 1 : 0, morph = null;
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

  const scaleBar = document.createElement("div");
  scaleBar.style.cssText =
    "display:flex;justify-content:flex-end;align-items:center;gap:6px;padding:0 0 6px;font-size:13px;color:#666;";
  scaleBar.append("Wavelength axis");
  const scaleButtons = ["log", "linear"].map((name, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name === "log" ? "Log" : "Linear";
    b.style.cssText =
      "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;" +
      `border-radius:${i ? "0 999px 999px 0" : "999px 0 0 999px"};${i ? "margin-left:-7px;" : ""}`;
    b.addEventListener("click", () => setScale(name));
    scaleBar.appendChild(b);
    return b;
  });
  function updateScaleButtons() {
    scaleButtons.forEach((b, i) => {
      const on = (i ? "linear" : "log") === xScale;
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.color = on ? ACCENT : "#333";
      b.style.position = "relative";
      b.style.zIndex = on ? 1 : 0;
      b.setAttribute("aria-pressed", on);
    });
  }
  updateScaleButtons();
  container.appendChild(scaleBar);

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
    "Drag the slider, drag the peak itself, or pick an object. With the figure focused, ← and → move the peak by " +
    "1% (10% with Shift), ↑ and ↓ make it hotter or cooler; Page Up and Page Down step " +
    "between the objects.";
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- scales -------------------------------------------------------------------------------
  // x is wavelength (μm in): log, linear, or mid-switch a blend of the two, which is still
  // monotonic, so still a scale. y is B/B_peak of the displayed temperature.
  const DECADES = Math.log10(LAMBDA_MAX / LAMBDA_MIN);
  const lx = um => {
    const asLog = mix < 1 ? Math.log10(Math.max(um, 1e-9) / LAMBDA_MIN) / DECADES : 0;
    return plotL + ((1 - mix) * asLog + mix * (um / LINEAR_MAX)) * plotW;
  };
  // Pixel to wavelength. Closed-form at rest; the blend has no inverse, so bisect.
  const lxInvert = px => {
    const f = (px - plotL) / plotW;
    if (mix === 0) return LAMBDA_MIN * 10 ** (f * DECADES);
    if (mix === 1) return Math.max(0, f * LINEAR_MAX);
    let lo = -6, hi = 4; // log10 μm
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (lx(10 ** mid) < px) lo = mid; else hi = mid;
    }
    return 10 ** lo;
  };
  const vy = v => plotB - (v / Y_SPAN) * plotH;
  // The slider is the same scale read through Wien's law: a temperature sits at its peak.
  const sliderX = T => lx(peakWavelength(T) * 1e6);
  const sliderT = px => clamp(WIEN_B * 1e6 / Math.max(lxInvert(px), 1e-9), T_MIN, T_MAX);

  // One sample per pixel column or so, with its wavelength; rebuilt with the layout.
  let xs, lams;

  // The temperature the radiance axis is sized for: its top is Y_SPAN times this body's peak.
  // On the log axis that is the displayed temperature itself, so the active curve always
  // fills the frame. On the linear axis it stops following once the peak passes the middle
  // of the axis (2 μm, 1449 K): a cooler body's curve is increasingly cut off by the right
  // edge, and a frame sized to a peak that is barely or not at all in view would inflate the
  // stump that is. Held at the last curve that sits comfortably inside the axis, the frame
  // lets cooler curves do what they really do, which is sink. Blended by `mix`, in log T, so
  // that a switch of scale carries the radiance axis across smoothly too.
  const Y_HOLD_LN = Math.log((WIEN_B * 1e6) / (LINEAR_MAX / 2));
  const yScaleT = lnT => Math.exp(lnT + mix * Math.max(0, Y_HOLD_LN - lnT));

  // Path of the black body at Tref, in a frame sized for the black body at Ty. Its own peak
  // is added to the samples: on the linear axis a star's whole curve is a few pixels wide,
  // and the columns either side of the peak would otherwise clip the top off it.
  function curvePath(Tref, Ty) {
    const bPeak = peakRadiance(Ty), lamRef = peakWavelength(Tref) * 1e6;
    let d = "", peakDone = false;
    const add = (x, v) => { d += `${d ? "L" : "M"}${x},${vy(Math.min(1e3, v)).toFixed(1)}`; }; // clipped far above the frame
    for (let i = 0; i <= SAMPLES; i++) {
      if (!peakDone && lams[i] > lamRef) {
        add(lx(lamRef).toFixed(1), peakRadiance(Tref) / bPeak);
        peakDone = true;
      }
      add(xs[i], planck(lams[i] * 1e-6, Tref) / bPeak);
    }
    return d;
  }

  // ---- static scaffolding, rebuilt on resize ------------------------------------------------
  let refPaths, refLabels, curve, curveFill, underClip, curveLabel, guide, yTickG;
  let handleG, handleDot, focusRing, sliderLabel, endLabels, trackL, trackR;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    xs = [];
    lams = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const px = plotL + (i / SAMPLES) * plotW;
      xs.push(px.toFixed(1));
      lams.push(lxInvert(px));
    }
    // The track covers the wavelengths the peak can reach, but no more than the axis has: on
    // the linear scale the cold end of the range peaks beyond the right edge.
    trackL = sliderX(T_MAX);
    trackR = Math.min(sliderX(T_MIN), plotR);
    const coldest = sliderT(trackR);
    const visL = lx(VIS_LO * 1e6), visR = lx(VIS_HI * 1e6);

    const defs = svgEl("defs", {}, svg);
    svgEl("rect", {x: plotL, y: plotT, width: plotW, height: plotH},
      svgEl("clipPath", {id: `${uid}-plot`}, defs));
    // The region under the active curve, which the spectrum is painted into.
    underClip = svgEl("path", {}, svgEl("clipPath", {id: `${uid}-under`}, defs));

    // The spectrum, one stop per 10 nm, placed by log wavelength like everything else. Hue
    // from the colour-matching functions; the ends fade to transparent the way the eye's
    // sensitivity does, instead of to black.
    const visGrad = svgEl("linearGradient", {
      id: `${uid}-vis`, gradientUnits: "userSpaceOnUse", x1: visL, x2: visR, y1: 0, y2: 0,
    }, defs);
    for (let nm = 380; nm <= 750; nm += 10) {
      const [r, g, b] = xyzToUnitRgb(cieXYZ(nm), true).map(v => Math.round(255 * srgbEncode(v)));
      const a = Math.min(smoothstep(380, 430, nm), 1 - smoothstep(670, 750, nm));
      svgEl("stop", {
        offset: ((lx(nm / 1000) - visL) / (visR - visL)).toFixed(4),
        "stop-color": `rgb(${r},${g},${b})`, "stop-opacity": a.toFixed(3),
      }, visGrad);
    }

    // The slider track is the black-body colour scale itself, hottest at the left.
    const trackGrad = svgEl("linearGradient", {
      id: `${uid}-track`, gradientUnits: "userSpaceOnUse", x1: trackL, x2: trackR, y1: 0, y2: 0,
    }, defs);
    // Stops are evenly spaced in log T and placed wherever the scale puts them, which on
    // the linear axis crowds the hot colours into the track's first few pixels.
    for (let i = 0; i <= 48; i++) {
      const T = Math.max(coldest, T_MAX * (T_MIN / T_MAX) ** (i / 48));
      svgEl("stop", {offset: ((sliderX(T) - trackL) / (trackR - trackL)).toFixed(4), "stop-color": blackbodyCss(T)}, trackGrad);
      if (T === coldest) break;
    }

    // Plot contents, bottom to top: visible band, gridlines, references, active curve, labels.
    const visRect = {x: visL.toFixed(1), width: (visR - visL).toFixed(1), fill: `url(#${uid}-vis)`};
    svgEl("rect", {...visRect, y: plotT, height: plotH, opacity: 0.1}, svg);
    yTickG = svgEl("g", {}, svg);

    // The peak-to-handle guide goes under the tick labels, whose halo then keeps them legible
    // where it crosses one.
    guide = svgEl("line", {y2: trackY - handleR - 2, stroke: "#999", "stroke-width": 1, "stroke-dasharray": "2 3"}, svg);

    const halo = {stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

    // Wavelength ticks. They only move during a switch of scale, so they are drawn here and
    // not per frame. Log: a long labelled tick per decade, short ones at 2 to 9 between
    // them. Linear: a labelled tick every 5 or 10 μm and a short one every 1. Mid-switch both
    // sets are drawn on the blended scale, cross-faded.
    const xTick = (um, major, label, labelFill, opacity) => {
      const px = lx(um);
      if (px < plotL - 0.5 || px > plotR + 0.5) return;
      const x = px.toFixed(1);
      const g = svgEl("g", {opacity: opacity.toFixed(3)}, svg);
      if (major) svgEl("line", {x1: x, x2: x, y1: plotT, y2: plotB, stroke: "#000", "stroke-opacity": 0.07}, g);
      svgEl("line", {x1: x, x2: x, y1: plotB, y2: plotB + (major ? 6 : 3), stroke: "#666"}, g);
      if (!label) return;
      const t = svgEl("text", {x, y: plotB + 18, "text-anchor": "middle", "font-size": tickFont, fill: labelFill, ...halo}, g);
      t.textContent = String(um);
    };
    if (mix < 1) {
      for (let n = Math.floor(Math.log10(LAMBDA_MIN)); n <= Math.ceil(Math.log10(LAMBDA_MAX)); n++) {
        for (let m = 1; m <= 9; m++) {
          const um = Number((m * 10 ** n).toPrecision(12));
          if (um < LAMBDA_MIN * 0.999 || um > LAMBDA_MAX * 1.001) continue;
          xTick(um, m === 1, m === 1 || (labelMinorTicks && (m === 2 || m === 5)), m === 1 ? "#444" : "#888", 1 - mix);
        }
      }
    }
    if (mix > 0) {
      const step = plotW / (LINEAR_MAX / 0.5) >= 44 ? 5 : 10; // in tenths of a μm
      for (let k = 0; k <= LINEAR_MAX * 10; k++) xTick(k / 10, k % step === 0, k % step === 0, "#444", mix);
    }

    const refs = svgEl("g", {"clip-path": `url(#${uid}-plot)`, fill: "none", "stroke-width": 1}, svg);
    refPaths = OBJECTS.map(() => svgEl("path", {}, refs));

    const active = svgEl("g", {"clip-path": `url(#${uid}-plot)`}, svg);
    curveFill = svgEl("path", {fill: "rgba(0,0,0,0.04)"}, active);
    svgEl("rect", {...visRect, y: plotT, height: plotH, opacity: 0.85, "clip-path": `url(#${uid}-under)`}, active);
    svgEl("rect", {...visRect, y: plotB - 4, height: 4}, active);
    curve = svgEl("path", {fill: "none", stroke: "#222", "stroke-width": 2, "stroke-linejoin": "round"}, active);

    svgEl("line", {x1: plotL, x2: plotL, y1: plotT, y2: plotB, stroke: "#666"}, svg);
    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#666"}, svg);

    // Band names along the top, each centred on its stretch of the axis while it fits there.
    // "visible" may overhang its band a little (it does at phone widths) but once the band
    // is a sliver, as on the linear axis, it steps out to the right behind an arrow, and
    // "infrared" makes room. All by smooth functions of the room available, so the labels
    // cross-fade during a switch of scale.
    const bandLabel = (text, x, anchor, opacity) => {
      if (opacity < 0.01) return;
      const t = svgEl("text", {
        x: x.toFixed(1), y: plotT + 13, "text-anchor": anchor, "font-size": tickFont, fill: "#777",
        opacity: opacity.toFixed(3), ...halo,
      }, svg);
      t.textContent = text;
    };
    const textW = text => 2 * labelHalfWidth(text, tickFont);
    const inBand = smoothstep(0.45, 0.6, (visR - visL) / textW("visible"));
    const irFrom = visR + (1 - inBand) * (textW("← visible") + 10);
    bandLabel("ultraviolet", (plotL + visL) / 2, "middle", smoothstep(1, 1.3, (visL - plotL) / textW("ultraviolet")));
    bandLabel("visible", (visL + visR) / 2, "middle", inBand);
    bandLabel("← visible", visR + 4, "start", 1 - inBand);
    bandLabel("infrared", (irFrom + plotR) / 2, "middle", smoothstep(1, 1.3, (plotR - irFrom) / textW("infrared")));

    refLabels = OBJECTS.map(o => {
      const t = svgEl("text", {"text-anchor": "middle", "font-size": labelFont, fill: "#555", ...halo}, svg);
      t.textContent = o.name;
      return t;
    });
    curveLabel = svgEl("text", {
      "text-anchor": "middle", "font-size": labelFont + 1, "font-weight": "bold", fill: "#222", ...halo,
    }, svg);

    const yTitle = svgEl("text", {x: 0, y: 12, "font-size": titleFont, fill: "#555"}, svg);
    yTitle.textContent = "↑ Spectral radiance (W·m⁻²·sr⁻¹·μm⁻¹)";
    const xTitle = svgEl("text", {x: plotR, y: plotB + 36, "text-anchor": "end", "font-size": titleFont, fill: "#555"}, svg);
    xTitle.textContent = `Wavelength (μm${xScale === "log" ? ", log scale" : ""}) →`;

    // Slider: the track, a tick per reference object (each directly under that object's
    // peak), end labels, handle.
    svgEl("rect", {
      x: trackL - trackH / 2, y: trackY - trackH / 2, width: trackR - trackL + trackH, height: trackH, rx: trackH / 2,
      fill: `url(#${uid}-track)`, stroke: "#888", "stroke-width": 0.75,
    }, svg);
    for (const o of OBJECTS) {
      const px = sliderX(o.T);
      if (px > trackR + 0.5) continue;
      svgEl("line", {x1: px, x2: px, y1: trackY - 13, y2: trackY - 8, stroke: "#888", "stroke-width": 1}, svg);
    }
    endLabels = [[trackL, "start", T_MAX], [trackR, "end", roundK(coldest)]].map(([x, anchor, T]) => {
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

  // ---- per-frame drawing: everything that depends on the displayed temperature --------------
  function render() {
    const T = Math.exp(shownLn);
    const peakX = sliderX(T);
    const Ty = yScaleT(shownLn);
    const ownP = (T / Ty) ** 5; // the active curve's peak in units of the frame's: 1 unless held

    drawTicks(yTickG, lodTicks(Y_SPAN * peakRadiance(Ty) * 1e-6, plotH, 24), placeY);

    const d = curvePath(T, Ty);
    curve.setAttribute("d", d);
    const closed = `${d}L${plotR},${plotB}L${plotL},${plotB}Z`;
    curveFill.setAttribute("d", closed);
    underClip.setAttribute("d", closed);
    // On the linear axis a cool body's peak is beyond the right edge. Then there is no peak
    // to point at: the guide goes, and the curve's label waits at the edge with an arrow.
    const onAxis = 1 - smoothstep(plotR - 6, plotR + 6, peakX);
    setAttrs(guide, {x1: peakX.toFixed(1), x2: peakX.toFixed(1), y1: vy(ownP).toFixed(1), opacity: onAxis.toFixed(3)});

    // The active curve's own label: the temperature, and the object's name when it is one.
    // Set first, because the reference labels below are laid out around it.
    // Rounded only while gliding: once settled it is the target, which may be an object's
    // exact temperature (5772 K, not 5770 K).
    const Tround = Math.abs(T - target) < 0.5 ? target : roundK(T);
    const match = OBJECTS.find(o => Math.abs(o.T - T) < 0.5);
    curveLabel.textContent = (match ? `${match.name} · ${formatK(match.T)}` : formatK(Tround)) + (onAxis < 0.5 ? " →" : "");
    const ownHalf = labelHalfWidth(curveLabel.textContent, labelFont + 1);
    const ownX = clamp(peakX, plotL + ownHalf + 3, plotR - ownHalf - 3), ownY = vy(ownP) - 8;
    setAttrs(curveLabel, {x: ownX.toFixed(1), y: ownY.toFixed(1)});

    // Reference curves and their labels. p is a reference's peak height in units of the
    // frame's; its peak's x is fixed, directly above its tick on the slider.
    const placed = [{x: ownX, y: ownY, half: ownHalf}];
    const order = OBJECTS.map((o, i) => ({o, i, r: o.T / T})).sort((a, b) => Math.abs(Math.log(a.r)) - Math.abs(Math.log(b.r)));
    for (const {o, i} of order) {
      const p = (o.T / Ty) ** 5;
      const visible = p * plotH / Y_SPAN > 0.5; // else flatter than a pixel
      refPaths[i].style.display = visible ? "" : "none";
      let opacity = 0;
      if (visible) {
        // Legible means the peak is inside the frame and the curve is not pressed flat.
        opacity = smoothstep(0.05, 0.11, p) * (1 - smoothstep(1.22, 1.4, p));
        opacity *= 1 - smoothstep(plotR - 6, plotR + 6, sliderX(o.T)); // peak off the axis
        const half = labelHalfWidth(o.name, labelFont);
        const x = clamp(sliderX(o.T), plotL + half + 3, plotR - half - 3), y = vy(p) - 7;
        // Closest-in-temperature labels are placed first; a later one that would overprint
        // an earlier one fades out in proportion to how much they overlap vertically.
        for (const q of placed) {
          if (Math.abs(q.x - x) < q.half + half + 4) opacity *= smoothstep(9, 15, Math.abs(q.y - y));
        }
        if (opacity > 0.01) placed.push({x, y, half});
        setAttrs(refLabels[i], {x: x.toFixed(1), y: y.toFixed(1)});
        refPaths[i].setAttribute("d", curvePath(o.T, Ty));
        // Unlabelled curves stay in view but recede, so a fan of hotter objects crossing the
        // frame reads as background and the one or two labelled neighbours stand out.
        refPaths[i].setAttribute("stroke", mixGray(0xd0, 0x80, opacity));
      }
      refLabels[i].setAttribute("opacity", opacity.toFixed(3));
    }

    // The handle tracks the pointer exactly while dragging, and the figure otherwise.
    const hx = clamp(sliderX(dragging ? target : T), trackL, trackR);
    handleG.setAttribute("transform", `translate(${hx.toFixed(1)},${trackY})`);
    handleDot.setAttribute("fill", blackbodyCss(dragging ? target : T));
    const labelX = clamp(hx, plotL + 24, plotR - 24);
    sliderLabel.setAttribute("x", labelX.toFixed(1));
    sliderLabel.textContent = formatK(dragging ? target : Tround);
    endLabels[0].setAttribute("opacity", smoothstep(80, 110, labelX - trackL).toFixed(3));
    endLabels[1].setAttribute("opacity", smoothstep(70, 100, trackR - labelX).toFixed(3));
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
      "Left and right arrows move the peak, up and down arrows change the temperature; Page Up and Page Down step between reference objects.");

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

  // Switching scale eases `mix` across; each frame of that rebuilds the scaffolding on the
  // blended scale (build, which ends by calling render), a few hundred cheap elements.
  function setScale(next) {
    if (next === xScale) return;
    xScale = next;
    updateScaleButtons();
    emit();
    const to = xScale === "linear" ? 1 : 0;
    if (reduceMotion) {
      mix = to;
      morph = null;
      build();
      return;
    }
    morph = {from: mix, to, start: performance.now()};
    if (raf === null) {
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function frame(now) {
    raf = null;
    // A cell that re-runs leaves the previous widget detached; do not keep animating it.
    if (container.isConnected === false) return;
    const morphing = morph !== null;
    if (morph) {
      const s = clamp((now - morph.start) / MORPH_MS, 0, 1);
      mix = morph.from + (morph.to - morph.from) * easeInOutCubic(s);
      if (s >= 1) { mix = morph.to; morph = null; }
    }
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
    if (morphing) build(); else render();
    if (!settled || morph) raf = requestAnimationFrame(frame);
  }

  // ---- input --------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (totalH / r.height)};
  }
  const overSlider = py => Math.abs(py - trackY) <= 20;
  // The plot is a second, taller handle on the same scale: the peak goes where the pointer is.
  const overPlot = (px, py) => py >= plotT && py <= plotB && px >= plotL && px <= plotR;

  // A reference object within a few pixels of the pointer wins, so its exact temperature
  // can be reached by dragging; otherwise the value is rounded to about three figures.
  function temperatureAt(px) {
    px = clamp(px, trackL, trackR); // the handle cannot leave the track, so neither can the value
    let best = null, bestDist = 2.5;
    for (const o of OBJECTS) {
      const d = Math.abs(sliderX(o.T) - px);
      if (d <= bestDist) { best = o; bestDist = d; }
    }
    return best ? best.T : roundK(sliderT(px));
  }

  svg.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    if (morph || (!overSlider(py) && !overPlot(px, py))) return; // mid-switch the scale is moving
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
      svg.style.cursor = overSlider(py) || overPlot(px, py) ? "ew-resize" : "default";
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
    // ← and → move the handle (and the peak) the way they point, so → is cooler; ↑ and ↓ are
    // hotter and cooler.
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") T = roundK(target * factor, target, 1);
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") T = roundK(target / factor, target, -1);
    else if (e.key === "PageDown") T = [...OBJECTS].reverse().find(o => o.T < target)?.T ?? T_MIN;
    else if (e.key === "PageUp") T = OBJECTS.find(o => o.T > target)?.T ?? T_MAX;
    else if (e.key === "Home") T = T_MAX; // the left end of the track
    else if (e.key === "End") T = T_MIN;
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
      scale: xScale,
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
  return um < 1 ? `${um.toPrecision(3)} μm (${Math.round(um * 1000)} nm)` : `${um.toPrecision(3)} μm`;
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
