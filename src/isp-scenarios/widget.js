// The National Electricity Market to 2050, under AEMO's 2026 Integrated System Plan: a stacked
// area of annual generation (TWh) or capacity (GW) by technology, financial year by financial
// year, the history in solid colour and AEMO's projection, hatched, after it, for each of the
// three scenarios AEMO planned against. Click a technology in the key to hide or show it; hover
// or touch a year for every technology's figure and share, and how much coal is left. Drawn in
// the style of the Hickman and climate-funds widgets: a grey plate, a bold title in the corner,
// quiet gridlines with their labels on them, dark pill buttons, and the sources in small type
// at the bottom right. The data file is built by scripts/isp-scenarios.mjs. Self-contained:
// no d3, no imports.
//
// Options: {scenario: "step_change" | "accelerated_transition" | "slower_growth"} (with
// hyphens too), {measure: "generation" | "capacity"}; {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const GRID = "#b3b3b3";
const LINK = "#0b57d0";
const CHART_H = 260;

export const MEASURES = [
  {id: "generation", label: "Generation (TWh)", unit: "TWh", title: "Electricity generated in the financial year, in terawatt hours; storage left out, as in AEMO's figure"},
  {id: "capacity", label: "Capacity (GW)", unit: "GW", title: "Installed capacity at the end of the financial year, in gigawatts, storage included"},
];

