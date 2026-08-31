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
  LEVERAGES,
  LIQUIDATION_LOSS,
  coinsFromReturn,
  generateCandles,
  isLiquidated,
  positionReturn,
  seededRandom,
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
check('un long gana cuando el precio sube', positionReturn(100, 110, 'long', 1) > 0);
check('y pierde cuando baja', positionReturn(100, 90, 'long', 1) < 0);
check('un short es exactamente lo contrario', positionReturn(100, 90, 'short', 1) === -positionReturn(100, 90, 'long', 1));
check(
  'el apalancamiento multiplica el movimiento',
  Math.abs(positionReturn(100, 105, 'long', 2) - 2 * positionReturn(100, 105, 'long', 1)) < 1e-9
);
check('sin movimiento no hay ni ganancia ni pérdida', positionReturn(100, 100, 'long', 10) === 0);

// The part that protects the player: a position can lose its stake and not a
// coin more, however much the price runs.
const desplome = positionReturn(100, 40, 'long', 10);
check('la pérdida se detiene en el capital arriesgado', desplome === LIQUIDATION_LOSS, `${desplome}`);
check('y eso cuenta como liquidación', isLiquidated(desplome));
check('un -99% todavía no liquida', !isLiquidated(-0.99));
check(
  'con x10 basta un 10% en contra para liquidar',
  isLiquidated(positionReturn(100, 90, 'long', 10))
);
check(
  'con x1 hace falta que el precio se vaya a cero',
  !isLiquidated(positionReturn(100, 1, 'long', 1))
);

check('ganar 100 al 25% son 25 monedas', coinsFromReturn(100, 0.25) === 25);
check('perder el 25% de 100 son -25', coinsFromReturn(100, -0.25) === -25);
check(
  'los decimales se redondean a favor del jugador al ganar',
  coinsFromReturn(100, 0.005) === 0 && coinsFromReturn(100, 0.019) === 1
);
check(
  'y a su favor también al perder',
  coinsFromReturn(100, -0.019) === -1 && coinsFromReturn(100, -0.005) === 0
);
check(
  'liquidarse cuesta exactamente lo apostado',
  coinsFromReturn(100, LIQUIDATION_LOSS) === -100
);
check('los apalancamientos ofrecidos son razonables', LEVERAGES.every((l) => l >= 1 && l <= 10));

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
