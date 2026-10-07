// Extreme events — how a change in a probability distribution changes the odds of its extremes.
//
// One panel: the probability density of a climate quantity, drawn twice. The gray curve is the
// distribution as it was; the black curve is the same family after the reader has moved its
// mean, spread, skewness or tail weight with the sliders. A handle under the x-axis sets a
// threshold, and everything under the black curve beyond it is painted red. The same tail of
// the gray curve stays gray, so what the eye lands on is the change: a sliver of gray turning
// into a wedge of red when the mean shifts by a fraction of the spread.
//
// This is the schematic of IPCC SREX (2012) Fig. SPM.3 and AR5 WGI Fig. 1.8 made interactive,
// in the format of the Economist's version (11 Feb 2023): no y-axis, no ticks, just the x spine
// with three words on it. The numbers (the two tail fractions, their ratio, the slider values,
// a tick scale) are hidden until the reader asks for them, because the shapes are the lesson.
//
// Units are those of the original distribution: its standard deviation is 1, and its mean is
// 0, or 2 for the families bounded at zero so that the bound is in the frame. The controls are
// always the same four moments. A family that does not have one of them as a free parameter
// (the skewness of a gamma from zero follows from its mean and spread) greys that slider out
// and shows the implied value. Where a one-to-one mapping from the moments to the family's
// own parameters exists, it is used, so the reader never meets a shape parameter.
//
// Self-contained on purpose, like the blackbody widget: no d3, no imports, so the script-tag
// embed is one module. Observable Plot has no parametric distributions and d3-random has only
// samplers, so the densities, their cdfs and the special functions behind them (log-gamma,
// the regularized incomplete gamma and beta functions, erfc) are written here, in the forms
// given in Numerical Recipes, and were checked against numerical integration (see the page).

// ---- special functions ------------------------------------------------------------------------

// ln Γ(x) for x > 0, Lanczos approximation (Numerical Recipes gammln), |error| < 2e-10.
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}
const gammaFn = x => Math.exp(lgamma(x));

// Complementary error function, Chebyshev fit (Numerical Recipes erfcc), fractional error < 1.2e-7.
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

// Regularized lower incomplete gamma P(a, x): series below a + 1, Lentz continued fraction above.
function gammaP(a, x) {
  if (!(x > 0)) return 0;
  const gln = lgamma(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 100000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - gln));
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 100000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.max(0, 1 - Math.exp(-x + a * Math.log(x) - gln) * h);
}

// Regularized incomplete beta I_x(a, b), continued fraction (Numerical Recipes betai/betacf).
function betaI(a, b, x) {
  if (!(x > 0)) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}
