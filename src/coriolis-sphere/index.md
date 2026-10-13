# The Coriolis effect on the Earth

The [turntable](../coriolis/), but on the Earth. Press, drag and release on the globe to launch a parcel of air: it starts where you pressed and sets off the way you dragged, at the speed over the ground that shows as you drag. Nothing then acts on it but the Earth's turning, so it keeps its speed and only its direction changes. Seen from the Earth, it bends and goes round in a loop, clockwise in the north and anticlockwise in the south. Seen from space, the globe turns underneath it. The Earth's size and spin are real; only the clock is sped up, one day in ten seconds, because at real speed you would watch for hours and see nothing move.

```js
import {createCoriolisSphereWidget} from "./widget.js";

const world = await FileAttachment("../data/countries-110m.json").json();
```

```js
const coriolis = view(createCoriolisSphereWidget({world}));
```

## What to look for

**It loops.** Launch a parcel in the Northern Hemisphere and wait a few seconds. It bends to the right, keeps bending, and comes back round to where it started: a circle, called an inertial circle, that it goes round clockwise. Launch one in the Southern Hemisphere and it goes round anticlockwise. On the turntable the ball left the table before it could do this; on the Earth there is nowhere to go, so the bending has time to close the loop.

**The loop takes the same time whatever the speed.** A fast parcel makes a big loop and a slow one a small loop, and they go round in the same time: twelve hours at a pole, seventeen hours at 45° of latitude, a day at 30°. Launch a fast and a slow parcel side by side and watch them come round together.

**Near the equator it hardly bends.** Launch a parcel near the equator and it runs almost straight, taking days to come round, and its loop is enormous. The effect is strongest at the poles and vanishes at the equator. That is why tropical cyclones never form within a few degrees of the equator: nothing there turns the inflowing air into a spin.

**Real winds make small loops.** A 10 m/s wind at 45° loops in a circle 100 km across, hard to see on a globe. The figure lets you throw up to 150 m/s, which is what a jet stream and more does, so that the loops are big enough to see; a hurricane's winds are 70 m/s, and ocean currents are 1 m/s or less. The loops are small compared with the Earth, but they are not small compared with the weather: a 100 km loop is as big as a storm.

**From space.** Switch to *space* and the globe turns under the parcel. What looked like a loop is a wobble on a parcel that is mostly just going round with the Earth, as the ground under it is, at hundreds of metres a second.

## Why only the Coriolis effect, in plain words

A rider on the turntable feels two pushes that are not really there: one outward, away from the centre (the centrifugal push), and one sideways, at right angles to wherever they are moving (the Coriolis push). Both come from the rider's own turning, not from anything acting on the ball. The Earth is a turntable too, so both pushes exist on the Earth.

But the Earth has had four and a half billion years to answer the outward push. It bulged at the equator, by 21 km, until its surface was exactly the shape where the outward push is cancelled by gravity's slight tilt. On that surface a parcel sitting still feels no push at all, which is why the oceans do not slide toward the equator. Had the Earth been a perfect sphere, they would.

What is left is the sideways push, which acts only on things that are moving. That is the Coriolis effect, and it is all this figure includes. It is strongest at the poles, where the ground under your feet turns like a turntable, and zero at the equator, where the ground only tumbles forward and does not turn around you at all. In between it goes as the sine of the latitude. It is what turns the air flowing into a low into a spinning storm, and what makes the trade winds blow from the east.

## About the figure

The parcel's position and velocity are kept as vectors on the sphere, in the Earth's own rotating frame, and stepped with a fourth-order Runge–Kutta integrator. The acceleration is the horizontal Coriolis term alone, ${tex`-f\,\hat{\mathbf r} \times \mathbf v`} with ${tex`f = 2\Omega \sin\varphi`}, plus the term that keeps the parcel on the sphere; after each step the parcel is put back on the surface and its speed is put back to what it was. With ${tex`f = 0`} the parcel runs along a great circle; with it, a parcel left alone traces an inertial circle of radius ${tex`v/f`} and period ${tex`2\pi/f`}: 12 h at a pole, 17 h at 45°, longer and longer toward the equator. Dropping the centrifugal term and the vertical part of the Coriolis term is the standard *traditional approximation* of meteorology, and it is the right physics for air and water on the real, oblate Earth, as explained above.

The Earth's radius is 6371 km and its rotation 7.29 × 10<sup>−5</sup> rad/s, one turn per sidereal day. The clock runs one day in ten seconds unless the slider says otherwise. A throw is always relative to the ground, since a wind is a motion relative to the Earth, whichever view is showing; the speed is 125 m/s per globe radius of drag, capped at 150 m/s. The globe is an orthographic projection seen from above 20° S and, to begin with, 135° E. In the space view it turns; in the Earth view it stands still; switching views holds the picture where it is and lets the other frame go. A trace is kept for ten seconds and then fades over two; up to ten parcels can be in the air at once, after which the oldest goes first. The land is the 110 m Natural Earth outline.

## Embed this widget

```js
import {embedSnippets, cdnUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "coriolis-sphere/embed",
  height: 840,
  title: "The Coriolis effect on the Earth",
  note: "The figure is square and as wide as the frame allows, up to 640&nbsp;px; above it sit the " +
    "title and the controls, below it a note. Allow about 520&nbsp;px for a 320&nbsp;px " +
    "phone-width frame.",
  script: `<div id="coriolis-sphere"></div>

<script type="module">
  import {createCoriolisSphereWidget}
    from "${cdnUrl("coriolis-sphere/widget.js")}";

  const world = await fetch("${cdnUrl("data/countries-110m.json")}").then(r => r.json());

  // Options: {frame: "fixed"} opens with the view from space instead of the Earth;
  // {daySeconds: 20} runs the clock at one day in 20 s; {width: 480} caps the
  // figure's side. Leave out \`world\` for a globe with no land.
  document.getElementById("coriolis-sphere")
    .appendChild(createCoriolisSphereWidget({world}));
<\/script>`
}));
```

---

Sources and credits:

- The physics is the standard horizontal momentum equations on a rotating sphere with only the Coriolis term retained, as in any text on geophysical fluid dynamics, for instance Vallis, *Atmospheric and Oceanic Fluid Dynamics* (2nd ed., 2017), chapter 2, where inertial oscillations are treated too.
- The world map is the 110 m [Natural Earth](https://www.naturalearthdata.com/) land outline.
