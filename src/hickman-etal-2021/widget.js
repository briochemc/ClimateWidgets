// Climate anxiety in 16-25 year-olds (Hickman et al., Lancet Planetary Health, 2021). The
// survey asked 10,000 young people across ten countries how worried they are about climate
// change on a five-point scale, from "not worried" to "extremely"; this reproduces the
// pooled-response bar chart from the root hickman_etal_lancet_2021.jl / CairoMakie figure
// (colors, in-plot title, square bracket over the "very"/"extremely" bars, source line),
// with pill buttons added to switch between the pooled "All" row and each of the ten
// countries.
//
// Two deliberate departures from the Julia figure, both needed because country samples are
// roughly 1,000 respondents against the pooled row's 9,848: the y-axis is a percentage of
// respondents on a fixed 0-70% scale (rather than raw counts on a scale sized to the pooled
// row alone), so every country's bars are directly comparable and a small country is not
// reduced to a sliver; the in-bar labels carry the respondent count instead, which is what
// the Julia figure put on the axis. The bracket's headline percentage is computed from each
// selection's own data rather than the Julia script's hard-coded "59%".
//
// Data: src/hickman-etal-2021/data/hickman-etal-2021.csv, transcribed from the paper's
// published response counts (https://doi.org/10.1016/S2542-5196(21)00278-3); there is no
// extraction script; the pooled row's total (9,848) is a few dozen short of the paper's
// headline 10,000 because of item non-response.
//
// Switching countries mutates the same SVG in place (new `y`/`height` on the bar rects, a
// CSS `transform` on the count labels and the bracket group) rather than rebuilding it, so
// the transitions below animate every switch: a reactive Framework cell that re-ran its
// block would replace the DOM outright and discard any mid-animation state.

const RESPONSES = ["not worried", "a little", "moderately", "very", "extremely"];
// :Johnson, reversed, sampled from the Julia figure's own SVG output.
const COLORS = ["#132B69", "#0086A8", "#F6C200", "#D04E00", "#A00E00"];
const BACKGROUND = "#f2f2f2"; // Makie's :gray95

const FIGURE_WIDTH = 600;
const MIN_WIDTH = 320;
const FIGURE_HEIGHT = 380; // constant at every width, like leiserowitz — embed height stays put
const TRANSITION = "480ms ease";

// Fixed y-limit, in percent. Every bar in the data falls under 50% (the tallest, Philippines
// "extremely", is 49.5%); the untick'd headroom from 50 to 70 mirrors the Julia figure's own
// trick (its yticks stop at 3000 under a 4500 limit) and is exactly what keeps the bracket
// and its label clear of the in-plot title at every selection and every width.
const PCT_MAX = 70;

// Vertical layout is constant, so embed iframe heights stay put; only horizontal metrics and
// fonts are recomputed on resize (applyLayout, below).
const PLOT_BOTTOM = 316;
const PLOT_HEIGHT = 306;

const SVGNS = "http://www.w3.org/2000/svg";

// One row per country plus the pooled "All" row: country name, the five response counts in
// RESPONSES order, and their total.
export function parseHickmanEtal2021(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(",").map(s => s.trim());
  const col = name => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`hickman-etal-2021 CSV: no "${name}" column`);
    return i;
  };
  const cCountry = col("Country");
  const cResponse = RESPONSES.map(r => col(r));

  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = line.split(",").map(s => s.trim());
    const counts = cResponse.map(i => Number(cells[i]));
    const total = counts.reduce((a, b) => a + b, 0);
    rows.push({country: cells[cCountry], counts, total});
  }

  const all = rows.find(r => r.country === "All");
  if (!all) throw new Error('hickman-etal-2021 CSV: no "All" row');
  return {all, countries: rows.filter(r => r.country !== "All")};
}

