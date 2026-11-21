import { BOARD_RULES, BUILD_COSTS, DEV_CARD_TYPES } from '@island/engine';
import { DEV_CARD_INFO } from './devCardInfo';
import { CostList } from './ResourceIcon';

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 mt-5 font-display text-xl text-gold-300 first:mt-0">{children}</h3>;
}

export function RulesContent() {
  return (
    <div className="space-y-2 text-[15px] leading-relaxed text-parchment-100/90">
      <H>Goal</H>
      <p>Be the first settler to reach <b>10 victory points</b> on your turn. Settlements are worth 1 point, cities 2, the Longest Route and Largest Army 2 each, and Victory Point cards 1.</p>
      <p className="text-sm text-parchment-300/80">You can only win during your own turn. If you somehow reach 10 points on someone else's turn, you claim victory when your turn begins.</p>

      <H>The island</H>
      <p>19 terrain hexes: 4 forests (wood), 3 hills (brick), 3 mountains (ore), 4 fields (wheat), 4 pastures (wool) and 1 desert. Each productive hex carries a number from 2–12; red numbers (6 and 8) are rolled most often and never sit next to each other.</p>

      <H>Setup</H>
      <p>Everyone rolls both dice; the highest roll (re-rolling ties) becomes the starting player. In clockwise order, each player places a settlement and an adjoining road. Then, in <i>reverse</i> order, each player places a second settlement and road, so the starting player places last. Your second settlement immediately gives you one resource from each touching hex, and the starting player takes the first turn.</p>

      <H>Your turn</H>
      <ol className="list-decimal space-y-1 pl-5">
        <li><b>Roll</b> two dice. Every hex showing the total produces its resource for each adjoining settlement (1) or city (2), unless the robber is on it.</li>
        <li><b>Trade</b> with other players, with the supply at 4:1, or through a harbor you have built on (3:1 generic, 2:1 specific).</li>
        <li><b>Build</b> roads, settlements and cities, and buy development cards.</li>
      </ol>

      <H>Building costs</H>
      <ul className="space-y-1">
        <li className="flex items-center justify-between gap-3"><span>Road</span><CostList cost={BUILD_COSTS.road} /></li>
        <li className="flex items-center justify-between gap-3"><span>Settlement</span><CostList cost={BUILD_COSTS.settlement} /></li>
        <li className="flex items-center justify-between gap-3"><span>City (upgrades a settlement)</span><CostList cost={BUILD_COSTS.city} /></li>
        <li className="flex items-center justify-between gap-3"><span>Development card</span><CostList cost={BUILD_COSTS.devCard} /></li>
      </ul>
      <p className="text-sm text-parchment-300/80">Each player has 15 roads, 5 settlements and 4 cities. Settlements must connect to your roads and be at least two edges from every other settlement.</p>

      <H>Rolling a 7 — the robber</H>
      <p>Nothing is produced. Everyone holding more than 7 resource cards discards half (rounded down). The roller must move the robber to a different hex (the desert is allowed), which then produces nothing, and steals one random card from a player with a settlement or city next to it, choosing the victim when there are several. A player with no cards has nothing to steal.</p>

      <H>Trading</H>
      <p>Only the player whose turn it is may trade, and only after rolling. Other players may trade with them, but never among themselves. You may not give cards away or trade identical resources. Trading with the supply is always 4:1, 3:1 at a generic harbor, or 2:1 for the matching resource at a special harbor.</p>

      <H>Development cards ({DEV_CARD_TYPES.reduce((s, t) => s + BOARD_RULES.standard.devDeck[t], 0)} in the deck; {DEV_CARD_TYPES.reduce((s, t) => s + BOARD_RULES.large.devDeck[t], 0)} with 5–6 players)</H>
      <ul className="space-y-1.5">
        {DEV_CARD_TYPES.map((t) => (
          <li key={t}>
            <b>
              {DEV_CARD_INFO[t].glyph} {DEV_CARD_INFO[t].name}
            </b>{' '}
            <span className="text-parchment-300/80">×{BOARD_RULES.standard.devDeck[t]}</span> — {DEV_CARD_INFO[t].text}
          </li>
        ))}
      </ul>
      <p className="text-sm text-parchment-300/80">You may play one development card per turn, but not one bought on the same turn (Victory Point cards are never played; they simply count).</p>

      <H>Special awards</H>
      <p><b>Longest Route</b> (2 VP): the first player with a continuous route of at least 5 roads; taken over by anyone who builds a longer one. <b>Largest Army</b> (2 VP): the first player to play 3 knights; taken over by anyone who plays more.</p>
      <p className="text-sm text-parchment-300/80">Only the longest single branch of a route counts. Building a settlement on an opponent's road breaks it. If the holder's road is broken but they are still tied for longest, they keep the card. If several others tie for longest, or nobody has 5+ segments, the tile is set aside until one player is clearly longest.</p>

      <H>5–6 players: the extension</H>
      <p>
        With 5 or 6 settlers the game uses the <b>CATAN 5-6 extension</b>: a bigger island of <b>30 hexes</b> (6 forests, 5 hills, 5 mountains, 6 fields, 6 pastures and 2 deserts) with 28 number discs and 11 harbors, a supply of <b>24 cards</b> of each
        resource, and <b>34 development cards</b> (20 Knights, 5 Victory Points, and 3 each of Road Building, Year of Plenty and Monopoly). Players still have 15 roads, 5 settlements and 4 cities, and the setup is the usual snake order.
      </p>
      <p>
        <b>Paired players.</b> A round is: Player 1 takes a normal turn (production, then Action phase). When they finish, <b>Player 2</b> — the third player to their left — takes an extra <b>Action phase</b>: no dice roll, no
        trading with other players (trading with the supply is fine), but you may build, buy and play one development card. If Player 2 reaches 10 points, they win at once. Then the dice and both markers pass to the left. Development cards you build as Player 2 can be played as Player 1, and the
        other way round.
      </p>
    </div>
  );
}
