// The energy chain from a lump of coal to a lit bulb, as a Sankey: 100 units of energy enter at
// the power station, most leave as heat up the cooling tower, a little more warms the wires,
// what reaches the house goes into the bulb, and the bulb turns most of that into heat too,
// leaving two units of light. Two bulbs: an incandescent one, which draws 36 units to make 2 of
// light, and an LED, which draws 6 for the same light, so that 30 of the 36 units delivered
// are no longer needed; the switch between them animates, since the shrinking draw at the
// plug is the point. A slider sets the power station's efficiency, from an old coal plant to
// a gas combined-cycle one, and the first link of the chain moves with it; a row of sources
// (coal, gas, nuclear, biomass, geothermal, hydro, wind, solar) sets it to each one's typical
// efficiency and renames the plant, so the same chain can start from wind through a rotor or
// sunlight on a panel, where what is not captured is not burned. Drawn in the style
// of the Hickman and climate-funds widgets: a grey plate, a bold title in the corner, dark
// pill buttons. Static numbers, the course's own; no data file. Self-contained: no d3, no
// imports.
//
// Options: {source: "coal" | "gas" | "nuclear" | "biomass" | "geothermal" | "hydro" | "wind" |
// "solar"}, {bulb: "incandescent" | "led"}, {efficiency: 0.38} (the plant's, overriding the
// source's typical figure); {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const ACCENT = "#0b57d0";
const SOURCE = 100;                 // units of energy in the coal
const DEFAULT_EFFICIENCY = 0.38;    // the course figure: 62 of 100 lost at the station
const LINE_LOSS_SHARE = 2 / 38;     // the course figure: 2 of the 38 units sent out
const FLOW = "#f0a202", LOSS = "#b8b8b8", LIGHT = "#ffd54f", SURPLUS = "#52A972";

export const BULBS = [
  {id: "incandescent", label: "Incandescent bulb", short: "Incandescent", the: "the incandescent bulb", draw: 36, heat: 34, title: "Draws 36 units and gives 2 of light; the other 34 are heat"},
  {id: "led", label: "LED bulb", short: "LED", the: "the LED", draw: 6, heat: 4, title: "Draws 6 units for the same 2 of light"},
];
// The sources the chain can start from, each with a typical efficiency for turning the energy
// that reaches the plant into electricity (IPCC AR5 WG3 Annex III and IEA technology
// assessments, rounded), the range the literature gives, and what the plant is called. For
// coal the default is the course figure's 38% (62 units lost), not a typical plant's. For
// wind the energy counted is what blows through the rotor (Betz's limit caps a turbine at
// 59%), for solar the sunlight that falls on the panel; nothing is burned, so what is not
// captured just passes by.
export const SOURCES = [
  {id: "coal", label: "Coal", efficiency: 0.38, range: "33–45% for coal plants, old to new", station: "Power station", burns: true},
  {id: "gas", label: "Gas", efficiency: 0.58, range: "55–62% for a combined-cycle gas turbine, 35–40% for open cycle", station: "Gas turbine", burns: true},
  {id: "nuclear", label: "Nuclear", efficiency: 0.33, range: "33–37% for a water-cooled reactor's steam cycle", station: "Reactor", burns: true},
  {id: "biomass", label: "Biomass", efficiency: 0.30, range: "25–35% for a biomass boiler", station: "Power station", burns: true},
  {id: "geothermal", label: "Geothermal", efficiency: 0.15, range: "10–20%, the steam being cool", station: "Geothermal plant", burns: false},
  {id: "hydro", label: "Hydro", efficiency: 0.90, range: "85–95% of the water's energy", station: "Hydro turbine", burns: false},
  {id: "wind", label: "Wind", efficiency: 0.45, range: "35–50% of the wind through the rotor; Betz's limit is 59%", station: "Wind turbine", burns: false},
  {id: "solar", label: "Solar", efficiency: 0.20, range: "18–23% of the sunlight on the panel", station: "Solar panel", burns: false},
];
// Marks under the slider: round efficiencies for an old coal plant, a modern one, and a gas
// combined cycle.
export const EFFICIENCY_MARKS = [
  {value: 0.33, label: "old coal 33%"},
  {value: 0.45, label: "best coal 45%"},
  {value: 0.60, label: "gas CCGT 60%"},
];

