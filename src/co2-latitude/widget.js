// Where in the world CO₂ is measured, and what it looks like month by month. A world map
// (Equal Earth) with the flask-sampling stations on it; to its right, and lined up with its
// parallels, a thin plot of CO₂ against latitude with NOAA's marine boundary layer reference
// as a curve and the stations as dots; and under both the Mauna Loa and South Pole records
// since 1957 with a scrubber that picks the month, and a clock face for the month that rides
// along the Mauna Loa curve. Play sweeps the months, which is the point: the northern
// hemisphere breathes in and out every year, and the whole curve climbs, north first. As it
// sweeps, the January curve of each decade's first year (1980, 1990, ...) stays behind as a
// light grey trace, so the climb is always in view; the traces fade the moment the reader
// takes over. After the first half of Andy Jacobson's NOAA animation
// (https://gml.noaa.gov/ccgg/trends/history.html); the second half, the zoom out to the ice
// ages, is the co2-history widget.
//
// The three panels share their edges: the map's left edge is the time series' y axis, and
// the latitude plot's right edge is the time series' right end. The CO₂ scale is one fixed
// range for the latitude plot and the time series alike, set once from the whole record, so
// nothing rescales as the months go by.
//
// The map needs d3-geo (the projection, and the clipping at the antimeridian that a hand-made
// plate carrée smeared across) and topojson-client, both from a CDN, and the land outline
// from the repo's countries-110m.json, passed in as `world`; everything else is self-made.
// The data file is built by scripts/co2-history.mjs; see its header for the layout of the
// packed monthly series.

import {geoEqualEarth, geoPath} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

const ACCENT = "#0b57d0";
const MLO_COLOR = "#d62728";
const SPO_COLOR = "#1f4fd6";
const MBL_COLOR = "#333";
const SITE_COLOR = "#8a8f96";
const TRACE_COLOR = "#b5b5b5";
const MUTED = "#9a9a9a";
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];

// The figure fills its container up to FIGURE_WIDTH and reflows below it; below MIN_WIDTH
// it stops shrinking and scrolls sideways inside its own wrapper. The map keeps Equal Earth's
// own shape (about 2:1), so the height follows the width.
const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const ROW_T = 10;                // top of the map and the latitude plot
const SER_H = 160;               // height of the time series
const SWEEP_YEARS_PER_S = 2;     // how fast Play moves through the record
const TRACE_FADE_MS = 600;       // how long the decade traces take to go

const SPHERE = {type: "Sphere"};
const PARALLEL_LATS = [-60, -30, 0, 30, 60];
const PARALLELS = Object.fromEntries(PARALLEL_LATS.map(lat => [lat, {
  type: "LineString",
  coordinates: Array.from({length: 181}, (_, i) => [-180 + 2 * i, lat]),
}]));

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

