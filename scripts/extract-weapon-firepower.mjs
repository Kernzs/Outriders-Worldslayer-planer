// Extracts the weapon firepower model from the archived outriders.app bundle.
// The site computes a weapon's "optimal" firepower from: a per-weapon-type seed,
// a shared per-level progression curve, and rarity factors (unusual/epic;
// legendary == epic in Outriders). We reproduce that here.
//
// Output: data/weapon-firepower.json
//   { "<type-slug>": { unusual: <factor>, epic: <factor>, multipliers: [{level,multiplier}...] } }
//
// Usage: node scripts/extract-weapon-firepower.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const BUNDLE =
  "https://web.archive.org/web/20230126190300js_/https://outriders.app/js/app.js";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36";

async function main() {
  const res = await fetch(BUNDLE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching bundle`);
  const s = await res.text();

  // 1) Read the type -> variable map: var e={"assault-rifle":u,...,armor:x}
  const mi = s.indexOf('var e={"assault-rifle":');
  if (mi < 0) throw new Error("type map not found in bundle");
  const mapStr = s.slice(mi + 6, s.indexOf("}", mi) + 1);
  const pairs = [...mapStr.matchAll(/"?([a-z-]+)"?:([a-zA-Z])\b/g)].map((m) => [m[1], m[2]]);

  // 2) Resolve each variable: <var>=JSON.parse('{"unusual":...}]}')
  const table = {};
  for (const [slug, v] of pairs) {
    if (slug === "armor") continue; // weapon types only
    const re = new RegExp(`\\b${v}=JSON\\.parse\\('(\\{"unusual":[\\s\\S]*?\\}\\]\\})'\\)`);
    const m = s.match(re);
    if (!m) { console.error(`  ! no firepower data for ${slug} (${v})`); continue; }
    const o = JSON.parse(m[1]);
    table[slug] = { unusual: o.unusual, epic: o.epic, multipliers: o.multipliers };
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/weapon-firepower.json", JSON.stringify(table, null, 2));
  console.error(`Weapon types: ${Object.keys(table).length} -> ${Object.keys(table).join(", ")}`);

  // 3) Validate against the known screenshot values (AR lvl 10 -> 333/358/376).
  const optimal = (t, lvl) => {
    let base = 9e4 / t.epic / t.unusual;
    [...t.multipliers].reverse().forEach((e) => (base /= e.multiplier));
    let r = Math.ceil(base), out = null;
    for (const e of t.multipliers) {
      r = Math.round(r * e.multiplier);
      if (e.level == lvl) {
        out = { unusual: Math.ceil(r), rare: Math.ceil(r * t.unusual), epic: Math.ceil(r * t.unusual * t.epic) };
        break;
      }
    }
    return out;
  };
  const ar = table["assault-rifle"];
  console.error("Validate AR @lvl10 (expect ~333/358/376):", JSON.stringify(optimal(ar, 10)));
  console.error("Validate AR @lvl50 (expect epic~90000):", JSON.stringify(optimal(ar, 50)));
}

main().catch((e) => { console.error(e); process.exit(1); });
