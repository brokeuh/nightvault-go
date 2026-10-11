/* Nightvault GO – calculator core.
 * Works out IVs and level from what the Pokémon GO detail screen shows (species, CP, HP, power-up cost,
 * shiny/lucky/shadow, appraisal), applies keep rules and makes search strings.
 * Pure functions on data/pokemon.json. No network, no game access: read and advise only.
 * Usable in the browser (window.GoCalc) and in Node (require).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Appraisal stars → total of the three IVs (0–45)
  const STARS = [[0, 22], [23, 29], [30, 36], [37, 44], [45, 45]];
  const LEAGUES = { little: 500, great: 1500, ultra: 2500 };
  const REGION_SEARCH = { Alolan: "alola", Galarian: "galar", Hisuian: "hisui", Paldean: "paldea" };

  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/♀/g, " female").replace(/♂/g, " male").replace(/[^a-z0-9]+/g, " ").trim();
  }

  function create(data) {
    const byId = new Map(data.pokemon.map(p => [p.id, p]));
    const byName = new Map();
    for (const p of data.pokemon) {
      for (const key of [norm(p.name), p.form ? null : norm(p.base)]) if (key && !byName.has(key)) byName.set(key, p);
    }
    const levels = data.cpm.map((_, i) => 1 + i / 2);           // 1, 1.5, … buddyLevel
    const cpmAt = L => data.cpm[Math.round((L - 1) * 2)];
    const pvpCache = new Map();

    function species(idOrName, form) {
      if (byId.has(idOrName)) return byId.get(idOrName);
      const n = norm(idOrName);
      if (form) {
        const f = norm(form);
        const hit = data.pokemon.find(p => norm(p.base) === n && (norm(p.form) === f || norm(p.region) === f));
        if (hit) return hit;
      }
      return byName.get(n) || null;
    }

    /** All forms with this name (e.g. "Rattata" → normal + Alolan) – the screen does not always say which form. */
    function forms(name) {
      const n = norm(name);
      return data.pokemon.filter(p => norm(p.base) === n || norm(p.name) === n);
    }

    function cp(mon, iv, L) {
      const m = cpmAt(L);
      return Math.max(10, Math.floor((mon.atk + iv[0]) * Math.sqrt(mon.def + iv[1]) * Math.sqrt(mon.sta + iv[2]) * m * m / 10));
    }
    function hp(mon, iv, L) { return Math.max(10, Math.floor((mon.sta + iv[2]) * cpmAt(L))); }

    function multOf(o, candy) {
      let m = 1;
      if (o.shadow) m *= candy ? data.mult.shadowCandy : data.mult.shadow;
      if (o.purified) m *= candy ? data.mult.purifiedCandy : data.mult.purified;
      if (o.lucky && !candy) m *= data.mult.lucky;
      return m;
    }
    /** Stardust for one power-up at level L (null at max level). Same cost for L and L+0.5. */
    function dustCost(L, o = {}) {
      const base = data.dust[Math.floor(L) - 1];
      if (base == null || L >= data.maxLevel) return null;
      return Math.round(base * multOf(o, false));
    }
    /** Candy (or XL candy) for one power-up at level L. */
    function candyCost(L, o = {}) {
      if (L >= data.maxLevel) return null;
      if (L >= data.xlFrom) {
        const xl = data.xlCandy[Math.floor(L) - data.xlFrom];
        return xl == null ? null : { xl: Math.ceil(xl * multOf(o, true)) };
      }
      const c = data.candy[Math.floor(L) - 1];
      return c == null ? null : { candy: Math.ceil(c * multOf(o, true)) };
    }

    /**
     * Every IV + level combination that matches the screen.
     * s = { mon | species, form, cp, hp, dust, candy, xl, shadow, purified, lucky,
     *       stars (0–4), atk/def/sta ([lo,hi] from the appraisal bars), minIV, maxLevel }
     */
    function solve(s) {
      const mon = s.mon || species(s.species, s.form);
      if (!mon) return { mon: null, error: "unknown species", results: [] };
      const minIV = s.lucky ? Math.max(12, s.minIV || 0) : (s.minIV || 0);
      const maxL = s.maxLevel || data.buddyLevel;
      const sum = s.stars != null ? STARS[s.stars] : [0, 45];
      const rng = (r) => r ? [Math.max(minIV, r[0]), r[1]] : [minIV, 15];
      const [ra, rd, rs] = [rng(s.atk), rng(s.def), rng(s.sta)];
      const lvOk = levels.filter(L => L <= maxL && (s.dust == null || dustCost(L, s) === s.dust) && candyOk(L, s));
      const results = [];
      for (const L of lvOk) {
        const m = cpmAt(L);
        for (let a = ra[0]; a <= ra[1]; a++) for (let d = rd[0]; d <= rd[1]; d++) for (let t = rs[0]; t <= rs[1]; t++) {
          const tot = a + d + t;
          if (tot < sum[0] || tot > sum[1]) continue;
          if (s.hp != null && Math.max(10, Math.floor((mon.sta + t) * m)) !== s.hp) continue;
          const iv = [a, d, t];
          if (s.cp != null && cp(mon, iv, L) !== s.cp) continue;
          results.push({ level: L, iv, pct: Math.round(tot / 45 * 100), total: tot });
        }
      }
      return { mon, results, ...summary(results) };
    }
    function candyOk(L, s) {
      if (s.candy == null && s.xl == null) return true;
      const c = candyCost(L, s);
      if (!c) return false;
      return s.xl != null ? c.xl === s.xl : c.candy === s.candy;
    }
    function summary(r) {
      if (!r.length) return { count: 0, exact: false };
      const pcts = r.map(x => x.pct), lv = r.map(x => x.level);
      return { count: r.length, exact: r.length === 1, pctMin: Math.min(...pcts), pctMax: Math.max(...pcts),
        levelMin: Math.min(...lv), levelMax: Math.max(...lv) };
    }

    /** PvP: rank 1–4096 of these IVs in a league (by stat product at the best level under the CP cap). */
    function pvpTable(mon, cap, maxL) {
      const key = mon.id + "|" + cap + "|" + maxL;
      if (pvpCache.has(key)) return pvpCache.get(key);
      const lv = levels.filter(L => L <= maxL).reverse();
      const rows = [];
      for (let a = 0; a < 16; a++) for (let d = 0; d < 16; d++) for (let t = 0; t < 16; t++) {
        const iv = [a, d, t];
        let best = null;
        for (const L of lv) {
          const c = cp(mon, iv, L);
          if (c <= cap) {
            const m = cpmAt(L);
            const sp = (mon.atk + a) * m * (mon.def + d) * m * Math.max(10, Math.floor((mon.sta + t) * m));
            best = { level: L, cp: c, sp };
            break;
          }
        }
        rows.push({ iv, ...(best || { level: 1, cp: cp(mon, iv, 1), sp: 0 }) });
      }
      rows.sort((x, y) => y.sp - x.sp || y.cp - x.cp);
      const top = rows[0].sp || 1;
      const table = new Map();
      let rank = 0;                                              // equal stats → equal rank (e.g. 1, 1, 3)
      rows.forEach((r, i) => {
        if (i === 0 || Math.abs(r.sp - rows[i - 1].sp) > 1e-9) rank = i + 1;
        table.set(r.iv.join("/"), { rank, pct: Math.round(r.sp / top * 1000) / 10, level: r.level, cp: r.cp });
      });
      pvpCache.set(key, table);
      return table;
    }
    function pvpRank(mon, iv, league, maxL = data.maxLevel) {
      const cap = LEAGUES[league] || league;
      if (cp(mon, [0, 0, 0], 1) > cap) return null;           // never fits this league
      return pvpTable(mon, cap, maxL).get(iv.join("/"));
    }

    /**
     * Keep / transfer advice for a list of scanned Pokémon.
     * Each entry: { mon, cp, hp, shiny, lucky, shadow, purified, ...solve() result fields }.
     * A Pokémon is only TRANSFER when every IV combination that fits says so; mixed → CHECK (do an appraisal).
     */
    const DEFAULT_RULES = { shiny: true, lucky: true, legendary: true, mythical: true, ultrabeast: true, shadow: true,
      hundo: true, nundo: true, minPct: 0, bestPerSpecies: 1, pvp: { great: 0, ultra: 0, little: 0 }, unknown: "check" };

    function decide(entries, rulesIn) {
      const R = { ...DEFAULT_RULES, ...(rulesIn || {}), pvp: { ...DEFAULT_RULES.pvp, ...((rulesIn || {}).pvp || {}) } };
      const out = entries.map(e => ({ e, verdict: null, reasons: [] }));
      for (const o of out) {
        const e = o.e, m = e.mon;
        if (!m || !e.results || !e.results.length) { o.verdict = "CHECK"; o.reasons.push(m ? "no IVs fit – read again" : "unknown Pokémon"); continue; }
        const always = [];
        if (R.shiny && e.shiny) always.push("shiny");
        if (R.lucky && e.lucky) always.push("lucky");
        if (R.shadow && e.shadow) always.push("shadow");
        if (R.legendary && m.legendary) always.push("legendary");
        if (R.mythical && m.mythical) always.push("mythical");
        if (R.ultrabeast && m.ultrabeast) always.push("ultra beast");
        if (always.length) { o.verdict = "KEEP"; o.reasons.push(...always); continue; }
        // per IV combination: does a keep rule fire?
        let anyKeep = false, allKeep = true; const why = new Set();
        for (const r of e.results) {
          const k = [];
          if (R.hundo && r.total === 45) k.push("100%");
          if (R.nundo && r.total === 0) k.push("0%");
          if (R.minPct && r.pct >= R.minPct) k.push(`≥${R.minPct}%`);
          for (const lg of Object.keys(R.pvp)) {
            const n = R.pvp[lg]; if (!n) continue;
            const pr = pvpRank(m, r.iv, lg);
            if (pr && pr.rank <= n) k.push(`${lg} league #${pr.rank}`);
          }
          k.forEach(x => why.add(x));
          if (k.length) anyKeep = true; else allKeep = false;
        }
        if (anyKeep && allKeep) { o.verdict = "KEEP"; o.reasons.push(...why); }
        else if (anyKeep) { o.verdict = "CHECK"; o.reasons.push("maybe " + [...why].join(", ") + " – do an appraisal"); }
      }
      // best N per species (same form, shadow and normal separately)
      if (R.bestPerSpecies > 0) {
        const groups = new Map();
        for (const o of out) {
          if (o.verdict || !o.e.mon) continue;
          const k = o.e.mon.id + (o.e.shadow ? "|S" : "") + (o.e.purified ? "|P" : "");
          (groups.get(k) || groups.set(k, []).get(k)).push(o);
        }
        // Pokémon already kept (or to check) for another reason count as competition too
        for (const o of out) {
          if (!o.verdict || !o.e.mon || !o.e.results || !o.e.results.length) continue;
          const k = o.e.mon.id + (o.e.shadow ? "|S" : "") + (o.e.purified ? "|P" : "");
          if (groups.has(k)) groups.get(k).kept = (groups.get(k).kept || []).concat(o);
        }
        for (const [, g] of groups) {
          // rank everyone of this species (kept ones too); a kept Pokémon only takes a "best" slot when its IVs are better
          const est = o => (o.e.pctMin + o.e.pctMax) / 2;
          const all = g.concat(g.kept || []).sort((x, y) => est(y) - est(x) || y.e.cp - x.e.cp);
          const top = all.slice(0, R.bestPerSpecies);
          top.forEach(o => { if (!o.verdict) { o.verdict = "KEEP"; o.reasons.push(`best ${R.bestPerSpecies} of this species`); } });
          const bar = Math.min(...top.map(o => o.e.pctMin));
          for (const o of g) {
            if (!o.verdict && o.e.pctMax > bar) { o.verdict = "CHECK"; o.reasons.push("close to your best one – do an appraisal"); }
          }
        }
      }
      for (const o of out) if (!o.verdict) { o.verdict = "TRANSFER"; o.reasons.push(R.bestPerSpecies ? "you have a better one" : "no keep rule"); }
      return out.map(o => ({ ...o.e, verdict: o.verdict, reasons: o.reasons }));
    }

    /**
     * Pokémon GO search strings for the TRANSFER Pokémon: one per species/form/shadow state, e.g. "66&cp312,cp287&!shiny…".
     * A CP that a kept Pokémon of the same species also has is left out (listed in `manual`), so a search never picks a keeper.
     * The search can still find Pokémon that were not scanned – always look before you transfer.
     */
    function searchStrings(decided, opt = {}) {
      const perString = opt.perString || 25;
      const safety = "&!shiny&!lucky&!favorite&!legendary&!mythical&!4*";
      const groups = new Map(), keepCps = new Map(), manual = [];
      const keyOf = e => e.mon.dex + "|" + (e.shadow ? "S" : e.purified ? "P" : "N");
      for (const e of decided) {
        if (!e.mon) continue;
        if (e.verdict !== "TRANSFER") { const k = keyOf(e); (keepCps.get(k) || keepCps.set(k, new Set()).get(k)).add(e.cp); }
      }
      for (const e of decided) {
        if (!e.mon || e.verdict !== "TRANSFER") continue;
        if ((keepCps.get(keyOf(e)) || new Set()).has(e.cp)) { manual.push(e); continue; }
        const k = e.mon.id + "|" + (e.shadow ? "S" : e.purified ? "P" : "N");
        (groups.get(k) || groups.set(k, { e, cps: new Set() }).get(k)).cps.add(e.cp);
      }
      const strings = [];
      for (const [, g] of groups) {
        const m = g.e.mon;
        const sameDex = data.pokemon.filter(p => p.dex === m.dex);
        let who = String(m.dex);
        const reg = REGION_SEARCH[m.region];
        if (reg) who += "&" + reg;
        else for (const p of sameDex) if (REGION_SEARCH[p.region]) who += "&!" + REGION_SEARCH[p.region];
        who += g.e.shadow ? "&shadow" : g.e.purified ? "&purified" : "&!shadow&!purified";
        const cps = [...g.cps].sort((a, b) => b - a);
        for (let i = 0; i < cps.length; i += perString) {
          strings.push({ species: m.name, shadow: !!g.e.shadow, count: Math.min(perString, cps.length - i),
            text: who + "&" + cps.slice(i, i + perString).map(c => "cp" + c).join(",") + safety });
        }
      }
      return { strings, manual };
    }

    /** Short name for the clipboard (Pokémon GO names: max 12 characters), e.g. "98 15/14/15" or "G12 1/15/14" or "82-91%". */
    function nickname(e) {
      if (!e.results || !e.results.length) return "";
      if (e.results.length === 1) {
        const r = e.results[0], iv = r.iv.join("/");
        for (const lg of ["great", "ultra", "little"]) {
          const pr = e.mon && pvpRank(e.mon, r.iv, lg);
          if (pr && pr.rank <= 100) return (lg[0].toUpperCase() + pr.rank + " " + iv).slice(0, 12);
        }
        return (r.pct + " " + iv).slice(0, 12);
      }
      return e.pctMin === e.pctMax ? e.pctMin + "%" : `${e.pctMin}-${e.pctMax}%`;
    }

    return { data, species, forms, cp, hp, dustCost, candyCost, solve, pvpRank, decide, searchStrings, nickname,
      levels, STARS, LEAGUES, DEFAULT_RULES };
  }

  return { create, norm, STARS, LEAGUES };
});
