// What each country has pledged to and paid into the UNFCCC's climate funds, as a ranked stack
// of bars. Every country that has paid anything is a row; its bar is the money, in segments
// coloured by fund, the Green Climate Fund first. Two bases: what was received (the Green
// Climate Fund, the Adaptation Fund and the Loss and Damage fund as their own reports count it,
// cash plus promissory notes deposited; the GEF, LDCF and SCCF as the World Bank's record of
// receipts has it, cash and notes encashed since July 2011), and what was pledged, which only
// the first three publish donor by donor, so the pledged view shows those three alone. Four
// measures: the dollars in all; dollars per person, by today's population; the money as a
// share of the country's GDP summed over the years the receipts cover; and as a share of GDP
// summed since 1850, the wealth a country has made over the period the CO₂ widgets count its
// emissions over. The rows are ranked by the measure shown, the most at the top, and slide to
// their new places when anything changes. Click a fund in the key to see that fund alone (and
// the ranking by it), and "All" for the funds together; hovering a key entry names the fund in
// full. Click or tap a bar for its breakdown by fund, written in the segments wide enough to
// hold it; the arrow keys then walk the ranking. Donors that are not countries (the European
// Union, the UNFCCC secretariat, development banks, private donors, and the receipts the World
// Bank does not attribute to anyone) are one grey bar in the dollar view and absent from the
// others, having no people or GDP of their own. Drawn in the style of the Hickman et al.
// widget, after Makie: a grey plate under the whole thing, a big bold title in the corner,
// quiet grey gridlines with their labels on them, dark pill buttons, and the sources, one link
// per report, in small type at the bottom right. Self-contained: no d3, no imports.
//
// Options: {basis: "received" | "pledged"}, {measure: "total" | "perCapita" | "gdp" | "gdp1850"}
// and {fund: "gcf"} open on that basis, measure or fund; {width} caps the figure's width (it
// shrinks with its container below that).

const CARD_WIDTH = 640;         // the page column, as the other widgets fill it
const CARD_PAD = 12;            // the plate's padding either side of the figure
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320;
const BACKGROUND = "#f2f2f2";   // Makie's :gray95, as in the Hickman widget
const GRID = "#b3b3b3";
const LINK = "#0b57d0";
const TITLE = "Contributions to climate funds";
const EPS = 1e-9;
const ROW_H = 16;            // one country
const OTHER_CODE = "__other";
const OTHER_NAME = "EU and other donors";   // the non-country donors and the unattributed receipts, as one bar

export const BASES = [
  {id: "received", label: "Received", title: "What the funds have received: cash, and promissory notes deposited"},
  {id: "pledged", label: "Pledged", title: "What was pledged, for the three funds that publish pledges donor by donor"},
];
export const MEASURES = [
  {id: "total", label: "In all", title: "Dollars"},
  {id: "perCapita", label: "Per person", title: "Dollars divided by today's population"},
  {id: "gdp", label: "Share of GDP", title: "Dollars divided by GDP summed over the years the receipts cover"},
  {id: "gdp1850", label: "Share of GDP since 1850", title: "Dollars divided by GDP summed since 1850"},
];
const BASIS_IDS = BASES.map(b => b.id);
const MEASURE_IDS = MEASURES.map(m => m.id);

// Okabe–Ito, one per fund, in the order the segments are stacked.
export const FUND_COLOURS = {gcf: "#0072B2", gef: "#009E73", ldcf: "#E69F00", sccf: "#56B4E9", af: "#D55E00", frld: "#CC79A7"};
const OTHER_COLOUR = "#9a9a9a";

