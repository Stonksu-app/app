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
  MAKER_FEE,
  TAKER_FEE,
  backing,
  entryFeeRate,
  limitCanRest,
  limitFills,
  positionSize,
  equity,
  priceForRoi,
  triggerIsValid,
  triggeredBy,
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
import { liquidationDuring, worstPrice } from '../src/lib/marketData';
import type { Candle } from '../src/utils/market';

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
  mode: 'isolated',
  wallet: 100,
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

/*
 * A position that outlives the app.
 *
 * The market is live now, so closing the app doesn't pause it. On return the
 * candles since the entry are replayed to find out whether the position
 * survived — and the answer has to come from the wicks, not from the price
 * that happens to be showing: a spike can take a 50x position out and be gone
 * a minute later, which on a real venue is exactly what happens.
 */
const held: Position = pos();
const liq = liquidationPrice(held);

const tranquilo: Candle[] = [
  { open: 100, high: 101, low: 99.5, close: 100.5 },
  { open: 100.5, high: 102, low: 100, close: 101 },
];
check('una racha tranquila no liquida', liquidationDuring(held, tranquilo) === null);

const conMecha: Candle[] = [
  { open: 100, high: 101, low: 99, close: 100.5 },
  // The wick goes through the liquidation and the candle closes back above it.
  { open: 100.5, high: 101, low: liq - 0.5, close: 100.8 },
];
check(
  'una mecha por debajo de la liquidación sí liquida, aunque cierre por encima',
  liquidationDuring(held, conMecha) !== null
);

const corto: Position = { ...held, direction: 'short' };
const liqCorto = liquidationPrice(corto);
check(
  'en un short lo que mata es el máximo, no el mínimo',
  liquidationDuring(corto, [{ open: 100, high: liqCorto + 0.5, low: 95, close: 99 }]) !== null
);
check(
  'y una vela que solo baja no toca un short',
  liquidationDuring(corto, [{ open: 100, high: 100.2, low: 90, close: 91 }]) === null
);

check('sin velas no se puede afirmar nada', liquidationDuring(held, []) === null);
check(
  'el peor precio de un long es el mínimo del tramo',
  worstPrice('long', tranquilo) === 99.5
);
check('y el de un short, el máximo', worstPrice('short', tranquilo) === 102);
check('sin velas no hay peor precio', worstPrice('long', []) === null);

/*
 * Isolated versus cross — the difference that empties a first real account.
 *
 * Same trade, same leverage: cross survives a move that kills the isolated
 * one, because the whole balance is standing behind it, and the day it does
 * die it takes the whole balance rather than a slice. Both floored at zero:
 * a real venue can leave a negative balance on a gap, absorbed by its
 * insurance fund, and handing somebody a debt in a game currency would teach
 * nothing the warning doesn't.
 */
const aislado = pos({ leverage: 25, margin: 100, wallet: 1000, mode: 'isolated' });
const cruzado = pos({ leverage: 25, margin: 100, wallet: 1000, mode: 'cross' });

check('en aislado solo respalda el margen', backing(aislado) === 100);
check('en cruzado respalda todo el saldo', backing(cruzado) === 1000);
check(
  'por eso el cruzado aguanta mucho más',
  liquidationDistance(cruzado) > liquidationDistance(aislado) * 5,
  `${(liquidationDistance(cruzado) * 100).toFixed(2)}% vs ${(liquidationDistance(aislado) * 100).toFixed(2)}%`
);
check('el aislado se lleva solo el margen', settleCoins(aislado, 1) === -100);
check('el cruzado se lleva el saldo entero', settleCoins(cruzado, 1) === -1000);
check('ninguno de los dos deja deuda', equity(cruzado, 0.01) === 0 && equity(aislado, 0.01) === 0);
check(
  'el ROI se mide contra el margen en los dos modos',
  Math.abs(roi(cruzado, 101) - roi(aislado, 101)) < 1e-9
);
check(
  'un cruzado sin más saldo que el margen es un aislado',
  liquidationPrice(pos({ mode: 'cross', wallet: 100 })) === liquidationPrice(pos({ mode: 'isolated' }))
);

/*
 * Take profit y stop loss.
 *
 * Lo que separa operar de apostar: decidir cuándo sales estando tranquilo. Las
 * comprobaciones que importan son las que castigan el optimismo — que la
 * comisión hace que "salir en tablas" esté por encima de la entrada, que si en
 * una vela caben el stop y el objetivo gana el stop, y que la liquidación no
 * hace cola detrás de tus órdenes.
 */
const enLargo = pos({ direction: 'long', leverage: 10, margin: 100, entry: 100, wallet: 100 });
const enCorto = pos({ direction: 'short', leverage: 10, margin: 100, entry: 100, wallet: 100 });

