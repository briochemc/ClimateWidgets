// Atmospheric composition — the air, molecule by molecule, as a 10×10 grid that zooms into
// itself, in the manner of xkcd's "Money" chart. Every square of the first grid is 1% of the
// molecules in dry air; its last square, outlined, is blown up a hundred times to make the
// second grid, where a square is 100 ppm; and so on down to a fourth grid where a square is
// 10 ppb. The point is made by the zoom rather than the numbers: nitrogen and oxygen fill the
// first grid, argon fills the second, and the gases that run the greenhouse effect are the
// small warm-coloured blocks two and three zooms down.
//
// The whole composition is laid out once, gases in descending order of abundance, and each
// grid is the exact crop of the previous grid's last square. Nothing is rounded to make the
// picture tidy: a gas that runs into the last square carries over into the next grid as a
// tail (grid 2 opens with two squares of oxygen, grid 3 with 72 of carbon dioxide), and a gas
// that starts inside the last square is drawn in the next grid instead. The gases are laid
// along a snake, as in the game: it has to end at the bottom-right square, the one every
// level shares, so in a grid of rows it starts at the top right and runs left, then right
// along the next row, and so on down; in a grid of columns it starts at the bottom left and
// runs up, then down the next column, and so on across. A partial square is cut across the
// snake's direction of travel, and the next grid's snake runs the same way as that cut,
// which is what makes the zoom consistent: grid 2 is columns, so the cut of carbon dioxide
// in its last square is the top 72.5% of it, and grid 3, rows, is that square blown up with
// its top 72.5 squares of carbon dioxide. The orientation alternates for that reason.
//
// The zoom is literal. Grid k + 1 is drawn inside grid k's last square at a tenth of the
// scale, four deep, and the zoom is the SVG's viewBox (viewBox, below), a window onto that
// one drawing. Because every last square is the bottom-right square, every grid's
// bottom-right corner is the same point, and the window only ever shrinks or grows about
// that corner, eased in the exponent so that the motion looks steady. The viewBox rather
// than a transform on a group because browsers composite a transformed group as a bitmap
// while it animates and scale that, which blurs; a change of viewBox re-renders the vectors
// at the new scale every frame.
//
// From the second level down the grid is drawn a little inset from the top and left of the
// viewport, so a strip of the big squares it sits among stays in view as a reminder of
// where you are. Lattice, outlines and dashed squares are drawn at screen width whatever
// the zoom, and the outlines in a layer of their own above every lattice. A level's labels and its dashed square fade in as it comes within one zoom of
// the view and out again as it leaves; its lattice and outlines fade in the same way but
// stay once the view has gone past it. A gas's outline is one exact shape across levels
// (blockRects), drawn at the first level the gas appears in. The fills are always drawn,
// which is what makes the last square a miniature of the next grid before you zoom into it.
//
// Every number comes from data/composition.json: the dry-air mole fractions, with nitrogen
// as the remainder so that the total is exactly a million ppm, the 1750 values that split the
// CO₂, CH₄ and N₂O blocks into a pre-industrial part and a darker part added since, and the
// global-mean water vapour that the toggle mixes in. The geometry is computed from those
// (composition, gridLevels), and both are exported so the page can print the same numbers
// the figure is drawn with.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.

const PPM = 1e6;
const SQUARES = 100;
const MAX_LEVELS = 6; // a safety stop; the data as shipped needs four

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const VIEW_MAX = 480;  // the viewport's side, px; narrower figures shrink it
const INSET = 0.12;    // from level 2 down, the share of the viewport left to the parent's squares
const ZOOM_MS = 1100;  // one level of zoom
const BLEED = 4;       // px the drawing may show beyond the viewport, for outlines on its edge
const ACCENT = "#0b57d0";

// The snake runs along rows at level 1, columns at level 2, rows at level 3, and so on
// (rowMajor, below), always ending at the bottom-right corner, so the parent's squares show
// above and to the left. See squarePos.
const rowMajor = i => i % 2 === 0;

// Greenhouse gases in one warm family, everything else in cool greys and blues, so that the
// climate-active gases can be picked out without reading a label. The three long-lived
// greenhouse gases we add to have a second, darker shade for the part added since 1750.
export const COLOURS = {
  N2: {fill: "#dcdfe4"},
  O2: {fill: "#b3c6d9"},
  Ar: {fill: "#849fba"},
  Ne: {fill: "#bccbd9"},
  He: {fill: "#8fa9c1"},
  Kr: {fill: "#cbd6e0"},
  H2: {fill: "#a3b8cb"},
  Xe: {fill: "#7290ab"},
  H2O: {fill: "#f2a97e"},
  CO2: {fill: "#f5c07d", added: "#e5862f"},
  CH4: {fill: "#f4a094", added: "#d9503d"},
  N2O: {fill: "#dcaacd", added: "#b45f9c"},
  O3: {fill: "#f1d675"},
};
const FALLBACK_FILL = "#c0c8d0";