export function createCo2LatitudeWidget({data, world, width = FIGURE_WIDTH, month = null}) {
  // ---- data -----------------------------------------------------------------------------------
  const mloMonthly = unpackMonthly(data.mlo.monthly);
  const spoMonthly = unpackMonthly(data.spo.monthly);
  const mbl = data.mbl;
  const mblStep = mbl.t.length > 1 ? mbl.t[1] - mbl.t[0] : 1 / 24;
  const mblLat = mbl.sinlat.map(s => Math.asin(clamp(s, -1, 1)) * 180 / Math.PI);
  const sites = data.sites.map(s => ({...s, start: s.year * 12 + (s.month - 1)}));
  const mloSite = sites.find(s => s.code === "MLO");
  const spoSite = sites.find(s => s.code === "SPO");
  const land = world?.objects?.land ? feature(world, world.objects.land) : null;

  // The time axis runs from the first monthly mean to the last, whole years.
  const all = [...mloMonthly, ...spoMonthly];
  const tFirst = Math.floor(Math.min(...all.map(p => p[0])));
  const tLast = Math.max(...all.map(p => p[0]));
  const tEnd = Math.ceil(tLast);
  const firstMonth = Math.floor(Math.min(...all.map(p => p[0])) * 12);
  const lastMonth = Math.floor(tLast * 12);

  // One CO₂ range for the whole widget and the whole record, shared by the latitude plot and
  // the time series and fixed at load, so nothing rescales as the months go by: the two long
  // records, the reference, and the stations short of their rare outliers.
  const [co2Lo, co2Hi] = (() => {
    const vals = [...all.map(p => p[1])];
    for (const row of mbl.v) for (const v of row) vals.push(v);
    const siteVals = sites.flatMap(s => s.v.filter(v => v !== null)).sort((a, b) => a - b);
    if (siteVals.length) vals.push(siteVals[Math.floor(siteVals.length * 0.005)], siteVals[Math.floor(siteVals.length * 0.995)]);
    return [Math.floor(Math.min(...vals) / 10) * 10, Math.ceil(Math.max(...vals) / 10) * 10];
  })();

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

  // ---- state ----------------------------------------------------------------------------------
  let cursorT = month ?? tLatestFull;   // the month shown, as a decimal year
  let hoverSite = null;                 // station under the pointer
  let dragging = false;
  let traces = [];                      // {year, profile, mloAt, spoAt}: the decade Januaries Play has passed
  let traceFade = null;                 // when the traces started fading, or null

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText = "font:16px sans-serif;color:#333;";

  const controls = document.createElement("div");
  controls.style.cssText = "display:flex;align-items:center;gap:8px;padding:0 0 8px;font-size:14px;";
  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.style.cssText =
    "font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;";
  playButton.addEventListener("click", () => (playing ? stopPlay() : startPlay(0)));
  controls.append(playButton);
  container.appendChild(controls);

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;touch-action:pan-y;";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "A world map of the CO₂ stations, CO₂ against latitude for one month, and the Mauna Loa and South Pole records since 1957");
  const context = canvas.getContext("2d");
  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  scroller.appendChild(canvas);
  container.appendChild(scroller);

  // The month slider sits under the time series, its track exactly as wide as the series'
  // axis (laid out in applyLayout), so the thumb is over the month it picks.
  const sliderRow = document.createElement("div");
  sliderRow.style.cssText = "position:relative;height:24px;";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = firstMonth;
  slider.max = lastMonth;
  slider.step = 1;
  slider.style.cssText = `position:absolute;top:0;margin:0;accent-color:${ACCENT};cursor:pointer;`;
  slider.setAttribute("aria-label", "Month shown");
  sliderRow.appendChild(slider);
  slider.addEventListener("input", e => {
    e.stopPropagation();
    stopPlay();
    fadeTraces();
    setCursor((Number(slider.value) + 0.5) / 12);
    emit();
  });
  container.appendChild(sliderRow);

  // ---- layout ---------------------------------------------------------------------------------
  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, totalH, mapL, mapW, mapH, rowB, latL, latW, latR, serL, serR, serT, serB;
  let tickFont, noteFont, labelFont, mutedFont, dotR;
  let projection, mapPath;

  function applyLayout(newW) {
    w = newW;
    const k = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => Math.round(a + (b - a) * k);
    // The time series' axis box sets the edges for everything: its y axis is the map's left
    // edge, and its right end is the latitude plot's right edge, with the latitude labels
    // beyond that.
    const gap = lerp(10, 16), latLabels = lerp(30, 38), edge = 8;
    serL = lerp(52, 62);
    serR = w - edge - latLabels;
    mapL = serL;
    latR = serR;
    const avail = serR - serL - gap;
    mapW = Math.round(avail * 0.66);
    latL = mapL + mapW + gap;
    latW = latR - latL;
    // Equal Earth, as wide as the map's slot, its top left at the row's top left.
    projection = geoEqualEarth().fitWidth(mapW, SPHERE);
    const bounds = geoPath(projection).bounds(SPHERE);
    const [tx, ty] = projection.translate();
    projection.translate([tx - bounds[0][0] + mapL, ty - bounds[0][1] + ROW_T]);
    mapPath = geoPath(projection, context);
    mapH = Math.round(bounds[1][1] - bounds[0][1]);
    rowB = ROW_T + mapH;
    serT = rowB + 44;
    serB = serT + SER_H;
    totalH = serB + 30;
    // The thumb's centre reaches half a thumb short of the track's ends, so the track
    // overhangs the axis by that much on each side.
    slider.style.left = `${serL - 8}px`;
    slider.style.width = `${serR - serL + 16}px`;
    tickFont = `${lerp(12, 14)}px sans-serif`;
    noteFont = `${lerp(11, 13)}px sans-serif`;
    mutedFont = `${lerp(10, 11)}px sans-serif`;
    labelFont = `bold ${lerp(12, 14)}px sans-serif`;
    dotR = lerp(3, 4);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = totalH + "px";
    context.scale(dpr, dpr);
  }
  applyLayout(maxW);

  // ---- scales ---------------------------------------------------------------------------------
  // Equal Earth's parallels are straight and level, so one height per latitude serves the
  // map and the latitude plot alike.
  const mapY = lat => projection([0, lat])[1];
  const mapPoint = (lon, lat) => projection([lon, lat]);
  const xLat = v => latL + ((v - co2Lo) / (co2Hi - co2Lo)) * latW;
  const xSer = t => serL + ((t - tFirst) / (tEnd - tFirst)) * (serR - serL);
  xSer.invert = px => tFirst + ((px - serL) / (serR - serL)) * (tEnd - tFirst);
  const ySer = v => serB - ((v - co2Lo) / (co2Hi - co2Lo)) * SER_H;

  // ---- lookups --------------------------------------------------------------------------------
  // The boundary-layer profile for a time, interpolated between the reference's steps.
  function mblProfile(t) {
    if (t < mbl.t[0] || t > mbl.t[mbl.t.length - 1]) return null;
    const f = (t - mbl.t[0]) / mblStep;
    const i = Math.min(mbl.t.length - 2, Math.floor(f));
    const k = clamp(f - i, 0, 1);
    return mbl.v[i].map((v, j) => v + (mbl.v[i + 1][j] - v) * k);
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

  // ---- rendering ------------------------------------------------------------------------------
  let raf = null;
  function requestRender() { if (raf === null) raf = requestAnimationFrame(render); }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  let latFrame = {profile: null, dots: [], mloAt: null, spoAt: null};
  let traceAlpha = 1;

  function render(now = performance.now()) {
    raf = null;
    if (traceFade !== null) {
      traceAlpha = reduceMotion ? 0 : 1 - (now - traceFade) / TRACE_FADE_MS;
      if (traceAlpha <= 0) { traces = []; traceFade = null; traceAlpha = 1; }
      else requestRender();
    }
    latFrame = latitudeData(cursorT);
    context.clearRect(0, 0, w, totalH);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, w, totalH);
    drawMap();
    drawLatitudePlot();
    drawSeries();
    playButton.textContent = playing ? "Pause" : "Play";
    playButton.style.borderColor = playing ? ACCENT : "#ccc";
    playButton.style.color = playing ? ACCENT : "#333";
    playButton.setAttribute("aria-pressed", playing);
    slider.value = monthIndexOf(cursorT);
  }

  // The map: ocean, land, faint parallels every 30° (which the latitude plot shares), and
  // the stations reporting this month, the one under the pointer named.
  function drawMap() {
    const {dots} = latFrame;
    context.beginPath();
    mapPath(SPHERE);
    context.fillStyle = "#e6eef6";
    context.fill();
    if (land) {
      context.beginPath();
      mapPath(land);
      context.fillStyle = "#c9d3c0";
      context.fill();
    }
    context.lineWidth = 1;
    for (const lat of PARALLEL_LATS) {
      context.beginPath();
      mapPath(PARALLELS[lat]);
      context.strokeStyle = lat === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.1)";
      context.stroke();
    }
    context.beginPath();
    mapPath(SPHERE);
    context.strokeStyle = "#bbb";
    context.stroke();
    for (const pass of [false, true]) {
      for (const d of dots) {
        if (!!d.big !== pass || d.site.lon === null) continue;
        const [x, y] = mapPoint(d.site.lon, d.site.lat);
        context.fillStyle = d.color ?? (d.site === hoverSite ? ACCENT : SITE_COLOR);
        context.strokeStyle = "#fff";
        context.lineWidth = 0.8;
        context.beginPath();
        context.arc(x, y, d.big ? 3.5 : 2.4, 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      }
    }
    if (hoverSite && hoverSite.lon !== null) {
      const [x, y] = mapPoint(hoverSite.lon, hoverSite.lat);
      nameSite(hoverSite, x, y, mapL, latR);
    }
  }

  // A station's name beside its dot, haloed, kept inside [x0, x1].
  function nameSite(site, x, y, x0, x1) {
    context.font = noteFont;
    context.fillStyle = "#222";
    context.textBaseline = "middle";
    const text = `${site.name} (${site.code})`;
    const width = context.measureText(text).width;
    const right = x + 7 + width <= x1;
    context.textAlign = right ? "left" : "right";
    haloText(text, right ? x + 7 : Math.max(x0 + width, x - 7), y);
  }

  // CO₂ across, latitude up, on the map's own vertical scale; the axes are kept quiet because
  // the parallels on the map already say where the latitudes are. The decade traces go
  // under the month's curve, each named at its northern end.
  function drawLatitudePlot() {
    const {profile, dots} = latFrame;
    context.lineWidth = 1;
    for (const lat of PARALLEL_LATS) {
      context.strokeStyle = lat === 0 ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.1)";
      line(latL, mapY(lat), latR, mapY(lat));
    }
    const co2Ticks = co2TickValues(latW);
    context.strokeStyle = "rgba(0,0,0,0.08)";
    for (const v of co2Ticks) line(xLat(v), ROW_T, xLat(v), rowB);

    context.save();
    context.beginPath();
    context.rect(latL - 5, ROW_T - 6, latW + 10, mapH + 12);
    context.clip();
    context.globalAlpha = traceAlpha;
    context.font = mutedFont;
    // The years are a decade apart but only a dozen pixels apart on this scale, so their
    // labels alternate between two rows.
    traces.forEach((tr, i) => {
      const row = (i % 2) * 11;
      if (tr.profile) {
        context.strokeStyle = TRACE_COLOR;
        context.lineWidth = 1.5;
        strokeProfile(tr.profile);
        context.fillStyle = "#888";
        context.textAlign = "center"; context.textBaseline = "top";
        haloText(tr.year, xLat(tr.profile[tr.profile.length - 1]), ROW_T + 3 + row);
      } else {
        // Before the reference begins there is no curve to leave, only the two long records.
        context.fillStyle = TRACE_COLOR;
        for (const [p, site] of [[tr.mloAt, mloSite], [tr.spoAt, spoSite]]) {
          if (!p || !site) continue;
          context.beginPath();
          context.arc(xLat(p[1]), mapY(site.lat), dotR - 0.5, 0, 2 * Math.PI);
          context.fill();
        }
        if (tr.mloAt && mloSite) {
          context.fillStyle = "#888";
          context.textAlign = "left"; context.textBaseline = "middle";
          haloText(tr.year, xLat(tr.mloAt[1]) + 5, mapY(mloSite.lat) - 6 + row);
        }
      }
    });
    context.globalAlpha = 1;
    if (profile) {
      context.strokeStyle = MBL_COLOR;
      context.lineWidth = 2;
      strokeProfile(profile);
    }
    const small = mapH < 140;
    for (const pass of [false, true]) {
      for (const d of dots) {
        if (!!d.big !== pass) continue;
        context.fillStyle = d.color ?? (d.site === hoverSite ? ACCENT : SITE_COLOR);
        context.strokeStyle = "#fff";
        context.lineWidth = d.big ? 1.5 : 1;
        context.beginPath();
        context.arc(xLat(d.v), mapY(d.site.lat), (d.big ? dotR + 1 : dotR - 1) - (small ? 0.5 : 0), 0, 2 * Math.PI);
        context.fill();
        context.stroke();
      }
    }
    context.restore();
    const hovered = hoverSite && dots.find(d => d.site === hoverSite);
    if (hovered) nameSite(hoverSite, xLat(hovered.v), mapY(hoverSite.lat), mapL, w - 4);

    // Muted axes: a frame, CO₂ ticks along the bottom, latitudes down the right.
    context.strokeStyle = "#ccc";
    context.lineWidth = 1;
    context.strokeRect(latL + 0.5, ROW_T + 0.5, latW - 1, mapH - 1);
    context.font = mutedFont;
    context.fillStyle = MUTED;
    context.textAlign = "center"; context.textBaseline = "top";
    for (const v of co2Ticks) {
      line(xLat(v), rowB, xLat(v), rowB + 3);
      context.fillText(v, xLat(v), rowB + 5);
    }
    context.textAlign = "left";
    context.fillText("ppm", latR + 4, rowB + 5);
    context.textAlign = "left"; context.textBaseline = "middle";
    const latLabels = small ? [[60, "60°N"], [0, "0°"], [-60, "60°S"]]
      : [[60, "60°N"], [30, "30°N"], [0, "0°"], [-30, "30°S"], [-60, "60°S"]];
    for (const [lat, label] of latLabels) {
      line(latR, mapY(lat), latR + 3, mapY(lat));
      context.fillText(label, latR + 5, mapY(lat));
    }
  }

  function strokeProfile(profile) {
    context.beginPath();
    profile.forEach((v, j) => {
      if (j) context.lineTo(xLat(v), mapY(mblLat[j])); else context.moveTo(xLat(v), mapY(mblLat[j]));
    });
    context.stroke();
  }

  // The two long records, the scrubber over the month shown, and the clock riding the curve.
  function drawSeries() {
    const yt = co2TickValues(SER_H, true);
    const step = (serR - serL) >= 400 ? 10 : 20;
    context.strokeStyle = "rgba(0,0,0,0.1)";
    context.lineWidth = 1;
    for (const v of yt) line(serL, ySer(v), serR, ySer(v));
    for (let yr = Math.ceil(tFirst / step) * step; yr <= tEnd; yr += step) line(xSer(yr), serT, xSer(yr), serB);

    context.save();
    context.beginPath();
    context.rect(serL, serT - 1, serR - serL, SER_H + 2);
    context.clip();

    strokeSeries(spoMonthly, SPO_COLOR);
    strokeSeries(mloMonthly, MLO_COLOR);

    const sx = xSer(cursorT);
    context.strokeStyle = "rgba(0,0,0,0.45)";
    context.lineWidth = 1;
    line(sx, serT, sx, serB);
    for (const [p, color] of [[latFrame.spoAt, SPO_COLOR], [latFrame.mloAt, MLO_COLOR]]) {
      if (!p) continue;
      context.fillStyle = color;
      context.strokeStyle = "#fff";
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(sx, ySer(p[1]), dotR, 0, 2 * Math.PI);
      context.fill();
      context.stroke();
    }
    drawClock(sx);
    context.restore();

    // Scrubber handle below the axis.
    context.fillStyle = ACCENT;
    context.beginPath();
    context.moveTo(sx, serB + 1);
    context.lineTo(sx - 6, serB + 10);
    context.lineTo(sx + 6, serB + 10);
    context.closePath();
    context.fill();

    // Axes.
    context.strokeStyle = "#666"; context.fillStyle = "#333";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(serL, serT); context.lineTo(serL, serB); context.lineTo(serR, serB);
    context.stroke();
    context.font = tickFont;
    context.textAlign = "right"; context.textBaseline = "middle";
    for (const v of yt) {
      line(serL - 4, ySer(v), serL, ySer(v));
      context.fillText(v, serL - 7, ySer(v));
    }
    context.textAlign = "center"; context.textBaseline = "top";
    for (let yr = Math.ceil(tFirst / step) * step; yr <= tEnd; yr += step) {
      line(xSer(yr), serB, xSer(yr), serB + 5);
      context.fillText(yr, xSer(yr), serB + 12);
    }
    context.save();
    context.translate(14, serT + SER_H / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("CO₂ (ppm)", 0, 0);
    context.restore();

    // Legend, top left, where the rising curves leave room.
    context.font = noteFont;
    context.textAlign = "left"; context.textBaseline = "middle";
    [["Mauna Loa", MLO_COLOR], ["South Pole", SPO_COLOR]].forEach(([name, color], i) => {
      const ly = serT + 12 + i * 15;
      context.fillStyle = color;
      context.fillRect(serL + 8, ly - 1.5, 14, 3);
      context.fillStyle = "#333";
      haloText(name, serL + 27, ly);
    });
  }

  // A small clock face with one hand for the month, January at twelve o'clock, that keeps
  // to the upper left of the month's Mauna Loa dot (the South Pole's before 1958), where the
  // rising curve leaves room, with the month's name above it.
  function drawClock(sx) {
    const p = latFrame.mloAt ?? latFrame.spoAt;
    const cr = 15;
    const cx = clamp(sx - 34, serL + cr + 4, serR - cr - 4);
    const cy = clamp(p ? ySer(p[1]) - 30 : serT + SER_H / 2, serT + cr + 22, serB - cr - 4);
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.strokeStyle = "#999";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(cx, cy, cr, 0, 2 * Math.PI);
    context.fill();
    context.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
      const inner = i % 3 ? cr - 3 : cr - 5;
      context.strokeStyle = i % 3 ? "#bbb" : "#777";
      line(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, cx + Math.cos(a) * (cr - 1), cy + Math.sin(a) * (cr - 1));
    }
    const year = Math.floor(cursorT);
    const mo = Math.min(11, Math.floor((cursorT - year) * 12));
    const angle = ((mo + 0.5) / 12) * 2 * Math.PI - Math.PI / 2;
    context.strokeStyle = "#222";
    context.lineWidth = 2;
    line(cx, cy, cx + Math.cos(angle) * (cr - 4), cy + Math.sin(angle) * (cr - 4));
    context.lineWidth = 1;
    context.font = labelFont;
    context.fillStyle = "#222";
    context.textAlign = "center"; context.textBaseline = "bottom";
    const text = `${MONTHS_LONG[mo]} ${year}`;
    const half = context.measureText(text).width / 2 + 2;
    haloText(text, clamp(cx, serL + half, serR - half), cy - cr - 3);
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
  // Round CO₂ ticks over the shared range, as many as the space allows: about one per 45 px
  // vertically, one per 40 px along the thin plot's bottom.
  function co2TickValues(extent, vertical = false) {
    const target = Math.max(2, Math.floor(extent / (vertical ? 45 : 40)));
    const raw = (co2Hi - co2Lo) / target;
    const step = [10, 20, 25, 50, 100].find(s => s >= raw) ?? 100;
    const out = [];
    for (let v = Math.ceil(co2Lo / step) * step; v <= co2Hi; v += step) out.push(v);
    return out;
  }

  // ---- state changes --------------------------------------------------------------------------
  function setCursor(t) {
    cursorT = clamp(t, (firstMonth + 0.5) / 12, tLast);
    requestRender();
  }

  // ---- decade traces --------------------------------------------------------------------------
  // As Play sweeps from `from` to `to`, every January of a year ending in 0 that it passes
  // leaves its curve behind (or, before the reference begins in 1979, its two long-record
  // dots). They fade on the reader's first move.
  function collectTraces(from, to) {
    for (let year = Math.ceil(from / 10) * 10; year <= to; year += 10) {
      const t = year + 0.5 / 12;
      if (t <= from || t > to) continue;
      traces.push({year, profile: mblProfile(t), mloAt: seriesAt(mloMonthly, t), spoAt: seriesAt(spoMonthly, t)});
    }
  }
  function fadeTraces() {
    if (!traces.length || traceFade !== null) return;
    traceFade = performance.now();
    requestRender();
  }

  // ---- pointer --------------------------------------------------------------------------------
  function pointerAt(e) {
    const r = canvas.getBoundingClientRect();
    return {px: (e.clientX - r.left) * (w / r.width), py: (e.clientY - r.top) * (totalH / r.height)};
  }
  const onSeries = (px, py) => py >= serT - 8 && py <= serB + 26 && px >= serL - 8 && px <= serR + 8;
  const onRow = (px, py) => py >= ROW_T - 8 && py <= rowB + 8 && px >= mapL && px <= latR + 8;

  canvas.addEventListener("pointerdown", e => {
    const {px, py} = pointerAt(e);
    stopPlay();
    fadeTraces();
    if (!onSeries(px, py)) return;
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
    if (!playing && onRow(px, py)) {
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

  // The station nearest the pointer, on the map or on the latitude plot, within 10 px.
  function nearestSite(px, py) {
    let best = null, bestD = 100;
    for (const d of latFrame.dots) {
      if (d.big) continue;
      const spots = [[xLat(d.v), mapY(d.site.lat)]];
      if (d.site.lon !== null) spots.push(mapPoint(d.site.lon, d.site.lat));
      for (const [x, y] of spots) {
        const dd = (x - px) ** 2 + (y - py) ** 2;
        if (dd < bestD) { bestD = dd; best = d.site; }
      }
    }
    return best;
  }

  // ---- play -----------------------------------------------------------------------------------
  // Sweeps the months from where the scrubber is (or from the start, if it is at the end) to
  // the latest month, then stops there. It starts by itself once the figure is in view, and
  // any click or drag ends it, because a control that moves under your cursor is maddening.
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
    requestRender();
  }

  function startPlay(delay = PLAY_DELAY) {
    if (playing) return;
    playWatcher?.disconnect();
    playWatcher = null;
    playing = true;
    hoverSite = null;
    requestRender();
    playTimer = setTimeout(sweep, delay);
  }

  function sweep() {
    if (!playing) return;
    if (container.isConnected === false) return stopPlay();
    const fromStart = cursorT >= tLatestFull - 1 / 12;
    const from = fromStart ? (firstMonth + 0.5) / 12 : cursorT;
    const to = tLatestFull;
    if (fromStart) { traces = []; traceFade = null; traceAlpha = 1; }
    const duration = reduceMotion ? 0 : ((to - from) / SWEEP_YEARS_PER_S) * 1000;
    const start = performance.now();
    let passed = from;   // how far the sweep has got, for the traces it leaves on the way
    const step = now => {
      if (!playing) return;
      const k = duration ? Math.min(1, (now - start) / duration) : 1;
      setCursor(from + (to - from) * k);
      collectTraces(passed, cursorT);
      passed = cursorT;
      if (k < 1) playFrame = requestAnimationFrame(step);
      else { playing = false; emit(); requestRender(); }
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

  // Text with a white halo, for labels that sit on top of the data. Uses the current font,
  // alignment and fill; the stroke settings are restored afterwards.
  function haloText(text, tx, ty) {
    const {strokeStyle, lineWidth, lineJoin} = context;
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 3.5;
    context.lineJoin = "round";
    context.strokeText(text, tx, ty);
    context.fillText(text, tx, ty);
    context.strokeStyle = strokeStyle; context.lineWidth = lineWidth; context.lineJoin = lineJoin;
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
