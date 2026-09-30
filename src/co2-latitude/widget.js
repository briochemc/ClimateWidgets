// Where in the world CO₂ is measured, and what it looks like month by month: NOAA's marine
// boundary layer reference as a curve of CO₂ against latitude, the flask-sampling stations
// as dots on it and on an inset map, a clock face for the month, and under them the Mauna
// Loa and South Pole records since 1957 with a scrubber that picks the month. Play sweeps
// the months, which is the point: the northern hemisphere breathes in and out every year,
// and the whole curve climbs, north first. After the first half of Andy Jacobson's NOAA
// animation (https://gml.noaa.gov/ccgg/trends/history.html); the second half, the zoom out
// to the ice ages, is the co2-history widget.
//
// Self-contained on purpose: no d3, no other imports, so the script-tag embed is a single
// ES module import. The data file is built by scripts/co2-history.mjs; see its header for
// the layout of the packed monthly series.

const ACCENT = "#0b57d0";
const MLO_COLOR = "#d62728";
const SPO_COLOR = "#1f4fd6";
const MBL_COLOR = "#333";
const SITE_COLOR = "#8a8f96";
const GHOST_COLOR = "#bbb";
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH
// it stops shrinking and scrolls sideways inside its own wrapper.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;

// Vertical layout is fixed so embed iframe heights stay put: the latitude panel with the
// map beside it, then the time series with the scrubber.
const LAT_T = 10, LAT_H = 230;
const LAT_B = LAT_T + LAT_H;
const SER_T = LAT_B + 46, SER_H = 150;
const SER_B = SER_T + SER_H;
const TOTAL_H = SER_B + 30;

const SWEEP_YEARS_PER_S = 2;     // how fast Play moves through the record

// Unpacks a monthly series {year, month, v: [...]} into [[decimalYear, ppm], ...],
// dropping the missing months.
export function unpackMonthly(packed) {
  if (!packed) return [];
  const out = [];
  const start = packed.year * 12 + (packed.month - 1);
  packed.v.forEach((val, i) => {
    if (val === null) return;
    const m = start + i;
    out.push([Math.floor(m / 12) + ((m % 12) + 0.5) / 12, val]);
  });
  return out;
}

