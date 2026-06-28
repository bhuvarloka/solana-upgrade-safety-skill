# Upgrade compatibility report

**Verdict: MIGRATE** — ❌ in-place upgrade will corrupt data — migrate, or ship a new program ID.

| Category | Rung | Where | Why |
|---|---|---|---|
| MIGRATION-REQUIRED | R4 | AmmConfig.trade_fee_rate | type changed (u32 → u64) |