// ---- the numbers -------------------------------------------------------------------------------

// The gases in descending order of abundance, each with its mole fraction in ppm and its
// [start, end) position in the fill of the whole atmosphere, which runs from 0 to a million
// ppm. The remainder gas (nitrogen) is whatever the others leave, so the total is exact. With
// water vapour the dry fractions are scaled down by (1 − w) and water is inserted where its
// abundance puts it, so the total is still a million.
export function composition(data, {waterVapour = false} = {}) {
  const gases = data.gases.map(g => ({...g}));
  const known = gases.filter(g => !g.remainder).reduce((s, g) => s + g.ppm, 0);
  for (const g of gases) if (g.remainder) g.ppm = PPM - known;
  if (waterVapour && data.waterVapour) {
    const w = data.waterVapour.ppm, k = 1 - w / PPM;
    for (const g of gases) {
      g.ppm *= k;
      if (g.ppm1750 != null) g.ppm1750 *= k;
    }
    gases.push({...data.waterVapour, ppm: w});
  }
  gases.sort((a, b) => b.ppm - a.ppm);
  let pos = 0;
  for (const g of gases) {
    g.start = pos;
    pos += g.ppm;
    g.end = pos;
  }
  gases[gases.length - 1].end = PPM; // the sum is a million by construction; drop the rounding
  return {gases, waterVapour: !!(waterVapour && data.waterVapour), asOf: data.asOf};
}

// Grid k is the last square of grid k − 1 blown up a hundred times: a square is
// 10⁴/100^(k−1) ppm and the grid covers the last 100 squares' worth of the fill. A gas is
// drawn in a grid if it starts before the grid's last square; those that start inside it are
// too small for this grid and make up "the rest", which the next grid resolves. The last
// grid is the first with no rest.
export function gridLevels(comp, maxLevels = MAX_LEVELS) {
  const levels = [];
  for (let k = 1; k <= maxLevels; k++) {
    const unit = 1e4 / 100 ** (k - 1);
    const origin = PPM - SQUARES * unit;
    const regions = [];
    let rest = null;
    for (const g of comp.gases) {
      if (g.end <= origin + 1e-9) continue;
      const from = Math.max(0, (g.start - origin) / unit);
      const to = Math.min(SQUARES, (g.end - origin) / unit);
      if (from >= SQUARES - 1 - 1e-9) {
        rest ??= {from, to, gases: []};
        rest.to = to;
        rest.gases.push(g);
        continue;
      }
      const region = {gas: g, from, to, tail: g.start < origin - 1e-9};
      if (g.ppm1750 != null) region.split = clamp((g.start + g.ppm1750 - origin) / unit, from, to);
      regions.push(region);
    }
    levels.push({level: k, unit, origin, regions, rest});
    if (!rest) break;
  }
  return levels;
}

// ---- the geometry of an interval of the fill --------------------------------------------------
// Squares are numbered 0–99 along the snake. Row-major: rows from the top, the first running
// right to left and each the opposite way to the one above, so the last row runs left to
// right and ends at the bottom-right corner. Column-major: the transpose, columns from the
// left, the first running bottom to top, the last running down to the same corner. Within a
// square the fill runs the way the snake does, so a partial square is cut across that
// direction: a vertical cut in a row, a horizontal one in a column.
const EPS = 1e-9;

// Square s: its column and row, and the direction of travel along its line, +1 for left to
// right (or downward), −1 for the reverse.
function squarePos(s, rowMajor) {
  const line = Math.floor(s / 10), u = s - 10 * line;
  const forward = line % 2 === 1;
  const along = forward ? u : 9 - u;
  return rowMajor ? {x: along, y: line, dir: forward ? 1 : -1} : {x: line, y: along, dir: forward ? 1 : -1};
}

