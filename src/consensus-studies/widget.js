// Studies into scientific agreement on human-caused global warming — one study at a time,
// picked with the pill buttons, after Skeptical Science's pie-chart graphic
// (https://skepticalscience.com/graphics/studies_consensus.jpg, on
// https://skepticalscience.com/print.php?r=442). That graphic's seven pies are the studies
// synthesised by Cook et al. (2016); three more are shown here, all published after it was
// drawn: the synthesis itself, Myers et al. 2021's repeat of the Doran & Zimmerman survey,
// and Lynas et al. 2021's sweep of the literature.
//
// The original prints all seven pies side by side, which makes its point by repetition. One
// large pie makes a different one: switching between studies holds the wedge in place and
// animates only the sliver, so a decade of independent surveys visibly lands on the same
// answer. The pie is also a link — clicking it, or the citation under the figure, opens that
// paper's DOI in a new tab.
//
// Self-contained on purpose — no d3, no other imports — so the script-tag embed on the
// widget's page is a single ES module import that works from any page. The wedge is one
// hand-rolled SVG arc (arcPath, below), tweened on a rAF loop rather than a CSS transition,
// since neither a path's `d` nor an arc's sweep is CSS-animatable.
//
// Data: src/consensus-studies/data/consensus-studies.csv, hand-curated from the papers.

// Sampled from the original graphic.
const GREEN = "#008137";
const DISC = "#eceff1"; // the "everyone else" remainder behind each wedge
const BACKGROUND = "#f2f2f2"; // the plate the map widgets and hickman sit on

const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;
// Constant at every width, like leiserowitz and hickman — embed iframe heights stay put.
const FIGURE_HEIGHT = 340;

const TRANSITION = "480ms ease"; // buttons, matching hickman
const TWEEN_MS = 520; // the wedge sweep between studies

// Pre-split rather than wrapped at render time, so the title band's height — and with it the
// height of the whole figure — does not depend on width.
const TITLE = ["Scientific agreement on", "human-caused global warming"];

// The widget opens here rather than on the first button: Cook et al. 2013 is the study the
// "97%" figure comes from, and its wedge is actually visible, unlike Oreskes' full circle.
// Reduced motion pins the opening frame, which is what keeps the thumbnail deterministic.
const DEFAULT_STUDY = "Cook et al. 2013";

const SVGNS = "http://www.w3.org/2000/svg";

// One row per study: the short name and year for the button and the label under the pie, the
// percentage as the graphic writes it, the precise value the wedge is drawn from, and the
// citation, finding and DOI for the panel underneath. pct_display and pct_value differ
// wherever the graphic rounds (Carlton's 96.7% shows as 97%) or a paper reports a range
// (Anderegg's 97–98%, drawn at its midpoint).
export function parseConsensusStudies(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`consensus-studies CSV: no "${name}" column`);
    return i;
  };
  const cLabel = col("label"), cYear = col("year"), cDisplay = col("pct_display");
  const cValue = col("pct_value"), cStudy = col("study"), cTitle = col("title");
  const cJournal = col("journal"), cDetail = col("detail"), cUrl = col("url");

  const studies = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    studies.push({
      label: cells[cLabel], year: cells[cYear], display: cells[cDisplay],
      value: Number(cells[cValue]), study: cells[cStudy], title: cells[cTitle],
      journal: cells[cJournal], detail: cells[cDetail], url: cells[cUrl],
    });
  }
  if (!studies.length) throw new Error("consensus-studies CSV: no data rows");
  return studies;
}

