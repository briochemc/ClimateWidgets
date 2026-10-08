// Extreme events — how a change in a probability distribution changes the odds of its extremes.
//
// One panel: the probability density of a climate quantity, drawn twice. The gray curve is the
// baseline distribution; the black curve is the same family after the reader has moved its
// mean, spread or skewness with the sliders. The extremes are the 1% tails of the baseline:
// everything beyond its 99th percentile (high, red) and below its 1st (low, blue). The
// baseline's tails are painted in a faded red and blue; where the perturbed curve rises above
// the baseline in a tail the extra is painted in the full colour, and where it falls below,
// the loss is painted paler still. So what the eye lands on is the change: a sliver of pale
// red turning into a wedge of vivid red when the mean shifts by a fraction of the spread.
//
// This is the schematic of IPCC SREX (2012) Fig. SPM.3 and AR5 WGI Fig. 1.8 made interactive,
// in the format of the Economist's version (11 Feb 2023): no y-axis, no ticks, just the x spine
// with three words on it. A square bracket over each tail names it; the numbers (the two tail
// fractions, the slider values, a tick scale) are hidden until the reader asks for them,
// because the shapes are the lesson. The one number always shown is the multiplier over a
// tail, and only once it is outside the band from half to double.
//
// Units are those of the baseline distribution: its standard deviation is 1, and its mean is
// 0, or 2 for the families bounded at zero so that the bound is in the frame. The controls are
// always the same three moments. A family that does not have skewness as a free parameter
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

// The quantile of a distribution, by bisection on its cdf. The thresholds for the extremes
// are the baseline's 1st and 99th percentiles, found this way once per family.
export function quantile(dist, p, lo = -60, hi = 60) {
  lo = Math.max(lo, dist.lower);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (dist.cdf(mid) < p) lo = mid; else hi = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}

// The tabs. `mean0` is the baseline mean in units of the baseline standard deviation; the
// families bounded at zero sit at 2 so that the bound is in the frame. `freeSkew` says whether
// the skewness slider is live. `words` go on the axis: at the left end, at the baseline mean,
// at the right end. The heavy-tailed family has no slider of its own any more: it is a
// Student's t with excess kurtosis 1 (ten degrees of freedom), tails fatter than the normal's.
export const FAMILIES = [
  {id: "normal", name: "Normal", uses: "temperature, pressure", mean0: 0, freeSkew: false,
    words: ["cold", "average", "hot"], make: (m, s) => normal(m, s)},
  {id: "pearson3", name: "Skewed", long: "Skewed (Pearson III)", uses: "temperature with a skew", mean0: 0, freeSkew: true,
    words: ["cold", "average", "hot"], skew0: 0.6, make: (m, s, g) => pearson3(m, s, g)},
  {id: "student", name: "Heavy-tailed", long: "Heavy-tailed (Student's t)", uses: "temperature with fat tails", mean0: 0, freeSkew: false,
    words: ["cold", "average", "hot"], kurt0: 1, make: (m, s, g, k) => studentT(m, s, k)},
  {id: "gamma", name: "Gamma", uses: "rainfall", mean0: 2, freeSkew: false,
    words: ["dry", "average", "wet"], make: (m, s) => gammaFromZero(m, s)},
  {id: "lognormal", name: "Lognormal", uses: "rainfall, wind", mean0: 2, freeSkew: false,
    words: ["dry", "average", "wet"], make: (m, s) => lognormal(m, s)},
  {id: "weibull", name: "Weibull", uses: "wind speed", mean0: 2, freeSkew: false,
    words: ["calm", "average", "windy"], make: (m, s) => weibull(m, s)},
];

// Slider ranges, in units of the baseline standard deviation (the mean's is relative to the
// baseline mean). Skewness stops at ±1.5, where a Pearson III is still a bell: at ±2 it is an
// exponential with its mode on the bound.
const MEAN_RANGE = 2, SD_MIN = 0.5, SD_MAX = 2, SKEW_MAX = 1.5;
const AXIS_SPAN = 4.5;      // the axis reaches this far beyond the baseline mean, both ways
const TAIL = 0.01;          // an extreme is beyond the baseline's 1st or 99th percentile
const LEADER_BAND = 2;      // a tail's multiplier is labelled outside [1/LEADER_BAND, LEADER_BAND]

