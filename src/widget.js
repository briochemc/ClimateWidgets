const colors = {
  HL: "#E744F6",
  H:  "#a41212",
  M:  "#fc7b03",
  ML: "#dec820",
  L:  "#20A359",
  LN: "#22e5db",
  VL: "#16188F",
};

// `simplified` selects the stripped-down teaching variant: no temperature panel, no
// x-axis spine, units folded into the y-tick labels, axis titles set inside the plot
// frame, and leader-line callouts on the two bottom-panel curves.
export function createClimateWidget({co2, pco2, temp, d3, width, widthScale = 2 / 3, simplified = false}) {
  const YEAR_START = 1900, SCENARIO_START = 2024, YEAR_END = 2150;
  const YEAR_STEP = 25;
  const GT_MIN = -20, GT_MAX = 60;
  const K = 7.82; // Gt CO2 per ppm
  const HIST_COLOR = "#666";
  const CALLOUT_YEAR = 1990; // historical, so both callouts show before anything is drawn

  const codes = ["VL", "LN", "L", "ML", "M", "H", "HL"];
  const names = { VL: "Very Low", LN: "Low-to-Negative", L: "Low", ML: "Medium-Low", M: "Medium", H: "High", HL: "High-to-Low" };

  const LABEL_FONT = "16px sans-serif";
  const LABEL_GAP = 6;   // annotate() offset from the end of the curve
  const LABEL_LEAD = 20; // minimum vertical spacing between stacked right-edge labels

  // Right margin is measured from the widest label actually drawn there rather than
  // guessed, so "Low-to-Negative (LN)" can't run off the canvas.
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = LABEL_FONT;
  const widestLabel = Math.max(
    ...codes.map(c => measure.measureText(`${names[c]} (${c})`).width),
    measure.measureText("my pCO₂ trajectory").width,
    measure.measureText("Natural CO₂ sink").width,
  );

  // Simplified ticks carry their units ("900 ppm", "−20 Gt/yr"), so they need more room
  // than the bare numbers; the axis title no longer sits in the left margin, which is
  // what previously justified the width.
  const marginL = simplified ? 100 : 80;
  const marginR = Math.ceil(widestLabel) + LABEL_GAP + 8;
  const tempT = 56, tempH = simplified ? 0 : 180;
  const gap = 10;
  const topT = simplified ? tempT : tempT + tempH + gap, topH = 220;
  const botT = topT + topH + gap;
  const botH = 300;
  const totalH = botT + botH + 56;
  // Keep enough room for the axis margins plus a usable plotting area, so a narrow
  // embed container (a phone, a cramped Moodle column) degrades to scrolling rather
  // than a negative-width plot.
  const w = Math.max(marginL + marginR + 160, Math.round(width * widthScale));
  const innerW = w - marginL - marginR;

  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;";

  const controls = document.createElement("div");
  controls.style.cssText = "padding:6px 0;display:flex;gap:20px;align-items:center;flex-wrap:wrap;";

  const sel = document.createElement("select");
  for (const c of codes) {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} — ${names[c]}`;
    if (c === "ML") opt.selected = true;
    sel.appendChild(opt);
  }
  const selLabel = document.createElement("label");
  selLabel.appendChild(document.createTextNode("Scenario: "));
  selLabel.appendChild(sel);
  controls.appendChild(selLabel);

  container.appendChild(controls);

  let drawingFinished = false;

  const context = (() => {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = w * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = totalH + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return ctx;
  })();
  context.canvas.style.display = "block";
  container.appendChild(context.canvas);

  const status = document.createElement("div");
  status.style.cssText = "padding:6px 0;color:#555;min-height:1.4em;";
  container.appendChild(status);

  const x    = d3.scaleLinear().domain([YEAR_START, YEAR_END]).range([marginL, marginL + innerW]);
  const yBot = d3.scaleLinear().domain([GT_MIN, GT_MAX]).range([botT + botH, botT]);
  const curve = d3.curveCatmullRom(context);

  function sampleStrokeAt(s, year) {
    if (s.length < 2) return null;
    const x0 = s[0][0], xN = s[s.length - 1][0];
    const px = x(year);
    if (px < x0 || px > xN) return null;
    for (let i = 1; i < s.length; i++) {
      if (s[i][0] >= px) {
        const p0 = s[i - 1], p1 = s[i];
        if (p1[0] === p0[0]) return yBot.invert(p1[1]);
        const t = (px - p0[0]) / (p1[0] - p0[0]);
        return yBot.invert(p0[1] * (1 - t) + p1[1] * t);
      }
    }
    return yBot.invert(s[s.length - 1][1]);
  }

  // Net CO₂ sink diagnosed from the stock change: S(t) = E(t) − K·(pCO₂(t+1) − pCO₂(t)).
  // Derived from true emissions and true CO₂ stock, so it is fixed per scenario. It can go
  // negative — net outgassing — when atmospheric CO₂ declines, which is physically expected.
  function trueSinks(sc) {
    const emByYr = new Map(co2[sc].map(p => [p.year, p.gt]));
    const ppmByYr = new Map(pco2[sc].map(p => [p.year, p.ppm]));
    const out = [];
    for (const p of pco2[sc]) {
      const em = emByYr.get(p.year);
      const nextPpm = ppmByYr.get(p.year + 1);
      if (em === undefined || nextPpm === undefined) continue;
      out.push({ year: p.year, gt: em - K * (nextPpm - p.ppm) });
    }
    return out;
  }

  function scenarioData(sc) {
    const co2Series = co2[sc];
    const pco2Series = pco2[sc];
    const emByYr = new Map(co2Series.map(p => [p.year, p.gt]));
    const ppmByYr = new Map(pco2Series.map(p => [p.year, p.ppm]));
    const split = SCENARIO_START - 1;
    const sinks = trueSinks(sc);
    const sinkByYr = new Map(sinks.map(s => [s.year, s.gt]));
    return {
      co2Series, pco2Series, emByYr, ppmByYr, sinkByYr,
      historical: co2Series.filter(p => p.year <= split),
      co2Future: co2Series.filter(p => p.year >= split),
      pco2Historical: pco2Series.filter(p => p.year <= split),
      pco2Future: pco2Series.filter(p => p.year >= split),
      sinksHistorical: sinks.filter(s => s.year <= split),
      sinksFuture: sinks.filter(s => s.year >= split),
      startPoint: co2Series.find(p => p.year === SCENARIO_START),
    };
  }

  let data = scenarioData("ML");
  let start = [x(data.startPoint.year), yBot(data.startPoint.gt)];
  let currentStroke = [start.slice()];

  function frame(t, h, yScale, yTicks, ylabel, drawXTicks, yFormat = String) {
    context.strokeStyle = "rgba(0,0,0,0.12)"; context.lineWidth = 1;
    for (const v of yTicks) {
      const py = yScale(v);
      context.beginPath();
      context.moveTo(marginL, py); context.lineTo(marginL + innerW, py); context.stroke();
    }
    for (let year = YEAR_START; year <= YEAR_END; year += YEAR_STEP) {
      const px = x(year);
      context.beginPath();
      context.moveTo(px, t); context.lineTo(px, t + h); context.stroke();
    }
    context.strokeStyle = "#666"; context.fillStyle = "#333"; context.font = "16px sans-serif";
    context.beginPath();
    context.moveTo(marginL, t);
    context.lineTo(marginL, t + h);
    if (!simplified) context.lineTo(marginL + innerW, t + h);
    context.stroke();
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yTicks) {
      const py = yScale(v);
      context.beginPath();
      context.moveTo(marginL - 5, py); context.lineTo(marginL, py); context.stroke();
      context.fillText(yFormat(v), marginL - 8, py);
    }
    if (drawXTicks) {
      context.textAlign = "center"; context.textBaseline = "top";
      for (let year = YEAR_START; year <= YEAR_END; year += YEAR_STEP) {
        const px = x(year);
        context.beginPath();
        context.moveTo(px, t + h); context.lineTo(px, t + h + 5); context.stroke();
        context.fillText(year, px, t + h + 8);
      }
    }
    if (simplified) {
      // Axis title inside the frame, top-left, nudged in off the corner.
      context.font = "bold 16px sans-serif";
      context.textAlign = "left"; context.textBaseline = "top";
      context.fillText(ylabel, marginL + 10, t + 10);
      context.font = "16px sans-serif";
    } else {
      context.save();
      context.translate(14, t + h / 2);
      context.rotate(-Math.PI / 2);
      context.textAlign = "center"; context.textBaseline = "top";
      context.fillText(ylabel, 0, 0);
      context.restore();
    }
  }

  function signed(v) {
    if (v === 0) return "0";
    return v > 0 ? `+${v}` : `−${-v}`;
  }

  function annotate(px, py, text, color) {
    context.fillStyle = color;
    context.font = LABEL_FONT;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(text, px + LABEL_GAP, py);
  }

  // Right-edge labels sit at their curve's final value, so curves that converge (VL and L,
  // typically) print on top of each other. Spread them apart in y while preserving their
  // vertical order, then shift the whole stack back inside the panel if spreading overflowed.
  function spreadLabels(labels, top, bottom) {
    const s = [...labels].sort((a, b) => a.y - b.y);
    for (let i = 1; i < s.length; i++) {
      if (s[i].y - s[i - 1].y < LABEL_LEAD) s[i].y = s[i - 1].y + LABEL_LEAD;
    }
    if (s.length) {
      const over = s[s.length - 1].y - bottom;
      if (over > 0) for (const l of s) l.y -= over;
      const under = top - s[0].y;
      if (under > 0) for (const l of s) l.y += under;
    }
    return s;
  }

  function drawLabels(labels, top, bottom) {
    for (const l of spreadLabels(labels, top, bottom)) annotate(l.x, l.y, l.text, l.color);
  }

  // Label offset from a point on a curve, joined to it by a short leader line.
  // side = -1 puts the label above the curve, +1 below.
  function callout(px, py, text, color, side) {
    const leader = 26;
    const tipY = py + side * 5;
    const endY = py + side * leader;
    context.strokeStyle = color; context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(px, tipY); context.lineTo(px, endY);
    context.stroke();
    context.lineWidth = 1;
    context.fillStyle = color;
    context.font = "bold 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = side < 0 ? "bottom" : "top";
    context.fillText(text, px, endY + side * 3);
    context.font = "16px sans-serif";
  }

  function drawSeries(series, yValue, yScale, color, dash, thickness = 4) {
    context.strokeStyle = color; context.lineWidth = thickness;
    if (dash) context.setLineDash(dash);
    context.beginPath();
    d3.line()
      .x(d => x(d.year))
      .y(d => yScale(yValue(d)))
      .curve(d3.curveMonotoneX)
      .context(context)(series);
    context.stroke();
    if (dash) context.setLineDash([]);
    context.lineWidth = 1;
  }

  function inferredPCO2() {
    if (currentStroke.length < 2) return [];
    const startPpm = data.ppmByYr.get(SCENARIO_START);
    if (startPpm === undefined) return [];
    const out = [{ year: SCENARIO_START, ppm: startPpm }];
    let ppm = startPpm;
    const lastX = currentStroke[currentStroke.length - 1][0];
    const lastYear = Math.floor(x.invert(lastX));
    const stopYear = Math.min(YEAR_END, lastYear);
    for (let t = SCENARIO_START; t < stopYear; t++) {
      const eUser = sampleStrokeAt(currentStroke, t);
      if (eUser === null) break;
      const s = data.sinkByYr.get(t);
      if (s === undefined) break;
      ppm += (eUser - s) / K;
      out.push({ year: t + 1, ppm });
    }
    return out;
  }

  const scenarioColor = () => colors[sel.value];

  function render() {
    context.clearRect(0, 0, w, totalH);
    const sc = sel.value;
    const scColor = scenarioColor();

    context.fillStyle = "#333"; context.font = "16px sans-serif";
    context.textAlign = "center"; context.textBaseline = "middle";
    const histMidX = (x(YEAR_START) + x(SCENARIO_START)) / 2;
    const futMidX  = (x(SCENARIO_START) + x(YEAR_END)) / 2;
    context.fillText("Historical trajectory", histMidX, 14);
    context.fillText("Future trajectory", futMidX, 14);
    context.strokeStyle = "#666"; context.lineWidth = 1;
    for (const [xa, xb] of [[x(YEAR_START), x(SCENARIO_START)], [x(SCENARIO_START), x(YEAR_END)]]) {
      context.beginPath();
      context.moveTo(xa + 2, 26); context.lineTo(xb - 2, 26); context.stroke();
      context.beginPath();
      context.moveTo(xa + 2, 24); context.lineTo(xa + 2, 30); context.stroke();
      context.beginPath();
      context.moveTo(xb - 2, 24); context.lineTo(xb - 2, 30); context.stroke();
    }

    const otherColor = "rgba(0,0,0,0.10)";
    const splitYear = SCENARIO_START - 1;

    // Temperature panel (top): true trajectories only, no user recomputation
    if (!simplified) {
      const tempVals = [];
      for (const sc2 of codes) for (const p of temp[sc2]) tempVals.push(p.T);
      const yTemp = d3.scaleLinear().domain(d3.extent(tempVals)).range([tempT + tempH, tempT]).nice();
      frame(tempT, tempH, yTemp, yTemp.ticks(5), "Temperature anomaly (°C)", false, signed);
      const tempHistorical = temp[sc].filter(p => p.year <= splitYear);
      const tempFuture = temp[sc].filter(p => p.year >= splitYear);
      drawSeries(tempHistorical, d => d.T, yTemp, HIST_COLOR);
      const tempLabels = [];
      for (const sc2 of codes) {
        if (sc2 === sc) continue;
        const future = temp[sc2].filter(p => p.year >= splitYear);
        drawSeries(future, d => d.T, yTemp, otherColor, undefined, 2);
        const last = future[future.length - 1];
        tempLabels.push({x: x(last.year), y: yTemp(last.T), text: `${names[sc2]} (${sc2})`, color: otherColor});
      }
      drawSeries(tempFuture, d => d.T, yTemp, scColor);
      const lastTemp = tempFuture[tempFuture.length - 1];
      tempLabels.push({x: x(lastTemp.year), y: yTemp(lastTemp.T), text: `${names[sc]} (${sc})`, color: scColor});
      drawLabels(tempLabels, tempT, tempT + tempH);
    }

    const inf = drawingFinished ? inferredPCO2() : [];
    const ppmVals = [];
    for (const sc2 of codes) for (const p of pco2[sc2]) ppmVals.push(p.ppm);
    if (inf.length >= 2) for (const p of inf) ppmVals.push(p.ppm);
    const yTop = d3.scaleLinear().domain(d3.extent(ppmVals)).range([topT + topH, topT]).nice();
    frame(topT, topH, yTop, yTop.ticks(5),
      simplified ? "Atmospheric CO₂" : "Atmospheric CO₂ (ppm)", false,
      simplified ? (v => `${v} ppm`) : String);

    drawSeries(data.pco2Historical, d => d.ppm, yTop, HIST_COLOR);

    const ppmLabels = [];
    for (const sc2 of codes) {
      if (sc2 === sc) continue;
      const future = pco2[sc2].filter(p => p.year >= splitYear);
      drawSeries(future, d => d.ppm, yTop, otherColor, undefined, 2);
      const last = future[future.length - 1];
      ppmLabels.push({x: x(last.year), y: yTop(last.ppm), text: `${names[sc2]} (${sc2})`, color: otherColor});
    }

    drawSeries(data.pco2Future, d => d.ppm, yTop, scColor);
    const lastPco2 = data.pco2Future[data.pco2Future.length - 1];
    ppmLabels.push({x: x(lastPco2.year), y: yTop(lastPco2.ppm), text: `${names[sc]} (${sc})`, color: scColor});

    if (inf.length >= 2) {
      drawSeries(inf, d => d.ppm, yTop, "red");
      const lastInf = inf[inf.length - 1];
      ppmLabels.push({x: x(lastInf.year), y: yTop(lastInf.ppm), text: "my pCO₂ trajectory", color: "red"});
    }
    drawLabels(ppmLabels, topT, topT + topH);

    frame(botT, botH, yBot, yBot.ticks(5),
      simplified ? "CO₂ flux" : "CO₂ flux (Gt/yr)", true,
      simplified ? (v => `${signed(v)} Gt/yr`) : signed);
    context.strokeStyle = "#ddd";
    context.beginPath();
    context.moveTo(marginL, yBot(0)); context.lineTo(marginL + innerW, yBot(0));
    context.stroke();
    drawSeries(data.sinksHistorical, d => d.gt, yBot, HIST_COLOR, [5, 4]);
    drawSeries(data.sinksFuture, d => d.gt, yBot, scColor, [5, 4]);
    drawSeries(data.historical, d => d.gt, yBot, HIST_COLOR);
    if (drawingFinished) {
      drawSeries(data.co2Future, d => d.gt, yBot, scColor);
    }
    if (simplified) {
      // Anchored in the historical period, so both labels are present from the start —
      // the future emissions curve only appears once the user has drawn something.
      const em = data.emByYr.get(CALLOUT_YEAR);
      const sk = data.sinkByYr.get(CALLOUT_YEAR);
      if (em !== undefined) callout(x(CALLOUT_YEAR), yBot(em), "CO₂ emissions", HIST_COLOR, -1);
      if (sk !== undefined) callout(x(CALLOUT_YEAR), yBot(sk), "Natural CO₂ sink", HIST_COLOR, +1);
    } else {
      const fluxLabels = [];
      const lastSink = data.sinksFuture[data.sinksFuture.length - 1];
      fluxLabels.push({x: x(lastSink.year), y: yBot(lastSink.gt), text: "Natural CO₂ sink", color: scColor});
      if (drawingFinished) {
        const lastFut = data.co2Future[data.co2Future.length - 1];
        fluxLabels.push({x: x(lastFut.year), y: yBot(lastFut.gt), text: "CO₂ emissions", color: scColor});
      }
      drawLabels(fluxLabels, botT, botT + botH);
    }

    context.strokeStyle = "rgba(0,0,0,0.3)"; context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(x(SCENARIO_START), tempT);
    context.lineTo(x(SCENARIO_START), botT + botH);
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = "red"; context.lineWidth = 4;
    context.beginPath();
    curve.lineStart();
    for (let i = 0; i < currentStroke.length; ++i) curve.point(...currentStroke[i]);
    curve.lineEnd();
    context.stroke();
    context.lineWidth = 1;

    context.beginPath();
    context.arc(start[0], start[1], 5, 0, 2 * Math.PI);
    context.fillStyle = "red";
    context.fill();

    context.fillStyle = "red";
    context.font = "16px sans-serif";
    context.textAlign = "right";
    context.textBaseline = "bottom";
    context.fillText("Draw from here!", start[0] - 2, start[1] - 8);

    context.fillStyle = "#333";
    context.textAlign = "center"; context.textBaseline = "bottom";
    context.fillText("Year", marginL + innerW / 2, totalH - 4);

    if (currentStroke.length <= 1) {
      status.textContent = "Drag on the bottom panel to draw a future emissions trajectory.";
    } else {
      const last = currentStroke[currentStroke.length - 1];
      status.textContent = `Drew ${currentStroke.length} points, reached year ${Math.round(x.invert(last[0]))} at ${yBot.invert(last[1]).toFixed(1)} Gt CO₂/yr.`;
    }
  }

  function updateValue() {
    container.value = currentStroke.map(([px, py]) => ({ year: x.invert(px), gt: yBot.invert(py) }));
    container.dispatchEvent(new CustomEvent("input", { bubbles: true }));
  }

  sel.addEventListener("change", () => {
    data = scenarioData(sel.value);
    start = [x(data.startPoint.year), yBot(data.startPoint.gt)];
    currentStroke = [start.slice()];
    drawingFinished = false;
    render();
    updateValue();
  });

  function dragsubject() { return [start.slice()]; }
  function dragged() {
    const s = d3.event.subject;
    const lastX = s[s.length - 1][0];
    if (d3.event.x > lastX) {
      const px = Math.min(d3.event.x, x(YEAR_END));
      const py = Math.max(botT, Math.min(botT + botH, d3.event.y));
      s.push([px, py]);
    }
    currentStroke = s;
    render();
    updateValue();
  }
  d3.select(context.canvas).call(d3.drag()
      .container(context.canvas)
      .subject(dragsubject)
      .on("start", () => { drawingFinished = false; dragged(); })
      .on("drag", dragged)
      .on("end", () => { drawingFinished = true; render(); }));

  render();
  container.value = currentStroke.map(([px, py]) => ({ year: x.invert(px), gt: yBot.invert(py) }));
  return container;
}
