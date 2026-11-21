# Island Settlers: "How to Play" Video Plan

## Strategy: teach in layers, not all at once
The game has a lot of rules. A new player gets lost if they hear everything in one go.
So: **one 6-8 minute "Learn in 5 minutes" video**, then **short optional follow-ups** for the advanced stuff.

Golden rule for every scene: **say one idea, show it on screen, then move on.**
Record the game with `http://localhost:5173/?quick=3&seed=123` so the board is the same every take.

---

## VIDEO 1: "Learn Island Settlers in 5 minutes" (~6-8 min)

### Scene 1 - The goal (0:00-0:30)
**Screen:** Main menu, then the board, then the score in the top bar.
**Say:** "You are settlers on a new island. Build roads, settlements and cities. The first player to reach **10 victory points** on their own turn wins."
**On-screen text:** `First to 10 points wins`

### Scene 2 - The board (0:30-1:15)
**Screen:** Orbit the camera slowly. Hover a hex to show the tooltip (what it produces and how often).
**Say:** "The island is made of hexes. Each hex makes one resource: forest gives wood, hills give brick, pasture gives wool, fields give wheat, mountains give ore. The desert gives nothing. Every hex has a number. Red 6 and 8 come up most often."
**On-screen:** The 5 resource icons in a row with their terrain.

### Scene 3 - Setup (1:15-2:15)
**Screen:** Click a glowing cyan corner (settlement), then a glowing edge (road). Do it twice.
**Say:** "Everyone places two settlements and two roads. Glowing spots are legal. The second round goes in reverse order, and your **second** settlement gives you free starting resources. Tip: pick spots next to **different** resources and good numbers like 6, 8, 5, 9."
**On-screen:** `Tip: different resources + good numbers`

### Scene 4 - A turn: Roll, Trade, Build (2:15-3:30)
**Screen:** Press Roll Dice (`R`). Hexes glow gold. Cards arrive in the hand.
**Say:** "Every turn has three steps: **Roll, Trade, Build.** Roll two dice. Every hex with that number pays out: 1 card for a settlement, 2 for a city."
**On-screen:** Big `1 Roll -> 2 Trade -> 3 Build` bar that stays in the corner.

### Scene 5 - What things cost (3:30-4:15)
**Screen:** Open the Build menu. Show costs.
**Say:**
- Road = wood + brick
- Settlement = wood + brick + wool + wheat (1 point)
- City = 2 wheat + 3 ore (2 points, upgrades a settlement)
- Development card = wool + wheat + ore
"Settlements must connect to your road and be at least two spaces from any other settlement."
**On-screen:** Cost table (the same one as in the Rules panel).

### Scene 6 - Trading (4:15-5:00)
**Screen:** Open the Trade drawer. Do a 4:1 bank trade, then a harbor trade.
**Say:** "Stuck? Trade. With players, offer anything you like. With the bank it is always 4 for 1, but a harbor makes it 3:1 or 2:1."

### Scene 7 - The robber / rolling a 7 (5:00-5:50)
**Screen:** Roll a 7. Discard dialog, move the robber (red hex), steal.
**Say:** "Roll a 7 and nobody earns anything. Anyone with more than 7 cards discards half. Then the roller moves the robber to block a hex and steals one card."
**On-screen:** `7 = Robber! Hold 8+ cards? Lose half.`

### Scene 8 - Development cards and bonus points (5:50-6:50)
**Screen:** Buy a card, open the hand. Show the Longest Route / Largest Army badges.
**Say:** "Development cards: Knight (move the robber), Road Building, Year of Plenty, Monopoly, and secret Victory Points. One per turn, never the turn you bought it. Two bonus prizes worth 2 points each: **Longest Route** (5+ roads in a row) and **Largest Army** (3+ knights played)."

### Scene 9 - Winning + wrap-up (6:50-7:20)
**Screen:** Victory screen.
**Say:** "That's all you need to start. Roll, trade, build, reach 10. The in-game **Rules** panel has everything else. Have fun!"

---

## Follow-up shorts (60-90 s each)
1. **Playing vs the computer** - Single Player, Human/Computer seats, Easy/Normal/Hard
2. **Playing online with friends** - create a room, share the code, host starts the game, New island
3. **Pass-and-play** - the "hand the device over" curtain
4. **5-6 players** - bigger island, and the **paired player** extra Action phase (no dice, no player trading)
5. **Tips and strategy** - best starting spots, when to build a city, when to buy dev cards
6. **Controls cheat sheet** - drag/scroll/right-drag camera, `R` roll, `1-4` build, `E` end turn, `Esc` cancel

---

## Production tips
- **Narrate calmly, show before saying.** Cursor on the thing while you name it.
- **Zoom in on the UI** when showing costs and buttons; new players read the screen, not your voice.
- **Use plain words:** "wheat", "card", "points". Avoid jargon like "VP" or "production".
- **Pause 1 second** after each key rule.
- **Add captions** (many people watch muted).
- **Free tools:** OBS Studio (record screen), DaVinci Resolve or CapCut (edit), Audacity (clean voice), or an AI voiceover if you prefer.
- **Thumbnail:** the 3D board + the text "Learn in 5 minutes".
- Put chapter timestamps in the YouTube description (use the scene titles above).
