# Running tests after a change

After you change Server, Lib, or Agent Studio, run the suite that actually covers that change. Do not wait until a PR review to discover a broken Admin route or a Lib API that no longer round-trips.

This page is the contributor loop. The in-repo catalogs (which class covers which route, how to add a test) live in the Server and Lib repositories; links are at the bottom.

## After you finish a change

1. Identify which repository you edited.
2. Run the **unit tests** for that area (seconds).
3. Run the matching **integration tests** (in-process host, no SaaS).
4. If the change touches agents, Temporal, or Xians.Lib APIs, run the matching **Lib-backed** Server cycle.
5. Before opening a PR, run the **full suite** for that repository.

| You changed | Run at least |
| --- | --- |
| Server logic with no HTTP (validators, resolvers, caches) | Server unit tests for that type |
| Server HTTP / Mongo (Admin, Web, Agent, User APIs) | Matching `*EndpointsTests` class |
| Server auth (Admin API keys, roles, tenant scope) | `AdminAuthEndpointsTests` plus related unit tests |
| Temporal HTTP, activations, schedules, HITL | `AdminApiTemporal` (or the specific class) |
| Agent SDK behaviour on a live worker (chat, knowledge, secrets, documents, webhooks, files, custom workflows, schedules, HITL, cross-agent, activations, metrics, logging) | The matching Lib-backed cycle |
| Xians.Lib internals | Lib unit + mock integration (`Category!=RealServer`) |
| Agent Studio UI | `npm test` and `npm run lint` |
| An agent you author (not the platform) | [Unit Testing Workflows](../concepts/unit-tests.md) (Local Mode) |

!!! note "Two different “Lib” suites"
    **Server Lib-backed tests** start a real Xians.Lib agent against an in-process Server and a local Temporal CLI. They need no `.env` and no hosted cluster.

    **Lib RealServer tests** (`Category=RealServer`) call `SERVER_URL` from a `.env` file. They are optional and are **not** the default after-dev loop.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Node.js 20+ if you changed Agent Studio
- Clone **Server** and **Lib** as siblings. The Server test project references `../XiansAi.Lib/Xians.Lib/Xians.Lib.csproj`:

```text
your-work-dir/
  XiansAi.Server/
  XiansAi.Lib/
  agent-studio/     # only if you work on Studio
```

No MongoDB install, no Temporal cluster, and no Auth0 / Azure AD credentials are required for the default Server suite. Integration tests start an ephemeral Mongo replica set (Mongo2Go). Temporal tests start a local Temporal CLI the first time they run (later runs reuse the cache).

!!! warning "Do not point tests at shared environments"
    Do not set `MongoDB__ConnectionString` or `Temporal__FlowServerUrl` to a staging or production cluster for `dotnet test`. The Server factory pins fixture values. Leftover `Temporal__*` environment variables are overridden only when a Temporal fixture is present.

## Server ([XiansAi.Server](https://github.com/XiansAiPlatform/XiansAi.Server))

All Server tests live in `XiansAi.Server.Tests`. From the Server repo root:

```bash
dotnet test
```

That runs **unit + Mongo integration + Temporal + Lib-backed** cycles. Use filters while iterating.

```bash
# One class
dotnet test --filter "FullyQualifiedName~AdminAuthEndpointsTests"

# One test
dotnet test --filter "FullyQualifiedName~AdminAuthEndpointsTests.MissingBearer_ReturnsUnauthorized"

# HTML report (written under TestResults/)
dotnet test --logger "html;LogFileName=test-results.html"
```

### Unit tests

**Where:** `XiansAi.Server.Tests/UnitTests/`

**What they are:** Isolated tests of services, validators, auth resolvers, and similar types. They do **not** start the ASP.NET host or Mongo.

**When to run:** After any logic change; always as the first check.

```bash
dotnet test --filter "FullyQualifiedName~Tests.UnitTests"
```

Examples: JWT claim extraction, secret-vault rules, `AdminRoleTenantResolver`, SSRF URL validation.

### Integration tests (Mongo only)

**Where:** `XiansAi.Server.Tests/IntegrationTests/` (`AdminApi`, `WebApi`, `AgentApi`, `UserApi`, `AppsApi`)

**What they are:** Real HTTP through the mapped endpoints (routing, authentication, validation, persistence) against an in-process host and Mongo2Go. Temporal, email, and certificate generation are mocked.

