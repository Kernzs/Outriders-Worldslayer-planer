/* ============================================================
   Outriders Worldslayer — Build Planner (all 4 classes)
   Vanilla JS, no dependencies. Data from data.js (window.OUTRIDERS_DATA).
   ============================================================ */
(() => {
  "use strict";
  const D = window.OUTRIDERS_DATA;

  // ---- App version + changelog (drives the "What's new" popup) ----
  const APP_VERSION = "1.12.0";
  const CHANGELOG = [
    {
      version: "1.12.0", date: "2026-06-23", title: "Auto-shortened share links",
      items: ["'Copy build link' and 'Copy recap link' now copy a short link (via da.gd) instead of the long URL, so builds are easy to paste anywhere."],
    },
    {
      version: "1.11.0", date: "2026-06-23", title: "Build recap",
      patches: [
        { version: "1.11.1", date: "2026-06-23", items: ["Ascension values are now exact at every point level (the real non-linear curve, read from the Outriders Outpost builder) — no more linear estimate. Fixed maxes: Skill Leech 5.5%, Elite Damage Mitigation 10%."] },
      ],
      items: [
        "New 'Build recap' button: a one-screen visual summary of the whole build — no need to click through tabs.",
        "The class tree and PAX show as mini trees with lit/dim nodes; plus skills, ascension, gear & mods, stats.",
        "'Copy recap link' shares a link that opens straight into that recap.",
      ],
    },
    {
      version: "1.10.0", date: "2026-06-23", title: "Search, filtering & QoL",
      patches: [ // newest first; nested under the minor version
        { version: "1.10.1", date: "2026-06-23", items: ["Smarter duplicate-mod check: only across your 5 armor pieces (worn together) and within a single weapon — not between weapons, since only one is active at a time."] },
      ],
      items: [
        "All long dropdowns are now searchable — mods, weapons, armor, weapon types/attributes. Type to filter instead of scrolling.",
        "Primary slots show primary weapons; the secondary slot shows only sidearms (Pistols & Revolvers), per the game.",
        "Equipping the same mod twice now flags a warning (mods don't stack): the slots turn red and the Build Summary lists the duplicates.",
        "This What's-new list is collapsible — only the latest version is expanded.",
        "Added links to the GitHub repo and to every data source (header & footer).",
      ],
    },
    {
      version: "1.9.0", date: "2026-06-23", title: "Data fixes (sets, slots, mods)",
      items: [
        "Set bonuses count correctly now — recovered set pieces whose bonus was missing and merged sets that were split by inconsistent naming.",
        "Trespasser's Britches is Lower Armor (was mislabeled Upper Armor).",
        "Removed a duplicate mod (Earth's Legacy) and normalized stat labels (Skills Life Leech).",
      ],
    },
    {
      version: "1.8.0", date: "2026-06-23", title: "Much shorter share links",
      items: ["Build links are now ~20× shorter (a full build went from ~2240 to ~100 characters). Old links from before this update no longer load."],
    },
    {
      version: "1.7.0", date: "2026-06-23", title: "Legendary mod swapping",
      items: [
        "Legendaries: keep their 2 factory mods, swap only one of them (the other locks), plus a free Apocalypse 3rd-mod slot — like in-game.",
      ],
    },
    {
      version: "1.6.0", date: "2026-06-23", title: "Class mods + all weapon types",
      items: [
        "Armor mod slots now include every class skill mod (all 4 classes) alongside the universal armor mods.",
        "Any weapon type can be picked in any weapon slot (Submachine Guns etc. are no longer hidden).",
      ],
    },
    {
      version: "1.5.0", date: "2026-06-23", title: "Clickable PAX trees",
      items: [
        "PAX trees are now fully clickable on the in-game image for all 4 classes — select nodes right on the tree.",
        "Nodes follow their connections: a node unlocks only once a connected one is taken (removing one frees its dependents).",
        "Hover a node for its name and effect; the lists below stay in sync.",
        "Build Summary: hover an Active Effect to read its exact effect.",
      ],
    },
    {
      version: "1.4.0", date: "2026-06-23", title: "PAX layout reference",
      items: ["PAX tab shows the in-game tree layout image for your class (toggle with “Show/Hide”)."],
    },
    {
      version: "1.3.0", date: "2026-06-23", title: "Epic weapons, faster Ascension, stats view",
      items: [
        "Epic weapons: choose the weapon type and variant too.",
        "Ascension: Shift+click the + / − to add or remove all 10 points at once.",
        "Class Tree: “Show stats” button lists every bonus from your build.",
      ],
    },
    {
      version: "1.2.0", date: "2026-06-23", title: "PAX icons",
      items: ["PAX tree nodes now show their in-game icons."],
    },
    {
      version: "1.1.0", date: "2026-06-23", title: "Visuals, weapons & epics",
      items: [
        "Skill trees now use the real visual layout (background + positioned nodes & connectors).",
        "Weapons: 2 primary slots + 1 secondary (sidearm).",
        "Gear: build custom Epic pieces (free choice of mods & attributes), not only legendaries.",
        "Skill icons are back.",
        "This “What’s new” popup on each update.",
      ],
    },
    {
      version: "1.0.0", date: "2026-06-23", title: "Initial release",
      items: ["All 4 classes: class trees, PAX, Ascension, gear & skills, stat summary, build sharing."],
    },
  ];

  // ---- Config ----
  const CLASS_LIST = ["technomancer", "pyromancer", "trickster", "devastator"];
  const CLASS_POINTS = 20, PAX_POINTS = 5, ASC_TOTAL = D.ascension._meta.totalPoints, MAX_SKILLS = 3;
  const TREE_W = 1850, TREE_H = 880;
  const ARMOR_SLOTS = ["Headgear", "Upper Armor", "Lower Armor", "Gloves", "Footgear"];
  // Per the wiki: 2 primary weapons + 1 sidearm; sidearms are only Pistols & Revolvers.
  const SIDEARM_TYPES = ["Pistol", "Revolver"];
  const WEAPON_SLOTS = [
    { key: "primary1", label: "Primary Weapon I", sidearm: false },
    { key: "primary2", label: "Primary Weapon II", sidearm: false },
    { key: "secondary", label: "Secondary (Sidearm)", sidearm: true },
  ];
  const ALL_TYPES = [...new Set(D.weapons.map((w) => w.type).filter(Boolean))].sort();
  const typesFor = (sidearm) => ALL_TYPES.filter((t) => sidearm ? SIDEARM_TYPES.includes(t) : !SIDEARM_TYPES.includes(t));
  // Variants are tied to the weapon type, so filter the variant list by the chosen type.
  const VARIANTS_BY_TYPE = {};
  D.weapons.forEach((w) => {
    if (!w.type || !w.variant || w.variant === "One-Shot Var") return;
    (VARIANTS_BY_TYPE[w.type] = VARIANTS_BY_TYPE[w.type] || []).push(w.variant);
  });
  for (const t in VARIANTS_BY_TYPE) VARIANTS_BY_TYPE[t] = [...new Set(VARIANTS_BY_TYPE[t])].sort();
  const EPIC = "__epic__";
  const EPIC_ATTRS = 3, EPIC_MODS = 3;
  // Breadbuilder node-box sizes by kind; coords are the box TOP-LEFT, so the
  // drawn circle center is (x + S/2, y + S/2). Used to align our overlay.
  const NODE_PX = { 0: 42, 1: 62, 2: 136 };
  const nodeCenter = (n) => { const s = (NODE_PX[n.kind] ?? 42) / 2; return { cx: n.x + s, cy: n.y + s }; };

  // ---- State ----
  const blankGear = () => ({ item: "", mods: [], attrs: [], type: "", variant: "", factory: [] });
  const freshGear = () => {
    const g = {};
    for (const w of WEAPON_SLOTS) g[w.key] = blankGear();
    for (const s of ARMOR_SLOTS) g[s] = blankGear();
    return g;
  };
  const state = {
    cls: "technomancer",
    tree: new Set([0]),
    pax: new Set(),
    asc: {},                 // universal — kept across classes
    skills: new Set(),
    gear: freshGear(),       // weapons universal; armor reset on class change
  };

  // ---- UI flags ----
  let showTreeStats = false; // Breadbuilder-style stats overlay on the tree tab
  let showPaxLayout = true;  // in-game PAX tree reference image on the PAX tab
  let dupMods = new Set();   // mod names equipped more than once (recomputed each render)

  // ---- Class-specific data ----
  let TREE = [], treeById = {}, BRANCHES = [], SKILLS = [], PAXDATA = { branches: [] }, ARMOR = [];
  function loadClass() {
    const c = D.classes[state.cls];
    TREE = c.skilltree.nodes;
    treeById = Object.fromEntries(TREE.map((n) => [n.id, n]));
    BRANCHES = c.skilltree._meta.branches;
    SKILLS = c.skills.skills;
    PAXDATA = c.pax;
    ARMOR = c.armor;
  }

  // ---- Helpers ----
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pct = (v) => (Math.round(v * 10) / 10) + "%";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const skillIcon = (s) => s.icon ? `assets/skills/${encodeURIComponent(s.icon)}` : null;

  const BRANCH_COLORS = ["#e8a33d", "#5bd6c9", "#c06fd6"]; // per-branch accent

  // ===== Skill tree logic =====
  function nodeAvailable(n) {
    if (n.id === 0) return true;
    if (n.prereqs.includes(0)) return true;
    return n.prereqs.some((p) => state.tree.has(p));
  }
  function pruneTree() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...state.tree]) {
        if (id === 0) continue;
        const n = treeById[id];
        const supported = n.prereqs.includes(0) || n.prereqs.some((p) => state.tree.has(p) && p !== id);
        if (!supported) { state.tree.delete(id); changed = true; }
      }
    }
  }
  function toggleTreeNode(id) {
    if (id === 0) return;
    if (state.tree.has(id)) { state.tree.delete(id); pruneTree(); }
    else {
      if (state.tree.size - 1 >= CLASS_POINTS) return toast(`Class tree is capped at ${CLASS_POINTS} points`);
      if (!nodeAvailable(treeById[id])) return;
      state.tree.add(id);
    }
    render();
  }

  // ===== Attribute pools for Epic gear =====
  function weaponAttrPool() {
    const s = new Set(); D.weapons.forEach((w) => (w.specialStats || []).forEach((x) => s.add(x)));
    return [...s].sort();
  }
  function armorAttrPool() {
    const s = new Set(); ARMOR.forEach((a) => (a.specialStats || []).forEach((x) => s.add(x)));
    return [...s].sort();
  }
  const modsForScope = (scope) => D.mods.filter((m) => m.scope === scope);

  // Exact (non-linear) cumulative value at `pts` points, from the node's curve.
  const ascValue = (node, pts) => {
    if (pts <= 0) return 0;
    const c = node.curve;
    if (c) return c[Math.min(pts, c.length) - 1];
    return +((pts / 10) * node.max).toFixed(2); // fallback
  };

  // ===== Aggregation =====
  function aggregateStats() {
    const map = {};
    const add = (stat, v) => (map[stat] = (map[stat] || 0) + v);
    for (const id of state.tree) for (const b of treeById[id].bonuses) if (typeof b.value === "number") add(b.stat, b.value * 100);
    for (const cat of D.ascension.categories) for (const node of cat.nodes) {
      const pts = state.asc[cat.name + "::" + node.name] || 0;
      if (pts) add(node.stat, ascValue(node, pts));
    }
    return Object.entries(map).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  }
  function findGearItem(slot, name) {
    if (WEAPON_SLOTS.some((w) => w.key === slot)) return D.weapons.find((w) => w.name === name);
    return ARMOR.find((a) => a.name === name);
  }
  const modDesc = (name) => (D.mods.find((m) => m.name === name) || {}).description || null;
  function paxNodeByKey(key) {
    const [bn, nm] = key.split("::");
    for (const b of PAXDATA.branches) if (b.name === bn) { const n = b.nodes.find((x) => x.name === nm); if (n) return n; }
    return null;
  }
  // Returns {name, detail} per active conditional effect (for hover tooltips).
  function activeEffects() {
    const out = [];
    for (const id of state.tree) for (const b of treeById[id].bonuses)
      if (b.value == null) out.push({ name: treeById[id].name === "(class node)" ? "Class core" : treeById[id].name, detail: b.stat });
    for (const key of state.pax) { const n = paxNodeByKey(key); out.push({ name: key.split("::")[1], detail: n ? n.desc : null }); }
    for (const slot of Object.keys(state.gear)) {
      const g = state.gear[slot];
      if (!g.item) continue;
      if (g.item === EPIC) {
        g.attrs.filter(Boolean).forEach((a) => out.push({ name: a, detail: "Epic gear attribute (stat roll)" }));
        g.mods.filter(Boolean).forEach((m) => out.push({ name: m, detail: modDesc(m) }));
      } else {
        const it = findGearItem(slot, g.item);
        const defaults = ((it && it.factoryMods) || []).slice(0, 2);
        defaults.forEach((d, i) => { const m = g.factory[i] != null ? g.factory[i] : d; if (m) out.push({ name: m, detail: modDesc(m) }); });
        g.mods.filter(Boolean).forEach((m) => out.push({ name: m, detail: modDesc(m) }));
      }
    }
    return out;
  }
  // Effective mods on a single gear slot (legendary factory incl. swaps +
  // apocalypse, or epic mods).
  function modsOfSlot(slot) {
    const g = state.gear[slot]; const out = [];
    if (!g.item) return out;
    if (g.item === EPIC) { g.mods.filter(Boolean).forEach((m) => out.push(m)); }
    else {
      const it = findGearItem(slot, g.item);
      const defaults = ((it && it.factoryMods) || []).slice(0, 2);
      defaults.forEach((d, i) => { const m = g.factory[i] != null ? g.factory[i] : d; if (m) out.push(m); });
      g.mods.filter(Boolean).forEach((m) => out.push(m));
    }
    return out;
  }
  // Duplicates flagged per "conflict scope": all 5 armor pieces are worn at once,
  // so armor mods share one pool; only one weapon is active at a time, so each
  // weapon is its own pool (the same mod on two different weapons is fine).
  function duplicateModSet() {
    const dup = new Set();
    const tally = (arr) => { const c = {}; arr.forEach((m) => (c[m] = (c[m] || 0) + 1)); Object.keys(c).forEach((m) => { if (c[m] > 1) dup.add(m); }); };
    tally(ARMOR_SLOTS.flatMap(modsOfSlot));
    WEAPON_SLOTS.forEach((w) => tally(modsOfSlot(w.key)));
    return dup;
  }

  function equippedSets() {
    const counts = {};
    for (const slot of ARMOR_SLOTS) {
      const g = state.gear[slot];
      if (!g.item || g.item === EPIC) continue;
      const a = ARMOR.find((x) => x.name === g.item);
      if (a && a.setBonus) {
        const setName = a.setBonus.split(":")[0].replace(/\s+set$/i, "").trim(); // merge "X" / "X Set"
        counts[setName] = counts[setName] || { count: 0 };
        counts[setName].count++;
      }
    }
    return counts;
  }

  // ===== Render =====
  function render() {
    dupMods = duplicateModSet();
    renderClassSwitch();
    renderTree();
    renderPax();
    renderAscension();
    renderLoadout();
    renderSummary();
    writeHash();
  }

  function switchClass(cls) {
    if (cls === state.cls || !CLASS_LIST.includes(cls)) return;
    state.cls = cls;
    state.tree = new Set([0]); state.pax = new Set(); state.skills = new Set();
    for (const s of ARMOR_SLOTS) state.gear[s] = blankGear(); // armor is class-specific; weapons kept
    loadClass();
    render();
  }
  function renderClassSwitch() {
    const host = $("#class-switch"); host.innerHTML = "";
    for (const cls of CLASS_LIST) {
      const b = el("button", "class-btn" + (cls === state.cls ? " active" : ""), cls);
      b.onclick = () => switchClass(cls);
      host.appendChild(b);
    }
    $("#brand-class").textContent = state.cls.toUpperCase();
  }

  // ---- Visual skill tree ----
  function renderTree() {
    const panel = $("#panel-tree"); panel.innerHTML = "";
    const used = state.tree.size - 1;
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>Class Tree</h2><div class="hint">Click connected nodes. Hover for details. Removing a node frees its dependents.</div>`));
    const right = el("div", "head-right");
    const statsBtn = el("button", "btn btn-ghost btn-sm" + (showTreeStats ? " on" : ""), showTreeStats ? "Hide stats" : "Show stats");
    statsBtn.onclick = () => { showTreeStats = !showTreeStats; renderTree(); };
    right.appendChild(statsBtn);
    right.appendChild(el("div", "points-pill", `${used} / ${CLASS_POINTS} pts`));
    head.appendChild(right);
    panel.appendChild(head);

    const legend = el("div", "tree-legend");
    BRANCHES.forEach((b, i) => legend.appendChild(el("span", "legend-item", `<i style="background:${BRANCH_COLORS[i]}"></i>${esc(b)}`)));
    panel.appendChild(legend);

    const stage = el("div", "tree-stage");
    const bg = el("img", "tree-bg"); bg.src = `assets/skilltrees/${state.cls}.webp`; bg.alt = "";
    stage.appendChild(bg);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "tree-edges");
    svg.setAttribute("viewBox", `0 0 ${TREE_W} ${TREE_H}`);
    svg.setAttribute("preserveAspectRatio", "none");
    const drawn = new Set();
    for (const n of TREE) {
      if (n.x == null) continue;
      for (const p of n.prereqs) {
        const pr = treeById[p]; if (!pr || pr.x == null) continue;
        const key = Math.min(n.id, p) + "-" + Math.max(n.id, p);
        if (drawn.has(key)) continue; drawn.add(key);
        const both = state.tree.has(n.id) && state.tree.has(p);
        const a = nodeCenter(n), b = nodeCenter(pr);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", a.cx); line.setAttribute("y1", a.cy);
        line.setAttribute("x2", b.cx); line.setAttribute("y2", b.cy);
        line.setAttribute("class", "edge" + (both ? " on" : ""));
        svg.appendChild(line);
      }
    }
    stage.appendChild(svg);

    for (const n of TREE) {
      if (n.x == null) continue;
      const sel = state.tree.has(n.id);
      const avail = sel || nodeAvailable(n);
      const branchIdx = Math.max(0, BRANCHES.indexOf(n.branch));
      const node = el("button", "tree-node" + (sel ? " sel" : "") + (avail ? "" : " locked") + (n.kind === 2 ? " core" : n.kind === 1 ? " major" : ""));
      const { cx, cy } = nodeCenter(n);
      const sizePct = (NODE_PX[n.kind] ?? 42) / TREE_W * 100; // hotspot matches the drawn circle, responsively
      node.style.left = (cx / TREE_W * 100) + "%";
      node.style.top = (cy / TREE_H * 100) + "%";
      node.style.width = sizePct + "%";
      if (sel) node.style.setProperty("--c", BRANCH_COLORS[branchIdx] || "#e8a33d");
      node.onclick = () => toggleTreeNode(n.id);
      node.onmouseenter = (e) => showTip(e, treeTipHtml(n));
      node.onmousemove = moveTip;
      node.onmouseleave = hideTip;
      stage.appendChild(node);
    }

    if (showTreeStats) {
      const box = el("div", "tree-stats");
      box.appendChild(el("div", "tree-stats-h", "Build stats"));
      const stats = aggregateStats();
      if (stats.length) for (const [stat, v] of stats) {
        const line = el("div", "stat-line"); line.innerHTML = `<span>${esc(stat)}</span><span class="v">+${pct(v)}</span>`; box.appendChild(line);
      } else box.appendChild(el("div", "empty-note", "no numeric bonuses yet"));
      box.appendChild(el("div", "tree-stats-note", "From class tree + ascension"));
      stage.appendChild(box);
    }
    panel.appendChild(stage);
  }

  // tree tooltip
  let tip;
  function ensureTip() { if (!tip) { tip = el("div", "tree-tip"); document.body.appendChild(tip); } return tip; }
  function showTip(e, html) {
    const t = ensureTip();
    t.innerHTML = html;
    t.classList.add("show"); moveTip(e);
  }
  function treeTipHtml(n) {
    const bonus = n.bonuses.map((b) => typeof b.value === "number" ? `${esc(b.stat)} <b>+${pct(b.value * 100)}</b>` : esc(b.stat)).join("<br>");
    return `<div class="tip-name">${esc(n.name)}</div><div class="tip-branch">${esc(n.branch)}</div>${bonus ? `<div class="tip-bonus">${bonus}</div>` : ""}`;
  }
  function paxTipHtml(n, branchName) {
    return `<div class="tip-name">${esc(n.name)}</div><div class="tip-branch">${esc(branchName)} · ${esc(n.path)} path</div><div class="tip-bonus">${esc(n.desc)}</div>`;
  }
  function moveTip(e) {
    if (!tip) return;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > innerWidth) x = e.clientX - w - pad;
    if (y + h > innerHeight) y = e.clientY - h - pad;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { if (tip) tip.classList.remove("show"); }

  // ---- PAX selection + interactive image ----
  const PAX_NAT_W = 2000, PAX_NAT_H = 1000;
  const PAX_SMALL_PX = 60, PAX_BIG_PX = 88; // two node sizes, like the class tree
  // Bigger nodes = the two universal parallels + each path's capstone (derived by position).
  function paxBigSet(branch) {
    const g = { universal: [], top: [], middle: [], bottom: [] };
    for (const n of branch.nodes) (g[n.path] || (g[n.path] = [])).push(n.name);
    const big = new Set();
    [g.universal[1], g.universal[2], g.top[1], g.middle[1], g.bottom[1]].forEach((x) => x && big.add(x));
    return big;
  }

  // All PAX branches share one lattice: a universal diamond (entry -> two
  // parallels -> converge) then top/middle/bottom paths; the middle path is
  // reached from the top/bottom branch point. Prereqs are derived by position.
  function paxPrereqMap(branch) {
    const g = { universal: [], top: [], middle: [], bottom: [] };
    for (const n of branch.nodes) (g[n.path] || (g[n.path] = [])).push(n.name);
    const { universal: U, top: T = [], middle: M = [], bottom: B = [] } = g;
    const m = {};
    const set = (name, prereqs) => { if (name) m[name] = prereqs.filter(Boolean); };
    set(U[0], []);                 // branch entry (root)
    set(U[1], [U[0]]);
    set(U[2], [U[0]]);
    set(U[3], [U[1], U[2]]);       // converge
    set(T[0], [U[3]]); set(T[1], [T[0]]);
    set(B[0], [U[3]]); set(B[1], [B[0]]);
    set(M[0], [U[3], T[0], B[0]]); set(M[1], [M[0]]); // middle opens from the converge node or either path start

    return m;
  }
  const paxKey = (branch, name) => branch.name + "::" + name;
  function paxAvailable(branch, name, prMap) {
    const pr = prMap[name] || [];
    if (!pr.length) return true; // root
    return pr.some((p) => state.pax.has(paxKey(branch, p)));
  }
  function prunePax(branch, prMap) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of branch.nodes) {
        const key = paxKey(branch, n.name);
        if (!state.pax.has(key)) continue;
        const pr = prMap[n.name] || [];
        if (pr.length && !pr.some((p) => state.pax.has(paxKey(branch, p)))) { state.pax.delete(key); changed = true; }
      }
    }
  }
  function togglePax(branch, name) {
    const prMap = paxPrereqMap(branch);
    const key = paxKey(branch, name);
    if (state.pax.has(key)) { state.pax.delete(key); prunePax(branch, prMap); }
    else {
      if (state.pax.size >= PAX_POINTS) return toast(`PAX is capped at ${PAX_POINTS} points`);
      if (!paxAvailable(branch, name, prMap)) return toast("Unlock the connected node first");
      state.pax.add(key);
    }
    render();
  }
  function paxStage() {
    const stage = el("div", "tree-stage pax-stage");
    const bg = el("img", "tree-bg"); bg.src = `assets/paxtrees/${state.cls}.jpg`; bg.alt = "";
    stage.appendChild(bg);
    PAXDATA.branches.forEach((branch, bi) => {
      const prMap = paxPrereqMap(branch);
      const bigSet = paxBigSet(branch);
      for (const n of branch.nodes) {
        if (n.x == null) continue;
        const sel = state.pax.has(paxKey(branch, n.name));
        const avail = sel || paxAvailable(branch, n.name, prMap);
        const node = el("button", "tree-node pax-hotspot" + (sel ? " sel" : "") + (avail ? "" : " locked"));
        node.style.left = (n.x / PAX_NAT_W * 100) + "%";
        node.style.top = (n.y / PAX_NAT_H * 100) + "%";
        node.style.width = ((bigSet.has(n.name) ? PAX_BIG_PX : PAX_SMALL_PX) / PAX_NAT_W * 100) + "%";
        node.style.setProperty("--c", BRANCH_COLORS[bi] || "#e8a33d");
        node.onclick = () => togglePax(branch, n.name);
        node.onmouseenter = (e) => showTip(e, paxTipHtml(n, branch.name));
        node.onmousemove = moveTip; node.onmouseleave = hideTip;
        stage.appendChild(node);
      }
    });
    return stage;
  }

  function renderPax() {
    const panel = $("#panel-pax"); panel.innerHTML = "";
    const interactive = PAXDATA.branches.some((b) => b.nodes.some((n) => n.x != null));
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>PAX Trees</h2><div class="hint">${interactive ? "Click nodes on the tree or in the lists below." : "Two sub-class branches. Spend PAX points along a path."}</div>`));
    const right = el("div", "head-right");
    const layoutBtn = el("button", "btn btn-ghost btn-sm" + (showPaxLayout ? " on" : ""),
      (showPaxLayout ? "Hide" : "Show") + (interactive ? " tree" : " layout"));
    layoutBtn.onclick = () => { showPaxLayout = !showPaxLayout; renderPax(); };
    right.appendChild(layoutBtn);
    right.appendChild(el("div", "points-pill", `${state.pax.size} / ${PAX_POINTS} pts`));
    head.appendChild(right);
    panel.appendChild(head);

    if (showPaxLayout && interactive) panel.appendChild(paxStage());
    else if (showPaxLayout) {
      const ref = el("figure", "pax-ref");
      ref.innerHTML = `<img src="assets/paxtrees/${state.cls}.jpg" alt="${esc(state.cls)} PAX trees layout">
        <figcaption>In-game PAX layout (reference) — select nodes in the lists below</figcaption>`;
      panel.appendChild(ref);
    }

    const wrap = el("div", "branches cols-2");
    for (const branch of PAXDATA.branches) {
      const prMap = paxPrereqMap(branch);
      const col = el("div", "branch");
      col.appendChild(el("div", "branch-head", branch.name));
      col.appendChild(el("div", "branch-theme", branch.theme));
      for (const p of ["universal", "top", "middle", "bottom"]) {
        const nodes = branch.nodes.filter((n) => n.path === p);
        if (!nodes.length) continue;
        col.appendChild(el("div", "path-label", p === "universal" ? "Shared trunk" : p + " path"));
        for (const n of nodes) {
          const sel = state.pax.has(paxKey(branch, n.name));
          const avail = sel || paxAvailable(branch, n.name, prMap);
          const btn = el("button", "node pax-node" + (sel ? " sel" : ""));
          if (!avail) btn.disabled = true;
          const icon = n.icon ? `<img class="pax-icon" src="assets/pax/${encodeURIComponent(n.icon)}" alt="">` : `<span class="pax-icon ph"></span>`;
          btn.innerHTML = `<div class="pax-row">${icon}<div class="pax-text"><div class="node-name">${esc(n.name)}</div><div class="node-bonus">${esc(n.desc)}</div></div></div>`;
          btn.onclick = () => togglePax(branch, n.name);
          col.appendChild(btn);
        }
      }
      wrap.appendChild(col);
    }
    panel.appendChild(wrap);
  }

  function renderAscension() {
    const panel = $("#panel-ascension"); panel.innerHTML = "";
    const total = Object.values(state.asc).reduce((a, b) => a + b, 0);
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>Ascension</h2><div class="hint">Up to 10 points per node · 200 total. Universal — kept when you switch class.</div>`));
    head.appendChild(el("div", "points-pill", `${total} / ${ASC_TOTAL} pts`));
    panel.appendChild(head);
    const cats = el("div", "asc-cats");
    for (const cat of D.ascension.categories) {
      const c = el("div", "asc-cat");
      c.appendChild(el("h3", null, cat.name));
      for (const node of cat.nodes) {
        const key = cat.name + "::" + node.name;
        const pts = state.asc[key] || 0;
        const box = el("div", "asc-node");
        box.innerHTML = `<div class="asc-node-top"><span class="asc-node-name">${esc(node.name)}</span>
          <span class="asc-node-val">+${ascValue(node, pts)}${node.unit} / +${node.max}${node.unit}</span></div>`;
        const step = el("div", "stepper");
        const minus = el("button", null, "−"); minus.disabled = pts <= 0; minus.title = "Shift+click: remove all";
        const bar = el("div", "stepper-bar"); const fill = el("div", "stepper-fill"); fill.style.width = (pts / 10 * 100) + "%"; bar.appendChild(fill);
        const plus = el("button", null, "+"); plus.disabled = pts >= 10 || total >= ASC_TOTAL; plus.title = "Shift+click: add all (10)";
        const count = el("span", "stepper-count", `${pts}/10`);
        minus.onclick = (e) => { if (pts <= 0) return; state.asc[key] = e.shiftKey ? 0 : pts - 1; if (!state.asc[key]) delete state.asc[key]; render(); };
        plus.onclick = (e) => {
          if (pts >= 10 || total >= ASC_TOTAL) return;
          const room = Math.min(10 - pts, ASC_TOTAL - total); // never exceed the 200 cap
          state.asc[key] = pts + (e.shiftKey ? room : 1);
          render();
        };
        step.append(minus, bar, plus, count);
        box.appendChild(step);
        c.appendChild(box);
      }
      cats.appendChild(c);
    }
    panel.appendChild(cats);
  }

  function renderLoadout() {
    const panel = $("#panel-loadout"); panel.innerHTML = "";

    panel.appendChild(el("div", "section-head", `<div><h2>Active Skills</h2><div class="hint">Pick up to ${MAX_SKILLS}.</div></div>`));
    const skWrap = el("div", "skills-pick");
    for (const s of SKILLS) {
      const sel = state.skills.has(s.name);
      const card = el("button", "skill-card" + (sel ? " sel" : ""));
      const icon = skillIcon(s);
      card.innerHTML = `<div class="sk-head">${icon ? `<img class="sk-icon" src="${icon}" alt="">` : ""}<span class="sk-name">${esc(s.name)}</span></div><div class="sk-desc">${esc(s.desc)}</div>`;
      card.onclick = () => {
        if (sel) state.skills.delete(s.name);
        else { if (state.skills.size >= MAX_SKILLS) return toast(`Max ${MAX_SKILLS} active skills`); state.skills.add(s.name); }
        render();
      };
      skWrap.appendChild(card);
    }
    panel.appendChild(skWrap);

    panel.appendChild(el("div", "section-head", `<div style="margin-top:18px"><h2>Weapons</h2><div class="hint">2 primary + 1 secondary. Equip a legendary or build a custom Epic.</div></div>`));
    const wGrid = el("div", "loadout-grid");
    for (const w of WEAPON_SLOTS) {
      const opts = D.weapons.filter((x) => w.sidearm ? SIDEARM_TYPES.includes(x.type) : !SIDEARM_TYPES.includes(x.type));
      wGrid.appendChild(gearSlot(w.label, w.key, "weapon", opts, w));
    }
    panel.appendChild(wGrid);

    panel.appendChild(el("div", "section-head", `<div style="margin-top:18px"><h2>Armor</h2><div class="hint">5 slots. Legendary or custom Epic.</div></div>`));
    const aGrid = el("div", "loadout-grid");
    for (const slot of ARMOR_SLOTS) {
      const opts = ARMOR.filter((a) => a.slot === slot);
      aGrid.appendChild(gearSlot(slot, slot, "armor", opts));
    }
    panel.appendChild(aGrid);
  }

  function gearSlot(label, slotKey, scope, options, weaponSlot) {
    const g = state.gear[slotKey];
    const slot = el("div", "gear-slot");
    slot.appendChild(el("div", "gear-slot-head", `<span class="gear-slot-label">${esc(label)}</span>`));

    const itemGroups = [{ label: null, options: [
      { value: "", label: "— empty —", cls: " mp-none" },
      { value: EPIC, label: "✦ Epic (custom)" },
      ...options.map((o) => ({ value: o.name, label: o.name })),
    ] }];
    slot.appendChild(searchPicker(itemGroups, g.item,
      (v) => { g.item = v; g.mods = []; g.attrs = []; g.type = ""; g.variant = ""; g.factory = []; render(); },
      { placeholder: "— empty —", searchPlaceholder: scope === "weapon" ? "Search weapons…" : "Search armor…" }));

    if (g.item === EPIC) {
      slot.appendChild(epicEditor(g, scope, weaponSlot));
    } else if (g.item) {
      const item = findGearItem(slotKey, g.item);
      if (item) {
        slot.appendChild(scope === "weapon" ? weaponDetail(item) : armorDetail(item));
        slot.appendChild(legendaryModEditor(g, scope, item));
      }
    }
    return slot;
  }

  // Legendary mods: 2 factory mods, only ONE swappable at a time (the other
  // locks to its default), plus a free Apocalypse (3rd) slot.
  function legendaryModEditor(g, scope, item) {
    const box = el("div", "epic-editor");
    const defaults = (item.factoryMods || []).slice(0, 2);
    const cur = defaults.map((d, i) => g.factory[i] != null ? g.factory[i] : d);
    const swapped = defaults.map((d, i) => cur[i] !== d);
    box.appendChild(el("div", "epic-label", "Factory mods — you can swap one"));
    defaults.forEach((def, i) => {
      const editable = !swapped[1 - i]; // locked while the other slot is swapped
      const s = modOptionsSelect(scope, cur[i], !editable, "— mod —", (v) => { g.factory[i] = v; render(); });
      if (swapped[i]) s.classList.add("swapped");
      box.appendChild(s);
    });
    box.appendChild(el("div", "epic-label", "Apocalypse mod (3rd slot)"));
    box.appendChild(modSelect(g, 0, scope, "— free mod —"));
    return box;
  }

  function epicEditor(g, scope, weaponSlot) {
    const box = el("div", "epic-editor");
    if (scope === "weapon") {
      box.appendChild(el("div", "epic-label", "Weapon"));
      const typeOpts = [{ value: "", label: "— type —", cls: " mp-none" }, ...typesFor(weaponSlot ? weaponSlot.sidearm : false).map((t) => ({ value: t, label: t }))];
      box.appendChild(searchPicker([{ label: null, options: typeOpts }], g.type,
        (v) => { g.type = v; if (!(VARIANTS_BY_TYPE[g.type] || []).includes(g.variant)) g.variant = ""; render(); },
        { placeholder: "— type —", searchPlaceholder: "Search types…" }));
      const varList = g.type ? (VARIANTS_BY_TYPE[g.type] || []) : [];
      const varOpts = [{ value: "", label: g.type ? "— variant —" : "— pick a type first —", cls: " mp-none" }, ...varList.map((v) => ({ value: v, label: v }))];
      box.appendChild(searchPicker([{ label: null, options: varOpts }], g.variant,
        (v) => { g.variant = v; render(); },
        { placeholder: g.type ? "— variant —" : "— pick a type first —", disabled: !g.type }));
    }
    const pool = scope === "weapon" ? weaponAttrPool() : armorAttrPool();
    box.appendChild(el("div", "epic-label", "Attributes"));
    for (let i = 0; i < EPIC_ATTRS; i++) {
      const attrOpts = [{ value: "", label: "— attribute —", cls: " mp-none" }, ...pool.map((a) => ({ value: a, label: a }))];
      box.appendChild(searchPicker([{ label: null, options: attrOpts }], g.attrs[i] || "",
        (v) => { g.attrs[i] = v; render(); }, { placeholder: "— attribute —", searchPlaceholder: "Search attributes…" }));
    }
    box.appendChild(el("div", "epic-label", "Mods"));
    for (let i = 0; i < EPIC_MODS; i++) box.appendChild(modSelect(g, i, scope, "— mod —"));
    return box;
  }

  // Generic searchable dropdown. groups: [{label|null, options:[{value,label,cls?}]}].
  // A search box appears only when there are enough options to warrant it.
  function searchPicker(groups, current, onChange, opts = {}) {
    let curLabel = opts.placeholder || "— select —";
    for (const g of groups) for (const o of g.options) if (o.value === current) curLabel = o.label;
    const wrap = el("div", "mod-picker" + (opts.disabled ? " disabled" : "") + (opts.dup ? " dup" : "") + (opts.swapped ? " swapped" : ""));
    const trigger = el("button", "mp-trigger", `<span>${esc(curLabel)}</span><span class="mp-caret">▾</span>`);
    trigger.disabled = !!opts.disabled;
    if (opts.dup) trigger.title = "This mod is equipped more than once — it doesn't stack.";
    const pop = el("div", "mp-pop hidden");
    const list = el("div", "mp-list");
    for (const g of groups) {
      if (g.label) { const h = el("div", "mp-group", g.label); h.dataset.group = "1"; list.appendChild(h); }
      for (const o of g.options) {
        const b = el("button", "mp-opt" + (o.cls || ""), esc(o.label));
        if (o.value === current) b.classList.add("sel");
        b.onclick = () => onChange(o.value);
        list.appendChild(b);
      }
    }
    let search = null;
    if (opts.searchable !== false && groups.reduce((n, g) => n + g.options.length, 0) > 8) {
      search = el("input", "mp-search"); search.type = "text"; search.placeholder = opts.searchPlaceholder || "Search…";
      search.onclick = (e) => e.stopPropagation();
      search.oninput = () => {
        const q = search.value.toLowerCase(); let group = null;
        for (const ch of list.children) {
          if (ch.dataset.group) { group = ch; group.style.display = "none"; continue; }
          const show = !q || ch.textContent.toLowerCase().includes(q);
          ch.style.display = show ? "" : "none";
          if (show && group) group.style.display = "";
        }
      };
      pop.appendChild(search);
    }
    pop.appendChild(list);
    trigger.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".mp-pop").forEach((p) => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
      if (!pop.classList.contains("hidden") && search) { search.value = ""; search.dispatchEvent(new Event("input")); search.focus(); }
    };
    wrap.append(trigger, pop);
    return wrap;
  }

  // Mod picker built on searchPicker (armor groups class + armor mods; keeps a
  // signature factory mod selectable even if it's outside the pool).
  function modOptionsSelect(scope, current, disabled, placeholder, onChange) {
    const mk = (mods) => mods.map((m) => ({ value: m.name, label: `[T${m.tier}] ${m.name}` }));
    const groups = scope === "armor"
      ? [{ label: "Class skill mods", options: mk(D.mods.filter((m) => m.scope === state.cls)) }, { label: "Armor mods", options: mk(D.mods.filter((m) => m.scope === "armor")) }]
      : [{ label: null, options: mk(modsForScope(scope)) }];
    const known = new Set(groups.flatMap((g) => g.options.map((o) => o.value)));
    const lead = [{ value: "", label: placeholder, cls: " mp-none" }];
    if (current && !known.has(current)) lead.push({ value: current, label: current });
    groups.unshift({ label: null, options: lead });
    return searchPicker(groups, current, onChange, { placeholder, disabled, dup: current && dupMods.has(current), searchPlaceholder: "Search mods…" });
  }
  const modSelect = (g, i, scope, placeholder) =>
    modOptionsSelect(scope, g.mods[i], false, placeholder, (v) => { g.mods[i] = v; render(); });

  function weaponDetail(w) {
    const d = el("div", "gear-detail");
    const rows = [["Type", w.type], ["Variant", w.variant], ["RPM", w.rpm], ["Mag", w.clip], ["Crit", w.critMulti]];
    d.innerHTML = rows.filter((r) => r[1] != null).map((r) => `<div class="row"><span class="k">${r[0]}</span><span>${esc(r[1])}</span></div>`).join("");
    if (w.specialStats?.length) d.innerHTML += `<div>${w.specialStats.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    return d;
  }
  function armorDetail(a) {
    const d = el("div", "gear-detail");
    if (a.specialStats?.length) d.innerHTML += `<div>${a.specialStats.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    if (a.setBonus) d.innerHTML += `<div class="set-bonus-text">${esc(a.setBonus)}</div>`;
    return d;
  }

  function renderSummary() {
    const body = $("#summary-body"); body.innerHTML = "";
    const usedTree = state.tree.size - 1;
    const ascTotal = Object.values(state.asc).reduce((a, b) => a + b, 0);
    const pts = el("div", "sum-section");
    pts.innerHTML = `<h3>Points</h3>
      <div class="budget-row"><span>Class Tree</span><b>${usedTree}/${CLASS_POINTS}</b></div>
      <div class="budget-row"><span>PAX</span><b>${state.pax.size}/${PAX_POINTS}</b></div>
      <div class="budget-row"><span>Ascension</span><b>${ascTotal}/${ASC_TOTAL}</b></div>`;
    body.appendChild(pts);

    const sk = el("div", "sum-section"); sk.innerHTML = `<h3>Active Skills</h3>`;
    const chips = el("div", "chip-list");
    if (state.skills.size) for (const s of state.skills) chips.appendChild(el("span", "chip on", esc(s)));
    else chips.appendChild(el("span", "empty-note", "none selected"));
    sk.appendChild(chips); body.appendChild(sk);

    const stats = aggregateStats();
    const st = el("div", "sum-section"); st.innerHTML = `<h3>Aggregated Stats</h3>`;
    if (stats.length) for (const [stat, v] of stats) { const line = el("div", "stat-line"); line.innerHTML = `<span>${esc(stat)}</span><span class="v">+${pct(v)}</span>`; st.appendChild(line); }
    else st.appendChild(el("div", "empty-note", "no numeric bonuses yet"));
    body.appendChild(st);

    const sets = equippedSets(); const setNames = Object.keys(sets);
    if (setNames.length) {
      const se = el("div", "sum-section"); se.innerHTML = `<h3>Set Bonuses</h3>`;
      for (const name of setNames) {
        const active = sets[name].count >= 3;
        const line = el("div", "stat-line");
        line.innerHTML = `<span>${esc(name)}</span><span class="v" style="color:${active ? "var(--good)" : "var(--txt-faint)"}">${sets[name].count} pc${active ? " ✓" : ""}</span>`;
        se.appendChild(line);
      }
      body.appendChild(se);
    }

    const wq = WEAPON_SLOTS.filter((w) => state.gear[w.key].item).length;
    const aq = ARMOR_SLOTS.filter((s) => state.gear[s].item).length;
    const eq = el("div", "sum-section");
    eq.innerHTML = `<h3>Equipped</h3>
      <div class="budget-row"><span>Weapons</span><b>${wq}/3</b></div>
      <div class="budget-row"><span>Armor</span><b>${aq}/5</b></div>`;
    body.appendChild(eq);

    const fx = activeEffects();
    if (fx.length) {
      const ef = el("div", "sum-section"); ef.innerHTML = `<h3>Active Effects (${fx.length})</h3>`;
      const cl = el("div", "chip-list");
      for (const f of fx) {
        const chip = el("span", "chip" + (f.detail ? " has-tip" : ""), esc(f.name));
        if (f.detail) {
          chip.onmouseenter = (e) => showTip(e, `<div class="tip-name">${esc(f.name)}</div><div class="tip-bonus">${esc(f.detail)}</div>`);
          chip.onmousemove = moveTip; chip.onmouseleave = hideTip;
        }
        cl.appendChild(chip);
      }
      ef.appendChild(cl); body.appendChild(ef);
    }

    if (dupMods.size) {
      const w = el("div", "sum-section warn");
      w.innerHTML = `<h3>⚠ Duplicate mods</h3>`;
      const cl = el("div", "chip-list");
      for (const m of dupMods) cl.appendChild(el("span", "chip dup", esc(m)));
      w.appendChild(cl);
      w.appendChild(el("div", "warn-note", "Equipped more than once — mods don't stack."));
      body.appendChild(w);
    }
  }

  // ===== Tabs =====
  function initTabs() {
    $("#tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab"); if (!t) return;
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("is-active", x === t));
      for (const p of ["tree", "pax", "ascension", "loadout"]) $("#panel-" + p).classList.toggle("hidden", p !== t.dataset.tab);
      $(".layout").classList.toggle("full-tree", t.dataset.tab === "tree");
    });
  }

  // Shorten a share URL via da.gd (fallback tinyurl). Both preserve the #hash
  // (where the build is encoded) and hide "github" (some Discords filter it).
  // Falls back to the full URL if the services are unreachable.
  async function shortenUrl(url) {
    for (const api of ["https://da.gd/s?url=", "https://tinyurl.com/api-create.php?url="]) {
      try {
        const r = await fetch(api + encodeURIComponent(url));
        if (r.ok) { const s = (await r.text()).trim(); if (/^https?:\/\/\S+$/.test(s) && !/error/i.test(s)) return s; }
      } catch {}
    }
    return url;
  }
  async function copyLink(url) {
    const short = await shortenUrl(url);
    try { await navigator.clipboard.writeText(short); } catch {}
    return short;
  }

  // ===== Share via URL hash (compact, index-based) =====
  // Everything is stored as indices into the data arrays instead of full names,
  // then base64url-encoded — keeps shared links short.
  const HASH_FMT = 2;
  const GEAR_ORDER = [...WEAPON_SLOTS.map((w) => w.key), ...ARMOR_SLOTS];
  const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  const isWeaponSlot = (k) => WEAPON_SLOTS.some((w) => w.key === k);
  const slotItems = (k) => (isWeaponSlot(k) ? D.weapons : D.classes[state.cls].armor);
  const paxFlatKeys = () => D.classes[state.cls].pax.branches.flatMap((b) => b.nodes.map((n) => b.name + "::" + n.name));
  const ascFlatKeys = () => D.ascension.categories.flatMap((c) => c.nodes.map((n) => c.name + "::" + n.name));
  const skillNames = () => D.classes[state.cls].skills.skills.map((s) => s.name);
  const modIdx = (n) => D.mods.findIndex((m) => m.name === n);
  const modNm = (i) => D.mods[i]?.name || "";

  function encGear(k) {
    const g = state.gear[k];
    if (!g.item) return 0;
    const w = isWeaponSlot(k);
    if (g.item === EPIC) {
      const pool = w ? weaponAttrPool() : armorAttrPool();
      const ti = w ? ALL_TYPES.indexOf(g.type) : -1;
      const vi = w && g.type ? (VARIANTS_BY_TYPE[g.type] || []).indexOf(g.variant) : -1;
      return [1, ti, vi, g.attrs.filter(Boolean).map((a) => pool.indexOf(a)).filter((i) => i >= 0), g.mods.filter(Boolean).map(modIdx).filter((i) => i >= 0)];
    }
    return [2, slotItems(k).findIndex((x) => x.name === g.item),
      g.factory[0] != null ? modIdx(g.factory[0]) : -1,
      g.factory[1] != null ? modIdx(g.factory[1]) : -1,
      g.mods[0] ? modIdx(g.mods[0]) : -1];
  }
  function decGear(k, e) {
    const g = blankGear();
    if (!e || e === 0) return g;
    const w = isWeaponSlot(k);
    if (e[0] === 1) {
      g.item = EPIC;
      g.type = w && e[1] >= 0 ? ALL_TYPES[e[1]] : "";
      g.variant = w && g.type && e[2] >= 0 ? (VARIANTS_BY_TYPE[g.type] || [])[e[2]] || "" : "";
      const pool = w ? weaponAttrPool() : armorAttrPool();
      g.attrs = (e[3] || []).map((i) => pool[i]).filter(Boolean);
      g.mods = (e[4] || []).map(modNm).filter(Boolean);
    } else if (e[0] === 2) {
      g.item = slotItems(k)[e[1]]?.name || "";
      if (e[2] >= 0) g.factory[0] = modNm(e[2]);
      if (e[3] >= 0) g.factory[1] = modNm(e[3]);
      if (e[4] >= 0) g.mods[0] = modNm(e[4]);
    }
    return g;
  }

  function writeHash() {
    const pax = paxFlatKeys(), asc = ascFlatKeys(), sk = skillNames();
    const A = [];
    asc.forEach((key, i) => { if (state.asc[key]) A.push(i, state.asc[key]); });
    const payload = [
      HASH_FMT,
      CLASS_LIST.indexOf(state.cls),
      [...state.tree].filter((id) => id !== 0),
      [...state.pax].map((k) => pax.indexOf(k)).filter((i) => i >= 0),
      A,
      [...state.skills].map((n) => sk.indexOf(n)).filter((i) => i >= 0),
      GEAR_ORDER.map(encGear),
    ];
    history.replaceState(null, "", "#" + b64e(JSON.stringify(payload)));
  }
  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const o = JSON.parse(b64d(location.hash.slice(1)));
      if (!Array.isArray(o) || o[0] !== HASH_FMT) return; // unknown/old format → ignore
      if (CLASS_LIST[o[1]]) state.cls = CLASS_LIST[o[1]];
      loadClass(); // so class-specific lookups (armor, pax, skills) resolve correctly
      state.tree = new Set([0, ...(o[2] || [])]);
      const pax = paxFlatKeys(), asc = ascFlatKeys(), sk = skillNames();
      state.pax = new Set((o[3] || []).map((i) => pax[i]).filter(Boolean));
      state.asc = {};
      const A = o[4] || []; for (let i = 0; i < A.length; i += 2) if (asc[A[i]]) state.asc[asc[A[i]]] = A[i + 1];
      state.skills = new Set((o[5] || []).map((i) => sk[i]).filter(Boolean));
      const g = freshGear();
      (o[6] || []).forEach((e, i) => { g[GEAR_ORDER[i]] = decGear(GEAR_ORDER[i], e); });
      state.gear = g;
    } catch (e) { console.warn("Bad build hash", e); }
  }

  // ===== What's-new popup =====
  const SEEN_KEY = "or_planner_seen_version";
  function openChangelog(force) {
    const seen = (() => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } })();
    if (!force && seen === APP_VERSION) return;
    const back = el("div", "modal-back");
    const card = el("div", "modal");
    card.innerHTML = `<div class="modal-head"><h2>What's new</h2><span class="modal-ver">v${APP_VERSION}</span></div>`;
    const log = el("div", "cl-log");
    CHANGELOG.forEach((entry, idx) => {
      const sec = el("div", "cl-entry" + (idx === 0 ? " open" : "")); // latest expanded, rest collapsed
      const head = el("button", "cl-head", `<span class="cl-ver">v${entry.version} · ${entry.date} — ${esc(entry.title)}</span><span class="cl-caret">▾</span>`);
      head.onclick = () => sec.classList.toggle("open");
      const bodyEl = el("div", "cl-body");
      for (const p of entry.patches || []) { // patches first (newer than the minor release)
        const pb = el("div", "cl-patch");
        pb.innerHTML = `<div class="cl-patch-ver">v${p.version} · ${p.date}</div>`;
        const pul = el("ul", "cl-list");
        for (const it of p.items) pul.appendChild(el("li", null, esc(it)));
        pb.appendChild(pul); bodyEl.appendChild(pb);
      }
      const ul = el("ul", "cl-list");
      for (const it of entry.items) ul.appendChild(el("li", null, esc(it)));
      bodyEl.appendChild(ul);
      sec.append(head, bodyEl);
      log.appendChild(sec);
    });
    card.appendChild(log);
    const btn = el("button", "btn btn-accent", "Got it");
    const close = () => { try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {} back.remove(); };
    btn.onclick = close;
    card.appendChild(btn);
    back.appendChild(card);
    back.onclick = (e) => { if (e.target === back) close(); };
    document.body.appendChild(back);
  }

  // ===== Build recap (shareable one-screen summary) =====
  // A compact node+link schematic (no background) cropped to the nodes' bounds.
  function miniGraphSvg(nodes, edges) {
    if (!nodes.length) return '<span class="rc-empty">none</span>';
    const pad = 30;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const minx = Math.min(...xs) - pad, miny = Math.min(...ys) - pad;
    const w = Math.max(...xs) + pad - minx, h = Math.max(...ys) + pad - miny;
    const rMin = w * 0.011, rBig = w * 0.016, rCore = w * 0.024, sw = w * 0.004;
    const lines = edges.map((e) => `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke-width="${(e.on ? sw * 1.5 : sw).toFixed(1)}" class="rc-edge${e.on ? " on" : ""}"/>`).join("");
    const circ = nodes.map((n) => {
      const r = n.core ? rCore : n.big ? rBig : rMin;
      return `<circle cx="${n.x}" cy="${n.y}" r="${r.toFixed(1)}" stroke-width="${(sw * 0.8).toFixed(1)}" class="rc-node${n.on ? " on" : ""}${n.core ? " core" : ""}"><title>${esc(n.name)}</title></circle>`;
    }).join("");
    return `<svg class="rc-svg" viewBox="${minx.toFixed(0)} ${miny.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid meet">${lines}${circ}</svg>`;
  }
  function recapBody() {
    const chips = (arr) => arr.length ? `<div class="rc-chips">${arr.map((x) => `<span class="rc-chip">${esc(x)}</span>`).join("")}</div>` : `<span class="rc-empty">—</span>`;
    const usedTree = state.tree.size - 1, ascTotal = Object.values(state.asc).reduce((a, b) => a + b, 0);

    // LEFT column: points first, then the two tree schematics, then short sections
    const left = [];
    left.push(`<div class="rc-sec"><h3>Points</h3>
      <div class="rc-line"><span>Class Tree</span><b>${usedTree}/${CLASS_POINTS}</b></div>
      <div class="rc-line"><span>PAX</span><b>${state.pax.size}/${PAX_POINTS}</b></div>
      <div class="rc-line"><span>Ascension</span><b>${ascTotal}/${ASC_TOTAL}</b></div></div>`);
    const tNodes = TREE.filter((n) => n.x != null).map((n) => { const c = nodeCenter(n); return { x: c.cx, y: c.cy, on: state.tree.has(n.id), core: n.kind === 2, big: n.kind === 1, name: n.name }; });
    const tEdges = []; const tseen = new Set();
    for (const n of TREE) {
      if (n.x == null) continue; const a = nodeCenter(n);
      for (const p of n.prereqs) { const pr = treeById[p]; if (!pr || pr.x == null) continue; const k = Math.min(n.id, p) + "-" + Math.max(n.id, p); if (tseen.has(k)) continue; tseen.add(k); const b = nodeCenter(pr); tEdges.push({ x1: a.cx, y1: a.cy, x2: b.cx, y2: b.cy, on: state.tree.has(n.id) && state.tree.has(p) }); }
    }
    left.push(`<div class="rc-sec"><h3>Class Tree <span class="rc-sub">${usedTree}/${CLASS_POINTS}</span></h3>${miniGraphSvg(tNodes, tEdges)}</div>`);

    const pNodes = [], pEdges = [];
    for (const br of PAXDATA.branches) {
      const prMap = paxPrereqMap(br), big = paxBigSet(br), byName = {};
      br.nodes.forEach((n) => (byName[n.name] = n));
      br.nodes.filter((n) => n.x != null).forEach((n) => pNodes.push({ x: n.x, y: n.y, on: state.pax.has(br.name + "::" + n.name), big: big.has(n.name), name: n.name }));
      const seen = new Set();
      for (const n of br.nodes) {
        if (n.x == null) continue;
        for (const pn of (prMap[n.name] || [])) { const p = byName[pn]; if (!p || p.x == null) continue; const k = [n.name, pn].sort().join("|"); if (seen.has(k)) continue; seen.add(k); pEdges.push({ x1: n.x, y1: n.y, x2: p.x, y2: p.y, on: state.pax.has(br.name + "::" + n.name) && state.pax.has(br.name + "::" + pn) }); }
      }
    }
    left.push(`<div class="rc-sec"><h3>PAX <span class="rc-sub">${state.pax.size}/${PAX_POINTS}</span></h3>${miniGraphSvg(pNodes, pEdges)}</div>`);

    // LEFT also gets the short text sections (Skills, Ascension) for balance
    const sk = [...state.skills].map((n) => { const s = SKILLS.find((x) => x.name === n); const ic = s && skillIcon(s); return `<span class="rc-skill">${ic ? `<img src="${ic}" alt="">` : ""}${esc(n)}</span>`; }).join("");
    left.push(`<div class="rc-sec"><h3>Active Skills</h3>${state.skills.size ? `<div class="rc-skills">${sk}</div>` : '<span class="rc-empty">none</span>'}</div>`);

    const asc = D.ascension.categories.map((cat) => {
      const lines = cat.nodes.filter((n) => state.asc[cat.name + "::" + n.name]).map((n) => `${n.name} +${ascValue(n, state.asc[cat.name + "::" + n.name])}${n.unit}`);
      return lines.length ? `<div class="rc-grp"><div class="rc-grp-h">${esc(cat.name)}</div>${chips(lines)}</div>` : "";
    }).join("");
    left.push(`<div class="rc-sec"><h3>Ascension</h3>${asc || '<span class="rc-empty">none</span>'}</div>`);

    // RIGHT column: the longer sections (gear, sets, stats)
    const right = [];
    const gearLine = (label, slot) => {
      const g = state.gear[slot]; if (!g.item) return "";
      const title = g.item === EPIC ? ("Epic " + [g.type, g.variant].filter(Boolean).join(" ")).trim() : g.item;
      const attrs = g.item === EPIC ? g.attrs.filter(Boolean) : ((findGearItem(slot, g.item) || {}).specialStats || []);
      const mods = modsOfSlot(slot);
      return `<div class="rc-gear"><div class="rc-gear-h"><span class="rc-slot">${esc(label)}</span> ${esc(title)}</div>${attrs.length ? `<div class="rc-gear-attrs">${attrs.map(esc).join(" · ")}</div>` : ""}${mods.length ? `<div class="rc-gear-mods">${mods.map(esc).join(" · ")}</div>` : ""}</div>`;
    };
    const gear = WEAPON_SLOTS.map((w) => gearLine(w.label, w.key)).join("") + ARMOR_SLOTS.map((s) => gearLine(s, s)).join("");
    right.push(`<div class="rc-sec"><h3>Gear</h3>${gear || '<span class="rc-empty">none</span>'}</div>`);

    const sets = equippedSets(), sn = Object.keys(sets);
    if (sn.length) right.push(`<div class="rc-sec"><h3>Set Bonuses</h3>${sn.map((n) => `<div class="rc-line"><span>${esc(n)}</span><b style="color:${sets[n].count >= 3 ? "var(--good)" : "var(--txt-faint)"}">${sets[n].count} pc${sets[n].count >= 3 ? " ✓" : ""}</b></div>`).join("")}</div>`);

    if (dupMods.size) right.push(`<div class="rc-sec"><h3 style="color:var(--bad)">⚠ Duplicate mods</h3>${chips([...dupMods])}</div>`);

    return `<div class="rc-col">${left.join("")}</div><div class="rc-col">${right.join("")}</div>`;
  }
  function openRecap() {
    const back = el("div", "modal-back");
    const card = el("div", "modal wide");
    card.innerHTML = `<div class="modal-head"><h2>Build recap</h2><span class="modal-ver">${esc(state.cls.toUpperCase())}</span></div><div class="recap-body">${recapBody()}</div>`;
    const actions = el("div", "recap-actions");
    const copyBtn = el("button", "btn btn-accent", "Copy recap link");
    copyBtn.onclick = async () => {
      writeHash();
      const url = location.origin + location.pathname + "?recap=1" + location.hash;
      copyBtn.disabled = true; copyBtn.textContent = "Shortening…";
      await copyLink(url);
      copyBtn.disabled = false; copyBtn.textContent = "Copied!";
      setTimeout(() => (copyBtn.textContent = "Copy recap link"), 1400);
    };
    const closeBtn = el("button", "btn btn-ghost", "Close");
    closeBtn.onclick = () => back.remove();
    actions.append(copyBtn, closeBtn);
    card.appendChild(actions);
    back.appendChild(card);
    back.onclick = (e) => { if (e.target === back) back.remove(); };
    document.body.appendChild(back);
  }

  // ===== Misc =====
  let toastTimer;
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = el("div", "toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }

  function init() {
    initTabs();
    document.addEventListener("click", () => document.querySelectorAll(".mp-pop:not(.hidden)").forEach((p) => p.classList.add("hidden")));
    $("#btn-reset").onclick = () => {
      state.tree = new Set([0]); state.pax = new Set(); state.asc = {}; state.skills = new Set(); state.gear = freshGear();
      render(); toast("Build reset");
    };
    $("#btn-share").onclick = async () => {
      writeHash();
      const btn = $("#btn-share"); const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Shortening…";
      const short = await copyLink(location.href);
      btn.disabled = false; btn.textContent = label;
      toast(short !== location.href ? "Short build link copied" : "Build link copied");
    };
    const wn = $("#btn-whatsnew"); if (wn) wn.onclick = () => openChangelog(true);
    const rc = $("#btn-recap"); if (rc) rc.onclick = openRecap;
    readHash();
    loadClass();
    $(".layout").classList.add("full-tree"); // Class Tree is the default tab
    render();
    if (new URLSearchParams(location.search).get("recap")) openRecap(); // shared recap link
    else openChangelog(false);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
