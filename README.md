# btc-race-24h-20261118-1444

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Arik2779/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Arik2779/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A slow, selective momentum bot that trades cbBTC/USDC (CBBTC) minute by minute in make.fun's bars-replay/v1 harness. It goes long, full size, only when the 60-bar return tops +30 bps while the close sits above its 240-bar EMA — the long-trend gate keeps it out of downtrend whipsaws — and exits when the 60-bar return drops below −35 bps or a 150 bps trailing guard trips. On the dev window it nets about +$9.5 USDC in 4 trades with ~1.1% max drawdown.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 over NDJSON stdin/stdout: it reads the hello, answers every batch with one reply echoing its seq, and stops at done. Standard library only, plus the vendored `vendor/makefun-bars.ts` shim (a byte-identical copy of the kit SDK).

---

<sub>Entered on [make.fun](https://make.fun/?ref=steady-lark-85&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
