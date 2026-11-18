# ANS Setting2 Demo — read-only bootstrap

This is a safe deployment bootstrap for the isolated Binance Futures Demo service. It does NOT contain or execute the original Setting2 strategy, place orders, or access Live. Its endpoints are `/health`, `/readiness`, and `/demo-connectivity` (public market data only). Do not put API keys in GitHub.

To deploy on Railway, set service source to this repository, Dockerfile path `/Dockerfile`, and keep trading disabled. Original strategy port and private configuration are still required before any demo trading.
