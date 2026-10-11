# Nightvault GO

A helper app for Pokémon GO on Android, part of the Nightvault family. **Read and advise only:** it looks at your screen
and tells you what to keep. It never taps, swipes or does anything inside the game.

Planned:
1. **Scan** – you swipe through your Pokémon; a small overlay reads species, CP, HP, power-up cost, shiny/lucky/shadow and appraisal.
2. **Work out** – IVs, level and PvP rank for each one, then your keep rules (shiny, lucky, legendary, best N per species, PvP…).
3. **Advise** – KEEP / TRANSFER / CHECK on screen, a short name on the clipboard, and search strings you paste into
   Pokémon GO to find the ones to transfer (for example `66&!shadow&!purified&cp649,cp584&!shiny&!lucky&!favorite&!legendary&!mythical&!4*`).

## What is here now

| Path | What it is |
|---|---|
| `data/pokemon.json` | Game data: base stats of every Pokémon/form, CP multiplier per level, stardust and candy costs. Updated every Monday. |
| `tools/game_data.py` | Builds that file from PvPoke's gamemaster and PokeMiners' game master (run by the workflow). |
| `app/core/gocalc.js` | The calculator: IVs/level from the screen values, PvP ranks, keep/transfer advice, search strings, nicknames. |
| `test/gocalc.test.js` | Tests (`node test/gocalc.test.js`), also run on GitHub after every push. |
| `.github/workflows/` | `game-data.yml` (weekly data; mode `samples` saves a peek at the sources to branch `samples`), `tests.yml`. |

Still to come: the Android app (Capacitor, own appId `be.brokeuh.nightvaultgo`, built from the Nightvault Pocket setup), the screen reader
(needs real screenshots), and the overlay.

Game data comes from the community projects [PvPoke](https://github.com/pvpoke/pvpoke) and
[PokeMiners](https://github.com/PokeMiners/game_masters). Pokémon and Pokémon GO are trademarks of their owners; this is an unofficial
personal tool and uses no official logos or artwork.
