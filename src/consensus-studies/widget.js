// Studies into scientific agreement on human-caused global warming — one study at a time,
// picked with the pill buttons under the figure, after Skeptical Science's pie-chart graphic
// (https://skepticalscience.com/graphics/studies_consensus.jpg, on
// https://skepticalscience.com/print.php?r=442). That graphic's seven pies are the studies
// synthesised by Cook et al. (2016); three more are shown here, all published after it was
// drawn: the synthesis itself, Myers et al. 2021's repeat of the Doran & Zimmerman survey,
// and Lynas et al. 2021's sweep of the literature.
//
// The original prints all seven pies side by side, which makes its point by repetition. One
// large pie makes a different one: switching between studies holds the wedge in place and
// animates only the sliver, so a decade of independent surveys visibly lands on the same
// answer. The pie is also a link — clicking it, or the paper's title beside it, opens that
// study's DOI in a new tab.
//
// Layout follows hickman-etal-2021: one grey plate under the whole widget, buttons included,
// so it reads as a single card. The pie sits at the left of that plate with the paper's title
// and finding set beside it, which is why those two are HTML rather than SVG text — they run
// to several lines and need to wrap, which SVG would make us break by hand.
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
const BACKGROUND = "#f2f2f2"; // the plate the other widgets sit on

const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;

const TRANSITION = "480ms ease"; // buttons, matching hickman
const TWEEN_MS = 520; // the wedge sweep between studies
const TOUR_STEP = 1100; // ms per study while the opening sweep plays

const TITLE = "Scientific agreement on human-caused global warming";

// The widget opens here rather than on the first button: Cook et al. 2013 is the study the
// "97%" figure comes from, and its wedge is actually visible, unlike Oreskes' full circle.
// Reduced motion pins the opening frame, which is what keeps the thumbnail deterministic.
const DEFAULT_STUDY = "Cook et al. 2013";

const SVGNS = "http://www.w3.org/2000/svg";

// One row per study: the short name and year for the label under the pie, the full author
// string for its button, the percentage as the graphic writes it, the precise value the wedge
// is drawn from, and the paper's title, finding and DOI for the panel beside it. pct_display
// and pct_value differ wherever the graphic rounds (Carlton's 96.7% shows as 97%) or a paper
// reports a range (Anderegg's 97–98%, drawn at its midpoint).
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
  const cDetail = col("detail"), cUrl = col("url");

  const studies = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    studies.push({
      label: cells[cLabel], year: Number(cells[cYear]), display: cells[cDisplay],
      value: Number(cells[cValue]), study: cells[cStudy], title: cells[cTitle],
      detail: cells[cDetail], url: cells[cUrl],
    });
  }
  if (!studies.length) throw new Error("consensus-studies CSV: no data rows");
  // Oldest first, so the buttons run in the order the field actually asked the question.
  // Sorted here rather than trusted from the file, and stable, so the two 2014 studies keep
  // the curated order they are written in.
  return studies.sort((a, b) => a.year - b.year);
}

