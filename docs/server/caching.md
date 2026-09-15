# Caching

`XiansAi.Server` reads and writes its general-purpose cache through a single abstraction (`ICacheProvider`), and the `Cache__Provider` environment variable picks which implementation backs it. Three values are supported:

| Value | Provider | Behavior |
|-------|----------|----------|
| unset, or `memory` | In-memory | Cached in-process using `IMemoryCache`. Default. |
| `redis` | Redis | Shared cache plus cross-replica invalidation. Required for multi-replica deployments — see [Scaling — Server replicas + Redis](scaling.md#server-replicas--redis). |
| `noop` | No-op | Caching is disabled entirely: every read is a miss, every write is ignored, callers always read from the database. |

```bash
# Default — no configuration needed
# Cache__Provider=memory

# Multi-replica deployments
Cache__Provider=redis
Cache__Redis__ConnectionString=your-redis-host:6380,password=YOUR_PASSWORD,ssl=true

# Explicit opt-out of caching
Cache__Provider=noop
```

## In-Memory (default)

Suitable for a single server instance — development, testing, or a production deployment that doesn't run multiple replicas. Cached values live in that process's memory and are lost on restart. No configuration is required.

## Redis

Use `redis` when you run more than one `XiansAi.Server` replica behind a load balancer. Beyond storing cached values, Redis also carries cross-replica cache invalidation and synchronous `/converse` coordination — a single-replica in-memory cache can't do either of those, so multi-replica deployments need Redis to behave correctly, not just to go faster.

Full configuration, the production security checklist (network isolation, AUTH, TLS), and what breaks without it are covered in [Scaling — Server replicas + Redis](scaling.md#server-replicas--redis).

## No-Op

`noop` turns caching off. Every `ICacheProvider` read reports a miss and every write is ignored, so callers always fall through to their real source (typically the database).

This is useful when:

- **Ruling out the cache as a suspect.** If data looks stale, setting `Cache__Provider=noop` for a moment tells you whether the cache is actually involved, without changing any application code.
- **Explicitly disabling caching** for a deployment where correctness matters more than the extra database load — for example while debugging, or during a migration.

!!! note "What noop does and doesn't cover"
    `noop` governs `ICacheProvider` — the general-purpose cache used for things like the agent cache API, tenant OIDC configuration, and API key/authorization lookups. A small number of security-critical, frequently-invalidated caches (JWT/certificate validation, user roles, tenant lookups, approved-tenant resolution) are also wired to respect `noop`, since they'd otherwise keep serving from memory even with caching supposedly "off". Data that is never invalidated is free to stay cached in memory regardless of this setting — there's no correctness reason to disable it, and switching it off would just add unnecessary database load.

There is no data to lose when switching to or away from `noop` — nothing was ever stored, so it's safe to toggle at any time.

## Configuration reference

| Variable | Applies to | Description |
|----------|-----------|--------------|
| `Cache__Provider` | All | `memory` (default), `redis`, or `noop`. |
| `Cache__Redis__ConnectionString` | `redis` | Required. Standard StackExchange.Redis connection string. |
| `Cache__Redis__AllowInsecureConnection` | `redis` | Lab/local escape hatch to allow a Redis connection without AUTH/TLS outside Development. Never use in production. |

## See also

- [Scaling — Server replicas + Redis](scaling.md#server-replicas--redis) — why multi-replica deployments need Redis, and the production security checklist.
- [Chat message encryption](encryption.md) — how `/converse` pending-result payloads are encrypted before they touch Redis.
- [Cache provider README](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/Shared/Providers/Cache/README.md) on GitHub — implementation details for contributors.
