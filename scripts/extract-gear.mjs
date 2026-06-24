// Extracts Outriders legendary weapons & armor from the Fandom MediaWiki API.
// Weapons are universal (no class lock); armor is filtered to Technomancer + universal.
// Usage: node scripts/extract-gear.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const API = "https://outriders.fandom.com/api.php";
const UA = "Mozilla/5.0 BuildPlannerBot (personal build-planner project)";
const CLASS = "Technomancer";

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function categoryMembers(cat) {
  const titles = [];
  let cont;
  do {
    const data = await api({
      action: "query", list: "categorymembers",
      cmtitle: `Category:${cat}`, cmlimit: "500",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const m of data.query.categorymembers) if (m.ns === 0) titles.push(m.title);
    cont = data.continue?.cmcontinue;
  } while (cont);
  return titles;
}

// Every page that transcludes a template, regardless of category. Used so we
// catch Legendary items that aren't filed under Category:Legendary_* on the
// wiki (e.g. Sergio's Beret, tagged class=Universal and miscategorised).
async function embeddedin(template) {
  const titles = [];
  let cont;
  do {
    const data = await api({
      action: "query", list: "embeddedin",
      eititle: template, einamespace: "0", eilimit: "500",
      ...(cont ? { eicontinue: cont } : {}),
    });
    for (const m of data.query.embeddedin) titles.push(m.title);
    cont = data.continue?.eicontinue;
  } while (cont);
  return titles;
}

async function fetchContents(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const data = await api({
      action: "query", prop: "revisions", rvslots: "main", rvprop: "content",
      titles: titles.slice(i, i + 50).join("|"),
    });
    for (const p of data.query.pages) out[p.title] = p.revisions?.[0]?.slots?.main?.content ?? "";
  }
  return out;
}

function field(wt, name) {
  // Capture a single-line infobox field value. Stops at the next field, the
  // infobox close `}}` (even on the SAME line, e.g. a last field `|mod2=X}}`),
  // or end of text. The same-line `}}` case is why some last fields (mod2) were
  // silently dropped before.
  const m = wt.match(new RegExp(`\\|[ \\t]*${name}[ \\t]*=[ \\t]*([^\\n}]*?)[ \\t]*(?=\\n|\\}\\}|$)`, "i"));
  return m ? clean(m[1]) : null;
}

function clean(s) {
  if (s == null) return null;
  const out = s
    .replace(/<!--.*?-->/gs, "")
    .replace(/\{\{\s*texttip\s*\|\s*([^|}]*)[^}]*\}\}/gi, "$1")
    .replace(/\{\{\s*CD\s*\|\s*([^}]*)\}\}/gi, "(Cooldown: $1s)")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/<[^>]+>/g, "") // strip stray HTML (e.g. <u> in set names)
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/''/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return out === "" ? null : out;
}

// The `set` field is the last infobox field and can span multiple lines and
// end with `}}` on the same line — capture until the next field or the close.
function setField(wt) {
  const m = wt.match(/\|[ \t]*set[ \t]*=([\s\S]*?)(?=\n[ \t]*\||\}\}|$)/i);
  return m ? clean(m[1]) : null;
}

// Wiki slot typos to correct (e.g. "Britches" tagged as Upper Armor).
const SLOT_OVERRIDES = { "Trespasser's Britches": "Lower Armor" };

// Canonicalise stat-label variants / wiki typos.
const STAT_CANON = {
  "skills life leech": "Skills Life Leech", "skill life leech": "Skills Life Leech",
  "cooldown reduction": "Cooldown Reduction", "colldown reduction": "Cooldown Reduction", "cooldown recudtion": "Cooldown Reduction",
  "anomaly power": "Anomaly Power", "bonus firepower": "Bonus Firepower",
};
// Some pages put stat1/stat2/stat3 on a single line ("|stat1=A|stat2=B|stat3=C"),
// so field() captures the trailing "|stat2=..." too — cut at the first pipe.
const cleanStat = (s) => { if (!s) return s; const v = s.split("|")[0].trim(); return STAT_CANON[v.toLowerCase()] || v; };

