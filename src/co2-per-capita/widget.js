// CO₂ emissions per person, country by country, as a polar chart after Visual Capitalist's
// "Carbon emissions per capita by country": every country is a wedge whose angle is its
// population and whose length is its emissions per person, so its area is its emissions in
// all. The wedges run clockwise from twelve o'clock in order of emissions per person, the
// highest first, so the chart reads as a ranking and the fat wedges of the populous countries
// stand out from the thin tall ones of the small rich emitters. The angular scale is fixed,
// a full turn for ten billion people, so the world's wedges fill most of the circle today and
// a sliver of it in 1850, and the ring's ticks stay put. Colours are seven groups:
// the Americas, Europe, Russia, the Middle East, Asia and Oceania, Australia and New Zealand,
// and Africa.
//
// A toggle chooses what "per person" means: the year's emissions divided by the year's
// population (the original), or everything the country has emitted since 1850 divided by
// its population now, as if today's people carried their country's whole history. The
// year slider runs from 1850, and as the years play the ranking changes and the wedges
// slide past each other; every wedge glides to its new place rather than jumping.
//
// Labels follow the original: along the outer edge of a wedge wide enough to carry its name,
// radially outward from the tip of a narrower one, and not at all when even a small font
// would not fit; the font shrinks to fit either way. Emissions are fossil fuels and cement
// plus land-use change, as in the carbon-budget widgets. Self-contained: no d3, no imports.

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const ACCENT = "#0b57d0";
const EPS = 1e-9;
const POP_MIN_FOR_SCALE = 3;   // millions: the radial scale fits every country at least this big
const FULL_TURN_POP = 10000;   // millions: a full turn of the circle is ten billion people

export const MODES = ["year", "cumulative"];

// Okabe–Ito, one per group, with the yellow darkened so that it holds against white.
export const GROUP_COLOURS = {
  americas: "#009E73", europe: "#E69F00", russia: "#0072B2", mideast: "#CC79A7",
  asia: "#D55E00", australia: "#b39b00", africa: "#56B4E9",
};

