// The Coriolis effect on the Earth: a parcel of air or water launched over the ground, on an
// orthographic globe seen from the Earth itself (the rotating frame), from an angle that can
// be turned and zoomed. The companion of the turntable widget in ../coriolis/.
//
// The physics is Earth-like, not a free particle on a sphere. A free particle on a
// frictionless rotating sphere would feel the centrifugal push as well and slide toward the
// equator; the real Earth has bulged at the equator until that push is cancelled by gravity's
// slight tilt, so air and water feel only the Coriolis term. That is what is integrated here:
// the parcel moves over the sphere with its speed conserved and the horizontal Coriolis
// acceleration −f (r̂ × v), f = 2Ω sin φ, and nothing else: no friction, no pressure. In
// vector form, with r the position (|r| = a) and v the velocity along the surface,
//     dr/dt = v,   dv/dt = −(|v|²/a²) r − f (r̂ × v),
// the first term being what keeps a straight run on a great circle. Stepped with RK4 and
// put back on the sphere after each step, the poles included. Left alone, a parcel goes
// round an inertial circle: clockwise in the north, anticlockwise in the south, of radius
// v/f and period 2π/f (half a sidereal day at a pole, 17 h at 45°, never at the equator),
// drifting slowly west as the exact solution on the sphere does. Checked against the
// conservation of energy and of cos φ (u + Ω a cos φ) (Ripa 1997, J. Phys. Oceanogr. 27, 633).
//
// The Earth's size and spin are real. The clock is run fast, one day a second, because at
// real speed nothing would be seen to happen. The view can be turned and zoomed with a pad
// of buttons (or the keyboard), never by dragging, which is kept for throwing: a drag on
// the globe sets the parcel's speed over the ground and its direction.
//
// d3-geo and topojson-client are imported from jsDelivr, as the map widgets do, so the
// module works both on the Framework site and as a raw script-tag embed. The land outline is
// passed in as `world` (the repo's countries-110m.json) and is optional: without it the
// globe is ocean and graticule.

import {geoOrthographic, geoPath, geoGraticule, geoDistance} from "https://cdn.jsdelivr.net/npm/d3-geo@3/+esm";
import {feature} from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

const BACKGROUND = "#f2f2f2";
const ACCENT = "#0b57d0";
const OCEAN = "#e6eef6";
const LAND = "#c9d3c0";
const RIM = "#9a9a9a";
// A parcel is coloured by the logarithm of its speed, slow to fast, with Peter Kovesi's
// isoluminant CET-I3 (colorcet's isoluminant_cm_70_c39), cyan through blue to pink, every
// 15th of its 256 entries plus the last, each darkened by a fifth so that it holds on the
// pale globe. Isoluminant so that no speed shouts louder than another.
const SPEED_COLORS = ["#1094b8", "#3093b9", "#4391bb", "#518fbc", "#5e8cbd", "#6a8abd", "#7588bd", "#7f85bb", "#8a82b9",
  "#9380b5", "#9c7db0", "#a47bab", "#ac78a6", "#b375a1", "#b9739b", "#c07096", "#c56d90", "#cb6a8a"];
const TRACE_WIDTH = 2;            // px; a parcel's marker is twice as wide

const EARTH_RADIUS = 6371;        // km
const OMEGA = 7.2921e-5;          // rad/s
const SIDEREAL_DAY = 86164;       // s
const MAX_THROWS = 20;            // enough for the tour's sixteen parcels of current at once
const LIFE = 40;                  // wall-clock s a trace is shown in full
const FADE = 8;                   // s it then takes to fade away
// The drag's length maps onto the logarithm of the speed, as a log slider does: a hundredth
// of the figure's width is SPEED_MIN, a surface current, and a third of it SPEED_MAX,
// 300 km/h, about the most a wind ever sustains; beyond a third the speed stays there. That
// is close to three decades, a factor of ten for about every tenth of the width: 10 cm/s to
// 1 m/s, the ocean's currents; to 10 m/s, everyday winds; to 300 km/h, storms and the jet
// stream. A third rather than the whole width, so that the top is within an easy drag.
const SPEED_MIN = 0.1;            // m/s, at DRAG_MIN of the width
const SPEED_MAX = 300 / 3.6;      // m/s, at DRAG_MAX of the width
const DRAG_MIN = 0.01, DRAG_MAX = 1 / 3; // of the figure's width
const DAY_SECONDS = 1;            // wall-clock seconds per day
const STEP_MAX = 60;              // s of simulated time per integration step, at most
const CENTER_LAT = -20;           // the globe is seen, to begin with, from above this latitude...
const CENTER_LON = 135;           // ...and this longitude
const GLOBE_R = 0.44;             // globe radius as a fraction of the figure's side, before zooming
const SPIN_RATE = 45;             // °/s the view turns while an arrow button or key is held, at zoom 1
const ZOOM_STEP = 1.5, ZOOM_MAX = 100; // at 100× a 1 m/s current's 10 km loop is 40 px across

