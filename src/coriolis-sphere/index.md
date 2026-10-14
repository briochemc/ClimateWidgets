# The Coriolis effect on the Earth

The [turntable](../coriolis/), but on the Earth. Press, drag and release on the globe to launch a parcel of air or water: it starts where you pressed and sets off the way you dragged, at the speed over the ground that shows as you drag, from the 10 cm/s of an ocean current to the 300 km/h of the fiercest storm. Nothing then acts on it but the Earth's turning, so it keeps its speed and only its direction changes. It bends and goes round in a loop, clockwise in the north and anticlockwise in the south. The Earth's size and spin are real; only the clock is sped up, one day a second, because at real speed you would watch for hours and see nothing move. The triangles around the globe turn it to look at any part of it, and + and − zoom in and out; dragging is kept for throwing. Left alone, the figure plays a tour: it zooms in on the Tasman Sea off the east coast of Australia and sets a handful of parcels of water going at the pace of the East Australian Current, waits for them to fade, then pulls back over the continent and sets a handful of parcels of air going at a gale's pace, and round again. Touch anything and the tour stops; *Play tour* starts it again.

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

**The drag is a log scale, a factor of ten for about every tenth of the width.** It runs from 10 cm/s at a hundredth of the figure's width to 300 km/h at a third of it, and stays there for anything longer. The first tenth or so covers 10 cm/s to 1 m/s, the ocean's surface currents, with the Gulf Stream and the Kuroshio at 2 m/s just beyond it; the next to 10 m/s, everyday winds from a breath of air to a fresh breeze; and the last to 300 km/h, 83 m/s, from a gale through a hurricane's 70 m/s to the jet stream and about the most any wind sustains. The slow drift of the deep ocean, a few centimetres a second, is left out: it would make loops too small to see even zoomed right in.

**Real winds make small loops, so zoom in.** A 10 m/s wind at 45° loops in a circle only 200 km across, and a 1 m/s ocean current one of 20 km, both hard to see on a whole globe, so use + to zoom in on the place you are throwing from. The loops are small compared with the Earth, but they are not small compared with the weather: a 200 km loop is as big as a storm, and a 20 km one is what a drifting buoy does for days after a wind has dropped.

**Seen from space it would hardly bend at all.** The figure keeps the view fixed to the Earth, which is the view the weather is seen in. From space the globe would be turning under the parcel at hundreds of metres a second, and what looks like a loop here would be a slight wobble on a parcel that is mostly just going round with the ground under it. The [turntable](../coriolis/) shows that other view.

## Why only the Coriolis effect, in plain words

A rider on the turntable feels two pushes that are not really there: one outward, away from the centre (the centrifugal push), and one sideways, at right angles to wherever they are moving (the Coriolis push). Both come from the rider's own turning, not from anything acting on the ball. The Earth is a turntable too, so both pushes exist on the Earth.

But the Earth has had four and a half billion years to answer the outward push. It bulged at the equator, by 21 km, until its surface was exactly the shape where the outward push is cancelled by gravity's slight tilt. On that surface a parcel sitting still feels no push at all, which is why the oceans do not slide toward the equator. Had the Earth been a perfect sphere, they would.

What is left is the sideways push, which acts only on things that are moving. That is the Coriolis effect, and it is all this figure includes. It is strongest at the poles, where the ground under your feet turns like a turntable, and zero at the equator, where the ground only tumbles forward and does not turn around you at all. In between it goes as the sine of the latitude. It is what turns the air flowing into a low into a spinning storm, and what makes the trade winds blow from the east.

## About the figure

