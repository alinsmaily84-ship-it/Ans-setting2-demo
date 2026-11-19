# Original Setting2 source integration contract

Source of truth: `app/src/routes/index.tsx` from original Setting2 source commit `9709083071093c3fbf191c7627a2db492e51c738`. This original browser app is not in the Railway bootstrap repository.

## Verified original behavior
- The decision loop is `runCycle`, invoked every 1000 ms.
- Auto decisions are guarded by `autoPaper` and `autoMode === 'PAPER'`.
- Entry function `openPaper` creates simulated positions, not exchange orders.
- Closing a position updates the local paper ledger, not the Binance account.
- User settings are read from browser `localStorage`, including `ans-settings`.
- The exact original decision logic and saved settings must be preserved; do not substitute the Golden/Golden2 strategy.

## Required before enabling execution
1. Bring the immutable original source into a reviewable versioned path, without modifying it.
2. Extract original decision outputs (open/add/close/stop) and all original settings into an explicit, authenticated server-side contract.
3. Compare deterministic decisions on identical market snapshots and settings against the original.
4. Reconcile exchange orders, partial fills, open positions and protective orders; persist decision identities across restarts.
5. Add a kill-switch defaulting to disabled; only Binance Futures Demo credentials and host are permitted.
6. Validate a full Demo cycle before declaring readiness. No Live endpoints or keys.

## Current state
Modules in this branch are staging only. The order adapter currently implements entry only; add/close/stop orchestration is incomplete. The isolated Railway service still deploys from `main`, not this branch. Do not merge this PR or enable trading until the above conditions hold.
