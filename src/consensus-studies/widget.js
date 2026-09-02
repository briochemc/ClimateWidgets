// Studies into scientific agreement on human-caused global warming — a clickable, responsive
// recreation of Skeptical Science's pie-chart graphic
// (https://skepticalscience.com/graphics/studies_consensus.jpg, on
// https://skepticalscience.com/print.php?r=442). Its seven pies are the studies whose authors
// co-wrote the "consensus on consensus" synthesis; three more are added here, all published
// after the graphic was drawn: that synthesis itself (Cook et al. 2016), Myers et al. 2021's
// repeat of the Doran & Zimmerman survey, and Lynas et al. 2021's sweep of the literature.
//
// Every pie is an SVG <a> wrapping the wedge, the percentage and the label, so clicking one —
// or tabbing to it and pressing Enter — opens that paper's DOI in a new tab, and the study's
// precise finding rides along as the link's <title> (the native tooltip) and its aria-label.
// That is the whole interaction: no selection state and no hover highlighting, which this repo
// removed once already for getting stuck on touch devices.
//
// Two deliberate departures from the original: the gap is drawn over a faint full disc, so a
// pie reads as a share of a whole rather than as an oddly bitten circle, and the labels sit
// under the pies instead of inside them — ten pies are smaller than the original's seven, and
// "Stenhouse 2014" in white does not fit inside a 66 px circle. The wedge itself keeps the
// original's geometry: the missing slice straddles the 3 o'clock axis.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page.
//
// Data: src/consensus-studies/data/consensus-studies.csv, hand-curated from the papers.

// Sampled from the original graphic.
const GREEN = "#008137";
const DISC = "#eceff1"; // the "everyone else" remainder behind each wedge
const ACCENT = "#0b57d0"; // focus ring, matching the other widgets' accent

// Chronological, four then three then three — the original's 4+3 arrangement with a row added.
// Rows of three stagger against the row of four on their own, since each row divides the full
// width into its own equal cells.
const ROWS = [4, 3, 3];

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH it
// stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Pre-split rather than wrapped at render time: the height of this band — and so the height of
// the whole figure, which embedding pages hard-code into an iframe — must not depend on width.
const TITLE = ["Studies into scientific agreement", "on human-caused global warming"];
const TITLE_H = 48;
const ROW_H = 150;

// One row per study: the short name and year painted under the pie, the percentage as the
// graphic writes it, the precise value the wedge is drawn from, and the finding and DOI that
// the link carries. pct_display and pct_value differ wherever the graphic rounds (Carlton's
// 96.66% shows as 97%) or a paper reports a range (Anderegg's 97–98%, drawn at its midpoint).
export function parseConsensusStudies(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`consensus-studies CSV: no "${name}" column`);
    return i;
  };
  const cLabel = col("label"), cYear = col("year"), cDisplay = col("pct_display");
  const cValue = col("pct_value"), cStudy = col("study"), cDetail = col("detail"), cUrl = col("url");

  const studies = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    studies.push({
      label: cells[cLabel], year: cells[cYear], display: cells[cDisplay],
      value: Number(cells[cValue]), study: cells[cStudy],
      detail: cells[cDetail], url: cells[cUrl],
    });
  }
  if (!studies.length) throw new Error("consensus-studies CSV: no data rows");
  return studies;
}