export function createConsensusStudiesWidget({data, width = FIGURE_WIDTH}) {
  const studies = data;
  let selected = studies.find(s => s.study === DEFAULT_STUDY) ?? studies[0];

  // Snap instead of sweeping for a reader who has asked the system for reduced motion — and,
  // because the thumbnail script forces that setting, every capture is the same frame.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, radius, cy, titleFont, pctFont, labelFont;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    radius = lerp(88, 118);
    titleFont = lerp(14, 19);
    pctFont = lerp(46, 60);
    labelFont = lerp(15, 19);
    // Fixed, so the pie does not drift up and down the frame as the figure is resized; the
    // label below it follows the radius, and the largest radius still clears FIGURE_HEIGHT.
    cy = 186;
  }
  applyLayout(maxW);

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  // --- study buttons ---
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;";
  const buttonEls = studies.map(study => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${study.label} ${study.year}`;
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "transition:background-color " + TRANSITION + ",color " + TRANSITION + ",border-color " + TRANSITION + ";";
    b.addEventListener("click", () => {
      if (selected === study) return;
      const from = selected.value;
      selected = study;
      update(from);
    });
    buttons.appendChild(b);
    return b;
  });
  container.appendChild(buttons);

  function styleButtons() {
    buttonEls.forEach((b, i) => {
      const active = studies[i] === selected;
      b.setAttribute("aria-pressed", String(active));
      b.style.border = active ? "1px solid #333" : "1px solid #ccc";
      b.style.background = active ? "#333" : "#fff";
      b.style.color = active ? "#fff" : "#333";
    });
  }

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper rather
  // than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "consensus-studies");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // The citation, the finding, and the link out. Real HTML rather than SVG text: these run to
  // a couple of lines and wrap, which SVG would make us break by hand.
  const panel = document.createElement("div");
  panel.style.cssText = "padding:10px 0 0;";
  const cite = document.createElement("div");
  cite.style.cssText = "margin-bottom:4px;";
  const citeLink = document.createElement("a");
  citeLink.target = "_blank";
  citeLink.rel = "noopener";
  citeLink.style.cssText = "color:#0b57d0;";
  const citeTail = document.createElement("span");
  citeTail.style.cssText = "color:#555;";
  cite.append(citeLink, citeTail);
  const detail = document.createElement("div");
  detail.style.cssText = "color:#555;line-height:1.45;min-height:2.9em;";
  panel.append(cite, detail);
  container.appendChild(panel);

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  let link, wedge, pctText, pctSign, pieLabel, ring;

  function buildAll(newW) {
    applyLayout(newW);

    // Capped to the figure's own width rather than the page column's, so the pills stack onto
    // more rows instead of spilling wider than the figure below them.
    buttons.style.maxWidth = `${w}px`;

    svg.setAttribute("width", w);
    svg.setAttribute("height", FIGURE_HEIGHT);
    svg.replaceChildren();

    svg.appendChild(svgEl("rect", {width: w, height: FIGURE_HEIGHT, fill: BACKGROUND}));

    TITLE.forEach((line, i) => {
      const t = svgEl("text", {
        x: w / 2, y: 26 + i * 23, "text-anchor": "middle", "font-size": titleFont, fill: "#333",
      });
      t.textContent = line;
      svg.appendChild(t);
    });

    const cx = w / 2;

    // The whole pie is the link, so the percentage and the label under it are as clickable as
    // the wedge itself.
    link = svgEl("a", {target: "_blank", rel: "noopener", tabindex: "0"});
    link.style.cursor = "pointer";
    link.style.outline = "none";
    const title = svgEl("title", {});
    link.appendChild(title);
    link.titleEl = title;

    // Drawn but hidden, shown on focus: the browser's own outline would box in the label too.
    ring = svgEl("circle", {
      cx, cy, r: radius + 6, fill: "none", stroke: "rgba(11,87,208,0.4)", "stroke-width": 3,
    });
    ring.style.display = "none";
    link.appendChild(ring);
    link.addEventListener("focus", () => { ring.style.display = ""; });
    link.addEventListener("blur", () => { ring.style.display = "none"; });

    link.appendChild(svgEl("circle", {cx, cy, r: radius, fill: DISC}));
    wedge = svgEl("path", {d: arcPath(cx, cy, radius, selected.value), fill: GREEN});
    link.appendChild(wedge);

    // The percent sign rides high and small beside the number, as in the original.
    pctText = svgEl("text", {
      x: cx, y: cy, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": pctFont, fill: "#fff",
    });
    pctSign = svgEl("tspan", {dy: `-${(pctFont * 0.36).toFixed(1)}`, "font-size": pctFont * 0.55});
    pctSign.textContent = "%";
    pctText.append(document.createTextNode(""), pctSign);
    link.appendChild(pctText);

    pieLabel = svgEl("text", {
      x: cx, y: cy + radius + 6 + labelFont, "text-anchor": "middle",
      "font-size": labelFont, fill: "#333",
    });
    link.appendChild(pieLabel);

    svg.appendChild(link);

    render();
  }

  // Everything that depends on the selection but not on the layout.
  function render() {
    const cx = w / 2;
    const summary = `${selected.study}: ${selected.detail} Click to open the paper.`;

    link.setAttribute("href", selected.url);
    link.setAttribute("aria-label", summary);
    link.titleEl.textContent = summary;

    wedge.setAttribute("d", arcPath(cx, cy, radius, selected.value));
    setPctText(selected.display);
    pieLabel.textContent = `${selected.label} ${selected.year}`;

    citeLink.href = selected.url;
    citeLink.textContent = selected.title;
    citeTail.textContent = ` — ${selected.study}, ${selected.journal}.`;
    detail.textContent = selected.detail;
  }

  function setPctText(numberText) {
    pctText.firstChild.nodeValue = numberText;
  }

  // The wedge and the number sweep together from the study just left to the one just picked.
  // A rAF tween rather than a CSS transition: an arc's sweep lives in the path's `d`, which
  // CSS cannot interpolate.
  let frame = null;
  function tweenTo(fromPct) {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    if (reduceMotion) return;

    const cx = w / 2;
    const toPct = selected.value;
    // Trailing digits so a 97 → 99.9 sweep counts through 98.4 rather than jumping; the exact
    // display string is restored at the end.
    const decimals = selected.display.includes(".") ? 1 : 0;
    // render() has already written the destination; rewind to the starting frame here rather
    // than waiting for the first rAF callback, so the sweep never flashes its own endpoint.
    wedge.setAttribute("d", arcPath(cx, cy, radius, fromPct));
    setPctText(fromPct.toFixed(decimals));
    const t0 = performance.now();

    const step = now => {
      // A cell that re-runs leaves the previous widget detached but still holding a frame
      // request; without this it would keep animating an orphaned SVG.
      if (container.isConnected === false) { frame = null; return; }
      const k = Math.min(1, (now - t0) / TWEEN_MS);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = fromPct + (toPct - fromPct) * eased;
      wedge.setAttribute("d", arcPath(cx, cy, radius, v));
      setPctText(v.toFixed(decimals));
      if (k < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = null;
        wedge.setAttribute("d", arcPath(cx, cy, radius, toPct));
        setPctText(selected.display);
      }
    };
    frame = requestAnimationFrame(step);
  }

  function value() {
    return {
      study: selected.study, label: selected.label, year: Number(selected.year),
      percent: selected.value, url: selected.url,
    };
  }

  function update(fromPct) {
    styleButtons();
    render();
    if (fromPct !== undefined) tweenTo(fromPct);
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  buildAll(maxW);
  styleButtons();
  container.value = value();

  // Reflow with the container; synchronous in the callback, same pattern as the other widgets'
  // observers. Resizing never emits "input": the selected study is data-space state, unchanged
  // by re-layout. An in-flight tween is dropped, since buildAll redraws at the final value.
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) {
        if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
        buildAll(fitted);
      }
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
  // An arc ending where it starts renders nothing, so a full circle is drawn as two half arcs
  // rather than special-cased by the caller — it has to sit in the same <path> the tween
  // writes to.
  if (frac >= 0.9995) {
    return `M${cx - r},${cy}A${r},${r} 0 1 1 ${cx + r},${cy}A${r},${r} 0 1 1 ${cx - r},${cy}Z`;
  }
  const gapHalf = (1 - frac) * Math.PI;
  const a0 = gapHalf, a1 = 2 * Math.PI - gapHalf;
  const p = a => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M${cx},${cy}L${p(a0)}A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${p(a1)}Z`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
