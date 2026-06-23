// Extracts PAX tree branches for all classes from GamerGuides skill-list pages.
// Each page has sections "<Branch> <Path> Path Skills" with name/desc pairs.
// Usage: node scripts/extract-pax.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const BASE = "https://www.gamerguides.com/outriders-worldslayer/guide/classes";

// Technomancer PAX is hand-curated (data/pax-technomancer.json) — more complete than
// the scrape (which drops some paths), so it's excluded here and merged at bundle time.
const CLASSES = {
  pyromancer: [
    { name: "Gunblazer", slug: "pyromancer-gunblazers-pax-skill-list", theme: "Weapon damage & firepower" },
    { name: "Pyromaniac", slug: "pyromancer-pyromaniacs-pax-skill-list", theme: "Anomaly & status damage" },
  ],
  trickster: [
    { name: "Spectre", slug: "trickster-spectres-pax-skill-list", theme: "Weapon damage & mobility" },
    { name: "Exploiter", slug: "trickster-exploiters-pax-skill-list", theme: "Anomaly & status" },
  ],
  devastator: [
    { name: "Wrecker", slug: "devastator-wreckers-pax-skill-list", theme: "Weapon & bleed damage" },
    { name: "Tectonic Shifter", slug: "devastator-tectonic-shifter-skill-list", theme: "Anomaly & survivability" },
  ],
};

const NOISE = /^(Subscribe Now|Icon|Skill|Description|Note:|By universal path|No Comments|Back to top|Scroll down|Guide Information|Publisher|Platforms|Genre|Note$)/i;

function htmlToLines(html) {
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const t = html
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&para;/g, "");
  return t.split("\n").map(s => s.trim()).filter(Boolean);
}

async function fetchPage(slug, cls) {
  const url = `${BASE}/${cls}/${slug}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return htmlToLines(await res.text());
}

function parseBranch(lines, branchName) {
  const start = lines.findIndex(s => /list of all the skills available/i.test(s));
  const seg = start === -1 ? lines : lines.slice(start + 1);
  const nodes = [];
  let path = null;
  for (let i = 0; i < seg.length; i++) {
    const line = seg[i];
    // Headers vary: "<X> Top Path Skills" but universal is often "<X> Universal Path"
    // (no "Skills", sometimes the typo "Univeral", sometimes mislabeled with the wrong branch).
    // Anchor at end of line so prose mentioning "path" is not treated as a header.
    const head = line.match(/(Univ\w*|Top|Middle|Bottom)\s+Path(\s+Skills)?\s*$/i);
    if (head) { path = /^univ/i.test(head[1]) ? "universal" : head[1].toLowerCase(); continue; }
    if (/No Comments|Guide Information/i.test(line)) break;
    if (!path || NOISE.test(line)) continue;
    // a name line is short and not a full sentence; description is the next content line
    if (line.length <= 46 && !/[.]$/.test(line)) {
      const desc = seg[i + 1] && !NOISE.test(seg[i + 1]) && !/Path\s+Skills/i.test(seg[i + 1]) ? seg[i + 1] : "";
      if (desc) { nodes.push({ path, name: line, desc }); i++; }
    }
  }
  return nodes;
}

async function main() {
  mkdirSync("data/classes", { recursive: true });
  for (const [cls, branches] of Object.entries(CLASSES)) {
    const out = { _meta: { class: cls, description: `PAX trees for the ${cls}. Two branches; each path shares a universal trunk.`, source: "GamerGuides PAX skill lists" }, branches: [] };
    for (const b of branches) {
      let nodes = [];
      try { nodes = parseBranch(await fetchPage(b.slug, cls), b.name); }
      catch (e) { console.error(`  ! ${b.name}: ${e.message}`); }
      out.branches.push({ name: b.name, theme: b.theme, nodes });
      const byPath = nodes.reduce((a, n) => ((a[n.path] = (a[n.path] || 0) + 1), a), {});
      console.error(`${cls}/${b.name}: ${nodes.length} nodes`, byPath);
    }
    writeFileSync(`data/classes/${cls}.pax.json`, JSON.stringify(out, null, 2));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
