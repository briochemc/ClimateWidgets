# Climate Widgets

Small, self-contained interactive figures for teaching climate science. Each widget is one page, and each page ends with a copy-pastable snippet so you can drop the widget into your own site or LMS — as an iframe, or as a script tag that renders it inline.

<div class="grid grid-cols-3 widget-cards">
  <a class="card" href="./draw-the-future/">
    <h2>Draw the future</h2>
    <img class="thumb" src="./assets/thumbnails/draw-the-future.png" alt="Two stacked panels: atmospheric CO₂ curves for the CMIP7 scenarios above, and historical CO₂ emissions and natural sink below, marked &ldquo;Draw from here!&rdquo;">
  </a>
  <a class="card" href="./temperature-trend/">
    <h2>Temperature trends</h2>
    <img class="thumb" src="./assets/thumbnails/temperature-trend.png" alt="The GISTEMP global temperature record with a fitted trend line and a two-handle year-range slider">
  </a>
  <a class="card" href="./sst-daily/">
    <h2>Daily sea surface temperature</h2>
    <img class="thumb" src="./assets/thumbnails/sst-daily.png" alt="Daily sea surface temperature since 1981 drawn as a spiral, with the current year standing out well beyond the pack">
  </a>
  <a class="card" href="./vlasceanu-etal-2024/">
    <h2>Vlasceanu et al. 2024</h2>
    <img class="thumb" src="./assets/thumbnails/vlasceanu-etal-2024.png" alt="A bar of the 63-country mean beside a world map in the Equal Earth projection, shaded from brown to blue-green by belief in climate change">
  </a>
  <a class="card" href="./andre-etal-2024/">
    <h2>Andre et al. 2024</h2>
    <img class="thumb" src="./assets/thumbnails/andre-etal-2024.png" alt="A bar chart of global yes/no shares beside a world map in the Equal Earth projection, shaded from pale yellow to navy by the share willing to contribute 1% of income to fight global warming">
  </a>
  <a class="card" href="./leiserowitz-etal-2026/">
    <h2>Global Warming's Six Americas</h2>
    <img class="thumb" src="./assets/thumbnails/leiserowitz-etal-2026.png" alt="A stacked area chart of six climate-opinion segments from 2008 to 2025, with a time slider, beside horizontal bars showing the latest survey's shares">
  </a>
  <a class="card" href="./hickman-etal-2021/">
    <h2>Hickman et al. 2021</h2>
    <img class="thumb" src="./assets/thumbnails/hickman-etal-2021.png" alt="Five bars from not worried to extremely, colored navy to dark red, with a bracket over the very and extremely bars reading 59% very or extremely worried">
  </a>
  <a class="card" href="./consensus-studies/">
    <h2>Studies of the scientific consensus</h2>
    <img class="thumb" src="./assets/thumbnails/consensus-studies.png" alt="A row of study buttons above one large green pie chart reading 97%, the share of Cook et al. 2013's abstracts endorsing human-caused warming, with the paper cited below it">
  </a>
  <a class="card" href="./leviston-etal-2013/">
    <h2>Actual vs. perceived opinion</h2>
    <img class="thumb" src="./assets/thumbnails/leviston-etal-2013.png" alt="Four coloured bars of Australian opinion on climate change, with a dashed outline over each showing the actual split for comparison">
  </a>
  <a class="card" href="./probability-words/">
    <h2>What a probability word means</h2>
    <img class="thumb" src="./assets/thumbnails/probability-words.png" alt="Four rows, one per probability word, each a swarm of bubbles sized by how many people gave that answer on a 0 to 100 percent scale; bubbles inside the IPCC's own shaded range are green and the many outside it are orange">
  </a>
  <a class="card" href="./blackbody-radiation/">
    <h2>Black-body radiation</h2>
    <img class="thumb" src="./assets/thumbnails/blackbody-radiation.png" alt="Planck's curve of spectral radiance against a logarithmic wavelength axis for the Sun at 5772 K, with the band of visible light coloured in under its peak, fainter gray curves for cooler and hotter objects, and beneath the axis a temperature slider, running from blue-white through orange to black, whose handle sits directly under the peak">
  </a>
  <a class="card" href="./atmospheric-composition/">
    <h2>What the air is made of</h2>
    <img class="thumb" src="./assets/thumbnails/atmospheric-composition.png" alt="A 10-by-10 grid of blue-grey argon squares with a small orange block of carbon dioxide in the bottom row, zoomed into from a strip of much larger oxygen squares visible above and to the left; each square is 100 parts per million of the air">
  </a>
  <a class="card" href="./atmospheric-transmission/">
    <h2>Atmospheric transmission</h2>
    <img class="thumb" src="./assets/thumbnails/atmospheric-transmission.png" alt="Three panels on a logarithmic wavelength axis: the Sun's and the Earth's glow curves in faint gold and red, filled solidly where the light gets through the atmosphere, below them the fraction the atmosphere absorbs as a grey area with a wide gap in the visible and a narrower one near 10 micrometres, and below that one coloured row per gas showing where each one absorbs">
  </a>
</div>

<style>
  /* Narrower than the prose above it: the cards are for picking a widget out by sight,
     so they only need to be big enough to tell the three figures apart. */
  .widget-cards {
    max-width: 620px;
  }
  /* Column layout with the image pushed to the bottom, so a title that wraps onto a
     second line does not shunt its thumbnail out of line with the others. */
  .widget-cards .card {
    display: flex;
    flex-direction: column;
    padding: 0.6rem;
    color: inherit;
    text-decoration: none;
  }
  .widget-cards .thumb {
    margin-top: auto;
  }
  .widget-cards .card:hover {
    border-color: var(--theme-foreground-focus);
  }
  .widget-cards .card:hover h2 {
    color: var(--theme-foreground-focus);
  }
  .widget-cards h2 {
    margin: 0 0 0.5rem;
    text-wrap: balance;
  }
  /* The thumbnails are captured square (see scripts/take-thumbnails.mjs); cover-cropping
     is only a safety net so a re-captured image of another shape still fills the card. */
  .widget-cards .thumb {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    object-position: 50% 0;
    background: #fff;
    border: solid 1px var(--theme-foreground-faintest);
    border-radius: 0.5rem;
    box-sizing: border-box;
  }
</style>