**When to run:** After endpoint, authz, or Mongo-backed CRUD changes. Workflow **success** paths that need a cluster belong in Temporal tests, not here.

```bash
# All integration tests except Temporal / Lib-backed
dotnet test --filter "FullyQualifiedName~Tests.IntegrationTests&FullyQualifiedName!~AdminApiTemporal"

# One surface
dotnet test --filter "FullyQualifiedName~Tests.IntegrationTests.AdminApi"
```

Admin tests authenticate with a real `sk-Xnai-…` API key (`ConfigureAdminApiClientAsync`). Web and Agent tests use a stub `Test` scheme. User API keeps its real `apikey` policy.

Class names follow `{Surface}{Area}EndpointsTests` (for example `AdminKnowledgeEndpointsTests`, `AdminAuthEndpointsTests`). The catalog is [API suites](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/integration-tests/suites.md).

### Temporal tests

**Where:** classes in the `AdminApiTemporal` collection

**What they are:** The same in-process Server + Mongo, but Temporal is **not** mocked. One local Temporal CLI/dev server (`WorkflowEnvironment.StartLocalAsync`) is shared for the collection.

**When to run:** After changes to activations, workflow HTTP, schedules, HITL, worker deployments, or anything that must talk to Temporal.

```bash
dotnet test --filter "FullyQualifiedName~AdminApiTemporal"
```

The first run may download the Temporal CLI into the user cache. To use an existing binary:

```bash
export XIANS_TEMPORAL_CLI_PATH=/usr/local/bin/temporal
# or TEMPORAL_CLI_PATH
dotnet test --filter "FullyQualifiedName~AdminApiTemporal"
```

These tests do **not** run in parallel with each other (same xUnit collection), so workflow ids stay unique.

Details: [Temporal tests](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/integration-tests/temporal.md).

### Lib-backed tests

Most Temporal Admin tests drive an in-process **stub** workflow. Lib-backed cycles instead register a real agent with sibling **Xians.Lib** — the same SDK production agents use — then deploy, activate, and exercise it through Admin HTTP (and live SSE / SignalR where that is the product path).

**When to run:** After you change a Server API that agents call, or Lib behaviour those cycles cover. Pick the cycle that matches the feature:

| Feature | Filter |
| --- | --- |
| Chat, Admin SSE, UserApi SSE, `/ws/chat` | `EchoAgent` |
| Knowledge overrides | `KnowledgeAgent` |
| Secret Vault isolation | `SecretVaultAgent` |
| Secret Vault from workflow and activity | `SecretVaultSdkAgent` |
| Document DB | `DocumentDbAgent` |
| Builtin webhooks | `WebhookAgent` |
| File messages both ways | `FileMessagingAgent` |
| Custom workflows / activable onboarding | `CustomWorkflowAgent` |
| Schedules (Admin HTTP) | `SchedulerAgent` |
| `ScheduleCollection` from workflow and activity | `ScheduleSdkAgent` |
| HITL tasks (Admin HTTP) | `HitlTaskAgent` |
| HITL `TaskCollection` from workflow and activity | `HitlTaskSdkAgent` |
| Cross-agent workflows | `CrossAgentWorkflow` |
| Activations SDK | `ActivationSdkAgent` |
| Metrics | `MetricsAgent` |
| Logging | `LoggingAgent` |

```bash
dotnet test --filter "FullyQualifiedName~EchoAgent"
dotnet test --filter "FullyQualifiedName~KnowledgeAgent"
```