check('un objetivo del +50% da el +50% justo', Math.abs(roi(enLargo, priceForRoi(enLargo, 0.5)) - 0.5) < 1e-9);
check('y en corto también', Math.abs(roi(enCorto, priceForRoi(enCorto, 0.5)) - 0.5) < 1e-9);
check(
  'salir en tablas no es salir al precio de entrada: la comisión ya se pagó',
  priceForRoi(enLargo, 0) > enLargo.entry,
  `${priceForRoi(enLargo, 0).toFixed(4)} vs ${enLargo.entry}`
);
check('en corto, las tablas quedan por debajo', priceForRoi(enCorto, 0) < enCorto.entry);
check('el objetivo de un largo está por encima de la entrada', priceForRoi(enLargo, 0.5) > enLargo.entry);
check('el de un corto, por debajo', priceForRoi(enCorto, 0.5) < enCorto.entry);

check('un take profit por debajo de la entrada no vale para un largo', !triggerIsValid(enLargo, 'takeProfit', 99));
check('un stop por encima tampoco', !triggerIsValid(enLargo, 'stopLoss', 101));
check(
  'un stop más allá de la liquidación no es un stop',
  !triggerIsValid(enLargo, 'stopLoss', liquidationPrice(enLargo) - 1)
);
check('uno antes de la liquidación sí', triggerIsValid(enLargo, 'stopLoss', liquidationPrice(enLargo) + 1));

const conOrdenes = { ...enLargo, takeProfit: 110, stopLoss: 95 };
check('sin llegar a ninguna, la posición sigue abierta', triggeredBy(conOrdenes, 99, 101) === null);
check('tocar el objetivo cierra en el objetivo', triggeredBy(conOrdenes, 100, 111)?.reason === 'takeProfit');
check('tocar el stop cierra en el stop', triggeredBy(conOrdenes, 94, 101)?.reason === 'stopLoss');
check(
  'si en la misma vela caben los dos, manda el stop',
  triggeredBy(conOrdenes, 94, 111)?.reason === 'stopLoss',
  'nadie sabe cuál tocó antes, y suponer el bueno maquilla cualquier resultado'
);
check(
  'la liquidación no hace cola detrás de tus órdenes',
  triggeredBy({ ...conOrdenes, stopLoss: liquidationPrice(enLargo) + 0.01 }, 0, 111)?.reason === 'liquidation'
);
check(
  'cerrar en el stop cuesta lo que dijiste, no el margen entero',
  settleCoins(conOrdenes, 95) > settleCoins(conOrdenes, liquidationPrice(conOrdenes)),
  `${settleCoins(conOrdenes, 95)} vs ${settleCoins(conOrdenes, liquidationPrice(conOrdenes))}`
);
check(
  'sin órdenes, solo cierra la liquidación',
  triggeredBy(enLargo, 95, 200) === null &&
    triggeredBy(enLargo, liquidationPrice(enLargo), 200)?.reason === 'liquidation'
);

/*
 * Órdenes market y límite.
 *
 * La diferencia que de verdad importa no es cuándo entras, es cuánto pagas por
 * entrar: una orden que espera en el libro es maker y paga un tercio. Por eso
 * la comisión no puede ser la misma en las dos, y por eso la liquidación
 * tampoco cae en el mismo sitio.
 */
const aMercado = pos({ orderType: 'market' });
const aLimite = pos({ orderType: 'limit' });

check('una market paga taker al entrar', entryFeeRate(aMercado) === TAKER_FEE);
check('una límite paga maker', entryFeeRate(aLimite) === MAKER_FEE);
check('maker es más barata que taker', MAKER_FEE < TAKER_FEE);
check(
  'y por eso la ida y vuelta cuesta menos con una límite',
  roundTripFee(aLimite, 100) < roundTripFee(aMercado, 100)
);
check(
  'la salida siempre es taker: cerrar se lo lleva lo que haya',
  Math.abs(roundTripFee(aLimite, 100) - (positionSize(aLimite) * 100 * MAKER_FEE + positionSize(aLimite) * 100 * TAKER_FEE)) < 1e-9
);
check(
  'pagar menos al entrar aleja la liquidación',
  liquidationPrice(aLimite) < liquidationPrice(aMercado),
  `${liquidationPrice(aLimite).toFixed(4)} vs ${liquidationPrice(aMercado).toFixed(4)}`
);
check(
  'una posición sin tipo se trata como market, que es lo que eran todas',
  entryFeeRate(pos()) === TAKER_FEE
);

check('una compra en el libro espera por debajo del mercado', limitCanRest('long', 99, 100));
check('y no por encima: eso se ejecutaría ya', !limitCanRest('long', 101, 100));
check('una venta espera por encima', limitCanRest('short', 101, 100));
check('y no por debajo', !limitCanRest('short', 99, 100));
check('al precio exacto no hay nada que esperar', !limitCanRest('long', 100, 100));
check('un precio imposible no es una orden', !limitCanRest('long', 0, 100) && !limitCanRest('long', -5, 100));

check('la compra entra cuando el precio baja hasta ella', limitFills('long', 99, 98, 100));
check('y no si nunca llega', !limitFills('long', 99, 99.5, 100));
check('la venta entra cuando el precio sube hasta ella', limitFills('short', 101, 100, 102));
check('y no si se queda corta', !limitFills('short', 101, 100, 100.5));
check('tocarla justo cuenta como tocarla', limitFills('long', 99, 99, 100));

console.log(failed === 0 ? '\nTodo correcto.' : `\n${failed} problema(s).`);
process.exit(failed === 0 ? 0 : 1);