// The chain's numbers for a bulb and a station efficiency.
export function chain(bulbId, efficiency) {
  const bulb = BULBS.find(b => b.id === bulbId) ?? BULBS[0];
  const generationLoss = SOURCE * (1 - efficiency);
  const toGrid = SOURCE - generationLoss;
  const lineLoss = toGrid * LINE_LOSS_SHARE;
  const delivered = toGrid - lineLoss;
  const device = Math.min(delivered, bulb.draw);
  const surplus = Math.max(0, delivered - device);
  const heat = device * bulb.heat / bulb.draw;
  const light = device - heat;
  return {generationLoss, toGrid, lineLoss, delivered, surplus, device, heat, light};
}

export function createEnergyChainWidget({width = FIGURE_WIDTH, bulb: initialBulb, source: initialSource, efficiency: initialEfficiency} = {}) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- state ----------------------------------------------------------------------------------
  let bulb = BULBS.some(b => b.id === initialBulb) ? initialBulb : "incandescent";
  let source = SOURCES.some(s => s.id === initialSource) ? initialSource : "coal";
  const sourceOf = () => SOURCES.find(s => s.id === source);
  let efficiency = clamp(Number(initialEfficiency) || sourceOf().efficiency, 0.05, 0.95);
  let shown = chain(bulb, efficiency);   // the numbers drawn now, chasing the target
  let raf = null, lastFrame = 0;

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, titleFont, labelFont, svgH, scale, plotL, plotR, baseY, topY;
  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = lerp(16, 22);
    labelFont = lerp(9.5, 12);
    scale = lerp(1.1, 1.5);          // px per unit of energy
    plotL = 8;
    plotR = w - 8;
    // The losses leave at the top, under their labels, which take two rows of two lines so
    // that neighbours never collide.
    topY = 8 + 2 * (2 * (labelFont + 2) + 6);
    baseY = topY + 18 + SOURCE * scale;   // the bottom edge of the main flow
    svgH = Math.round(baseY + 24);
  }
  applyLayout(maxW);

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px ${CARD_PAD}px ${CARD_PAD}px;` +
    `border-radius:6px;box-sizing:border-box;max-width:${maxW + 2 * CARD_PAD}px;`;
  const heading = document.createElement("div");
  heading.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:4px 0 2px;";
  heading.textContent = "Energy lost on the way to a light bulb";
  container.appendChild(heading);
  const subheading = document.createElement("div");
  subheading.style.cssText = "font-size:12px;color:#666;padding:0 0 10px;line-height:1.35;";
  container.appendChild(subheading);

  const PILL = "font:13px sans-serif;padding:5px 12px;border-radius:999px;cursor:pointer;white-space:nowrap;" +
    "display:inline-flex;align-items:center;gap:6px;transition:background-color .15s,color .15s,border-color .15s;";
  function stylePill(b, active) {
    b.style.border = active ? "1px solid #333" : "1px solid #ccc";
    b.style.background = active ? "#333" : "#fff";
    b.style.color = active ? "#fff" : "#333";
    b.setAttribute("aria-pressed", String(active));
  }
  // The source: one pill each, which sets the slider to that source's typical efficiency.
  const sourceRow = document.createElement("div");
  sourceRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 0 6px;";
  const sourceButtons = SOURCES.map(s => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = s.label;
    el.title = `${s.label}: typically ${Math.round(s.efficiency * 100)}% (${s.range})`;
    el.style.cssText = PILL;
    el.addEventListener("click", () => setSource(s.id));
    sourceRow.appendChild(el);
    return el;
  });
  container.appendChild(sourceRow);

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:0 0 8px;";
  container.appendChild(controls);
  const bulbRow = document.createElement("div");
  bulbRow.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
  const bulbButtons = BULBS.map(b => {
    const el = document.createElement("button");
    el.type = "button";
    el.textContent = b.label;
    el.title = b.title;
    el.style.cssText = PILL;
    el.addEventListener("click", () => setBulb(b.id));
    bulbRow.appendChild(el);
    return el;
  });
  controls.appendChild(bulbRow);

  // The efficiency slider, with its marks named under it.
  const sliderBox = document.createElement("div");
  sliderBox.style.cssText = "display:flex;flex-direction:column;gap:2px;min-width:220px;flex:1 1 240px;";
  const sliderLabel = document.createElement("label");
  sliderLabel.style.cssText = "font-size:13px;color:#333;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = 5; slider.max = 95; slider.step = 1;
  slider.style.cssText = `width:100%;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", "The plant's efficiency, per cent");
  slider.addEventListener("input", e => { e.stopPropagation(); setEfficiency(Number(slider.value) / 100); });
  const marks = document.createElement("div");
  marks.style.cssText = "position:relative;height:26px;font-size:10px;color:#777;";
  EFFICIENCY_MARKS.forEach((m, i) => {
    const s = document.createElement("span");
    s.textContent = m.label;
    const pct = (m.value * 100 - 5) / 90 * 100;
    // Alternate rows, so that the marks never run into each other when the slider is short.
    s.style.cssText = `position:absolute;left:${pct}%;top:${(i % 2) * 12}px;transform:translateX(${pct < 20 ? "0" : pct > 75 ? "-100%" : "-50%"});white-space:nowrap;cursor:pointer;`;
    s.title = `Set the station to ${Math.round(m.value * 100)}%`;
    s.addEventListener("click", () => setEfficiency(m.value));
    marks.appendChild(s);
  });
  sliderBox.append(sliderLabel, slider, marks);
  controls.appendChild(sliderBox);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "energy-chain");
  svg.setAttribute("role", "img");
  svg.style.cssText = "display:block;overflow:visible;";
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

  // ---- drawing --------------------------------------------------------------------------------
  // The main flow runs left to right along the bottom; at each station a loss peels off the
  // top of the band and turns up through a quarter circle to leave at the top, where it is
  // named. The band that goes on keeps the bottom edge.
  function render() {
    const c = shown;
    svg.setAttribute("width", w.toFixed(0));
    svg.setAttribute("height", svgH.toFixed(0));
    svg.replaceChildren();
    svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    const g = svgEl("g", {"font-family": "sans-serif"}, svg);

    const inner = plotR - plotL;
    // Stations along the chain, as fractions of the width: the coal, the power station, the
    // wires, the house, the bulb, and where the light leaves.
    const xs = {source: plotL + 0.02 * inner, station: plotL + 0.2 * inner, wires: plotL + 0.42 * inner, home: plotL + 0.62 * inner, bulb: plotL + 0.8 * inner, out: plotR};
    const r = 8;   // the turns' inner radius
    const b = BULBS.find(x => x.id === bulb);
    const lineH = labelFont + 2;

    // A horizontal band from x0 to x1 of `units` thickness, bottom edge on the baseline.
    const band = (x0, x1, units, fill) => {
      if (units <= 0) return;
      svgEl("rect", {x: F(x0), y: F(baseY - units * scale), width: F(Math.max(0, x1 - x0)), height: F(units * scale), fill}, g);
    };
    // A loss of `units` leaving the band whose thickness is `incoming` at station x: it takes
    // the top of the band and turns up to the top edge, where it is named in two lines, in
    // the upper or lower of two rows so that neighbouring labels never meet.
    let lossCount = 0;
    const peel = (x, incoming, units, fill, name, sub) => {
      const row = lossCount++ % 2;   // alternate rows, whether or not the loss is drawn
      if (units <= 0.05) return;
      const t = units * scale;
      const y1 = baseY - incoming * scale;        // the top of the incoming band
      const y2 = y1 + t;                          // the bottom of the loss band
      const yc = (y1 + y2) / 2, R = r + t / 2;
      const cy = yc - R;                          // the turn's centre
      // Both arcs are centred on (x, cy), above the band's entry: the outer edge (radius r + t)
      // sweeps anticlockwise from below the centre to its right, the inner edge (radius r)
      // comes back clockwise. SVG's sweep flag is 0 for the former, 1 for the latter.
      const d = `M${F(x)},${F(y2)}A${F(r + t)},${F(r + t)},0,0,0,${F(x + r + t)},${F(cy)}` +
        `V${F(topY)}H${F(x + r)}V${F(cy)}A${F(r)},${F(r)},0,0,1,${F(x)},${F(y1)}Z`;
      svgEl("path", {d, fill}, g);
      // A thin leader from the stem up to the label when the label is in the upper row.
      const lx = x + r + t / 2;
      const base = topY - 4 - row * (2 * lineH + 6);
      if (row) svgEl("path", {d: `M${F(lx)},${F(topY)}V${F(base + 2)}`, stroke: "#999", "stroke-width": 1}, g);
      const anchor = lx < plotL + 50 ? "start" : lx > plotR - 50 ? "end" : "middle";
      const ax = anchor === "start" ? Math.max(plotL, lx - 10) : anchor === "end" ? Math.min(plotR, lx + 10) : lx;
      const t1 = svgEl("text", {x: F(ax), y: F(base - lineH), "font-size": labelFont, "text-anchor": anchor, fill: "#333", "font-weight": "bold"}, g);
      t1.textContent = name;
      const t2 = svgEl("text", {x: F(ax), y: F(base), "font-size": labelFont, "text-anchor": anchor, fill: "#555"}, g);
      t2.textContent = sub ? `${formatUnits(units)}, ${sub}` : formatUnits(units);
    };
    // A station: a dark bar across the band where something happens, named beneath, the
    // name starting at the bar so that neighbours do not meet when the figure is narrow.
    const station = (x, units, name, bar = true) => {
      if (bar) svgEl("rect", {x: F(x - 2), y: F(baseY - units * scale - 2), width: 4, height: F(units * scale + 4), fill: "#333", rx: 1}, g);
      const tx = svgEl("text", {x: F(x + 3), y: F(baseY + 15), "font-size": labelFont, fill: "#333"}, g);
      tx.textContent = name;
    };

    // The source, and the band into the plant.
    const src = sourceOf();
    band(xs.source, xs.station, SOURCE, FLOW);
    station(xs.source - 3, SOURCE, src.label, false);
    station(xs.station, SOURCE, src.station);
    peel(xs.station, SOURCE, c.generationLoss, LOSS, src.burns ? "Lost at the plant" : "Not captured", `${Math.round(efficiency * 100)}% efficient`);
    band(xs.station, xs.wires, c.toGrid, FLOW);
    station(xs.wires, c.toGrid, "Wires");
    peel(xs.wires, c.toGrid, c.lineLoss, LOSS, "Lost in the wires");
    band(xs.wires, xs.home, c.delivered, FLOW);
    station(xs.home, c.delivered, "Home");
    // At the house: with an LED, most of what the incandescent needed is not needed at all.
    peel(xs.home, c.delivered, c.surplus, SURPLUS, "Not needed", `with ${b.the}`);
    band(xs.home, xs.bulb, c.device, FLOW);
    station(xs.bulb, c.device, b.short);
    peel(xs.bulb, c.device, c.heat, LOSS, "Lost as heat");
    band(xs.bulb, xs.out, c.light, LIGHT);
    const lt = svgEl("text", {x: F(xs.out), y: F(baseY - c.light * scale - 6), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
    lt.textContent = `Light: ${formatUnits(c.light)}`;

    // The numbers on the main band where there is room.
    for (const [x0, x1, units] of [[xs.source, xs.station, SOURCE], [xs.station, xs.wires, c.toGrid], [xs.wires, xs.home, c.delivered], [xs.home, xs.bulb, c.device]]) {
      if (units * scale < 14) continue;
      const tx = svgEl("text", {x: F((x0 + x1) / 2), y: F(baseY - units * scale / 2 + 4), "font-size": labelFont, "text-anchor": "middle", fill: "#5a3d00"}, g);
      tx.textContent = formatUnits(units);
    }

    const what = {coal: "in the coal", gas: "in the gas", nuclear: "in the nuclear fuel", biomass: "in the biomass", geothermal: "in the geothermal steam",
      hydro: "in the falling water", wind: "in the wind through the rotor", solar: "in the sunlight on the panel"}[source];
    subheading.textContent = `Of ${SOURCE} units of energy ${what}, ${formatUnits(c.light)} become light. ` +
      `The ${src.station.toLowerCase()} sends out ${formatUnits(c.toGrid)}, ${formatUnits(c.delivered)} reach the house, ${b.the} uses ${formatUnits(c.device)} of them` +
      (c.surplus > 0.05 ? ` and the other ${formatUnits(c.surplus)} need not be generated at all.` : ".") +
      (src.burns ? "" : " Nothing is burned here: what the plant does not capture simply passes by.");
    svg.setAttribute("aria-label", `Sankey diagram of the energy chain from ${src.label.toLowerCase()} to light. ${subheading.textContent}`);
  }

  // ---- animation ------------------------------------------------------------------------------
  function frame(now) {
    raf = null;
    const target = chain(bulb, efficiency);
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    const rate = reduceMotion ? 1 : 1 - Math.exp(-dt * 9);
    let moving = false;
    for (const k of Object.keys(target)) {
      const d = target[k] - shown[k];
      if (Math.abs(d) > 0.01) moving = true;
      shown[k] += d * rate;
    }
    if (!moving) { shown = {...target}; lastFrame = 0; }
    render();
    if (moving) raf = requestAnimationFrame(frame);
  }
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  // ---- state changes --------------------------------------------------------------------------
  function updateControls() {
    bulbButtons.forEach((el, i) => stylePill(el, BULBS[i].id === bulb));
    sourceButtons.forEach((el, i) => stylePill(el, SOURCES[i].id === source));
    slider.value = Math.round(efficiency * 100);
    const s = sourceOf();
    sliderLabel.textContent = `${s.station} efficiency: ${Math.round(efficiency * 100)}%`;
    slider.title = `Typically ${Math.round(s.efficiency * 100)}%: ${s.range}`;
    heading.style.fontSize = `${titleFont.toFixed(1)}px`;
  }
  function setBulb(id) {
    if (id === bulb) return;
    bulb = id;
    updateControls();
    requestRender();
    emit();
  }
  // A new source brings its typical efficiency with it; the slider can then be moved.
  function setSource(id) {
    if (id === source) return;
    source = id;
    efficiency = sourceOf().efficiency;
    updateControls();
    requestRender();
    emit();
  }
  function setEfficiency(e) {
    efficiency = clamp(e, 0.05, 0.95);
    updateControls();
    requestRender();
    emit();
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const c = chain(bulb, efficiency);
    return {source, bulb, efficiency, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 10) / 10]))};
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- go -------------------------------------------------------------------------------------
  updateControls();
  render();
  container.value = value();
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); updateControls(); render(); }
    });
    ro.observe(container);
  }
  return container;
}

function formatUnits(v) {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} unit${r === 1 ? "" : "s"}`;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
