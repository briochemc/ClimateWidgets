// The Coriolis effect: a ball thrown across a spinning turntable, watched either from the
// room (the fixed, inertial frame) or from the turntable itself (the rotating frame).
//
// The ball rolls without friction, so in the room it goes in a straight line at constant
// speed, and that is the whole of the physics: every trajectory is x0 + v·t in inertial
// coordinates, and the rotating view is the same points turned back by the angle the table
// has turned through since. There is no integration and no force; the curve a rider on the
// table sees is purely a consequence of looking from a turning platform.
//
// The ball leaves paint where it passes, as in a lab: paint on the table turns with the
// table, paint on the floor around it stays with the room. So in the room view the paint on
// the table curves as the table carries it round while the paint on the floor lies straight,
// and in the turntable view the paint on the table lies still while the floor's goes round
// the other way. The room view also draws the ball's actual path, a dashed straight line,
// while the ball is in the picture, and fades it once the ball has left. Each sample keeps
// the table's angle at the time, so a change of rotation speed mid-flight stays consistent.
// Switching views holds the picture where it is: the frame being let go hands its screen
// angle to the one being taken hold of, so nothing jumps; the other frame simply starts (or
// stops) turning.
//
// A throw is press, drag, release, anywhere on the figure; the ball starts where the pointer
// went down and leaves along the drag at a speed proportional to its length. The thrower
// stands in the frame being shown: in the room view the drag is the ball's velocity in the
// room; in the turntable view it is the velocity relative to the table, and the table's own
// velocity at that spot is added, so the ball always sets off the way it was thrown and
// then bends. A click with no drag on the turntable view drops a ball "at rest" on the
// table, which the room sees moving off at a tangent, and the table sees sliding outward:
// a frictionless table cannot hold anything still.
//
// Up to MAX_THROWS balls at once, oldest dropped first. A throw stays until LINGER seconds
// after its ball has left the picture and then fades out over FADE more (or after LIFE_MAX
// seconds, for a ball that never leaves). Colours cycle through the Okabe–Ito palette, as the other
// categorical widgets here do. Physics is in units of the disk radius and seconds, so a
// resize mid-flight simply redraws everything at the new size.

const BACKGROUND = "#f2f2f2";
const ACCENT = "#0b57d0";
const DISK_FILL = "#ffffff";
const DISK_RIM = "#9a9a9a";
const DISK_LINES = "#e3e3e3";
const ROOM = "#808080";
// Okabe–Ito less its yellow, which vanishes on the plate; a darkened yellow stands in.
const COLORS = ["#E69F00", "#56B4E9", "#009E73", "#0072B2", "#D55E00", "#CC79A7", "#b39b00", "#000000"];

const MAX_THROWS = 10;
const LINGER = 1;        // s a throw stays in full after its ball has left the picture...
const FADE = 2;          // ...and then takes to fade away
const LIFE_MAX = 60;     // s after which a throw fades anyway, for a ball that never leaves
const DASH = "#222";
const DRAG_GAIN = 2.5;   // disk radii per second of speed, per disk radius of drag
const SPEED_MAX = 4;     // disk radii per second
const RPM_MAX = 10;
const RPM_STEP = 0.5;
const DISK_R = 0.40;     // disk radius as a fraction of the figure's side
const ROOM_R = 0.465;    // the room's ring of marks
const OUT_R = 1.9;       // disk radii from the centre beyond which a ball is out of the picture
const HALF_SIDE = 0.5 / DISK_R; // the figure's half-side in disk radii

const FIGURE_WIDTH = 640;
const MIN_WIDTH = 320;
const SVG_NS = "http://www.w3.org/2000/svg";
let instances = 0;