export function createHickmanEtal2021Widget({data, width = FIGURE_WIDTH}) {
  const options = ["All", ...data.countries.map(r => r.country)];
  const rowFor = name => (name === "All" ? data.all : data.countries.find(r => r.country === name));
  const pctValues = row => row.counts.map(c => (100 * c) / row.total);
  const veryExtremePct = row => Math.round((100 * (row.counts[3] + row.counts[4])) / row.total);
  const y = pct => PLOT_BOTTOM - (pct / PCT_MAX) * PLOT_HEIGHT;

  let selected = "All";
  let w, marginL, plotR, slot, x1Bracket, x2Bracket;
  let titleFont, bracketFont, barLabelFont, tickFont, sourceFont;

  function applyLayout(newW) {
    w = newW;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;

    marginL = lerp(44, 64);
    plotR = w - 10;
    slot = (plotR - marginL) / 6; // x-limits 0..6, bars centered at x = 1..5, like the Julia axis

    x1Bracket = marginL + slot * 3.55; // Julia's literal [3.5+gap, 5.5-gap]
    x2Bracket = marginL + slot * 5.45;

    titleFont = lerp(14, 20);
    bracketFont = lerp(11, 16);
    barLabelFont = lerp(11, 14);
    tickFont = lerp(9, 11);
    sourceFont = lerp(7, 8);
  }

  function barCenterX(i) {
    return marginL + slot * (i + 1);
  }

  // The plate runs under the whole widget, buttons included, so it reads as one card; the
  // SVG keeps painting its own background rect in the same color (below), so the two merge
  // seamlessly here and the SVG still stands on its own if it is ever pulled out on its own.
  const container = document.createElement("div");
  container.style.cssText =
    "font:16px sans-serif;color:#333;background:" + BACKGROUND + ";" +
    "padding:10px 12px 12px;border-radius:6px;box-sizing:border-box;";

  // Narrower than MIN_WIDTH the figure stops reflowing and scrolls inside this wrapper
  // rather than pushing a horizontal scrollbar onto the whole page.
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "hickman-etal-2021");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // --- country buttons, below the figure: "All" sits alone on its own row since it is not
  // a country like the other ten. ---
  const buttonsWrap = document.createElement("div");
  buttonsWrap.style.cssText = "margin-top:10px;";
  const allRow = document.createElement("div");
  allRow.style.cssText = "display:flex;margin-bottom:8px;";
  const countryRow = document.createElement("div");
  countryRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;";
  buttonsWrap.append(allRow, countryRow);
  container.appendChild(buttonsWrap);

  const buttonEls = options.map(name => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.style.cssText =
      "font:14px sans-serif;padding:7px 14px;border-radius:999px;cursor:pointer;" +
      "transition:background-color " + TRANSITION + ",color " + TRANSITION + ",border-color " + TRANSITION + ";";
    b.addEventListener("click", () => {
      if (selected === name) return;
      selected = name;
      update();
    });
    (name === "All" ? allRow : countryRow).appendChild(b);
    return b;
  });

  function styleButtons() {
    buttonEls.forEach((b, i) => {
      const active = options[i] === selected;
      b.setAttribute("aria-pressed", String(active));
      b.style.border = active ? "1px solid #333" : "1px solid #ccc";
      b.style.background = active ? "#333" : "#fff";
      b.style.color = active ? "#fff" : "#333";
    });
  }

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:1.4em;";
  container.appendChild(status);

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  let barRects = [], barLabels = [], bracketG, bracketLabel;

  // Bars are created already at the current selection's heights (not zero), so a resize
  // resizes them instead of replaying the grow-from-zero animation that a country switch
  // animates.
  function buildBars(row) {
    barRects = [];
    barLabels = [];
    const pv = pctValues(row);
    RESPONSES.forEach((_, i) => {
      const h = (pv[i] / PCT_MAX) * PLOT_HEIGHT;
      const bx = barCenterX(i) - (0.95 * slot) / 2;
      const by = PLOT_BOTTOM - h;

      const rect = svgEl("rect", {x: bx, y: by, width: 0.95 * slot, height: h, fill: COLORS[i]});
      rect.style.transition = `y ${TRANSITION}, height ${TRANSITION}`;
      svg.appendChild(rect);
      barRects.push(rect);

      // A bar too short to hold its own label (the shortest, Philippines "not worried", is
      // under 1.5%) carries it just above the bar instead, in dark text rather than the
      // background-colored fill the Julia figure uses inside a tall bar; the fill
      // transition fades between the two rather than popping.
      const inside = h >= 26;
      const label = svgEl("text", {
        x: barCenterX(i), y: 0, "text-anchor": "middle", "dominant-baseline": "middle",
        "font-size": barLabelFont,
      });
      label.style.transition = `transform ${TRANSITION}, fill ${TRANSITION}`;
      label.style.fill = inside ? BACKGROUND : "#333";
      label.style.transform = `translate(0px, ${inside ? by + 12 : by - 8}px)`;
      label.textContent = row.counts[i].toLocaleString("en-US");
      svg.appendChild(label);
      barLabels.push(label);
    });
  }

  function updateBars(row) {
    const pv = pctValues(row);
    RESPONSES.forEach((_, i) => {
      const h = (pv[i] / PCT_MAX) * PLOT_HEIGHT;
      const by = PLOT_BOTTOM - h;
      barRects[i].setAttribute("y", by);
      barRects[i].setAttribute("height", h);

      const inside = h >= 26;
      barLabels[i].style.fill = inside ? BACKGROUND : "#333";
      barLabels[i].style.transform = `translate(0px, ${inside ? by + 12 : by - 8}px)`;
      barLabels[i].textContent = row.counts[i].toLocaleString("en-US");
    });
  }

  // A fixed-shape square staple (Julia's `style = :square`) plus its headline label, both
  // inside one group that only ever moves vertically: a `transform: translate` is the one
  // way to animate that move, since neither a path's `d` nor a line's coordinates are
  // CSS-transitionable.
  function buildBracket(row) {
    bracketG = svgEl("g", {});
    bracketG.appendChild(svgEl("path", {
      d: `M${x1Bracket},5 L${x1Bracket},0 L${x2Bracket},0 L${x2Bracket},5`,
      fill: "none", stroke: "#000", "stroke-width": 1.5,
    }));
    bracketLabel = svgEl("text", {
      x: (x1Bracket + x2Bracket) / 2, y: -15, "text-anchor": "middle",
      "font-size": bracketFont, fill: "#111",
    });
    bracketG.appendChild(bracketLabel);
    bracketG.style.transition = `transform ${TRANSITION}`;
    svg.appendChild(bracketG);
    positionBracket(row);
  }

  function positionBracket(row) {
    const maxPct = Math.max(...pctValues(row));
    bracketG.style.transform = `translate(0px, ${y(maxPct) - 10}px)`;
    bracketLabel.textContent = `${veryExtremePct(row)}% very or extremely worried`;
  }

  function summaryText(row) {
    const pv = pctValues(row);
    const parts = RESPONSES.map((r, i) => `${r} ${Math.round(pv[i])}%`).join(", ");
    const label = selected === "All" ? "All countries" : selected;
    return `${label} (n = ${row.total.toLocaleString("en-US")}): ${parts} — ` +
      `${veryExtremePct(row)}% very or extremely worried.`;
  }

  function renderStatus(row) {
    status.textContent = summaryText(row);
    svg.setAttribute("aria-label", `How worried about climate change are young people? ${summaryText(row)}`);
  }

  function value() {
    return selected;
  }

  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function update() {
    const row = rowFor(selected);
    styleButtons();
    updateBars(row);
    positionBracket(row);
    renderStatus(row);
    emit();
  }

  // Rebuilt on resize (horizontal layout and fonts change); the vertical geometry, the
  // colors and the current selection do not, so this is also what a first build runs.
  function buildAll(newW) {
    applyLayout(newW);
    const row = rowFor(selected);

    // Capped to the figure's own width rather than the page column's, so the pills stack
    // onto more rows instead of spilling wider than the chart above them.
    buttonsWrap.style.maxWidth = `${w}px`;

    svg.setAttribute("width", w);
    svg.setAttribute("height", FIGURE_HEIGHT);
    svg.replaceChildren();

    svg.appendChild(svgEl("rect", {width: w, height: FIGURE_HEIGHT, fill: BACKGROUND}));

    // Gridlines and ticks stop at 50%, leaving the 50-70 band as pure headroom for the
    // bracket and the in-plot title — see PCT_MAX above. No spine and no separate axis
    // title: each tick label sits just above its own gridline, left-aligned with the plot
    // and colored the same quiet gray as the gridlines, with the unit spelled out once on
    // the top tick ("50% of respondents") rather than on an axis label of its own.
    for (let v = 0; v <= 50; v += 10) {
      const py = y(v);
      svg.appendChild(svgEl("line", {
        x1: marginL, x2: plotR, y1: py, y2: py, stroke: "#b3b3b3", "stroke-width": 1,
      }));
      const t = svgEl("text", {
        x: marginL, y: py - 4, "text-anchor": "start",
        "font-size": tickFont, fill: "#b3b3b3",
      });
      t.textContent = v === 50 ? "50% of respondents" : `${v}%`;
      svg.appendChild(t);
    }

    RESPONSES.forEach((r, i) => {
      const t = svgEl("text", {
        x: barCenterX(i), y: PLOT_BOTTOM + 18, "text-anchor": "middle", "font-size": tickFont, fill: "#333",
      });
      t.textContent = r;
      svg.appendChild(t);
    });

    // The figure's one caption, drawn inside the plot's top-left corner rather than as an
    // Axis title, exactly where the Julia figure places it.
    const title1 = svgEl("text", {x: marginL + 10, y: 30, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title1.textContent = "How worried about climate change";
    svg.appendChild(title1);
    const title2 = svgEl("text", {x: marginL + 10, y: 52, "font-size": titleFont, "font-weight": "bold", fill: "#111"});
    title2.textContent = "are young people (16–25 yr)?";
    svg.appendChild(title2);

    // Below about 460px the full citation with its DOI would overrun the figure's left
    // edge (it is fixed, right-anchored text at a small font, sized for the 600px figure);
    // a shorter form there avoids that rather than letting it clip.
    const source = svgEl("text", {
      x: w - 10, y: 372, "text-anchor": "end", "font-size": sourceFont, fill: "#808080",
    });
    if (w >= 460) {
      const prefix = document.createElementNS(SVGNS, "tspan");
      prefix.textContent = "Data source: ";
      const italic = document.createElementNS(SVGNS, "tspan");
      italic.setAttribute("font-style", "italic");
      italic.textContent = "Hickman et al.";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = " Lancet Planetary Health, 2021 (https://doi.org/10.1016/S2542-5196(21)00278-3)";
      source.append(prefix, italic, rest);
    } else {
      const italic = document.createElementNS(SVGNS, "tspan");
      italic.setAttribute("font-style", "italic");
      italic.textContent = "Hickman et al.";
      const rest = document.createElementNS(SVGNS, "tspan");
      rest.textContent = ", Lancet Planetary Health (2021)";
      source.append(italic, rest);
    }
    svg.appendChild(source);

    buildBars(row);
    buildBracket(row);
    styleButtons();
    renderStatus(row);
  }

  buildAll(Math.max(MIN_WIDTH, Math.round(width)));
  container.value = value();

  // Reflow with the container; synchronous in the callback, same pattern as the other
  // widgets' observers. Resizing never emits "input": the selected country is data-space
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
