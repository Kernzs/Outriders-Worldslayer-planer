# Outriders Worldslayer — Build Planner

A fan-made, single-page build planner for **all four classes** (Technomancer, Pyromancer,
Trickster, Devastator) covering the Worldslayer endgame. No backend, no dependencies.
All data is bundled into a single JS file so it runs from a plain file or any static host.

**Live:** https://kernzs.github.io/Outriders-Worldslayer-planer/

## Use it

- **Easiest:** double-click `index.html` — it works straight from `file://`
  (data is embedded in `data.js`, nothing is fetched).
- **Local server:**
  ```bash
  node scripts/serve.mjs        # http://localhost:5180
  ```

### Features
- **Class switch** — pick any of the 4 classes; trees, PAX, skills and class armor swap live.
- **Class Tree** — ~79 nodes across 3 branches per class (e.g. Pestilence / Tech Shaman /
  Demolisher), with prerequisite enforcement and a 20-point budget.
- **PAX Trees** — both sub-class branches per class (shared trunk + top/middle/bottom paths).
- **Ascension** — 4 categories × 5 nodes, 0–10 points each, 200 total.
- **Gear & Skills** — equip legendary weapon + 5 armor slots, one free mod slot each,
  pick up to 3 active skills. Set-bonus piece counting.
- **Build Summary** — live aggregated stats (tree + ascension), active effects, set bonuses.
- **Share** — the full build is encoded in the URL hash; "Copy build link" puts it on the clipboard.

## Data pipeline

Universal data lives in `data/*.json`; per-class data in `data/classes/<class>.<kind>.json`.
Produced by the scripts in `scripts/`:

| Script | Output | Source |
|---|---|---|
| `extract-mods.mjs` | `mods.json` (272, universal) | Fandom MediaWiki API |
| `extract-gear.mjs` | `legendary-weapons.json` (63), `classes/<cls>.armor.json` | Fandom API |
| `extract-skilltree.mjs` | `classes/<cls>.skilltree.json` (4 classes) | Breadbuilder `main.js` + Fandom (branch names) |
| `extract-skills.mjs` | `classes/<cls>.skills.json` (4 classes) | Breadbuilder `main.js` |
| `extract-pax.mjs` | `classes/<cls>.pax.json` (Pyro/Trick/Dev) | GamerGuides PAX skill lists |
| `ascension.json`, `pax-technomancer.json` | hand-authored | GamerGuides, sirusgaming, Fandom |

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
- A few base-game weapons have blank `dmg` on the wiki (level-scaled stat, not needed for planning).
- One armor (`Torrential Downpour's Armor`) has no slot on the wiki, so it's not selectable.
- Class trees use the real visual layout (Breadbuilder background + node coordinates). PAX
  trees are still text lists (no official coordinate source).
- Class skill-mods (per-class skill modifiers) are not yet surfaced in the UI; the universal
  weapon/armor mod pool (210) powers the gear mod slots.
- Tree/skill icons and backgrounds in `assets/` are sourced from Breadbuilder.

Not affiliated with Square Enix / People Can Fly. Data © their respective sources.
