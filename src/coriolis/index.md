# The Coriolis effect

A ball thrown across a spinning turntable, watched from two places at once. Press, drag and release anywhere on the figure to throw: the ball starts where you pressed and sets off along the drag, faster for a longer drag. Seen from the room, it rolls in a straight line at a steady speed, because nothing pushes it sideways. Seen from the turntable, the very same ball curves away. The toggle switches between the two views, even mid-flight, and the slider turns the table faster, slower, or the other way.

```js
import {createCoriolisWidget} from "./widget.js";
```

```js
const coriolis = view(createCoriolisWidget());
```

## What to look for

**Same ball, two paths.** Throw a ball from the edge of the table toward the centre, then switch between *the room* and *the turntable*. From the room the trace is a straight line; from the turntable it bends. Nothing about the ball changed; only the observer did. The curve is what a straight line looks like to someone who is turning.

**It bends to the right.** With the table turning anticlockwise, as the slider opens, every throw bends to the right of where it was aimed, whichever way it was thrown. Drag the slider past zero to turn the table clockwise and every throw bends left. Looked at from above the North Pole, the Earth turns anticlockwise, so in the Northern Hemisphere moving air is deflected to the right and in the Southern Hemisphere to the left. That deflection is why air flowing toward a low-pressure centre spirals around it instead of filling it in, anticlockwise north of the equator and clockwise south of it, and why the trade winds come from the east.

**Faster turning bends it more.** Push the rotation up and the same throw bends harder. Set it to zero and the two views agree: the straight line is all there is.

**A ball at rest is not at rest.** In the turntable view, click without dragging. To the rider on the table the ball was simply put down, yet it slides away, because the table was moving under it and the frictionless ball keeps that motion. The room view shows it leaving along a tangent at the table's own speed.

## About the figure

The ball is frictionless, so its path in the room is exactly ${tex`\mathbf{x}(t) = \mathbf{x}_0 + \mathbf{v}\,t`}. The turntable view is the same points turned back through the angle the table has turned through since each one was passed, ${tex`\theta(t) = \Omega t`}, so the two traces are one set of samples drawn two ways, and the toggle switches between them with nothing recomputed. In the turntable view the thrower is a rider on the table: the drag is the ball's velocity relative to the table, and the table's own velocity at that point, ${tex`\boldsymbol{\Omega} \times \mathbf{r}`}, is added to it. That is why a ball always leaves the way it was thrown, and why a ball put down without a throw drifts off. In the room view the thrower stands on the floor and the drag is the ball's velocity outright.

What the rider sees is described in the rotating frame by two fictitious forces: the centrifugal force ${tex`m\Omega^2 \mathbf{r}`}, outward, and the Coriolis force ${tex`-2m\,\boldsymbol{\Omega} \times \mathbf{v}'`}, at right angles to the velocity ${tex`\mathbf{v}'`} seen on the table. The figure does not compute either; they are a way of accounting for the straight line from a turning point of view. The speed of a throw is 2.5 disk radii per second per disk radius of drag, capped at four radii per second, and the table turns at up to 10 turns per minute either way. A trace is kept for ten seconds and then fades over two; up to ten balls can be in the air at once, after which the oldest goes first.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "coriolis/embed",
  height: 820,
  title: "The Coriolis effect",
  note: "The figure is square and as wide as the frame allows, up to 640&nbsp;px; above it sit the " +
    "title and the controls, below it a one-line note. Allow about 500&nbsp;px for a 320&nbsp;px " +
    "phone-width frame.",
  script: `<div id="coriolis"></div>

<script type="module">
  import {createCoriolisWidget}
    from "${cdnUrl("coriolis/widget.js")}";

  // Options: {frame: "fixed"} opens with the view from the room instead of the
  // turntable; {rpm: 6} sets the rotation in turns per minute, negative for
  // clockwise; {width: 480} caps the figure's side.
  document.getElementById("coriolis")
    .appendChild(createCoriolisWidget());
<\/script>`
}));
```

---

Sources and credits:

- The turntable demonstration follows the classic one in *Frames of Reference* (1960), the Physical Science Study Committee film with Patterson Hume and Donald Ivey, and the animated turntable on Wikipedia's [Coriolis force](https://en.wikipedia.org/wiki/Coriolis_force) page.
- The figure uses no data.
