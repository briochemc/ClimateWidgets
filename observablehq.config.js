export default {
  title: "Climate Widgets",
  root: "src",
  base: process.env.OBS_BASE ?? "/",
  // Drives the sidebar and the prev/next pager. Embed pages are deliberately left
  // out: they exist only to be iframed, and they disable the chrome themselves.
  pages: [
    {name: "Draw the future", path: "/draw-the-future/"},
    {name: "Temperature trends", path: "/temperature-trend/"},
  ],
  head: "",
  theme: "air",
  toc: false,
  pager: true,
  sidebar: true,
  search: true,
};
