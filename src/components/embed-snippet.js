// Renders the "Embed this widget" section at the bottom of each widget page: an iframe
// snippet and a script-tag snippet, each with a copy button.
//
// Both snippets have to point at absolute, publicly reachable URLs, because they are
// pasted into somebody else's page. So they are built from the two constants below rather
// than from `location` — on a localhost preview `location` would produce a URL that is
// useless the moment it is pasted anywhere.

export const SITE = "https://briochemc.github.io/ClimateWidgets/";

// Framework fingerprints everything it builds (`_import/widget.<hash>.js`), so built URLs
// change on every deploy and cannot be pasted into a snippet. jsDelivr serves the source
// files straight from the GitHub repo instead: stable paths, CORS enabled, no build step.
export const CDN = "https://cdn.jsdelivr.net/gh/briochemc/ClimateWidgets@main/src/";

export const siteUrl = path => new URL(path, SITE).href;
export const cdnUrl = path => CDN + path;

export function embedSnippets({embedPath, height, title, script, note}) {
  const root = document.createElement("div");

  const iframe =
    `<iframe src="${siteUrl(embedPath)}"\n` +
    `        title="${title}"\n` +
    `        width="100%" height="${height}" loading="lazy"\n` +
    `        style="border:none"></iframe>`;

  root.appendChild(snippetBlock({
    heading: "As an iframe",
    blurb: "Works in any page that allows iframes, including Moodle. Nothing to install; " +
      "the widget always tracks whatever is deployed here.",
    code: iframe,
    note,
  }));

  root.appendChild(snippetBlock({
    heading: "As a script tag",
    blurb: "Renders the widget directly in your page, with no iframe, so it inherits your " +
      "page width. Needs a browser that supports ES modules, which all current ones do.",
    code: script,
  }));

  return root;
}

function snippetBlock({heading, blurb, code, note}) {
  const box = document.createElement("div");
  box.style.cssText = "margin:1rem 0 1.5rem;";

  const h = document.createElement("h3");
  h.textContent = heading;
  h.style.cssText = "margin:0 0 .25rem;";
  box.appendChild(h);

  const p = document.createElement("p");
  p.textContent = blurb;
  p.style.cssText = "margin:0 0 .5rem;color:#555;";
  box.appendChild(p);

  const shell = document.createElement("div");
  shell.style.cssText = "position:relative;";

  const pre = document.createElement("pre");
  pre.style.cssText =
    "margin:0;padding:12px 96px 12px 12px;overflow-x:auto;border:1px solid #e0e4e8;" +
    "border-radius:8px;background:#f8f9fb;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;";
  const codeEl = document.createElement("code");
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  shell.appendChild(pre);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Copy";
  button.style.cssText =
    "position:absolute;top:8px;right:8px;font:14px sans-serif;padding:4px 12px;" +
    "border:1px solid #ccc;border-radius:6px;background:#fff;color:#333;cursor:pointer;";
  let resetTimer;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Copied";
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions policy in an iframe).
      // Selecting the snippet still leaves the reader one keystroke from copying it.
      getSelection().selectAllChildren(codeEl);
      button.textContent = "Press ⌘/Ctrl+C";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => (button.textContent = "Copy"), 2000);
  });
  shell.appendChild(button);

  box.appendChild(shell);

  if (note) {
    const n = document.createElement("p");
    n.innerHTML = note;
    n.style.cssText = "margin:.5rem 0 0;color:#777;font-size:14px;";
    box.appendChild(n);
  }

  return box;
}