// The tour, played when the figure is left alone: a slow zoom onto the Tasman Sea off the
// east coast of Australia, where the East Australian Current runs south along the shelf,
// and a handful of parcels of water set off at a current's pace; then back out over the
// continent, where a handful of parcels of air set off at a gale's. Each scene waits for
// its parcels to fade, then the next begins, and the tour goes round again. `box` is the
// [lon, lat] corners the parcels start in, `heading` the compass direction they set off in,
// ± `spread`, and `speed` the range in m/s, drawn evenly in the logarithm.
const TOUR = [
  {
    name: "the East Australian Current",
    view: {lon: 153.5, lat: -31.5, zoom: 9},
    box: [[152.5, -36], [156, -27]], offshore: true,
    heading: 190, spread: 50, speed: [0.1, 2], count: 16,
  },
  {
    name: "winds over Australia",
    view: {lon: 134, lat: -26, zoom: 2.2},
    box: [[118, -34], [148, -18]],
    heading: 90, spread: 180, speed: [15, 40], count: 8,
  },
];
const TOUR_FLY = 5;         // s a scene's zoom takes
const TOUR_LIFE = 8;        // s a tour parcel stays in full before it fades
const TOUR_SPAWN_GAP = 0.3; // s between one tour parcel and the next
const TOUR_START = 1.5;     // s the tour waits before its first scene

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const SVG_NS = "http://www.w3.org/2000/svg";

