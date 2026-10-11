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


def build():
    raise SystemExit("build mode not written yet – run with MODE=samples")


if __name__ == "__main__":
    (samples if os.environ.get("MODE") == "samples" else build)()
