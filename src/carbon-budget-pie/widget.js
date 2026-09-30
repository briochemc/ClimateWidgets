// The carbon budget as a pie: the whole circle is the CO₂ the world can emit in all, since
// 1850, and still keep warming under a chosen limit (1.5, 1.7 or 2 °C); the slices, clockwise
// from twelve o'clock, are what has been emitted so far, and the grey wedge what is left.
// Switching the limit changes the size of the whole, so the same emissions fill nearly all
// of the 1.5 °C pie and three quarters of the 2 °C one. The two other limits are marked on
// the grey as thin radial ticks, so where each would run out is always in view.
//
// The emitted part can be sliced five ways: as one piece; by region; by country (every
// country its own slice, colours cycling through a palette so that neighbours never match,
// and a click names one); by year, alternating two greys so that each year is a band of its
// own, every tenth one labelled; or by decade. Regions are not subdivided and decades are
// not split into years: each way is one ring of slices. None has a key: the slices are
// there to be clicked. Time runs on the same slider as the grid widget, and the tour plays
// the years through in the same manner. The budget arithmetic, the palettes and the number
// formats are the grid widget's, imported from it, so the two never disagree.

import {COLOURS, budgetSeries, budgetThresholds, formatGt, formatLimit} from "../carbon-budget/widget.js";

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const PIE_MAX = 420;      // the pie's diameter cap, px
const ACCENT = "#0b57d0";
const EPS = 1e-9;

export const SLICE_MODES = ["none", "region", "country", "year", "decade"];

const YEAR_ALT = "#767676";   // the year layout alternates the plain fill with this

// Countries cycle through tab20's vibrant hues, all the darks first and then all the lights,
// so that neighbouring slices differ in hue and not only in shade.
const COUNTRY_COLOURS = [...COLOURS.decades.filter((_, i) => i % 2 === 0), ...COLOURS.decades.filter((_, i) => i % 2 === 1)];

