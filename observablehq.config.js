export default {
  title: "Climate Widgets",
  root: "src",
  base: process.env.OBS_BASE ?? "/",
  // Drives the sidebar and the prev/next pager. Embed pages are deliberately left
  // out: they exist only to be iframed, and they disable the chrome themselves.
  pages: [
    {name: "Draw the future", path: "/draw-the-future/"},
    {name: "Temperature trends", path: "/temperature-trend/"},
    {name: "Daily sea surface temperature", path: "/sst-daily/"},
    {name: "Belief in climate change", path: "/belief-map/"},
    {name: "Support for climate policy", path: "/policy-support-map/"},
    {name: "Support for climate action", path: "/climate-action-support/"},
  ],
  head: "",
  theme: "air",
  toc: false,
  pager: true,
  sidebar: true,
  search: true,
};
