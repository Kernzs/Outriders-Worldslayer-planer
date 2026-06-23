// Downloads PAX node icons from GamerGuides and builds a name->icon map.
// Usage: node scripts/extract-pax-icons.mjs
import { writeFileSync, mkdirSync, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const SITE = "https://www.gamerguides.com";
const BASE = SITE + "/outriders-worldslayer/guide/classes";
const PAGES = [
  "technomancer/technomancer-desolators-pax-skill-list",
  "technomancer/technomancer-overseers-pax-skill-list",
  "pyromancer/pyromancer-gunblazers-pax-skill-list",
  "pyromancer/pyromancer-pyromaniacs-pax-skill-list",
  "trickster/trickster-spectres-pax-skill-list",
  "trickster/trickster-exploiters-pax-skill-list",
  "devastator/devastator-wreckers-pax-skill-list",
  "devastator/devastator-tectonic-shifter-skill-list",
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function getHtml(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.text();
}
async function download(url, dest) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return false;
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
  return true;
}

async function main() {
  mkdirSync("assets/pax", { recursive: true });
  const map = {}; // normalized node name -> icon filename
  const seen = new Set();
  for (const page of PAGES) {
    let html;
    try { html = await getHtml(`${BASE}/${page}`); }
    catch (e) { console.error("! skip", page, e.message); continue; }
    const srcs = [...html.matchAll(/(?:src|data-src)="(\/assets\/media\/[^"]+\.png)"/g)].map((m) => m[1]);
    const uniq = [...new Set(srcs)];
    let n = 0;
    for (const src of uniq) {
      const file = src.split("/").pop();              // e.g. The_Undying.png or Coming_in_Hot_Outriders.png
      const base = file.replace(/\.png$/i, "").replace(/_/g, " ");
      // some pages suffix the filename with "Outriders" (or the typo "Outrides")
      const key = norm(base).replace(/outriders?$|outrides$/, "");
      if (!seen.has(file)) { seen.add(file); await download(SITE + src, `assets/pax/${file}`); }
      if (!map[key]) map[key] = file; n++;
    }
    console.error(`${page.split("/").pop()}: ${n} icons`);
  }
  // Manual fixes for source filename typos/variants that don't match node names.
  const OVERRIDES = {
    conduction: "Conduction1.png",
    quantumentanglement: "Quantum_Engtanglement_Outriders.png",
    reactiveshielding: "Reaactive_Shielding_Outriders.png",
    specialtactics: "Special_Tactics_Outriders1.png",
    upheaval: "Upheavel.png",
  };
  for (const [k, v] of Object.entries(OVERRIDES)) if (seen.has(v)) map[k] = v;

  writeFileSync("data/pax-icons.json", JSON.stringify(map, null, 2));
  console.error(`\nTotal icons: ${seen.size} -> assets/pax/ · map keys: ${Object.keys(map).length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