const BACKGROUND = "#f2f2f2"; // the plate the survey widgets sit on
const RED = "#e3120b";        // the high extremes
const BLUE = "#0b57d0";       // the low extremes
const ACCENT = "#0b57d0";     // focus ring, active controls
const GRAY_CURVE = "#9a9a9a", BLACK_CURVE = "#222";
const MID_FILL = "#e3e3e3";   // under both curves between the extremes
// A tail's fills are opaque tints of its colour on the plate, so that they layer predictably:
// the baseline's tail, and the loss where the perturbed curve dips below it.
const TINT_BASE = 0.38, TINT_LOSS = 0.16;

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// `shift` is where the mean slider starts, in standard deviations above the baseline mean: a
// little to the right by default, so that the black curve is not drawn on top of the gray one
// and the red wedge is there to be seen before anything is touched. Reset puts it back to 0.
// `tail` is the share of the baseline beyond each threshold.
export function createExtremeEventsWidget({family = "normal", shift = 0.5, tail = TAIL, showNumbers = false, words, width = FIGURE_WIDTH} = {}) {
  const uid = `extreme-events-${++instances}`;

  // Vertical layout is constant; only horizontal metrics and fonts follow the width. Below
  // the axis: the three words, the σ scale (numbers mode), then the two brackets with their
  // names under them, with a second line kept free for the figures in numbers mode, so that
  // nothing below the axis ever moves.
  const plotT = 12, plotH = 236, plotB = plotT + plotH;
  const wordsY = plotB + 18;   // the three words on the axis
  const ticksY = plotB + 32;   // the σ scale, numbers mode only
  const bracketY = plotB + 40; // the brackets' upturned ends
  const LINE_H = 17;           // the label lines under a bracket, at the largest label font
  const totalH = bracketY + 6 + 15 + LINE_H + 8;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotW, wordFont, tickFont, labelFont, titleFont;
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
    titleFont = lerp(14, 20); // as the Hickman et al. widget's in-plot title
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let fam = FAMILIES.find(f => f.id === family) ?? FAMILIES[0];
  let mean, sd, skew, kurt;       // the black curve's moments (the free ones; others implied)
  let thrLo, thrHi;               // the thresholds, in x units: the baseline's tail quantiles
  let numbers = Boolean(showNumbers);
  let axisWords = words;          // an override from the caller, else the family's own
  let ref, cur;                   // the gray and black distributions
  const tailShare = clamp(Number(tail) || TAIL, 1e-4, 0.25);

  const defaults = () => ({mean: fam.mean0, sd: 1, skew: fam.skew0 ?? 0, kurt: fam.kurt0 ?? 0});
  const xMin = () => (fam.mean0 > 0 ? 0 : fam.mean0 - AXIS_SPAN);
  const xMax = () => fam.mean0 + AXIS_SPAN;
  const meanMin = () => (fam.mean0 > 0 ? 0.5 : fam.mean0 - MEAN_RANGE);
  const meanMax = () => fam.mean0 + MEAN_RANGE;

  function makeDistributions() {
    const d = defaults();
    ref = fam.make(d.mean, d.sd, d.skew, d.kurt);
    cur = fam.make(mean, sd, fam.freeSkew ? skew : d.skew, d.kurt);
    if (!fam.freeSkew) skew = cur.skew;
    kurt = cur.kurt;
  }
  function makeThresholds() {
    thrLo = clamp(quantile(ref, tailShare), xMin(), xMax());
    thrHi = clamp(quantile(ref, 1 - tailShare), xMin(), xMax());
  }

  function resetParams() {
    ({mean, sd, skew, kurt} = defaults());
  }
  resetParams();
  mean = clamp(fam.mean0 + (Number(shift) || 0), meanMin(), meanMax());
  makeDistributions();
  makeThresholds();

  // ---- DOM ------------------------------------------------------------------------------------
  // The plate runs under the whole widget, controls included, so it reads as one card. It is
  // capped at the figure's width so that the controls never run on past the axis.
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;` +
    `box-sizing:border-box;max-width:${maxW + 24}px;`;

  // The title, two lines, in the format of the Hickman et al. widget's: bold, flush with the
  // left end of the axis.
  const title = document.createElement("div");
  title.style.cssText = "font-weight:bold;color:#111;line-height:1.2;white-space:pre-line;padding:0 0 10px;";
  title.textContent = "Small changes in the distribution\ncan mean big changes in extremes";
  container.appendChild(title);

  // The tabs, one per family, with the numbers toggle and the reset button at the right end.
  const tabRow = document.createElement("div");
  tabRow.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:flex-end;gap:0 2px;border-bottom:1px solid #cfcfcf;font-size:13px;color:#666;";
  container.appendChild(tabRow);

  const tabList = document.createElement("div");
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-label", "Distribution");
  tabList.style.cssText = "display:flex;flex-wrap:wrap;gap:0 2px;";
  const tabs = FAMILIES.map(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = f.name;
    b.title = `${f.long ?? f.name}: ${f.uses}`;
    b.style.cssText =
      "font:13px sans-serif;padding:5px 9px;margin-bottom:-1px;border:0;border-bottom:2px solid transparent;" +
      "background:none;color:#555;cursor:pointer;white-space:nowrap;";
    b.addEventListener("click", () => setFamily(f.id));
    b.addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const i = FAMILIES.indexOf(fam) + (e.key === "ArrowLeft" ? -1 : 1);
      const next = FAMILIES[(i + FAMILIES.length) % FAMILIES.length];
      setFamily(next.id);
      tabs[FAMILIES.indexOf(next)].el.focus();
    });
    tabList.appendChild(b);
    return {el: b, f};
  });
  function updateTabs() {
    for (const {el, f} of tabs) {
      const on = f === fam;
      el.setAttribute("aria-selected", on);
      el.tabIndex = on ? 0 : -1;
      el.style.color = on ? ACCENT : "#555";
      el.style.borderBottomColor = on ? ACCENT : "transparent";
    }
  }
  tabRow.appendChild(tabList);

  const right = document.createElement("div");
  right.style.cssText = "display:flex;align-items:center;gap:14px;margin-left:auto;padding:0 0 5px 8px;";
  const numbersField = document.createElement("label");
  numbersField.style.cssText = "display:flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap;";
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
  resetButton.addEventListener("click", () => { resetParams(); update(); });
  right.append(numbersField, resetButton);
  tabRow.appendChild(right);

  // The three moment sliders, one row each: name, slider, read-out. The block is set flush
  // with the two ends of the axis below it (see build).
  const sliderBox = document.createElement("div");
  sliderBox.style.cssText =
    "display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;align-items:center;padding:8px 0 2px;font-size:13px;color:#555;";
  container.appendChild(sliderBox);

  const SLIDERS = [
    {key: "mean", name: "Mean", step: 0.05, min: meanMin, max: meanMax, get: () => mean, set: v => (mean = v),
      format: v => `${signed(v - fam.mean0)} σ`, free: () => true},
    {key: "sd", name: "Variance (spread)", step: 0.02, min: () => SD_MIN, max: () => SD_MAX, get: () => sd, set: v => (sd = v),
      format: v => `× ${v.toFixed(2)}`, free: () => true},
    {key: "skew", name: "Skewness (asymmetry)", step: 0.05, min: () => -SKEW_MAX, max: () => SKEW_MAX, get: () => skew, set: v => (skew = v),
      format: v => signed(v), free: () => fam.freeSkew},
  ];
  const sliderRows = SLIDERS.map(s => {
    const name = document.createElement("label");
    name.textContent = s.name;
    name.style.cssText = "color:#333;white-space:nowrap;";
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

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "extreme-events");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const hint = document.createElement("div");
  hint.style.cssText = "padding:10px 0 0;color:#888;font-size:14px;";
  hint.textContent =
    "The gray curve is the baseline distribution; move the sliders to perturb it. Here an extreme is anything " +
    `in the baseline's ${formatShare(tailShare)} tails, high in red and low in blue. That cut-off is arbitrary: ` +
    "with real data, what counts as extreme depends on the context, such as a heat-health warning, a flood " +
    "defence or a crop's tolerance.";
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
  let yMax = 1;
  const ys = v => plotB - (Math.min(v, 1e3) / yMax) * plotH;

  let samples; // x values, two per pixel column, with the bound included exactly
  function buildSamples() {
    const n = Math.max(200, Math.round(2 * plotW));
    samples = [];
    for (let i = 0; i <= n; i++) samples.push(xMin() + ((xMax() - xMin()) * i) / n);
  }

  // The density as points, with the support's lower bound added as an exact point so a J- or
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
  const P = ([x, v]) => `${xs(x).toFixed(1)},${ys(v).toFixed(1)}`;
  const toPath = pts => pts.map((p, i) => `${i ? "L" : "M"}${P(p)}`).join("");
  // The area under a curve, closed on the axis. Which part of it shows is left to clip paths.
  const areaPath = pts => `M${xs(pts[0][0]).toFixed(1)},${plotB}${pts.map(p => `L${P(p)}`).join("")}L${xs(pts[pts.length - 1][0]).toFixed(1)},${plotB}Z`;
  // The region between the two curves: out along one, back along the other. Where they cross
  // the polygon turns over, and every lobe is still filled under the nonzero rule.
  const betweenPath = (a, b) => `M${a.map(P).join("L")}L${[...b].reverse().map(P).join("L")}Z`;

  // ---- scaffolding, rebuilt on resize and family change ---------------------------------------
  let refCurve, curCurve, areaEls, betweenEls, clipRefArea, clipCurArea, clipRects, tickG, caption;
  let refLabel, curLabel;
  const tails = {}; // per side: the label lines under its bracket, and its leader line and label

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
    // The three bands of the axis: below the low threshold, between, beyond the high one.
    const xLo = xs(thrLo), xHi = xs(thrHi);
    clipRects = {
      lo: clip("lo", svgEl("rect", {x: plotL - 1, y: plotT, width: xLo - plotL + 1, height: plotH})),
      mid: clip("mid", svgEl("rect", {x: xLo, y: plotT, width: xHi - xLo, height: plotH})),
      hi: clip("hi", svgEl("rect", {x: xHi, y: plotT, width: plotR + 1 - xHi, height: plotH})),
    };
    // The areas under each curve, as clips: between ∩ under-perturbed is where the perturbed
    // curve is the higher, between ∩ under-baseline where it is the lower.
    clipRefArea = clip("ref-area", svgEl("path", {}));
    clipCurArea = clip("cur-area", svgEl("path", {}));

    const plot = svgEl("g", {"clip-path": url("plot")}, svg);
    // Between the extremes: a very light gray under both curves.
    const mid = svgEl("g", {"clip-path": url("mid")}, plot);
    areaEls = [svgEl("path", {fill: MID_FILL}, mid), svgEl("path", {fill: MID_FILL}, mid)];
    betweenEls = [];
    for (const [side, colour] of [["lo", BLUE], ["hi", RED]]) {
      const g = svgEl("g", {"clip-path": url(side)}, plot);
      areaEls.push(svgEl("path", {fill: tint(colour, TINT_BASE)}, g));        // the baseline's tail
      betweenEls.push(svgEl("path", {fill: tint(colour, TINT_LOSS), "clip-path": url("ref-area")}, g)); // the loss
      betweenEls.push(svgEl("path", {fill: colour, "clip-path": url("cur-area")}, g));          // the gain
    }
    refCurve = svgEl("path", {fill: "none", stroke: GRAY_CURVE, "stroke-width": 2, "stroke-linejoin": "round"}, plot);
    curCurve = svgEl("path", {fill: "none", stroke: BLACK_CURVE, "stroke-width": 2.5, "stroke-linejoin": "round"}, plot);

    // The spine, the three words, and a σ scale that only shows with the numbers.
    svgEl("line", {x1: plotL, x2: plotR, y1: plotB, y2: plotB, stroke: "#555", "stroke-width": 1.25}, svg);
    const wordsNow = axisWords ?? fam.words;
    [[xMin(), "start"], [fam.mean0, "middle"], [xMax(), "end"]].forEach(([x, anchor], i) => {
      const t = svgEl("text", {x: xs(x).toFixed(1), y: wordsY, "text-anchor": anchor, "font-size": wordFont, fill: "#555"}, svg);
      t.textContent = wordsNow[i] ?? "";
    });
    tickG = svgEl("g", {}, svg);
    for (let k = Math.ceil(xMin() - fam.mean0); k <= Math.floor(xMax() - fam.mean0); k++) {
      const x = xs(fam.mean0 + k).toFixed(1);
      svgEl("line", {x1: x, x2: x, y1: plotB, y2: plotB + 4, stroke: "#888"}, tickG);
      const t = svgEl("text", {x, y: ticksY, "text-anchor": "middle", "font-size": tickFont, fill: "#888"}, tickG);
      t.textContent = k === 0 ? "0" : `${signed(k, 0)}σ`;
    }

    // Which family this is, top left, in place of a key: the curves are labelled directly.
    caption = svgEl("text", {x: plotL + 4, y: plotT + 12, "font-size": tickFont + 1, fill: "#777"}, svg);
    caption.textContent = `${fam.long ?? fam.name}: ${fam.uses}`;

    // Each tail: a square bracket under the axis facing up at it, with its name under the
    // bracket (and its figures, with the numbers), and a leader to its multiplier up in the
    // plot. The brackets never move: the tail's span on the axis is fixed by the baseline,
    // and what happens above it is the leader's business.
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
      [hi ? "high extremes" : "low extremes", ""].forEach((text, i) => {
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
    refLabel.textContent = "baseline";
    curLabel.textContent = "perturbed";

    render();
  }

  // ---- per-frame drawing ----------------------------------------------------------------------
  function render() {
    const refPts = curvePoints(ref), curPts = curvePoints(cur);
    const peak = pts => pts.reduce((m, [, v]) => Math.max(m, Math.min(v, 1e3)), 0);
    const refPeak = peak(refPts);
    // The frame is twice the baseline peak, and only stretches when the black curve would
    // overflow it, so that the gray curve stays put while the sliders move.
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
    tickG.style.display = numbers ? "" : "none";

    const stats = {lo: tailStats("lo"), hi: tailStats("hi")};
    for (const side of ["lo", "hi"]) {
      placeLeader(side, stats[side]);
      // The second line under the bracket: the figures, with the numbers.
      fitLine(side, 1, numbers ? `${formatShare(stats[side].fNow)} (was ${formatShare(stats[side].fWas)})` : "");
    }
    placeCurveLabels(refPts, curPts);

    svg.setAttribute("aria-label",
      `${fam.long ?? fam.name} distribution, with the extremes beyond the baseline's ${formatShare(tailShare)} tails. ` +
      `High extremes happen ${formatShare(stats.hi.fNow)} of the time, ${formatRatio(stats.hi.ratio)}; ` +
      `low extremes ${formatShare(stats.lo.fNow)} of the time, ${formatRatio(stats.lo.ratio)}.`);
  }

  // A label line under a bracket: centred on it, nudged inward only if it would overflow.
  function fitLine(side, i, text) {
    const el = tails[side].lines[i];
    el.textContent = text;
    const hw = labelHalfWidth(text, labelFont) + 2;
    el.setAttribute("x", clamp(tails[side].cx, hw, w - hw).toFixed(1));
  }

  // A tail's fractions, from the cdfs rather than the picture, and the centroid of the area
  // between the two curves in it, from the samples.
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

  // The multiplier over a tail, on a short vertical leader from the middle of the area
  // between the curves, shown once it is outside the band from half to double, and always
  // with the numbers.
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

  // "baseline" and "perturbed" beside their curves' peaks, each on the side away from the
  // other, so that the two never run into each other however the black curve is moved.
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
    makeDistributions();
    render();
    updateSliders();
    emit();
  }

  function setFamily(id) {
    const next = FAMILIES.find(f => f.id === id);
    if (!next || next === fam) return;
    fam = next;
    resetParams();
    makeDistributions();
    makeThresholds();
    updateTabs();
    build();
    updateSliders();
    emit();
  }

  // ---- value --------------------------------------------------------------------------------------
  function value() {
    const hi = tailStats("hi"), lo = tailStats("lo");
    return {
      family: fam.id,
      mean: mean - fam.mean0, sd, skewness: skew, kurtosis: kurt, // in units of the baseline σ, mean relative to the baseline
      tail: tailShare,
      highThreshold: thrHi - fam.mean0, lowThreshold: thrLo - fam.mean0,
      highFraction: hi.fNow, highRatio: hi.ratio,
      lowFraction: lo.fNow, lowRatio: lo.ratio,
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

  updateTabs();
  layoutControls();
  build();
  updateSliders();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); layoutControls(); build(); }
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
  if (r >= 1.05) return `${formatMultiplier(r)}× as often`;
  if (r <= 0.95) return `${formatMultiplier(1 / r)}× rarer`;
  return "about as often";
}
// "0.5", "2.3", "12": two figures below ten, whole numbers above, and never a bare "0".
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
// A colour at `t` of the way from the plate to `hex`, as an opaque colour.
function tint(hex, t) {
  const n = parseInt(hex.slice(1), 16), b = parseInt(BACKGROUND.slice(1), 16);
  const ch = s => Math.round(((b >> s) & 255) + (((n >> s) & 255) - ((b >> s) & 255)) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
