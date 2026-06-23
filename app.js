/* ============================================================
   Outriders Worldslayer — Build Planner (all 4 classes)
   Vanilla JS, no dependencies. Data from data.js (window.OUTRIDERS_DATA).
   ============================================================ */
(() => {
  "use strict";
  const D = window.OUTRIDERS_DATA;

  // ---- App version + changelog (drives the "What's new" popup) ----
  const APP_VERSION = "1.5.0";
  const CHANGELOG = [
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
  const SIDEARM_TYPES = ["Pistol", "Revolver", "Submachine Gun"];
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
  const blankGear = () => ({ item: "", mods: [], attrs: [], type: "", variant: "" });
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

  // Ascension nodes fill to their max over 10 points (the per-point figures in
  // the source are unreliable), so value scales linearly to max at 10/10.
  const ascValue = (node, pts) => +((pts / 10) * node.max).toFixed(2);

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
        if (it) (it.factoryMods || []).forEach((m) => out.push({ name: m, detail: modDesc(m) }));
        g.mods.filter(Boolean).forEach((m) => out.push({ name: m, detail: modDesc(m) }));
      }
    }
    return out;
  }
  function equippedSets() {
    const counts = {};
    for (const slot of ARMOR_SLOTS) {
      const g = state.gear[slot];
      if (!g.item || g.item === EPIC) continue;
      const a = ARMOR.find((x) => x.name === g.item);
      if (a && a.setBonus) {
        const setName = a.setBonus.split(":")[0].trim();
        counts[setName] = counts[setName] || { count: 0 };
        counts[setName].count++;
      }
    }
    return counts;
  }

  // ===== Render =====
  function render() {
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

    const sel = el("select", "gear-select");
    sel.appendChild(new Option("— empty —", ""));
    const epicOpt = new Option("✦ Epic (custom)", EPIC); if (g.item === EPIC) epicOpt.selected = true; sel.appendChild(epicOpt);
    for (const o of options) { const opt = new Option(o.name, o.name); if (o.name === g.item) opt.selected = true; sel.appendChild(opt); }
    sel.onchange = () => { g.item = sel.value; g.mods = []; g.attrs = []; g.type = ""; g.variant = ""; render(); };
    slot.appendChild(sel);

    if (g.item === EPIC) {
      slot.appendChild(epicEditor(g, scope, weaponSlot));
    } else if (g.item) {
      const item = findGearItem(slotKey, g.item);
      if (item) {
        slot.appendChild(scope === "weapon" ? weaponDetail(item) : armorDetail(item));
        slot.appendChild(modSelect(g, 0, scope, "+ free mod slot"));
      }
    }
    return slot;
  }

  function epicEditor(g, scope, weaponSlot) {
    const box = el("div", "epic-editor");
    if (scope === "weapon") {
      box.appendChild(el("div", "epic-label", "Weapon"));
      const typeSel = el("select", "gear-select sm");
      typeSel.appendChild(new Option("— type —", ""));
      for (const t of typesFor(weaponSlot ? weaponSlot.sidearm : false)) { const o = new Option(t, t); if (g.type === t) o.selected = true; typeSel.appendChild(o); }
      typeSel.onchange = () => {
        g.type = typeSel.value;
        if (!(VARIANTS_BY_TYPE[g.type] || []).includes(g.variant)) g.variant = ""; // variant must match the type
        render();
      };
      box.appendChild(typeSel);
      const varList = g.type ? (VARIANTS_BY_TYPE[g.type] || []) : [];
      const varSel = el("select", "gear-select sm");
      varSel.appendChild(new Option(g.type ? "— variant —" : "— pick a type first —", ""));
      varSel.disabled = !g.type;
      for (const v of varList) { const o = new Option(v, v); if (g.variant === v) o.selected = true; varSel.appendChild(o); }
      varSel.onchange = () => { g.variant = varSel.value; render(); };
      box.appendChild(varSel);
    }
    const pool = scope === "weapon" ? weaponAttrPool() : armorAttrPool();
    box.appendChild(el("div", "epic-label", "Attributes"));
    for (let i = 0; i < EPIC_ATTRS; i++) {
      const s = el("select", "gear-select sm");
      s.appendChild(new Option("— attribute —", ""));
      for (const a of pool) { const o = new Option(a, a); if (g.attrs[i] === a) o.selected = true; s.appendChild(o); }
      s.onchange = () => { g.attrs[i] = s.value; render(); };
      box.appendChild(s);
    }
    box.appendChild(el("div", "epic-label", "Mods"));
    for (let i = 0; i < EPIC_MODS; i++) box.appendChild(modSelect(g, i, scope, "— mod —"));
    return box;
  }

  function modSelect(g, i, scope, placeholder) {
    const s = el("select", "gear-select sm");
    s.appendChild(new Option(placeholder, ""));
    for (const m of modsForScope(scope)) { const o = new Option(`[T${m.tier}] ${m.name}`, m.name); if (g.mods[i] === m.name) o.selected = true; s.appendChild(o); }
    s.onchange = () => { g.mods[i] = s.value; render(); };
    return s;
  }

  function weaponDetail(w) {
    const d = el("div", "gear-detail");
    const rows = [["Type", w.type], ["Variant", w.variant], ["RPM", w.rpm], ["Mag", w.clip], ["Crit", w.critMulti]];
    d.innerHTML = rows.filter((r) => r[1] != null).map((r) => `<div class="row"><span class="k">${r[0]}</span><span>${esc(r[1])}</span></div>`).join("");
    if (w.specialStats?.length) d.innerHTML += `<div>${w.specialStats.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    if (w.factoryMods?.length) d.innerHTML += `<div>${w.factoryMods.map((m) => `<span class="tag mod">${esc(m)}</span>`).join("")}</div>`;
    return d;
  }
  function armorDetail(a) {
    const d = el("div", "gear-detail");
    if (a.specialStats?.length) d.innerHTML += `<div>${a.specialStats.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    if (a.factoryMods?.length) d.innerHTML += `<div>${a.factoryMods.map((m) => `<span class="tag mod">${esc(m)}</span>`).join("")}</div>`;
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

  // ===== Share via URL hash =====
  function writeHash() {
    const payload = { c: state.cls, t: [...state.tree], p: [...state.pax], a: state.asc, s: [...state.skills], g: state.gear };
    history.replaceState(null, "", "#" + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
  }
  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
      if (CLASS_LIST.includes(o.c)) state.cls = o.c;
      state.tree = new Set(o.t || [0]); state.tree.add(0);
      state.pax = new Set(o.p || []);
      state.asc = o.a || {};
      state.skills = new Set(o.s || []);
      const g = freshGear();
      if (o.g) for (const k of Object.keys(g)) if (o.g[k]) g[k] = { item: o.g[k].item || "", mods: o.g[k].mods || [], attrs: o.g[k].attrs || [], type: o.g[k].type || "", variant: o.g[k].variant || "" };
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
    for (const entry of CHANGELOG.slice(0, force ? CHANGELOG.length : 1)) {
      const sec = el("div", "cl-entry");
      sec.innerHTML = `<div class="cl-ver">v${entry.version} · ${entry.date} — ${esc(entry.title)}</div>`;
      const ul = el("ul", "cl-list");
      for (const it of entry.items) ul.appendChild(el("li", null, esc(it)));
      sec.appendChild(ul); card.appendChild(sec);
    }
    const btn = el("button", "btn btn-accent", "Got it");
    const close = () => { try { localStorage.setItem(SEEN_KEY, APP_VERSION); } catch {} back.remove(); };
    btn.onclick = close;
    card.appendChild(btn);
    back.appendChild(card);
    back.onclick = (e) => { if (e.target === back) close(); };
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
    $("#btn-reset").onclick = () => {
      state.tree = new Set([0]); state.pax = new Set(); state.asc = {}; state.skills = new Set(); state.gear = freshGear();
      render(); toast("Build reset");
    };
    $("#btn-share").onclick = async () => {
      writeHash();
      try { await navigator.clipboard.writeText(location.href); toast("Build link copied to clipboard"); }
      catch { toast("Copy failed — link is in the address bar"); }
    };
    const wn = $("#btn-whatsnew"); if (wn) wn.onclick = () => openChangelog(true);
    readHash();
    loadClass();
    $(".layout").classList.add("full-tree"); // Class Tree is the default tab
    render();
    openChangelog(false);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