export function createClimateFundsWidget({data, width = FIGURE_WIDTH, basis: initialBasis, measure: initialMeasure, fund: initialFund} = {}) {
  if (!data?.funds || !data?.countries) throw new Error("createClimateFundsWidget needs {data}: the contents of climate-funds.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- data -----------------------------------------------------------------------------------
  const funds = data.funds;
  const fundIds = funds.map(f => f.id);
  const fundById = new Map(funds.map(f => [f.id, f]));
  const pledgeFunds = funds.filter(f => f.pledges).map(f => f.id);
  const sum = arr => arr.reduce((s, v) => s + (v ?? 0), 0);
  const [gdpFirst, gdpLast] = data.gdpYears;
  const [g1850First, g1850Last] = data.gdp1850Years ?? [1850, gdpLast];
  // Each row: the dollars (millions) per fund on each basis, and the denominators.
  const rows = data.countries.map(c => ({
    code: c.code, name: c.name, pop: c.pop, gdp: c.gdp, popYear: c.popYear, gdp1850: c.gdp1850, gdp1850From: c.gdp1850From,
    received: c.received, pledged: c.pledged,
  }));
  const otherRow = {
    code: OTHER_CODE, name: OTHER_NAME, pop: null, gdp: null, gdp1850: null, other: true,
    received: Object.fromEntries(fundIds.map(id => [id, sum(data.other.map(o => o.received[id]))])),
    pledged: Object.fromEntries(fundIds.map(id => [id, sum(data.other.map(o => o.pledged[id]))])),
    parts: data.other.map(o => ({name: o.name, total: sum(Object.values(o.received))})).sort((a, b) => b.total - a.total),
  };
  rows.push(otherRow);
  const rowByCode = new Map(rows.map(r => [r.code, r]));

  // ---- state ----------------------------------------------------------------------------------
  let basis = BASIS_IDS.includes(initialBasis) ? initialBasis : "received";
  let measure = MEASURE_IDS.includes(initialMeasure) ? initialMeasure : "total";
  let keyFund = fundIds.includes(initialFund) ? initialFund : null;
  let selected = null, hovered = null;
  const shown = () => hovered ?? selected;
  const layout = new Map();   // code → {y, w: {fundId: px}, alpha}: where each bar is now, chasing its target
  let raf = null, lastFrame = 0;

  // The funds that have figures on the basis shown.
  const shownFunds = () => basis === "received" ? fundIds : pledgeFunds;
  const amountOf = (r, id) => r[basis][id] ?? 0;

  // The denominator of a row in the measure shown: 1 for dollars, millions of people, billions
  // of dollars of GDP, trillions of GDP since 1850. Null when the row has none (the non-country
  // donors, and the two microstates with no long GDP record).
  function denominator(r) {
    if (measure === "total") return 1;
    if (measure === "perCapita") return r.pop > 0 ? r.pop : null;
    if (measure === "gdp") return r.gdp > 0 ? r.gdp : null;
    return r.gdp1850 > 0 ? r.gdp1850 : null;
  }
  // Dollars (millions) over the denominator, in the measure's own unit: millions of dollars,
  // dollars per person, or per cent of GDP.
  function valueOf(millions, r) {
    const d = denominator(r);
    if (d === null) return null;
    if (measure === "total") return millions;
    if (measure === "perCapita") return millions / d;          // $m / M people = $ per person
    if (measure === "gdp") return 100 * millions / (1000 * d); // $m / $bn, as a percentage
    return 100 * millions / (1e6 * d);                         // $m / $tn, as a percentage
  }
  // The ranking: every row with something to show on the basis, in the measure and for the
  // fund(s) shown.
  function ranking() {
    const list = [];
    const ids = shownFunds().filter(id => !keyFund || id === keyFund);
    for (const r of rows) {
      const paid = sum(ids.map(id => amountOf(r, id)));
      const v = valueOf(paid, r);
      if (v === null || !(paid > 0)) continue;
      list.push({r, paid, v, seg: Object.fromEntries(fundIds.map(id => [id, ids.includes(id) ? valueOf(amountOf(r, id), r) : 0]))});
    }
    list.sort((a, b) => b.v - a.v || a.r.name.localeCompare(b.r.name));
    return list;
  }

  // ---- layout ---------------------------------------------------------------------------------
  // Text is measured, not estimated, so the names take exactly the room the longest needs
  // and nothing written along the axis runs past its end.
  const ctx = document.createElement("canvas").getContext("2d");
  function textWidth(text, px, weight = "normal") {
    ctx.font = `${weight} ${px}px sans-serif`;
    return ctx.measureText(text).width;
  }
  const NAME_FONT = 12;
  const longestName = Math.max(...rows.map(r => textWidth(r.name, NAME_FONT, "bold")));

  // The sources, spelt out: the funds whose own PDF reports were read, one link each, then the
  // World Bank's record for the rest, as pieces of one line that wraps when it must.
  const sourcePieces = (() => {
    const own = funds.filter(f => f.pledges && f.source?.url);
    const rest = funds.filter(f => !f.pledges && f.source?.url);
    const pieces = [{text: `Figures for the ${own.map(f => f.short).join(", ")} were extracted from PDF reports: `}];
    own.forEach((f, i) => {
      if (i) pieces.push({text: ", "});
      pieces.push({text: `${f.short} (${formatDate(f.source.asOf)})`, url: f.source.url, title: f.source.title});
    });
    if (rest.length) {
      pieces.push({text: `. Figures for the ${rest.map(f => f.short).join(", ")}: `});
      pieces.push({text: `World Bank receipts (${formatDate(rest[0].source.asOf)})`, url: rest[0].source.url, title: rest[0].source.title});
    }
    return pieces;
  })();

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, nameRoom, plotL, plotR, plotT, plotB, svgH, titleFont, sourceFont, sourceLines;
  function applyLayout(newW, n) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = lerp(16, 22);
    sourceFont = lerp(7, 8);
    nameRoom = Math.min(Math.ceil(longestName) + 4, Math.round(w * 0.3));   // the country names, right-aligned against the bars
    plotL = nameRoom + 6;
    plotR = w - clamp(Math.round(w * 0.12), 56, 84);   // room for the value at the end of the longest bar
    plotT = 44;                                          // the axis title and ticks, above the bars
    plotB = plotT + n * ROW_H;
    // The source line, wrapped into as many lines as the axis's width needs, a piece never
    // split and a comma never starting a line.
    sourceLines = [];
    let line = [], lineW = 0;
    for (const p of sourcePieces) {
      const pw = textWidth(p.text, sourceFont);
      if (line.length && p.url && lineW + pw > plotR - plotL) { sourceLines.push(line); line = []; lineW = 0; }
      line.push({...p, w: pw});
      lineW += pw;
    }
    if (line.length) sourceLines.push(line);
    svgH = plotB + 12 + sourceLines.length * (sourceFont + 4) + 4;
  }
  applyLayout(maxW, ranking().length);

  // ---- DOM ------------------------------------------------------------------------------------
  // The plate runs under the whole widget, title and buttons included, so it reads as one card;
  // the SVG paints its own background in the same colour, so it stands on its own if pulled out.
  const container = document.createElement("div");
  container.style.cssText = `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px ${CARD_PAD}px ${CARD_PAD}px;` +
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;`;

  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 10px;";
  heading.textContent = TITLE;
  container.appendChild(heading);

  // Pill buttons as in the Hickman widget: the one pressed is dark with white type; one that
  // cannot be pressed now (a fund with no pledges, in the pledged view) is faded.
  const PILL = "font:14px sans-serif;padding:6px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;" +
    "display:inline-flex;align-items:center;gap:7px;transition:background-color .15s,color .15s,border-color .15s,opacity .15s;";
  function stylePill(b, active, enabled = true) {
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.style.opacity = enabled ? "1" : "0.4";
    b.style.cursor = enabled ? "pointer" : "default";
    b.setAttribute("aria-pressed", String(active));
    b.setAttribute("aria-disabled", String(!enabled));
  }
  function buttonRow(parent, choices, onPick) {
    const buttons = choices.map(choice => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice.label;
      if (choice.title) b.title = choice.title;
      b.style.cssText = PILL;
      b.addEventListener("click", () => onPick(choice.id));
      parent.appendChild(b);
      return b;
    });
    return current => buttons.forEach((b, i) => stylePill(b, choices[i].id === current));
  }
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;padding:0 0 8px;";
  container.appendChild(controls);
  const basisRow = document.createElement("div");
  basisRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
  const measureRow = document.createElement("div");
  measureRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;";
  controls.append(basisRow, measureRow);
  const updateBasisButtons = buttonRow(basisRow, BASES, setBasis);
  const updateMeasureButtons = buttonRow(measureRow, MEASURES, setMeasure);

  // The key: "All", with an empty swatch, then one swatch per fund by its acronym; click a fund
  // to see it alone, "All" for the funds together. Hovering (or focusing) an entry names the
  // fund in full, in a tip just under it.
  const key = document.createElement("div");
  key.style.cssText = "position:relative;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:0 0 10px;";
  const tip = document.createElement("div");
  tip.style.cssText = "position:absolute;display:none;z-index:2;pointer-events:none;background:#222;color:#fff;font:12px sans-serif;" +
    "padding:3px 8px;border-radius:4px;white-space:nowrap;";
  const keyItems = [{id: null, short: "All", name: "All the funds together"}, ...funds].map(f => {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("aria-label", f.name);
    item.style.cssText = PILL + "padding-left:10px;";
    const swatch = document.createElement("span");
    swatch.style.cssText = f.id === null
      ? "width:9px;height:9px;border-radius:2px;border:1px solid currentColor;background:none;flex:none;"
      : `width:11px;height:11px;border-radius:2px;background:${FUND_COLOURS[f.id] ?? "#888"};flex:none;`;
    item.append(swatch, f.short);
    item.addEventListener("click", () => { if (f.id === null || shownFunds().includes(f.id)) setFund(f.id); });
    const show = () => {
      tip.textContent = f.id !== null && !shownFunds().includes(f.id) ? `${f.name}: no pledge table published` : f.name;
      tip.style.left = `${item.offsetLeft}px`;
      tip.style.top = `${item.offsetTop + item.offsetHeight + 2}px`;
      tip.style.display = "block";
    };
    const hide = () => { tip.style.display = "none"; };
    item.addEventListener("pointerenter", show);
    item.addEventListener("pointerleave", hide);
    item.addEventListener("focus", show);
    item.addEventListener("blur", hide);
    key.appendChild(item);
    return {item, id: f.id};
  });
  key.appendChild(tip);
  function updateKey() {
    for (const {item, id} of keyItems) stylePill(item, keyFund === id, id === null || shownFunds().includes(id));
  }
  container.appendChild(key);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "climate-funds");
  svg.setAttribute("role", "img");
  svg.setAttribute("tabindex", "0");   // focusable, so the arrow keys can walk the ranking
  svg.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
  svg.style.cssText = "display:block;overflow:visible;touch-action:pan-y;cursor:pointer;outline:none;";
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

  // ---- geometry -------------------------------------------------------------------------------
  const F = v => v.toFixed(2);
  let vMax = 1;   // the axis's full length, in the measure's unit; set from the ranking
  const pxOf = v => (plotR - plotL) * clamp(v / vMax, 0, 1);

  // ---- drawing --------------------------------------------------------------------------------
  let axisGroup, barGroup, labelGroup, pickPath, plate, sourceGroup;
  const barEls = new Map();   // code → {g, segs: {fundId: rect}, name}

  function build() {
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    plate = svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    axisGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    barGroup = svgEl("g", {}, svg);
    barEls.clear();
    pickPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.5, "pointer-events": "none"}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    sourceGroup = svgEl("g", {"font-family": "sans-serif"}, svg);
    drawSources();
    snapLayout();
    render();
  }

  // The axis runs exactly to the longest bar: the room beyond it is for that bar's value.
  function targets() {
    const list = ranking();
    vMax = Math.max(...list.map(it => it.v), EPS);
    const t = new Map();
    list.forEach((it, i) => t.set(it.r.code, {y: plotT + i * ROW_H, w: Object.fromEntries(fundIds.map(id => [id, pxOf(it.seg[id])])), alpha: 1, it}));
    return {list, t};
  }
  function snapLayout() {
    const {t} = targets();
    layout.clear();
    for (const [code, tg] of t) layout.set(code, {y: tg.y, w: {...tg.w}, alpha: 1});
  }

  // One frame: every bar moves some way towards its place and lengths, arrivals grow out of
  // theirs, departures shrink away; then draw.
  function frame(now) {
    raf = null;
    if (container.isConnected === false) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    const {list, t} = targets();
    const rate = reduceMotion ? 1 : 1 - Math.exp(-dt * 8);
    let moving = false;
    for (const [code, tg] of t) {
      let cur = layout.get(code);
      if (!cur) { cur = {y: tg.y, w: Object.fromEntries(fundIds.map(id => [id, 0])), alpha: 0}; layout.set(code, cur); }
      const chase = (obj, k, target) => { const d = target - obj[k]; if (Math.abs(d) > 1e-3) moving = true; obj[k] += d * rate; };
      chase(cur, "y", tg.y);
      chase(cur, "alpha", 1);
      for (const id of fundIds) chase(cur.w, id, tg.w[id]);
    }
    for (const [code, cur] of layout) {
      if (t.has(code)) continue;
      cur.alpha += (0 - cur.alpha) * rate;
      for (const id of fundIds) cur.w[id] += (0 - cur.w[id]) * rate;
      if (cur.alpha < 0.01) layout.delete(code); else moving = true;
    }
    render(list, t);
    if (moving) raf = requestAnimationFrame(frame);
    else lastFrame = 0;
  }
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  function render(list, t) {
    if (!list) ({list, t} = targets());
    const pick = shown();
    for (const [code, el] of barEls) if (!layout.has(code)) { el.g.remove(); barEls.delete(code); }
    for (const [code, cur] of layout) {
      const r = rowByCode.get(code);
      let el = barEls.get(code);
      if (!el) {
        const g = svgEl("g", {"data-code": code}, barGroup);
        // A hit area the full row wide, so the thin bars can be pointed at too.
        const hit = svgEl("rect", {"data-code": code, x: 0, width: F(w), height: F(ROW_H), fill: "transparent"}, g);
        const segs = {};
        for (const id of fundIds) segs[id] = svgEl("rect", {"data-code": code, fill: r.other ? OTHER_COLOUR : FUND_COLOURS[id] ?? "#888"}, g);
        const name = svgEl("text", {"data-code": code, x: F(plotL - 6), "text-anchor": "end", "dominant-baseline": "central", fill: "#333", "font-family": "sans-serif"}, g);
        el = {g, hit, segs, name};
        barEls.set(code, el);
      }
      el.g.setAttribute("transform", `translate(0,${F(cur.y)})`);
      el.g.setAttribute("opacity", cur.alpha.toFixed(3));
      let x = plotL;
      for (const id of fundIds) {
        const seg = el.segs[id], sw = Math.max(0, cur.w[id]);
        seg.setAttribute("x", F(x));
        seg.setAttribute("y", F(1.5));
        seg.setAttribute("width", F(sw));
        seg.setAttribute("height", F(ROW_H - 3));
        x += sw;
      }
      const picked = code === pick;
      const nameFont = Math.min(NAME_FONT, NAME_FONT * (nameRoom - 2) / textWidth(r.name, NAME_FONT, "bold"));
      el.name.setAttribute("y", F(ROW_H / 2));
      el.name.setAttribute("font-size", nameFont.toFixed(1));
      el.name.setAttribute("font-weight", picked ? "bold" : "normal");
      el.name.setAttribute("fill", picked ? "#111" : r.other ? "#666" : "#333");
      el.name.textContent = r.name;
    }
    drawAxis();
    drawLabels(list, t);
    const cur = pick && layout.get(pick);
    if (cur) {
      const len = sum(Object.values(cur.w));
      pickPath.setAttribute("d", `M${F(plotL)},${F(cur.y + 1)}H${F(plotL + len)}V${F(cur.y + ROW_H - 1)}H${F(plotL)}Z`);
    } else pickPath.setAttribute("d", "");
    describe(list);
  }

  // The scale along the top: quiet grey gridlines down through the rows with their labels on
  // them, no spine, and above them a line in the same grey that says what is measured.
  function drawAxis() {
    axisGroup.replaceChildren();
    const step = niceStep(vMax / 5);
    for (let v = 0; v <= vMax + EPS; v += step) {
      const x = plotL + pxOf(v);
      svgEl("path", {d: `M${F(x)},${F(plotT - 4)}V${F(plotB)}`, stroke: GRID, "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(x), y: F(plotT - 7), "text-anchor": "middle", "font-size": 11, fill: GRID}, axisGroup);
      tl.textContent = formatTick(v);
    }
    // The title in full where it fits within the axis at 12 px, else the short form, shrunk if
    // even that is too long: it never runs past the axis's end.
    const room = plotR - plotL;
    const [long, short] = axisTitle();
    const text = textWidth(long, 12) <= room ? long : short;
    const title = svgEl("text", {x: F(plotL), y: F(plotT - 24), "font-size": Math.min(12, 12 * room / textWidth(text, 12)).toFixed(1), fill: "#808080"}, axisGroup);
    title.textContent = text;
  }
  function axisTitle() {
    const what = keyFund ? fundById.get(keyFund).name
      : basis === "received" ? "the six funds" : `the ${pledgeFunds.map(id => fundById.get(id).short).join(", ")}`;
    const verb = basis === "received" ? "paid into" : "pledged to";
    if (measure === "total") return [`${verb} ${what} (millions of US$)`, `millions of US$ ${verb} ${what}`];
    if (measure === "perCapita") return [`${verb} ${what}, per person (US$)`, `US$ per person ${verb} ${what}`];
    if (measure === "gdp") return [`${verb} ${what}, as a share of GDP over ${gdpFirst}–${gdpLast} (%)`, `% of GDP over ${gdpFirst}–${gdpLast}`];
    return [`${verb} ${what}, as a share of GDP over ${g1850First}–${g1850Last} (%)`, `% of GDP over ${g1850First}–${g1850Last}`];
  }

  // The sources under the bars, right-aligned against the axis's end, each report a link in
  // link blue; their own group, since the axis group takes no pointer.
  function drawSources() {
    sourceGroup.replaceChildren();
    const lineH = sourceFont + 4;
    sourceLines.forEach((line, i) => {
      const y = plotB + 12 + i * lineH + sourceFont;
      let x = plotR - line.reduce((s, p) => s + p.w, 0);
      for (const p of line) {
        let parent = sourceGroup;
        if (p.url) {
          parent = svgEl("a", {href: p.url, target: "_blank", rel: "noopener"}, sourceGroup);
          parent.style.cssText = "cursor:pointer;";
          parent.addEventListener("click", e => e.stopPropagation());
          if (p.title) svgEl("title", {}, parent).textContent = p.title;
        }
        const tx = svgEl("text", {x: F(x), y: F(y), "font-size": sourceFont.toFixed(1), fill: p.url ? LINK : "#808080", "xml:space": "preserve",
          ...(p.url ? {"text-decoration": "underline"} : {})}, parent);
        tx.textContent = p.text;
        x += p.w;
      }
    });
  }

  // The value at the end of each bar; for the bar picked out, bold and black, and each fund's
  // share written in its segment where the segment is wide enough to hold it.
  const CHAR = 0.56;
  function drawLabels(list, t) {
    labelGroup.replaceChildren();
    const pick = shown();
    for (const it of list) {
      const cur = layout.get(it.r.code);
      if (!cur || cur.alpha < 0.3) continue;
      const len = sum(Object.values(cur.w)), yc = cur.y + ROW_H / 2;
      const picked = it.r.code === pick;
      const tx = svgEl("text", {
        x: F(plotL + len + 5), y: F(yc), "font-size": 10.5, "dominant-baseline": "central",
        fill: picked ? "#111" : "#444", "font-weight": picked ? "bold" : "normal",
      }, labelGroup);
      tx.setAttribute("opacity", cur.alpha.toFixed(3));
      tx.textContent = formatValue(it.v, measure);
      if (!picked) continue;
      let x = plotL;
      for (const id of fundIds) {
        const sw = cur.w[id];
        if (sw > 0) {
          const text = `${fundById.get(id).short} ${formatValue(it.seg[id], measure)}`;
          const font = Math.min(10, (sw - 6) / (CHAR * text.length));
          if (font >= 7.5) {
            const st = svgEl("text", {x: F(x + 3), y: F(yc), "font-size": font.toFixed(1), "dominant-baseline": "central", fill: "#fff", "font-weight": "bold"}, labelGroup);
            st.textContent = text;
          }
        }
        x += sw;
      }
    }
  }

  // ---- read-outs (for assistive technology only; nothing is printed) --------------------------
  function describe(list) {
    const code = shown();
    const it = code ? list.find(x => x.r.code === code) : null;
    const scope = keyFund ? `the ${fundById.get(keyFund).name}`
      : basis === "received" ? "the six UNFCCC climate funds" : `the ${pledgeFunds.map(id => fundById.get(id).name).join(", ")}`;
    const verb = basis === "received" ? "paid into" : "pledged to";
    const unit = measure === "total" ? "" : measure === "perCapita" ? " per person"
      : measure === "gdp" ? ` of GDP over ${gdpFirst}–${gdpLast}` : ` of GDP over ${g1850First}–${g1850Last}`;
    let text;
    if (it) {
      const parts = fundIds.filter(id => it.seg[id] > 0).map(id => `${fundById.get(id).short} ${formatValue(it.seg[id], measure)}`).join(", ");
      const from = measure === "gdp1850" && it.r.gdp1850From > g1850First ? ` Its GDP record begins in ${it.r.gdp1850From}.` : "";
      text = it.r.other
        ? `${it.r.name}: ${formatValue(it.v, measure)} in all (${parts}); of which ${it.r.parts.map(p => `${p.name} ${formatValue(p.total, "total")}`).join(", ")}.`
        : `${it.r.name}, ranked ${list.indexOf(it) + 1} of ${list.length}: ${formatValue(it.v, measure)}${unit} ${verb} ${scope} (${parts}).${from}`;
    } else {
      const top = list.slice(0, 3).map(x => `${x.r.name} ${formatValue(x.v, measure)}`).join(", ");
      text = `${list.length} donors ranked by what they ${verb} ${scope}${unit}; the top three are ${top}.`;
    }
    svg.setAttribute("aria-label", `Money ${verb} the UNFCCC climate funds by country, as ranked bars in segments coloured by fund. ${text}`);
  }

  // ---- pointer --------------------------------------------------------------------------------
  const codeOf = e => e.target?.getAttribute?.("data-code") ?? null;
  svg.addEventListener("click", e => {
    const code = codeOf(e);
    selected = code === null || code === selected ? null : code;
    hovered = null;
    requestRender();
    emit();
  });
  svg.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const code = codeOf(e);
    if (code !== hovered) { hovered = code; requestRender(); }
  });
  svg.addEventListener("pointerleave", e => {
    if (e.pointerType !== "mouse" || hovered === null) return;
    hovered = null;
    requestRender();
  });
  // The arrow keys walk the selection through the ranking: up to the row above, down to the one
  // below; with nothing selected, the top. The only way to reach the bars too thin to click.
  svg.addEventListener("keydown", e => {
    const step = {ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1}[e.key];
    if (!step) return;
    e.preventDefault();
    const list = ranking().map(it => it.r.code);
    if (!list.length) return;
    const i = list.indexOf(selected);
    const next = i < 0 ? list[0] : list[clamp(i + step, 0, list.length - 1)];
    if (next === selected) return;
    selected = next;
    hovered = null;
    requestRender();
    emit();
  });

  // ---- state changes --------------------------------------------------------------------------
  function resize() {
    const n = ranking().length;
    applyLayout(w, n);
    svg.setAttribute("height", svgH.toFixed(0));
    plate.setAttribute("height", F(svgH));
    drawSources();
    for (const el of barEls.values()) { el.hit.setAttribute("width", F(w)); el.name.setAttribute("x", F(plotL - 6)); }
  }
  function afterChange() {
    hovered = null;
    if (selected && !ranking().some(it => it.r.code === selected)) selected = null;
    resize();
    requestRender();
    emit();
  }
  function setBasis(b) {
    if (b === basis || !BASIS_IDS.includes(b)) return;
    basis = b;
    updateBasisButtons(basis);
    // A fund with no pledges cannot be the one shown in the pledged view.
    if (keyFund && !shownFunds().includes(keyFund)) keyFund = null;
    updateKey();
    afterChange();
  }
  function setMeasure(m) {
    if (m === measure || !MEASURE_IDS.includes(m)) return;
    measure = m;
    updateMeasureButtons(measure);
    afterChange();
  }
  function setFund(f) {
    keyFund = f;
    updateKey();
    afterChange();
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const list = ranking();
    const sel = selected ? list.find(it => it.r.code === selected) : null;
    return {
      basis, measure, fund: keyFund, donors: list.length,
      selected: sel ? {name: sel.r.name, value: Number(sel.v.toPrecision(4)), rank: list.indexOf(sel) + 1} : null,
      total: Number(list.reduce((s, it) => s + it.paid, 0).toPrecision(5)),
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  if (keyFund && !shownFunds().includes(keyFund)) keyFund = null;
  updateBasisButtons(basis);
  updateMeasureButtons(measure);
  updateKey();
  build();
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted, ranking().length); build(); }
    });
    ro.observe(container);
  }

  return container;
}

// ---- formatting -----------------------------------------------------------------------------

// A value in the measure's unit: millions of dollars, dollars per person, or per cent of GDP.
export function formatValue(v, measure) {
  if (measure === "total") return formatMoney(v);
  if (measure === "perCapita") return `$${formatSig(v)}`;
  return `${formatSig(v)}%`;
}
// Millions of dollars, as compactly as a label can carry them.
export function formatMoney(m) {
  const a = Math.abs(m);
  if (a >= 1000) return `$${(m / 1000).toFixed(a >= 10000 ? 0 : a >= 1000 ? 1 : 2)} bn`;
  if (a >= 100) return `$${Math.round(m)} m`;
  if (a >= 1) return `$${m.toFixed(1)} m`;
  if (a >= 0.1) return `$${Math.round(m * 1000)} k`;
  return `$${(m * 1000).toFixed(1)} k`;
}
// Two or three significant figures, written out in full however small: 1,234; 123; 12.3;
// 1.23; 0.12; 0.012; 0.00000068.
function formatSig(v) {
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (!(a > 0)) return "0";
  return v.toFixed(1 - Math.floor(Math.log10(a)));
}
function formatTick(v) {
  return Number(v.toPrecision(3)).toLocaleString("en-US");
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
}
function niceStep(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * mag >= v - EPS) return m * mag;
  return 10 * mag;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
