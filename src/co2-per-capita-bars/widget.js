// CO₂ emissions per person, country by country, as a stack of bars: the polar chart of the
// co2-per-capita widget unrolled. Every country is a horizontal bar whose height is its
// population and whose length is its emissions per person, so its area is its emissions in
// all; the bars are stacked from the top in order of emissions per person, the highest first,
// and as the years play the ranking changes and the bars slide up and down past each other.
// Both scales are fixed so the frame never moves: the full height of the plot is ten billion
// people, and the length of the plot is 25 tonnes a person a year (or 2,000 tonnes a person
// since 1850 in the cumulative view); whatever overshoots the length is cut at the edge and
// marked. Labels sit inside a bar tall and long enough to hold its name, and beyond the end
// of a thinner one, as many as fit without touching, the top of the ranking and the biggest
// emitters first. The data, the groups, their colours and the two views are the polar
// widget's, imported from it.

import {GROUP_COLOURS, MODES, formatPerPerson} from "../co2-per-capita/widget.js";

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const ACCENT = "#0b57d0";
const EPS = 1e-9;
const FULL_HEIGHT_POP = 10000;   // millions: the plot's full height is ten billion people
const PLOT_H = 800;              // px, for those ten billion
const SCALE_MAX = {year: 25, cumulative: 2000};   // tonnes per person, the plot's full length

