// The energy chain from a lump of coal to lit bulbs, as a Sankey: 100 units of energy enter at
// the power station, most leave as heat up the cooling tower, a little more warms the wires
// along the way (a step in the band, with no bar, since it is spread out rather than at a
// place), and what arrives goes into as many bulbs as it can light, which turn most of it
// into heat too. Three bulbs: an incandescent one, which draws 36 units to make 2 of light, so
// the 36 delivered light one bulb; an ordinary LED, which draws 6 for the same light, so they
// light six and give 12 units of light; and the best LED sold, which draws 2.4, so they light
// fifteen and give 30; the switch between them animates, since the growing light from the same
// coal is the point. A slider sets the power station's efficiency, from an old coal plant to
// a gas combined-cycle one, and the first link of the chain moves with it; a row of sources
// (coal, gas, nuclear, biomass, geothermal, hydro, wind, solar) sets it to each one's typical
// efficiency and renames the plant, so the same chain can start from wind through a rotor or
// sunlight on a panel. The colours mean something (Okabe and Ito's): the source's band carries
// its carbon, black for coal, dark grey for gas, orange for biomass, green for nuclear and the
// renewables; electricity is blue, heat thrown away vermillion, light yellow, and what a plant
// does not capture from the sun, wind or water is pale and outlined, since it simply passes by.
// Under the bulbs the light's carbon cost is written, the 100 units read as 100 MWh and the
// IPCC's lifecycle figures applied, so that the same coal gives fifteen times the light for the
// same tonnes with the best LED. Drawn in the style
// of the Hickman and climate-funds widgets: a grey plate, a bold title in the corner, dark
// pill buttons. Static numbers, the course's own; no data file. Self-contained: no d3, no
// imports.
//
// Options: {source: "coal" | "gas" | "nuclear" | "biomass" | "geothermal" | "hydro" | "wind" |
// "solar"}, {bulb: "incandescent" | "led" | "best-led"}, {efficiency: 0.38} (the plant's,
// overriding the source's typical figure); {width} caps the figure's width.

const CARD_WIDTH = 640;
const CARD_PAD = 12;
const FIGURE_WIDTH = CARD_WIDTH - 2 * CARD_PAD;
const MIN_WIDTH = 320 - 2 * CARD_PAD;   // the card shrinks to 320 px, the figure inside it
const BACKGROUND = "#f2f2f2";
const ACCENT = "#0b57d0";
const SOURCE = 100;                 // units of energy in the coal
const DEFAULT_EFFICIENCY = 0.38;    // the course figure: 62 of 100 lost at the station
const LINE_LOSS_SHARE = 2 / 38;     // the course figure: 2 of the 38 units sent out
// The colours mean something, and are Okabe and Ito's: the source's band carries its carbon
// (black for coal, a dark grey for gas, orange for biomass, green for nuclear and the
// renewables), electricity is blue, heat thrown away is vermillion, light is yellow, and energy
// that a plant does not capture from the sun, wind, water or ground is pale and outlined, since
// it was never anyone's to lose.
const ELECTRICITY = "#0072B2", HEAT = "#D55E00", LIGHT = "#F0E442";
const PASSES_BY = "#e4ecf2", PASSES_BY_EDGE = "#8fa6b8";
const HIGH_CARBON = "#000000", GAS_CARBON = "#4D4D4D", MID_CARBON = "#E69F00", LOW_CARBON = "#009E73";
// Each unit of energy is read as a megawatt-hour when the carbon is counted, so the 100 units
// are 100 MWh: a truckload of coal, 13 tonnes.
export const UNIT = "MWh";

