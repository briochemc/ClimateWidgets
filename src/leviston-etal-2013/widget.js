// Actual vs. perceived opinion on climate change (Leviston, Walker & Morwinski, Nature
// Climate Change, 2013). Two Australian surveys, run 12 months apart (Time 1 n = 5,036;
// Time 2 n = 5,030), asked respondents their own opinion on climate change — "not happening",
// "don't know", "natural" or "human-induced" — and separately asked them to estimate how the
// wider community is split across those same four opinions. This reproduces the paper's
// Figures 1 (estimated by all respondents, against the actual split) and 2 (estimated by each
// opinion group on its own, i.e. do people think others share their own view more than they
// really do) as a single 4-bar chart with buttons to pick the time and the estimator; the
// actual split is always drawn as a dashed outline over the selected bars, except when
// "Actual" itself is selected.
//
// Data: src/leviston-etal-2013/data/leviston-etal-2013.csv, transcribed from the percentages
// printed on the published figures (https://doi.org/10.1038/nclimate1743); there is no
// extraction script. The four opinion-group sample sizes (Not happening 283, Don't know 189,
// Natural 2,024, Human-induced 2,540) are Time 1 figures that the paper's own Figure 2 reuses
// under the Time 2 panel too, so this widget does the same.
//
// Like the Hickman et al. widget, switching buttons mutates the same SVG in place (new
// `y`/`height` on the bar and outline rects, new text) rather than rebuilding it, so the
// transitions below animate every switch.

const CATEGORIES = ["not_happening", "dont_know", "natural", "human_induced"];
const CATEGORY_LABEL = {
  not_happening: "Not happening",
  dont_know: "Don't know",
  natural: "Natural",
  human_induced: "Human-induced",
};
// Two-line tick labels for the categories whose name would otherwise overrun its slot at
// narrow widths, matching how the paper's own figures wrap "Not happening" and
// "Human-induced" onto two lines under each bar.
const CATEGORY_TICK_LINES = {
  not_happening: ["Not", "happening"],
  dont_know: ["Don't know"],
  natural: ["Natural"],
  human_induced: ["Human-", "induced"],
};
const CATEGORY_COLOR = {
  not_happening: "#E69F00",
  dont_know: "#56B4E9",
  natural: "#009E73",
  human_induced: "#D55E00",
};

const SOURCES = ["actual", "all", "not_happening", "dont_know", "natural", "human_induced"];
const SOURCE_LABEL = {
  actual: "Actual",
  all: "Perceived by all",
  not_happening: '"Not happening" group',
  dont_know: '"Don’t know" group',
  natural: '"Natural" group',
  human_induced: '"Human-induced" group',
};

// Opinion-group sample sizes, Time 1 (reused for Time 2 — see the file header note above).
const GROUP_N = {not_happening: 283, dont_know: 189, natural: 2024, human_induced: 2540};
const TOTAL_N = {1: 5036, 2: 5030};

const BACKGROUND = "#f2f2f2";
const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;
const FIGURE_HEIGHT = 380; // constant at every width — embed height stays put
const TRANSITION = "480ms ease";

// Fixed y-limit, in percent. The tallest bar in the data is 50.4% (Time 1, actual,
// human-induced); the untick'd headroom above 50 keeps the two-line in-plot title and the
// legend clear of the bars at every selection and every width.
const PCT_MAX = 70;

// Vertical layout is constant, so embed iframe heights stay put; only horizontal metrics and
// fonts are recomputed on resize (applyLayout, below).
const PLOT_BOTTOM = 316;
const PLOT_HEIGHT = 306;

const SVGNS = "http://www.w3.org/2000/svg";

// Left edge shared by the gridlines, their tick labels and the in-plot title. marginL (the
// bars' own left edge) leaves a wide unused strip to its left at every width, so all three
// use that strip instead of lining up with the bars.
const AXIS_LEFT = 10;

// One row per (time, source) pair: time is 1 or 2, source is one of SOURCES, and the four
// values are percentages in CATEGORIES order.
export function parseLevistonEtal2013(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`leviston-etal-2013 CSV: no "${name}" column`);
    return i;
  };
  const cTime = col("time");
  const cSource = col("source");
  const cCategory = CATEGORIES.map(c => col(c));

  const data = {1: {}, 2: {}};
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const time = Number(cells[cTime]);
    if (time !== 1 && time !== 2) throw new Error(`leviston-etal-2013 CSV: unexpected time "${cells[cTime]}"`);
    const source = cells[cSource];
    data[time][source] = cCategory.map(i => Number(cells[i]));
  }

  for (const time of [1, 2]) {
    for (const source of SOURCES) {
      if (!data[time][source]) {
        throw new Error(`leviston-etal-2013 CSV: missing row for time ${time}, source "${source}"`);
      }
    }
  }
  return data;
}