// An interval [a, b) of the fill, in squares, as axis-aligned rectangles in square units:
// the whole squares line by line, plus the cut part of a square at either end where the
// interval starts or ends part-way through one.
function pieces(a, b, rowMajor) {
  const out = [];
  if (!(b > a + EPS)) return out;
  const sa = Math.floor(a + EPS), sb = Math.floor(b - EPS);
  const fa = a - sa, fb = b - sb;
  // The part of square s from fraction p to q of the way along its line of travel.
  const part = (s, p, q) => {
    const {x, y, dir} = squarePos(s, rowMajor);
    const [lo, hi] = dir > 0 ? [p, q] : [1 - q, 1 - p];
    out.push(rowMajor ? {x0: x + lo, x1: x + hi, y0: y, y1: y + 1} : {x0: x, x1: x + 1, y0: y + lo, y1: y + hi});
  };
  if (sa === sb) {
    part(sa, fa, fb);
    return out;
  }
  if (fa > EPS) part(sa, fa, 1);
  const w0 = fa > EPS ? sa + 1 : sa, w1 = fb > 1 - EPS ? sb + 1 : sb;
  for (let line = Math.floor(w0 / 10); line * 10 < w1; line++) {
    const lo = Math.max(w0, line * 10) - line * 10, hi = Math.min(w1, line * 10 + 10) - line * 10;
    if (hi <= lo) continue;
    const [p, q] = line % 2 === 1 ? [lo, hi] : [10 - hi, 10 - lo];
    out.push(rowMajor ? {x0: p, x1: q, y0: line, y1: line + 1} : {x0: line, x1: line + 1, y0: p, y1: q});
  }
  if (fb < 1 - EPS) part(sb, 0, fb);
  return out;
}

function rectsPath(rects, cell) {
  const P = v => (v * cell).toFixed(2);
  return rects.map(r => `M${P(r.x0)},${P(r.y0)}H${P(r.x1)}V${P(r.y1)}H${P(r.x0)}Z`).join("");
}

// The outline of a union of rectangles, as the parts of their edges that no other rectangle
// of the set lies against. Drawn as separate segments with square caps, which close the
// corners. Edges on the grid's outer boundary are pushed outward by `over` (in squares):
// the right and bottom always, since they are the edge of the view at every zoom, and the
// top and left only where asked, at the first level, where they are the edge of the view
// too; deeper down they sit under the parent's lattice line, like any inner edge.
function outlinePath(rects, cell, over = 0, outerTopLeft = false) {
  const P = v => (v * cell).toFixed(2);
  const push = v => (v >= 10 - EPS ? v + over : v <= EPS && outerTopLeft ? v - over : v);
  let d = "";
  const segments = (lo, hi, covers) => {
    const parts = [[lo, hi]];
    for (const [c0, c1] of covers) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const [p0, p1] = parts[i];
        if (c1 <= p0 + EPS || c0 >= p1 - EPS) continue;
        parts.splice(i, 1);
        if (c0 > p0 + EPS) parts.push([p0, c0]);
        if (c1 < p1 - EPS) parts.push([c1, p1]);
      }
    }
    return parts;
  };
  for (const r of rects) {
    const others = rects.filter(o => o !== r);
    for (const [x, side] of [[r.x0, "x1"], [r.x1, "x0"]]) {
      const covers = others.filter(o => Math.abs(o[side] - x) < EPS).map(o => [o.y0, o.y1]);
      for (const [y0, y1] of segments(r.y0, r.y1, covers)) d += `M${P(push(x))},${P(y0)}V${P(y1)}`;
    }
    for (const [y, side] of [[r.y0, "y1"], [r.y1, "y0"]]) {
      const covers = others.filter(o => Math.abs(o[side] - y) < EPS).map(o => [o.x0, o.x1]);
      for (const [x0, x1] of segments(r.x0, r.x1, covers)) d += `M${P(x0)},${P(push(y))}H${P(x1)}`;
    }
  }
  return d;
}

// Where a region's label goes: the middle of its block of full lines (rows or columns) if
// it has any, else the middle of its largest rectangle. Returns the spot and the room
// around it, in squares.
function labelSpot(rects, rowMajor) {
  const full = rowMajor
    ? rects.filter(r => r.x0 <= EPS && r.x1 >= 10 - EPS && r.y1 - r.y0 >= 1 - EPS)
    : rects.filter(r => r.y0 <= EPS && r.y1 >= 10 - EPS && r.x1 - r.x0 >= 1 - EPS);
  if (full.length) {
    if (rowMajor) {
      const y0 = Math.min(...full.map(r => r.y0)), y1 = Math.max(...full.map(r => r.y1));
      return {x: 5, y: (y0 + y1) / 2, w: 10, h: y1 - y0};
    }
    const x0 = Math.min(...full.map(r => r.x0)), x1 = Math.max(...full.map(r => r.x1));
    return {x: (x0 + x1) / 2, y: 5, w: x1 - x0, h: 10};
  }
  const area = r => (r.x1 - r.x0) * (r.y1 - r.y0);
  const best = rects.reduce((a, b) => (area(b) > area(a) ? b : a));
  return {x: (best.x0 + best.x1) / 2, y: (best.y0 + best.y1) / 2, w: best.x1 - best.x0, h: best.y1 - best.y0};
}

const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

