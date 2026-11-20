import { canControl } from '../../lib/viewer';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { canAfford, emptyBundle, RESOURCES, totalCards, tradeRatios, type GameState, type Resource, type ResourceBundle } from '@island/engine';
import { PLAYER_PALETTE, RESOURCE_LABEL } from '../../lib/colors';
import { harborImg } from '../../lib/resourceArt';
import { playSound } from '../../lib/sound';
import { useGameStore } from '../../store/useGameStore';
import { Avatar } from '../Avatar';
import { ResourceIcon } from '../ResourceIcon';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h4 className="mb-2 font-display text-lg text-gold-300">{title}</h4>
      {children}
    </section>
  );
}

function Stepper({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="flex items-center gap-0.5">
      <button className="h-6 w-6 rounded bg-black/40 leading-none hover:bg-black/60 disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="w-4 text-center font-display">{value}</span>
      <button className="h-6 w-6 rounded bg-black/40 leading-none hover:bg-black/60 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}

function BundleView({ b }: { b: ResourceBundle }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {RESOURCES.filter((r) => b[r] > 0).map((r) => (
        <span key={r} className="inline-flex items-center gap-0.5 font-display">
          {b[r]}
          <ResourceIcon resource={r} className="h-5 w-5" />
        </span>
      ))}
    </span>
  );
}

/* ───────────── Maritime ───────────── */

function MaritimeTrade({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const player = game.players[game.currentPlayer];
  const ratios = tradeRatios(game, player.id);
  const [give, setGive] = useState<Resource | null>(null);
  const [receive, setReceive] = useState<Resource | null>(null);
  const [amount, setAmount] = useState(1);
  const maxLots = give ? Math.floor(player.resources[give] / ratios[give]) : 0;
  const maxAmount = receive ? Math.min(maxLots, game.bank[receive]) : maxLots;
  useEffect(() => setAmount((a) => Math.max(1, Math.min(a, Math.max(1, maxAmount)))), [maxAmount]);
  const ok = give && receive && give !== receive && amount >= 1 && amount <= maxAmount;

  return (
    <Section title="Supply & harbors">
      <p className="mb-2 text-xs text-parchment-300/75">Give</p>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => {
          const can = player.resources[r] >= ratios[r];
          return (
            <button
              key={r}
              disabled={!can}
              onClick={() => setGive(r)}
              className={`flex flex-col items-center rounded-lg border p-1.5 transition disabled:opacity-35 ${give === r ? 'border-gold-300 bg-gold-500/25' : 'border-gold-600/30 bg-black/25 hover:border-gold-400'}`}
              title={`${RESOURCE_LABEL[r]}: you have ${player.resources[r]}, trade at ${ratios[r]}:1`}
            >
              <ResourceIcon resource={r} className="h-7 w-7" />
              <span className={`font-display text-sm ${ratios[r] < 4 ? 'text-emerald-400' : ''}`}>{ratios[r]}:1</span>
            </button>
          );
        })}
      </div>
      <p className="mb-2 mt-3 text-xs text-parchment-300/75">Receive</p>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => (
          <button
            key={r}
            disabled={r === give || game.bank[r] === 0}
            onClick={() => setReceive(r)}
            className={`flex flex-col items-center rounded-lg border p-1.5 transition disabled:opacity-35 ${receive === r ? 'border-gold-300 bg-gold-500/25' : 'border-gold-600/30 bg-black/25 hover:border-gold-400'}`}
            title={`${RESOURCE_LABEL[r]} — supply holds ${game.bank[r]}`}
          >
            <ResourceIcon resource={r} className="h-7 w-7" />
            <span className="text-[10px] text-parchment-300/70">supply {game.bank[r]}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-parchment-300/80">Receive</span>
          <Stepper value={amount} onChange={setAmount} max={Math.max(1, maxAmount)} />
          {give && <span className="text-parchment-300/80">for {amount * ratios[give]} {RESOURCE_LABEL[give].toLowerCase()}</span>}
        </div>
        <button
          className="btn-primary px-4 py-1.5 text-base"
          disabled={!ok}
          onClick={() => {
            if (give && receive && dispatch({ type: 'MARITIME_TRADE', player: player.id, give, receive, amount })) {
              setGive(null);
              setReceive(null);
              setAmount(1);
            }
          }}
        >
          Trade
        </button>
      </div>
    </Section>
  );
}

/* ───────────── Domestic ───────────── */

function OfferBuilder({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const player = game.players[game.currentPlayer];
  const [give, setGive] = useState<ResourceBundle>(emptyBundle());
  const [want, setWant] = useState<ResourceBundle>(emptyBundle());
  const overlap = RESOURCES.some((r) => give[r] > 0 && want[r] > 0);
  const ok = totalCards(give) > 0 && totalCards(want) > 0 && !overlap;
  return (
    <div className="rounded-lg bg-black/25 p-3">
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
        <span />
        <span className="text-center text-xs text-parchment-300/75">You give</span>
        <span className="text-center text-xs text-parchment-300/75">You want</span>
        {RESOURCES.map((r) => (
          <div key={r} className="contents">
            <ResourceIcon resource={r} className="h-6 w-6" />
            <div className="flex justify-center">
              <Stepper value={give[r]} max={player.resources[r]} onChange={(n) => setGive({ ...give, [r]: n })} />
            </div>
            <div className="flex justify-center">
              <Stepper value={want[r]} max={game.board.size === 'large' ? 24 : 19} onChange={(n) => setWant({ ...want, [r]: n })} />
            </div>
          </div>
        ))}
      </div>
      {overlap && <p className="mt-2 text-xs text-red-300">You can't trade a resource for the same resource.</p>}
      <button
        className="btn-primary mt-3 w-full py-2 text-base"
        disabled={!ok}
        onClick={() => {
          playSound('click');
          if (dispatch({ type: 'PROPOSE_TRADE', player: player.id, give, want })) {
            setGive(emptyBundle());
            setWant(emptyBundle());
          }
        }}
      >
        Offer to all players
      </button>
    </div>
  );
}

function OpenOffer({ game }: { game: GameState }) {
  const dispatch = useGameStore((s) => s.dispatch);
  const offer = game.tradeOffer!;
  const me = game.players[offer.from];
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-gold-500/40 bg-black/25 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-parchment-300/80">{me.name} gives</span>
        <BundleView b={offer.give} />
        <span className="text-parchment-300/80">for</span>
        <BundleView b={offer.want} />
      </div>
      <ul className="mt-3 space-y-2">
        {game.players
          .filter((p) => p.id !== offer.from)
          .map((p) => {
            const pal = PLAYER_PALETTE[p.color];
            const answer = offer.responses[p.id];
            const able = canAfford(p.resources, offer.want);
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-lg p-1.5" style={{ background: `${pal.panelFrom}88` }}>
                <Avatar index={p.avatar} ring={pal.accent} size={30} />
                <span className="flex-1 truncate font-display">{p.name}</span>
                {answer === undefined && !canControl(game, p.id) && <span className="text-xs italic text-parchment-300/70">{p.isAI ? 'thinking…' : 'deciding…'}</span>}
                {answer === undefined && canControl(game, p.id) && (
                  <>
                    <button
                      className="rounded bg-emerald-700 px-2 py-0.5 text-xs text-white hover:bg-emerald-600 disabled:opacity-40"
                      disabled={!able}
                      title={able ? `${p.name} accepts` : `${p.name} doesn't have the cards`}
                      onClick={() => dispatch({ type: 'RESPOND_TRADE', player: p.id, accept: true })}
                    >
                      Accept
                    </button>
                    <button className="rounded bg-red-900 px-2 py-0.5 text-xs text-white hover:bg-red-800" onClick={() => dispatch({ type: 'RESPOND_TRADE', player: p.id, accept: false })}>
                      Decline
                    </button>
                  </>
                )}
                {answer === 'declined' && <span className="text-xs text-red-300">declined</span>}
                {answer === 'accepted' && (
                  <button className="btn-primary px-2.5 py-1 text-sm" onClick={() => dispatch({ type: 'CONFIRM_TRADE', player: offer.from, partner: p.id })}>
                    Trade with {p.name}
                  </button>
                )}
              </li>
            );
          })}
      </ul>
      <p className="mt-2 text-xs text-parchment-300/60">Pass-and-play: each player taps their own answer. Then {me.name} picks a partner.</p>
      <button className="btn-wood mt-2 w-full py-1.5 text-sm" onClick={() => dispatch({ type: 'CANCEL_TRADE', player: offer.from })}>
        Withdraw offer
      </button>
    </motion.div>
  );
}

/** Full trading UI: maritime (bank/harbor) and player-to-player offers. Rules enforced by the engine. */
export function TradePanel({ game }: { game: GameState }) {
  const player = game.players[game.currentPlayer];
  const harbors = game.board.harbors.filter((h) => h.vertices.some((v) => game.buildings[v]?.owner === player.id));
  if (game.phase !== 'main') {
    return (
      <p className="rounded-lg border border-gold-600/30 bg-gold-500/10 px-3 py-2 text-sm text-parchment-200">
        {game.phase === 'roll' ? 'Roll the dice first — trading happens after production.' : 'Trading opens once the current step is finished.'}
      </p>
    );
  }
  return (
    <>
      <MaritimeTrade game={game} />
      {harbors.length > 0 && (
        <div className="-mt-3 mb-5 flex flex-wrap gap-2 text-xs text-parchment-300/80">
          {harbors.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1 rounded bg-black/25 px-1.5 py-0.5">
              <img src={harborImg(h.type)} alt="" className="h-4 w-4" />
              {h.type === 'any' ? '3:1 harbor' : `2:1 ${RESOURCE_LABEL[h.type].toLowerCase()} harbor`}
            </span>
          ))}
        </div>
      )}
      <Section title="Trade with players">
        {game.pairedTurn ? (
          <p className="rounded-lg border border-gold-600/30 bg-gold-500/10 px-3 py-2 text-sm text-parchment-200">
            Paired players rule: during Player 2's Action phase you may only trade with the supply.
          </p>
        ) : game.tradeOffer ? (
          <OpenOffer game={game} />
        ) : (
          <OfferBuilder game={game} />
        )}
      </Section>
    </>
  );
}
