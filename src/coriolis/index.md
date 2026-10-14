# The Coriolis effect

A ball thrown across a spinning turntable, watched from two places at once. Press, drag and release anywhere on the figure to throw: the ball starts where you pressed and sets off along the drag, faster for a longer drag. Seen from the room, it rolls in a straight line at a steady speed, because nothing pushes it sideways. Seen from the turntable, the very same ball curves away. The toggle switches between the two views, even mid-flight, without moving anything on screen: whichever frame was turning simply stops, and the other starts. The slider turns the table faster, slower, or the other way. The [companion figure](../coriolis-sphere/) does the same on the Earth.

```js
import {createCoriolisWidget} from "./widget.js";
```

```js
const coriolis = view(createCoriolisWidget());
```

## What to look for

**The ball leaves paint.** As in a lab experiment with a wet ball, the ball paints its path on whatever it passes over: the paint on the table turns with the table, the paint on the floor around it stays where it is. Throw a ball from the edge of the table toward the centre and watch from *the room*: the dashed black line is the ball's actual path, dead straight, and it fades with the paint a moment after the ball has left the picture; the paint on the floor lies along it, but the paint on the table is carried round and curves. Switch to *the turntable* and the table's paint lies still, bent, while the floor's paint goes round the other way. Nothing about the ball changed; only the observer did. The curve is what a straight line looks like to someone who is turning.

**It bends to the right.** With the table turning anticlockwise, as the slider opens, every throw bends to the right of where it was aimed, whichever way it was thrown. Drag the slider past zero to turn the table clockwise and every throw bends left. Looked at from above the North Pole, the Earth turns anticlockwise, so in the Northern Hemisphere moving air is deflected to the right and in the Southern Hemisphere to the left. That deflection is why air flowing toward a low-pressure centre spirals around it instead of filling it in, anticlockwise north of the equator and clockwise south of it, and why the trade winds come from the east.

**Faster turning bends it more.** Push the rotation up and the same throw bends harder. Set it to zero and the two views agree: the straight line is all there is.

**A ball at rest is not at rest.** Watching from the turntable, click on the table without dragging. To the rider the ball was simply put down, yet it slides away, because the table was moving under it and the frictionless ball keeps that motion; the room view shows it leaving along a tangent at the table's own speed. Click on the floor outside the table instead and the ball is at rest in the room, and the rider sees it go round the whole table once per turn: to the rider, a thing that is still in the room is moving.

## About the figure

The ball is frictionless, so its path in the room is exactly ${tex`\mathbf{x}(t) = \mathbf{x}_0 + \mathbf{v}\,t`}. Each sample of the path is painted onto whatever is under the ball at the time: in room coordinates if it is on the floor, and if it is on the table in the table's own coordinates, the room point turned back through the angle ${tex`\theta(t) = \Omega t`} the table has turned through so far. A run of paint is ended exactly at the rim and a new one begun there when the ball crosses it. The two views then differ only in which of the two is held still on screen, so the toggle switches between them with nothing recomputed. The thrower stands on whatever the ball starts on. From the floor, in either view, the drag is the ball's velocity in the room. From on the table in the turntable view the thrower is a rider: the drag is the ball's velocity relative to the table, and the table's own velocity at that point, ${tex`\boldsymbol{\Omega} \times \mathbf{r}`}, is added to it. Either way the ball sets off exactly along the arrow and then, in the turntable view, is seen to bend.

What the rider sees is described in the rotating frame by two fictitious forces: the centrifugal force ${tex`m\Omega^2 \mathbf{r}`}, outward, and the Coriolis force ${tex`-2m\,\boldsymbol{\Omega} \times \mathbf{v}'`}, at right angles to the velocity ${tex`\mathbf{v}'`} seen on the table. The figure does not compute either; they are a way of accounting for the straight line from a turning point of view. The speed of a throw is 2.5 disk radii per second per disk radius of drag, capped at four radii per second, and the table turns at up to 10 turns per minute either way. A throw, its paint and its dashed path together, stays until a second after the ball has left the square of the picture and then fades over two seconds, so a slow ball is followed for as long as it takes (a ball that never leaves fades after a minute); up to ten balls can be in the air at once, after which the oldest goes first.

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
    "title, a note and the controls. Allow about 500&nbsp;px for a 320&nbsp;px " +
    "phone-width frame.",
  script: `<div id="coriolis"></div>

<script type="module">
  import {createCoriolisWidget}
    from "${cdnUrl("coriolis/widget.js")}";

  // Options: {frame: "rotating"} opens with the view from the turntable instead of
  // the room; {rpm: 6} sets the rotation in turns per minute, negative for
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