export function createAtmosphericCompositionWidget({data, width = FIGURE_WIDTH, waterVapour = false, level = 1} = {}) {
  if (!data?.gases) throw new Error("createAtmosphericCompositionWidget needs {data}: the contents of data/composition.json");
  const uid = `atmospheric-composition-${++instances}`;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  // ---- state ------------------------------------------------------------------------------------
  let water = !!waterVapour;
  let comp, levels;
  function recompute() {
    comp = composition(data, {waterVapour: water});
    levels = gridLevels(comp);
  }
  recompute();
  let selected = null; // a gas id or null
  // The zoom, as a continuous level: 1 is the first grid filling the viewport, 2 the second,
  // and 1.5 is halfway through the zoom between them. `zTarget` is where it is heading.
  let z = clamp(Math.round(level) || 1, 1, levels.length), zTarget = z;
  let zoom = null, raf = null; // the animation in flight
  let grids = []; // per level: its groups, rebuilt with the layout

  // ---- layout -----------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  // Every grid is drawn V px square in its own coordinates, which are the viewport's at
  // level 1. From level 2 down the grid shows G px square, inset by M from the top and left.
  let w, V, M, G, cell, latticeW, labelFont;
  function applyLayout(newW) {
    w = newW;
    V = Math.min(VIEW_MAX, w);
    M = Math.round(INSET * V);
    G = V - M;
    cell = V / 10;
    latticeW = clamp(cell * 0.09, 1.5, 4); // the white gap between squares, screen px
    labelFont = clamp(Math.round(cell * 0.4), 10, 18);
  }
  applyLayout(maxW);
  // The last square, in a grid's own pixels: the bottom-right square whichever way the grid
  // fills, so its bottom-right corner is the grid's, and, by nesting, every grid's: the
  // point the zoom is anchored on.
  const doorX = () => 9 * cell;
  const doorY = () => 9 * cell;

  // ---- DOM --------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;" +
    "padding:0 0 8px;font-size:13px;";
  container.appendChild(controls);

  const waterField = document.createElement("label");
  waterField.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;color:#333;";
  const waterInput = document.createElement("input");
  waterInput.type = "checkbox";
  waterInput.checked = water;
  waterInput.style.cssText = "margin:0;accent-color:" + ACCENT + ";";
  const waterText = document.createElement("span");
  waterText.textContent = `Add water vapour (${formatShort(data.waterVapour?.ppm ?? 0)}, the global mean)`;
  waterField.append(waterInput, waterText);
  waterInput.addEventListener("change", () => { stopTour(); setWater(waterInput.checked); });
  // The box's own event stops here; the widget emits "input" itself when the state changes.
  waterInput.addEventListener("input", e => e.stopPropagation());
  controls.appendChild(waterField);

  const buttonCss =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";
  const buttonBar = document.createElement("div");
  buttonBar.style.cssText = "display:flex;align-items:center;gap:6px;margin-left:auto;";
  const makeButton = text => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = buttonCss;
    buttonBar.appendChild(b);
    return b;
  };
  const zoomOutButton = makeButton("Zoom out");
  const zoomInButton = makeButton("Zoom in");
  const tourButton = makeButton("Play tour");
  zoomOutButton.addEventListener("click", () => { stopTour(); zoomTo(zTarget - 1); });
  zoomInButton.addEventListener("click", () => { stopTour(); zoomTo(zTarget + 1); });
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  controls.appendChild(buttonBar);

  // The title is HTML, above the SVG, so that the SVG holds nothing but the zooming drawing.
  const title = document.createElement("div");
  title.style.cssText = "text-align:center;font-weight:bold;font-size:14px;color:#333;padding:0 0 6px;";
  container.appendChild(title);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "atmospheric-composition");
  svg.setAttribute("role", "img");
  // Outlines on the grid's outer edges sit just outside it, so the SVG is allowed to show
  // that far beyond its box: overflow visible, clipped again at BLEED px out.
  svg.style.cssText = `display:block;margin:${BLEED}px auto;outline:none;overflow:visible;clip-path:inset(-${BLEED}px);`;
  svg.tabIndex = 0;
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
  const HINT_IDLE =
    "Click the dashed square to zoom into it, or a block for its share. " +
    "The darker part of a CO₂, CH₄ or N₂O block is what has been added since 1750.";
  const HINT_TOUR = "Touring the grids — click anything to take over; Play tour starts it again.";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }
  const halo = {stroke: "#fff", "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};

  // ---- building the figure -------------------------------------------------------------------
  function build() {
    svg.setAttribute("width", V);
    svg.setAttribute("height", V);
    svg.replaceChildren();
    svgEl("rect", {width: V, height: V, fill: "#fff"}, svg);

    // Each grid is drawn inside its parent's last square at a tenth of the scale, so the
    // tree of groups is the picture at every zoom at once.
    grids = [];
    let parent = svg;
    levels.forEach((level, i) => {
      const g = svgEl("g", {"data-level": i}, parent);
      const state = drawGrid(level, i, g);
      grids.push(state);
      if (state.nest) parent = state.nest;
    });
    // Outlines live in their own tree above every level's lattice, nested the same way, so
    // that a parent's lattice line along a child's edge never paints over the child's
    // outline. Their paths are set in applyZoom, since the outward push of their outer
    // edges is a screen distance.
    let outlineParent = svg;
    grids.forEach(state => {
      const branch = svgEl("g", {fill: "none", stroke: "none", "stroke-linecap": "square", "pointer-events": "none"}, outlineParent);
      // The level's own paths in a group of their own, so that hiding them when the level
      // is off-screen leaves the deeper levels nested beside them visible.
      state.outlines = svgEl("g", {}, branch);
      for (const block of state.blocks) {
        block.el = svgEl("path", {"data-outline": block.id, "vector-effect": "non-scaling-stroke"}, state.outlines);
      }
      if (state.nest) outlineParent = svgEl("g", {transform: `translate(${doorX().toFixed(2)},${doorY().toFixed(2)}) scale(0.1)`}, branch);
    });
    applyZoom();
    updateSelection();
  }

  // The colour runs of a region: one, or two when it is split at its 1750 amount.
  function regionParts(region) {
    const base = COLOURS[region.gas.id]?.fill ?? FALLBACK_FILL;
    if (region.split != null && region.split < region.to - EPS) {
      return [[region.from, region.split, base], [region.split, region.to, COLOURS[region.gas.id]?.added ?? base]];
    }
    return [[region.from, region.to, base]];
  }

  // A grid in its own pixels (0 to G), in group `g`. Returns the parts the zoom drives: the
  // fills, the detail that fades with distance from the view, the last square's click
  // target, and the group the next grid is nested in.
  function drawGrid(level, i, g) {
    const state = {level};
    const hasNext = level.rest && i + 1 < levels.length;

    // Fills: one group per gas so a click anywhere on the gas finds it. A split region is
    // the pre-industrial part in the base colour and the part added since in the darker one.
    state.fills = svgEl("g", {}, g);
    for (const region of level.regions) {
      const rg = svgEl("g", {"data-gas": region.gas.id, style: "cursor:pointer"}, state.fills);
      for (const [a, b, fill] of regionParts(region)) {
        const d = rectsPath(pieces(a, b, rowMajor(i)), cell);
        if (d) svgEl("path", {d, fill}, rg);
      }
    }
    // Whatever starts inside the last square is the next grid's business; it is drawn
    // there, over this, at a tenth of the scale.
    if (hasNext) {
      state.nest = svgEl("g", {transform: `translate(${doorX().toFixed(2)},${doorY().toFixed(2)}) scale(0.1)`}, g);
    }

    state.detail = svgEl("g", {}, g);

    // The squares themselves: a white lattice over the fills, wide enough to read as gaps
    // between separate squares, so a block reads as a count of squares and not just an area.
    let lattice = "";
    for (let k = 1; k < 10; k++) {
      const p = (k * cell).toFixed(2);
      lattice += `M${p},0V${V}M0,${p}H${V}`;
    }
    const screenStroke = {"vector-effect": "non-scaling-stroke"};
    svgEl("path", {d: lattice, stroke: "#fff", "stroke-width": latticeW.toFixed(2), fill: "none", "pointer-events": "none", ...screenStroke}, state.detail);

    // Blocks are told apart by colour alone; the only outline drawn is the selected one's
    // (updateSelection), so the outline paths are invisible until then. A block is outlined
    // once, at the first level it appears in, as one exact shape that includes its
    // continuation into the levels below (blockRects), and is then only ever scaled with
    // the zoom. The paths themselves are made in build, in the outline layer.
    state.blocks = level.regions.filter(r => !r.tail).map(r => ({id: r.gas.id, rects: blockRects(i, r.gas.id)}));

    // Labels: the formula, where it fits, haloed in white since the lattice's white gaps
    // run under the letters. In their own group: they fade out both ways, while the
    // lattice and outlines stay once the view has zoomed past their level.
    state.labels = svgEl("g", {"pointer-events": "none"}, g);
    const labels = state.labels;
    for (const region of level.regions) {
      const spot = labelSpot(pieces(region.from, region.to, rowMajor(i)), rowMajor(i));
      const {formula} = region.gas;
      if (2 * labelHalfWidth(formula, labelFont) > spot.w * cell - 4 || spot.h * cell < labelFont) continue;
      const t = svgEl("text", {
        x: (spot.x * cell).toFixed(1), y: (spot.y * cell).toFixed(1), "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": labelFont, "font-weight": "bold", fill: "#222", ...halo,
      }, labels);
      t.textContent = formula;
    }

    // The last square is the door to the next grid: outlined, and a click target. Its outer
    // edges are the grid's own and its inner edges are under the lattice; the dashed outline
    // runs down the middle of the lattice on the inner sides and the same distance outside
    // the grid on the outer ones, so the margin is even all round.
    if (hasNext) {
      const x = doorX(), y = doorY(), over = latticeW / 2;
      // With the labels, not the lattice: the dashed square marks where to click at the
      // current level only, and goes once you are inside it.
      svgEl("rect", {
        x, y, width: (cell + over).toFixed(2), height: (cell + over).toFixed(2),
        fill: "none", stroke: "#222", "stroke-width": 1.5, "stroke-dasharray": "3 2", ...screenStroke,
      }, state.labels);
      const pad = 0.2 * cell;
      state.door = svgEl("rect", {
        x: x - pad, y: y - pad, width: cell + 2 * pad, height: cell + 2 * pad, fill: "transparent",
        "data-door": i, style: "cursor:zoom-in",
      }, g);
    }
    return state;
  }

  // A gas's block at level i as rectangles in that level's squares, with the slice inside
  // the last square replaced by the block's continuation in the next level, mapped into
  // that square at a tenth of the scale, and so on down. The outline of this union is the
  // block's true boundary at every zoom: the straight cut across the last square gives way
  // to the finer staircase inside it.
  function blockRects(i, gasId) {
    const region = levels[i]?.regions.find(r => r.gas.id === gasId);
    if (!region) return [];
    const spills = levels[i + 1] && region.to > SQUARES - 1 + EPS;
    const rects = pieces(region.from, spills ? SQUARES - 1 : region.to, rowMajor(i));
    if (spills) {
      for (const r of blockRects(i + 1, gasId)) {
        rects.push({x0: 9 + r.x0 / 10, x1: 9 + r.x1 / 10, y0: 9 + r.y0 / 10, y1: 9 + r.y1 / 10});
      }
    }
    return rects;
  }

  // ---- the zoom ---------------------------------------------------------------------------------
  // Level k fills the viewport at level 1 and shows G px square from level 2 down, so its
  // scale, viewport px per level-1 px, is 1 or (G/V)·10^(k−1). Between levels the scale runs
  // geometrically, which keeps the zoom at a steady pace, and the window always ends at the
  // bottom-right corner, the one point every grid has in common.
  const levelScale = k => (k <= 1 ? 1 : (G / V) * 10 ** (k - 1));

  // The window onto the drawing at level z: V/s of level 1's pixels a side, ending at the
  // shared bottom-right corner.
  // Screen px per level-1 px at level z.
  function viewScale(z) {
    const k = Math.min(Math.floor(z + 1e-9), levels.length), t = Math.max(0, z - k);
    return k >= levels.length ? levelScale(k) : Math.exp((1 - t) * Math.log(levelScale(k)) + t * Math.log(levelScale(k + 1)));
  }

  function viewBox(z) {
    const side = V / viewScale(z);
    return `${(V - side).toFixed(4)} ${(V - side).toFixed(4)} ${side.toFixed(4)} ${side.toFixed(4)}`;
  }

  function applyZoom() {
    svg.setAttribute("viewBox", viewBox(z));
    const k = Math.floor(z + 1e-9);
    const scale = viewScale(z);
    grids.forEach((s, idx) => {
      const j = idx + 1;
      // The level above the view still shows in the strip around the grid; anything higher
      // is off-screen and hidden, except for the levels nested inside it, which live in
      // their own groups.
      const shown = j >= k - 1;
      s.fills.style.display = shown ? "" : "none";
      s.detail.style.display = shown ? "" : "none";
      s.labels.style.display = shown ? "" : "none";
      s.outlines.style.display = shown ? "" : "none";
      const stays = clamp(1 - Math.max(0, j - z), 0, 1).toFixed(3);
      s.detail.setAttribute("opacity", stays);
      s.outlines.setAttribute("opacity", stays);
      s.labels.setAttribute("opacity", clamp(1 - Math.abs(z - j), 0, 1).toFixed(3));
      // The outer edges of an outline sit half a lattice width outside the grid, like the
      // dashed square: a screen distance, so in this level's squares it depends on the zoom.
      const over = latticeW / 2 / (scale * 0.1 ** (j - 1)) / cell;
      for (const block of s.blocks) block.el.setAttribute("d", outlinePath(block.rects, cell, over, j === 1));
      // Clicking the parent's squares in the strip zooms back out to them.
      s.fills.style.cursor = j < Math.round(z) ? "zoom-out" : "pointer";
      if (s.door) s.door.style.display = Math.abs(z - j) < 1e-6 ? "" : "none";
    });
    const near = clamp(Math.round(z), 1, levels.length);
    title.textContent = `1 square = ${formatUnit(levels[near - 1].unit)}`;
    zoomOutButton.disabled = zTarget <= 1;
    zoomInButton.disabled = zTarget >= levels.length;
    for (const b of [zoomOutButton, zoomInButton]) {
      b.style.opacity = b.disabled ? 0.45 : 1;
      b.style.cursor = b.disabled ? "default" : "pointer";
    }
  }

  // Glide to an integer level, at ZOOM_MS per level so that a zoom of several levels moves
  // at the same pace as one.
  function zoomTo(target) {
    target = clamp(Math.round(target), 1, levels.length);
    if (target === zTarget && (zoom || target === z)) return;
    zTarget = target;
    updateStatus();
    emit();
    if (reduceMotion) {
      zoom = null;
      z = target;
      applyZoom();
      return;
    }
    zoom = {from: z, to: target, start: performance.now(), duration: ZOOM_MS * Math.abs(target - z)};
    if (raf === null) raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = null;
    if (container.isConnected === false) return; // a re-run cell left this widget behind
    if (!zoom) return;
    const p = zoom.duration > 0 ? clamp((now - zoom.start) / zoom.duration, 0, 1) : 1;
    z = zoom.from + (zoom.to - zoom.from) * easeInOutCubic(p);
    if (p >= 1) {
      z = zoom.to;
      zoom = null;
    }
    applyZoom();
    if (zoom) raf = requestAnimationFrame(frame);
  }

  // ---- selection and read-out ---------------------------------------------------------------
  const airWord = () => (water ? "the air, water vapour included" : "dry air");

  function describe(id) {
    if (id === null) {
      return {
        head: water ? "The air, water vapour included. " : `Dry air, ${comp.asOf}. `,
        body: "Shares by number of molecules. Each grid is the last square of the one before, blown up a hundred times.",
      };
    }
    const gas = comp.gases.find(g => g.id === id);
    if (!gas) return describe(null);
    return {
      head: `${gas.name}. `,
      body: `${gas.approximate ? "About " : ""}${formatShareLong(gas.ppm)} of ${airWord()}.` +
        (gas.greenhouse ? " Greenhouse gas." : ""),
    };
  }

  function updateStatus() {
    const {head, body} = describe(selected);
    statusHead.textContent = head;
    statusBody.textContent = body;
    svg.setAttribute("aria-label",
      `The composition of ${airWord()} as a grid that zooms into its own last square, ${levels.length} levels deep; ` +
      `at level ${zTarget} a square is ${formatUnit(levels[zTarget - 1].unit)}. ${head}${body}`);
  }

  function updateSelection() {
    for (const el of svg.querySelectorAll("[data-outline]")) {
      const on = el.getAttribute("data-outline") === selected;
      el.setAttribute("stroke-width", on ? 2.5 : 0);
      el.setAttribute("stroke", on ? "#111" : "none");
    }
    updateStatus();
  }

  function select(id) {
    if (id === selected) return;
    selected = id;
    updateSelection();
    emit();
  }

  // ---- water vapour -------------------------------------------------------------------------
  function setWater(on) {
    on = !!on;
    if (on === water) return;
    water = on;
    waterInput.checked = on;
    recompute();
    zTarget = clamp(zTarget, 1, levels.length);
    if (!zoom) z = zTarget;
    if (selected === data.waterVapour?.id && !on) selected = null;
    build();
    emit();
  }

  // ---- input ----------------------------------------------------------------------------------
  svg.addEventListener("click", e => {
    const target = e.target instanceof Element ? e.target : null;
    const door = target?.closest("[data-door]");
    const gas = target?.closest("[data-gas]");
    if (!door && !gas) return;
    stopTour();
    svg.focus();
    if (door) return zoomTo(Number(door.getAttribute("data-door")) + 2);
    const j = Number(gas.closest("[data-level]")?.getAttribute("data-level") ?? 0) + 1;
    if (j < Math.round(z)) zoomTo(j);
    else select(gas.getAttribute("data-gas"));
  });

  svg.addEventListener("keydown", e => {
    let target;
    if (e.key === "+" || e.key === "=" || e.key === "ArrowDown") target = zTarget + 1;
    else if (e.key === "-" || e.key === "_" || e.key === "ArrowUp") target = zTarget - 1;
    else if (e.key === "Home") target = 1;
    else if (e.key === "End") target = levels.length;
    else return;
    e.preventDefault();
    stopTour();
    zoomTo(target);
  });

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    return {level: zTarget, selected, waterVapour: water, levels: levels.length};
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  build();
  container.value = value();

  // Reflow with the container; a detached or hidden container measures zero, which is not
  // "no room". Resizing never emits "input": nothing about the state changes.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); build(); }
    });
    ro.observe(container);
  }

  // ---- tour ------------------------------------------------------------------------------------
  // Left alone, the figure zooms in a level at a time, resting on the greenhouse gas each
  // level reveals, then zooms all the way back out and goes round again. It stops at the
  // first click, because a figure that keeps moving under your cursor is maddening, and the
  // Play tour button brings it back. Same manners as the black-body widget's tour.
  const TOUR_HOLD = 2600;
  let touring = false, tourTimer = null, tourWatcher = null;

  // The greenhouse gas grid k is there to show: the widest one that is not a tail.
  function showcase(level) {
    const own = level.regions.filter(r => r.gas.greenhouse && !r.tail);
    const pool = own.length ? own : level.regions;
    return pool.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a), pool[0])?.gas.id ?? null;
  }

  // Step k − 2 zooms to level k (k ≥ 2); the last step zooms back out to level 1.
  function tourStep(i) {
    if (!touring) return;
    if (container.isConnected === false) return stopTour();
    const N = levels.length;
    const from = z;
    let to;
    if (i < N - 1) {
      to = i + 2;
      zoomTo(to);
      select(showcase(levels[to - 1]));
    } else {
      to = 1;
      select(null);
      zoomTo(1);
    }
    const glide = reduceMotion ? 0 : ZOOM_MS * Math.abs(to - from);
    tourTimer = setTimeout(() => tourStep((i + 1) % N), glide + TOUR_HOLD);
  }

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
    hint.textContent = HINT_IDLE;
    showTouring();
  }

  function showTouring() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }

  // `delay` is the pause before the first move: a rest on the opening frame when the tour
  // starts by itself, none when the reader has just asked for it.
  function startTour(delay = TOUR_HOLD) {
    if (touring) return;
    tourWatcher?.disconnect();
    tourWatcher = null;
    touring = true;
    hint.textContent = HINT_TOUR;
    showTouring();
    // Pick up from the next level down, or zoom back out if already at the bottom.
    const next = zTarget >= levels.length ? levels.length - 1 : zTarget - 1;
    tourTimer = setTimeout(() => tourStep(next), delay);
  }

  // Not under reduced motion (an unrequested animation, and what keeps the thumbnail capture
  // on the opening frame), and not before the figure has scrolled into view.
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