export function createCo2LatitudeWidget({data, width = FIGURE_WIDTH, month = null}) {
  // ---- data -----------------------------------------------------------------------------------
  const mloMonthly = unpackMonthly(data.mlo.monthly);
  const spoMonthly = unpackMonthly(data.spo.monthly);
  const mbl = data.mbl;
  const mblStep = mbl.t.length > 1 ? mbl.t[1] - mbl.t[0] : 1 / 24;
  const sites = data.sites.map(s => ({...s, start: s.year * 12 + (s.month - 1), sinLat: Math.sin(s.lat * Math.PI / 180)}));
  const mloSite = sites.find(s => s.code === "MLO");
  const spoSite = sites.find(s => s.code === "SPO");
  const mloSinLat = mloSite ? mloSite.sinLat : Math.sin(19.54 * Math.PI / 180);
  const landPath = typeof Path2D === "function" && data.land ? new Path2D(data.land) : null;

  // The time axis runs from the first monthly mean to the last, whole years.
  const all = [...mloMonthly, ...spoMonthly];
  const tFirst = Math.floor(Math.min(...all.map(p => p[0])));
  const tLast = Math.max(...all.map(p => p[0]));
  const tEnd = Math.ceil(tLast);
  const firstMonth = Math.floor(Math.min(...all.map(p => p[0])) * 12);
  const lastMonth = Math.floor(tLast * 12);
  // The series' range is fixed for the life of the widget: the scrubber must not move the axes.
  const serLo = Math.floor(Math.min(...all.map(p => p[1])) / 10) * 10 - 5;
  const serHi = Math.ceil(Math.max(...all.map(p => p[1])) / 10) * 10 + 5;

  // The flask network's monthly means and the reference arrive a year or so behind Mauna
  // Loa, so the last months of the series are bare. The widget opens on, and Play ends at,
  // the latest month with the reference and a decent number of stations.
  const tLatestFull = (() => {
    for (let m = lastMonth; m >= firstMonth; m--) {
      const t = (m + 0.5) / 12;
      if (mblProfile(t) && sites.filter(s => s.v[m - s.start] != null).length >= 10) return t;
    }
    return tLast;
  })();

  const ghostProfile = mbl.v.length ? mbl.v[0] : [];
  const ghostAtMlo = ghostProfile.length ? interpProfile(ghostProfile, mloSinLat) : null;
  const ghostLabel = mbl.t.length ? `${MONTHS_LONG[Math.floor((mbl.t[0] % 1) * 12)].slice(0, 3)} ${Math.floor(mbl.t[0])}` : "";

  // ---- state ----------------------------------------------------------------------------------
  let cursorT = month ?? tLatestFull;   // the month shown, as a decimal year
  let hoverSite = null;                 // station under the pointer in the latitude panel
  let dragging = false;
  let latLo = 0, latHi = 1, latTargetLo = 0, latTargetHi = 1, snap = true;   // panel y range, animated

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const buttonCss =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";
  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;align-items:center;gap:8px;padding:0 0 8px;font-size:14px;";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.style.cssText = buttonCss;
  playButton.addEventListener("click", () => (playing ? stopPlay() : startPlay(0)));
  const sliderField = document.createElement("label");
  sliderField.style.cssText = "display:flex;flex:1 1 auto;align-items:center;gap:8px;cursor:pointer;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = firstMonth;
  slider.max = lastMonth;
  slider.step = 1;
  slider.style.cssText = `flex:1 1 120px;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", "Month shown");
  const sliderOut = document.createElement("span");
  sliderOut.style.cssText = "color:#333;min-width:8.5em;text-align:right;font-variant-numeric:tabular-nums;";
  sliderField.append(slider, sliderOut);
  controls.append(playButton, sliderField);
  slider.addEventListener("input", e => {
    e.stopPropagation();
    stopPlay();
    setCursor((Number(slider.value) + 0.5) / 12);
    emit();
  });
  container.appendChild(controls);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;touch-action:pan-y;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Atmospheric CO₂ against latitude for one month, with a map of the stations and the Mauna Loa and South Pole records since 1957");
  const context = canvas.getContext("2d");
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(canvas);
  container.appendChild(scroller);

  const status = document.createElement("div");
  status.style.cssText = "padding:8px 0 0;color:#555;min-height:1.4em;line-height:1.4;";
  container.appendChild(status);

  const HINT_IDLE =
    "Drag across the lower chart, or the slider, to pick a month; hover a dot on the upper " +
    "panel for the station's name.";
  const HINT_PLAY = "Playing through the months — click anything to take over; Play starts it again.";
  const hint = document.createElement("div");
  hint.style.cssText = "padding:4px 0 0;color:#888;font-size:14px;";
  hint.textContent = HINT_IDLE;
  container.appendChild(hint);

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, marginL, marginR, latL, latR, serL, serR, mapL, mapW, mapH, mapT;
  let tickFont, noteFont, labelFont, dotR;

  function applyLayout(newW) {
    w = newW;
    const k = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * k);
    marginL = lerp(44, 56);
    marginR = lerp(12, 20);
    mapW = lerp(120, 230);
    mapH = mapW / 2;
    latL = marginL;
    latR = w - marginR - mapW - lerp(16, 28);
    mapL = w - marginR - mapW;
    mapT = LAT_T + 4;
    serL = marginL;
    serR = w - marginR;
    tickFont = `${lerp(12, 14)}px sans-serif`;
    noteFont = `${lerp(11, 13)}px sans-serif`;
    labelFont = `bold ${lerp(13, 15)}px sans-serif`;
    dotR = lerp(3, 4);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = TOTAL_H * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = TOTAL_H + "px";
    context.scale(dpr, dpr);
  }
  applyLayout(maxW);

  // ---- scales ---------------------------------------------------------------------------------
  const xLat = s => latL + ((s + 1) / 2) * (latR - latL);
  const yLat = v => LAT_B - ((v - latLo) / (latHi - latLo)) * LAT_H;
  const xSer = t => serL + ((t - tFirst) / (tEnd - tFirst)) * (serR - serL);
  xSer.invert = px => tFirst + ((px - serL) / (serR - serL)) * (tEnd - tFirst);
  const ySer = v => SER_B - ((v - serLo) / (serHi - serLo)) * SER_H;

  // ---- lookups --------------------------------------------------------------------------------
  // The boundary-layer profile for a time, interpolated between the reference's steps.
  function mblProfile(t) {
    if (t < mbl.t[0] || t > mbl.t[mbl.t.length - 1]) return null;
    const f = (t - mbl.t[0]) / mblStep;
    const i = Math.min(mbl.t.length - 2, Math.floor(f));
    const k = clamp(f - i, 0, 1);
    return mbl.v[i].map((v, j) => v + (mbl.v[i + 1][j] - v) * k);
  }

  function interpProfile(profile, s) {
    const f = ((s + 1) / 2) * (profile.length - 1);
    const i = Math.min(profile.length - 2, Math.floor(f));
    return profile[i] + (profile[i + 1] - profile[i]) * (f - i);
  }

  function monthIndexOf(t) {
    const year = Math.floor(t);
    return year * 12 + Math.min(11, Math.floor((t - year) * 12));
  }

  // Every station with a monthly mean that month. Mauna Loa and the South Pole come from
  // their own series, in their colours, and are drawn bigger.
  function latitudeData(t) {
    const m = monthIndexOf(t);
    const dots = [];
    for (const s of sites) {
      const v = s.v[m - s.start];
      if (v === null || v === undefined) continue;
      if (s.code === "MLO" || s.code === "SPO") continue;
      dots.push({site: s, v});
    }
    const mloAt = seriesAt(mloMonthly, t), spoAt = seriesAt(spoMonthly, t);
    if (mloAt && mloSite) dots.push({site: mloSite, v: mloAt[1], color: MLO_COLOR, big: true});
    if (spoAt && spoSite) dots.push({site: spoSite, v: spoAt[1], color: SPO_COLOR, big: true});
    return {profile: mblProfile(t), dots, mloAt, spoAt};
  }

  function seriesAt(pts, t) {
    if (!pts.length) return null;
    const i = lowerBound(pts, t);
    const cands = [pts[i - 1], pts[i]].filter(Boolean);
    let best = null;
    for (const p of cands) if (!best || Math.abs(p[0] - t) < Math.abs(best[0] - t)) best = p;
    return best && Math.abs(best[0] - t) < 1 / 12 + 1e-6 ? best : null;
  }

  function latTargetRange(profile, dots) {
    let lo = Infinity, hi = -Infinity;
    const take = v => { if (v < lo) lo = v; if (v > hi) hi = v; };
    for (const v of ghostProfile) take(v);
    if (profile) for (const v of profile) take(v);
    for (const d of dots) take(d.v);
    if (!Number.isFinite(lo)) { lo = 300; hi = 450; }
    const pad = Math.max(3, (hi - lo) * 0.1);
    return [lo - pad, hi + pad * 1.5];
  }

  // ---- rendering ------------------------------------------------------------------------------
  let raf = null;
  function requestRender() { if (raf === null) raf = requestAnimationFrame(frame); }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let lastFrame = 0;
  let latFrame = {profile: null, dots: [], mloAt: null, spoAt: null};
  function frame(now) {
    raf = null;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    latFrame = latitudeData(cursorT);
    [latTargetLo, latTargetHi] = latTargetRange(latFrame.profile, latFrame.dots);
    // The panel's range chases its target; it snaps on the first frame and under reduced motion.
    const rate = snap || reduceMotion ? 1 : 1 - Math.exp(-dt * 10);
    latLo += (latTargetLo - latLo) * rate;
    latHi += (latTargetHi - latHi) * rate;
    snap = false;
    render();
    if (Math.abs(latTargetLo - latLo) + Math.abs(latTargetHi - latHi) >= 0.05) requestRender();
    else { latLo = latTargetLo; latHi = latTargetHi; lastFrame = 0; }
  }

  function render() {
    context.clearRect(0, 0, w, TOTAL_H);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, TOTAL_H);
    drawLatitudePanel();
    drawMap();
    drawSeries();
    updateStatus();
    playButton.textContent = playing ? "Pause" : "Play";
    playButton.style.borderColor = playing ? ACCENT : "#ccc";
    playButton.style.color = playing ? ACCENT : "#333";
    playButton.setAttribute("aria-pressed", playing);
    slider.value = monthIndexOf(cursorT);
    sliderOut.textContent = formatMonth(cursorT);
  }

  function drawLatitudePanel() {
    const {profile, dots} = latFrame;

    // Gridlines: every 30° of latitude, on the sine scale.
    const latTicks = [[-1, "90°S"], [-0.5, "30°S"], [0, "Equator"], [0.5, "30°N"], [1, "90°N"]];
    const yt = yTicks(latLo, latHi, LAT_H);
    context.strokeStyle = "rgba(0,0,0,0.1)";
    context.lineWidth = 1;
    for (const v of yt) line(latL, yLat(v), latR, yLat(v));
    for (const [s] of latTicks) line(xLat(s), LAT_T, xLat(s), LAT_B);

    context.save();
    context.beginPath();
    context.rect(latL - 6, LAT_T - 8, latR - latL + 12, LAT_H + 16);
    context.clip();

    // The first profile of the reference stays as a ghost, so the climb since is visible.
    if (ghostProfile.length) {
      context.strokeStyle = GHOST_COLOR;
      context.lineWidth = 1.5;
      strokeProfile(ghostProfile);
      context.fillStyle = "#c98a9c";
      context.beginPath();
      context.arc(xLat(mloSinLat), yLat(ghostAtMlo), dotR, 0, 2 * Math.PI);
      context.fill();
      context.font = noteFont;
      context.textBaseline = "top";
      const ghostText = `${ghostLabel}: ${Math.round(ghostAtMlo)} ppm`;
      const fits = xLat(mloSinLat) + 7 + context.measureText(ghostText).width <= latR;
      context.textAlign = fits ? "left" : "right";
      context.fillStyle = "#999";
      context.fillText(ghostText, xLat(mloSinLat) + (fits ? 7 : -7), yLat(ghostAtMlo) + 2);
    }

    if (profile) {
      context.strokeStyle = MBL_COLOR;
      context.lineWidth = 2;
      strokeProfile(profile);
    }

    for (const d of dots) {
      if (d.big) continue;
      context.fillStyle = d.site === hoverSite ? ACCENT : SITE_COLOR;
      context.strokeStyle = "#fff";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(xLat(d.site.sinLat), yLat(d.v), dotR - 1, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }
    for (const d of dots) {
      if (!d.big) continue;
      context.fillStyle = d.color;
      context.strokeStyle = "#fff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(xLat(d.site.sinLat), yLat(d.v), dotR + 1, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }
    // Name the two coloured dots, once, beside them.
    context.font = noteFont;
    context.textBaseline = "bottom";
    for (const d of dots) {
      if (!d.big) continue;
      context.fillStyle = d.color;
      const left = d.site.sinLat < 0;
      context.textAlign = left ? "left" : "right";
      context.fillText(d.site.code === "MLO" ? "Mauna Loa" : "South Pole",
        xLat(d.site.sinLat) + (left ? dotR + 4 : -dotR - 4), yLat(d.v) - 2);
    }
    context.restore();

    // Axes.
    context.strokeStyle = "#666"; context.fillStyle = "#333";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(latL, LAT_T); context.lineTo(latL, LAT_B); context.lineTo(latR, LAT_B);
    context.stroke();
    context.font = tickFont;
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yt) {
      line(latL - 4, yLat(v), latL, yLat(v));
      context.fillText(v, latL - 7, yLat(v));
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (const [s, label] of latTicks) {
      line(xLat(s), LAT_B, xLat(s), LAT_B + 5);
      context.fillText(label, clamp(xLat(s), latL + 16, latR - 16), LAT_B + 8);
    }
    context.save();
    context.translate(12, LAT_T + LAT_H / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center"; context.textBaseline = "top";
    context.fillText("CO₂ (ppm)", 0, 0);
    context.restore();

    // A word on what is missing before the reference begins.
    if (!profile) {
      context.font = noteFont;
      context.fillStyle = "#777";
      context.textAlign = "center"; context.textBaseline = "top";
      const msg = dots.length === 0 ? "No station data this month" : "NOAA's background reference begins in 1979";
      context.fillText(msg, (latL + latR) / 2, LAT_T + 4);
    }
  }

  function strokeProfile(profile) {
    context.beginPath();
    profile.forEach((v, j) => {
      const s = mbl.sinlat[j];
      if (j) context.lineTo(xLat(s), yLat(v)); else context.moveTo(xLat(s), yLat(v));
    });
    context.stroke();
  }

  // The inset map, the month's name and a clock face with one hand for the month.
  function drawMap() {
    const {dots} = latFrame;
    context.fillStyle = "#e6eef6";
    context.fillRect(mapL, mapT, mapW, mapH);
    if (landPath) {
      context.save();
      context.beginPath();
      context.rect(mapL, mapT, mapW, mapH);
      context.clip();
      context.translate(mapL, mapT);
      context.scale(mapW / 360, mapH / 180);
      context.fillStyle = "#c9d3c0";
      context.fill(landPath);
      context.restore();
    }
    context.strokeStyle = "#bbb";
    context.lineWidth = 1;
    context.strokeRect(mapL + 0.5, mapT + 0.5, mapW - 1, mapH - 1);
    const px = lon => mapL + ((lon + 180) / 360) * mapW;
    const py = lat => mapT + ((90 - lat) / 180) * mapH;
    for (const pass of [false, true]) {
      for (const d of dots) {
        if (!!d.big !== pass || d.site.lon === null) continue;
        context.fillStyle = d.color ?? (d.site === hoverSite ? ACCENT : SITE_COLOR);
        context.strokeStyle = "#fff";
        context.lineWidth = 0.8;
        context.beginPath();
        context.arc(px(d.site.lon), py(d.site.lat), d.big ? 3.5 : 2.2, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      }
    }

    // Month and year, then the clock: January at twelve o'clock, clockwise.
    const year = Math.floor(cursorT);
    const month = Math.min(11, Math.floor((cursorT - year) * 12));
    context.font = labelFont;
    context.fillStyle = "#222";
    context.textAlign = "left"; context.textBaseline = "top";
    const textY = mapT + mapH + 10;
    context.fillText(`${MONTHS_LONG[month]} ${year}`, mapL, textY);

    const cr = Math.min(22, (LAT_B - textY - 40) / 2), cx = mapL + cr + 14, cy = textY + 36 + cr;
    if (cr >= 12) {
      context.strokeStyle = "#999";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(cx, cy, cr, 0, 2 * Math.PI);
      context.stroke();
      context.font = noteFont;
      context.fillStyle = "#777";
      context.textAlign = "center"; context.textBaseline = "bottom";
      context.fillText("Jan", cx, cy - cr - 2);
      context.textBaseline = "top";
      context.fillText("Jul", cx, cy + cr + 2);
      context.textAlign = "left"; context.textBaseline = "middle";
      context.fillText("Apr", cx + cr + 4, cy);
      context.textAlign = "right";
      context.fillText("Oct", cx - cr - 4, cy);
      const angle = ((month + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
      context.strokeStyle = "#222";
      context.lineWidth = 2;
      line(cx, cy, cx + Math.cos(angle) * (cr - 3), cy + Math.sin(angle) * (cr - 3));
      context.lineWidth = 1;
    }
  }

  // The two long records, with the scrubber over the month shown.
  function drawSeries() {
    const yt = yTicks(serLo, serHi, SER_H);
    const step = (serR - serL) >= 400 ? 10 : 20;
    context.strokeStyle = "rgba(0,0,0,0.1)";
    context.lineWidth = 1;
    for (const v of yt) line(serL, ySer(v), serR, ySer(v));
    for (let yr = Math.ceil(tFirst / step) * step; yr <= tEnd; yr += step) line(xSer(yr), SER_T, xSer(yr), SER_B);

    strokeSeries(spoMonthly, SPO_COLOR);
    strokeSeries(mloMonthly, MLO_COLOR);

    // Scrubber: a rule at the month, its two values as dots, a handle below the axis.
    const sx = xSer(cursorT);
    context.strokeStyle = "rgba(0,0,0,0.45)";
    line(sx, SER_T, sx, SER_B);
    for (const [p, color] of [[latFrame.mloAt, MLO_COLOR], [latFrame.spoAt, SPO_COLOR]]) {
      if (!p) continue;
      context.fillStyle = color;
      context.strokeStyle = "#fff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(sx, ySer(p[1]), dotR, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }
    context.fillStyle = ACCENT;
    context.beginPath();
    context.moveTo(sx, SER_B + 1);
    context.lineTo(sx - 6, SER_B + 10);
    context.lineTo(sx + 6, SER_B + 10);
    context.closePath();
    context.fill();

    // Axes.
    context.strokeStyle = "#666"; context.fillStyle = "#333";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(serL, SER_T); context.lineTo(serL, SER_B); context.lineTo(serR, SER_B);
    context.stroke();
    context.font = tickFont;
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yt) {
      line(serL - 4, ySer(v), serL, ySer(v));
      context.fillText(v, serL - 7, ySer(v));
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (let yr = Math.ceil(tFirst / step) * step; yr <= tEnd; yr += step) {
      line(xSer(yr), SER_B, xSer(yr), SER_B + 5);
      context.fillText(yr, xSer(yr), SER_B + 12);
    }

    // Legend, top left, where the rising curves leave room.
    context.font = noteFont;
    context.textAlign = "left"; context.textBaseline = "middle";
    [["Mauna Loa", MLO_COLOR], ["South Pole", SPO_COLOR]].forEach(([name, color], i) => {
      const ly = SER_T + 12 + i * 15;
      context.fillStyle = color;
      context.fillRect(serL + 8, ly - 1.5, 14, 3);
      context.fillStyle = "#333";
      context.fillText(name, serL + 27, ly);
    });
  }

  function strokeSeries(pts, color) {
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.lineJoin = "round";
    context.beginPath();
    pts.forEach(([t, v], i) => (i ? context.lineTo(xSer(t), ySer(v)) : context.moveTo(xSer(t), ySer(v))));
    context.stroke();
    context.lineWidth = 1;
  }

  // ---- ticks and formatting -------------------------------------------------------------------
  function yTicks(lo, hi, height) {
    const target = Math.max(2, Math.floor(height / 45));
    const raw = (hi - lo) / target;
    const step = [1, 2, 5, 10, 20, 25, 50, 100].find(s => s >= raw) ?? 100;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  }

  function formatMonth(t) {
    return `${MONTHS_LONG[Math.min(11, Math.floor((t - Math.floor(t)) * 12))]} ${Math.floor(t)}`;
  }

  function updateStatus() {
    if (hoverSite) {
      const v = hoverSite.v[monthIndexOf(cursorT) - hoverSite.start];
      status.textContent = `${hoverSite.name} (${hoverSite.code}), ${formatMonth(cursorT)}: ${v} ppm`;
      return;
    }
    const {profile, mloAt, spoAt, dots} = latFrame;
    const parts = [];
    if (mloAt) parts.push(`Mauna Loa ${mloAt[1].toFixed(1)} ppm`);
    if (spoAt) parts.push(`South Pole ${spoAt[1].toFixed(1)} ppm`);
    // The reference's bins are equal in sine latitude, so their plain mean is the area-weighted global one.
    if (profile) parts.push(`global surface mean ${(profile.reduce((s, v) => s + v, 0) / profile.length).toFixed(1)} ppm`);
    const n = dots.filter(d => !d.big).length;
    const others = n ? `${n} other station${n === 1 ? "" : "s"} reporting` : "no other stations reported yet";
    status.textContent = `${formatMonth(cursorT)}: ${parts.join(", ")}${parts.length ? "; " : ""}${others}.`;
  }

  // ---- state changes --------------------------------------------------------------------------
  function setCursor(t) {
    cursorT = clamp(t, (firstMonth + 0.5) / 12, tLast);
    requestRender();
  }

  // ---- pointer --------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (TOTAL_H / r.height)};
  }
  const onSeries = (px, py) => py >= SER_T - 8 && py <= SER_B + 26 && px >= serL - 8 && px <= serR + 8;

  canvas.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    if (!onSeries(px, py)) return;
    stopPlay();
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    setCursor(xSer.invert(px));
    emit();
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", e => {
    const {px, py} = pointerAt(e);
    if (dragging) { setCursor(xSer.invert(px)); emit(); return; }
    if (onSeries(px, py)) {
      canvas.style.cursor = "ew-resize";
      if (hoverSite) { hoverSite = null; requestRender(); }
      return;
    }
    if (!playing && py >= LAT_T - 8 && py <= LAT_B + 8 && px >= latL && px <= latR) {
      const near = nearestSite(px, py);
      if (near !== hoverSite) { hoverSite = near; requestRender(); }
      canvas.style.cursor = near ? "pointer" : "default";
      return;
    }
    if (hoverSite) { hoverSite = null; requestRender(); }
    canvas.style.cursor = "default";
  });
  for (const type of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(type, e => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
    });
  }
  canvas.addEventListener("pointerleave", () => {
    if (hoverSite) { hoverSite = null; requestRender(); }
  });

  function nearestSite(px, py) {
    let best = null, bestD = 100;   // 10 px
    for (const d of latFrame.dots) {
      if (d.big) continue;
      const dx = xLat(d.site.sinLat) - px, dy = yLat(d.v) - py;
      const dd = dx * dx + dy * dy;
      if (dd < bestD) { bestD = dd; best = d.site; }
    }
    return best;
  }

  // ---- play -----------------------------------------------------------------------------------
  // Sweeps the months from where the scrubber is (or from the start, if it is at the end) to
  // the latest month, then stops. It starts by itself once the figure is in view, and any
  // click or drag ends it, because a control that moves under your cursor is maddening.
  const PLAY_DELAY = 1500;
  let playing = false, playTimer = null, playFrame = null, playWatcher = null;

  function stopPlay() {
    playWatcher?.disconnect();
    playWatcher = null;
    if (!playing) return;
    playing = false;
    clearTimeout(playTimer);
    cancelAnimationFrame(playFrame);
    playTimer = playFrame = null;
    hint.textContent = HINT_IDLE;
    requestRender();
  }

  function startPlay(delay = PLAY_DELAY) {
    if (playing) return;
    playWatcher?.disconnect();
    playWatcher = null;
    playing = true;
    hoverSite = null;
    hint.textContent = HINT_PLAY;
    requestRender();
    playTimer = setTimeout(sweep, delay);
  }

  function sweep() {
    if (!playing) return;
    if (container.isConnected === false) return stopPlay();
    const from = cursorT >= tLatestFull - 1 / 12 ? (firstMonth + 0.5) / 12 : cursorT;
    const to = tLatestFull;
    const duration = reduceMotion ? 0 : ((to - from) / SWEEP_YEARS_PER_S) * 1000;
    const start = performance.now();
    const step = now => {
      if (!playing) return;
      const k = duration ? Math.min(1, (now - start) / duration) : 1;
      setCursor(from + (to - from) * k);
      if (k < 1) playFrame = requestAnimationFrame(step);
      else { playing = false; hint.textContent = HINT_IDLE; emit(); requestRender(); }
    };
    playFrame = requestAnimationFrame(step);
  }

  // ---- value ----------------------------------------------------------------------------------
  function value() {
    const m = monthIndexOf(cursorT);
    return {year: Math.floor(m / 12), month: (m % 12) + 1, time: cursorT, playing};
  }
  function emit() {
    container.value = value();
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  // ---- go -------------------------------------------------------------------------------------
  setCursor(cursorT);
  container.value = value();

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); requestRender(); }
    });
    ro.observe(container);
  }

  // Not under reduced motion, and not before the figure has scrolled into view.
  if (!reduceMotion && typeof requestAnimationFrame === "function") {
    if (typeof IntersectionObserver === "function") {
      playWatcher = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        playWatcher.disconnect();
        playWatcher = null;
        startPlay();
      }, {threshold: 0.3});
      playWatcher.observe(container);
    } else {
      startPlay();
    }
  }

  return container;

  // ---- canvas helpers (closures over `context`) -----------------------------------------------
  function line(x0, y0, x1, y1) {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  }
}

// ---- helpers ------------------------------------------------------------------------------------

// First index whose time is >= t, in an array of [t, ...] rows sorted by t.
function lowerBound(pts, t) {
  let lo = 0, hi = pts.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][0] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
