# Partner Isolation

By default every tenant on a Xians deployment shares the same Temporal cluster — the one configured via `Temporal__FlowServerUrl` / `Temporal__FlowServerNamespace` in the server's [installation](installation.md) config. Partner isolation lets a system administrator give an individual tenant its **own dedicated Temporal server connection** instead, so that tenant's workflows, task queues, and execution history run on a completely separate Temporal cluster or namespace.

This is workflow/orchestration-plane isolation. It does not isolate MongoDB — all tenants still share the same database, scoped by `tenantId` as usual. Use partner isolation when a partner or customer needs their agent workloads to run on infrastructure that is separate from the shared platform cluster, not as a substitute for tenant scoping elsewhere in the system.

## Why isolate a tenant

- **Data residency / compliance** — a partner requires their workflow execution data to live in a specific region or Temporal Cloud namespace they control.
- **Blast-radius isolation** — a noisy or high-volume tenant's workflows shouldn't be able to degrade Temporal task-queue throughput for every other tenant on the shared cluster.
- **Contractual isolation** — an enterprise partner's agreement requires dedicated infrastructure rather than a multi-tenant shared cluster.

## How it works

Each tenant can have an optional `TenantTemporalConfig` override, stored in the `tenant_temporal_config` MongoDB collection. When a workflow client is requested for a tenant, `TemporalGatewayService` resolves the connection to use, in order:

1. **Tenant override** — an active (non-reverted) `TenantTemporalConfig` document for that tenant, if one exists.
2. **Per-tenant appsettings** — a `Tenants:{tenantId}:Temporal` configuration section, if defined.
3. **Platform default** — the global `Temporal` section (`Temporal__FlowServerUrl` / `Temporal__FlowServerNamespace`).

The override stores a `ServerUrl`, a `Namespace`, and an optional mTLS client `Certificate` + `PrivateKey` pair (both base64-encoded) for connecting to Temporal Cloud or any TLS-secured cluster. Temporal clients are cached per tenant/config; saving or reverting an override evicts that tenant's cached clients immediately so the next request reconnects using the new configuration.

## Templates and cross-tenant activations

A template always carries the Temporal connection of the tenant that created it — not of whichever tenant later activates it. Concretely:

- A template built in a tenant that has a dedicated Temporal override always uses that specific Temporal server, for every activation created from it, in every tenant.
- This holds even when the activating tenant itself has no override and normally uses the platform's default Temporal cluster for its own agents.

This works because every agent record keeps track of its `OriginTenant` — the tenant that created the template it was deployed from. When `TemporalGatewayService` resolves a connection for an activation, it looks up the config for the agent's `OriginTenant`, not the tenant the activation happens to be running under. So if tenant `partner-a` creates a template while its own dedicated Temporal override is active, and tenant `partner-b` (on the shared default cluster) later deploys and activates that template, the resulting activation still connects to `partner-a`'s dedicated Temporal server — `partner-b`'s own workflows keep running on the default cluster as normal.

In short: **the template's origin tenant's Temporal connection wins**, regardless of which tenant runs the activation.

## Setting up isolation for a tenant

### Via Agent Studio

Go to **Tenant Settings → Temporal Server** (`/tenant-settings/temporal`) as a tenant admin, or the equivalent system-admin view for the target tenant:

1. Toggle **Use a dedicated Temporal connection** on.
2. Fill in **Server URL** (e.g. `your-namespace.tmprl.cloud:7233`) and **Namespace**.
3. Optionally paste a base64-encoded **client certificate** and **private key** for mTLS (Temporal Cloud requires this; a self-hosted cluster may not).
4. Click **Test connection** to validate before saving — this connects to the server, and will auto-register the namespace (with a 30-day workflow execution retention period) and any missing required search attributes if they don't already exist.
5. Click **Save**.

Toggling the switch off removes the override and reverts the tenant to the platform's default Temporal server; because an override already exists at that point, the UI asks for confirmation first.

!!! warning "Restart workers after changing or reverting"
    Only **new** connections pick up a saved or reverted configuration. Agent worker instances that are already running keep using the Temporal server they connected to at startup — restart them after changing a tenant's Temporal override for the change to take effect.

### Via the Admin API

SysAdmin-only endpoints under `/api/v1/admin/tenants/{tenantId}/temporal-config`:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/temporal-config` | Returns the tenant's current override, or `null` if none is configured. |
| `PUT` / `POST` | `/temporal-config` | Creates or replaces the tenant's override. Body: `{ tenantId, serverUrl, namespace, certificate?, privateKey? }`. |
| `POST` | `/temporal-config/test-connection` | Validates connectivity for a given `serverUrl` / `namespace` / certificate pair without saving it. |
| `POST` | `/temporal-config/revert` | Removes the tenant's override and falls back to the platform default. |

`certificate` and `privateKey` must be provided together or not at all. If you save an update without them, the previously stored certificate/private key for that tenant is kept.

## Configuration requirement

Stored certificates and private keys are encrypted at rest using a dedicated encryption key. This must be configured on the server before saving any tenant override with mTLS credentials:

```bash
EncryptionKeys__UniqueSecrets__TenantTemporalSecretKey=<random-base64>
```

If this key isn't set, the server falls back to `EncryptionKeys__BaseSecret` and logs a warning — set a dedicated key in production. See [Encryption keys](installation.md#encryption-keys-required) in the installation guide for how to generate it.

## Reverting isolation

Reverting (via the UI switch or `POST /temporal-config/revert`) marks the tenant's override as reverted rather than deleting it outright, and immediately evicts any cached Temporal clients for that tenant. The next workflow client requested for the tenant reconnects using the platform default (or the `Tenants:{tenantId}:Temporal` appsettings override, if one is defined). As with saving a new override, already-running worker instances need a restart to stop using the old dedicated connection.