function betacf(a, b, x) {
  const FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 10000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

// ---- distributions ----------------------------------------------------------------------------
// Each constructor takes moments and returns {pdf, cdf, skew, kurt, lower}: the density, the
// cumulative distribution, the skewness and excess kurtosis it actually has (the free ones
// echoed back, the implied ones computed), and the lower end of its support.

export function normal(mean, sd) {
  const k = 1 / (sd * Math.SQRT2 * Math.sqrt(Math.PI));
  return {
    pdf: x => k * Math.exp(-0.5 * ((x - mean) / sd) ** 2),
    cdf: x => 0.5 * erfc(-(x - mean) / (sd * Math.SQRT2)),
    skew: 0, kurt: 0, lower: -Infinity,
  };
}

// Gamma with shape k and scale θ, from zero.
function gammaKT(k, theta) {
  const lnorm = lgamma(k) + k * Math.log(theta);
  return {
    pdf: x => (x > 0 ? Math.exp((k - 1) * Math.log(x) - x / theta - lnorm) : x === 0 && k === 1 ? 1 / theta : 0),
    cdf: x => gammaP(k, x / theta),
    skew: 2 / Math.sqrt(k), kurt: 6 / k, lower: 0,
  };
}

export function gammaFromZero(mean, sd) {
  return gammaKT((mean / sd) ** 2, (sd * sd) / mean);
}

// Pearson type III: a gamma shifted along the axis, and mirrored when the skewness is
// negative. Mean, standard deviation and skewness map one-to-one onto shape, scale and shift,
// and at zero skewness it is the normal, which is what it is drawn as below |γ| = 0.02 (where
// the shape parameter passes 10,000 and the two are indistinguishable).
export function pearson3(mean, sd, skew) {
  if (Math.abs(skew) < 0.02) return normal(mean, sd);
  const s = Math.sign(skew), a = Math.abs(skew);
  const k = 4 / (a * a), theta = (sd * a) / 2;
  const g = gammaKT(k, theta);
  const shift = mean - s * k * theta;
  return {
    pdf: x => g.pdf(s * (x - shift)),
    cdf: x => (s > 0 ? g.cdf(x - shift) : 1 - g.cdf(shift - x)),
    skew, kurt: 1.5 * skew * skew, lower: s > 0 ? shift : -Infinity,
  };
}

// Student's t, scaled to the given standard deviation. The excess kurtosis 6/(ν − 4) is
// one-to-one with the degrees of freedom above 4, where the kurtosis exists; zero is the normal.
export function studentT(mean, sd, kurt) {
  if (kurt < 1e-3) return normal(mean, sd);
  const nu = 4 + 6 / kurt;
  const s = sd * Math.sqrt((nu - 2) / nu);
  const lk = lgamma((nu + 1) / 2) - lgamma(nu / 2) - 0.5 * Math.log(nu * Math.PI) - Math.log(s);
  return {
    pdf: x => Math.exp(lk - ((nu + 1) / 2) * Math.log1p(((x - mean) / s) ** 2 / nu)),
    cdf: x => {
      const t = (x - mean) / s;
      const tail = 0.5 * betaI(nu / 2, 0.5, nu / (nu + t * t));
      return t > 0 ? 1 - tail : tail;
    },
    skew: 0, kurt, lower: -Infinity,
  };
}

export function lognormal(mean, sd) {
  const s2 = Math.log1p((sd * sd) / (mean * mean)), s = Math.sqrt(s2);
  const m = Math.log(mean) - s2 / 2;
  const es = Math.exp(s2);
  return {
    pdf: x => (x > 0 ? Math.exp(-0.5 * ((Math.log(x) - m) / s) ** 2) / (x * s * Math.sqrt(2 * Math.PI)) : 0),
    cdf: x => (x > 0 ? 0.5 * erfc(-(Math.log(x) - m) / (s * Math.SQRT2)) : 0),
    skew: (es + 2) * Math.sqrt(es - 1),
    kurt: es ** 4 + 2 * es ** 3 + 3 * es ** 2 - 6,
    lower: 0,
  };
}

// Weibull: the coefficient of variation fixes the shape k (it falls monotonically with k, so
// bisection finds it), and the mean then fixes the scale λ.
export function weibull(mean, sd) {
  const cv2 = (sd / mean) ** 2;
  const cv2Of = k => Math.exp(lgamma(1 + 2 / k) - 2 * lgamma(1 + 1 / k)) - 1;
  let lo = Math.log(0.05), hi = Math.log(200);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (cv2Of(Math.exp(mid)) > cv2) lo = mid; else hi = mid;
  }
  const k = Math.exp((lo + hi) / 2);
  const lambda = mean / gammaFn(1 + 1 / k);
  const m3 = lambda ** 3 * gammaFn(1 + 3 / k), m4 = lambda ** 4 * gammaFn(1 + 4 / k);
  const skew = (m3 - 3 * mean * sd * sd - mean ** 3) / sd ** 3;
  return {
    pdf: x => (x > 0 ? (k / lambda) * (x / lambda) ** (k - 1) * Math.exp(-((x / lambda) ** k)) : x === 0 && k === 1 ? 1 / lambda : 0),
    cdf: x => (x > 0 ? 1 - Math.exp(-((x / lambda) ** k)) : 0),
    skew,
    kurt: (m4 - 4 * skew * sd ** 3 * mean - 6 * mean * mean * sd * sd - mean ** 4) / sd ** 4 - 3,
    lower: 0,
  };
}