export function createIspScenariosWidget({data, width = FIGURE_WIDTH, scenario: initialScenario, measure: initialMeasure} = {}) {
  if (!data?.projections || !data?.techs) throw new Error("createIspScenariosWidget needs {data}: the contents of isp-2026.json");

  // ---- data -----------------------------------------------------------------------------------
  const techs = data.techs;
  const scenarios = data.scenarios;
  const scenarioIds = scenarios.map(s => s.id);
  const normalise = s => String(s ?? "").toLowerCase().replace(/-/g, "_");

  // ---- state ----------------------------------------------------------------------------------
  let scenario = scenarioIds.includes(normalise(initialScenario)) ? normalise(initialScenario) : scenarioIds[0];
  let measure = MEASURES.some(m => m.id === initialMeasure) ? initialMeasure : "generation";
  const hidden = new Set();
  let hoverYear = null;

  // The series for the measure: history and projection laid on one axis of financial years,
  // with nulls where neither has a figure (the capacity history ends before the projection
  // begins). Storage is left out of the generation stack, as AEMO's figure leaves it out.
  function compute() {
    const hist = data.history[measure];
    const proj = data.projections[scenario];
    const years = [];
    for (let y = hist.years[0]; y <= proj.years.at(-1); y++) years.push(y);
    const lastHistory = hist.years.at(-1);
    const list = techs.filter(t => !(measure === "generation" && t.storage));
    const rows = list.map(t => {
      const v = years.map(y => {
        const i = hist.years.indexOf(y);
        if (i >= 0) return hist.values[t.id][i];
        const j = proj.years.indexOf(y);
        return j >= 0 ? proj[measure][t.id][j] : null;
      });
      return {t, v};
    });
    const total = years.map((_, i) => rows.reduce((s, r) => s + (r.v[i] ?? 0), 0));
    const drawn = rows.filter(r => !hidden.has(r.t.id));
    const stackTop = new Array(years.length).fill(0);
    for (const r of drawn) {
      r.y0 = []; r.y1 = [];
      for (let i = 0; i < years.length; i++) {
        if (r.v[i] === null) { r.y0.push(null); r.y1.push(null); continue; }
        r.y0.push(stackTop[i]);
        stackTop[i] += Math.max(0, r.v[i]);
        r.y1.push(stackTop[i]);
      }
    }
    return {years, lastHistory, rows, drawn, total, stackTop};
  }

  // ---- layout ---------------------------------------------------------------------------------
  const ctx = document.createElement("canvas").getContext("2d");
  function textWidth(text, px, weight = "normal") {
    ctx.font = `${weight} ${px}px sans-serif`;
    return ctx.measureText(text).width;
  }
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, titleFont, sourceFont, tickFont, sourceLines;
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
    plotL = 8;
    plotR = w - 8;
    plotT = 14;
    plotB = plotT + CHART_H;
    // The source line, wrapped as the width needs, a piece never split.
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
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;position:relative;`;
  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 2px;";
  heading.textContent = "The NEM to 2050, under AEMO's Integrated System Plan";
  container.appendChild(heading);
  const subheading = document.createElement("div");
  subheading.style.cssText = "font-size:12px;color:#666;padding:0 0 10px;line-height:1.35;";
  container.appendChild(subheading);

  const PILL = "font:13px sans-serif;padding:5px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;" +
    "display:inline-flex;align-items:center;gap:6px;transition:background-color .15s,color .15s,border-color .15s,opacity .15s;";
  function stylePill(b, active, enabled = true) {
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.style.opacity = enabled ? "1" : "0.4";
    b.setAttribute("aria-pressed", String(active));
  }
  function buttonRow(parent, choices, onPick) {
    const buttons = choices.map(choice => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      if (choice.title ?? choice.description) b.title = choice.title ?? choice.description;
      b.style.cssText = PILL;
      b.addEventListener("click", () => onPick(choice.id));
      parent.appendChild(b);
      return b;
    });
    return current => buttons.forEach((b, i) => stylePill(b, choices[i].id === current));
  }
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 16px;padding:0 0 6px;";
  container.appendChild(controls);
  const scenarioRow = document.createElement("div");
  scenarioRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  const measureRow = document.createElement("div");
  measureRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  controls.append(scenarioRow, measureRow);
  const updateScenarioButtons = buttonRow(scenarioRow, scenarios, setScenario);
  const updateMeasureButtons = buttonRow(measureRow, MEASURES, setMeasure);

  const key = document.createElement("div");
  key.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:2px 0 8px;";
  container.appendChild(key);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "isp-scenarios");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;";
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;position:relative;";
  scroller.appendChild(svg);
  container.appendChild(scroller);
  const tip = document.createElement("div");
  tip.style.cssText = "position:absolute;display:none;z-index:2;pointer-events:none;background:rgba(255,255,255,0.96);color:#222;" +
    "font:11px/1.35 sans-serif;padding:6px 8px;border-radius:4px;border:1px solid #ddd;box-shadow:0 1px 4px rgba(0,0,0,.12);white-space:nowrap;";
  scroller.appendChild(tip);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const F = v => (Math.round(v * 100) / 100).toString();
  const patternId = `isp-hatch-${Math.random().toString(36).slice(2, 8)}`;

  // ---- drawing --------------------------------------------------------------------------------
  let gridGroup, areaGroup, labelGroup, axisGroup, hoverGroup, sourceGroup;
  let current = null, xOf, yOf, yMax = 1;

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
    // The gridlines' labels sit over the areas, haloed in the plate's grey, so the stack
    // cannot hide them.
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "stroke-linejoin": "round"}, svg);
    axisGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    hoverGroup = svgEl("g", {"pointer-events": "none"}, svg);
    svgEl("rect", {x: F(plotL), y: F(plotT), width: F(plotR - plotL), height: F(CHART_H), fill: "transparent", cursor: "crosshair"}, svg);
    sourceGroup = svgEl("g", {"font-family": "sans-serif"}, svg);
    render();
  }

  function render() {
    const c = compute();
    current = c;
    const {years, lastHistory, drawn, stackTop} = c;
    const sc = scenarios.find(s => s.id === scenario);
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
    subheading.textContent = `${sc.label}${sc.likelihood ? ` (AEMO's weight: ${Math.round(sc.likelihood * 100)}%)` : ""}: ${sc.description ?? ""} ` +
      `Financial years ending ${years[0]} to ${years.at(-1)}; history to ${lastHistory}, projection after.`;

    const n = years.length;
    const slot = (plotR - plotL) / n;
    xOf = i => plotL + (i + 0.5) * slot;
    const top = Math.max(1, ...stackTop);
    const step = niceStep(top / 5);
    yMax = Math.ceil(top / step) * step;
    yOf = v => plotB - v / yMax * CHART_H;
    const unit = MEASURES.find(m => m.id === measure).unit;

    gridGroup.replaceChildren();
    labelGroup.replaceChildren();
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      const y = yOf(v);
      svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: v === 0 ? "#888" : GRID, "stroke-width": v === 0 ? 1 : 0.8}, gridGroup);
      if (v === 0) continue;
      const tl = svgEl("text", {x: F(plotL + 2), y: F(y - 3), "font-size": tickFont, fill: "#666"}, labelGroup);
      tl.textContent = `${formatNumber(v)} ${unit}`;
    }

    // The areas; a run of years with figures is one path, so a gap in the history breaks it.
    areaGroup.replaceChildren();
    const iProj = years.indexOf(lastHistory) + 1;   // the first projected year's index
    for (const r of drawn) {
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
      const path = svgEl("path", {d, fill: r.t.colour, "data-id": r.t.id}, areaGroup);
      svgEl("title", {}, path).textContent = r.t.label;
    }
    // Hatching over the projected years, clipped to the stack.
    if (iProj < n) {
      let d = "";
      for (let i = iProj; i < n; i++) d += `${i === iProj ? "M" : "L"}${F(xOf(i))},${F(yOf(stackTop[i]))}`;
      d += `L${F(xOf(n - 1))},${F(plotB)}L${F(xOf(iProj))},${F(plotB)}Z`;
      svgEl("path", {d, fill: `url(#${patternId})`}, areaGroup);
      const xb = xOf(iProj) - slot / 2;
      svgEl("path", {d: `M${F(xb)},${F(plotT)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": "4 3"}, areaGroup);
      const lbl = svgEl("text", {x: F(xb + 5), y: F(plotT + 11), "font-size": 11, fill: "#333", "font-weight": "bold", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3}, areaGroup);
      lbl.textContent = `projection →`;
      const lbl2 = svgEl("text", {x: F(xb - 5), y: F(plotT + 11), "font-size": 11, fill: "#333", "text-anchor": "end", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3}, areaGroup);
      lbl2.textContent = `← history`;
    }

    // Years along the bottom.
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
    updateKey(c);
    drawHover();
    svg.setAttribute("aria-label", `${MEASURES.find(m => m.id === measure).label} in the National Electricity Market by technology, ${years[0]} to ${years.at(-1)}, ` +
      `history then AEMO's ${sc.label} projection, as stacked areas. In ${years.at(-1)}: ` +
      drawn.map(r => `${r.t.label} ${formatNumber(r.v.at(-1) ?? 0)} ${unit}`).join(", ") + ".");
  }

  function drawSources() {
    sourceGroup.replaceChildren();
    const lineH = sourceFont + 4;
    // Each line is one text element, right-aligned by the browser itself, its pieces tspans.
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
        const span = svgEl("tspan", p.url ? {fill: LINK, "text-decoration": "underline"} : {}, parent);
        span.textContent = p.text;
      }
    });
  }

  function updateKey(c) {
    key.replaceChildren();
    const all = document.createElement("button");
    all.type = "button";
    all.textContent = "All";
    all.style.cssText = PILL + "padding:3px 9px;font-size:12px;";
    stylePill(all, hidden.size === 0);
    all.addEventListener("click", () => { hidden.clear(); afterChange(); });
    key.appendChild(all);
    for (const r of [...c.rows].reverse()) {
      const b = document.createElement("button");
      b.type = "button";
      b.style.cssText = PILL + "padding:3px 9px 3px 7px;font-size:12px;";
      const sw = document.createElement("span");
      sw.style.cssText = `width:11px;height:11px;border-radius:2px;background:${r.t.colour};flex:none;`;
      b.append(sw, r.t.label);
      b.title = hidden.has(r.t.id) ? `Show ${r.t.label}` : `Hide ${r.t.label}`;
      stylePill(b, false, !hidden.has(r.t.id));
      b.style.textDecoration = hidden.has(r.t.id) ? "line-through" : "none";
      b.addEventListener("click", () => { if (hidden.has(r.t.id)) hidden.delete(r.t.id); else hidden.add(r.t.id); afterChange(); });
      key.appendChild(b);
    }
  }

  // ---- hover ----------------------------------------------------------------------------------
  function drawHover() {
    hoverGroup.replaceChildren();
    const c = current;
    if (hoverYear === null || !c) { tip.style.display = "none"; return; }
    const i = c.years.indexOf(hoverYear);
    if (i < 0) { tip.style.display = "none"; return; }
    const x = xOf(i);
    svgEl("path", {d: `M${F(x)},${F(plotT)}V${F(plotB)}`, stroke: "#333", "stroke-width": 1, "stroke-dasharray": "3 3"}, hoverGroup);
    const unit = MEASURES.find(m => m.id === measure).unit;
    const total = c.rows.filter(r => !hidden.has(r.t.id)).reduce((s, r) => s + (r.v[i] ?? 0), 0);
    const lines = [`<b>FY${hoverYear}</b> <span style="color:#666">${hoverYear > c.lastHistory ? "projected" : "history"}${hoverYear > c.lastHistory ? `, ${scenarios.find(s => s.id === scenario).label}` : ""}</span>`];
    const any = c.rows.some(r => r.v[i] !== null);
    if (!any) lines.push(`<span style="color:#666">No figure for this year</span>`);
    for (const r of [...c.rows].reverse()) {
      if (hidden.has(r.t.id) || r.v[i] === null) continue;
      const share = total > 0 ? 100 * r.v[i] / total : 0;
      lines.push(`<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${r.t.colour};margin-right:5px;vertical-align:-1px"></span>` +
        `${r.t.label}: <b>${formatNumber(r.v[i])} ${unit}</b> · ${share >= 10 ? Math.round(share) : share.toFixed(1)}%`);
    }
    if (any) {
      const coal = c.rows.filter(r => r.t.id.startsWith("coal")).reduce((s, r) => s + (r.v[i] ?? 0), 0);
      lines.push(`<span style="color:#666">Total ${formatNumber(total)} ${unit}; coal ${formatNumber(coal)} ${unit}` +
        (total > 0 ? ` (${Math.round(100 * coal / total)}%)` : "") + "</span>");
    }
    tip.innerHTML = lines.join("<br>");
    tip.style.display = "block";
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = `${x + 12 + tw > w ? Math.max(0, x - 12 - tw) : x + 12}px`;
    tip.style.top = `${Math.max(0, Math.min(plotT + 18, svgH - th))}px`;
  }
  function yearAt(clientX) {
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (w / rect.width);
    const n = current.years.length, slot = (plotR - plotL) / n;
    return current.years[clamp(Math.floor((x - plotL) / slot), 0, n - 1)];
  }
  svg.addEventListener("pointermove", e => { const y = yearAt(e.clientX); if (y !== hoverYear) { hoverYear = y; drawHover(); } });
  svg.addEventListener("pointerdown", e => { const y = yearAt(e.clientX); hoverYear = y === hoverYear && e.pointerType !== "mouse" ? null : y; drawHover(); });
  svg.addEventListener("pointerleave", e => { if (e.pointerType !== "mouse") return; hoverYear = null; drawHover(); });

  // ---- state changes --------------------------------------------------------------------------
  function afterChange() { hoverYear = null; build(); emit(); }
  function setScenario(id) { if (id === scenario) return; scenario = id; updateScenarioButtons(scenario); afterChange(); }
  function setMeasure(id) { if (id === measure) return; measure = id; updateMeasureButtons(measure); afterChange(); }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const c = current;
    const last = c ? c.years.length - 1 : -1;
    return {
      scenario, measure, hidden: [...hidden],
      in2050: c ? Object.fromEntries(c.rows.map(r => [r.t.id, r.v[last]])) : null,
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
function formatNumber(v) {
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 10) return (Math.round(v * 10) / 10).toString();
  if (a === 0) return "0";
  return (Math.round(v * 100) / 100).toString();
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
