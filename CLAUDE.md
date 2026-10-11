# Nightvault GO – instructions for every chat

Owner: Jochem (GitHub **brokeuh**, Brussels). Explain things in plain, friendly words. The full Nightvault handover notes are in the
private repo `brokeuh/nightvault-src` (HANDOVER.md, section "Nightvault GO") – attach it too.

Rules:
- **Read and advise only.** Never tap, swipe, automate or modify Pokémon GO, never read its memory or network traffic (that is botting → bans).
  The app only reads the screen (MediaProjection screenshots + text recognition) and shows advice.
- Never recreate official logos, artwork or trademarks.
- Everything revertable: before a push that changes the app, push the previous `origin/main` to `before-<feature>`.
- Commit as `brokeuh <jochem_petit@msn.com>` with the session's attribution lines.
- Owner's game language: English.
- `node test/gocalc.test.js` must pass before pushing. The sandbox cannot reach the data websites; GitHub workflows can
  (`game-data.yml` mode `samples` writes to branch `samples`, readable with `git fetch origin samples:refs/remotes/origin/samples`).
  `gh` GraphQL is blocked: use `gh api` (REST), e.g. `gh api -X POST repos/brokeuh/nightvault-go/actions/workflows/game-data.yml/dispatches -f ref=main`.

Calculator facts (`app/core/gocalc.js`):
- CP = max(10, ⌊(A+a)·√(D+d)·√(S+s)·cpm²/10⌋), HP = max(10, ⌊(S+s)·cpm⌋). `data.cpm[(level-1)*2]`, half levels = √((c₁²+c₂²)/2).
- Stardust for a power-up at level L = `dust[⌊L⌋-1]` × shadow 1.2 / purified 0.9 / lucky 0.5. Candy the same way; XL candy from level 40.
- Appraisal stars → IV total: 0★ 0–22, 1★ 23–29, 2★ 30–36, 3★ 37–44, 4★ 45. Lucky → every IV ≥ 12.
- PvP rank by stat product (atk·def·⌊hp⌋) at the highest level under the cap; equal stats share a rank.
- Advice is cautious: TRANSFER only when every IV combination that fits agrees; otherwise CHECK (do an appraisal).
- Search strings: in Pokémon GO `,` (OR) binds tighter than `&` (AND). A CP that a kept Pokémon of the same species also has is left
  out (listed as `manual`). Region forms use `alola`/`galar`/`hisui`/`paldea` – check these words in the owner's game once.