export function createConsensusStudiesWidget({data, width = FIGURE_WIDTH}) {
  const studies = data;
  let selected = studies.find(s => s.study === DEFAULT_STUDY) ?? studies[0];

  // Snap instead of sweeping for a reader who has asked the system for reduced motion — and,
  // because the thumbnail script forces that setting, every capture is the same frame.
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, radius, titleFont, pctFont, labelFont, citeFont, detailFont;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * t);

    // Smaller than it was when the pie had the plate to itself: the paper's title and finding
    // now sit beside it, and need room to wrap into rather than a column two words wide.
    radius = lerp(74, 100);
    titleFont = lerp(15, 20);
    pctFont = lerp(40, 53);
    labelFont = lerp(14, 17);
    // Set small deliberately. Titles and findings vary a lot in length — Myers et al.'s title
    // is 130 characters against Anderegg's 35 — and at reading size the longest of them would
    // outgrow the pie beside it and resize the whole widget mid-tour. Small enough that even
    // the longest pair fits the height the pie already reserves (see panel.minHeight).
    citeFont = lerp(12, 13);
    detailFont = lerp(12, 13);
  }
  applyLayout(maxW);

  // The plate runs under the whole widget, buttons included, so it reads as one card; the SVG
  // keeps painting its own background rect in the same color, so the two merge seamlessly and
  // the pie still stands on its own if it is ever pulled out.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  const titleEl = document.createElement("div");
  titleEl.textContent = TITLE;
  titleEl.style.cssText = "font-weight:bold;color:#111;margin-bottom:8px;";
  container.appendChild(titleEl);

  // Pie at the left, paper beside it; below about 480 px there is no room for both and the
  // text wraps under the pie instead.
  const row = document.createElement("div");
  row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:18px;";
  container.appendChild(row);

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "consensus-studies");
  svg.style.display = "block";
  scroller.appendChild(svg);
  row.appendChild(scroller);

  const panel = document.createElement("div");
  panel.style.cssText = "flex:1 1 240px;min-width:0;";
  const citeLink = document.createElement("a");
  citeLink.target = "_blank";
  citeLink.rel = "noopener";
  citeLink.style.cssText = "color:#0b57d0;font-weight:500;line-height:1.35;display:block;margin-bottom:6px;";
  const detail = document.createElement("div");
  detail.style.cssText = "color:#555;line-height:1.45;";
  panel.append(citeLink, detail);
  row.appendChild(panel);

  // --- study buttons, below the figure and on the same plate ---
  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;";
  const buttonEls = studies.map(study => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = study.study; // "Cook et al. 2013" — the full author string, not the short label
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "transition:background-color " + TRANSITION + ",color " + TRANSITION + ",border-color " + TRANSITION + ";";
    b.addEventListener("click", () => {
      stopTour();
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

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  let link, wedge, pctText, pctSign, pieLabel, ring;
  let cx, cy;

  function buildAll(newW) {
    applyLayout(newW);

    // The pie's own box: the disc, its focus ring, and the label under it.
    const boxW = 2 * (radius + 6);
    const boxH = 2 * (radius + 6) + 6 + labelFont + 4;
    cx = boxW / 2;
    cy = radius + 6;

    svg.setAttribute("width", boxW);
    svg.setAttribute("height", boxH);
    svg.replaceChildren();
    svg.appendChild(svgEl("rect", {width: boxW, height: boxH, fill: BACKGROUND}));

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
      cx, cy, r: radius + 5, fill: "none", stroke: "rgba(11,87,208,0.4)", "stroke-width": 3,
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

    // The short form here — "Cook 2013" — since the buttons and the citation beside the pie
    // both carry the full author string already.
    pieLabel = svgEl("text", {
      x: cx, y: cy + radius + 6 + labelFont, "text-anchor": "middle",
      "font-size": labelFont, fill: "#333",
    });
    link.appendChild(pieLabel);

    svg.appendChild(link);

    titleEl.style.fontSize = `${titleFont}px`;
    citeLink.style.fontSize = `${citeFont}px`;
    detail.style.fontSize = `${detailFont}px`;
    // The pie's height is the row's height at every width, whatever the paper beside it says,
    // so stepping through the studies never resizes the widget under the reader.
    panel.style.minHeight = `${boxH}px`;
    render();
  }

  // Everything that depends on the selection but not on the layout.
  function render() {
    const summary = `${selected.study}: ${selected.detail} Click to open the paper.`;

    link.setAttribute("href", selected.url);
    link.setAttribute("aria-label", summary);
    link.titleEl.textContent = summary;

    wedge.setAttribute("d", arcPath(cx, cy, radius, selected.value));
    setPctText(selected.display);
    pieLabel.textContent = `${selected.label} ${selected.year}`;

    citeLink.href = selected.url;
    citeLink.textContent = selected.title;
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

    const toPct = selected.value;
    // Counted at the destination's own precision, so a 97 → 99.85 sweep runs through 98.42
    // rather than jumping, and lands on exactly the digits the label carries.
    const dot = selected.display.indexOf(".");
    const decimals = dot < 0 ? 0 : selected.display.length - dot - 1;
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
      study: selected.study, label: selected.label, year: selected.year,
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

  // Autoplay: walk the studies oldest to newest, one a second, then stop on the last and leave
  // it there. A single pass rather than leiserowitz's endless loop — the panel beside the pie
  // is meant to be read, and a widget that kept cycling under a reader would never let them.
  // Any button press takes over for good.
  let touring = false, tourTimer = null, tourWatcher = null, tourIndex = 0;

  function stopTour() {
    tourWatcher?.disconnect();
    tourWatcher = null;
    if (!touring) return;
    touring = false;
    clearTimeout(tourTimer);
    tourTimer = null;
  }

  function tourStep() {
    if (!touring) return;
    // A cell that re-runs leaves the previous widget detached but still holding a timer;
    // without this it would keep stepping an orphaned figure for the life of the page.
    if (container.isConnected === false) return stopTour();
    if (tourIndex >= studies.length - 1) return stopTour();
    tourIndex++;
    const from = selected.value;
    selected = studies[tourIndex];
    update(from);
    tourTimer = setTimeout(tourStep, TOUR_STEP);
  }

  function startTour() {
    if (touring) return;
    touring = true;
    tourIndex = 0;
    const from = selected.value;
    selected = studies[0];
    update(from);
    tourTimer = setTimeout(tourStep, TOUR_STEP);
  }

  // Two reasons not to start: a reader who has asked for reduced motion should not get an
  // animation they never requested, and starting while the widget is off-screen would spend
  // the tour before it is ever looked at. The first is also what keeps the thumbnail
  // deterministic — the capture forces reduced motion, so it always catches DEFAULT_STUDY.
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