export function createLevistonEtal2013Widget({data, width = FIGURE_WIDTH}) {
  const y = pct => PLOT_BOTTOM - (pct / PCT_MAX) * PLOT_HEIGHT;
  const nFor = (time, source) => (source === "actual" || source === "all" ? TOTAL_N[time] : GROUP_N[source]);

  let selectedTime = 1;
  let selectedSource = "actual";
  let w, marginL, plotR, slot;
  let titleFont, noteFont, barLabelFont, tickFont, sourceFont;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;

    marginL = lerp(44, 64);
    plotR = w - 10;
    slot = (plotR - marginL) / CATEGORIES.length; // x-limits 0..4, bars centered at x = 0.5..3.5

    titleFont = lerp(14, 20);
    noteFont = lerp(9, 11);
    barLabelFont = lerp(11, 14);
    tickFont = lerp(9, 11);
    sourceFont = lerp(7, 8);
  }

  function barCenterX(i) {
    return marginL + slot * (i + 0.5);
  }

  // The plate runs under the whole widget, buttons included, so it reads as one card; the SVG
  // keeps painting its own background rect in the same color (below), so the two merge
  // seamlessly here and the SVG still stands on its own if it is ever pulled out on its own.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper rather
  // than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "leviston-etal-2013");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // --- buttons, below the figure: Time on its own row, the six sources wrap on the row
  // below it. ---
  const buttonsWrap = document.createElement("div");
  buttonsWrap.style.cssText = "margin-top:10px;";
  const timeRow = document.createElement("div");
  timeRow.style.cssText = "display:flex;gap:8px;margin-bottom:8px;";
  const sourceRow = document.createElement("div");
  sourceRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;";
  buttonsWrap.append(timeRow, sourceRow);
  container.appendChild(buttonsWrap);

  function pillButton(text, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "transition:background-color " + TRANSITION + ",color " + TRANSITION + ",border-color " + TRANSITION + ";";
    b.addEventListener("click", onClick);
    return b;
  }

  const timeButtonEls = [1, 2].map(time => {
    const b = pillButton(`Time ${time}`, () => {
      if (selectedTime === time) return;
      selectedTime = time;
      update();
    });
    timeRow.appendChild(b);
    return b;
  });

  const sourceButtonEls = SOURCES.map(source => {
    const b = pillButton(SOURCE_LABEL[source], () => {
      if (selectedSource === source) return;
      selectedSource = source;
      update();
    });
    sourceRow.appendChild(b);
    return b;
  });

  function styleButtons() {
    timeButtonEls.forEach((b, i) => {
      const active = [1, 2][i] === selectedTime;
      b.setAttribute("aria-pressed", String(active));
      b.style.border = active ? "1px solid #333" : "1px solid #ccc";
      b.style.background = active ? "#333" : "#fff";
      b.style.color = active ? "#fff" : "#333";
    });
    sourceButtonEls.forEach((b, i) => {
      const active = SOURCES[i] === selectedSource;
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

  let barRects = [], barLabels = [], outlineRects = [];

  // Bars (and outlines) are created already at the current selection's heights (not zero), so
  // a resize resizes them instead of replaying the grow-from-zero animation that a selection
  // switch animates.
  function buildBars(row) {
    barRects = [];
    barLabels = [];
    CATEGORIES.forEach((cat, i) => {
      const h = (row[i] / PCT_MAX) * PLOT_HEIGHT;
      const bx = barCenterX(i) - (0.95 * slot) / 2;
      const by = PLOT_BOTTOM - h;

      const rect = svgEl("rect", {x: bx, y: by, width: 0.95 * slot, height: h, fill: CATEGORY_COLOR[cat]});
      rect.style.transition = `y ${TRANSITION}, height ${TRANSITION}`;
      svg.appendChild(rect);
      barRects.push(rect);

      // A bar too short to hold its own label carries it just above the bar instead, in dark
      // text rather than the background-colored fill used inside a tall bar; the fill
      // transition fades between the two rather than popping.
      const inside = h >= 26;
      const label = svgEl("text", {
        x: barCenterX(i), y: 0, "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": barLabelFont,
      });
      label.style.transition = `transform ${TRANSITION}, fill ${TRANSITION}`;
      label.style.fill = inside ? BACKGROUND : "#333";
      label.style.transform = `translate(0px, ${inside ? by + 12 : by - 8}px)`;
      label.textContent = `${row[i].toFixed(1)}%`;
      svg.appendChild(label);
      barLabels.push(label);
    });
  }

  function updateBars(row) {
    CATEGORIES.forEach((cat, i) => {
      const h = (row[i] / PCT_MAX) * PLOT_HEIGHT;
      const by = PLOT_BOTTOM - h;
      barRects[i].setAttribute("y", by);
      barRects[i].setAttribute("height", h);

      const inside = h >= 26;
      barLabels[i].style.fill = inside ? BACKGROUND : "#333";
      barLabels[i].style.transform = `translate(0px, ${inside ? by + 12 : by - 8}px)`;
      barLabels[i].textContent = `${row[i].toFixed(1)}%`;
    });
  }

  // The actual split, drawn as an unfilled dashed outline over the same four slots as the
  // selected (filled) bars — a direct visual reference rather than four extra bars. Hidden
  // entirely when "Actual" itself is selected, since the filled bars are that data.
  function buildOutline(row) {
    outlineRects = [];
    CATEGORIES.forEach((_, i) => {
      const h = (row[i] / PCT_MAX) * PLOT_HEIGHT;
      const bx = barCenterX(i) - (0.95 * slot) / 2;
      const by = PLOT_BOTTOM - h;
      const rect = svgEl("rect", {
        x: bx, y: by, width: 0.95 * slot, height: h,
        fill: "none", stroke: "#333", "stroke-width": 1.5, "stroke-dasharray": "5,3",
      });
      rect.style.transition = `y ${TRANSITION}, height ${TRANSITION}, opacity ${TRANSITION}`;
      svg.appendChild(rect);
      outlineRects.push(rect);
    });
  }

  function updateOutline(row) {
    CATEGORIES.forEach((_, i) => {
      const h = (row[i] / PCT_MAX) * PLOT_HEIGHT;
      const by = PLOT_BOTTOM - h;
      outlineRects[i].setAttribute("y", by);
      outlineRects[i].setAttribute("height", h);
    });
  }

  function updateOutlineVisibility() {
    const showOutline = selectedSource !== "actual";
    outlineRects.forEach(r => (r.style.opacity = showOutline ? 1 : 0));
    actualNoteG.style.opacity = showOutline ? 1 : 0;
  }

  const humanInducedIndex = CATEGORIES.indexOf("human_induced");

  // A small label centered directly above the top of the actual (dashed) human-induced bar,
  // labeling the dashed outline in place rather than through a separate legend key. Fixed
  // shape, translated only: buildActualNote rebuilds it on resize, since its horizontal
  // anchor (that bar's own center) moves with the layout; positionActualNote alone handles a
  // time switch, since the actual value it points to depends on time, not on the selected
  // source.
  let actualNoteG, noteAnchorX;

  function buildActualNote(actualRow) {
    noteAnchorX = barCenterX(humanInducedIndex);
    actualNoteG = svgEl("g", {});
    actualNoteG.style.transition = `transform ${TRANSITION}, opacity ${TRANSITION}`;
    const label = svgEl("text", {
      x: 0, y: -8, "text-anchor": "middle", "dominant-baseline": "middle",
      "font-size": noteFont, fill: "#333",
    });
    label.textContent = "Actual";
    actualNoteG.appendChild(label);
    svg.appendChild(actualNoteG);
    positionActualNote(actualRow);
  }

  function positionActualNote(actualRow) {
    const noteY = PLOT_BOTTOM - (actualRow[humanInducedIndex] / PCT_MAX) * PLOT_HEIGHT;
    actualNoteG.style.transform = `translate(${noteAnchorX}px, ${noteY}px)`;
  }

  function summaryText() {
    const row = data[selectedTime][selectedSource];
    const n = nFor(selectedTime, selectedSource);
    const parts = CATEGORIES.map((cat, i) => `${CATEGORY_LABEL[cat].toLowerCase()} ${row[i].toFixed(1)}%`).join(", ");
    const who = selectedSource === "actual"
      ? "Actual result"
      : selectedSource === "all"
        ? "As estimated by all respondents"
        : `As estimated by the "${CATEGORY_LABEL[selectedSource]}" group`;
    let text = `Time ${selectedTime}, ${who} (n = ${n.toLocaleString("en-US")}): ${parts}.`;
    if (selectedSource !== "actual") {
      const actual = data[selectedTime].actual;
      const actualParts = CATEGORIES.map((cat, i) => `${CATEGORY_LABEL[cat].toLowerCase()} ${actual[i].toFixed(1)}%`).join(", ");
      text += ` Actual: ${actualParts}.`;
    }
    return text;
  }

  function renderStatus() {
    svg.setAttribute("aria-label", `Actual vs. perceived opinion on climate change. ${summaryText()}`);
  }

  function value() {
    return {time: selectedTime, source: selectedSource};
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function update() {
    styleButtons();
    updateBars(data[selectedTime][selectedSource]);
    updateOutline(data[selectedTime].actual);
    positionActualNote(data[selectedTime].actual);
    updateOutlineVisibility();
    renderStatus();
    emit();
  }

  // Rebuilt on resize (horizontal layout and fonts change); the vertical geometry, the colors
  // and the current selection do not, so this is also what a first build runs.
  function buildAll(newW) {
    applyLayout(newW);

    // Capped to the figure's own width rather than the page column's, so the pills stack onto
    // more rows instead of spilling wider than the chart above them.
    buttonsWrap.style.maxWidth = `${w}px`;

    svg.setAttribute("width", w);
    svg.setAttribute("height", FIGURE_HEIGHT);
    svg.replaceChildren();

    svg.appendChild(svgEl("rect", {width: w, height: FIGURE_HEIGHT, fill: BACKGROUND}));

    // Gridlines and ticks stop at 50%, leaving the 50-70 band as pure headroom for the in-plot
    // title and legend — see PCT_MAX above. No spine and no separate axis title: each tick
    // label sits just above its own gridline, colored the same quiet gray as the gridlines.
    // Both run from AXIS_LEFT rather than marginL (the bars' own left edge): at marginL the
    // labels would fall directly under the tall bars' tops and get hidden by them, so the
    // whole axis — gridlines included, so the labels still sit right over their own line —
    // moves into the unused strip to the bars' left instead.
    for (let v = 0; v <= 50; v += 10) {
      const py = y(v);
      svg.appendChild(svgEl("line", {
        x1: AXIS_LEFT, x2: plotR, y1: py, y2: py, stroke: "#b3b3b3", "stroke-width": 1,
      }));
      const t = svgEl("text", {
        x: AXIS_LEFT, y: py - 4, "text-anchor": "start",
        "font-size": tickFont, fill: "#b3b3b3",
      });
      t.textContent = v === 50 ? "50% of respondents" : `${v}%`;
      svg.appendChild(t);
    }

    CATEGORIES.forEach((cat, i) => {
      const lines = CATEGORY_TICK_LINES[cat];
      const t = svgEl("text", {
        x: barCenterX(i), y: PLOT_BOTTOM + 16, "text-anchor": "middle", "font-size": tickFont, fill: "#333",
      });
      lines.forEach((line, li) => {
        const tspan = document.createElementNS(SVGNS, "tspan");
        tspan.setAttribute("x", barCenterX(i));
        if (li > 0) tspan.setAttribute("dy", "1.15em");
        tspan.textContent = line;
        t.appendChild(tspan);
      });
      svg.appendChild(t);
    });

    // The figure's two-line caption, drawn inside the plot's top-left corner, flush with the
    // gridlines and their labels rather than the bars. Fixed text: it names what the chart is
    // about, not the current selection, so it doesn't need to change as the buttons are used.
    const title1 = svgEl("text", {x: AXIS_LEFT, y: 30, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title1.textContent = "What do Australians think";
    svg.appendChild(title1);
    const title2 = svgEl("text", {x: AXIS_LEFT, y: 52, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title2.textContent = "is happening to the climate?";
    svg.appendChild(title2);

    // Below about 460px the full citation with its DOI would overrun the figure's left edge
    // (it is fixed, right-anchored text at a small font, sized for the 600px figure); a
    // shorter form there avoids that rather than letting it clip.
    const source = svgEl("text", {
      x: w - 10, y: 372, "text-anchor": "end", "font-size": sourceFont, fill: "#808080",
    });
    if (w >= 460) {
      const prefix = document.createElementNS(SVGNS, "tspan");
      prefix.textContent = "Data source: ";
      const italic = document.createElementNS(SVGNS, "tspan");
      italic.setAttribute("font-style", "italic");
      italic.textContent = "Leviston et al.";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = " Nature Climate Change, 2013 (https://doi.org/10.1038/nclimate1743)";
      source.append(prefix, italic, rest);
    } else {
      const italic = document.createElementNS(SVGNS, "tspan");
      italic.setAttribute("font-style", "italic");
      italic.textContent = "Leviston et al.";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = ", Nature Climate Change (2013)";
      source.append(italic, rest);
    }
    svg.appendChild(source);

    buildBars(data[selectedTime][selectedSource]);
    buildOutline(data[selectedTime].actual);
    buildActualNote(data[selectedTime].actual);
    updateOutlineVisibility();
    styleButtons();
    renderStatus();
  }

  buildAll(Math.max(MIN_WIDTH, Math.round(width)));
  container.value = value();

  // Reflow with the container; synchronous in the callback, same pattern as the other
  // widgets' observers. Resizing never emits "input": the selected time/source is data-space
  // state, unchanged by re-layout.
  if (typeof ResizeObserver === "function") {
    const maxW = Math.max(MIN_WIDTH, Math.round(width));
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