// The menu. `mean0` is the original mean in units of the original standard deviation; the
// families bounded at zero sit at 2 so that the bound is in the frame. `free` says which of
// the skewness and kurtosis sliders are live. `words` go on the axis: at the left end, at the
// original mean, at the right end.
export const FAMILIES = [
  {id: "normal", name: "Normal", uses: "temperature, pressure", mean0: 0, free: {skew: false, kurt: false},
    words: ["cold", "average", "hot"], make: (m, s) => normal(m, s)},
  {id: "pearson3", name: "Skewed (Pearson III)", uses: "temperature with a skew", mean0: 0, free: {skew: true, kurt: false},
    words: ["cold", "average", "hot"], skew0: 0.6, make: (m, s, g) => pearson3(m, s, g)},
  {id: "student", name: "Heavy-tailed (Student's t)", uses: "temperature with fat tails", mean0: 0, free: {skew: false, kurt: true},
    words: ["cold", "average", "hot"], kurt0: 1, make: (m, s, g, k) => studentT(m, s, k)},
  {id: "gamma", name: "Gamma", uses: "rainfall", mean0: 2, free: {skew: false, kurt: false},
    words: ["dry", "average", "wet"], make: (m, s) => gammaFromZero(m, s)},
  {id: "lognormal", name: "Lognormal", uses: "rainfall, wind", mean0: 2, free: {skew: false, kurt: false},
    words: ["dry", "average", "wet"], make: (m, s) => lognormal(m, s)},
  {id: "weibull", name: "Weibull", uses: "wind speed", mean0: 2, free: {skew: false, kurt: false},
    words: ["calm", "average", "windy"], make: (m, s) => weibull(m, s)},
];

// Slider ranges, in units of the original standard deviation (the mean's is relative to the
// original mean). Skewness stops at ±1.5, where a Pearson III is still a bell: at ±2 it is an
// exponential with its mode on the bound. Kurtosis 6 is a t with 5 degrees of freedom.
const MEAN_RANGE = 2, SD_MIN = 0.5, SD_MAX = 2, SKEW_MAX = 1.5, KURT_MAX = 6;
const AXIS_SPAN = 4.5;      // the axis reaches this far beyond the original mean, both ways
const THRESHOLD0 = 2;       // default threshold, standard deviations above the original mean