If restore fails with a missing `Xians.Lib.csproj`, clone Lib next to Server (see [Prerequisites](#prerequisites)).

What each cycle asserts: [Lib agent workflows](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/integration-tests/lib-agent-workflows.md).

### What this suite does not cover

- Real identity providers (Auth0, Azure AD, Keycloak)
- A remote Temporal cluster or a shared MongoDB
- Native WebSocket transport (SignalR tests use long polling against TestServer)

Manual `.http` files under `XiansAi.Server.Tests/http/` are for exploring APIs by hand. They are not part of `dotnet test`.

## Xians.Lib ([XiansAi.Lib](https://github.com/XiansAiPlatform/XiansAi.Lib))

Lib has its own project, `Xians.Lib.Tests`. From the Lib repo:

```bash
# Unit + mock integration (default loop; does not hit a live Server)
dotnet test --filter "Category!=RealServer"

# Unit only
dotnet test --filter "Category!=Integration&Category!=RealServer"

# WireMock / in-process integration (not your hosted Server)
dotnet test --filter "Category=Integration"
```

| Category | Connects to a hosted Server? | When |
| --- | --- | --- |
| Unit | No | Always, after Lib logic changes |
| Integration (`Category=Integration`) | No (WireMock / local Temporal if enabled) | Before commit, with unit tests |
| RealServer (`Category=RealServer`) | **Yes** — `SERVER_URL` / `API_KEY` from `.env` | Optional check against a running Server you own |

```bash
# Optional: only if you have a local or dedicated Server and a .env
dotnet test --filter "Category=RealServer"
```

!!! warning "RealServer tests use live credentials"
    Copy `env.template` to `.env` locally. Do not commit API keys. Do not point `SERVER_URL` at production unless that is an explicit, isolated check.

Lib `Category=Integration` tests do **not** read `.env` (except Temporal tests when `RUN_INTEGRATION_TESTS=true`). Passing them does not prove your hosted Server is healthy.

More detail: [Xians.Lib.Tests README](https://github.com/XiansAiPlatform/XiansAi.Lib/blob/main/Xians.Lib.Tests/README.md).

## Agent Studio ([agent-studio](https://github.com/XiansAiPlatform/agent-studio))

From the Studio repo:

```bash
npm install
npm test          # vitest, once
npm run lint
```

There is no in-process Server here. After a Studio change that depends on a new Admin API, still run the matching Server integration or Lib-backed test in `XiansAi.Server`.

## Agent authors (not platform code)

If you are writing an **agent** (workflows and activities) rather than the control plane, use Xians Local Mode and Temporal’s time-skipping environment. That path does not start Server or Mongo.

See [Unit Testing Workflows](../concepts/unit-tests.md).

## Filter cheat sheet

```bash
# --- Server (from XiansAi.Server/) ---
dotnet test
dotnet test --filter "FullyQualifiedName~Tests.UnitTests"
dotnet test --filter "FullyQualifiedName~Tests.IntegrationTests&FullyQualifiedName!~AdminApiTemporal"
dotnet test --filter "FullyQualifiedName~AdminApiTemporal"
dotnet test --filter "FullyQualifiedName~AdminAuthEndpointsTests"
dotnet test --filter "FullyQualifiedName~EchoAgent"

# --- Lib (from XiansAi.Lib/) ---
dotnet test --filter "Category!=RealServer"
dotnet test --filter "Category=RealServer"

# --- Studio (from agent-studio/) ---
npm test
```

## Before you open a PR

For **Server** changes: `dotnet test` in `XiansAi.Server` (includes Temporal and Lib-backed cycles).

For **Lib** changes: `dotnet test --filter "Category!=RealServer"` in `XiansAi.Lib`, plus the matching Server Lib-backed cycle if you changed an API agents call.

For **Studio** changes: `npm test` and `npm run lint`.

If a test fails, fix that failure before adding a second scenario on the same path. Prefer one status code and the fields that prove the behaviour.

## Troubleshooting

**`Xians.Lib.csproj` not found**  
Clone [XiansAi.Lib](https://github.com/XiansAiPlatform/XiansAi.Lib) next to `XiansAi.Server`. Restore the Server tests project again.

**First Temporal run is slow or waits on a download**  
Expected. The CLI is cached afterwards. Set `XIANS_TEMPORAL_CLI_PATH` if you already have `temporal` installed.

**Mongo-only tests suddenly talk to Temporal**  
You ran a class whose name contains `AdminApiTemporal`, or you ran unfiltered `dotnet test`. Mongo-only classes must **not** take a `TemporalFixture`.

**Need a single failing test’s logs**  
Raise console logging only for that run; the factory defaults to `Warning` so `dotnet test` stays readable. See [Host and fixtures](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/integration-tests/host.md).

## In-repo documentation

- [Server integration tests](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/integration-tests/index.md) — host, suites, Temporal, Lib cycles
- [Server tests README](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Tests/README.md) — short run commands
- [Xians.Lib.Tests](https://github.com/XiansAiPlatform/XiansAi.Lib/blob/main/Xians.Lib.Tests/README.md) — Lib unit / mock / RealServer
- [Platform development setup](platform-development.md) — clone and run Server, Lib, and Studio