function num(s) { if (s == null) return null; const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; }

function parseWeapon(name, wt) {
  wt = wt.replace(/<!--[\s\S]*?-->/g, ""); // comments between fields break field lookahead
  return {
    name,
    rarity: field(wt, "rarity"),
    type: field(wt, "type"),
    variant: field(wt, "variant"),
    fireMode: field(wt, "mode"),
    clip: num(field(wt, "clip")),
    rpm: num(field(wt, "rpm")),
    dmg: num(field(wt, "dmg")),
    reload: field(wt, "reload"),
    critMulti: field(wt, "crit multi"),
    accuracy: field(wt, "accuracy"),
    stability: field(wt, "stability"),
    range: num(field(wt, "range")),
    specialStats: [field(wt, "stat1"), field(wt, "stat2"), field(wt, "stat3")].filter(Boolean).map(cleanStat),
    factoryMods: [field(wt, "mod1"), field(wt, "mod2")].filter(Boolean),
  };
}

function parseArmor(name, wt) {
  wt = wt.replace(/<!--[\s\S]*?-->/g, "");
  return {
    name,
    rarity: field(wt, "rarity"),
    slot: SLOT_OVERRIDES[name] || field(wt, "type"),
    class: field(wt, "class"), // null/"Universal" = not class-locked
    specialStats: [field(wt, "stat1"), field(wt, "stat2"), field(wt, "stat3")].filter(Boolean).map(cleanStat),
    factoryMods: [field(wt, "mod1"), field(wt, "mod2")].filter(Boolean),
    setBonus: setField(wt),
  };
}

const isLegendary = (x) => (x.rarity || "").toLowerCase() === "legendary";
const isUniversal = (cls) => !cls || ["universal", "all"].includes(cls.toLowerCase());
const stripRarity = ({ rarity, ...rest }) => rest;

async function main() {
  // Source every page that uses the infobox (not just Category:Legendary_*,
  // which misses miscategorised items) and keep only the Legendary ones.
  // --- Weapons (universal) ---
  const wTitles = await embeddedin("Template:Infobox weapon");
  const wContent = await fetchContents(wTitles);
  const weapons = wTitles
    .filter((t) => /\{\{Infobox weapon/i.test(wContent[t] || ""))
    .map((t) => parseWeapon(t, wContent[t]))
    .filter(isLegendary)
    .map(stripRarity)
    .sort((a, b) => a.name.localeCompare(b.name));

  // --- Armor (per class: class-specific + universal pieces) ---
  const aTitles = await embeddedin("Template:Infobox armor");
  const aContent = await fetchContents(aTitles);
  const allArmor = aTitles
    .filter((t) => /\{\{Infobox armor/i.test(aContent[t] || ""))
    .map((t) => parseArmor(t, aContent[t]))
    .filter(isLegendary)
    .map(stripRarity);

  mkdirSync("data", { recursive: true });
  mkdirSync("data/classes", { recursive: true });
  writeFileSync("data/legendary-weapons.json", JSON.stringify(weapons, null, 2));
  console.error(`Legendary weapons: ${weapons.length}`);
  console.error(`Legendary armor (all parsed): ${allArmor.length}`);

  for (const cls of ["technomancer", "pyromancer", "trickster", "devastator"]) {
    const armor = allArmor
      .filter((a) => isUniversal(a.class) || a.class.toLowerCase() === cls)
      .sort((a, b) => a.name.localeCompare(b.name));
    writeFileSync(`data/classes/${cls}.armor.json`, JSON.stringify(armor, null, 2));
    const slots = armor.reduce((a, x) => ((a[x.slot] = (a[x.slot] || 0) + 1), a), {});
    console.error(`  ${cls}: ${armor.length} armor`, slots);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
