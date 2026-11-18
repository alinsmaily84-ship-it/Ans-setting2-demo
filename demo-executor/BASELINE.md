# Setting2 Demo execution baseline (preparation only)

Original source commit: 9709083071093c3fbf191c7627a2db492e51c738
Original trading logic: app/src/routes/index.tsx (untouched)
Original market proxy: app/src/routes/api/binance.ts (untouched)
Target Railway service: ans-setting2-demo-isolated (not deployed from this branch)
Target venue: Binance Futures Demo ONLY. Live keys/connector excluded.

## Identified original entry/exit contracts
- Browser-dependent decision cycle runs every 1000 ms, guarded by autoPaper and autoMode=PAPER.
- Signal selection, risk, scaling and closure live in index.tsx; must be ported without rule changes.
- openPaper constructs position and estimates fills locally; it does not submit Binance orders.
- close constructs local realized PnL; it does not close an exchange position.
- Browser telemetry bridge is diagnostic, unauthenticated for order execution; never use it as an execution command channel.
- Market proxy is read-only and uses a named Demo gateway. Validate its availability before deployment.

## Demo-only execution adapter requirements
1. Run same decision state machine server-side, including scanner and price freshness, with deterministic comparison against original on identical inputs.
2. Use signed Binance Futures Demo REST requests server-side only; no browser exposure of credentials.
3. Reconcile Binance position/order IDs and exchange fills before declaring an entry, add, stop or close successful.
4. Respect Binance exchangeInfo quantity and notional precision, without changing strategy sizing silently; reject and log incompatible orders.
5. Record all decisions, request/response IDs, order outcomes, protective order status, and PnL for one bounded test cycle.
6. Start disabled. No Live API keys, Contabo SSH secrets, or Live endpoint references.
7. Do not submit any Demo order until adapter and parity checks are completed.

This document is not a strategy modification or deployment approval.