The parcel's position and velocity are kept as vectors on the sphere, in the Earth's own rotating frame, and stepped with a fourth-order Runge–Kutta integrator. The acceleration is the horizontal Coriolis term alone, ${tex`-f\,\hat{\mathbf r} \times \mathbf v`} with ${tex`f = 2\Omega \sin\varphi`}, plus the term that keeps the parcel on the sphere; after each step the parcel is put back on the surface and its speed is put back to what it was. With ${tex`f = 0`} the parcel runs along a great circle; with it, a parcel left alone traces an inertial circle of radius ${tex`v/f`} and period ${tex`2\pi/f`}: 12 h at a pole, 17 h at 45°, longer and longer toward the equator. Dropping the centrifugal term and the vertical part of the Coriolis term is the standard *traditional approximation* of meteorology, and it is the right physics for air and water on the real, oblate Earth, as explained above.

The Earth's radius is 6371 km and its rotation 7.29 × 10<sup>−5</sup> rad/s, one turn per sidereal day. The clock runs one day a second. A throw is relative to the ground, since a wind is a motion relative to the Earth; the drag's length sets the logarithm of the speed, as a log slider does: a hundredth of the figure's width is 10 cm/s, a third of it 300 km/h, and anything longer stays at 300 km/h; and the speed shows beside the arrow as you drag, in cm/s for a current and m/s with km/h for a wind, with what moves at that speed under it: a slow ocean current below 0.5 m/s, a fast one such as the Gulf Stream to 3 m/s, a breeze to 14 m/s, where the Beaufort scale's near gale begins, and a gale or a storm beyond. Each parcel and its trace are coloured by the logarithm of its speed, cyan for the slowest through blue to pink for the fastest, on Peter Kovesi's isoluminant CET-I3 map (darkened a little), so that no speed stands out more than another; the marker is twice as wide as the trace. The globe is an orthographic projection seen, to begin with, from above 20° S, 135° E; the triangles at the sides of the figure turn the view at 45° a second while held, slower when zoomed in, the + and − buttons zoom by half at a time up to 100 times, and the arrow keys and + and − do the same once the figure has focus. A trace is kept for forty seconds, forty days of the Earth's time, and then fades over eight; up to twenty parcels can be in the air at once, after which the oldest goes first. The land is the 110 m Natural Earth outline.

The tour has two scenes. The first flies the view to 153.5° E, 31.5° S at nine times zoom over five seconds and starts sixteen parcels of water, one every third of a second, at random spots between half a degree and two and a half degrees off the coast between 27° S and 36° S, heading roughly south as the East Australian Current does, at speeds drawn evenly in the logarithm between 0.1 and 2 m/s. The second flies back out to 134° E, 26° S at 2.2 times zoom and starts eight parcels of air at random spots over the continent, in random directions, at 15 to 40 m/s. A tour parcel stays eight seconds before it fades, each scene waits until its parcels have gone, and the tour goes round again. It does not play for a reader whose system asks for reduced motion, and the embed takes `?tour=0` to leave it off.

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
    "title and a note. Allow about 500&nbsp;px for a 320&nbsp;px phone-width frame.",
  script: `<div id="coriolis-sphere"></div>

<script type="module">
  import {createCoriolisSphereWidget}
    from "${cdnUrl("coriolis-sphere/widget.js")}";

  const world = await fetch("${cdnUrl("data/countries-110m.json")}").then(r => r.json());

  // Options: {width: 480} caps the figure's side; {tour: false} leaves the figure
  // still until it is touched. Leave out \`world\` for a globe with no land.
  document.getElementById("coriolis-sphere")
    .appendChild(createCoriolisSphereWidget({world}));
<\/script>`
}));
```

---

Sources and credits:

- The physics is the standard horizontal momentum equations on a rotating sphere with only the Coriolis term retained, as in any text on geophysical fluid dynamics, for instance Vallis, *Atmospheric and Oceanic Fluid Dynamics* (2nd ed., 2017), chapter 2, where inertial oscillations are treated too.
- The world map is the 110 m [Natural Earth](https://www.naturalearthdata.com/) land outline.
- The speed colours are Peter Kovesi's CET-I3 isoluminant colour map, from the [colorcet](https://colorcet.holoviz.org/) collection (CC BY 4.0), darkened by a fifth.
