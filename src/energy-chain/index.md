# From plant to a light bulb

Of 100 units of energy in a lump of coal, how many end up as light? The chain is drawn as a Sankey: the energy enters at the power station on the left and most of it leaves up the cooling tower as heat; a little more warms the wires on the way; what reaches the house goes into as many bulbs as it can light, and an incandescent bulb turns nearly all of that into heat too, leaving 2 units of light from the one bulb the 36 units can run. Switch to the **LED**: it makes the same light from 6 units instead of 36, so the same 36 units light six of them and give 12 units of light. Pick another **source** and the plant takes that source's typical efficiency, which the slider then moves: a gas turbine keeps more than half, a reactor a third, a geothermal plant a sixth; a hydro turbine captures nine tenths of the water's energy, a wind turbine a little under half of the wind through its rotor, a solar panel a fifth of the sunlight that falls on it.

```js
import {createEnergyChainWidget} from "./widget.js";
```

```js
const energy = view(createEnergyChainWidget());
```

The coal numbers are the course's own illustration: a station that sends out 38 of 100 units, wires that lose 2 of those, an incandescent bulb that draws 36 units to give 2 of light (about 5% efficient) and an LED that draws 6 for the same 2 (about 33%). Whatever reaches the house is spent on bulbs, as many as it will run (a fraction of one, when there is not enough for one), so the losses are the plant's, the wires' and the bulbs' heat, and the light is what is left. Moving the slider scales the plant's loss and, with it, the wires' share. The other sources' efficiencies are typical figures, rounded: 58% for a combined-cycle gas turbine (35–40% for open cycle), 33% for a nuclear reactor's steam cycle, 30% for a biomass boiler, 15% for a geothermal plant, whose steam is cool, 90% for a hydro turbine, 45% for a wind turbine (the energy counted is the wind through the rotor, of which no turbine can take more than Betz's 59%) and 20% for a solar panel (the sunlight falling on it). For the last four nothing is burned, so what the plant does not capture is not wasted fuel, just energy that passes by. None of this counts the energy spent mining, processing and transporting a fuel, or building the plant.

## Embed this widget

```js
import {embedSnippets, libUrl} from "../components/embed-snippet.js";
```

```js
display(embedSnippets({
  embedPath: "energy-chain/embed",
  height: 400,
  title: "From plant to a light bulb",
  note: "The figure fills its column up to 640&nbsp;px wide and reflows down to about 320&nbsp;px; allow about 440&nbsp;px of height at phone width. " +
    "The embed page is preset through its URL: <code>?source=wind</code> (coal, gas, nuclear, biomass, geothermal, hydro, wind, solar), " +
    "<code>?bulb=led</code> or <code>incandescent</code>, and <code>?efficiency=45</code> (per cent, overriding the source's typical figure).",
  script: `<div id="energy-chain"></div>

<script type="module">
  import {createEnergyChainWidget}
    from "${libUrl("energy-chain/widget.js")}";

  // Options: {source: "wind"} (coal, gas, nuclear, biomass, geothermal, hydro, wind, solar), {bulb: "led" | "incandescent"}, {efficiency: 0.45}.
  document.getElementById("energy-chain")
    .appendChild(createEnergyChainWidget());
<\/script>`
}));
```

---

Figures after the course's own schematic (CLIM1001, week 10). The sources' typical efficiencies are rounded from the ranges in IPCC AR5 Working Group III, Annex III (technology-specific cost and performance parameters) and the IEA's technology assessments; the marks on the slider are round numbers for an old subcritical coal plant, a modern ultra-supercritical one and a combined-cycle gas turbine.
