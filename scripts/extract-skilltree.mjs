// Extracts the class skill trees for ALL FOUR classes from Breadbuilder's main.js.
// Node format: [ branchFlag, [prereqIds], [childIds], "Name", { "bonus": value|null } ]
// Usage: node scripts/extract-skilltree.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync(".cache/breadbuilder.js", "utf8");

// The three class-tree (subclass) page titles per class on the Fandom wiki.
// Branch->name is resolved by matching node-name overlap, NOT by order.
const TREE_PAGES = {
  technomancer: ["Pestilence", "Tech Shaman", "Demolisher"],
  pyromancer: ["Ash Breaker", "Fire Storm", "Tempest"],
  trickster: ["Assassin", "Harbinger", "Reaver"],
  devastator: ["Vanquisher", "Warden", "Seismic Shifter"],
};

const API = "https://outriders.fandom.com/api.php";
const UA = "Mozilla/5.0 BuildPlannerBot";
async function pageNodeNames(title) {
  const url = `${API}?action=query&prop=revisions&rvslots=main&rvprop=content&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const j = await (await fetch(url, { headers: { "User-Agent": UA } })).json();
  const c = j.query.pages[0].revisions?.[0]?.slots.main.content || "";
  // node names appear as '''[[Name]]''' in the traits table
  return new Set([...c.matchAll(/'''\[\[([^\]|]+)/g)].map(m => m[1].trim()));
}
// Resolve each branch (by root id) to a tree name via best node-name overlap.
async function resolveBranchNames(cls, nodes, roots) {
  const trees = TREE_PAGES[cls];
  const treeSets = {};
  for (const t of trees) { try { treeSets[t] = await pageNodeNames(t); } catch { treeSets[t] = new Set(); } }
  // group node names per branch index (by root ranges)
  const branchNames = roots.map(() => null);
  const used = new Set();
  const scores = roots.map((root, bi) => {
    const names = nodes.filter(n => {
      let idx = 0; for (let k = 0; k < roots.length; k++) if (n.id >= roots[k]) idx = k;
      return n.id !== 0 && idx === bi;
    }).map(n => n.name);
    return trees.map(t => names.filter(nm => treeSets[t].has(nm)).length);
  });
  // greedy assign highest-overlap pairs first
  const pairs = [];
  scores.forEach((row, bi) => row.forEach((s, ti) => pairs.push([s, bi, ti])));
  pairs.sort((a, b) => b[0] - a[0]);
  for (const [, bi, ti] of pairs) {
    if (branchNames[bi] || used.has(trees[ti])) continue;
    branchNames[bi] = trees[ti]; used.add(trees[ti]);
  }
  // fallback for any unmatched
  branchNames.forEach((v, i) => { if (!v) branchNames[i] = trees.find(t => !used.has(t)) || `Branch ${i + 1}`, used.add(branchNames[i]); });
  return branchNames;
}

// Extract the *data* array for a class (the one with "name", { bonus } rows),
// not the coordinate array that shares the same `class: [` marker.
function extractArray(cls) {
  const marker = `${cls}: [`;
  let from = 0, idx;
  while ((idx = src.indexOf(marker, from)) !== -1) {
    const open = src.indexOf("[", idx);
    let depth = 0, i = open;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "[") depth++;
      else if (ch === "]") { depth--; if (depth === 0) { i++; break; } }
      else if (ch === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === "\\") i++; i++; } }
    }
    const body = src.slice(open, i);
    if (/",\s*\{/.test(body)) return body; // a name string followed by a bonus object => data array
    from = idx + marker.length;
  }
  throw new Error(`skill-tree data array not found for ${cls}`);
}

// The coordinate array for a class: rows of pure numbers [x, y, kind], no strings.
function extractCoords(cls) {
  const marker = `${cls}: [`;
  let from = 0, idx;
  while ((idx = src.indexOf(marker, from)) !== -1) {
    const open = src.indexOf("[", idx);
    let depth = 0, i = open;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === "[") depth++;
      else if (ch === "]") { depth--; if (depth === 0) { i++; break; } }
      else if (ch === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === "\\") i++; i++; } }
    }
    const body = src.slice(open, i);
    // numeric-only rows like [107, 374, 2]; reject the data array (has strings) and empty stubs
    if (!/"/.test(body) && /\[\s*\d+\s*,\s*\d+/.test(body)) return Function(`return (${body});`)();
    from = idx + marker.length;
  }
  return null;
}

function buildClass(cls) {
  const raw = Function(`"use strict"; return (${extractArray(cls)});`)();
  const nodes = raw.map((row, id) => {
    if (!Array.isArray(row)) return null;
    const [, prereqs, , name, bonuses] = row;
    return {
      id,
      name: name || "(class node)",
      prereqs: prereqs || [],
      bonuses: bonuses && typeof bonuses === "object"
        ? Object.entries(bonuses).map(([k, v]) => ({ stat: k, value: v }))
        : [],
    };
  }).filter(Boolean);
  const roots = [...((raw[0] && raw[0][2]) || [])].sort((a, b) => a - b);
  // merge node positions [x, y, kind] aligned by index
  const coords = extractCoords(cls) || [];
  for (const n of nodes) {
    const c = coords[n.id];
    if (Array.isArray(c)) { n.x = c[0]; n.y = c[1]; n.kind = c[2]; }
  }
  return { roots, nodes };
}

mkdirSync("data/classes", { recursive: true });
for (const cls of ["technomancer", "pyromancer", "trickster", "devastator"]) {
  const { roots, nodes } = buildClass(cls);
  const names = await resolveBranchNames(cls, nodes, roots);
  for (const n of nodes) {
    if (n.id === 0) { n.branch = "core"; continue; }
    let bi = 0; for (let k = 0; k < roots.length; k++) if (n.id >= roots[k]) bi = k;
    n.branch = names[bi];
  }
  const out = {
    _meta: { class: cls, description: "Main class skill tree (3 branches). Node 0 is the central class passive. Branch names resolved by node-overlap match against the Fandom subclass pages.", source: "Breadbuilder main.js + Fandom wiki", branchRoots: roots, branches: names },
    nodes,
  };
  writeFileSync(`data/classes/${cls}.skilltree.json`, JSON.stringify(out, null, 2));
  const byBranch = nodes.reduce((a, n) => ((a[n.branch] = (a[n.branch] || 0) + 1), a), {});
  console.error(`\n=== ${cls} === ${nodes.length} nodes  roots=${JSON.stringify(roots)}  branches=${JSON.stringify(names)}`);
  console.error("  byBranch:", byBranch);
  for (const bn of names) {
    const sample = nodes.filter(n => n.branch === bn).slice(0, 4).map(n => n.name);
    console.error(`  ${bn}: ${sample.join(" | ")}`);
  }
}
