/* ============================================================
   Technomancer Build Planner — vanilla JS, no dependencies.
   Data is provided by data.js as window.OUTRIDERS_DATA.
   ============================================================ */
(() => {
  "use strict";
  const D = window.OUTRIDERS_DATA;

  // ---- Budgets (tweak freely) ----
  const CLASS_POINTS = 20;   // class tree points at max level
  const PAX_POINTS = 8;      // PAX points earnable in Worldslayer
  const ASC_TOTAL = D.ascension._meta.totalPoints; // 200
  const MAX_SKILLS = 3;
  const ARMOR_SLOTS = ["Headgear", "Upper Armor", "Lower Armor", "Gloves", "Footgear"];

  const CLASS_LIST = ["technomancer", "pyromancer", "trickster", "devastator"];

  // ---- State ----
  const state = {
    cls: "technomancer",      // active class
    tree: new Set([0]),       // node 0 (core) always on
    pax: new Set(),           // "Branch::NodeName"
    asc: {},                  // "Category::Node" -> points (universal, kept across classes)
    skills: new Set(),        // skill names
    weapon: "",               // weapon name (universal, kept across classes)
    armor: {},                // slot -> armor name
    mods: {},                 // gearKey -> chosen free mod name
  };

  // Class-specific data, refreshed by loadClass() whenever the class changes.
  let TREE = [], treeById = {}, BRANCHES = [], SKILLS = [], PAXDATA = { branches: [] }, ARMOR = [];
  function loadClass() {
    const c = D.classes[state.cls];
    TREE = c.skilltree.nodes;
    treeById = Object.fromEntries(TREE.map(n => [n.id, n]));
    BRANCHES = c.skilltree._meta.branches;
    SKILLS = c.skills.skills;
    PAXDATA = c.pax;
    ARMOR = c.armor;
  }

  // ---- Helpers ----
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pct = (v) => (Math.round(v * 10) / 10) + "%";
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ===== Skill tree logic =====
  function nodeAvailable(n) {
    if (n.id === 0) return true;
    if (n.prereqs.includes(0)) return true;
    return n.prereqs.some(p => state.tree.has(p));
  }
  // Remove selected nodes that lost support back to the core.
  function pruneTree() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...state.tree]) {
        if (id === 0) continue;
        const n = treeById[id];
        const supported = n.prereqs.includes(0) || n.prereqs.some(p => state.tree.has(p) && p !== id);
        if (!supported) { state.tree.delete(id); changed = true; }
      }
    }
  }
  function toggleTreeNode(id) {
    if (id === 0) return;
    if (state.tree.has(id)) {
      state.tree.delete(id);
      pruneTree();
    } else {
      if (state.tree.size - 1 >= CLASS_POINTS) return toast(`Class tree is capped at ${CLASS_POINTS} points`);
      if (!nodeAvailable(treeById[id])) return;
      state.tree.add(id);
    }
    render();
  }

  // ===== Stat aggregation =====
  function aggregateStats() {
    const map = {}; // stat -> percent
    const add = (stat, v) => { map[stat] = (map[stat] || 0) + v; };
    // tree numeric bonuses are fractions (0.08 => 8%)
    for (const id of state.tree) {
      for (const b of treeById[id].bonuses) if (typeof b.value === "number") add(b.stat, b.value * 100);
    }
    // ascension perPoint already in %
    for (const cat of D.ascension.categories) {
      for (const node of cat.nodes) {
        const pts = state.asc[cat.name + "::" + node.name] || 0;
        if (pts) add(node.stat, +(pts * node.perPoint).toFixed(2));
      }
    }
    return Object.entries(map).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  }

  // Active text effects (non-numeric) for the summary.
  function activeEffects() {
    const out = [];
    for (const id of state.tree) for (const b of treeById[id].bonuses) if (b.value == null) out.push({ src: "Tree", name: treeById[id].name, text: b.stat });
    for (const key of state.pax) { const [, name] = key.split("::"); out.push({ src: "PAX", name }); }
    return out;
  }

  function equippedSets() {
    const counts = {}; // setName -> {count, text}
    for (const slot of ARMOR_SLOTS) {
      const name = state.armor[slot]; if (!name) continue;
      const a = ARMOR.find(x => x.name === name);
      if (a && a.setBonus) {
        const setName = a.setBonus.split(":")[0].trim();
        counts[setName] = counts[setName] || { count: 0, text: a.setBonus };
        counts[setName].count++;
      }
    }
    return counts;
  }

  // ===== Class switching =====
  function switchClass(cls) {
    if (cls === state.cls || !CLASS_LIST.includes(cls)) return;
    state.cls = cls;
    // class-specific selections reset; ascension & weapon are universal and kept
    state.tree = new Set([0]);
    state.pax = new Set();
    state.skills = new Set();
    state.armor = {};
    delete state.mods["armor:Headgear"]; delete state.mods["armor:Upper Armor"];
    delete state.mods["armor:Lower Armor"]; delete state.mods["armor:Gloves"]; delete state.mods["armor:Footgear"];
    loadClass();
    render();
  }
  function renderClassSwitch() {
    const host = $("#class-switch");
    host.innerHTML = "";
    for (const cls of CLASS_LIST) {
      const b = el("button", "class-btn" + (cls === state.cls ? " active" : ""), cls);
      b.onclick = () => switchClass(cls);
      host.appendChild(b);
    }
    $("#brand-class").textContent = state.cls.toUpperCase();
  }

  // ===== Rendering =====
  function render() {
    renderClassSwitch();
    renderTree();
    renderPax();
    renderAscension();
    renderLoadout();
    renderSummary();
    writeHash();
  }

  function renderTree() {
    const panel = $("#panel-tree");
    panel.innerHTML = "";
    const used = state.tree.size - 1;
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>Class Tree</h2><div class="hint">Click connected nodes to spend points. Removing a node frees its dependents.</div>`));
    head.appendChild(el("div", "points-pill", `${used} / ${CLASS_POINTS} pts`));
    panel.appendChild(head);

    const wrap = el("div", "branches cols-3");
    // core node card on top of first column context — show it once above
    const core = el("div", null, "");
    for (const bName of BRANCHES) {
      const col = el("div", "branch");
      col.appendChild(el("div", "branch-head", bName));
      const nodes = TREE.filter(n => n.branch === bName).sort((a, b) => a.id - b.id);
      for (const n of nodes) {
        const sel = state.tree.has(n.id);
        const avail = sel || nodeAvailable(n);
        const btn = el("button", "node" + (sel ? " sel" : ""));
        if (!avail) btn.disabled = true;
        const bonus = n.bonuses.map(b => typeof b.value === "number" ? `${b.stat} +${pct(b.value * 100)}` : b.stat).join(" · ");
        btn.innerHTML = `<div class="node-name">${esc(n.name)}</div><div class="node-bonus">${esc(bonus)}</div>`;
        btn.onclick = () => toggleTreeNode(n.id);
        col.appendChild(btn);
      }
      wrap.appendChild(col);
    }
    panel.appendChild(wrap);
  }

  function renderPax() {
    const panel = $("#panel-pax");
    panel.innerHTML = "";
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>PAX Trees</h2><div class="hint">Two sub-class branches. Spend PAX points along a path.</div>`));
    head.appendChild(el("div", "points-pill", `${state.pax.size} / ${PAX_POINTS} pts`));
    panel.appendChild(head);

    const wrap = el("div", "branches cols-2");
    for (const branch of PAXDATA.branches) {
      const col = el("div", "branch");
      col.appendChild(el("div", "branch-head", branch.name));
      col.appendChild(el("div", "branch-theme", branch.theme));
      const paths = ["universal", "top", "middle", "bottom"];
      for (const p of paths) {
        const nodes = branch.nodes.filter(n => n.path === p);
        if (!nodes.length) continue;
        col.appendChild(el("div", "path-label", p === "universal" ? "Shared trunk" : p + " path"));
        for (const n of nodes) {
          const key = branch.name + "::" + n.name;
          const sel = state.pax.has(key);
          const btn = el("button", "node" + (sel ? " sel" : ""));
          btn.innerHTML = `<div class="node-name">${esc(n.name)}</div><div class="node-bonus">${esc(n.desc)}</div>`;
          btn.onclick = () => {
            if (sel) state.pax.delete(key);
            else { if (state.pax.size >= PAX_POINTS) return toast(`PAX is capped at ${PAX_POINTS} points`); state.pax.add(key); }
            render();
          };
          col.appendChild(btn);
        }
      }
      wrap.appendChild(col);
    }
    panel.appendChild(wrap);
  }

  function renderAscension() {
    const panel = $("#panel-ascension");
    panel.innerHTML = "";
    const total = Object.values(state.asc).reduce((a, b) => a + b, 0);
    const head = el("div", "section-head");
    head.appendChild(el("div", null, `<h2>Ascension</h2><div class="hint">Up to 10 points per node · 200 total at Ascension 200.</div>`));
    head.appendChild(el("div", "points-pill", `${total} / ${ASC_TOTAL} pts`));
    panel.appendChild(head);

    const cats = el("div", "asc-cats");
    for (const cat of D.ascension.categories) {
      const c = el("div", "asc-cat");
      c.appendChild(el("h3", null, cat.name));
      for (const node of cat.nodes) {
        const key = cat.name + "::" + node.name;
        const pts = state.asc[key] || 0;
        const cur = +(pts * node.perPoint).toFixed(2);
        const box = el("div", "asc-node");
        box.innerHTML = `<div class="asc-node-top"><span class="asc-node-name">${esc(node.name)}</span>
          <span class="asc-node-val">+${cur}${node.unit} / +${node.max}${node.unit}</span></div>`;
        const step = el("div", "stepper");
        const minus = el("button", null, "−"); minus.disabled = pts <= 0;
        const bar = el("div", "stepper-bar"); const fill = el("div", "stepper-fill"); fill.style.width = (pts / 10 * 100) + "%"; bar.appendChild(fill);
        const plus = el("button", null, "+"); plus.disabled = pts >= 10 || total >= ASC_TOTAL;
        const count = el("span", "stepper-count", `${pts}/10`);
        minus.onclick = () => { if (pts > 0) { state.asc[key] = pts - 1; if (!state.asc[key]) delete state.asc[key]; render(); } };
        plus.onclick = () => { if (pts < 10 && total < ASC_TOTAL) { state.asc[key] = pts + 1; render(); } };
        step.append(minus, bar, plus, count);
        box.appendChild(step);
        c.appendChild(box);
      }
      cats.appendChild(c);
    }
    panel.appendChild(cats);
  }

  function renderLoadout() {
    const panel = $("#panel-loadout");
    panel.innerHTML = "";

    // --- Active skills ---
    panel.appendChild(el("div", "section-head", `<div><h2>Active Skills</h2><div class="hint">Pick up to ${MAX_SKILLS}.</div></div>`));
    const skWrap = el("div", "skills-pick");
    for (const s of SKILLS) {
      const sel = state.skills.has(s.name);
      const card = el("button", "skill-card" + (sel ? " sel" : ""));
      card.innerHTML = `<div class="sk-name">${esc(s.name)}</div><div class="sk-desc">${esc(s.desc)}</div>`;
      card.onclick = () => {
        if (sel) state.skills.delete(s.name);
        else { if (state.skills.size >= MAX_SKILLS) return toast(`Max ${MAX_SKILLS} active skills`); state.skills.add(s.name); }
        render();
      };
      skWrap.appendChild(card);
    }
    panel.appendChild(skWrap);

    // --- Gear ---
    panel.appendChild(el("div", "section-head", `<div style="margin-top:18px"><h2>Gear</h2><div class="hint">Equip legendaries · each gets one free mod slot.</div></div>`));
    const grid = el("div", "loadout-grid");

    // Weapon
    grid.appendChild(gearSlotEl("Weapon", "weapon", D.weapons, state.weapon, (a) => weaponDetail(a)));
    // Armor
    for (const slot of ARMOR_SLOTS) {
      const opts = ARMOR.filter(a => a.slot === slot);
      grid.appendChild(gearSlotEl(slot, "armor:" + slot, opts, state.armor[slot] || "", (a) => armorDetail(a), slot));
    }
    panel.appendChild(grid);
  }

  function gearSlotEl(label, key, options, current, detailFn, armorSlot) {
    const slot = el("div", "gear-slot");
    const head = el("div", "gear-slot-head");
    head.appendChild(el("span", "gear-slot-label", label));
    slot.appendChild(head);

    const sel = el("select", "gear-select");
    sel.appendChild(new Option("— empty —", ""));
    for (const o of options) { const opt = new Option(o.name, o.name); if (o.name === current) opt.selected = true; sel.appendChild(opt); }
    sel.onchange = () => {
      const v = sel.value;
      if (key === "weapon") state.weapon = v;
      else state.armor[armorSlot] = v;
      render();
    };
    slot.appendChild(sel);

    const item = options.find(o => o.name === current);
    if (item) {
      slot.appendChild(detailFn(item));
      // free mod slot
      const scope = key === "weapon" ? "weapon" : "armor";
      const modSel = el("select", "gear-select"); modSel.style.marginTop = "8px";
      modSel.appendChild(new Option("+ free mod slot —", ""));
      for (const m of D.mods.filter(m => m.scope === scope)) {
        const opt = new Option(`[T${m.tier}] ${m.name}`, m.name);
        if (state.mods[key] === m.name) opt.selected = true;
        modSel.appendChild(opt);
      }
      modSel.onchange = () => { state.mods[key] = modSel.value; render(); };
      slot.appendChild(modSel);
    }
    return slot;
  }

  function weaponDetail(w) {
    const d = el("div", "gear-detail");
    const rows = [["Type", w.type], ["Variant", w.variant], ["RPM", w.rpm], ["Mag", w.clip], ["Crit", w.critMulti]];
    d.innerHTML = rows.filter(r => r[1] != null).map(r => `<div class="row"><span class="k">${r[0]}</span><span>${esc(r[1])}</span></div>`).join("");
    if (w.specialStats?.length) d.innerHTML += `<div>${w.specialStats.map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    if (w.factoryMods?.length) d.innerHTML += `<div>${w.factoryMods.map(m => `<span class="tag mod">${esc(m)}</span>`).join("")}</div>`;
    return d;
  }
  function armorDetail(a) {
    const d = el("div", "gear-detail");
    if (a.specialStats?.length) d.innerHTML += `<div>${a.specialStats.map(s => `<span class="tag">${esc(s)}</span>`).join("")}</div>`;
    if (a.factoryMods?.length) d.innerHTML += `<div>${a.factoryMods.map(m => `<span class="tag mod">${esc(m)}</span>`).join("")}</div>`;
    if (a.setBonus) d.innerHTML += `<div class="set-bonus-text">${esc(a.setBonus)}</div>`;
    return d;
  }

  function renderSummary() {
    const body = $("#summary-body");
    body.innerHTML = "";

    // points
    const usedTree = state.tree.size - 1;
    const ascTotal = Object.values(state.asc).reduce((a, b) => a + b, 0);
    const pts = el("div", "sum-section");
    pts.innerHTML = `<h3>Points</h3>
      <div class="budget-row"><span>Class Tree</span><b>${usedTree}/${CLASS_POINTS}</b></div>
      <div class="budget-row"><span>PAX</span><b>${state.pax.size}/${PAX_POINTS}</b></div>
      <div class="budget-row"><span>Ascension</span><b>${ascTotal}/${ASC_TOTAL}</b></div>`;
    body.appendChild(pts);

    // skills
    const sk = el("div", "sum-section");
    sk.innerHTML = `<h3>Active Skills</h3>`;
    const chips = el("div", "chip-list");
    if (state.skills.size) for (const s of state.skills) chips.appendChild(el("span", "chip on", esc(s)));
    else chips.appendChild(el("span", "empty-note", "none selected"));
    sk.appendChild(chips);
    body.appendChild(sk);

    // aggregated stats
    const stats = aggregateStats();
    const st = el("div", "sum-section");
    st.innerHTML = `<h3>Aggregated Stats</h3>`;
    if (stats.length) for (const [stat, v] of stats) {
      const line = el("div", "stat-line"); line.innerHTML = `<span>${esc(stat)}</span><span class="v">+${pct(v)}</span>`; st.appendChild(line);
    } else st.appendChild(el("div", "empty-note", "no numeric bonuses yet"));
    body.appendChild(st);

    // set bonuses
    const sets = equippedSets();
    const setNames = Object.keys(sets);
    if (setNames.length) {
      const se = el("div", "sum-section");
      se.innerHTML = `<h3>Set Bonuses</h3>`;
      for (const name of setNames) {
        const { count } = sets[name];
        const active = count >= 3;
        const line = el("div", "stat-line");
        line.innerHTML = `<span>${esc(name)}</span><span class="v" style="color:${active ? "var(--good)" : "var(--txt-faint)"}">${count} pc${active ? " ✓" : ""}</span>`;
        se.appendChild(line);
      }
      body.appendChild(se);
    }

    // equipped count
    const equippedArmor = ARMOR_SLOTS.filter(s => state.armor[s]).length;
    const eq = el("div", "sum-section");
    eq.innerHTML = `<h3>Equipped</h3>
      <div class="budget-row"><span>Weapon</span><b>${state.weapon ? "1" : "0"}/1</b></div>
      <div class="budget-row"><span>Armor</span><b>${equippedArmor}/5</b></div>`;
    body.appendChild(eq);

    // active effects count
    const fx = activeEffects();
    if (fx.length) {
      const ef = el("div", "sum-section");
      ef.innerHTML = `<h3>Active Effects (${fx.length})</h3>`;
      const cl = el("div", "chip-list");
      for (const f of fx.slice(0, 12)) cl.appendChild(el("span", "chip", `${esc(f.name)}`));
      if (fx.length > 12) cl.appendChild(el("span", "chip", `+${fx.length - 12} more`));
      ef.appendChild(cl);
      body.appendChild(ef);
    }
  }

  // ===== Tabs =====
  function initTabs() {
    $("#tabs").addEventListener("click", (e) => {
      const t = e.target.closest(".tab"); if (!t) return;
      document.querySelectorAll(".tab").forEach(x => x.classList.toggle("is-active", x === t));
      const name = t.dataset.tab;
      for (const p of ["tree", "pax", "ascension", "loadout"]) $("#panel-" + p).classList.toggle("hidden", p !== name);
    });
  }

  // ===== Share via URL hash =====
  function writeHash() {
    const payload = {
      c: state.cls, t: [...state.tree], p: [...state.pax], a: state.asc,
      s: [...state.skills], w: state.weapon, r: state.armor, m: state.mods,
    };
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    history.replaceState(null, "", "#" + enc);
  }
  function readHash() {
    if (!location.hash || location.hash.length < 2) return;
    try {
      const obj = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
      if (CLASS_LIST.includes(obj.c)) state.cls = obj.c;
      state.tree = new Set(obj.t || [0]); state.tree.add(0);
      state.pax = new Set(obj.p || []);
      state.asc = obj.a || {};
      state.skills = new Set(obj.s || []);
      state.weapon = obj.w || "";
      state.armor = obj.r || {};
      state.mods = obj.m || {};
    } catch (e) { console.warn("Bad build hash", e); }
  }

  let toastTimer;
  function toast(msg) {
    let t = $(".toast"); if (!t) { t = el("div", "toast"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
  }

  // ===== Init =====
  function init() {
    initTabs();
    $("#btn-reset").onclick = () => {
      state.tree = new Set([0]); state.pax = new Set(); state.asc = {};
      state.skills = new Set(); state.weapon = ""; state.armor = {}; state.mods = {};
      render(); toast("Build reset");
    };
    $("#btn-share").onclick = async () => {
      writeHash();
      const url = location.href;
      try { await navigator.clipboard.writeText(url); toast("Build link copied to clipboard"); }
      catch { toast("Copy failed — link is in the address bar"); }
    };
    readHash();
    loadClass();
    render();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
