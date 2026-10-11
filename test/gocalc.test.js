// Tests for app/core/gocalc.js. Run: node test/gocalc.test.js
const assert = require("assert");
const path = require("path");
const GoCalc = require("../app/core/gocalc.js");
const data = require(path.join(__dirname, "../data/pokemon.json"));
const G = GoCalc.create(data);

let n = 0;
function t(name, fn) { fn(); n++; console.log("ok -", name); }

const mewtwo = G.species("Mewtwo"), dialga = G.species("Dialga"), groudon = G.species("Groudon");

t("known CPs of 100% legendaries (raid L20, boosted L25, L40, L50)", () => {
  const H = [15, 15, 15];
  assert.strictEqual(G.cp(mewtwo, H, 20), 2387);
  assert.strictEqual(G.cp(mewtwo, H, 25), 2984);
  assert.strictEqual(G.cp(mewtwo, H, 40), 4178);
  assert.strictEqual(G.cp(mewtwo, H, 50), 4724);
  assert.strictEqual(G.cp(dialga, H, 20), 2307);
  assert.strictEqual(G.cp(groudon, H, 20), 2351);
  assert.strictEqual(G.hp(mewtwo, H, 40), 180);
});

t("stardust and candy costs", () => {
  assert.strictEqual(G.dustCost(1), 200);
  assert.strictEqual(G.dustCost(20), 2500);
  assert.strictEqual(G.dustCost(20.5), 2500);
  assert.strictEqual(G.dustCost(20, { lucky: true }), 1250);
  assert.strictEqual(G.dustCost(20, { shadow: true }), 3000);
  assert.strictEqual(G.dustCost(20, { purified: true }), 2250);
  assert.strictEqual(G.dustCost(50), null);
  assert.deepStrictEqual(G.candyCost(40), { xl: 10 });
  assert.deepStrictEqual(G.candyCost(30), { candy: 4 });
  assert.deepStrictEqual(G.candyCost(31), { candy: 6 });
});

t("finding forms by name", () => {
  assert.strictEqual(G.species("Rattata", "Alolan").id, "rattata_alolan");
  assert.strictEqual(G.species("rattata").id, "rattata");
  assert.ok(G.forms("Rattata").length >= 2);
  assert.ok(G.species("Nidoran♀"), "Nidoran female");
  assert.ok(G.species("Mr. Mime"));
});

t("solve finds the true IVs back (2000 random Pokémon)", () => {
  let seed = 7; const rnd = k => (seed = (seed * 1103515245 + 12345) % 2147483648) % k;
  const mons = data.pokemon.filter(p => p.released);
  let exact = 0;
  for (let i = 0; i < 2000; i++) {
    const mon = mons[rnd(mons.length)], iv = [rnd(16), rnd(16), rnd(16)], L = 1 + rnd(98) / 2;
    const r = G.solve({ mon, cp: G.cp(mon, iv, L), hp: G.hp(mon, iv, L), dust: G.dustCost(L) });
    assert.ok(r.results.some(x => x.level === L && x.iv.join() === iv.join()), `${mon.id} ${iv} L${L}`);
    // with the stars from the appraisal it gets tighter
    const tot = iv[0] + iv[1] + iv[2], stars = GoCalc.STARS.findIndex(s => tot >= s[0] && tot <= s[1]);
    const r2 = G.solve({ mon, cp: G.cp(mon, iv, L), hp: G.hp(mon, iv, L), dust: G.dustCost(L), stars, atk: [iv[0], iv[0]] });
    assert.ok(r2.count <= r.count && r2.count >= 1);
    if (r.exact) exact++;
  }
  console.log(`   (${exact} of 2000 exact from CP + HP + stardust alone)`);
});

t("lucky means every IV is at least 12", () => {
  const mon = G.species("Machop"), iv = [13, 12, 14];
  const r = G.solve({ mon, cp: G.cp(mon, iv, 25), hp: G.hp(mon, iv, 25), dust: G.dustCost(25, { lucky: true }), lucky: true });
  assert.ok(r.count >= 1 && r.results.every(x => x.iv.every(v => v >= 12)));
});

