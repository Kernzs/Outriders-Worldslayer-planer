// Extracts Outriders mods from the Fandom MediaWiki API into clean JSON.
// Usage: node scripts/extract-mods.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const API = "https://outriders.fandom.com/api.php";
const UA = "Mozilla/5.0 BuildPlannerBot (personal build-planner project)";

const CATEGORIES = [
  { cat: "Technomancer_Mods", scope: "technomancer" },
  { cat: "Pyromancer_Mods", scope: "pyromancer" },
  { cat: "Trickster_Mods", scope: "trickster" },
  { cat: "Devastator_Mods", scope: "devastator" },
  { cat: "Weapon_Mods", scope: "weapon" },
  { cat: "Armor_Mods", scope: "armor" },
];

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
      action: "query",
      list: "categorymembers",
      cmtitle: `Category:${cat}`,
      cmlimit: "500",
      ...(cont ? { cmcontinue: cont } : {}),
    });
    for (const m of data.query.categorymembers) if (m.ns === 0) titles.push(m.title);
    cont = data.continue?.cmcontinue;
  } while (cont);
  return titles;
}

async function fetchContents(titles) {
  // API allows up to 50 titles per request
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const data = await api({
      action: "query",
      prop: "revisions",
      rvslots: "main",
      rvprop: "content",
      titles: batch.join("|"),
    });
    for (const p of data.query.pages) {
      out[p.title] = p.revisions?.[0]?.slots?.main?.content ?? "";
    }
  }
  return out;
}

function getTemplateField(wikitext, field) {
  const re = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|}]*)`, "i");
  const m = wikitext.match(re);
  return m ? m[1].trim() : null;
}

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
function parseTier(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const digit = s.match(/\d+/); // handles "1", and dirty values like "1I"
  if (digit) return Number(digit[0]);
  const roman = s.toUpperCase().match(/^(I{1,3}|IV|V)$/);
  if (roman) return ROMAN[roman[1]];
  return null;
}

function cleanText(s) {
  if (!s) return s;
  return s
    .replace(/<onlyinclude>|<\/onlyinclude>/gi, "")
    .replace(/\{\{\s*texttip\s*\|\s*([^|}]*)[^}]*\}\}/gi, "$1") // {{texttip|val|note}} -> val
    .replace(/\{\{\s*CD\s*\|\s*([^}]*)\}\}/gi, "(Cooldown: $1s)") // {{CD|3}} -> (Cooldown: 3s)
    .replace(/\{\{[^}]*\}\}/g, "") // strip any other templates
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1") // [[link|label]] -> label
    .replace(/\[\[([^\]]*)\]\]/g, "$1") // [[link]] -> link
    .replace(/'''?/g, "") // bold/italic
    .replace(/''/g, "") // leftover italic
    .replace(/\s+/g, " ")
    .trim();
}

function extractSummary(wikitext) {
  // Prefer the <onlyinclude> block; else the ==Summary== section.
  const only = wikitext.match(/<onlyinclude>([\s\S]*?)<\/onlyinclude>/i);
  if (only) return cleanText(only[1]);
  const sec = wikitext.match(/==\s*Summary\s*==\s*([\s\S]*?)(?:\n==|\{\{SiteNav|$)/i);
  return sec ? cleanText(sec[1]) : null;
}

function extractSource(wikitext) {
  const sec = wikitext.match(/==\s*Sources?\s*==\s*([\s\S]*?)(?:\n==|\{\{SiteNav|$)/i);
  return sec ? cleanText(sec[1]) : null;
}

const apos = (s) => s.replace(/[‘’]/g, "'"); // normalise curly apostrophes

async function main() {
  const mods = [];
  const seen = new Set();
  const seenNames = new Set(); // dedupe wiki duplicates (e.g. Earth's Legacy with two apostrophes)
  for (const { cat, scope } of CATEGORIES) {
    const titles = await categoryMembers(cat);
    console.error(`${cat}: ${titles.length} pages`);
    const contents = await fetchContents(titles);
    for (const title of titles) {
      if (seen.has(title)) continue; // a mod can appear in multiple categories
      seen.add(title);
      const wt = contents[title] || "";
      if (!/\{\{Infobox mod/i.test(wt)) continue; // skip non-mod pages
      const name = apos(title);
      const key = scope + "::" + name;
      if (seenNames.has(key)) continue; // duplicate (apostrophe variant)
      seenNames.add(key);
      mods.push({
        name,
        tier: parseTier(getTemplateField(wt, "tier")),
        type: getTemplateField(wt, "type"),
        scope, // which category we first found it in
        description: extractSummary(wt),
        source: extractSource(wt),
      });
    }
  }
  mods.sort((a, b) => (a.tier - b.tier) || a.name.localeCompare(b.name));
  mkdirSync("data", { recursive: true });
  writeFileSync("data/mods.json", JSON.stringify(mods, null, 2));
  console.error(`\nTotal mods extracted: ${mods.length}`);
  const byScope = mods.reduce((a, m) => ((a[m.scope] = (a[m.scope] || 0) + 1), a), {});
  console.error("By scope:", byScope);
  console.error("\nSample:");
  for (const m of mods.slice(0, 4)) console.error(` [T${m.tier}] ${m.name} (${m.type}): ${m.description}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
