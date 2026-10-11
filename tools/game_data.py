"""Builds data/pokemon.json for Nightvault GO from public game data (run by .github/workflows/game-data.yml).

MODE=samples only prints what the sources look like (used while writing this script);
MODE=build (default) writes the file.
"""
import json, os, sys, time, urllib.request

PVPOKE = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.min.json"
MINERS = "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json"
UA = {"User-Agent": "nightvault-go (personal Pokemon GO helper, once a week)"}


def get(url, tries=3):
    for a in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                return json.load(r)
        except Exception:
            if a == tries - 1:
                raise
            time.sleep(10 * (a + 1))


def short(x, n=1500):
    s = json.dumps(x, ensure_ascii=False)
    return s if len(s) <= n else s[:n] + " …"


def samples():
    pv = get(PVPOKE)
    print("PVPOKE top keys:", list(pv) if isinstance(pv, dict) else type(pv))
    if isinstance(pv, dict):
        for k, v in pv.items():
            print(f"  {k}: {type(v).__name__} len={len(v) if hasattr(v, '__len__') else '-'}")
        print("settings:", short(pv.get("settings"), 3000))
        mons = pv.get("pokemon") or []
        for want in ("bulbasaur", "machop", "rattata_alolan", "mewtwo", "mewtwo_shadow", "darmanitan_galarian_standard", "pikachu"):
            m = next((p for p in mons if p.get("speciesId") == want), None)
            print(f"MON {want}:", short(m))
        print("all keys seen in pokemon:", sorted({k for p in mons for k in p}))
        print("all tags:", sorted({t for p in mons for t in p.get("tags", [])}))
    gm = get(MINERS)
    print("MINERS type:", type(gm).__name__, "len", len(gm))
    for t in gm:
        tid = t.get("templateId", "")
        if tid in ("PLAYER_LEVEL_SETTINGS", "POKEMON_UPGRADE_SETTINGS") or tid.startswith("V0066_POKEMON_MACHOP"):
            print("TEMPLATE", tid, short(t, 4000))
    print("some templateIds:", [t.get("templateId") for t in gm[:15]])


REGION_TAGS = {"alolan": "Alolan", "galarian": "Galarian", "hisuian": "Hisuian", "paldean": "Paldean"}
SKIP_TAGS = {"shadow", "mega", "supermega"}          # shadow = same stats (a flag on the scanned Pokémon); megas are temporary


def build():
    pv = get(PVPOKE)
    gm = get(MINERS)
    tpl = {t.get("templateId"): t.get("data", {}) for t in gm}
    lvl = tpl["PLAYER_LEVEL_SETTINGS"]["playerLevel"]
    up = tpl["POKEMON_UPGRADE_SETTINGS"]["pokemonUpgrades"]
    whole = lvl["cpMultiplier"]                     # index 0 = level 1, whole levels only
    max_level = int(up.get("maxNormalUpgradeLevel", 50))
    top = max_level + 1                              # level 51 = best buddy
    cpm = []                                         # index (level - 1) * 2, half levels included
    for L in range(1, top + 1):
        cpm.append(round(whole[L - 1], 10))
        if L < top:
            a, b = whole[L - 1], whole[L]
            cpm.append(round(((a * a + b * b) / 2) ** 0.5, 10))
    mons = []
    for p in pv["pokemon"]:
        tags = set(p.get("tags") or [])
        if tags & SKIP_TAGS:
            continue
        bs = p["baseStats"]
        name = p["speciesName"]
        base, _, rest = name.partition(" (")
        form = rest.rstrip(")") if rest else ""
        region = next((REGION_TAGS[t] for t in tags if t in REGION_TAGS), "")
        mons.append({
            "id": p["speciesId"], "dex": p["dex"], "name": name, "base": base, "form": form, "region": region,
            "atk": bs["atk"], "def": bs["def"], "sta": bs["hp"],
            "legendary": "legendary" in tags, "mythical": "mythical" in tags, "ultrabeast": "ultrabeast" in tags,
            "shadowEligible": "shadoweligible" in tags, "released": bool(p.get("released")),
            "family": (p.get("family") or {}).get("id", ""),
            "levelFloor": p.get("levelFloor"),
        })
    mons.sort(key=lambda m: (m["dex"], m["form"] != "", m["id"]))
    out = {
        "about": "Pokémon GO game data for Nightvault GO. Built weekly from PvPoke's gamemaster and PokeMiners' game master.",
        "updated": pv.get("timestamp", ""),
        "maxLevel": max_level, "buddyLevel": top,
        "cpm": cpm,
        "dust": up["stardustCost"],                  # cost per power-up at level L (and L+0.5): dust[floor(L) - 1]
        "candy": up["candyCost"],                    # same indexing; 0 from level 40 (XL candy instead)
        "xlCandy": up.get("xlCandyCost", []), "xlFrom": up.get("xlCandyMinPokemonLevel", 40),
        "mult": {"shadow": up.get("shadowStardustMultiplier", 1.2), "purified": up.get("purifiedStardustMultiplier", 0.9),
                 "shadowCandy": up.get("shadowCandyMultiplier", 1.2), "purifiedCandy": up.get("purifiedCandyMultiplier", 0.9),
                 "lucky": 0.5},
        "pokemon": mons,
    }
    os.makedirs("data", exist_ok=True)
    with open("data/pokemon.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote data/pokemon.json: {len(mons)} Pokémon/forms, levels 1-{top}")


if __name__ == "__main__":
    (samples if os.environ.get("MODE") == "samples" else build)()
