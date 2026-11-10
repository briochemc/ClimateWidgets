# From coal to a light bulb

Of 100 units of energy in a lump of coal, how many end up as light? The chain is drawn as a Sankey: the energy enters at the power station on the left and most of it leaves up the cooling tower as heat; a little more warms the wires on the way; what reaches the house goes into the bulb, and an incandescent bulb turns nearly all of that into heat too, leaving 2 units of light. Switch to the **LED**: it makes the same light from 6 units instead of 36, so 30 of the units delivered to the house are not needed at all, and the whole chain behind them shrinks. The slider sets the **power station's efficiency**, from an old coal plant to a gas combined-cycle one.

```js
import {createEnergyChainWidget} from "./widget.js";
```

```js
const energy = view(createEnergyChainWidget());
```

The numbers are the course's own illustration: a station that sends out 38 of 100 units, wires that lose 2 of those, an incandescent bulb that draws 36 units to give 2 of light (about 5% efficient) and an LED that draws 6 for the same 2 (about 33%). Moving the slider scales the station's loss and, with it, the wires' share. None of this counts the energy spent mining, processing and transporting the coal.

## Embed this widget

```js
import {embedSnippets, libUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "energy-chain/embed",
  height: 400,
  title: "From coal to a light bulb",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about 320&nbsp;px; allow about 440&nbsp;px of height at phone width. " +
    "The embed page is preset through its URL: <code>?bulb=led</code> or <code>incandescent</code>, and <code>?efficiency=45</code> (per cent).",
  script: `<div id="energy-chain"></div>

<script type="module">
  import {createEnergyChainWidget}
    from "${libUrl("energy-chain/widget.js")}";

  // Options: {bulb: "led" | "incandescent"}, {efficiency: 0.45}.
  document.getElementById("energy-chain")
    .appendChild(createEnergyChainWidget());
<\/script>`
}));
```

---

Figures after the course's own schematic (CLIM1001, week 10); the efficiencies on the slider are round numbers for an old subcritical coal plant, a modern ultra-supercritical one and a combined-cycle gas turbine.