// Each bulb gives 2 units of light: the incandescent for 36 units of electricity (the course
// figure, about 14 lumens per watt); an ordinary LED for 6 (the course figure too, about 85
// lumens per watt, six times the incandescent, in the 80–100 of the lamps in most shops); the
// best LED for 2.4, since the most efficient lamps now sold (Philips' ultra-efficient range,
// about 210 lumens per watt) give fifteen times the light per watt. On that scale a perfect
// white light would be about 250 lumens per watt, so the best LED turns 84% of its electricity
// into light, the ordinary one 33% and the incandescent 6%.
export const BULBS = [
  {id: "incandescent", label: "Incandescent", short: "Incandescent", noun: "incandescent bulb", draw: 36, heat: 34,
    title: "Draws 36 units and gives 2 of light; the other 34 are heat (about 14 lumens per watt)"},
  {id: "led", label: "Ordinary LED", short: "Ordinary LED", noun: "ordinary LED bulb", draw: 6, heat: 4,
    title: "Draws 6 units for the same 2 of light: a typical LED lamp, about 85 lumens per watt, six times the incandescent"},
  {id: "best-led", label: "Best LED", short: "Best LED", noun: "best LED bulb", draw: 2.4, heat: 0.4,
    title: "Draws 2.4 units for the same 2 of light: the most efficient LED lamps sold, about 210 lumens per watt, fifteen times the incandescent"},
];
// The sources the chain can start from, each with a typical efficiency for turning the energy
// that reaches the plant into electricity (IPCC AR5 WG3 Annex III and IEA technology
// assessments, rounded), the range the literature gives, and what the plant is called. For
// coal the default is the course figure's 38% (62 units lost), not a typical plant's. For
// wind the energy counted is what blows through the rotor (Betz's limit caps a turbine at
// 59%), for solar the sunlight that falls on the panel; nothing is burned, so what is not
// captured just passes by. `co2` is the tonnes of CO2-equivalent for the 100 units, read as
// 100 MWh: IPCC AR5 WG3 Annex III's lifecycle medians per kWh of electricity (coal 820 g, gas
// 490, biomass 230, nuclear 12, geothermal 38, hydro 24, wind 11, solar 48), which count the
// mining, the building and the burning, turned into a figure per unit of energy entering the
// plant at the efficiency AR5 assumes (40% coal, 55% gas) or the typical one here. For a fuel
// it is mostly the burning, so it does not move with the slider: a worse plant burns the same
// coal for less light. For the others it is the plant's construction, spread over its life.
export const SOURCES = [
  {id: "coal", label: "Coal", efficiency: 0.38, range: "33–45% for coal plants, old to new", station: "Power station", burns: true, co2: 33, colour: HIGH_CARBON},
  {id: "gas", label: "Gas", efficiency: 0.58, range: "55–62% for a combined-cycle gas turbine, 35–40% for open cycle", station: "Gas turbine", burns: true, co2: 27, colour: GAS_CARBON},
  {id: "nuclear", label: "Nuclear", efficiency: 0.33, range: "33–37% for a water-cooled reactor's steam cycle", station: "Reactor", burns: true, co2: 0.4, colour: LOW_CARBON},
  {id: "biomass", label: "Biomass", efficiency: 0.30, range: "25–35% for a biomass boiler", station: "Power station", burns: true, co2: 7, colour: MID_CARBON},
  {id: "geothermal", label: "Geothermal", efficiency: 0.15, range: "10–20%, the steam being cool", station: "Geothermal plant", burns: false, co2: 0.6, colour: LOW_CARBON},
  {id: "hydro", label: "Hydro", efficiency: 0.90, range: "85–95% of the water's energy", station: "Hydro turbine", burns: false, co2: 2, colour: LOW_CARBON},
  {id: "wind", label: "Wind", efficiency: 0.45, range: "35–50% of the wind through the rotor; Betz's limit is 59%", station: "Wind turbine", burns: false, co2: 0.5, colour: LOW_CARBON},
  {id: "solar", label: "Solar", efficiency: 0.20, range: "18–23% of the sunlight on the panel", station: "Solar panel", burns: false, co2: 1, colour: LOW_CARBON},
];
// Marks under the slider: round efficiencies for an old coal plant, a modern one, and a gas
// combined cycle.
export const EFFICIENCY_MARKS = [
  {value: 0.33, label: "old coal 33%"},
  {value: 0.45, label: "best coal 45%"},
  {value: 0.60, label: "gas CCGT 60%"},
];

