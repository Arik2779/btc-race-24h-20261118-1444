// Slow-momentum cbBTC/USDC bot for make.fun bars-replay/v1.
//
// Strategy (designed from the dev window's own price action, kept deliberately
// slow and selective so it survives an unseen race window):
//
// - One symbol (CBBTC), long only, at most one open position, full-size trades.
// - Entry, decided on a batch's bar close and filled at the next bar's open:
//   the 60-bar return is above +30 bps AND the close is above the 240-bar EMA.
//   The long EMA gate is the point: without it the bot whipsaws through the
//   early downtrend and bleeds a round-trip fee (~26 bps) on every false start.
// - Exit, whole position: the 60-bar return falls below -35 bps (momentum dead),
//   or the close drops 150 bps under the peak since entry (crash guard). After
//   an exit the bot waits 30 bars before re-entering, so a stale signal cannot
//   pull it straight back in for another round-trip fee.
// - No order while warming up, no order before 240 closes exist (the EMA and
//   the 60-bar lookback need history), no order on a bar the symbol missed.
// - Deterministic: float64 EMA / return arithmetic on closes only, no clock,
//   no environment, no randomness; the same hello and batches give the same
//   orders every run.
//
// Wire protocol: the vendored shim speaks agent-fun/bars-replay/v1 -- it reads
// the hello, then one batch per bar, and we answer each batch with exactly one
// reply echoing its seq and carrying our orders (at most one here).

import { runBars, type BarsState, type Batch, type OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

/** Entry: 60-bar return must beat this (bps). */
const ENTRY_RET_BPS = 30;
/** Exit: 60-bar return below this (bps) means the move is over. */
const EXIT_RET_BPS = -35;
/** Long-trend gate: close must sit above this EMA (bars). */
const GATE_EMA_BARS = 240;
/** Momentum lookback (bars). */
const RET_BARS = 60;
/** Crash guard: exit if the close falls this far (bps) under the peak recorded since entry. */
const TRAIL_BPS = 150;
/** Bars to wait after an exit before a new entry (avoids immediate re-entry churn). */
const COOL_BARS = 30;
/** Slippage cap per order, measured from the latest close (bps). Wide enough that a normal gap
 *  between close and next open never rejects a fill, tight enough to refuse a fill at an absurd price. */
const MAX_SLIPPAGE_BPS = 200;

/** Per-symbol closes, a 240-bar EMA and the peak since entry. */
class Trend {
  closes: number[] = [];
  ema: number | null = null;
  peak: number | null = null;
  /** First seq on which a new entry is allowed again (after an exit). */
  coolUntil = -1;

  push(close: number): void {
    this.closes.push(close);
    if (this.ema === null) {
      this.ema = close;
    } else {
      const k = 2 / (GATE_EMA_BARS + 1);
      this.ema += k * (close - this.ema);
    }
  }

  /** Return over the last RET_BARS bars, in bps, or null without history. */
  retBps(): number | null {
    if (this.closes.length <= RET_BARS) return null;
    const old = this.closes[this.closes.length - RET_BARS - 1]!;
    return ((this.closes[this.closes.length - 1]! - old) * 10000) / old;
  }

  ready(): boolean {
    return this.closes.length > GATE_EMA_BARS && this.ema !== null;
  }
}

const trend = new Trend();

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    // Fold this batch's bar into the trend. A bar the symbol missed adds
    // nothing; the decision below then uses the previous close.
    const closeBig = state.close(SYMBOL);
    if (closeBig !== null) trend.push(Number(closeBig));

    if (state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    const ret = trend.retBps();
    const close = closeBig === null ? null : Number(closeBig);
    if (ret === null || close === null || !trend.ready() || trend.ema === null) return [];

    if (held === undefined) {
      // Flat: enter only on confirmed multi-hour momentum above the
      // long-term trend, and not inside the cooldown after an exit -- the
      // signal that just failed must prove itself again instead of pulling
      // the bot straight back in for another round-trip fee.
      if (state.seq > trend.coolUntil && ret > ENTRY_RET_BPS && close > trend.ema) {
        trend.peak = close;
        const cash = state.cash;
        const minNotional = BigInt(state.hello.fees.min_notional_quote_units);
        if (cash >= minNotional) {
          return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: cash, max_slippage_bps: MAX_SLIPPAGE_BPS }];
        }
      }
      return [];
    }

    // Holding: track the peak, exit on dead momentum or the trailing guard.
    if (trend.peak === null || close > trend.peak) trend.peak = close;
    if (ret < EXIT_RET_BPS || close < trend.peak * (1 - TRAIL_BPS / 10000)) {
      trend.peak = null;
      trend.coolUntil = state.seq + COOL_BARS;
      return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
    }
    return [];
  },
});
