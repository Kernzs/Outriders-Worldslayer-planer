// Extracts active class skills for ALL FOUR classes from Breadbuilder's main.js.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync(".cache/breadbuilder.js", "utf8");

function extractObject(openIdx) {
  let depth = 0, i = openIdx;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { i++; break; } }
    else if (c === '"') { i++; while (i < src.length && src[i] !== '"') { if (src[i] === "\\") i++; i++; } }
  }
  return src.slice(openIdx, i);
}

function classSkills(cls) {
  // The active-skill description object is the LAST `<class>: {` in the file.
  const marker = `${cls}: {`;
  const start = src.lastIndexOf(marker);
  const open = src.indexOf("{", start);
  const obj = Function(`return (${extractObject(open)});`)();
  return Object.entries(obj)
    .filter(([, v]) => typeof v === "string")
    .map(([name, desc]) => ({ name, desc: desc.replace(/<br><br>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }));
}

mkdirSync("data/classes", { recursive: true });
for (const cls of ["technomancer", "pyromancer", "trickster", "devastator"]) {
  const skills = classSkills(cls);
  const out = {
    _meta: { class: cls, description: "Active class skills. [X]/[Y]/[Z] and ~% are level-scaled placeholders from the source.", source: "Breadbuilder main.js" },
    skills,
  };
  writeFileSync(`data/classes/${cls}.skills.json`, JSON.stringify(out, null, 2));
  console.error(`${cls}: ${skills.length} skills — ${skills.map(s => s.name).join(", ")}`);
}
