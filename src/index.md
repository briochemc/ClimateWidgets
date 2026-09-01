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
  <a class="card" href="./belief-map/">
    <h2>Belief in climate change</h2>
    <img class="thumb" src="./assets/thumbnails/belief-map.png" alt="A world map in the Equal Earth projection with countries shaded from brown to blue-green by mean belief in climate change">
  </a>
  <a class="card" href="./policy-support-map/">
    <h2>Support for climate policy</h2>
    <img class="thumb" src="./assets/thumbnails/policy-support-map.png" alt="A world map in the Equal Earth projection with countries shaded from brown to blue-green by mean support for climate policy">
  </a>
  <a class="card" href="./climate-action-support/">
    <h2>Support for climate action</h2>
    <img class="thumb" src="./assets/thumbnails/climate-action-support.png" alt="A bar chart of global yes/no shares beside a world map in the Equal Earth projection, shaded from pale yellow to navy by the share willing to contribute 1% of income to fight global warming">
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
