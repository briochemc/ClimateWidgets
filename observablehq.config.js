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
    {name: "Vlasceanu et al. 2024 \u2014 beliefs and action", path: "/vlasceanu-etal-2024/"},
    {name: "Andre et al. 2024 \u2014 support for climate action", path: "/andre-etal-2024/"},
  ],
  head: "",
  theme: "air",
  toc: false,
  pager: true,
  sidebar: true,
  search: true,
};