// `frame` is "rotating" (seen from the turntable) or "fixed" (seen from the room); `rpm`
// is the table's rotation in turns per minute, positive anticlockwise; `width` caps the
// figure's side. `demo` throws three balls and runs the clock on a few seconds, for a
// capture of the figure in use.
export function createCoriolisWidget({frame: initialFrame = "rotating", rpm: initialRpm = 4, width = FIGURE_WIDTH, demo = false} = {}) {
  const uid = `coriolis-${++instances}`;

  const maxW = Math.max(MIN_WIDTH, Math.round(width));
  let w, c, R, roomR, titleFont, labelFont, ballR;
  function applyLayout(newW) {
    w = newW;
    c = w / 2;
    R = DISK_R * w;
    roomR = ROOM_R * w;
    const t = clamp((w - MIN_WIDTH) / (FIGURE_WIDTH - MIN_WIDTH), 0, 1);
    const lerp = (a, b) => a + (b - a) * t;
    titleFont = Math.round(lerp(14, 20));
    labelFont = Math.round(lerp(12, 13));
    ballR = lerp(5, 7);
  }
  applyLayout(maxW);

  // ---- state ----------------------------------------------------------------------------------
  let frame = initialFrame === "fixed" ? "fixed" : "rotating";
  let rpm = clamp(Math.round((Number(initialRpm) || 0) / RPM_STEP) * RPM_STEP, -RPM_MAX, RPM_MAX);
  let simT = 0;    // s of simulated time (real time, capped per frame so a hidden tab does not leap)
  let theta = 0;   // rad the table has turned relative to the room, anticlockwise positive
  // The screen angle of whichever frame the view is attached to: the room in the room view,
  // the table in the turntable view. Switching views changes nothing on screen at that
  // instant; the picture is simply held by the other frame from then on.
  let held = 0;
  const roomAngle = () => (frame === "fixed" ? held : held - theta);
  const diskAngle = () => roomAngle() + theta;
  const throws = [];
  let nextColor = 0;
  let drag = null; // {p: [x, y] in the shown frame, q: [x, y] pointer now, color}
  const omega = () => (rpm * 2 * Math.PI) / 60;

  // ---- DOM ------------------------------------------------------------------------------------
  const container = document.createElement("div");
  container.style.cssText =
    `font:16px sans-serif;color:#333;background:${BACKGROUND};padding:10px 12px 12px;border-radius:6px;` +
    `box-sizing:border-box;max-width:${maxW + 24}px;`;

  const title = document.createElement("div");
  title.style.cssText = "font-weight:bold;color:#111;line-height:1.2;padding:0 0 6px;";
  title.textContent = "The Coriolis effect in the lab";
  container.appendChild(title);

  // One row: the frame toggle on the left, the rotation slider on the right; they wrap onto
  // two rows when there is no room.
  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px 16px;" +
    "padding:0 0 8px;font-size:13px;color:#666;";
  container.appendChild(controls);

  const frameBar = document.createElement("div");
  frameBar.style.cssText = "display:flex;align-items:center;gap:6px;";
  frameBar.append("Seen from");
  const FRAMES = [["fixed", "the room"], ["rotating", "the turntable"]];
  const frameButtons = FRAMES.map(([name, label], i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "font:13px sans-serif;padding:3px 10px;cursor:pointer;border:1px solid #ccc;white-space:nowrap;" +
      `border-radius:${i ? "0 999px 999px 0" : "999px 0 0 999px"};${i ? "margin-left:-7px;" : ""}`;
    b.addEventListener("click", () => setFrame(name));
    frameBar.appendChild(b);
    return b;
  });
  function updateFrameButtons() {
    frameButtons.forEach((b, i) => {
      const on = FRAMES[i][0] === frame;
      b.style.background = on ? hexToRgba(ACCENT, 0.08) : "#fff";
      b.style.borderColor = on ? ACCENT : "#ccc";
      b.style.color = on ? ACCENT : "#333";
      b.style.position = "relative";
      b.style.zIndex = on ? 1 : 0;
      b.setAttribute("aria-pressed", on);
    });
  }
  controls.appendChild(frameBar);

  const speedField = document.createElement("label");
  speedField.style.cssText = "display:flex;align-items:center;gap:8px;flex:1 1 220px;";
  const speedName = document.createElement("span");
  speedName.textContent = "Rotation";
  speedName.style.cssText = "color:#333;white-space:nowrap;";
  const speedInput = document.createElement("input");
  speedInput.type = "range";
  speedInput.min = -RPM_MAX;
  speedInput.max = RPM_MAX;
  speedInput.step = RPM_STEP;
  speedInput.value = rpm;
  speedInput.id = `${uid}-rpm`;
  speedInput.setAttribute("aria-label", "Rotation speed, turns per minute, negative for clockwise");
  speedInput.style.cssText = `margin:0;flex:1 1 90px;min-width:90px;accent-color:#222;cursor:pointer;`;
  speedInput.addEventListener("input", e => {
    e.stopPropagation();
    rpm = Number(speedInput.value);
    updateSpeedReadout();
    emit();
  });
  const speedOut = document.createElement("span");
  speedOut.style.cssText = "min-width:9em;text-align:right;font-variant-numeric:tabular-nums;color:#333;white-space:nowrap;";
  speedField.append(speedName, speedInput, speedOut);
  controls.appendChild(speedField);
  function updateSpeedReadout() {
    speedOut.textContent = describeRpm(rpm);
  }

  const scroller = document.createElement("div");
  scroller.style.cssText = "max-width:100%;overflow-x:auto;";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "coriolis");
  svg.setAttribute("role", "img");
  svg.style.display = "block";
  svg.style.touchAction = "none";
  svg.style.cursor = "crosshair";
  svg.style.userSelect = "none";
  svg.style.webkitUserSelect = "none";
  scroller.appendChild(svg);
  container.appendChild(scroller);

  const note = document.createElement("div");
  note.style.cssText = "padding:10px 0 0;color:#888;font-size:14px;";
  note.textContent =
    "Click and drag to throw a ball. It rolls straight in the room's fixed frame, but its trajectory looks curved in the turntable frame.";
  container.appendChild(note);

  function svgEl(tag, attrs = {}, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    parent?.appendChild(el);
    return el;
  }

  // ---- geometry -------------------------------------------------------------------------------
  // Physics coordinates: origin at the centre, y up, unit = the disk radius. Screen: y down.
  const toScreen = ([x, y]) => [c + x * R, c - y * R];
  const toPhys = ([sx, sy]) => [(sx - c) / R, (c - sy) / R];
  const rot = ([x, y], a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    return [ca * x - sa * y, sa * x + ca * y];
  };
  const deg = a => (-a * 180) / Math.PI; // SVG's rotate() is clockwise on screen
  const pt = p => {
    const [sx, sy] = toScreen(p);
    return `${sx.toFixed(1)},${sy.toFixed(1)}`;
  };

  // ---- scaffolding, rebuilt on resize ---------------------------------------------------------
  let roomG, diskG, tracesFixedG, tracesRotG, dashG, ballsFixedG, ballsRotG, dragG, dragLine, dragHead, dragBall, caption;

  function build() {
    svg.setAttribute("width", w);
    svg.setAttribute("height", w);
    svg.replaceChildren();
    svgEl("rect", {width: w, height: w, fill: BACKGROUND}, svg);

    // The room: a ring of marks around the table, longer ones every quarter turn. Still in the
    // room view, turning the other way in the turntable view: it is what the rider sees go by.
    roomG = svgEl("g", {}, svg);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      const major = i % 6 === 0;
      const r1 = roomR - (major ? 9 : 5), r2 = roomR + (major ? 9 : 5);
      svgEl("line", {
        x1: (c + r1 * Math.cos(a)).toFixed(1), y1: (c - r1 * Math.sin(a)).toFixed(1),
        x2: (c + r2 * Math.cos(a)).toFixed(1), y2: (c - r2 * Math.sin(a)).toFixed(1),
        stroke: ROOM, "stroke-width": major ? 2 : 1, "stroke-linecap": "round",
      }, roomG);
    }
    // The room's name, above the ring at the top. It goes round with the ring in the
    // turntable view, which is how the rider sees the room turn.
    const roomLabel = svgEl("text", {
      x: c, y: (c - roomR - 16).toFixed(1), "text-anchor": "middle", "font-size": labelFont, fill: ROOM,
    }, roomG);
    roomLabel.textContent = "fixed frame";

    // The turntable: a white disk with a rim, faint rings and spokes so that it is seen to
    // turn, and its name just inside the rim, turning with it.
    diskG = svgEl("g", {}, svg);
    svgEl("circle", {cx: c, cy: c, r: R, fill: DISK_FILL, stroke: DISK_RIM, "stroke-width": 2}, diskG);
    for (const f of [0.25, 0.5, 0.75]) svgEl("circle", {cx: c, cy: c, r: R * f, fill: "none", stroke: DISK_LINES, "stroke-width": 1}, diskG);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 6;
      svgEl("line", {
        x1: (c - R * Math.cos(a)).toFixed(1), y1: (c + R * Math.sin(a)).toFixed(1),
        x2: (c + R * Math.cos(a)).toFixed(1), y2: (c - R * Math.sin(a)).toFixed(1),
        stroke: DISK_LINES, "stroke-width": 1,
      }, diskG);
    }
    const diskLabel = svgEl("text", {
      x: c, y: (c - R + 10 + labelFont).toFixed(1), "text-anchor": "middle", "font-size": labelFont, fill: DISK_RIM,
      stroke: DISK_FILL, "stroke-width": 3, "paint-order": "stroke", "stroke-linejoin": "round",
    }, diskG);
    diskLabel.textContent = "rotating frame";

    // Paint is drawn in the coordinates of whatever it is on and turned with it by the
    // group's transform, so a path never needs rebuilding as the picture turns: the floor's
    // paint and the dashed path in the room's groups, the table's paint in the table's. The
    // balls come last, in a group of their own per frame, so that no paint covers them.
    const traceAttrs = {fill: "none", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round"};
    tracesFixedG = svgEl("g", traceAttrs, svg);
    tracesRotG = svgEl("g", traceAttrs, svg);
    dashG = svgEl("g", {fill: "none", stroke: DASH, "stroke-width": 1.5, "stroke-dasharray": "6 5", "stroke-linecap": "round"}, svg);
    ballsFixedG = svgEl("g", {}, svg);
    ballsRotG = svgEl("g", {}, svg);
    for (const th of throws) {
      th.floorPath = svgEl("path", {stroke: th.color}, tracesFixedG);
      th.diskPath = svgEl("path", {stroke: th.color}, tracesRotG);
      th.dash = svgEl("path", {}, dashG);
      th.ball = svgEl("circle", {r: ballR, fill: th.color, stroke: "#fff", "stroke-width": 1.5});
      attach(th);
    }

    dragG = svgEl("g", {display: "none"}, svg);
    dragLine = svgEl("line", {"stroke-width": 2, "stroke-linecap": "round"}, dragG);
    dragHead = svgEl("path", {}, dragG);
    dragBall = svgEl("circle", {r: ballR, stroke: "#fff", "stroke-width": 1.5}, dragG);

    caption = svgEl("text", {x: 10, y: 10 + labelFont, "font-size": labelFont, fill: "#555"}, svg);
    updateCaption();
    redrawAll();
  }

  function updateCaption() {
    caption.textContent = frame === "fixed" ? "Seen from the room (fixed frame)" : "Seen from the turntable (rotating frame)";
  }

  // ---- throws ---------------------------------------------------------------------------------
  // `p` is where the ball starts and `d` the drag, both as seen on screen.
  function launch(p, d) {
    let v = scale(d, DRAG_GAIN);
    const speed = Math.hypot(v[0], v[1]);
    if (speed > SPEED_MAX) v = scale(v, SPEED_MAX / speed);
    let x0;
    if (frame === "fixed") {
      // The thrower stands in the room: undo the room's turn on screen and that is all.
      x0 = rot(p, -roomAngle());
      v = rot(v, -roomAngle());
    } else {
      // The thrower rides the table: the start and the throw are in the table's own
      // coordinates; turn them into room coordinates and add the table's own velocity at
      // the start, Ω × r.
      x0 = rot(p, theta - diskAngle());
      const vr = rot(v, theta - diskAngle());
      const W = omega();
      v = [vr[0] - W * x0[1], vr[1] + W * x0[0]];
    }
    const color = COLORS[nextColor++ % COLORS.length];
    const th = {
      x0, v, t0: simT, color,
      // Paint, as runs of points: on the floor in room coordinates, on the table in the
      // table's own, each run a flat [x, y, x, y, ...]. A new run starts at each crossing
      // of the rim.
      floorRuns: [], diskRuns: [],
      dFloor: "", dDisk: "",
      on: null,           // "disk" or "floor": where the last sample's paint went
      prevP: null, prevTheta: 0,
      out: false,         // beyond OUT_R: no more samples
      leftT: null,        // when the ball left the picture, from which the throw's fade is timed
      floorPath: svgEl("path", {stroke: color}, tracesFixedG),
      diskPath: svgEl("path", {stroke: color}, tracesRotG),
      dash: svgEl("path", {}, dashG),
      ball: svgEl("circle", {r: ballR, fill: color, stroke: "#fff", "stroke-width": 1.5}),
    };
    attach(th);
    while (throws.length >= MAX_THROWS) removeThrow(0);
    throws.push(th);
    sample(th);
    emit();
  }

  // Puts a throw's ball in the group of the frame being shown.
  function attach(th) {
    (frame === "fixed" ? ballsFixedG : ballsRotG).appendChild(th.ball);
  }

  function removeThrow(i) {
    const [th] = throws.splice(i, 1);
    th.floorPath.remove();
    th.diskPath.remove();
    th.dash.remove();
    th.ball.remove();
  }

  // Where the ball is now, in the room.
  const positionOf = th => {
    const dt = simT - th.t0;
    return [th.x0[0] + th.v[0] * dt, th.x0[1] + th.v[1] * dt];
  };

  // Lays the ball's paint down where it is now: on the table, in the table's coordinates,
  // or on the floor, in the room's. When the ball has crossed the rim since the last sample
  // the run is ended exactly at the rim and a new one begun there on the other side.
  function sample(th) {
    const p = positionOf(th);
    if (Math.hypot(p[0], p[1]) > OUT_R) { th.out = true; return; }
    const on = Math.hypot(p[0], p[1]) <= 1 ? "disk" : "floor";
    if (th.on && on !== th.on) {
      const s = rimCrossing(th.prevP, p);
      const pc = [th.prevP[0] + s * (p[0] - th.prevP[0]), th.prevP[1] + s * (p[1] - th.prevP[1])];
      const thetaC = th.prevTheta + s * (theta - th.prevTheta);
      paint(th, th.on, pc, thetaC);
      newRun(th, on);
      paint(th, on, pc, thetaC);
    } else if (!th.on) {
      newRun(th, on);
    }
    paint(th, on, p, theta);
    th.on = on;
    th.prevP = p;
    th.prevTheta = theta;
  }
  function newRun(th, on) {
    (on === "disk" ? th.diskRuns : th.floorRuns).push([]);
  }
  function paint(th, on, p, at) {
    if (on === "disk") {
      const q = rot(p, -at);
      const run = th.diskRuns[th.diskRuns.length - 1];
      th.dDisk += (run.length ? "L" : "M") + pt(q);
      run.push(q[0], q[1]);
    } else {
      const run = th.floorRuns[th.floorRuns.length - 1];
      th.dFloor += (run.length ? "L" : "M") + pt(p);
      run.push(p[0], p[1]);
    }
  }
  // Where the straight run from a to b crosses the rim, as a fraction of the way from a.
  function rimCrossing(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const A = dx * dx + dy * dy, B = 2 * (a[0] * dx + a[1] * dy), C = a[0] * a[0] + a[1] * a[1] - 1;
    const disc = B * B - 4 * A * C;
    if (A < 1e-12 || disc < 0) return 0.5;
    const root = Math.sqrt(disc);
    for (const s of [(-B - root) / (2 * A), (-B + root) / (2 * A)]) if (s >= 0 && s <= 1) return s;
    return 0.5;
  }

  function draw(th) {
    th.floorPath.setAttribute("d", th.dFloor);
    th.diskPath.setAttribute("d", th.dDisk);
    const p = positionOf(th);
    const q = frame === "fixed" ? p : rot(p, -theta);
    const visible = Math.hypot(q[0], q[1]) <= OUT_R;
    th.ball.style.display = visible ? "" : "none";
    if (visible) {
      const [sx, sy] = toScreen(q);
      th.ball.setAttribute("cx", sx.toFixed(1));
      th.ball.setAttribute("cy", sy.toFixed(1));
    }
    // The throw's fade is timed from the ball leaving the square of the picture. The ball's
    // place on screen is the same expression in either view: the room's coordinates turned
    // by the room's screen angle.
    const onScreen = rot(p, roomAngle());
    if (th.leftT == null && (Math.abs(onScreen[0]) > HALF_SIDE || Math.abs(onScreen[1]) > HALF_SIDE)) th.leftT = simT;
    const opacity = fadeOf(th);
    for (const el of [th.floorPath, th.diskPath, th.ball]) el.setAttribute("opacity", opacity.toFixed(3));

    // The dashed path, in the room view only: the straight line from the start to the ball.
    th.dash.style.display = frame === "fixed" ? "" : "none";
    if (frame === "fixed") {
      th.dash.setAttribute("d", `M${pt(th.x0)}L${pt(p)}`);
      th.dash.setAttribute("opacity", opacity.toFixed(3));
    }
  }
  // 1 until LINGER after the ball has left the picture (or LIFE_MAX after the throw), then
  // down to 0 over FADE.
  function fadeOf(th) {
    const from = Math.min(th.leftT == null ? Infinity : th.leftT + LINGER, th.t0 + LIFE_MAX);
    return simT < from ? 1 : clamp(1 - (simT - from) / FADE, 0, 1);
  }

  // Rebuilds the paint from its runs, after a resize.
  function redrawAll() {
    for (const th of throws) {
      th.dFloor = pathFrom(th.floorRuns);
      th.dDisk = pathFrom(th.diskRuns);
      draw(th);
    }
    placeFrames();
    drawDrag();
  }
  function pathFrom(runs) {
    let d = "";
    for (const flat of runs) for (let i = 0; i < flat.length; i += 2) d += (i ? "L" : "M") + pt([flat[i], flat[i + 1]]);
    return d;
  }

  function placeFrames() {
    // In the room view the table turns; in the turntable view the room turns the other way.
    const room = `rotate(${deg(roomAngle()).toFixed(2)} ${c} ${c})`;
    const disk = `rotate(${deg(diskAngle()).toFixed(2)} ${c} ${c})`;
    for (const g of [roomG, tracesFixedG, dashG, ballsFixedG]) g.setAttribute("transform", room);
    for (const g of [diskG, tracesRotG, ballsRotG]) g.setAttribute("transform", disk);
  }

  // ---- the clock ------------------------------------------------------------------------------
  function advance(dt) {
    simT += dt;
    theta += omega() * dt;
    placeFrames();
    for (let i = throws.length - 1; i >= 0; i--) {
      const th = throws[i];
      if (fadeOf(th) <= 0) { removeThrow(i); continue; }
      if (!th.out) sample(th);
      draw(th);
    }
  }

  // The clock runs from the first frame and stops for good once the widget has been taken
  // out of the page (it is not in the page yet when created, so that alone does not stop it).
  let last = null, wasConnected = false;
  function tick(now) {
    if (container.isConnected) wasConnected = true;
    else if (wasConnected) return;
    requestAnimationFrame(tick);
    // Capped so that a tab coming back from the background does not leap ahead.
    const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    advance(dt);
  }

  // ---- throwing with the pointer --------------------------------------------------------------
  function pointerPos(e) {
    const r = svg.getBoundingClientRect();
    return toPhys([e.clientX - r.left, e.clientY - r.top]);
  }
  svg.addEventListener("pointerdown", e => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    svg.setPointerCapture?.(e.pointerId);
    const p = pointerPos(e);
    drag = {p, q: p, color: COLORS[nextColor % COLORS.length], id: e.pointerId};
    drawDrag();
  });
  svg.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.q = pointerPos(e);
    drawDrag();
  });
  const release = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const {p, q} = drag;
    drag = null;
    drawDrag();
    if (e.type === "pointerup") launch(p, [q[0] - p[0], q[1] - p[1]]);
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  function drawDrag() {
    if (!dragG) return;
    if (!drag) { dragG.setAttribute("display", "none"); return; }
    dragG.removeAttribute("display");
    const [x0, y0] = toScreen(drag.p), [x1, y1] = toScreen(drag.q);
    const len = Math.hypot(x1 - x0, y1 - y0);
    dragLine.setAttribute("stroke", drag.color);
    dragHead.setAttribute("fill", drag.color);
    dragBall.setAttribute("fill", drag.color);
    dragBall.setAttribute("cx", x0.toFixed(1));
    dragBall.setAttribute("cy", y0.toFixed(1));
    if (len < 4) {
      dragLine.setAttribute("display", "none");
      dragHead.setAttribute("display", "none");
      return;
    }
    dragLine.removeAttribute("display");
    dragHead.removeAttribute("display");
    const tx = (x1 - x0) / len, ty = (y1 - y0) / len;
    const hl = 10, hw = 5;
    const bx = x1 - tx * hl, by = y1 - ty * hl;
    dragLine.setAttribute("x1", x0.toFixed(1));
    dragLine.setAttribute("y1", y0.toFixed(1));
    dragLine.setAttribute("x2", bx.toFixed(1));
    dragLine.setAttribute("y2", by.toFixed(1));
    dragHead.setAttribute("d",
      `M${x1.toFixed(1)},${y1.toFixed(1)}L${(bx - ty * hw).toFixed(1)},${(by + tx * hw).toFixed(1)}` +
      `L${(bx + ty * hw).toFixed(1)},${(by - tx * hw).toFixed(1)}Z`);
  }

  // ---- changes --------------------------------------------------------------------------------
  function setFrame(name) {
    if (name === frame) return;
    // Hold the picture where it is: the frame being let go hands its screen angle to the
    // one being taken hold of.
    held = name === "rotating" ? held + theta : held - theta;
    // A drag in progress belongs to the frame it started in; drop it rather than misread it.
    frame = name;
    drag = null;
    updateFrameButtons();
    updateCaption();
    for (const th of throws) { attach(th); draw(th); }
    placeFrames();
    drawDrag();
    emit();
  }

  function value() {
    return {frame, rpm, throws: throws.length};
  }
  function emit() {
    container.value = value();
    svg.setAttribute("aria-label",
      `A turntable ${describeRpm(rpm)}, seen from ${frame === "fixed" ? "the room" : "the turntable"}, ` +
      `with ${throws.length} ball${throws.length === 1 ? "" : "s"} in flight.`);
    container.dispatchEvent(new CustomEvent("input", {bubbles: true}));
  }

  function layoutControls() {
    title.style.fontSize = `${titleFont}px`;
  }

  layoutControls();
  updateFrameButtons();
  updateSpeedReadout();
  build();
  container.value = value();

  if (demo) {
    // Three gentle throws, a little apart in time, with the table started at an angle that
    // brings the frames' labels back upright by the end of the run.
    const step = 1 / 60, gap = 0.9;
    const run = s => { for (let i = 0; i < Math.round(s / step); i++) advance(step); };
    theta = -omega() * 3 * gap;
    held = 0;
    launch([-0.9, -0.1], [0.22, 0.02]);
    run(gap);
    launch([0.1, -0.85], [0.03, 0.22]);
    run(gap);
    launch([0.6, 0.7], [-0.2, -0.07]);
    run(gap);
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

function describeRpm(rpm) {
  if (rpm === 0) return "not turning";
  const n = Math.abs(rpm);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} rpm ${rpm > 0 ? "anticlockwise" : "clockwise"}`;
}
function scale([x, y], k) {
  return [x * k, y * k];
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