export function createCo2PerCapitaWidget({data, width = FIGURE_WIDTH, year, mode: initialMode} = {}) {
  if (!data?.years || !data?.countries) throw new Error("createCo2PerCapitaWidget needs {data}: the contents of data/co2-per-capita.json");
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

  // A series at a continuous time: linear between the years, the year's own value where the
  // next is missing, nothing where the year's is.
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
  let selected = null, hovered = null;   // country codes
  const shown = () => hovered ?? selected;
  const layout = new Map();   // code → {a0, w, r, alpha}: where each wedge is now, chasing its target
  let vMaxNow = null;         // the radial scale's top, chasing its target
  let glide = null, raf = null, lastFrame = 0;

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, R, r0, cx, cy, svgH, margin;
  function applyLayout(newW) {
    w = newW;
    margin = clamp(Math.round(w * 0.15), 52, 96);   // room for the radial labels
    R = (w - 2 * margin) / 2;
    r0 = Math.max(40, R * 0.32);   // the base ring, wide so the thin wedges have some width there
    cx = w / 2;
    cy = margin + R;
    svgH = 2 * (margin + R);
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

  // The year, its slider, and the world figure.
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

  // The key: one swatch per group. Clicking one dims the others.
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
  svg.setAttribute("class", "co2-per-capita");
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
  const HINT_IDLE = "Click or tap a wedge for the country; click again to let go. A group in the key dims the others. Drag the slider to a year.";
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
  // Every country with a population and emissions at tt: its per-person figure, sorted highest
  // first, with the world's totals.
  function stateAt(tt) {
    const rows = [];
    let pop = 0, co2 = 0;
    for (const c of countries) {
      const p = at(c.pop, tt);
      const e = at(mode === "year" ? c.co2 : c.cum, tt);
      if (p === null || e === null || !(p > 0)) continue;
      rows.push({c, pop: p, co2: e, v: e / p});   // Mt over millions is tonnes per person
      pop += p;
      co2 += e;
    }
    rows.sort((a, b) => b.v - a.v || b.pop - a.pop);
    // The scale fits every country of some size; the tiny rich ones may overshoot and are clipped.
    const fitted = rows.filter(r => r.pop >= POP_MIN_FOR_SCALE);
    const vMax = niceCeil(Math.max(...(fitted.length ? fitted : rows).map(r => r.v), 1e-6));
    return {rows, pop, co2, world: pop > 0 ? co2 / pop : 0, vMax};
  }

  // ---- geometry -------------------------------------------------------------------------------
  const rOf = (v, vMax) => r0 + (R - r0) * clamp(v / vMax, 0, 1);
  const pt = (a, r) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const F = v => v.toFixed(2);
  // An annular sector from angle a0 clockwise by w, between radii ri and ro.
  function sectorPath(a0, w, ri, ro) {
    if (w <= 1e-6 || ro <= ri + 1e-6) return "";
    const a1 = a0 + Math.min(w, 2 * Math.PI - 1e-6);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, ro), [x1, y1] = pt(a1, ro), [x2, y2] = pt(a1, ri), [x3, y3] = pt(a0, ri);
    return `M${F(x0)},${F(y0)}A${F(ro)},${F(ro)} 0 ${large} 1 ${F(x1)},${F(y1)}L${F(x2)},${F(y2)}A${F(ri)},${F(ri)} 0 ${large} 0 ${F(x3)},${F(y3)}Z`;
  }

  // ---- drawing --------------------------------------------------------------------------------
  let wedgeGroup, axisGroup, labelGroup, defs, pickHalo, pickPath, centreYear;
  const wedgeEls = new Map();

  function build() {
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    defs = svgEl("defs", {}, svg);
    wedgeGroup = svgEl("g", {}, svg);
    wedgeEls.clear();
    axisGroup = svgEl("g", {"pointer-events": "none"}, svg);
    pickHalo = svgEl("path", {fill: "none", stroke: "#fff", "stroke-width": 4, "stroke-linejoin": "round", "pointer-events": "none"}, svg);
    pickPath = svgEl("path", {fill: "none", stroke: "#111", "stroke-width": 1.5, "stroke-linejoin": "round", "pointer-events": "none"}, svg);
    labelGroup = svgEl("g", {"pointer-events": "none", "font-family": "sans-serif"}, svg);
    centreYear = svgEl("text", {
      x: F(cx), y: F(cy), "text-anchor": "middle", "dominant-baseline": "central", "font-size": Math.round(r0 * 0.7),
      "font-weight": "bold", fill: "#222", stroke: "#fff", "stroke-width": 4, "paint-order": "stroke", "stroke-linejoin": "round", "pointer-events": "none",
    }, svg);
    snapLayout();
    render();
  }

  // Put every wedge where it belongs right now, with no glide: on build and under reduced motion.
  function snapLayout() {
    const s = stateAt(t);
    layout.clear();
    let a = 0;
    for (const row of s.rows) {
      const wd = 2 * Math.PI * row.pop / FULL_TURN_POP;
      layout.set(row.c.code, {a0: a, w: wd, r: rOf(row.v, s.vMax), alpha: 1});
      a += wd;
    }
    vMaxNow = s.vMax;
  }

  // One frame: move every wedge some way towards its target and draw. Wedges glide in angle,
  // length and opacity; a country arriving grows out of its place, one leaving shrinks away.
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
    vMaxNow = vMaxNow === null ? s.vMax : vMaxNow + (s.vMax - vMaxNow) * rate;
    const seen = new Set();
    let a = 0, moving = Math.abs(s.vMax - vMaxNow) > 1e-3 * s.vMax;
    for (const row of s.rows) {
      const wd = 2 * Math.PI * row.pop / FULL_TURN_POP;
      const target = {a0: a, w: wd, r: rOf(row.v, vMaxNow), alpha: 1};
      let cur = layout.get(row.c.code);
      if (!cur) { cur = {a0: a, w: 0, r: r0, alpha: 0}; layout.set(row.c.code, cur); }
      for (const k of ["a0", "w", "r", "alpha"]) {
        const d = target[k] - cur[k];
        if (Math.abs(d) > 1e-4) moving = true;
        cur[k] += d * rate;
      }
      seen.add(row.c.code);
      a += wd;
    }
    for (const [code, cur] of layout) {
      if (seen.has(code)) continue;
      cur.w += (0 - cur.w) * rate;
      cur.alpha += (0 - cur.alpha) * rate;
      if (cur.w < 1e-4 && cur.alpha < 0.01) layout.delete(code); else moving = true;
    }
    render(s);
    if (moving || glide) raf = requestAnimationFrame(frame);
    else lastFrame = 0;
  }
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  function render(s = stateAt(t)) {
    const rowByCode = new Map(s.rows.map(r => [r.c.code, r]));
    // Wedges, reused by country so the DOM is not rebuilt every frame.
    for (const [code, el] of wedgeEls) if (!layout.has(code)) { el.remove(); wedgeEls.delete(code); }
    for (const [code, cur] of layout) {
      let el = wedgeEls.get(code);
      const c = byCode.get(code);
      if (!el) {
        el = svgEl("path", {"data-code": code}, wedgeGroup);
        el.setAttribute("fill", GROUP_COLOURS[c.group] ?? "#888");
        wedgeEls.set(code, el);
      }
      el.setAttribute("d", sectorPath(cur.a0, cur.w, r0, cur.r));
      const dim = keyGroup && c.group !== keyGroup;
      el.setAttribute("opacity", (cur.alpha * (dim ? 0.18 : 1)).toFixed(3));
    }
    drawAxes(s);
    drawLabels(s, rowByCode);
    drawPick(rowByCode);
    centreYear.textContent = Math.floor(t + EPS);
    yearLabel.textContent = Math.floor(t + EPS);
    worldLabel.textContent = `World: ${formatPerPerson(s.world)} t per person, ${formatPop(s.pop)} people`;
    if (String(slider.value) !== String(Math.floor(t + EPS))) slider.value = Math.floor(t + EPS);
    updateStatus(s, rowByCode);
  }

  // The scale up the twelve o'clock line, the population ring with its billions, and the
  // world average as a dashed circle.
  function drawAxes(s) {
    axisGroup.replaceChildren();
    const vMax = vMaxNow ?? s.vMax;
    svgEl("circle", {cx: F(cx), cy: F(cy), r: F(r0), fill: "none", stroke: "#999", "stroke-width": 1}, axisGroup);
    svgEl("path", {d: `M${F(cx)},${F(cy - r0)}V${F(cy - R)}`, stroke: "#222", "stroke-width": 1.2}, axisGroup);
    const step = niceStep(vMax / 5);
    for (let v = 0; v <= vMax + EPS; v += step) {
      const y = cy - rOf(v, vMax);
      svgEl("path", {d: `M${F(cx - 4)},${F(y)}H${F(cx)}`, stroke: "#222", "stroke-width": 1}, axisGroup);
      const tl = svgEl("text", {x: F(cx - 7), y: F(y), "text-anchor": "end", "dominant-baseline": "central", "font-size": 11, fill: "#333",
        stroke: "#fff", "stroke-width": 3, "paint-order": "stroke"}, axisGroup);
      tl.textContent = formatTick(v);
    }
    const cap = svgEl("text", {x: F(cx + 6), y: F(cy - R - 6), "font-size": 11, fill: "#333", "text-anchor": "start"}, axisGroup);
    cap.textContent = mode === "year" ? "tonnes of CO₂ per person a year" : `tonnes of CO₂ per person since ${firstYear}`;
    // Population: a tick on the ring every billion people, all the way round, since the scale
    // is fixed; every fifth one only if the ring is too small for them all.
    const perB = 2 * Math.PI * 1000 / FULL_TURN_POP;   // radians per billion
    const popStep = perB * r0 > 30 ? 1000 : 5000;
    {
      for (let p = popStep; p < FULL_TURN_POP; p += popStep) {
        const a = 2 * Math.PI * p / FULL_TURN_POP;
        const [x0, y0] = pt(a, r0 - 4), [x1, y1] = pt(a, r0), [lx, ly] = pt(a, r0 - 12);
        svgEl("path", {d: `M${F(x0)},${F(y0)}L${F(x1)},${F(y1)}`, stroke: "#666", "stroke-width": 1}, axisGroup);
        const tl = svgEl("text", {x: F(lx), y: F(ly), "text-anchor": "middle", "dominant-baseline": "central", "font-size": 9, fill: "#666"}, axisGroup);
        tl.textContent = `${p / 1000}B`;
      }
    }
    if (s.world > 0 && s.world <= vMax) {
      svgEl("circle", {cx: F(cx), cy: F(cy), r: F(rOf(s.world, vMax)), fill: "none", stroke: "#222", "stroke-width": 1, "stroke-dasharray": "4 4", opacity: 0.6}, axisGroup);
    }
  }

  // Labels: along the outer edge for a wedge wide enough to carry its name at a readable size;
  // otherwise radially out from the tip, as many as fit without touching, the populous
  // countries first, the font shrunk for a label that would run off the edge.
  const RADIAL_FONT = 10, RADIAL_MIN_FONT = 7, CHAR = 0.56;   // em per character, roughly
  function drawLabels(s, rowByCode) {
    labelGroup.replaceChildren();
    defs.replaceChildren();
    const vMax = vMaxNow ?? s.vMax;
    const radial = [];
    let n = 0;
    for (const [code, cur] of layout) {
      const row = rowByCode.get(code);
      if (!row || cur.alpha < 0.5 || cur.w < 1e-4) continue;
      if (keyGroup && row.c.group !== keyGroup) continue;
      const text = `${row.c.name} ${formatPerPerson(row.v)}`;
      const mid = cur.a0 + cur.w / 2;
      const arcFont = (cur.w * (cur.r - 10) - 6) / (CHAR * text.length);
      if (arcFont >= 9 && cur.r - r0 > 22) {
        // Along an arc just inside the outer edge, the text centred on it; drawn anticlockwise
        // on the lower half so the text is never upside down.
        const font = Math.min(16, arcFont);
        const rr = cur.r - 5 - font / 2;
        const lower = Math.cos(mid) < 0;
        const a0 = lower ? cur.a0 + cur.w : cur.a0, a1 = lower ? cur.a0 : cur.a0 + cur.w;
        const [x0, y0] = pt(a0, rr), [x1, y1] = pt(a1, rr);
        const large = cur.w > Math.PI ? 1 : 0;
        const id = `cpc-arc-${code}-${n++}`;
        svgEl("path", {id, d: `M${F(x0)},${F(y0)}A${F(rr)},${F(rr)} 0 ${large} ${lower ? 0 : 1} ${F(x1)},${F(y1)}`}, defs);
        const tx = svgEl("text", {"font-size": font.toFixed(1), "font-weight": "bold", fill: "#fff", "dominant-baseline": "central"}, labelGroup);
        const tp = svgEl("textPath", {href: `#${id}`, startOffset: "50%", "text-anchor": "middle"}, tx);
        tp.textContent = text;
      } else {
        radial.push({row, cur, text, mid});
      }
      if (row.v > vMax + EPS) {
        const [x, y] = pt(mid, R + 2);
        svgEl("circle", {cx: F(x), cy: F(y), r: 2, fill: "#111"}, labelGroup);
      }
    }
    // Radial labels: the top of the ranking first (the highest per person among countries of
    // a million or more), then by emissions in all; each is kept only if it clears every label
    // already placed: two labels overlap in radius from the outer of their two tips, and there
    // they need an angular gap of about a line.
    const lead = new Set(radial.filter(it => it.row.pop >= 1).sort((p, q) => q.row.v - p.row.v).slice(0, 8));
    radial.sort((p, q) => (lead.has(q) - lead.has(p)) || (q.row.co2 - p.row.co2));
    const placed = [];
    for (const it of radial) {
      const start = it.cur.r + 4, room = R + margin - 6 - start;
      let font = Math.min(RADIAL_FONT, room / (CHAR * it.text.length));
      if (font < RADIAL_MIN_FONT) continue;
      const len = CHAR * font * it.text.length;
      const clash = placed.some(p => {
        const inner = Math.max(p.start, start), outer = Math.min(p.start + p.len, start + len);
        if (outer <= inner) return false;
        const gap = angleGap(p.mid, it.mid) * inner;
        return gap < Math.max(font, p.font) * 1.15;
      });
      if (clash) continue;
      placed.push({mid: it.mid, start, len, font});
      const right = Math.sin(it.mid) >= 0;
      const [x, y] = pt(it.mid, start);
      const deg = (it.mid * 180 / Math.PI) - 90 + (right ? 0 : 180);
      const tx = svgEl("text", {
        x: F(x), y: F(y), "font-size": font.toFixed(1), fill: GROUP_COLOURS[it.row.c.group] ?? "#333", "dominant-baseline": "central",
        "text-anchor": right ? "start" : "end", transform: `rotate(${deg.toFixed(2)} ${F(x)} ${F(y)})`,
        stroke: "#fff", "stroke-width": 2.5, "paint-order": "stroke", "stroke-linejoin": "round",
      }, labelGroup);
      tx.textContent = it.text;
    }
  }

  // The smaller angle between two directions.
  function angleGap(a, b) {
    const d = Math.abs(a - b) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  }

  function drawPick(rowByCode) {
    const code = shown();
    const cur = code && layout.get(code);
    const d = cur ? sectorPath(cur.a0, cur.w, r0, cur.r) : "";
    pickHalo.setAttribute("d", d);
    pickPath.setAttribute("d", d);
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
    svg.setAttribute("aria-label", `CO₂ emissions per person by country in ${y}, as wedges whose angle is population and whose length is emissions per person, ranked clockwise from the top. ${head}${body}`);
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
  // Back to 1850, then the years at a steady pace, a rest on the present, and round again;
  // it stops at the first click, and Play tour brings it back.
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

// Tonnes per person: one decimal below 100, whole above.
export function formatPerPerson(v) {
  return v >= 100 ? Math.round(v).toLocaleString("en-US") : v >= 10 ? v.toFixed(1) : v.toFixed(v >= 1 ? 1 : 2);
}
// Megatonnes as Gt above a thousand.
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

// The first of 1, 2, 2.5, 5, 10 × 10ⁿ at or above v.
function niceCeil(v) {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= v - EPS) return m * mag;
  return 10 * mag;
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