const BACKGROUND = "#f2f2f2"; // the plate the survey widgets sit on
const RED = "#e3120b";        // the extremes
const ACCENT = "#0b57d0";     // focus ring, active controls
const GRAY_CURVE = "#9a9a9a", GRAY_TAIL = "#c4c4c4", BLACK_CURVE = "#222";

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// `shift` is where the mean slider starts, in standard deviations above the original mean: a
// little to the right by default, so that the black curve is not drawn on top of the gray one
// and the red wedge is there to be seen before anything is touched. Reset puts it back to 0.
export function createExtremeEventsWidget({family = "normal", shift = 0.5, threshold = THRESHOLD0, showNumbers = false, words, width = FIGURE_WIDTH} = {}) {
  const uid = `extreme-events-${++instances}`;

  // Vertical layout is constant; only horizontal metrics and fonts follow the width.
  const plotT = 12, plotH = 236, plotB = plotT + plotH;
  const wordsY = plotB + 20;   // the three words on the axis
  const ticksY = plotB + 36;   // the σ scale, numbers mode only
  const trackY = plotB + 62;   // threshold slider
  const trackH = 6, handleR = 8;
  const totalH = trackY + 40;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, wordFont, tickFont, labelFont;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);
    plotL = lerp(14, 22);
    plotR = w - lerp(14, 22);
    plotW = plotR - plotL;
    wordFont = lerp(12, 14);
    tickFont = lerp(10, 11);
    labelFont = lerp(12, 14);
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let fam = FAMILIES.find(f => f.id === family) ?? FAMILIES[0];
  let mean, sd, skew, kurt;       // the black curve's moments (the free ones; others implied)
  let thr;                        // threshold, in x units
  let numbers = Boolean(showNumbers);
  let axisWords = words;          // an override from the caller, else the family's own
  let ref, cur;                   // the gray and black distributions
  let dragging = false;

  const defaults = () => ({mean: fam.mean0, sd: 1, skew: fam.skew0 ?? 0, kurt: fam.kurt0 ?? 0});
  const xMin = () => (fam.mean0 > 0 ? 0 : fam.mean0 - AXIS_SPAN);
  const xMax = () => fam.mean0 + AXIS_SPAN;
  const meanMin = () => (fam.mean0 > 0 ? 0.5 : fam.mean0 - MEAN_RANGE);
  const meanMax = () => fam.mean0 + MEAN_RANGE;

  function makeDistributions() {
    const d = defaults();
    ref = fam.make(d.mean, d.sd, d.skew, d.kurt);
    cur = fam.make(mean, sd, fam.free.skew ? skew : d.skew, fam.free.kurt ? kurt : d.kurt);
    if (!fam.free.skew) skew = cur.skew;
    if (!fam.free.kurt) kurt = cur.kurt;
  }

  function resetParams() {
    ({mean, sd, skew, kurt} = defaults());
  }
  resetParams();
  mean = clamp(fam.mean0 + (Number(shift) || 0), meanMin(), meanMax());
  thr = clamp(fam.mean0 + threshold, xMin(), xMax());
  makeDistributions();

  // ---- DOM ------------------------------------------------------------------------------------
  // The plate runs under the whole widget, controls included, so it reads as one card.
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;`;

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;padding:0 0 8px;font-size:13px;color:#666;";
  container.appendChild(controls);

  const famField = document.createElement("label");
  famField.style.cssText = "display:flex;align-items:center;gap:6px;";
  const famSelect = document.createElement("select");
  famSelect.style.cssText =
    "font:13px sans-serif;color:#222;padding:3px 6px;border:1px solid #ccc;border-radius:6px;background:#fff;max-width:100%;";
  for (const f of FAMILIES) {
    const o = document.createElement("option");
    o.value = f.id;
    o.textContent = `${f.name} — ${f.uses}`;
    famSelect.appendChild(o);
  }
  famSelect.value = fam.id;
  famSelect.addEventListener("change", () => setFamily(famSelect.value));
  famSelect.addEventListener("input", e => e.stopPropagation());
  famField.append("Distribution", famSelect);
  controls.appendChild(famField);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;align-items:center;gap:14px;margin-left:auto;";
  const numbersField = document.createElement("label");
  numbersField.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;";
  const numbersBox = document.createElement("input");
  numbersBox.type = "checkbox";
  numbersBox.checked = numbers;
  numbersBox.style.cssText = `margin:0;accent-color:${ACCENT};`;
  numbersBox.addEventListener("input", e => e.stopPropagation());
  numbersBox.addEventListener("change", () => { numbers = numbersBox.checked; render(); updateSliders(); emit(); });
  numbersField.append(numbersBox, "Show numbers");
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "Reset";
  resetButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;";
  resetButton.addEventListener("click", () => {
    resetParams();
    thr = clamp(fam.mean0 + THRESHOLD0, xMin(), xMax());
    update();
  });
  right.append(numbersField, resetButton);
  controls.appendChild(right);

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "extreme-events");
  svg.setAttribute("role", "slider");
  svg.style.display = "block";
  svg.style.outline = "none";
  svg.style.touchAction = "pan-y";
  svg.tabIndex = 0;
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // The four moment sliders, one row each: name, slider, read-out.
  const sliderBox = document.createElement("div");
  sliderBox.style.cssText = "display:grid;grid-template-columns:auto 1fr auto;gap:6px 10px;align-items:center;padding:10px 0 0;font-size:13px;color:#555;";
  container.appendChild(sliderBox);

  const SLIDERS = [
    {key: "mean", name: "Mean", step: 0.05, min: meanMin, max: meanMax, get: () => mean, set: v => (mean = v),
      format: v => `${signed(v - fam.mean0)} σ`, free: () => true},
    {key: "sd", name: "Spread", step: 0.02, min: () => SD_MIN, max: () => SD_MAX, get: () => sd, set: v => (sd = v),
      format: v => `× ${v.toFixed(2)}`, free: () => true},
    {key: "skew", name: "Skewness", step: 0.05, min: () => -SKEW_MAX, max: () => SKEW_MAX, get: () => skew, set: v => (skew = v),
      format: v => signed(v), free: () => fam.free.skew},
    {key: "kurt", name: "Kurtosis", step: 0.1, min: () => 0, max: () => KURT_MAX, get: () => kurt, set: v => (kurt = v),
      format: v => signed(v), free: () => fam.free.kurt},
  ];
  const sliderRows = SLIDERS.map(s => {
    const name = document.createElement("label");
    name.textContent = s.name;
    name.style.cssText = "color:#333;";
    const input = document.createElement("input");
    input.type = "range";
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
      const free = s.free();
      input.min = s.min();
      input.max = s.max();
      input.disabled = !free;
      input.style.opacity = free ? "1" : "0.4";
      name.style.color = free ? "#333" : "#999";
      const v = s.get();
      // A disabled slider still shows where the implied value falls, when it is in range.
      if (document.activeElement !== input || !free) input.value = clamp(v, s.min(), s.max());
      out.textContent = free ? (numbers ? s.format(v) : "") : numbers ? s.format(v) : "implied";
      out.style.color = free ? "#333" : "#999";
      out.title = free ? "" : `This distribution's ${s.name.toLowerCase()} follows from the other sliders.`;
    }
  }

  const hint = document.createElement("div");
  hint.style.cssText = "padding:10px 0 0;color:#888;font-size:14px;";
  hint.textContent =
    "The gray curve is the original distribution; move the sliders to change it. Drag the red handle under " +
    "the axis to set the threshold for an extreme (with the figure focused, ← and → move it too).";
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const halo = {stroke: BACKGROUND, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

  // ---- scales and sampling ----------------------------------------------------------------------
  const xs = x => plotL + ((x - xMin()) / (xMax() - xMin())) * plotW;
  const xInv = px => xMin() + ((px - plotL) / plotW) * (xMax() - xMin());
  let yMax = 1;
  const ys = v => plotB - (Math.min(v, 1e3) / yMax) * plotH;

  let samples; // x values, two per pixel column, with the bound included exactly
  function buildSamples() {
    const n = Math.max(200, Math.round(2 * plotW));
    samples = [];
    for (let i = 0; i <= n; i++) samples.push(xMin() + ((xMax() - xMin()) * i) / n);
  }

  // The density as a path, with the support's lower bound added as an exact point so a J- or
  // L-shaped curve rises from it rather than from the next sample over.
  function curvePoints(dist) {
    const pts = [];
    for (const x of samples) {
      if (dist.lower > xMin() && x > dist.lower && pts.length && pts[pts.length - 1][0] < dist.lower) {
        pts.push([dist.lower, 0], [dist.lower, dist.pdf(dist.lower + 1e-9)]);
      }
      pts.push([x, dist.pdf(x)]);
    }
    return pts;
  }
  const toPath = pts => pts.map(([x, v], i) => `${i ? "L" : "M"}${xs(x).toFixed(1)},${ys(v).toFixed(1)}`).join("");
  // The tail beyond the threshold: the curve from the threshold to the right edge, closed on the axis.
  function tailPath(dist, pts) {
    let d = `M${xs(thr).toFixed(1)},${plotB}L${xs(thr).toFixed(1)},${ys(dist.pdf(thr)).toFixed(1)}`;
    for (const [x, v] of pts) if (x > thr) d += `L${xs(x).toFixed(1)},${ys(v).toFixed(1)}`;
    return d + `L${plotR},${plotB}Z`;
  }

  // ---- scaffolding, rebuilt on resize and family change ---------------------------------------
  let refCurve, refTail, curCurve, curTail, thrTick, handleG, focusRing, thrLabel, legend;
  let labelHead, labelNow, labelWas, labelRatio, tickG, wordEls;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    buildSamples();

    svgEl("rect", {width: w, height: totalH, fill: BACKGROUND}, svg);
    const defs = svgEl("defs", {}, svg);
    svgEl("rect", {x: plotL - 1, y: plotT, width: plotW + 2, height: plotH}, svgEl("clipPath", {id: `${uid}-plot`}, defs));

    const plot = svgEl("g", {"clip-path": `url(#${uid}-plot)`}, svg);
    refTail = svgEl("path", {fill: GRAY_TAIL}, plot);
    curTail = svgEl("path", {fill: RED}, plot);
    refCurve = svgEl("path", {fill: "none", stroke: GRAY_CURVE, "stroke-width": 2, "stroke-linejoin": "round"}, plot);
    curCurve = svgEl("path", {fill: "none", stroke: BLACK_CURVE, "stroke-width": 2.5, "stroke-linejoin": "round"}, plot);

    // The spine, the three words, and a σ scale that only shows with the numbers.
    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#555", "stroke-width": 1.25}, svg);
    const wordsNow = axisWords ?? fam.words;
    wordEls = [[xMin(), "start"], [fam.mean0, "middle"], [xMax(), "end"]].map(([x, anchor], i) => {
      const t = svgEl("text", {x: xs(x).toFixed(1), y: wordsY, "text-anchor": anchor, "font-size": wordFont, fill: "#555"}, svg);
      t.textContent = wordsNow[i] ?? "";
      return t;
    });
    tickG = svgEl("g", {}, svg);
    for (let k = Math.ceil(xMin() - fam.mean0); k <= Math.floor(xMax() - fam.mean0); k++) {
      const x = xs(fam.mean0 + k).toFixed(1);
      svgEl("line", {x1: x, x2: x, y1: plotB, y2: plotB + 4, stroke: "#888"}, tickG);
      const t = svgEl("text", {x, y: ticksY, "text-anchor": "middle", "font-size": tickFont, fill: "#888"}, tickG);
      t.textContent = k === 0 ? "0" : `${signed(k, 0)}σ`;
    }

    // The threshold: a red tick on the spine, and the handle on its track below.
    thrTick = svgEl("line", {y1: plotB - 5, y2: plotB + 5, stroke: RED, "stroke-width": 2}, svg);
    svgEl("rect", {
      x: plotL - trackH / 2, y: trackY - trackH / 2, width: plotW + trackH, height: trackH, rx: trackH / 2,
      fill: "#fff", stroke: "#bbb", "stroke-width": 0.75,
    }, svg);
    handleG = svgEl("g", {}, svg);
    focusRing = svgEl("circle", {r: handleR + 4, fill: "none", stroke: hexToRgba(ACCENT, 0.35), "stroke-width": 3}, handleG);
    focusRing.style.display = document.activeElement === svg ? "" : "none";
    svgEl("circle", {r: handleR, fill: RED, stroke: "#fff", "stroke-width": 2}, handleG);
    thrLabel = svgEl("text", {y: trackY + handleR + 16, "text-anchor": "middle", "font-size": tickFont + 1, fill: "#555"}, svg);

    // The read-out beside the red tail: a heading always, the figures only with the numbers.
    const label = svgEl("g", {}, svg);
    labelHead = svgEl("text", {"font-size": labelFont, "font-weight": "bold", fill: RED, ...halo}, label);
    labelNow = svgEl("text", {"font-size": labelFont, fill: RED, ...halo}, label);
    labelWas = svgEl("text", {"font-size": labelFont, fill: "#777", ...halo}, label);
    labelRatio = svgEl("text", {"font-size": labelFont, "font-weight": "bold", fill: BLACK_CURVE, ...halo}, label);

    // The key, top left: which curve is which.
    legend = svgEl("g", {"font-size": tickFont + 1}, svg);
    const key = (y, color, text, width) => {
      svgEl("line", {x1: plotL + 4, x2: plotL + 24, y1: y, y2: y, stroke: color, "stroke-width": width}, legend);
      const t = svgEl("text", {x: plotL + 30, y: y + 4, fill: "#555"}, legend);
      t.textContent = text;
    };
    key(plotT + 10, GRAY_CURVE, "original", 2);
    key(plotT + 26, BLACK_CURVE, "changed", 2.5);

    render();
  }

  // ---- per-frame drawing ----------------------------------------------------------------------
  function render() {
    const refPts = curvePoints(ref), curPts = curvePoints(cur);
    const peak = pts => pts.reduce((m, [, v]) => Math.max(m, Math.min(v, 1e3)), 0);
    const refPeak = peak(refPts);
    // The frame is twice the original peak, and only stretches when the black curve would
    // overflow it, so that the gray curve stays put while the sliders move.
    yMax = refPeak * clamp((1.08 * peak(curPts)) / refPeak, 2, 3);

    refCurve.setAttribute("d", toPath(refPts));
    curCurve.setAttribute("d", toPath(curPts));
    refTail.setAttribute("d", tailPath(ref, refPts));
    curTail.setAttribute("d", tailPath(cur, curPts));

    const tx = xs(thr);
    setAttrs(thrTick, {x1: tx.toFixed(1), x2: tx.toFixed(1)});
    handleG.setAttribute("transform", `translate(${tx.toFixed(1)},${trackY})`);
    thrLabel.setAttribute("x", clamp(tx, plotL + 40, plotR - 40).toFixed(1));
    thrLabel.textContent = numbers ? `threshold ${signed(thr - fam.mean0)} σ` : "";
    tickG.style.display = numbers ? "" : "none";

    // Tail fractions, from the cdfs rather than the picture.
    const fNow = Math.max(0, 1 - cur.cdf(thr)), fWas = Math.max(0, 1 - ref.cdf(thr));
    const ratio = fWas > 0 ? fNow / fWas : fNow > 0 ? Infinity : 1;

    // The read-out stands to the right of the threshold when there is room, else to its left.
    const lines = numbers
      ? [`${formatShare(fNow)} of the time`, `was ${formatShare(fWas)}`, formatRatio(ratio)]
      : ["", "", ""];
    const longest = Math.max(...["Extremes", ...lines].map(s => 2 * labelHalfWidth(s, labelFont)));
    const rightSide = tx + 10 + longest <= plotR - 4;
    const lx = rightSide ? tx + 10 : tx - 10;
    const anchor = rightSide ? "start" : "end";
    [labelHead, labelNow, labelWas, labelRatio].forEach((el, i) => {
      setAttrs(el, {x: lx.toFixed(1), y: plotT + 60 + i * (labelFont + 4), "text-anchor": anchor});
    });
    labelHead.textContent = "Extremes";
    [labelNow.textContent, labelWas.textContent, labelRatio.textContent] = lines;

    svg.setAttribute("aria-valuemin", xMin() - fam.mean0);
    svg.setAttribute("aria-valuemax", xMax() - fam.mean0);
    svg.setAttribute("aria-valuenow", (thr - fam.mean0).toFixed(2));
    svg.setAttribute("aria-label",
      `Threshold for an extreme: ${signed(thr - fam.mean0)} standard deviations from the original mean. ` +
      `${fam.name} distribution; extremes happen ${formatShare(fNow)} of the time, against ${formatShare(fWas)} originally, ` +
      `${formatRatio(ratio)}. Left and right arrows move the threshold.`);
  }

  // ---- changes ----------------------------------------------------------------------------------
  function update() {
    makeDistributions();
    render();
    updateSliders();
    emit();
  }

  function setFamily(id) {
    const next = FAMILIES.find(f => f.id === id);
    if (!next || next === fam) return;
    const rel = thr - fam.mean0;
    fam = next;
    famSelect.value = fam.id;
    resetParams();
    thr = clamp(fam.mean0 + rel, xMin(), xMax());
    makeDistributions();
    build();
    updateSliders();
    emit();
  }

  function setThreshold(x) {
    x = clamp(Math.round(x / 0.05) * 0.05, xMin(), xMax());
    if (x === thr) return;
    thr = x;
    render();
    emit();
  }

  // ---- input --------------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = svg.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (totalH / r.height)};
  }
  const overSlider = py => Math.abs(py - trackY) <= 22;

  svg.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    if (!overSlider(py)) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    svg.focus();
    setThreshold(xInv(px));
    e.preventDefault();
  });
  svg.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (!dragging) { svg.style.cursor = overSlider(py) ? "ew-resize" : "default"; return; }
    setThreshold(xInv(px));
  });
  for (const type of ["pointerup", "pointercancel"]) {
    svg.addEventListener(type, e => {
      if (!dragging) return;
      dragging = false;
      svg.releasePointerCapture(e.pointerId);
    });
  }
  svg.addEventListener("keydown", e => {
    const step = e.shiftKey ? 0.5 : 0.1;
    let x = thr;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") x -= step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") x += step;
    else if (e.key === "Home") x = xMin();
    else if (e.key === "End") x = xMax();
    else return;
    e.preventDefault();
    setThreshold(x);
  });
  svg.addEventListener("focus", () => { focusRing.style.display = ""; });
  svg.addEventListener("blur", () => { focusRing.style.display = "none"; });

  // ---- value --------------------------------------------------------------------------------------
  function value() {
    const fNow = Math.max(0, 1 - cur.cdf(thr)), fWas = Math.max(0, 1 - ref.cdf(thr));
    return {
      family: fam.id,
      mean: mean - fam.mean0, sd, skewness: skew, kurtosis: kurt, // in units of the original σ, mean relative to the original
      threshold: thr - fam.mean0,
      extremeFraction: fNow,
      originalFraction: fWas,
      ratio: fWas > 0 ? fNow / fWas : null,
      showNumbers: numbers,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  build();
  updateSliders();
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

  return container;
}

// ---- formatting ---------------------------------------------------------------------------------

function signed(v, digits = 2) {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}` : v < 0 ? `−${s.slice(1)}` : s;
}

export function formatShare(f) {
  const pct = 100 * f;
  if (pct < 0.01) return "<0.01%";
  if (pct < 1) return `${pct.toFixed(2)}%`;
  if (pct < 10) return `${pct.toFixed(1)}%`;
  if (pct > 99.9) return "100%";
  return `${Math.round(pct)}%`;
}

function formatRatio(r) {
  if (!Number.isFinite(r)) return r > 1 ? "from almost never" : "";
  if (r >= 1.05) return `${formatTimes(r)}× as often`;
  if (r <= 0.95) return `${formatTimes(1 / r)}× rarer`;
  return "about as often";
}
const formatTimes = r => (r < 10 ? r.toFixed(1) : Math.round(r).toLocaleString("en-US"));

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
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