// `world` is the TopoJSON with a `land` object; `width` caps the figure's side; `tour`
// false leaves the figure still until it is touched (it is also left still for a reader who
// prefers reduced motion). `demo` launches three parcels and runs the clock on a moment,
// for a capture of the figure in use, and plays no tour.
export function createCoriolisSphereWidget({world, width = FIGURE_WIDTH, tour: playTour = true, demo = false} = {}) {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const land = world?.objects?.land ? feature(world, world.objects.land) : null;
  const graticule = geoGraticule().step([15, 15])();
  const equator = {type: "LineString", coordinates: [[-180, 0], [-90, 0], [0, 0], [90, 0], [180, 0]]};

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, c, R, titleFont, labelFont;
  const ballR = TRACE_WIDTH;
  const projection = geoOrthographic().clipAngle(90).precision(0.5);
  const path = geoPath(projection);
  let zoom = 1;
  function applyLayout(newW) {
    w = newW;
    c = w / 2;
    R = GLOBE_R * w;
    projection.scale(R * zoom).translate([c, c]);
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = Math.round(lerp(14, 20));
    labelFont = Math.round(lerp(12, 13));
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let wallT = 0;   // s of wall-clock time, capped per frame so a hidden tab does not leap
  let viewLon = CENTER_LON, viewLat = CENTER_LAT; // the Earth longitude and latitude facing the viewer
  const spin = {lon: 0, lat: 0}; // −1, 0 or 1: which way the view is being turned
  const parcels = [];
  let drag = null; // {start: [lon, lat] on the Earth, q: [sx, sy] pointer on screen, color}
  let flight = null; // {from: {lon, lat, logZoom}, to, t, dur}: the view on its way somewhere
  let touring = false, tour = null; // {scene, stage: "fly" | "spawn" | "hold", t, spawned}

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;` +
    `box-sizing:border-box;max-width:${maxW + 24}px;`;

  const title = document.createElement("div");
  title.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:0 0 6px;";
  title.textContent = "The Coriolis effect on Earth";
  container.appendChild(title);

  // The note, with the tour button at its right. Words rather than a ▶ glyph, which iOS
  // swaps for a colour emoji.
  const noteRow = document.createElement("div");
  noteRow.style.cssText = "display:flex;align-items:flex-start;gap:12px;padding:0 0 8px;";
  const note = document.createElement("div");
  note.style.cssText = "flex:1 1 auto;color:#888;font-size:14px;";
  note.textContent =
    "Click and drag to launch a parcel of air/water (speed is shown). " +
    "Nothing acts on the parcel but the Earth's turning, so its speed never changes. " +
    `The clock runs ${describeClock(DAY_SECONDS)}.`;
  const tourButton = document.createElement("button");
  tourButton.type = "button";
  tourButton.style.cssText =
    "flex:0 0 auto;font:13px sans-serif;color:#333;background:#fff;border:1px solid #ccc;border-radius:999px;" +
    "padding:3px 12px;cursor:pointer;white-space:nowrap;";
  tourButton.addEventListener("click", () => (touring ? stopTour() : startTour(0)));
  noteRow.append(note, tourButton);
  container.appendChild(noteRow);

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;position:relative;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "coriolis-sphere");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  svg.style.touchAction = "none";
  svg.style.userSelect = "none";
  svg.style.webkitUserSelect = "none";
  svg.style.outline = "none";
  svg.tabIndex = 0;
  scroller.appendChild(svg);
  container.appendChild(scroller);

  // The view controls: four bare triangles at the sides of the figure, around the globe, to
  // turn the view, held down to keep turning, and a joined pair of + and − in the bottom
  // corner to zoom. Ordinary buttons over the SVG, so a press on them never reaches the
  // throw gesture, and the keyboard does the same when the figure has focus. Dragging is
  // kept for throwing alone. The glyphs are drawn, not typed: fonts set their triangles at
  // different sizes and off centre.
  const button = (glyph, title, style) => {
    const b = document.createElement("button");
    b.type = "button";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.style.cssText =
      "display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;cursor:pointer;" +
      `touch-action:none;user-select:none;-webkit-user-select:none;${style}`;
    b.appendChild(glyph);
    return b;
  };
  const arrow = (angle, title, place) =>
    button(triangleGlyph(angle, 14), title, `position:absolute;border:none;background:none;${place}`);
  const holdToSpin = (b, axis, dir) => {
    const start = e => { e.preventDefault(); stopTour(); b.setPointerCapture?.(e.pointerId); spin[axis] = dir; };
    const stop = () => { if (spin[axis] === dir) spin[axis] = 0; };
    b.addEventListener("pointerdown", start);
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) b.addEventListener(type, stop);
    // Space or Enter on the button: one step of 10°, as the arrow keys give.
    b.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stopTour(); turnView(axis, (dir * 10) / zoom); } });
    scroller.appendChild(b);
  };
  holdToSpin(arrow(-90, "Turn the view north", "top:4px;left:50%;transform:translateX(-50%);"), "lat", 1);
  holdToSpin(arrow(90, "Turn the view south", "bottom:4px;left:50%;transform:translateX(-50%);"), "lat", -1);
  holdToSpin(arrow(180, "Turn the view west", "left:4px;top:50%;transform:translateY(-50%);"), "lon", -1);
  holdToSpin(arrow(0, "Turn the view east", "right:4px;top:50%;transform:translateY(-50%);"), "lon", 1);

  const zoomPair = document.createElement("div");
  zoomPair.style.cssText = "position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;";
  const zoomStyle = "color:#333;background:rgba(255,255,255,0.92);border:1px solid #ccc;";
  const zoomIn = button(signGlyph(true), "Zoom in", `${zoomStyle}border-radius:6px 6px 0 0;`);
  const zoomOut = button(signGlyph(false), "Zoom out", `${zoomStyle}border-radius:0 0 6px 6px;margin-top:-1px;`);
  zoomIn.addEventListener("click", () => { stopTour(); setZoom(zoom * ZOOM_STEP); });
  zoomOut.addEventListener("click", () => { stopTour(); setZoom(zoom / ZOOM_STEP); });
  zoomPair.append(zoomIn, zoomOut);
  scroller.appendChild(zoomPair);

  svg.addEventListener("keydown", e => {
    const keys = {ArrowLeft: ["lon", -1], ArrowRight: ["lon", 1], ArrowUp: ["lat", 1], ArrowDown: ["lat", -1]};
    if (keys[e.key]) { e.preventDefault(); stopTour(); const [axis, dir] = keys[e.key]; spin[axis] = dir; return; }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); stopTour(); setZoom(zoom * ZOOM_STEP); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); stopTour(); setZoom(zoom / ZOOM_STEP); }
  });
  svg.addEventListener("keyup", e => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") spin.lon = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") spin.lat = 0;
  });
  svg.addEventListener("blur", () => { spin.lon = spin.lat = 0; });

  function turnView(axis, degrees) {
    if (axis === "lon") viewLon = wrapLon(viewLon + degrees);
    else viewLat = clamp(viewLat + degrees, -90, 90);
  }
  function setZoom(z) {
    zoom = clamp(z, 1, ZOOM_MAX);
    projection.scale(R * zoom);
    render();
    emit();
  }

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- scaffolding, rebuilt on resize ---------------------------------------------------------
  let oceanEl, graticuleEl, equatorEl, landEl, rimEl, tracesG, dragG, dragLine, dragHead, dragBall, dragLabel, dragKind;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", w);
    svg.replaceChildren();
    svgEl("rect", {width: w, height: w, fill: BACKGROUND}, svg);

    oceanEl = svgEl("path", {fill: OCEAN}, svg);
    graticuleEl = svgEl("path", {fill: "none", stroke: "rgba(0,0,0,0.09)", "stroke-width": 1}, svg);
    landEl = svgEl("path", {fill: LAND, stroke: "none"}, svg);
    equatorEl = svgEl("path", {fill: "none", stroke: "rgba(0,0,0,0.25)", "stroke-width": 1}, svg);
    rimEl = svgEl("path", {fill: "none", stroke: RIM, "stroke-width": 1.5}, svg);

    tracesG = svgEl("g", {fill: "none", "stroke-width": TRACE_WIDTH, "stroke-linecap": "round", "stroke-linejoin": "round"}, svg);
    for (const p of parcels) {
      p.path = svgEl("path", {stroke: p.color}, tracesG);
      p.ball = svgEl("circle", {r: ballR, fill: p.color}, tracesG);
    }

    dragG = svgEl("g", {display: "none"}, svg);
    dragLine = svgEl("line", {"stroke-width": TRACE_WIDTH, "stroke-linecap": "round"}, dragG);
    dragHead = svgEl("path", {}, dragG);
    dragBall = svgEl("circle", {r: ballR}, dragG);
    const halo = {stroke: BACKGROUND, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round"};
    dragLabel = svgEl("text", {"font-size": labelFont, "font-weight": "bold", "text-anchor": "middle", ...halo}, dragG);
    dragKind = svgEl("text", {"font-size": labelFont - 1, "text-anchor": "middle", ...halo}, dragG);

    render();
  }

  // ---- drawing --------------------------------------------------------------------------------
  function render() {
    projection.rotate([-viewLon, -viewLat]);
    oceanEl.setAttribute("d", path({type: "Sphere"}));
    graticuleEl.setAttribute("d", path(graticule));
    equatorEl.setAttribute("d", path(equator));
    if (land) landEl.setAttribute("d", path(land));
    rimEl.setAttribute("d", path({type: "Sphere"}));
    for (const p of parcels) drawParcel(p);
    drawDrag();
  }

  function drawParcel(p) {
    p.path.setAttribute("d", p.trace.length > 1 ? path({type: "LineString", coordinates: p.trace}) ?? "" : "");
    const here = lonLat(p.r);
    const visible = geoDistance(here, [viewLon, viewLat]) < Math.PI / 2;
    p.ball.style.display = visible ? "" : "none";
    if (visible) {
      const [sx, sy] = projection(here);
      p.ball.setAttribute("cx", sx.toFixed(1));
      p.ball.setAttribute("cy", sy.toFixed(1));
    }
    const age = wallT - p.t0;
    const opacity = age < p.life ? 1 : clamp(1 - (age - p.life) / FADE, 0, 1);
    p.path.setAttribute("opacity", opacity.toFixed(3));
    p.ball.setAttribute("opacity", opacity.toFixed(3));
  }

  // ---- parcels --------------------------------------------------------------------------------
  // `start` is [lon, lat] on the Earth; `toward` is [lon, lat] the throw points at; `speed`
  // is in m/s over the ground; `life` is how long the parcel stays before it fades.
  function launch(start, toward, speed, life = LIFE) {
    const r = unit(start);
    let v = [0, 0, 0];
    if (speed > 0) {
      // The direction along the ground from the start toward the aim: the aim's direction
      // with its radial part removed.
      const q = unit(toward);
      const d = sub(q, scale(r, dot(q, r)));
      const n = norm(d);
      if (n > 1e-9) v = scale(d, (speed / 1000) / n); // km/s
    }
    const color = speedColor(speed);
    const p = {
      r: scale(r, EARTH_RADIUS), v, speed: norm(v), t0: wallT, life, color,
      trace: [], // sampled [lon, lat]
      path: svgEl("path", {stroke: color}, tracesG),
      ball: svgEl("circle", {r: ballR, fill: color}, tracesG),
    };
    while (parcels.length >= MAX_THROWS) removeParcel(0);
    parcels.push(p);
    sample(p);
    emit();
  }

  function removeParcel(i) {
    const [p] = parcels.splice(i, 1);
    p.path.remove();
    p.ball.remove();
  }

  function sample(p) {
    p.trace.push(lonLat(p.r));
  }

  // One RK4 step of dt seconds for a parcel, then back onto the sphere at its own speed.
  function accel(r, v) {
    const a2 = EARTH_RADIUS * EARTH_RADIUS;
    const rhat = scale(r, 1 / EARTH_RADIUS);
    const f = 2 * OMEGA * rhat[2];
    const c = cross(rhat, v);
    const vv = dot(v, v);
    return [
      -(vv / a2) * r[0] - f * c[0],
      -(vv / a2) * r[1] - f * c[1],
      -(vv / a2) * r[2] - f * c[2],
    ];
  }
  function step(p, dt) {
    if (p.speed === 0) return;
    const {r, v} = p;
    const k1r = v, k1v = accel(r, v);
    const r2 = add(r, scale(k1r, dt / 2)), v2 = add(v, scale(k1v, dt / 2));
    const k2r = v2, k2v = accel(r2, v2);
    const r3 = add(r, scale(k2r, dt / 2)), v3 = add(v, scale(k2v, dt / 2));
    const k3r = v3, k3v = accel(r3, v3);
    const r4 = add(r, scale(k3r, dt)), v4 = add(v, scale(k3v, dt));
    const k4r = v4, k4v = accel(r4, v4);
    let rn = add(r, scale(add(add(k1r, scale(k2r, 2)), add(scale(k3r, 2), k4r)), dt / 6));
    let vn = add(v, scale(add(add(k1v, scale(k2v, 2)), add(scale(k3v, 2), k4v)), dt / 6));
    rn = scale(rn, EARTH_RADIUS / norm(rn));
    const rhat = scale(rn, 1 / EARTH_RADIUS);
    vn = sub(vn, scale(rhat, dot(vn, rhat)));
    vn = scale(vn, p.speed / norm(vn));
    p.r = rn;
    p.v = vn;
  }

  // ---- the clock ------------------------------------------------------------------------------
  function advance(dtWall, draw = true) {
    wallT += dtWall;
    // Slower when zoomed in, so that the ground goes by at the same pace on screen.
    if (spin.lon) turnView("lon", (spin.lon * SPIN_RATE * dtWall) / zoom);
    if (spin.lat) turnView("lat", (spin.lat * SPIN_RATE * dtWall) / zoom);
    if (flight) fly(dtWall);
    if (touring) tourStep(dtWall);
    const dtSim = (dtWall * SIDEREAL_DAY) / DAY_SECONDS;
    const n = Math.max(1, Math.ceil(dtSim / STEP_MAX));
    const h = dtSim / n;
    for (let i = parcels.length - 1; i >= 0; i--) {
      const p = parcels[i];
      if (wallT - p.t0 >= p.life + FADE) { removeParcel(i); continue; }
      for (let k = 0; k < n; k++) step(p, h);
      sample(p);
    }
    if (draw) render();
  }

  // ---- the view on its way somewhere ----------------------------------------------------------
  function flyTo({lon, lat, zoom: z}, dur) {
    flight = {
      from: {lon: viewLon, lat: viewLat, logZoom: Math.log(zoom)},
      to: {lon, lat, logZoom: Math.log(clamp(z, 1, ZOOM_MAX))},
      t: 0, dur,
    };
  }
  function fly(dt) {
    flight.t = Math.min(flight.dur, flight.t + dt);
    const x = flight.t / flight.dur;
    const s = x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) ** 2) / 2; // ease in and out
    const {from, to} = flight;
    viewLon = wrapLon(from.lon + s * wrapLon(to.lon - from.lon));
    viewLat = from.lat + s * (to.lat - from.lat);
    zoom = Math.exp(from.logZoom + s * (to.logZoom - from.logZoom));
    projection.scale(R * zoom);
    if (flight.t >= flight.dur) flight = null;
  }

  // ---- the tour -------------------------------------------------------------------------------
  function startTour(delay = TOUR_START) {
    if (touring) return;
    touring = true;
    tour = {scene: 0, stage: "wait", t: -delay, spawned: 0};
    updateTourButton();
    emit();
  }
  function stopTour() {
    if (!touring) return;
    touring = false;
    tour = null;
    flight = null;
    updateTourButton();
    emit();
  }
  function updateTourButton() {
    tourButton.textContent = touring ? "Stop tour" : "Play tour";
    tourButton.style.borderColor = touring ? ACCENT : "#ccc";
    tourButton.style.color = touring ? ACCENT : "#333";
    tourButton.setAttribute("aria-pressed", touring);
  }
  function tourStep(dt) {
    const scene = TOUR[tour.scene];
    tour.t += dt;
    if (tour.stage === "wait") {
      if (tour.t < 0) return;
      flyTo(scene.view, TOUR_FLY);
      tour.stage = "fly";
    } else if (tour.stage === "fly") {
      if (flight) return;
      tour.stage = "spawn";
      tour.t = 0;
      tour.spawned = 0;
    } else if (tour.stage === "spawn") {
      if (tour.spawned < scene.count && tour.t >= tour.spawned * TOUR_SPAWN_GAP) {
        tourLaunch(scene);
        tour.spawned++;
      }
      if (tour.spawned >= scene.count) tour.stage = "hold";
    } else if (tour.stage === "hold") {
      // On to the next scene once this one's parcels have all faded.
      if (parcels.some(p => p.tour === tour.scene)) return;
      tour = {scene: (tour.scene + 1) % TOUR.length, stage: "wait", t: 0, spawned: 0};
    }
  }
  // One parcel at a random spot in the scene's box (kept off the coast for the current:
  // the east coast runs from about 153.5° E at 27.5° S to 150° E at 37° S, so the start is
  // pushed east of that line), heading the scene's way give or take its spread, at a speed
  // drawn evenly in the logarithm of the scene's range.
  function tourLaunch(scene) {
    const [[lon0, lat0], [lon1, lat1]] = scene.box;
    const lat = lat0 + Math.random() * (lat1 - lat0);
    let lon = lon0 + Math.random() * (lon1 - lon0);
    if (scene.offshore) {
      const coast = 153.5 - (-27.5 - lat) * (3.5 / 9.5);
      lon = coast + 0.5 + Math.random() * 2;
    }
    const bearing = ((scene.heading + (Math.random() * 2 - 1) * scene.spread) * Math.PI) / 180;
    // Aim a degree along the bearing, which is near enough a straight line at this scale.
    const toward = [lon + Math.sin(bearing) / Math.cos((lat * Math.PI) / 180), lat + Math.cos(bearing)];
    const [s0, s1] = scene.speed;
    const speed = s0 * Math.pow(s1 / s0, Math.random());
    launch([lon, lat], toward, speed, TOUR_LIFE);
    parcels[parcels.length - 1].tour = tour.scene;
  }

  // The clock runs from the first frame and stops for good once the widget has been taken
  // out of the page (it is not in the page yet when created, so that alone does not stop it).
  let last = null, wasConnected = false;
  function tick(now) {
    if (container.isConnected) wasConnected = true;
    else if (wasConnected) return;
    requestAnimationFrame(tick);
    const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    advance(dt);
  }

  // ---- throwing with the pointer --------------------------------------------------------------
  function pointerXY(e) {
    const b = svg.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  // The Earth coordinates under a screen point, or null off the globe.
  function groundAt(xy) {
    projection.rotate([-viewLon, -viewLat]);
    if (Math.hypot(xy[0] - c, xy[1] - c) > R * zoom) return null;
    return projection.invert(xy);
  }
  svg.addEventListener("pointerdown", e => {
    if (e.button != null && e.button !== 0) return;
    const xy = pointerXY(e);
    const start = groundAt(xy);
    if (!start) return;
    e.preventDefault();
    stopTour();
    svg.setPointerCapture?.(e.pointerId);
    drag = {start, q: xy, id: e.pointerId};
    drawDrag();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.q = pointerXY(e);
    drawDrag();
  });
  const release = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    drawDrag();
    if (e.type !== "pointerup") return;
    const {speed, toward} = throwOf(d);
    launch(d.start, toward, speed);
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  // The speed and aim of a drag: the speed from its length on screen (zoom does not change
  // it, so the whole range stays within reach), the aim from the ground under the pointer,
  // or, off the globe, under the nearest point of the rim.
  function throwOf(d) {
    projection.rotate([-viewLon, -viewLat]);
    // The view can be turned during a drag until the start is on the far side; the throw
    // is then measured from the centre, which is as good a guess as any.
    const [sx, sy] = projection(d.start) ?? [c, c];
    const len = Math.hypot(d.q[0] - sx, d.q[1] - sy);
    const t = clamp((len / w - DRAG_MIN) / (DRAG_MAX - DRAG_MIN), 0, 1);
    const speed = SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, t);
    let aim = d.q;
    const rz = R * zoom;
    const fromCentre = Math.hypot(aim[0] - c, aim[1] - c);
    if (fromCentre > rz * 0.999) aim = [c + ((aim[0] - c) * rz * 0.999) / fromCentre, c + ((aim[1] - c) * rz * 0.999) / fromCentre];
    const toward = projection.invert(aim) ?? d.start;
    return {speed: len < 3 ? 0 : speed, toward, sx, sy, len};
  }

  function drawDrag() {
    if (!dragG) return;
    if (!drag) { dragG.setAttribute("display", "none"); return; }
    dragG.removeAttribute("display");
    const {speed, sx, sy, len} = throwOf(drag);
    const [x1, y1] = drag.q;
    // The preview takes the colour the parcel will have, so the colour reads as speed too.
    const color = speedColor(speed);
    dragLine.setAttribute("stroke", color);
    dragHead.setAttribute("fill", color);
    dragBall.setAttribute("fill", color);
    dragLabel.setAttribute("fill", color);
    dragKind.setAttribute("fill", color);
    dragBall.setAttribute("cx", sx.toFixed(1));
    dragBall.setAttribute("cy", sy.toFixed(1));
    if (len < 3) {
      for (const el of [dragLine, dragHead, dragLabel, dragKind]) el.setAttribute("display", "none");
      return;
    }
    for (const el of [dragLine, dragHead, dragLabel, dragKind]) el.removeAttribute("display");
    const tx = (x1 - sx) / len, ty = (y1 - sy) / len;
    const hl = 10, hw = 5;
    const bx = x1 - tx * hl, by = y1 - ty * hl;
    dragLine.setAttribute("x1", sx.toFixed(1));
    dragLine.setAttribute("y1", sy.toFixed(1));
    dragLine.setAttribute("x2", bx.toFixed(1));
    dragLine.setAttribute("y2", by.toFixed(1));
    dragHead.setAttribute("d",
      `M${x1.toFixed(1)},${y1.toFixed(1)}L${(bx - ty * hw).toFixed(1)},${(by + tx * hw).toFixed(1)}` +
      `L${(bx + ty * hw).toFixed(1)},${(by - tx * hw).toFixed(1)}Z`);
    // The speed reads just past the arrowhead, and what kind of flow that is under it.
    const lx = (x1 + tx * 14).toFixed(1), ly = y1 + ty * 14 + labelFont * 0.35;
    dragLabel.setAttribute("x", lx);
    dragLabel.setAttribute("y", ly.toFixed(1));
    dragLabel.textContent = describeSpeed(speed);
    dragKind.setAttribute("x", lx);
    dragKind.setAttribute("y", (ly + labelFont + 1).toFixed(1));
    dragKind.textContent = describeKind(speed);
  }

  // ---- changes --------------------------------------------------------------------------------
  function value() {
    return {parcels: parcels.length, view: [viewLon, viewLat], zoom, touring};
  }
  function emit() {
    container.value = value();
    svg.setAttribute("aria-label",
      `The Earth as a globe seen from above ${Math.abs(Math.round(viewLat))}° ${viewLat < 0 ? "south" : "north"}, ` +
      `${Math.abs(Math.round(viewLon))}° ${viewLon < 0 ? "west" : "east"}, with ${parcels.length} parcel${parcels.length === 1 ? "" : "s"} ` +
      `of air in flight; the clock runs ${describeClock(DAY_SECONDS)}.`);
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function layoutControls() {
    title.style.fontSize = `${titleFont}px`;
  }

  layoutControls();
  updateTourButton();
  build();
  container.value = value();

  if (demo) {
    // Three parcels at wind speeds a storm would have, run on for most of a day: enough for
    // the loops to show without the traces starting to fade.
    const stepWall = 1 / 60;
    const run = s => { for (let i = 0; i < Math.round(s / stepWall); i++) advance(stepWall, false); };
    launch([110, 40], [120, 40], 45);
    run(0.12);
    launch([150, -35], [150, -25], 45);
    run(0.12);
    launch([100, 5], [110, 5], 60);
    run(0.45);
    render();
  } else if (playTour && !reduceMotion) {
    startTour();
  }
  requestAnimationFrame(tick);

  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(entries => {
      const avail = entries[0]?.contentRect?.width || container.clientWidth;
      if (!(avail > 0)) return;
      const fitted = Math.max(MIN_WIDTH, Math.min(maxW, Math.floor(avail)));
      if (fitted !== w) { applyLayout(fitted); layoutControls(); build(); }
    });
    ro.observe(container);
  }

  return container;
}

// ---- small helpers ------------------------------------------------------------------------------

// An equilateral triangle pointing the given way (0 is east, −90 north), drawn as an SVG of
// the given size centred on its centroid, for the view buttons.
function triangleGlyph(angle, size = 12) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block";
  const r = 4.6;
  const pts = [0, 120, 240].map(a => {
    const t = ((angle + a) * Math.PI) / 180;
    return `${(6 + r * Math.cos(t)).toFixed(2)},${(6 + r * Math.sin(t)).toFixed(2)}`;
  });
  const poly = document.createElementNS(SVG_NS, "polygon");
  poly.setAttribute("points", pts.join(" "));
  poly.setAttribute("fill", "#333");
  svg.appendChild(poly);
  return svg;
}
// A plus or a minus, drawn the same way.
function signGlyph(plus) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("width", 12);
  svg.setAttribute("height", 12);
  svg.setAttribute("aria-hidden", "true");
  svg.style.display = "block";
  const line = (x1, y1, x2, y2) => {
    const l = document.createElementNS(SVG_NS, "line");
    for (const [k, v] of Object.entries({x1, y1, x2, y2, stroke: "#333", "stroke-width": 1.6, "stroke-linecap": "round"})) l.setAttribute(k, v);
    svg.appendChild(l);
  };
  line(1.5, 6, 10.5, 6);
  if (plus) line(6, 1.5, 6, 10.5);
  return svg;
}

// Two significant figures or so, in the unit people use for that speed: cm/s for a current,
// m/s for a wind, with km/h alongside once it is a wind worth a name.
function describeSpeed(v) {
  if (v < 0.1) return `${(v * 100).toFixed(1)} cm/s`;
  if (v < 1) return `${(v * 100).toFixed(0)} cm/s`;
  if (v < 10) return `${v.toFixed(1)} m/s (${Math.round(v * 3.6)} km/h)`;
  return `${Math.round(v)} m/s (${Math.round(v * 3.6)} km/h)`;
}
// The colour for a speed: its logarithm over the drag's range, 10 cm/s to 300 km/h, read
// off SPEED_COLORS with the stops blended in sRGB. Speeds below the range take the first.
function speedColor(v) {
  const t = clamp(Math.log(Math.max(v, SPEED_MIN) / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN), 0, 1);
  const x = t * (SPEED_COLORS.length - 1), i = Math.min(Math.floor(x), SPEED_COLORS.length - 2), f = x - i;
  const a = parseInt(SPEED_COLORS[i].slice(1), 16), b = parseInt(SPEED_COLORS[i + 1].slice(1), 16);
  const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * f);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// What moves at that speed. The bands: open-ocean drift up to about half a metre a second;
// the western boundary currents, the Gulf Stream and the Kuroshio, run at 1 to 2.5 m/s;
// Beaufort 1 to 6, light air to a strong breeze, is 0.3 to 13.8 m/s; a near gale begins at
// 13.9 m/s and a hurricane at 32.7 m/s.
function describeKind(v) {
  if (v < 0.5) return "a slow ocean current";
  if (v < 3) return "a fast ocean current";
  if (v < 14) return "a breeze";
  return "a gale or a storm";
}
function describeClock(daySeconds) {
  const s = Math.round(daySeconds * 10) / 10;
  return s === 1 ? "one day a second" : `one day in ${Number.isInteger(s) ? s : s.toFixed(1)} s`;
}

// Earth-fixed xyz: x toward (0°, 0°), y toward (90° E, 0°), z toward the north pole.
const RAD = Math.PI / 180;
function unit([lon, lat]) {
  const cl = Math.cos(lat * RAD);
  return [cl * Math.cos(lon * RAD), cl * Math.sin(lon * RAD), Math.sin(lat * RAD)];
}
function lonLat(r) {
  const n = norm(r);
  return [Math.atan2(r[1], r[0]) / RAD, Math.asin(clamp(r[2] / n, -1, 1)) / RAD];
}
function wrapLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.sqrt(dot(a, a));
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
