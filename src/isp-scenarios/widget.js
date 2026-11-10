// The National Electricity Market to 2050, under AEMO's 2026 Integrated System Plan: a stacked
// area of annual generation (TWh) or capacity (GW) by technology, financial year by financial
// year, the history in solid colour and AEMO's projection, hatched, after it, for each of the
// three scenarios AEMO planned against; in terawatt hours or gigawatts, or as each technology's
// share. There is no key and no pop-up: a probe stands at the last year with each technology's
// value written beside its band, for every one above one per cent. Move the pointer across the
// chart to read another year, click to pin it, and click a band to pick that technology out,
// which also names one too small to be labelled on its own. Drawn in the style of the Hickman
// and climate-funds widgets: a grey plate, a bold title in the corner, quiet gridlines with
// their labels on them, segmented dark buttons, and the sources in small type at the bottom
// right. The data file is built by scripts/isp-scenarios.mjs. Self-contained: no d3, no imports.
//
// Options: {scenario: "step_change" | "accelerated_transition" | "slower_growth"} (with
// hyphens too), {measure: "generation" | "capacity"}, {unit: "absolute" | "share"},
// {select: "coal_black"} (a technology id from the data file) to open with it picked out;
// {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const GRID = "#b3b3b3";
const LINK = "#0b57d0";
const CHART_H = 270;
const MIN_LABEL_SHARE = 1;              // per cent a technology needs to be labelled unasked

export const MEASURES = [
  {id: "generation", label: "Generation", unit: "TWh", of: "% of generation", title: "Electricity generated in the financial year; storage left out, as in AEMO's figure"},
  {id: "capacity", label: "Capacity", unit: "GW", of: "% of capacity", title: "Installed capacity at the end of the financial year, storage included"},
];

