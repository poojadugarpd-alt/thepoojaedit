# The Pooja Edit — Figma Mockup Builder (plugin)

There is no Figma write API and no Figma MCP available to this workspace, so the
mockups are delivered as a **Figma plugin you run once**. It builds native,
editable Figma content — token variables, text styles, component sets with
variants, and Auto Layout frames for every required screen and state — plus
prototype wiring. Nothing is a flattened screenshot.

## What you need

- A **free** Figma account (figma.com). No paid plan, no subscription.
- The Figma **desktop app** (dev-mode plugins can't be imported from the browser
  build) — figma.com/downloads.
- This folder: `design/figma-plugin/` (`manifest.json` + `code.js`).

## Run it (~2 minutes)

1. Open the Figma **desktop app** → **New design file**. Name it
   e.g. `The Pooja Edit — Storefront Mockups`.
2. Menu (top-left) → **Plugins → Development → Import plugin from manifest…**
3. Select `design/figma-plugin/manifest.json`.
4. Menu → **Plugins → Development → The Pooja Edit — Mockup Builder** → run.
5. Wait a few seconds. It creates **7 pages**:
   `1 · Research & References` · `2 · Foundations` · `3 · Components` ·
   `4 · Mobile Storefront` · `5 · Desktop Storefront` · `6 · Responsive Examples` ·
   `7 · Prototype & Handoff`.
   The console log (Plugins → Development → **Open console**) prints a build log.

## After it runs

- **Reference screenshots:** page 1 has labelled placeholders. Drag the PNGs from
  `design/research/screenshots/<site>/<viewport>-<page>.png` onto them, or use the
  free **html.to.design** plugin to import the reference pages into page 1 as a
  separate reference area (imported pages are reference material, not the design).
- **Share:** Share → copy link (Figma's default is view/comment; change to
  "Anyone with the link can edit" only if you want that — no permission change is
  required to hand it off for review).
- **Prototype:** press ▶ (top-right) on page 4 to walk the flow. Some links need
  the plugin to have matched a button by its text; if one is missing, the
  Prototype tab lets you drag the connection (steps are on page 7).

## What the plugin builds vs. leaves manual

| Built | Manual (documented on page 7 / in `design/handoff.md`) |
| --- | --- |
| 7 pages, ~30 frames (mobile + desktop + tablet + states) | Dragging reference PNGs onto page 1 placeholders |
| `tokens` variable collection (colour + spacing + radius) | Binding every text layer to its named text style (styles exist; layers carry literal values) |
| 11 named text styles | Pixel-nudging any Auto Layout that Figma packs differently than the spec |
| Component sets with variants: Button, Badge, Field, ProductCard, Header; components: AnnouncementBar, Footer | Re-pointing any prototype link the text-matcher missed |
| Auto Layout on every frame; instances composed from the components | Real photography (placeholders say "Product photo" etc.) |
| Prototype: core purchase flow, menu overlay, filter sheet, sold→alternatives, failed→retry | — |

## Re-running

Running the plugin again **adds another set of pages** — it does not update in
place. To rebuild cleanly, delete the 7 pages first (or run in a fresh file).

## If import fails

- "Manifest not found" → you picked the folder, not `manifest.json`.
- Plugin does nothing / errors → open **Plugins → Development → Open console** and
  send the red error line. The plugin wraps everything in try/catch and reports
  the failing call.
