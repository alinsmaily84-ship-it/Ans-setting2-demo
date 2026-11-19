# ANS V2 recovered baseline — integration gaps (review only)

Source: Railway archived snapshot dated 2026-11-15. This branch is isolated; no deployment or order execution is authorized by this document.

## Confirmed recovered configuration
- Demo endpoint: https://demo-fapi.binance.com
- Probe: 7 USDT; second-stage delay: 30 seconds; target notional: 2,000 USDT; concurrent positions: 5; target leverage: 20.
- The recovered engine has `reverseExisting:false`; reversal behavior must be reconciled with the approved strategy before enabling execution.
- Engine's profit tiers start at **1 USD**, while the separately recovered guardian's tiers start at **0.10 USD**. They are inconsistent.
- Engine uses `sl1:false`, `sl2Usd:5`, `sl3Usd:10`. Naming and intended protection must be reconciled; do not assume all protective orders are installed.
- The recovered analyzer has a `speed15m` metric and sorts by its `score`. The currently deployed market-analyzer was independently observed to sort by 5-minute speed, so archived and deployed versions differ.
- The recovered guardian contains automated protected exits gated by `TRADING_ENABLED` and `PROTECTIVE_ORDERS_VERIFIED`; preserve its code for review, do not automatically restore previously removed guardian behavior.

## Implementation sequence
1. Establish a single approved strategy configuration (no new filters or cooldowns).
2. Resolve conflicting protection owners and profit tiers before any order placement.
3. Wire a Demo-only scanner/decision/entry/30-second stage/protection pipeline, with explicit exchange confirmation and observable errors.
4. Verify Demo execution and protected positions before any readiness claim.
5. Keep Live disabled and Golden snapshot unchanged.

**Status:** recovered source only; NOT production-ready; NOT trading.