export function createIspScenariosWidget({data, width = FIGURE_WIDTH, scenario: initialScenario, measure: initialMeasure, unit: initialUnit, select: initialSelect} = {}) {
  if (!data?.projections || !data?.techs) throw new Error("createIspScenariosWidget needs {data}: the contents of isp-2026.json");

  // ---- data -----------------------------------------------------------------------------------
  const techs = data.techs;
  const scenarios = data.scenarios;
  const scenarioIds = scenarios.map(s => s.id);
  const normalise = s => String(s ?? "").toLowerCase().replace(/-/g, "_");

  // ---- state ----------------------------------------------------------------------------------
  let scenario = scenarioIds.includes(normalise(initialScenario)) ? normalise(initialScenario) : scenarioIds[0];
  let measure = MEASURES.some(m => m.id === initialMeasure) ? initialMeasure : "generation";
  let unit = /^(share|percent|%)$/.test(String(initialUnit ?? "")) ? "share" : "absolute";
  let selected = techs.some(t => t.id === normalise(initialSelect)) ? normalise(initialSelect) : null;
  let pinned = null, probe = null, hovered = null;
  const measureOf = () => MEASURES.find(m => m.id === measure);

  // The series for the measure: history and projection laid on one axis of financial years,
  // with nulls where neither has a figure (the capacity history ends before the projection
  // begins). Storage is left out of the generation stack, as AEMO's figure leaves it out. As
  // shares, each year's stack is scaled to 100.
  function compute() {
    const hist = data.history[measure];
    const proj = data.projections[scenario];
    const years = [];
    for (let y = hist.years[0]; y <= proj.years.at(-1); y++) years.push(y);
    const lastHistory = hist.years.at(-1);
    const list = techs.filter(t => !(measure === "generation" && t.storage));
    const rows = list.map(t => ({t, v: years.map(y => {
      const i = hist.years.indexOf(y);
      if (i >= 0) return hist.values[t.id][i];
      const j = proj.years.indexOf(y);
      return j >= 0 ? proj[measure][t.id][j] : null;
    })}));
    const total = years.map((_, i) => rows.every(r => r.v[i] === null) ? null : rows.reduce((s, r) => s + (r.v[i] ?? 0), 0));
    const share = (r, i) => total[i] > 0 ? 100 * (r.v[i] ?? 0) / total[i] : 0;
    const stackTop = new Array(years.length).fill(0);
    for (const r of rows) {
      r.y0 = []; r.y1 = [];
      for (let i = 0; i < years.length; i++) {
        if (r.v[i] === null) { r.y0.push(null); r.y1.push(null); continue; }
        const v = unit === "share" ? share(r, i) : Math.max(0, r.v[i]);
        r.y0.push(stackTop[i]);
        stackTop[i] += v;
        r.y1.push(stackTop[i]);
      }
    }
    return {years, lastHistory, rows, total, share, stackTop};
  }

  // ---- layout ---------------------------------------------------------------------------------
  const ctx = document.createElement("canvas").getContext("2d");
  function textWidth(text, px, weight = "normal") {
    ctx.font = `${weight} ${px}px sans-serif`;
    return ctx.measureText(text).width;
  }
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, titleFont, sourceFont, tickFont, labelFont, sourceLines;
  const sourcePieces = [
    {text: "Projections: "},
    {text: "AEMO (2026), 2026 Integrated System Plan", url: data.source?.pdf ?? data.source?.url, title: data.source?.name},
    {text: `, ${data.pathway ?? "optimal development path"}, via `},
    {text: "Open Electricity's Scenario Explorer", url: data.source?.viaUrl},
    {text: ". History: "},
    {text: "Open Electricity (CC BY-NC 4.0)", url: "https://openelectricity.org.au/"},
    {text: "."},
  ];
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = lerp(16, 22);
    sourceFont = lerp(7.5, 9);
    tickFont = lerp(10, 11);
    labelFont = lerp(10.5, 12);
    plotL = 8;
    plotR = w - 8;
    plotT = 22;
    plotB = plotT + CHART_H;
    sourceLines = [];
    let line = [], lineW = 0;
    for (const p of sourcePieces) {
      const pw = textWidth(p.text, sourceFont);
      if (line.length && lineW + pw > plotR - plotL) { sourceLines.push(line); line = []; lineW = 0; }
      line.push({...p, w: pw});
      lineW += pw;
    }
    if (line.length) sourceLines.push(line);
    svgH = plotB + 24 + sourceLines.length * (sourceFont + 4) + 6;
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px ${CARD_PAD}px ${CARD_PAD}px;` +
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;`;
  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 2px;";
  heading.textContent = "The NEM to 2050, under AEMO's Integrated System Plan";
  container.appendChild(heading);
  const subheading = document.createElement("div");
  subheading.style.cssText = "font-size:12px;color:#666;padding:0 0 10px;line-height:1.35;";
  container.appendChild(subheading);

  const scenarioRow = document.createElement("div");
  scenarioRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 6px;";
  container.appendChild(scenarioRow);
  const updateScenarioButtons = segmented(scenarioRow, scenarios.map(s => ({id: s.id, label: s.label, title: s.description})), setScenario);
  const optionsRow = document.createElement("div");
  optionsRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 8px;";
  container.appendChild(optionsRow);
  const updateMeasureButtons = segmented(optionsRow, MEASURES, setMeasure);
  // The unit control names the measure's unit and share, so it is rebuilt when the measure changes.
  const unitBox = document.createElement("span");
  optionsRow.appendChild(unitBox);
  let updateUnitButtons = () => {};
  function buildUnitButtons() {
    unitBox.replaceChildren();
    const m = measureOf();
    updateUnitButtons = segmented(unitBox, [
      {id: "absolute", label: m.unit, title: m.title},
      {id: "share", label: m.of, title: `Each technology as a percentage of the ${measure} in the year`},
    ], setUnit);
    updateUnitButtons(unit);
  }
  buildUnitButtons();

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "isp-scenarios");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:crosshair;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const F = v => (Math.round(v * 100) / 100).toString();
  const patternId = `isp-hatch-${Math.random().toString(36).slice(2, 8)}`;

  // ---- drawing --------------------------------------------------------------------------------
  let gridGroup, areaGroup, labelGroup, axisGroup, probeGroup, sourceGroup;
  let current = null, xOf, yOf, slot = 1;

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    // White hatching, laid over the projected years so they read as a forecast.
    const defs = svgEl("defs", {}, svg);
    const pat = svgEl("pattern", {id: patternId, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"}, defs);
    svgEl("path", {d: "M0,0V6", stroke: "#fff", "stroke-width": 1.4, opacity: 0.45}, pat);
    gridGroup = svgEl("g", {"pointer-events": "none"}, svg);
    areaGroup = svgEl("g", {}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "stroke-linejoin": "round"}, svg);
    axisGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    probeGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    sourceGroup = svgEl("g", {"font-family": "sans-serif"}, svg);
    render();
  }

  function render() {
    const c = compute();
    current = c;
    const {years, lastHistory, rows, stackTop} = c;
    const sc = scenarios.find(s => s.id === scenario);
    const m = measureOf();
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
    subheading.textContent = `${sc.label}${sc.likelihood ? ` (AEMO's weight: ${Math.round(sc.likelihood * 100)}%)` : ""}: ${sc.description ?? ""} ` +
      `Financial years ending ${years[0]} to ${years.at(-1)}; history to ${lastHistory}, projection after. ` +
      "Point at the chart for another year, click to pin it, click a band to pick a technology out.";

    const n = years.length;
    slot = (plotR - plotL) / n;
    xOf = i => plotL + (i + 0.5) * slot;
    const top = unit === "share" ? 100 : Math.max(1, ...stackTop);
    const step = unit === "share" ? 20 : niceStep(top / 5);
    const yMax = unit === "share" ? 100 : Math.ceil(top / step) * step;
    yOf = v => plotB - v / yMax * CHART_H;

    gridGroup.replaceChildren();
    labelGroup.replaceChildren();
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      const y = yOf(v);
      svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: v === 0 ? "#888" : GRID, "stroke-width": v === 0 ? 1 : 0.8}, gridGroup);
      if (v === 0) continue;
      const tl = svgEl("text", {x: F(plotL + 2), y: F(y - 3), "font-size": tickFont, fill: "#666"}, labelGroup);
      tl.textContent = unit === "share" ? `${Math.round(v)}%` : `${formatNumber(v)} ${m.unit}`;
    }

    // The areas; a run of years with figures is one path, so a gap in the history breaks it.
    // A technology picked out keeps its colour and the rest fade.
    areaGroup.replaceChildren();
    const pick = hovered ?? selected;
    const iProj = years.indexOf(lastHistory) + 1;
    for (const r of rows) {
      let d = "";
      const runs = [];
      let run = null;
      for (let i = 0; i < n; i++) {
        if (r.y0[i] === null) { if (run) { runs.push(run); run = null; } continue; }
        (run ??= []).push(i);
      }
      if (run) runs.push(run);
      for (const idx of runs) {
        d += idx.map((i, k) => `${k ? "L" : "M"}${F(xOf(i))},${F(yOf(r.y1[i]))}`).join("");
        d += [...idx].reverse().map(i => `L${F(xOf(i))},${F(yOf(r.y0[i]))}`).join("") + "Z";
      }
      const path = svgEl("path", {d, fill: r.t.colour, "data-id": r.t.id, opacity: pick && pick !== r.t.id ? 0.35 : 1,
        ...(pick === r.t.id ? {stroke: "#111", "stroke-width": 1.2, "stroke-linejoin": "round"} : {})}, areaGroup);
      svgEl("title", {}, path).textContent = r.t.label;
    }
    if (iProj < n) {
      let d = "";
      for (let i = iProj; i < n; i++) d += `${i === iProj ? "M" : "L"}${F(xOf(i))},${F(yOf(stackTop[i]))}`;
      d += `L${F(xOf(n - 1))},${F(plotB)}L${F(xOf(iProj))},${F(plotB)}Z`;
      svgEl("path", {d, fill: `url(#${patternId})`, "pointer-events": "none"}, areaGroup);
      const xb = xOf(iProj) - slot / 2;
      svgEl("path", {d: `M${F(xb)},${F(plotT)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": "4 3", "pointer-events": "none"}, areaGroup);
      const lbl = svgEl("text", {x: F(xb + 5), y: F(plotT + 12), "font-size": 11, fill: "#333", "font-weight": "bold", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "pointer-events": "none"}, areaGroup);
      lbl.textContent = "projection →";
      const lbl2 = svgEl("text", {x: F(xb - 5), y: F(plotT + 12), "font-size": 11, fill: "#333", "text-anchor": "end", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "pointer-events": "none"}, areaGroup);
      lbl2.textContent = "← history";
    }

    axisGroup.replaceChildren();
    const every = [1, 2, 5, 10].find(e => (n / e) * 40 <= plotR - plotL) ?? 10;
    years.forEach((y, i) => {
      if (y % every) return;
      svgEl("path", {d: `M${F(xOf(i))},${F(plotB)}v4`, stroke: GRID}, axisGroup);
      const tl = svgEl("text", {x: F(xOf(i)), y: F(plotB + 14), "font-size": tickFont, fill: "#666", "text-anchor": "middle"}, axisGroup);
      tl.textContent = `${y}`;
    });
    svgEl("path", {d: `M${F(plotL)},${F(plotB)}H${F(plotR)}`, stroke: "#888"}, axisGroup);

    drawSources();
    drawProbe();
    svg.setAttribute("aria-label", `${m.label} in the National Electricity Market by technology, ${years[0]} to ${years.at(-1)}, ` +
      `history then AEMO's ${sc.label} projection, as stacked areas. In ${years.at(-1)}: ` +
      rows.map(r => `${r.t.label} ${formatNumber(r.v.at(-1) ?? 0)} ${m.unit}`).join(", ") + ".");
  }

  function drawSources() {
    sourceGroup.replaceChildren();
    const lineH = sourceFont + 4;
    sourceLines.forEach((line, i) => {
      const y = plotB + 24 + i * lineH + sourceFont;
      const tx = svgEl("text", {x: F(plotR), y: F(y), "text-anchor": "end", "font-size": sourceFont.toFixed(1), fill: "#808080", "xml:space": "preserve"}, sourceGroup);
      for (const p of line) {
        let parent = tx;
        if (p.url) {
          parent = svgEl("a", {href: p.url, target: "_blank", rel: "noopener"}, tx);
          parent.style.cssText = "cursor:pointer;";
          if (p.title) svgEl("title", {}, parent).textContent = p.title;
        }
        svgEl("tspan", p.url ? {fill: LINK, "text-decoration": "underline"} : {}, parent).textContent = p.text;
      }
    });
  }

  // ---- the probe ------------------------------------------------------------------------------
  // A vertical line at the year shown, the year and the total above the plot, and beside each
  // band its technology's figure: the share, or the TWh or GW with the share after it.
  // Technologies under one per cent are named only when picked out. Labels are laid out down
  // the probe without overlapping, joined to their band's middle by a leader when moved.
  function stepShown() {
    const n = current?.years.length ?? 0;
    if (!n) return null;
    if (probe !== null) return clamp(probe, 0, n - 1);
    if (pinned !== null) return clamp(pinned, 0, n - 1);
    return n - 1;
  }
  function drawProbe() {
    probeGroup.replaceChildren();
    const c = current;
    const i = stepShown();
    if (i === null) return;
    const x = xOf(i);
    const m = measureOf();
    const pick = hovered ?? selected;
    const year = c.years[i];
    svgEl("path", {d: `M${F(x)},${F(plotT - 4)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": pinned === null && probe === null ? "" : "3 3"}, probeGroup);
    const head = svgEl("text", {x: F(x), y: F(plotT - 8), "font-size": labelFont, "font-weight": "bold", fill: "#111",
      "text-anchor": x > plotR - 90 ? "end" : x < plotL + 90 ? "start" : "middle"}, probeGroup);
    head.textContent = `FY${year}` + (c.total[i] === null ? " · no figure" :
      ` · ${formatNumber(c.total[i])} ${m.unit}${measure === "generation" ? " generated" : ""}${year > c.lastHistory ? ` (projected, ${scenarios.find(s => s.id === scenario).label})` : ""}`);

    const labels = [];
    for (const r of c.rows) {
      if (r.v[i] === null) continue;
      const sh = c.share(r, i);
      const picked = pick === r.t.id;
      if (!picked && sh < MIN_LABEL_SHARE) continue;
      const text = unit === "share" ? `${r.t.label} ${formatPct(sh)}` : `${r.t.label} ${formatNumber(r.v[i])} ${m.unit} (${formatPct(sh)})`;
      labels.push({r, text, y: (yOf(r.y0[i]) + yOf(r.y1[i])) / 2, picked});
    }
    const gap = labelFont + 4;
    labels.sort((a, b) => a.y - b.y);
    for (const l of labels) l.ly = l.y;
    for (let k = 1; k < labels.length; k++) labels[k].ly = Math.max(labels[k].ly, labels[k - 1].ly + gap);
    const overflow = labels.length ? labels[labels.length - 1].ly - (plotB + 8) : 0;
    if (overflow > 0) {
      for (const l of labels) l.ly -= overflow;
      for (let k = labels.length - 2; k >= 0; k--) labels[k].ly = Math.min(labels[k].ly, labels[k + 1].ly - gap);
    }
    const widest = Math.max(0, ...labels.map(l => textWidth(l.text, labelFont, l.picked ? "bold" : "normal")));
    const right = x + 10 + widest <= plotR;
    const lx = right ? x + 10 : x - 10;
    for (const l of labels) {
      if (Math.abs(l.ly - l.y) > 2) svgEl("path", {d: `M${F(x)},${F(l.y)}L${F(right ? x + 6 : x - 6)},${F(l.ly)}`, stroke: "#555", "stroke-width": 0.8, fill: "none"}, probeGroup);
      svgEl("circle", {cx: F(x), cy: F(l.y), r: 2.4, fill: l.r.t.colour, stroke: "#fff", "stroke-width": 1}, probeGroup);
      const tx = svgEl("text", {x: F(lx), y: F(l.ly + labelFont * 0.35), "font-size": labelFont, "font-weight": l.picked ? "bold" : "normal",
        "text-anchor": right ? "start" : "end", fill: "#111", "paint-order": "stroke", stroke: "rgba(255,255,255,0.85)", "stroke-width": 3.5, "stroke-linejoin": "round"}, probeGroup);
      tx.textContent = l.text;
    }
  }

  // ---- pointer --------------------------------------------------------------------------------
  function indexAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (w / rect.width);
    if (!current) return null;
    return clamp(Math.floor((x - plotL) / slot), 0, current.years.length - 1);
  }
  const idOf = e => e.target?.getAttribute?.("data-id") ?? null;
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const i = indexAt(e.clientX), id = idOf(e);
    if (i !== probe || id !== hovered) { probe = i; hovered = id; refreshAreas(); drawProbe(); }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse") return;
    probe = null; hovered = null;
    refreshAreas(); drawProbe();
  });
  svg.addEventListener("pointerdown", e => {
    const i = indexAt(e.clientX), id = idOf(e);
    if (id) selected = id === selected ? null : id;
    pinned = !id && pinned === i ? null : i;
    probe = null;
    if (e.pointerType !== "mouse") hovered = null;
    refreshAreas(); drawProbe();
    emit();
  });
  function refreshAreas() {
    const pick = hovered ?? selected;
    for (const path of areaGroup.children) {
      const id = path.getAttribute("data-id");
      if (!id) continue;
      path.setAttribute("opacity", pick && pick !== id ? 0.35 : 1);
      if (pick === id) { path.setAttribute("stroke", "#111"); path.setAttribute("stroke-width", 1.2); path.setAttribute("stroke-linejoin", "round"); }
      else { path.removeAttribute("stroke"); path.removeAttribute("stroke-width"); }
    }
  }

  // ---- state changes --------------------------------------------------------------------------
  function afterChange() { probe = null; hovered = null; build(); emit(); }
  function setScenario(id) { if (id === scenario) return; scenario = id; updateScenarioButtons(scenario); afterChange(); }
  function setMeasure(id) { if (id === measure) return; measure = id; updateMeasureButtons(measure); buildUnitButtons(); afterChange(); }
  function setUnit(id) { if (id === unit) return; unit = id; updateUnitButtons(unit); afterChange(); }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const c = current;
    const i = c ? (pinned ?? c.years.length - 1) : -1;
    return {
      scenario, measure, unit, selected,
      at: c && i >= 0 ? {year: c.years[i], total: c.total[i], values: Object.fromEntries(c.rows.map(r => [r.t.id, r.v[i]]))} : null,
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- go -------------------------------------------------------------------------------------
  updateScenarioButtons(scenario);
  updateMeasureButtons(measure);
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
  return container;
}

// ---- helpers --------------------------------------------------------------------------------
// A segmented control: the choices as one row of joined buttons, rounded at the ends, the one
// chosen dark with white type. Returns a function that marks the current choice.
function segmented(parent, choices, onPick) {
  const box = document.createElement("div");
  box.setAttribute("role", "group");
  box.style.cssText = "display:inline-flex;flex-wrap:wrap;border-radius:999px;";
  const buttons = choices.map((choice, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = choice.label;
    if (choice.title) b.title = choice.title;
    b.style.cssText = "font:13px sans-serif;padding:5px 12px;cursor:pointer;white-space:nowrap;border:1px solid #333;" +
      `margin-left:${i ? -1 : 0}px;border-radius:${i === 0 ? "999px 0 0 999px" : i === choices.length - 1 ? "0 999px 999px 0" : "0"};` +
      "transition:background-color .15s,color .15s;";
    b.addEventListener("click", () => onPick(choice.id));
    box.appendChild(b);
    return b;
  });
  parent.appendChild(box);
  return current => buttons.forEach((b, i) => {
    const active = choices[i].id === current;
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.style.position = active ? "relative" : "static";
    b.setAttribute("aria-pressed", String(active));
  });
}
function formatNumber(v) {
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 10) return (Math.round(v * 10) / 10).toString();
  if (a === 0) return "0";
  return (Math.round(v * 100) / 100).toString();
}
function formatPct(p) {
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}
function niceStep(v) {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