export function createConsensusStudiesWidget({data, width = FIGURE_WIDTH}) {
  const studies = data;

  // Vertical layout is fixed at every width, so embed iframe heights stay put; resizing only
  // recomputes the radius, the column centres and the font sizes (applyLayout, below).
  const totalH = TITLE_H + ROWS.length * ROW_H;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, radius, titleFont, pctFont, labelFont;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    // Every pie is the same size, so the tightest row — the four-column one — sets the radius:
    // at 320 px that leaves a 7 px gutter between neighbouring discs.
    radius = lerp(33, 56);
    titleFont = lerp(13, 19);
    pctFont = lerp(15, 27);
    labelFont = lerp(10, 14);
  }
  applyLayout(maxW);

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // No role="img" and no aria-label on the root: this figure is ten labelled links, and that
  // is the structure a screen reader should get, rather than one image description over the top.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "consensus-studies");
  svg.style.display = "block";

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper rather
  // than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const hint = document.createElement("div");
  hint.style.cssText = "padding:8px 0 0;color:#888;font-size:14px;";
  hint.textContent = "Click or tap a pie to open that study in a new tab.";
  container.appendChild(hint);

  function svgEl(tag, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function buildTitle() {
    TITLE.forEach((line, i) => {
      const t = svgEl("text", {
        x: w / 2, y: 18 + i * 22, "text-anchor": "middle", "font-size": titleFont, fill: "#333",
      });
      t.textContent = line;
      svg.appendChild(t);
    });
  }

  // One <a> per study, holding the whole pie: the remainder disc, the wedge, the percentage
  // and the label under it. Everything inside is pointer-transparent to nothing — the link's
  // own box is the hit target, so the label is as clickable as the disc.
  function buildPie(study, cx, cy) {
    const summary = `${study.study}: ${study.detail} Click to open the paper.`;

    const a = svgEl("a", {
      href: study.url, target: "_blank", rel: "noopener",
      "aria-label": summary, tabindex: "0",
    });
    a.style.cursor = "pointer";
    a.style.outline = "none";

    const title = svgEl("title", {});
    title.textContent = summary;
    a.appendChild(title);

    // Drawn but hidden, and shown on focus, so keyboard users can see where they are without
    // the browser's default outline boxing in the whole link including its label.
    const ring = svgEl("circle", {
      cx, cy, r: radius + 5, fill: "none", stroke: hexToRgba(ACCENT, 0.4), "stroke-width": 3,
    });
    ring.style.display = "none";
    a.appendChild(ring);
    a.addEventListener("focus", () => { ring.style.display = ""; });
    a.addEventListener("blur", () => { ring.style.display = "none"; });

    a.appendChild(svgEl("circle", {cx, cy, r: radius, fill: DISC}));

    const d = arcPath(cx, cy, radius, study.value);
    a.appendChild(d === null
      ? svgEl("circle", {cx, cy, r: radius, fill: GREEN})
      : svgEl("path", {d, fill: GREEN}));

    // The percentage sign rides high and small beside the number, as in the original. The run
    // is centred as a whole, which puts the digits a little left of centre — also as in the
    // original, where the wedge is cut out from under the sign's right side.
    const pct = svgEl("text", {
      x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": pctFont, fill: "#fff",
    });
    pct.appendChild(document.createTextNode(study.display));
    const sign = svgEl("tspan", {dy: `-${(pctFont * 0.36).toFixed(1)}`, "font-size": pctFont * 0.55});
    sign.textContent = "%";
    pct.appendChild(sign);
    a.appendChild(pct);

    const label = svgEl("text", {
      x: cx, y: cy + radius + 6 + labelFont, "text-anchor": "middle",
      "font-size": labelFont, fill: "#333",
    });
    label.textContent = `${study.label} ${study.year}`;
    a.appendChild(label);

    svg.appendChild(a);
  }

  function buildAll(newW) {
    applyLayout(newW);
    svg.setAttribute("width", w);
    svg.setAttribute("height", totalH);
    svg.replaceChildren();
    buildTitle();

    // The pie and its label are centred as one block inside the row's fixed band, so the slack
    // that opens up at narrow widths (where the discs shrink but the band does not) is shared
    // above and below rather than pooling under the last row.
    const blockH = 2 * radius + 6 + labelFont;
    let next = 0;
    ROWS.forEach((count, row) => {
      const cellW = w / count;
      const cy = TITLE_H + row * ROW_H + (ROW_H - blockH) / 2 + radius;
      for (let i = 0; i < count && next < studies.length; i++) {
        buildPie(studies[next++], (i + 0.5) * cellW, cy);
      }
    });
  }

  buildAll(maxW);
  container.value = null; // nothing to select: the figure is ten links and no state

  // Reflow with the container; synchronous in the callback, same rationale as the other
  // widgets' observers.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) buildAll(fitted);
    });
    ro.observe(container);
  }

  return container;
}

// The consensus wedge, drawn the way the original graphic draws it: the missing slice is
// centred on the 3 o'clock axis, so the pie is whole at the top and bitten on the right.
// Angles run clockwise on screen from east, which is the direction SVG's sweep flag 1 takes.
function arcPath(cx, cy, r, pct) {
  const frac = clamp(pct / 100, 0, 1);
  // A 100% arc would end where it starts and render nothing; the caller draws a circle instead.
  if (frac >= 0.9995) return null;
  const gapHalf = (1 - frac) * Math.PI;
  const a0 = gapHalf, a1 = 2 * Math.PI - gapHalf;
  const p = a => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M${cx},${cy}L${p(a0)}A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${p(a1)}Z`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