t("great league rank: a Pokémon that never reaches 1500 CP has its 100% at rank 1", () => {
  const pika = G.species("Pikachu");
  assert.ok(G.cp(pika, [15, 15, 15], 50) <= 1500);
  assert.strictEqual(G.pvpRank(pika, [15, 15, 15], "great").rank, 1);
  assert.ok(G.pvpRank(pika, [0, 0, 0], "great").rank > 4000);
  assert.strictEqual(G.pvpRank(pika, [15, 15, 14], "great").rank, 1);   // same HP and stats as 15/15/15: a tie
  const med = G.species("Medicham"), r1 = G.pvpRank(med, [7, 15, 15], "great");
  assert.ok(r1.rank < G.pvpRank(med, [15, 15, 15], "great").rank && r1.cp <= 1500);   // lower attack wins under a CP cap
  const r = G.pvpRank(G.species("Azumarill"), [15, 15, 15], "great");
  assert.ok(r.rank > 100 && r.cp <= 1500);
});

function scan(name, iv, L, extra = {}) {
  const mon = G.species(name);
  const o = { mon, cp: G.cp(mon, iv, L), hp: G.hp(mon, iv, L), dust: G.dustCost(L, extra), ...extra };
  return { ...o, ...G.solve(o) };
}

t("keep / transfer advice", () => {
  const list = [
    scan("Machop", [15, 14, 15], 20),
    scan("Machop", [3, 5, 2], 20),
    scan("Machop", [7, 4, 9], 18),
    scan("Machop", [1, 2, 3], 15, { shiny: true }),
    scan("Mewtwo", [2, 2, 2], 20),
    scan("Machop", [6, 6, 6], 10, { shadow: true }),
  ];
  for (const e of list) { e.stars = null; }
  const d = G.decide(list, { bestPerSpecies: 1 });
  const v = d.map(x => x.verdict);
  assert.strictEqual(v[3], "KEEP");     // shiny
  assert.strictEqual(v[4], "KEEP");     // legendary
  assert.strictEqual(v[5], "KEEP");     // shadow
  assert.notStrictEqual(v[0], "TRANSFER");
  assert.ok(v.slice(0, 3).filter(x => x === "TRANSFER").length >= 1);
});

t("search strings never include a keeper's CP", () => {
  const d = G.decide([scan("Machop", [15, 15, 14], 20), scan("Machop", [0, 1, 0], 20), scan("Machop", [2, 0, 1], 22),
    scan("Rattata", [3, 3, 3], 10, { shadow: false }), scan("Rattata", [15, 15, 15], 10)], { bestPerSpecies: 1 });
  const { strings, manual } = G.searchStrings(d);
  const keep = d.filter(x => x.verdict !== "TRANSFER").map(x => x.mon.dex + "|" + x.cp);
  for (const s of strings) {
    assert.ok(/^\d+&/.test(s.text) && s.text.includes("&!favorite"));
    const dex = s.text.split("&")[0];
    for (const m of s.text.matchAll(/cp(\d+)/g)) assert.ok(!keep.includes(dex + "|" + m[1]));
  }
  const rat = strings.find(s => s.species === "Rattata");
  assert.ok(rat && rat.text.includes("&!alola"), "normal Rattata search must exclude Alolan ones");
  assert.ok(Array.isArray(manual));
  console.log("   e.g.", strings[0].text);
});

t("nicknames fit in 12 characters", () => {
  const e = scan("Machop", [15, 14, 15], 20);
  for (const x of [e, scan("Medicham", [15, 15, 15], 30), scan("Mewtwo", [0, 0, 0], 40)]) {
    assert.ok(G.nickname(x).length <= 12, G.nickname(x));
  }
  console.log("   e.g.", G.nickname(e), "/", G.nickname(scan("Medicham", [15, 15, 15], 30)));
});

console.log(`\n${n} tests passed`);