export function createCo2PerCapitaBarsWidget({data, width = FIGURE_WIDTH, year, mode: initialMode} = {}) {
  if (!data?.years || !data?.countries) throw new Error("createCo2PerCapitaBarsWidget needs {data}: the contents of co2-per-capita.json");
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- data -----------------------------------------------------------------------------------
  const years = data.years;
  const firstYear = years[0], lastYear = years[years.length - 1];
  const groups = new Map(data.groups.map(g => [g.id, g]));
  const countries = data.countries.map(c => {
    const cum = [];
    let s = 0;
    for (const v of c.co2) cum.push(s += v ?? 0);
    return {...c, cum};
  });
  const byCode = new Map(countries.map(c => [c.code, c]));

  function at(arr, tt) {
    const k = Math.floor(tt + EPS) - firstYear;
    if (k < 0 || k >= arr.length || arr[k] === null) return null;
    const f = tt - years[k];
    if (f <= EPS || k + 1 >= arr.length || arr[k + 1] === null) return arr[k];
    return arr[k] + (arr[k + 1] - arr[k]) * f;
  }

  // ---- state ----------------------------------------------------------------------------------
  let mode = MODES.includes(initialMode) ? initialMode : "year";
  let t = clamp(Math.round(Number(year)) || lastYear, firstYear, lastYear);
  let selected = null, hovered = null;
  const shown = () => hovered ?? selected;
  const layout = new Map();   // code → {y0, h, x, alpha}: where each bar is now, chasing its target
  let glide = null, raf = null, lastFrame = 0;

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, plotL, plotR, plotT, plotB, svgH, labelRoom;
  function applyLayout(newW) {
    w = newW;
    labelRoom = clamp(Math.round(w * 0.22), 90, 150);   // beyond the plot, for the bar labels
    plotL = 44;
    plotR = w - labelRoom;
    plotT = 28;
    plotB = plotT + PLOT_H;
    svgH = plotB + 30;
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;padding:0 0 8px;font-size:13px;";
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
  const updateModeButtons = buttonRow("Per person", [
    {id: "year", label: "This year", title: "The year's emissions divided by the year's population"},
    {id: "cumulative", label: `Since ${firstYear}`, title: `Everything emitted since ${firstYear}, divided by the population of the year shown`},
  ], setMode);

  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.textContent = "Play tour";
  tourButton.style.cssText = "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;padding:3px 12px;cursor:pointer;margin-left:auto;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(tourButton);

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
  const worldLabel = document.createElement("span");
  worldLabel.style.cssText = "color:#333;";
  header.append(yearLabel, sliderRow, worldLabel);
  container.appendChild(header);

  const key = document.createElement("div");
  key.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;padding:0 0 6px;font-size:13px;color:#333;";
  let keyGroup = null;
  const keyItems = data.groups.map(g => {
    const item = document.createElement("button");
    item.type = "button";
    item.style.cssText = "display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font:inherit;color:inherit;" +
      "background:none;border:1px solid transparent;border-radius:999px;padding:1px 6px 1px 4px;margin:-2px -6px -2px -4px;cursor:pointer;";
    const swatch = document.createElement("span");
    swatch.style.cssText = `width:11px;height:11px;border-radius:2px;background:${GROUP_COLOURS[g.id] ?? "#888"};flex:none;`;
    item.append(swatch, g.name);
    item.addEventListener("click", () => { stopTour(); keyGroup = keyGroup === g.id ? null : g.id; updateKey(); requestRender(); });
    key.appendChild(item);
    return {item, id: g.id};
  });
  function updateKey() {
    for (const {item, id} of keyItems) {
      const on = keyGroup === id;
      item.style.borderColor = on ? ACCENT : "transparent";
      item.style.color = on ? ACCENT : "inherit";
      item.setAttribute("aria-pressed", on);
    }
  }
  container.appendChild(key);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "co2-per-capita-bars");
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
  const HINT_IDLE = "Click or tap a bar for the country; click again to let go. A group in the key dims the others. Drag the slider to a year.";
  const HINT_TOUR = "Playing the years through — move the slider or click anything to take over; Play tour starts it again.";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- the numbers at a time ------------------------------------------------------------------
  function stateAt(tt) {
    const rows = [];
    let pop = 0, co2 = 0;
    for (const c of countries) {
      const p = at(c.pop, tt);
      const e = at(mode === "year" ? c.co2 : c.cum, tt);
      if (p === null || e === null || !(p > 0)) continue;
      rows.push({c, pop: p, co2: e, v: e / p});
      pop += p;
      co2 += e;
    }
    rows.sort((a, b) => b.v - a.v || b.pop - a.pop);
    return {rows, pop, co2, world: pop > 0 ? co2 / pop : 0, vMax: SCALE_MAX[mode]};
  }

  // ---- geometry -------------------------------------------------------------------------------
  const F = v => v.toFixed(2);
  const xOf = v => plotL + (plotR - plotL) * clamp(v / SCALE_MAX[mode], 0, 1);
  const hOf = pop => PLOT_H * pop / FULL_HEIGHT_POP;

  // ---- drawing --------------------------------------------------------------------------------
  let barGroup, axisGroup, labelGroup, pickPath, cornerYear;
  const barEls = new Map();

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    axisGroup = svgEl("g", {"pointer-events": "none"}, svg);
    barGroup = svgEl("g", {}, svg);
    barEls.clear();
    pickPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.5, "pointer-events": "none"}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    cornerYear = svgEl("text", {
      x: F(plotR - 8), y: F(plotB - 10), "text-anchor": "end", "font-size": 40, "font-weight": "bold", fill: "#222",
      stroke: "#fff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round", "pointer-events": "none",
    }, svg);
    snapLayout();
    render();
  }

  function snapLayout() {
    const s = stateAt(t);
    layout.clear();
    let y = plotT;
    for (const row of s.rows) {
      const h = hOf(row.pop);
      layout.set(row.c.code, {y0: y, h, x: xOf(row.v), alpha: 1});
      y += h;
    }
  }

  // One frame: every bar moves some way towards its place and length, arrivals grow out of
  // theirs, departures shrink away; then draw.
  function frame(now) {
    raf = null;
    if (container.isConnected === false) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (glide) {
      const p = clamp((now - glide.start) / glide.duration, 0, 1);
      t = glide.from + (glide.to - glide.from) * p;
      if (p >= 1) glide = null;
      syncTime();
    }
    const s = stateAt(t);
    const rate = reduceMotion ? 1 : 1 - Math.exp(-dt * 7);
    const seen = new Set();
    let y = plotT, moving = false;
    for (const row of s.rows) {
      const h = hOf(row.pop);
      const target = {y0: y, h, x: xOf(row.v), alpha: 1};
      let cur = layout.get(row.c.code);
      if (!cur) { cur = {y0: y, h: 0, x: plotL, alpha: 0}; layout.set(row.c.code, cur); }
      for (const k of ["y0", "h", "x", "alpha"]) {
        const d = target[k] - cur[k];
        if (Math.abs(d) > 1e-3) moving = true;
        cur[k] += d * rate;
      }
      seen.add(row.c.code);
      y += h;
    }
    for (const [code, cur] of layout) {
      if (seen.has(code)) continue;
      cur.h += (0 - cur.h) * rate;
      cur.alpha += (0 - cur.alpha) * rate;
      if (cur.h < 1e-3 && cur.alpha < 0.01) layout.delete(code); else moving = true;
    }
    render(s);
    if (moving || glide) raf = requestAnimationFrame(frame);
    else lastFrame = 0;
  }
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  function render(s = stateAt(t)) {
    const rowByCode = new Map(s.rows.map(r => [r.c.code, r]));
    for (const [code, el] of barEls) if (!layout.has(code)) { el.remove(); barEls.delete(code); }
    for (const [code, cur] of layout) {
      let el = barEls.get(code);
      const c = byCode.get(code);
      if (!el) {
        el = svgEl("rect", {"data-code": code}, barGroup);
        el.setAttribute("fill", GROUP_COLOURS[c.group] ?? "#888");
        barEls.set(code, el);
      }
      el.setAttribute("x", F(plotL));
      el.setAttribute("y", F(cur.y0));
      el.setAttribute("width", F(Math.max(0, cur.x - plotL)));
      el.setAttribute("height", F(Math.max(0, cur.h)));
      const dim = keyGroup && c.group !== keyGroup;
      el.setAttribute("opacity", (cur.alpha * (dim ? 0.18 : 1)).toFixed(3));
    }
    drawAxes(s);
    drawLabels(s, rowByCode);
    const code = shown(), cur = code && layout.get(code);
    pickPath.setAttribute("d", cur ? `M${F(plotL)},${F(cur.y0)}H${F(cur.x)}V${F(cur.y0 + cur.h)}H${F(plotL)}Z` : "");
    cornerYear.textContent = Math.floor(t + EPS);
    yearLabel.textContent = Math.floor(t + EPS);
    worldLabel.textContent = `World: ${formatPerPerson(s.world)} t per person, ${formatPop(s.pop)} people`;
    if (String(slider.value) !== String(Math.floor(t + EPS))) slider.value = Math.floor(t + EPS);
    updateStatus(s, rowByCode);
  }

  // The population scale down the left, a gridline and a label every billion; the
  // per-person scale along the bottom.
  function drawAxes(s) {
    axisGroup.replaceChildren();
    const vMax = SCALE_MAX[mode];
    svgEl("path", {d: `M${F(plotL)},${F(plotT)}V${F(plotB)}H${F(plotR)}`, stroke: "#222", "stroke-width": 1.2, fill: "none"}, axisGroup);
    for (let p = 0; p <= FULL_HEIGHT_POP; p += 1000) {
      const y = plotT + hOf(p);
      svgEl("path", {d: `M${F(plotL)},${F(y)}H${F(plotR)}`, stroke: "rgba(0,0,0,0.08)", "stroke-width": 1}, axisGroup);
      svgEl("path", {d: `M${F(plotL - 4)},${F(y)}H${F(plotL)}`, stroke: "#222", "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(plotL - 7), y: F(y), "text-anchor": "end", "dominant-baseline": "central", "font-size": 11, fill: "#333"}, axisGroup);
      tl.textContent = p === 0 ? "0" : `${p / 1000}B`;
    }
    const cap = svgEl("text", {x: F(plotL), y: F(plotT - 10), "font-size": 11, fill: "#333"}, axisGroup);
    cap.textContent = "people, stacked from the top in order of CO₂ per person";
    const step = niceStep(vMax / 5);
    for (let v = 0; v <= vMax + EPS; v += step) {
      const x = xOf(v);
      svgEl("path", {d: `M${F(x)},${F(plotB)}V${F(plotB + 4)}`, stroke: "#222", "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(x), y: F(plotB + 8), "text-anchor": "middle", "dominant-baseline": "hanging", "font-size": 11, fill: "#333"}, axisGroup);
      tl.textContent = formatTick(v);
    }
    const xcap = svgEl("text", {x: F(plotR), y: F(plotB + 22), "text-anchor": "end", "font-size": 11, fill: "#333"}, axisGroup);
    xcap.textContent = mode === "year" ? "tonnes of CO₂ per person a year" : `tonnes of CO₂ per person since ${firstYear}`;
  }

  // Labels: inside a bar tall and long enough for its name; otherwise just beyond the bar's
  // end, as many as fit without touching, the top of the ranking and the biggest emitters
  // first, the font shrunk for one that would run off the edge.
  const OUT_FONT = 10, OUT_MIN_FONT = 7, CHAR = 0.56;
  function drawLabels(s, rowByCode) {
    labelGroup.replaceChildren();
    const vMax = SCALE_MAX[mode];
    const outside = [];
    for (const [code, cur] of layout) {
      const row = rowByCode.get(code);
      if (!row || cur.alpha < 0.5 || cur.h < 0.5) continue;
      if (keyGroup && row.c.group !== keyGroup) continue;
      const text = `${row.c.name} ${formatPerPerson(row.v)}`;
      const yc = cur.y0 + cur.h / 2;
      const insideFont = Math.min(14, cur.h * 0.8, (cur.x - plotL - 8) / (CHAR * text.length));
      if (insideFont >= 9) {
        const tx = svgEl("text", {x: F(plotL + 6), y: F(yc), "font-size": insideFont.toFixed(1), "font-weight": "bold", fill: "#fff", "dominant-baseline": "central"}, labelGroup);
        tx.textContent = text;
      } else {
        outside.push({row, cur, text, yc});
      }
      if (row.v > vMax + EPS) svgEl("circle", {cx: F(plotR + 3), cy: F(yc), r: 2, fill: "#111"}, labelGroup);
    }
    const lead = new Set(outside.filter(it => it.row.pop >= 1).sort((p, q) => q.row.v - p.row.v).slice(0, 8));
    outside.sort((p, q) => (lead.has(q) - lead.has(p)) || (q.row.co2 - p.row.co2));
    const placed = [];
    for (const it of outside) {
      const x0 = (it.row.v > vMax ? plotR + 8 : it.cur.x) + 4, room = w - 4 - x0;
      let font = Math.min(OUT_FONT, room / (CHAR * it.text.length));
      if (font < OUT_MIN_FONT) continue;
      const len = CHAR * font * it.text.length;
      const clash = placed.some(p => Math.abs(p.yc - it.yc) < Math.max(font, p.font) * 1.15 && x0 < p.x0 + p.len && p.x0 < x0 + len);
      if (clash) continue;
      placed.push({yc: it.yc, x0, len, font});
      const tx = svgEl("text", {
        x: F(x0), y: F(it.yc), "font-size": font.toFixed(1), fill: GROUP_COLOURS[it.row.c.group] ?? "#333", "dominant-baseline": "central",
        stroke: "#fff", "stroke-width": 2.5, "paint-order": "stroke", "stroke-linejoin": "round",
      }, labelGroup);
      tx.textContent = it.text;
    }
  }

  // ---- read-outs ------------------------------------------------------------------------------
  function updateStatus(s, rowByCode) {
    const y = Math.floor(t + EPS);
    const code = shown();
    const row = code ? rowByCode.get(code) : null;
    let head, body;
    if (row) {
      const c = row.c, g = groups.get(c.group);
      head = `${c.name} (${g?.name ?? c.group}). `;
      body = mode === "year"
        ? `${formatPerPerson(row.v)} tonnes of CO₂ per person in ${y}: ${formatMt(row.co2)} in all from ${formatPop(row.pop)} people, ` +
          `${formatPercent(row.co2 / s.co2)} of the world's ${formatMt(s.co2)}. World average ${formatPerPerson(s.world)} t.`
        : `${formatPerPerson(row.v)} tonnes of CO₂ per person: ${formatMt(row.co2)} emitted from ${firstYear} to ${y}, shared out among ` +
          `its ${formatPop(row.pop)} people of ${y}; ${formatPercent(row.co2 / s.co2)} of the world's ${formatMt(s.co2)}. World average ${formatPerPerson(s.world)} t.`;
    } else {
      const top = s.rows.filter(r => r.pop >= 10).slice(0, 3).map(r => `${r.c.name} ${formatPerPerson(r.v)}`);
      head = `${y}. `;
      body = mode === "year"
        ? `${formatMt(s.co2)} of CO₂ from ${formatPop(s.pop)} people: ${formatPerPerson(s.world)} tonnes each. ` +
          `Highest among countries of ten million or more: ${joinList(top)} tonnes per person.`
        : `${formatMt(s.co2)} of CO₂ since ${firstYear}, shared out among the ${formatPop(s.pop)} people of ${y}: ${formatPerPerson(s.world)} tonnes each. ` +
          `Highest among countries of ten million or more: ${joinList(top)} tonnes per person.`;
    }
    statusHead.textContent = head;
    statusBody.textContent = body;
    svg.setAttribute("aria-label", `CO₂ emissions per person by country in ${y}, as bars stacked from the top in order of emissions per person, each as tall as its population and as long as its emissions per person. ${head}${body}`);
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
  svg.addEventListener("pointerdown", () => stopTour());
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

  // ---- state changes --------------------------------------------------------------------------
  function syncTime() {
    const y = Math.floor(t + EPS);
    if (String(slider.value) !== String(y)) slider.value = y;
  }
  let lastEmittedYear = null;
  function setTime(v) {
    t = clamp(v, firstYear, lastYear);
    glide = null;
    syncTime();
    requestRender();
    const y = Math.floor(t + EPS);
    if (y !== lastEmittedYear) { lastEmittedYear = y; emit(); }
  }
  function setMode(m) {
    if (m === mode || !MODES.includes(m)) return;
    mode = m;
    updateModeButtons(mode);
    selected = null;
    hovered = null;
    requestRender();
    emit();
  }
  function glideTo(target, ms) {
    target = clamp(target, firstYear, lastYear);
    if (reduceMotion || ms <= 0 || target === t) { setTime(target); return; }
    glide = {from: t, to: target, start: performance.now(), duration: ms};
    requestRender();
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const y = Math.floor(t + EPS);
    const s = stateAt(y);
    return {
      year: y, mode, selected: selected ? byCode.get(selected)?.name ?? null : null,
      worldPerPerson: Number(s.world.toFixed(2)), population: Math.round(s.pop), co2: Math.round(s.co2),
    };
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  updateModeButtons(mode);
  updateKey();
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

  // ---- tour -----------------------------------------------------------------------------------
  const MS_PER_YEAR = 120;
  const TOUR_HOLD = 3000;
  const TOUR_STOPS = [{to: firstYear, ms: 0, hold: 1200}, {to: lastYear, ms: (lastYear - firstYear) * MS_PER_YEAR, hold: TOUR_HOLD}];
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
    if (glide) setTime(Math.round(t));
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
    hint.textContent = HINT_TOUR;
    showTouring();
    requestRender();
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

// ---- formatting -----------------------------------------------------------------------------

function formatMt(mt) {
  return mt >= 1000 ? `${(mt / 1000).toFixed(mt >= 10000 ? 0 : 1)} GtCO₂` : `${Math.round(mt).toLocaleString("en-US")} MtCO₂`;
}
function formatPop(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} billion` : `${Math.round(m).toLocaleString("en-US")} million`;
}
function formatPercent(f) {
  const p = 100 * f;
  return `${p >= 10 ? Math.round(p) : p >= 1 ? p.toFixed(1) : p.toFixed(2)}%`;
}
function formatTick(v) {
  return Number(v.toPrecision(3)).toLocaleString("en-US");
}
function joinList(items) {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
function niceStep(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (m * mag >= v - EPS) return m * mag;
  return 10 * mag;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
