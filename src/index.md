# Climate Widgets

Small, self-contained interactive figures for teaching climate science. Each widget is one page, and each page ends with a copy-pastable snippet so you can drop the widget into your own site or LMS — as an iframe, or as a script tag that renders it inline.

<div class="grid grid-cols-3">
  <div class="card">
    <a href="./draw-the-future/"><img class="thumb" src="./assets/thumbnails/draw-the-future.png" alt="Two stacked panels: atmospheric CO₂ curves for the CMIP7 scenarios above, and historical CO₂ emissions and natural sink below, marked &ldquo;Draw from here!&rdquo;"></a>
    <h2><a href="./draw-the-future/">Draw the future</a></h2>
    <p>Pick a <a href="https://gmd.copernicus.org/articles/19/2627/2026/">CMIP7 ScenarioMIP scenario</a>, draw your own future CO₂ emissions from 2024 onward, and see the atmospheric CO₂ they would produce. Inspired by the Sterman (2008) stock–flow experiment.</p>
    <p><a href="./draw-the-future/">Open</a> · <a href="./draw-the-future/embed">embed page</a></p>
  </div>
  <div class="card">
    <a href="./temperature-trend/"><img class="thumb" src="./assets/thumbnails/temperature-trend.png" alt="The GISTEMP global temperature record with a fitted trend line and a two-handle year-range slider"></a>
    <h2><a href="./temperature-trend/">Temperature trends</a></h2>
    <p>The GISTEMP global mean temperature record with a draggable year range. Fit a trend to any period, or use the presets to see how a well-chosen 16-year window can make the warming record look flat — or make it cool.</p>
    <p><a href="./temperature-trend/">Open</a> · <a href="./temperature-trend/embed">embed page</a></p>
  </div>
  <div class="card">
    <a href="./sst-daily/"><img class="thumb" src="./assets/thumbnails/sst-daily.png" alt="Daily sea surface temperature since 1981 drawn as a spiral, with the current year standing out well beyond the pack"></a>
    <h2><a href="./sst-daily/">Daily sea surface temperature</a></h2>
    <p>Daily global-mean sea surface temperature since 1981, drawn as a spiral — every year joins into one continuous line, and the years working their way outwards are the warming. Hover or click to compare years.</p>
    <p><a href="./sst-daily/">Open</a> · <a href="./sst-daily/embed">embed page</a></p>
  </div>
</div>

<style>
  /* The thumbnails are captured square (see scripts/take-thumbnails.sh); cover-cropping
     is only a safety net so a re-captured image of another shape still fills the card. */
  .card .thumb {
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
  .card h2 a[href] {
    color: inherit;
  }
</style>
