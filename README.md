# Outriders Worldslayer — Build Planner

A fan-made, single-page build planner for **all four classes** (Technomancer, Pyromancer,
Trickster, Devastator) covering the Worldslayer endgame. No backend, no dependencies.
All data is bundled into a single JS file so it runs from a plain file or any static host.

**Live:** https://kernzs.github.io/Outriders-Worldslayer-planer/

> Built for a friend who actually plays the game — feedback very welcome.

## Use it

- **Easiest:** double-click `index.html` — it works straight from `file://`
  (data is embedded in `data.js`, nothing is fetched).
- **Local server:**
  ```bash
  node scripts/serve.mjs        # http://localhost:5180
  ```

### Features
- **Class switch** — pick any of the 4 classes; trees, PAX, skills and class gear swap live.
  Ascension and weapons are universal and kept across classes.
- **Class Tree** — the real visual layout (background image + nodes positioned on the drawn
  circles, two node sizes), clickable with prerequisite enforcement, cascade removal
  (deselecting a node drops everything that relied on it to reach the core) and a 20-point budget.
  A "Show stats" toggle lists every numeric bonus from the build.
- **PAX Trees** — fully clickable on the in-game tree image for every class (both branches),
  with node icons, drawn links between nodes (lit when both ends are taken),
  prerequisite gating + cascade removal, and a 5-point budget.
- **Ascension** — 4 categories × 5 nodes, 0–10 points each (Shift+click to fill/clear a node),
  200 total. Values reach each node's stated max at 10/10 (intermediate values are a linear
  estimate — the game's per-level curve isn't documented).
- **Gear** — 2 primary weapons + 1 secondary (sidearms are Pistols/Revolvers), 5 armor slots.
  Each slot takes a **legendary** (keep its 2 factory mods, swap one, plus a free Apocalypse
  3rd-mod slot) **or a custom Epic** (choose weapon type + variant, attributes, and mods).
  Armor mod pools include the class skill mods. Set-bonus piece counting.
- **Searchable pickers** — weapons, armor, mods, types and attributes are all searchable
  (type to filter long lists). Equipping the same mod twice flags a "duplicate" warning
  (mods don't stack).
- **Active skills** — pick up to 3.
- **Build Summary** — live aggregated stats (tree + ascension) and every active effect
  (hover an effect to read exactly what it does).
- **Share** — the whole build is encoded in the URL hash and "Copy build link"
  copies a short link. Gear and mods are encoded **by name**, so adding or
  reordering items in the data never breaks links shared earlier.
- **What's new** popup — collapsible changelog, latest version expanded; shown once per
  version (driven by the in-app `CHANGELOG` in `app.js`).
- **Links** — GitHub repo and every data source are linked from the header/footer.

## Data pipeline

Universal data lives in `data/*.json`; per-class data in `data/classes/<class>.<kind>.json`.
Produced by the scripts in `scripts/`:

| Script | Output | Source |
|---|---|---|
| `extract-mods.mjs` | `mods.json` (479: weapon, armor + each class's skill mods) | Fandom MediaWiki API (every `Infobox mod` page) |
| `extract-gear.mjs` | `legendary-weapons.json` (63), `classes/<cls>.armor.json` | Fandom API (every `Infobox armor`/`weapon` page, filtered to Legendary) |
| `extract-skilltree.mjs` | `classes/<cls>.skilltree.json` (nodes + x/y coords) | Breadbuilder `main.js` + Fandom (branch names) |
| `extract-skills.mjs` | `classes/<cls>.skills.json` | Breadbuilder `main.js` |
| `extract-pax.mjs` | `classes/<cls>.pax.json` (Pyro/Trick/Dev) | GamerGuides PAX skill lists |
| `extract-pax-icons.mjs` | `assets/pax/*`, `data/pax-icons.json` | GamerGuides |
| _hand-authored_ | `ascension.json`, `pax-technomancer.json`, `pax-coords.json` | GamerGuides, sirusgaming, Fandom, TheGamer |

`tools/pax-mapper.html` is a small utility used to capture PAX node positions
(`data/pax-coords.json`) by clicking each node on the tree image (reticle + magnifier).

Image assets in `assets/`: `skilltrees/` (class-tree backgrounds) and `skills/` (skill icons)
from Breadbuilder; `pax/` (PAX node icons) from GamerGuides; `paxtrees/` (PAX tree layouts)
from TheGamer.

After editing any data, rebundle:
```bash
node scripts/bundle-data.mjs   # regenerates data.js
```

## Deploy (GitHub Pages → github.io)

`index.html` lives at the repo root, so GitHub Pages can serve it directly:
**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/ (root)`**.
Live at `https://<user>.github.io/<repo>/`.

The app is fully static — no build step beyond `bundle-data.mjs`. If you change any data,
rerun it and commit the updated `data.js`.

## Notes / limitations
- Ascension values are exact at every point level (the real non-linear per-point curve,
  read from the Outriders Outpost builder).
- A few base-game weapons have blank `dmg` on the wiki (level-scaled stat, not needed for planning).
- One armor (`Torrential Downpour's Armor`) has no slot on the wiki, so it's not selectable.
- Two Technomancer PAX nodes (Necrotic Tissue, Twin Reaper) have no icon on the source and
  fall back to a placeholder.
- Image/icon assets are sourced from the community sites listed above.

Not affiliated with Square Enix / People Can Fly. Data © their respective sources.