// ---- formatting -------------------------------------------------------------------------------

// What a square is worth: "1%", "100 ppm", "1 ppm", "10 ppb", "0.1 ppb".
export function formatUnit(ppm) {
  if (ppm >= 1e4) return `${tidy(ppm / 1e4)}%`;
  if (ppm >= 1) return `${tidy(ppm)} ppm`;
  if (ppm >= 1e-3) return `${tidy(ppm * 1e3)} ppb`;
  return `${tidy(ppm * 1e6)} ppt`;
}

// A short amount: percent above 1000 ppm, else ppm, else ppb.
export function formatShort(ppm) {
  if (ppm >= 1e3) return `${formatPercent(ppm)}`;
  if (ppm >= 1) return `${formatPpm(ppm)} ppm`;
  return `${formatPpm(ppm * 1e3)} ppb`;
}

// The read-out's version: the typical unit first, the percentage in brackets.
function formatShareLong(ppm) {
  if (ppm >= 1e3) return `${formatPercent(ppm)} (${formatPpm(ppm)} ppm)`;
  if (ppm >= 1) return `${formatPpm(ppm)} ppm (${formatPercent(ppm)})`;
  return `${formatPpm(ppm * 1e3)} ppb (${formatPercent(ppm)})`;
}

// Two significant figures throughout: 78%, 21%, 0.93%, 420 ppm, 1.9 ppm, 530 ppb.
function formatPercent(ppm) {
  return `${Number((ppm / 1e4).toPrecision(2))}%`;
}

function formatPpm(v) {
  return Number(v.toPrecision(2)).toLocaleString("en-US", {maximumFractionDigits: 6});
}

function tidy(v) {
  return Number(v.toPrecision(6)).toLocaleString("en-US", {maximumFractionDigits: 6});
}

// ---- small helpers ----------------------------------------------------------------------------

// Estimated, not measured: getBBox forces layout, and this runs for every label on every build.
function labelHalfWidth(text, fontSize) {
  return (text.length * fontSize * 0.56) / 2;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function easeInOutCubic(s) {
  return s < 0.5 ? 4 * s * s * s : 1 - (-2 * s + 2) ** 3 / 2;
}
