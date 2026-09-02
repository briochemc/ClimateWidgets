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
    <img class="thumb" src="./assets/thumbnails/consensus-studies.png" alt="Ten green pie charts, one per study of the scientific consensus from 2004 to 2021, each nearly whole and labelled with its percentage, from 91% to 100%">
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
  /* The thumbnails are captured square (see scripts/take-thumbnails.sh); cover-cropping
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
