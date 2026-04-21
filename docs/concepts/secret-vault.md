# Secret Vault

## Where Your Agent Keeps Its Secrets

Your agent needs an OpenAI key. A webhook secret. A user's OAuth token. You **don't** want any of that in source control, environment variables sprawled across deployments, or a config file that everyone on the team can read.

Secret Vault is encrypted, scoped key-value storage that lives next to your agent — and reaches it through the same client certificate it uses for everything else.

## The Mental Model: Start Wide, Narrow As Needed

Most secrets belong to a **tenant**. Some belong to a specific **agent**. A few are personal to a **participant** (a single user). And occasionally a secret only makes sense for one **activation** of an agent.

The API mirrors that:

```text
TenantScope()                                ← tenant only (most common)
   └── .AgentScope()                         ← + this agent
          └── .ParticipantScope()            ← + this participant
                 └── .ActivationScope()      ← + this activation
```

Each step has two flavors:

- **No-arg** — auto-resolves the value from the current `XiansContext` (workflow, activity, message handler).
- **`(string?)`** — explicit value, or `null` to broaden that dimension back.

Inside a workflow you almost never type an id by hand.

## Quick Start

```csharp
// Tenant-only secret (the common case)
var vault = XiansContext.CurrentAgent.Secrets.TenantScope();

var created = await vault.CreateAsync("openai-api-key", "sk-...");
var fetched = await vault.FetchByKeyAsync("openai-api-key");
Console.WriteLine(fetched?.Value);   // "sk-..."

await vault.UpdateAsync(created.Id, value: "sk-rotated");
await vault.DeleteAsync(created.Id);
```

That's the whole loop: scope → CRUD.

## Narrowing in Practice

```csharp
// One agent, all users — e.g. an agent-wide service token
var perAgent = agent.Secrets
    .TenantScope()
    .AgentScope();

// One agent, one user — e.g. a user's GitHub OAuth token
var perUser = agent.Secrets
    .TenantScope()
    .AgentScope()
    .ParticipantScope();

// One activation only — e.g. a per-deployment webhook secret
var perActivation = agent.Secrets
    .TenantScope()
    .AgentScope()
    .ActivationScope();
```

Need to override a dimension? Use the explicit overload (or pass `null` to broaden):

```csharp
agent.Secrets.TenantScope("tenant-2").AgentScope("billing-agent");

agent.Secrets.TenantScope().AgentScope().ParticipantScope(null);  // back to agent-wide
```

## Strict Scope on Read

Fetching a secret is **strict** — the scope on the read must exactly match the scope on the write. A tenant-only secret cannot be fetched with a participant scope, and vice versa.

This is a feature, not a bug:

- Cross-tenant reads are impossible by construction.
- A bug in your workflow can't accidentally hand a participant their neighbor's token.
- You always know what scope a secret was created at — it's the same one you use to read it.

## Defense in Depth

When you call into the vault from inside a workflow or activity, the SDK validates the scope you set against the live `XiansContext` **before** any HTTP request. Asking for `tenant-2`'s secret while serving a `tenant-1` request throws immediately with a clear message.

The server then enforces tenant isolation a second time using your client certificate. Two locks, one key.

## Optional Metadata

Attach non-sensitive metadata alongside a secret — useful for environment, service name, rotation notes, etc.:

```csharp
await vault.CreateAsync(
    "stripe-webhook-secret",
    "whsec_xxx",
    additionalData: new { env = "prod", service = "payments", rotates = "quarterly" });
```

Rules: flat object only, values must be string / number / boolean, ≤ 8 KB. **Never** put sensitive material here — it's stored as sanitized JSON, not encrypted like the value.

## Common Patterns

### Per-tenant API key (shared across the tenant)

```csharp
var v = agent.Secrets.TenantScope();
await v.CreateAsync("openai-api-key", apiKey);
var key = (await v.FetchByKeyAsync("openai-api-key"))?.Value;
```

### Per-user OAuth token

```csharp
var v = agent.Secrets.TenantScope().AgentScope().ParticipantScope();
await v.CreateAsync("github-token", token);
var token = (await v.FetchByKeyAsync("github-token"))?.Value;
```

### Listing what's there

```csharp
foreach (var item in await agent.Secrets.TenantScope().ListAsync())
{
    Console.WriteLine($"{item.Key} ({item.Id})");   // values are NOT returned by List
}
```

## Escape Hatch

For admin or cross-tenant flows where no scoping is appropriate, opt out explicitly:

```csharp
var unbound = agent.Secrets.ScopeUnbound();
```

Use this sparingly — and never from a regular workflow handling user traffic.

## What You Get

- **Encrypted at rest** — AES-256-GCM on the server; the SDK never sees the ciphertext
- **Scoped by tenant / agent / participant / activation** — built into the API, enforced on read
- **Context-aware** — no-arg setters pick up the live tenant, agent, and participant automatically
- **Strict-match reads** — fetch scope must equal write scope
- **Client-side validation** — scope vs. context mismatches throw before any HTTP call
- **Same auth as Knowledge / Documents** — client certificate, no extra setup
- **Optional metadata** — attach non-sensitive context (env, service, rotation notes)

## What It's NOT

- Not a generic config store — use Document DB for non-sensitive structured data
- Not a password manager — store machine-to-machine secrets, not human credentials
- Not for binary blobs — values are strings (encrypt-at-rest, plaintext over TLS)
- Not for very high-frequency reads — fetch once, cache in memory for the hot path

## Quick Reference

| Entry point | Use when |
| --- | --- |
| `agent.Secrets.TenantScope()` | Common case — tenant-wide secret |
| `agent.Secrets.TenantScope(tenantId)` | Explicit tenant (admin / cross-tenant tools) |
| `agent.Secrets.ScopeUnbound()` | No scope at all (admin only) |
| `agent.Secrets.Scope()` | Alias for `TenantScope()` (kept for back-compat) |

| Narrowing setter | Auto value | Explicit overload |
| --- | --- | --- |
| `.AgentScope()` | current agent | `.AgentScope(agentId)` — pass `null` to broaden |
| `.ParticipantScope()` | current participant | `.ParticipantScope(participantId)` — pass `null` to broaden |
| `.ActivationScope()` | current activation | `.ActivationScope(activationName)` — pass `null` to broaden |

| CRUD | Returns |
| --- | --- |
| `CreateAsync(key, value, additionalData?)` | `SecretVaultGetResponse` |
| `FetchByKeyAsync(key)` | `SecretVaultFetchResponse?` (value + metadata) |
| `ListAsync()` | `List<SecretVaultListItem>` (no values) |
| `GetByIdAsync(id)` | `SecretVaultGetResponse?` |
| `UpdateAsync(id, value?, ...)` | `SecretVaultGetResponse` |
| `DeleteAsync(id)` | `bool` |

## What's Next?

- **[Operating Context](context.md)** — what `XiansContext` knows about the current tenant, agent, and participant
- **[Multitenancy](multitenancy.md)** — how scope isolation works across the platform
- **[Document DB](document-db.md)** — for non-sensitive structured storage

---

**Bottom line**: Tenant-scope by default, narrow when you need to, never type an id you don't have to. Your secrets stay encrypted, scoped, and out of your config files.