export function createCarbonBudgetPieWidget({data, width = FIGURE_WIDTH, year, estimate, limit, colour} = {}) {
  if (!data?.years || !data?.budgets) throw new Error("createCarbonBudgetPieWidget needs {data}: the contents of carbon-budget.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- state ------------------------------------------------------------------------------------
  const series = budgetSeries(data);
  const {years, regions, firstYear, lastYear} = series;
  const countries = regions.flatMap(r => r.countries);
  const ESTIMATES = data.budgets.estimates;
  let estimateId = ESTIMATES.some(e => e.id === estimate) ? estimate : ESTIMATES[0].id;
  let thresholds = budgetThresholds(data, series, estimateId);
  let limitIndex = Math.max(0, thresholds.findIndex(th => Number(th.limit) === Number(limit)));
  const modes = regions.length ? SLICE_MODES : ["none", "year", "decade"];
  let mode = modes.includes(colour) ? colour : modes[0];
  let t = clamp(Math.round(Number(year)) || lastYear, firstYear, lastYear);
  let selected = null, hovered = null;
  const shown = () => hovered ?? selected;
  let glide = null, raf = null;

  // Time is continuous, as in the grid widget: t = 1990 is the end of 1990.
  function fillOf(byYear, cumulative, tt) {
    const k = Math.floor(tt + EPS) - firstYear;
    if (k < 0) return 0;
    const n = byYear.length;
    return cumulative[Math.min(k, n - 1)] + (k + 1 < n ? clamp(tt - years[k].year, 0, 1) * byYear[k + 1] : 0);
  }
  const worldByYear = years.map(y => y.total), worldCumulative = years.map(y => y.end);
  const fillAt = tt => fillOf(worldByYear, worldCumulative, tt);
  const blockFill = (block, tt) => fillOf(block.byYear, block.cumulative, tt);
  const whole = () => thresholds[limitIndex].total;

  // ---- layout -----------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, D, R, cx, cy, svgH, labelFont;
  let side;
  function applyLayout(newW) {
    w = newW;
    side = clamp(Math.round(w * 0.17), 60, 104);   // room either side for the slice labels
    D = Math.min(PIE_MAX, w - 2 * side);
    R = D / 2;
    cx = w / 2;
    cy = 26 + R;
    svgH = D + 52;
    labelFont = w < 420 ? 12 : 13;
  }
  applyLayout(maxW);

  // ---- DOM --------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;padding:0 0 8px;font-size:13px;";
  container.appendChild(controls);

  function buttonRow(label, choices, onPick) {
    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;align-items:center;gap:6px;color:#666;";
    bar.append(label);
    const buttons = choices.map((choice, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      if (choice.title) b.title = choice.title;
      const first = i === 0, last = i === choices.length - 1;
      b.style.cssText =
        "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;position:relative;" +
        `border-radius:${first ? "999px 0 0 999px" : last ? "0 999px 999px 0" : "0"};${first ? "" : "margin-left:-1px;"}`;
      b.addEventListener("click", () => { stopTour(); onPick(choice.id); });
      bar.appendChild(b);
      return b;
    });
    const update = current => buttons.forEach((b, i) => {
      const on = choices[i].id === current;
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.color = on ? ACCENT : "#333";
      b.style.zIndex = on ? 1 : 0;
      b.setAttribute("aria-pressed", on);
    });
    controls.appendChild(bar);
    return update;
  }

  const MODE_LABELS = {none: "None", region: "Region", country: "Country", year: "Year", decade: "Decade"};
  const updateModeButtons = buttonRow("Slices", modes.map(m => ({id: m, label: MODE_LABELS[m]})), setMode);
  const updateLimitButtons = buttonRow("Limit", thresholds.map((th, i) => ({id: i, label: th.label})), setLimit);
  const updateEstimateButtons = buttonRow("Budget", ESTIMATES.map(e => ({
    id: e.id, label: e.short ?? e.name,
    title: `${e.name}: ${e.GtCO2.map((g, k) => `${g} GtCO₂ for ${formatLimit(data.budgets.thresholds[k])}`).join(", ")}`,
  })), setEstimate);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;margin-left:auto;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);

  // The year, its slider, and the running total against the whole.
  const header = document.createElement("div");
  header.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;padding:0 0 4px;";
  const yearLabel = document.createElement("span");
  yearLabel.style.cssText = "font-weight:bold;font-size:24px;color:#222;min-width:3.2em;";
  const sliderRow = document.createElement("label");
  sliderRow.style.cssText = "display:flex;flex:1 1 160px;align-items:center;gap:8px;font-size:13px;color:#666;cursor:pointer;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = firstYear;
  slider.max = lastYear;
  slider.step = 1;
  slider.value = t;
  slider.style.cssText = `flex:1 1 100px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", `Year, ${firstYear} to ${lastYear}`);
  slider.addEventListener("input", e => { e.stopPropagation(); stopTour(); setTime(Number(slider.value)); });
  sliderRow.append(String(firstYear), slider, String(lastYear));
  const totalLabel = document.createElement("span");
  totalLabel.style.cssText = "color:#333;";
  header.append(yearLabel, sliderRow, totalLabel);
  container.appendChild(header);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "carbon-budget-pie");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:pointer;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.setAttribute("aria-live", "polite");
  status.style.cssText = "padding:10px 0 0;color:#555;min-height:2.8em;line-height:1.4;";
  const statusHead = document.createElement("strong");
  statusHead.style.color = "#222";
  const statusBody = document.createElement("span");
  status.append(statusHead, statusBody);
  container.appendChild(status);

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  const HINT_IDLE = "Click or tap a slice to see what it is; click again to let go. Drag the slider to a year.";
  const HINT_TOUR = "Playing the years through — move the slider or click anything to take over; Play tour starts it again.";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- slices -----------------------------------------------------------------------------------
  // The emitted part at time tt, cut the current way: each slice {kind, block, from, to,
  // colour}, in order round the pie. Blocks with nothing emitted yet get no slice.
  function slicesAt(tt) {
    const out = [];
    let at = 0;
    const push = (kind, block, amount, colour) => {
      if (amount > EPS) out.push({kind, block, from: at, to: at + amount, colour});
      at += amount;
    };
    if (mode === "none") push("all", null, fillAt(tt), COLOURS.plain);
    else if (mode === "region") for (const r of regions) push("region", r, blockFill(r, tt), COLOURS.regions[r.id] ?? "#8c7a4e");
    else if (mode === "country") {
      countries.forEach((c, i) => push("country", c, blockFill(c, tt), COUNTRY_COLOURS[i % COUNTRY_COLOURS.length]));
      // The ring closes on itself: the last slice must not match the first.
      if (out.length > 1 && out[out.length - 1].colour === out[0].colour) {
        const i = COUNTRY_COLOURS.indexOf(out[out.length - 1].colour);
        out[out.length - 1].colour = COUNTRY_COLOURS[(i + 1) % COUNTRY_COLOURS.length];
      }
    } else if (mode === "year") {
      const y = Math.floor(tt + EPS);
      for (const yr of years) {
        if (yr.year > y + 1) break;
        // Years alternate between the plain fill and a lighter grey, so each is its own band.
        push("year", yr, yr.year <= y ? yr.total : clamp(tt - y, 0, 1) * yr.total, (yr.year - firstYear) % 2 ? YEAR_ALT : COLOURS.plain);
      }
    } else {
      const y = Math.floor(tt + EPS);
      for (let d = 0; firstYear + 10 * d <= y + 1; d++) {
        const from = firstYear + 10 * d, to = from + 9;
        let amount = 0;
        for (const yr of years) {
          if (yr.year < from || yr.year > to) continue;
          amount += yr.year <= y ? yr.total : yr.year === y + 1 ? clamp(tt - y, 0, 1) * yr.total : 0;
        }
        // The last decade is not a whole one: it is named by the years the data cover.
        const partial = to > lastYear;
        push("decade", {from, to, partial, label: partial ? `${from}–${lastYear}` : `${from}s`}, amount, COLOURS.decades[d % COLOURS.decades.length]);
      }
    }
    return out;
  }


  // Clockwise from twelve o'clock: the point on the rim at a fraction f of the whole.
  const angle = f => 2 * Math.PI * f;
  const rim = (f, r = R) => [cx + r * Math.sin(angle(f)), cy - r * Math.cos(angle(f))];
  function wedgePath(f0, f1) {
    const F = v => v.toFixed(2);
    if (f1 - f0 >= 1 - 1e-6) return `M${F(cx)},${F(cy - R)}A${F(R)},${F(R)} 0 1 1 ${F(cx)},${F(cy + R)}A${F(R)},${F(R)} 0 1 1 ${F(cx)},${F(cy - R)}Z`;
    const [x0, y0] = rim(f0), [x1, y1] = rim(f1);
    return `M${F(cx)},${F(cy)}L${F(x0)},${F(y0)}A${F(R)},${F(R)} 0 ${f1 - f0 > 0.5 ? 1 : 0} 1 ${F(x1)},${F(y1)}Z`;
  }

  // ---- drawing ----------------------------------------------------------------------------------
  let slices = [];
  let sliceGroup, restPath, tickGroup, labelGroup, pickHalo, pickPath, pickLabel, centreYear;

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    restPath = svgEl("path", {fill: COLOURS.bands[0], "data-rest": "1"}, svg);
    sliceGroup = svgEl("g", {}, svg);   // no outlines: at 176 slices they would be most of the ink
    tickGroup = svgEl("g", {"pointer-events": "none"}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-size": 12, fill: "#333"}, svg);
    pickHalo = svgEl("path", {fill: "none", stroke: "#fff", "stroke-width": 4, "stroke-linejoin": "round", "pointer-events": "none"}, svg);
    pickPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.5, "stroke-linejoin": "round", "pointer-events": "none"}, svg);
    // The year, large, at the centre of the pie, haloed so it reads on any slice.
    centreYear = svgEl("text", {
      x: cx.toFixed(1), y: cy.toFixed(1), "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": Math.round(R * 0.22), "font-weight": "bold", fill: "#222",
      stroke: "#fff", "stroke-width": 5, "paint-order": "stroke", "stroke-linejoin": "round", "pointer-events": "none",
    }, svg);
    pickLabel = svgEl("text", {
      "text-anchor": "middle", "dominant-baseline": "central", "font-size": labelFont, "font-weight": "bold", fill: "#111",
      stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round", "pointer-events": "none",
    }, svg);
    render();
  }

  function render() {
    const W = whole(), cum = fillAt(t);
    slices = slicesAt(t);
    sliceGroup.replaceChildren();
    slices.forEach((s, i) => {
      svgEl("path", {d: wedgePath(s.from / W, Math.min(s.to, W) / W), fill: s.colour, "data-i": i}, sliceGroup);
    });
    restPath.setAttribute("d", cum < W - EPS ? wedgePath(cum / W, 1) : "");

    // The limits as ticks on the rim with their labels outside it: the chosen one at twelve
    // o'clock, where the circle closes, and the smaller ones on the grey.
    tickGroup.replaceChildren();
    thresholds.forEach((th, i) => {
      if (th.total > W + EPS) return;
      const f = i === limitIndex ? 1 : th.total / W;
      const [x0, y0] = rim(f, R - 10), [x1, y1] = rim(f, R + 6), [lx, ly] = rim(f, R + 16);
      svgEl("path", {d: `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`, stroke: "#222", "stroke-width": 1.5}, tickGroup);
      const label = svgEl("text", {
        x: lx.toFixed(1), y: ly.toFixed(1), "font-size": 12, fill: "#222", "dominant-baseline": "central",
        "text-anchor": Math.sin(angle(f)) > 0.2 ? "start" : Math.sin(angle(f)) < -0.2 ? "end" : "middle",
      }, tickGroup);
      label.textContent = th.label;
    });
    drawSliceLabels(W);

    yearLabel.textContent = Math.floor(t + EPS);
    centreYear.textContent = Math.floor(t + EPS);
    totalLabel.textContent = `${formatGt(cum)} of ${formatGt(W)} GtCO₂ for ${thresholds[limitIndex].label} (${Math.round(100 * cum / W)}%)`;
    if (String(slider.value) !== String(Math.floor(t + EPS))) slider.value = Math.floor(t + EPS);
    updatePick();
  }

  // Slices named outside the rim, with a leader from each slice's middle: every decade, every
  // tenth year, and the regions and countries with more than a twentieth of the pie. Labels
  // on each side of the circle are sorted by height and pushed a line apart.
  const LABEL_GAP = 14;
  const LABEL_SHARE = 0.05;
  function drawSliceLabels(W) {
    labelGroup.replaceChildren();
    if (mode === "none") return;
    const top = slices.map(s => ({s, amount: Math.min(s.to, W) - s.from})).filter(d => d.amount > EPS && (
      d.s.kind === "decade" ? true
      : d.s.kind === "year" ? d.s.block.year % 10 === 0
      : d.amount / W >= LABEL_SHARE));
    const items = top.map(d => {
      const mid = (d.s.from + Math.min(d.s.to, W)) / 2 / W;
      const a = angle(mid);
      return {s: d.s, mid, right: Math.sin(a) >= 0, y: cy - Math.cos(a) * (R + 12)};
    });
    for (const right of [true, false]) {
      const list = items.filter(it => it.right === right).sort((p, q) => p.y - q.y);
      for (let i = 1; i < list.length; i++) if (list[i].y < list[i - 1].y + LABEL_GAP) list[i].y = list[i - 1].y + LABEL_GAP;
      for (let i = list.length - 1; i >= 0; i--) {
        const lim = i === list.length - 1 ? cy + R + 14 : list[i + 1].y - LABEL_GAP;
        if (list[i].y > lim) list[i].y = lim;
      }
      const dir = right ? 1 : -1;
      for (const it of list) {
        const [x0, y0] = rim(it.mid, R - 3);
        const x1 = cx + dir * (R + 8), x2 = cx + dir * (R + 16);
        svgEl("path", {
          d: `M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${it.y.toFixed(1)}L${x2.toFixed(1)},${it.y.toFixed(1)}`,
          fill: "none", stroke: "#777", "stroke-width": 0.8,
        }, labelGroup);
        const text = svgEl("text", {
          x: (x2 + dir * 3).toFixed(1), y: it.y.toFixed(1), "dominant-baseline": "central", "text-anchor": right ? "start" : "end",
        }, labelGroup);
        text.textContent = nameOf(it.s);
      }
    }
  }

  // The slice picked out (by a click, or under the mouse): outlined and named at its middle.
  function updatePick() {
    const h = shown();
    const s = h === null ? null : slices.find(s => sameBlock(s, h)) ?? null;
    const W = whole();
    if (!s) {
      pickHalo.setAttribute("d", "");
      pickPath.setAttribute("d", "");
      pickLabel.textContent = "";
    } else {
      const d = wedgePath(s.from / W, Math.min(s.to, W) / W);
      pickHalo.setAttribute("d", d);
      pickPath.setAttribute("d", d);
      const mid = (s.from + Math.min(s.to, W)) / 2 / W;
      const [lx, ly] = rim(mid, R * 0.62);
      pickLabel.setAttribute("x", lx.toFixed(1));
      pickLabel.setAttribute("y", ly.toFixed(1));
      pickLabel.textContent = nameOf(s);
    }
    updateStatus();
  }

  const nameOf = s => s.kind === "country" ? (s.block.members ? `${s.block.name}, ${s.block.region.name}` : s.block.name) : s.kind === "region" ? s.block.name
    : s.kind === "year" ? String(s.block.year) : s.kind === "decade" ? s.block.label : "Emitted";
  const sameBlock = (a, b) => a && b && a.kind === b.kind && (a.kind === "all" || a.kind === "rest" ||
    (a.kind === "decade" ? a.block.from === b.block.from : a.block === b.block));

  // ---- read-outs ------------------------------------------------------------------------------
  function describe() {
    const y = Math.floor(t + EPS), yr = years[y - firstYear], cum = fillAt(t), W = whole(), th = thresholds[limitIndex];
    const h = shown();
    if (h?.kind === "rest") {
      const left = W - cum;
      return {head: "Not yet emitted. ", body: `${formatGt(left)} GtCO₂ left for ${th.label} at the end of ${y}: ${formatYears(left / yr.total)} years at ${y}'s rate of ${formatGt(yr.total)} GtCO₂ a year.`};
    }
    const s = h === null ? null : slices.find(s => sameBlock(s, h));
    if (s) {
      const amount = s.to - s.from, k = y - firstYear;
      const share = `${formatPercent(amount / cum)} of what has been emitted, ${formatPercent(amount / W)} of the ${th.label} budget`;
      if (s.kind === "country") {
        const c = s.block, who = c.members ? `${c.name}, ${c.members} smaller countr${c.members > 1 ? "ies" : "y"}` : c.name;
        return {head: `${who} (${c.region.name}). `, body: `${formatGt(amount)} GtCO₂ since ${firstYear}: ${share}. ${formatGt(c.byYear[k])} GtCO₂ in ${y}.`};
      }
      if (s.kind === "region") {
        const r = s.block;
        const top = r.countries.filter(c => !c.members && c.cumulative[k] > 0).slice(0, 3).map(c => `${c.name} ${formatGt(c.cumulative[k])}`);
        return {head: `${r.name}${r.note ? ` (${r.note})` : ""}. `, body: `${formatGt(amount)} GtCO₂ since ${firstYear}: ${share}` + (top.length ? `; most of it ${joinList(top)}` : "") + "."};
      }
      if (s.kind === "year") {
        const b = s.block;
        return {head: `${b.year}${b.projected ? " (projected)" : ""}. `, body: `${formatGt(b.total)} GtCO₂ that year: ${formatGt(b.fossil)} from fossil fuels and cement, ${formatGt(b.landUse)} from land use; ${share}.`};
      }
      if (s.kind === "decade") return {head: `${s.block.partial ? "" : "The "}${s.block.label}. `, body: `${formatGt(amount)} GtCO₂: ${share}.`};
    }
    const left = W - cum;
    return {
      head: `End of ${y}${yr.projected ? " (projected)" : ""}. `,
      body: `${formatGt(cum)} GtCO₂ emitted since ${firstYear}, ${formatPercent(cum / W)} of the ${th.label} budget; ${formatGt(left)} left, ` +
        `${formatYears(left / yr.total)} years at ${y}'s rate of ${formatGt(yr.total)} GtCO₂ a year.`,
    };
  }

  function updateStatus() {
    const {head, body} = describe();
    statusHead.textContent = head;
    statusBody.textContent = body;
    svg.setAttribute("aria-label", `The carbon budget for ${thresholds[limitIndex].label} as a pie, filled clockwise from the top to the end of ${Math.floor(t + EPS)}, sliced by ${mode}. ${head}${body}`);
  }

  // ---- pointer ----------------------------------------------------------------------------------
  function hitOf(e) {
    const el = e.target;
    if (el === restPath) return {kind: "rest"};
    const i = el?.getAttribute?.("data-i");
    if (i === null || i === undefined) return null;
    const s = slices[Number(i)];
    return s ? {kind: s.kind, block: s.block} : null;
  }
  svg.addEventListener("click", e => {
    const hit = hitOf(e);
    const next = hit === null || sameBlock(hit, selected) ? null : hit;
    selected = next;
    hovered = null;
    updatePick();
    emit();
  });
  svg.addEventListener("pointerdown", () => stopTour());
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const next = hitOf(e);
    const same = (next === null && hovered === null) || sameBlock(next, hovered);
    if (!same) { hovered = next; updatePick(); }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse" || hovered === null) return;
    hovered = null;
    updatePick();
  });

  // ---- state changes ----------------------------------------------------------------------------
  function setTime(v) {
    v = clamp(v, firstYear, lastYear);
    const before = Math.floor(t + EPS);
    t = v;
    render();
    if (Math.floor(t + EPS) !== before) emit();
  }
  function setEstimate(id) {
    if (id === estimateId || !ESTIMATES.some(e => e.id === id)) return;
    estimateId = id;
    thresholds = budgetThresholds(data, series, estimateId);
    updateEstimateButtons(estimateId);
    render();
    emit();
  }
  function setLimit(i) {
    if (i === limitIndex || !thresholds[i]) return;
    limitIndex = i;
    updateLimitButtons(limitIndex);
    render();
    emit();
  }
  function setMode(m) {
    if (m === mode || !modes.includes(m)) return;
    mode = m;
    updateModeButtons(mode);
    selected = null;
    hovered = null;
    render();
    emit();
  }

  function glideTo(target, ms) {
    target = clamp(target, firstYear, lastYear);
    if (reduceMotion || ms <= 0 || target === t) { glide = null; setTime(target); return; }
    glide = {from: t, to: target, start: performance.now(), duration: ms};
    if (raf === null) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = null;
    if (container.isConnected === false || !glide) return;
    const p = clamp((now - glide.start) / glide.duration, 0, 1);
    setTime(glide.from + (glide.to - glide.from) * p);
    if (p >= 1) glide = null;
    else raf = requestAnimationFrame(frame);
  }

  // ---- value ------------------------------------------------------------------------------------
  function value() {
    const y = Math.floor(t + EPS), cum = fillAt(y);
    return {
      year: y, estimate: estimateId, limit: thresholds[limitIndex].limit, colour: mode,
      selected: selected === null ? null : selected.kind === "rest" ? {rest: true} : {[selected.kind]: nameOf(selected)},
      emitted: Math.round(cum),
      remaining: Object.fromEntries(thresholds.map(th => [th.limit, Math.round(th.total - cum)])),
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  updateModeButtons(mode);
  updateLimitButtons(limitIndex);
  updateEstimateButtons(estimateId);
  build();
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

  // ---- tour -------------------------------------------------------------------------------------
  // The grid widget's: back to 1850, then the years at a steady pace, a rest, and round again.
  const MS_PER_YEAR = 65;
  const TOUR_HOLD = 2600;
  const TOUR_STOPS = [{to: firstYear, ms: 0, hold: 900}, {to: lastYear, ms: (lastYear - firstYear) * MS_PER_YEAR, hold: TOUR_HOLD}];
  let touring = false, tourTimer = null, tourWatcher = null;

  function tourStep(i) {
    if (!touring) return;
    if (container.isConnected === false) return stopTour();
    const stop = TOUR_STOPS[i % TOUR_STOPS.length];
    glideTo(stop.to, stop.ms);
    tourTimer = setTimeout(() => tourStep((i + 1) % TOUR_STOPS.length), (reduceMotion ? 0 : stop.ms) + stop.hold);
  }
  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    if (glide) { glide = null; setTime(Math.round(t)); }
    hint.textContent = HINT_IDLE;
    showTouring();
  }
  function showTouring() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }
  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
    selected = null;
    hovered = null;
    updatePick();
    hint.textContent = HINT_TOUR;
    showTouring();
    tourTimer = setTimeout(() => tourStep(0), delay);
  }
  if (!reduceMotion) {
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

// ---- helpers ------------------------------------------------------------------------------------

function formatPercent(f) {
  const p = 100 * f;
  return `${p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1) : p.toFixed(2)}%`;
}
function formatYears(v) {
  return v >= 10 ? String(Math.round(v)) : v.toFixed(1);
}
function joinList(items) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexToRgba(hex, alpha) {
  return `rgba(${hexToRgb(hex).join(",")},${alpha})`;
}