// The chain's numbers for a bulb and a station efficiency. Everything that reaches the house
// goes into bulbs, as many as it can light (a fraction of one when there is not enough for
// one), so the only losses are the plant's, the wires' and the bulbs' heat, and the light is
// what is left.
export function chain(bulbId, efficiency) {
  const bulb = BULBS.find(b => b.id === bulbId) ?? BULBS[0];
  const generationLoss = SOURCE * (1 - efficiency);
  const toGrid = SOURCE - generationLoss;
  const lineLoss = toGrid * LINE_LOSS_SHARE;
  const delivered = toGrid - lineLoss;
  const bulbs = delivered / bulb.draw;
  const heat = delivered * bulb.heat / bulb.draw;
  const light = delivered - heat;
  return {generationLoss, toGrid, lineLoss, delivered, bulbs, heat, light};
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
  const ctx = document.createElement("canvas").getContext("2d");   // for measuring labels
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, titleFont, labelFont, svgH, scale, plotL, plotR, baseY, topY, maxTip;
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
    // that neighbours never collide, with room for the tallest arrowhead between.
    maxTip = 0.1 * SOURCE * scale;
    topY = 8 + 2 * (2 * (labelFont + 2) + 6) + maxTip;
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

  // The source, one segmented control, each choice setting the slider to that source's
  // typical efficiency; then the bulb and the slider on the next row.
  const sourceRow = document.createElement("div");
  sourceRow.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:0 0 6px;";
  const updateSourceButtons = segmented(sourceRow, SOURCES.map(s => ({id: s.id, label: s.label,
    title: `${s.label}: typically ${Math.round(s.efficiency * 100)}% (${s.range})`})), setSource);
  container.appendChild(sourceRow);

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;padding:0 0 8px;";
  container.appendChild(controls);
  const updateBulbButtons = segmented(controls, BULBS.map(b => ({id: b.id, label: b.label, title: b.title})), setBulb);

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
    const plate = svgEl("rect", {x: 0, y: 0, width: F(w), height: F(svgH), fill: BACKGROUND}, svg);
    const g = svgEl("g", {"font-family": "sans-serif"}, svg);
    // The losses' leaders and labels sit in their own layers above the bands, the labels
    // haloed in the plate's colour so that a leader passing behind one is hidden by it.
    const leaderG = svgEl("g", {}, svg);
    const labelG = svgEl("g", {"font-family": "sans-serif", "paint-order": "stroke", stroke: BACKGROUND, "stroke-width": 3, "stroke-linejoin": "round"}, svg);

    const inner = plotR - plotL;
    // Stations along the chain, as fractions of the width: the coal, the power station, the
    // bulb, and where the light leaves. The wires' loss leaves midway between the plant and
    // the bulb, with no bar, since it is spread along the way rather than at a place.
    const xs = {source: plotL + 0.02 * inner, station: plotL + 0.2 * inner, wires: plotL + 0.5 * inner, bulb: plotL + 0.8 * inner, out: plotR};
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
    const peel = (x, incoming, units, fill, name, sub, edge) => {
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
      // The stem ends in an arrowhead: a point in the middle of its width, a tenth of that
      // width above the top edge, so that the flow is seen to leave.
      const lx = x + r + t / 2, tip = Math.max(2, 0.1 * t);
      const d = `M${F(x)},${F(y2)}A${F(r + t)},${F(r + t)},0,0,0,${F(x + r + t)},${F(cy)}` +
        `V${F(topY)}L${F(lx)},${F(topY - tip)}L${F(x + r)},${F(topY)}V${F(cy)}A${F(r)},${F(r)},0,0,1,${F(x)},${F(y1)}Z`;
      // A loss that is only energy passing by is drawn pale, with a dashed edge so that it still
      // reads against the plate.
      svgEl("path", {d, fill, ...(edge ? {stroke: edge, "stroke-width": 1, "stroke-dasharray": "3 2"} : {})}, g);
      // The labels keep to their two rows above the tallest arrowhead there could be, so that
      // they never move or meet; a thin leader runs up from each arrow's tip to its label.
      const base = topY - maxTip - 4 - row * (2 * lineH + 6);
      svgEl("path", {d: `M${F(lx)},${F(topY - tip)}V${F(base + 2)}`, stroke: "#999", "stroke-width": 1}, leaderG);
      const anchor = lx < plotL + 50 ? "start" : lx > plotR - 50 ? "end" : "middle";
      const ax = anchor === "start" ? Math.max(plotL, lx - 10) : anchor === "end" ? Math.min(plotR, lx + 10) : lx;
      const t1 = svgEl("text", {x: F(ax), y: F(base - lineH), "font-size": labelFont, "text-anchor": anchor, fill: "#333", "font-weight": "bold"}, labelG);
      t1.textContent = name;
      const t2 = svgEl("text", {x: F(ax), y: F(base), "font-size": labelFont, "text-anchor": anchor, fill: "#555"}, labelG);
      t2.textContent = sub ? `${formatUnits(units)}, ${sub}` : formatUnits(units);
    };
    // A station: a dark bar across the band where something happens, named beneath, the
    // name starting at the bar so that neighbours do not meet when the figure is narrow.
    let nameEnd = -Infinity, twoRows = false;   // where the last station's name ended
    const station = (x, units, name, bar = true) => {
      if (bar) svgEl("rect", {x: F(x - 2), y: F(baseY - units * scale - 2), width: 4, height: F(units * scale + 4), fill: "#333", stroke: BACKGROUND, "stroke-width": 1, rx: 1}, g);
      // The name starts at the bar, unless it would run past the right edge, when it ends
      // there instead; and if it would then run into the name before it, it drops to a
      // second row.
      ctx.font = `${labelFont}px sans-serif`;
      const tw = ctx.measureText(name).width;
      const overflows = x + 3 + tw > plotR;
      const x0 = overflows ? plotR - tw : x + 3;
      const row = x0 < nameEnd + 6 ? 1 : 0;
      if (row) twoRows = true; else nameEnd = x0 + tw;
      const tx = svgEl("text", {x: F(overflows ? plotR : x + 3), y: F(baseY + 15 + row * lineH), "font-size": labelFont, fill: "#333", ...(overflows ? {"text-anchor": "end"} : {})}, g);
      tx.textContent = name;
      return row;
    };

    // The source, and the band into the plant, in the source's carbon colour.
    const src = sourceOf();
    band(xs.source, xs.station, SOURCE, src.colour);
    station(xs.source - 3, SOURCE, src.label, false);
    station(xs.station, SOURCE, src.station);
    // What the plant does not turn into electricity: a fuel's heat up the cooling tower, or
    // sun, wind, water or ground heat that passes by, drawn pale.
    if (src.burns) peel(xs.station, SOURCE, c.generationLoss, HEAT, "Fuel wasted as heat", `${Math.round(efficiency * 100)}% efficient`);
    else peel(xs.station, SOURCE, c.generationLoss, PASSES_BY, "Passes by, not captured", `${Math.round(efficiency * 100)}% efficient`, PASSES_BY_EDGE);
    // The electricity runs straight to the bulbs; on the way a little escapes from the wires.
    band(xs.station, xs.wires, c.toGrid, ELECTRICITY);
    peel(xs.wires, c.toGrid, c.lineLoss, HEAT, "Lost in the wires");
    // Everything that arrives goes into bulbs, as many as it lights.
    band(xs.wires, xs.bulb, c.delivered, ELECTRICITY);
    const bulbRow = station(xs.bulb, c.delivered, formatBulbs(c.bulbs, b));
    peel(xs.bulb, c.delivered, c.heat, HEAT, "Lost as heat");
    band(xs.bulb, xs.out, c.light, LIGHT);
    // The carbon this light cost, under the bulbs, the units read as megawatt-hours.
    const co2 = svgEl("text", {x: F(plotR), y: F(baseY + 15 + (bulbRow + 1) * lineH), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
    co2.textContent = `for ${formatCo2(src.co2)}`;
    const rows = bulbRow + 1;
    // The light's label: inside its band when the band is tall enough, else above it, on one
    // line if the last segment is wide enough for it and on two if not.
    const lightText = `Light: ${formatUnits(c.light)}`;
    const lightH = c.light * scale, segW = xs.out - xs.bulb - 6;
    ctx.font = `bold ${labelFont}px sans-serif`;
    const lightW = ctx.measureText(lightText).width;
    if (lightH >= labelFont + 4 && (lightW <= segW || ctx.measureText(formatUnits(c.light)).width <= segW)) {
      const lt = svgEl("text", {x: F((xs.bulb + xs.out) / 2), y: F(baseY - lightH / 2 + labelFont * 0.35), "font-size": labelFont, "text-anchor": "middle", fill: "#5a3d00", "font-weight": "bold"}, g);
      lt.textContent = lightW <= segW ? lightText : formatUnits(c.light);
      if (lightW > segW) {
        const l1 = svgEl("text", {x: F(xs.out), y: F(baseY - lightH - 6), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
        l1.textContent = "Light";
      }
    } else if (lightW <= segW) {
      const lt = svgEl("text", {x: F(xs.out), y: F(baseY - lightH - 6), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
      lt.textContent = lightText;
    } else {
      const l1 = svgEl("text", {x: F(xs.out), y: F(baseY - lightH - 8 - lineH), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
      l1.textContent = "Light";
      const l2 = svgEl("text", {x: F(xs.out), y: F(baseY - lightH - 6), "font-size": labelFont, "text-anchor": "end", fill: "#333", "font-weight": "bold"}, g);
      l2.textContent = formatUnits(c.light);
    }

    // Room for the rows of station names and the carbon line beneath them.
    const h = svgH + Math.max(twoRows ? 1 : 0, rows) * lineH;
    svg.setAttribute("height", h.toFixed(0));
    plate.setAttribute("height", F(h));

    // The numbers on the main band where there is room, white on the dark fills.
    for (const [x0, x1, units, fill] of [[xs.source, xs.station, SOURCE, src.colour], [xs.station, xs.wires, c.toGrid, ELECTRICITY], [xs.wires, xs.bulb, c.delivered, ELECTRICITY]]) {
      if (units * scale < 14) continue;
      const tx = svgEl("text", {x: F((x0 + x1) / 2), y: F(baseY - units * scale / 2 + 4), "font-size": labelFont, "text-anchor": "middle", fill: fill === MID_CARBON ? "#333" : "#fff"}, g);
      tx.textContent = formatUnits(units);
    }

    const what = {coal: "in the coal", gas: "in the gas", nuclear: "in the nuclear fuel", biomass: "in the biomass", geothermal: "in the geothermal steam",
      hydro: "in the falling water", wind: "in the wind through the rotor", solar: "in the sunlight on the panel"}[source];
    // The note under the title states the final numbers at once, while the drawing and the
    // figures on the bands glide to them.
    const f = chain(bulb, efficiency);
    const plural = f.bulbs >= 1.05;
    const carbon = src.burns && src.id !== "nuclear" ? `from burning the ${src.label.toLowerCase()}` : `from building the ${src.station.toLowerCase()}${src.id === "nuclear" ? " and making its fuel" : ""}, spread over its life`;
    subheading.textContent = `Of ${SOURCE} units of energy ${what}, ${formatUnits(f.light)} become light: enough for ${formatBulbs(f.bulbs, b)}, for ${formatCo2(src.co2)} ${carbon}, counting each unit as a megawatt-hour. ` +
      `The ${src.station.toLowerCase()} sends out ${formatUnits(f.toGrid)}, ${formatUnits(f.delivered)} reach the bulb${plural ? "s" : ""}, which turn${plural ? "" : "s"} ${formatUnits(f.heat)} of those into heat.` +
      (src.burns ? "" : " Nothing is burned here: the pale band is energy that simply passes by.");
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
    updateBulbButtons(bulb);
    updateSourceButtons(source);
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
    return {source, bulb, efficiency, co2: sourceOf().co2, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.round(v * 10) / 10]))};
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
function formatUnits(v) {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} unit${r === 1 ? "" : "s"}`;
}
// "33 t CO₂", "0.4 t CO₂".
function formatCo2(t) {
  return `${t >= 10 ? Math.round(t) : t} t CO₂`;
}
// "6 ordinary LED bulbs", "1 incandescent bulb", "14.2 best LED bulbs".
function formatBulbs(n, bulb) {
  const r = Math.round(n * 10) / 10;
  const count = Number.isInteger(r) ? `${r}` : r.toFixed(1);
  return `${count} ${bulb.noun}${r === 1 ? "" : "s"}`;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
