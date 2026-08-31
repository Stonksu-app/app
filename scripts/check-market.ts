/**
 * The simulator pays what the screen showed.
 *
 * Coins are spent in a real shop, so a payout that disagrees with the chart is
 * the one bug here that costs a player something. The market is seeded and the
 * money maths is pure precisely so both can be asserted rather than watched.
 *
 * Run: npm run check -- market
 */
import {
  FREE_TRADES_PER_DAY,
  hasUnlimitedTrades,
} from '../src/data/plans';
import {
  TAKER_FEE,
  equity,
  generateCandles,
  grossPnl,
  isLiquidated,
  liquidationDistance,
  liquidationPrice,
  notional,
  roi,
  roundTripFee,
  seededRandom,
  settleCoins,
  type Leverage,
  type Position,
} from '../src/utils/market';
import { useUserStore } from '../src/store/useUserStore';

let failed = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failed++;
    console.log(`FALLA  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

// ------------------------------------------------------------ the market
const a = generateCandles(1234, 30);
const b = generateCandles(1234, 30);
check('la misma semilla da el mismo mercado', JSON.stringify(a) === JSON.stringify(b));
check('semillas distintas dan mercados distintos', JSON.stringify(a) !== JSON.stringify(generateCandles(99, 30)));
check('sale el número de velas pedido', a.length === 30);
check(
  'ninguna vela se sale de su propio rango',
  a.every((c) => c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close))
);
check('los precios nunca son negativos', a.every((c) => c.low > 0));
const rand = seededRandom(7);
check('el generador se queda entre 0 y 1', Array.from({ length: 200 }, rand).every((n) => n >= 0 && n < 1));

// ------------------------------------------------------------ the money
const pos = (over: Partial<Position> = {}): Position => ({
  direction: 'long',
  leverage: 10,
  margin: 100,
  entry: 100,
  ...over,
});

check('el tamaño de posición es margen por apalancamiento', notional(pos({ leverage: 20 })) === 2000);
check('un long gana cuando el precio sube', grossPnl(pos(), 110) > 0);
check('y pierde cuando baja', grossPnl(pos(), 90) < 0);
check(
  'un short es exactamente lo contrario',
  grossPnl(pos({ direction: 'short' }), 90) === -grossPnl(pos(), 90)
);
check(
  'el apalancamiento multiplica el movimiento',
  Math.abs(grossPnl(pos({ leverage: 4 }), 105) - 4 * grossPnl(pos({ leverage: 1 }), 105)) < 1e-9
);

/*
 * Fees. Charged on both sides like a real venue, which is what makes high
 * leverage expensive before the price has done anything: at 100x the round
 * trip is 12% of the margin.
 */
const feeAt100 = roundTripFee(pos({ leverage: 100 }), 100);
check('la comisión se cobra en los dos lados', Math.abs(feeAt100 - 100 * 100 * TAKER_FEE * 2) < 1e-9, `${feeAt100}`);
check('a x100 la ida y vuelta cuesta el 12% del margen', Math.abs(feeAt100 - 12) < 0.001, `${feeAt100}`);
check('sin mover el precio, abrir y cerrar ya pierde la comisión', settleCoins(pos(), 100) < 0);

/*
 * Liquidation. The distances are the whole lesson — and they have to match
 * what the screen promises, since the chart draws that exact price.
 */
for (const [lev, expected] of [[2, 49.5], [10, 9.5], [25, 3.5], [100, 0.5]] as const) {
  const p = pos({ leverage: lev as Leverage });
  const d = liquidationDistance(p) * 100;
  check(
    `a ${lev}x se liquida a un ${d.toFixed(2)}% en contra`,
    Math.abs(d - expected) < 0.1,
    `esperado ~${expected}%`
  );
}
check(
  'tocar el precio de liquidación liquida',
  isLiquidated(pos({ leverage: 100 }), liquidationPrice(pos({ leverage: 100 })))
);
check('un pelo antes, todavía no', !isLiquidated(pos({ leverage: 100 }), liquidationPrice(pos({ leverage: 100 })) * 1.0001));
check(
  'y en un short el precio de liquidación está por encima de la entrada',
  liquidationPrice(pos({ direction: 'short', leverage: 50 })) > 100
);

/*
 * The floor. Isolated margin: the round can cost the margin and not one coin
 * more, however far the price runs — which is what makes it honest to let
 * anybody play with the app's own currency.
 */
check('un desplome del 50% con x10 cuesta el margen entero', settleCoins(pos(), 50) === -100);
check('y un desplome del 99% no cuesta más', settleCoins(pos(), 1) === -100);
check('el patrimonio nunca baja de cero', equity(pos(), 1) === 0);
check('el ROI nunca es peor que -100%', roi(pos(), 1) === -1);
check(
  'apostar todo el saldo sigue teniendo el mismo suelo',
  settleCoins(pos({ margin: 5000 }), 1) === -5000
);

check('ganar redondea a favor del jugador', settleCoins(pos({ leverage: 1 }), 100.001) === 0);
check(
  'y perder también',
  settleCoins(pos({ leverage: 1, margin: 1000 }), 99.999) >= -2
);

// ------------------------------------------------------- the daily limit
const store = useUserStore.getState();
useUserStore.setState({ plan: 'free', tradeDay: null, tradesToday: 0, coins: 0 });
check('el primer trade del día entra', store.startTrade());
check('el segundo ya no, sin Ultra', !store.startTrade());
check('y canTrade lo dice antes de intentarlo', !store.canTrade());
check(`el plan gratuito trae ${FREE_TRADES_PER_DAY} al día`, FREE_TRADES_PER_DAY >= 1);

useUserStore.setState({ plan: 'ultra' });
check('con Ultra son ilimitados', store.startTrade() && store.startTrade() && store.canTrade());
check('y la regla lo respalda', hasUnlimitedTrades('ultra') && !hasUnlimitedTrades('premium'));

// Settling can never leave a debt behind.
useUserStore.setState({ coins: 30 });
store.settleTrade(-100);
check('perder más monedas de las que tienes deja el saldo en 0', useUserStore.getState().coins === 0);
store.settleTrade(50);
check('y ganar suma con normalidad', useUserStore.getState().coins === 50);

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
