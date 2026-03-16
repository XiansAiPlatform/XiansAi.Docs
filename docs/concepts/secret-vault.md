# Secret Vault

## Overview

Secret Vault is a secure key–value store for sensitive configuration such as external service Secrets, tokens, and webhook Secrets.  
Values are **encrypted at rest on the server** and access is controlled by **scope** (tenant, agent, user, activation).

Use Secret Vault when you need to:

- Store secrets centrally on the server instead of inside workflows or code
- Share secrets safely between workflows/agents in the same tenant
- Control access by tenant, agent, user, or activation

This guide shows how to:

- Configure encryption keys on the **server**
- Manage secrets via the **Admin API** (with API keys)
- Use secrets from **agents** via `Xians.Lib`
- Understand and choose the right **scope**

---

## 1. Server Setup – Encryption Keys

Secret Vault uses a **dedicated encryption key**:

- Config key: `EncryptionKeys:UniqueSecrets:SecretVaultKey`
- Fallback: `EncryptionKeys:BaseSecret` (only used if `SecretVaultKey` is missing)

Add the configuration (for local/dev) to `appsettings.json`:

```json
{
  "EncryptionKeys": {
    "BaseSecret": "your-base-secret-at-least-32-chars",
    "UniqueSecrets": {
      "TenantOidcSecretKey": "...",
      "SecretVaultKey": "xiansai_secret_vault_encryption_key_32bytes!!"
    }
  }
}
```

**Recommendations**

- Use a **unique**, random value for `SecretVaultKey` (≥ 32 characters)
- Do **not** commit production keys to source control
- For production, load the key from environment variables or a secret manager

Once the key is configured and the server is running, the Secret Vault endpoints are ready to use:

- **Admin API**: `/api/v1/admin/secrets` (API key auth)
- **Agent API**: `/api/agent/secrets` (client certificate auth)

---

## 2. Managing Secrets via Admin API (Admin API keys)

Admins can create and manage Secrets centrally using the Admin Secret Vault API.  
These endpoints are protected with **Admin API keys** issued to SysAdmins or TenantAdmins.

### 2.1 Authentication (Admin side)

- Base URL: your server (for example `https://your-server`)
- Auth: **Admin API key** as a Bearer token

```http
Authorization: Bearer <ADMIN_API_KEY>
```

### 2.2 Endpoints

Base path: `/api/v1/admin/secrets`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create secret. Key must be unique. |
| GET | `/` | List secrets (filter by tenantId, agentId, activationName). |
| GET | `/fetch?key=...` | Fetch secret by key with strict scope; returns **value only** (plus metadata). |
| PUT | `/` | Update secret (value, scope, additionalData) by key+scope. |
| DELETE | `/` | Delete secret by key+scope (query: key, tenantId?, agentId?, userId?, activationName?). |

### 2.3 Admin API Examples

#### Create a Secret

```http
POST /api/v1/admin/secrets HTTP/1.1
Host: your-server
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "key": "payment-api-key",
  "value": "sk_live_...",
  "tenantId": "tenant-1",
  "agentId": "billing-agent",
  "userId": null,
  "activationName": null,
  "additionalData": {
    "env": "prod",
    "service": "payments"
  }
}
```

#### List Secrets (optional filters)

```http
GET /api/v1/admin/secrets?tenantId=tenant-1&agentId=billing-agent HTTP/1.1
Host: your-server
Authorization: Bearer <ADMIN_API_KEY>
Accept: application/json
```

#### Fetch by Key (strict scope)

```http
GET /api/v1/admin/secrets/fetch?key=payment-api-key&tenantId=tenant-1&agentId=billing-agent HTTP/1.1
Host: your-server
Authorization: Bearer <ADMIN_API_KEY>
Accept: application/json
```

Response:

```json
{
  "value": "sk_live_...",
  "additionalData": {
    "env": "prod",
    "service": "payments"
  }
}
```

#### Update by Key + Scope

```http
PUT /api/v1/admin/secrets HTTP/1.1
Host: your-server
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "key": "payment-api-key",
  "value": "sk_live_rotated_...",
  "tenantId": "tenant-1",
  "agentId": "billing-agent",
  "userId": null,
  "activationName": null,
  "additionalData": {
    "env": "prod",
    "service": "payments",
    "rev": 2
  }
}
```

#### Delete by Key + Scope

```http
DELETE /api/v1/admin/secrets?key=payment-api-key&tenantId=tenant-1&agentId=billing-agent HTTP/1.1
Host: your-server
Authorization: Bearer <ADMIN_API_KEY>
Accept: application/json
```

### 2.4 AdditionalData Rules (Summary)

- Must be a **flat object**
- Values must be **string**, **number**, or **boolean**
- Max 50 keys, total serialized size ≤ 8 KB
- Not encrypted; for **metadata only**, not for secrets

---

## 3. Using Secrets from Agents (`Xians.Lib`)

Agents access Secret Vault through the `Xians.Lib` Secret Vault collection.  
To use the Secret Vault feature from agents, your Agent API key must correspond to a **SysAdmin** or **TenantAdmin** identity.

### 3.1 Setting a Scoped Builder

All operations go through a **scope builder**:

```csharp
using Xians.Lib.Agents.Secrets;

// 1) Resolve tenant from context/options (or cross-tenant for system-scoped agents)
//    Scope() will:
//    - Use XiansContext.SafeTenantId when available (typical in workflows), or
//    - Fall back to the agent's certificate tenant for non-system-scoped agents, or
//    - Use null (cross-tenant) for system-scoped agents with no tenant in context.
var fromContextOrCert = agent.Secrets.Scope();

// 2) Explicit tenant scope: secret is only for that tenant.
var explicitTenant = agent.Secrets.Scope()
    .TenantScope("tenant-1");

// 3) Explicit cross-tenant secret: TenantScope(null) sends tenantId: null (no tenant scope).
var crossTenant = agent.Secrets.Scope()
    .TenantScope(null);

// Further refine scope (tenant + agent + user + activation):
var secrets = agent.Secrets.Scope()
    .TenantScope("tenant-1")
    .AgentScope(agent.Name)
    .UserScope("user-1")
    .ActivationScope("activation-1");
```

You can also use convenience methods:

```csharp
// Full scope in one call
var full = agent.Secrets.WithScope("tenant-1", "billing-agent", "user-1");
```

### 3.2 Create, List, Fetch, Update, Delete from Agents

```csharp
// Choose a scope
var scoped = agent.Secrets.TenantScope("tenant-1", "billing-agent");

// Create
await scoped.CreateAsync(
    key: "payment-api-key",
    value: "sk_live_...",
    additionalData: new { env = "prod", service = "payments" }
);

// List (metadata only; no values)
var list = await scoped.ListAsync();

// Fetch by key with the same scope
var fetched = await scoped.FetchByKeyAsync("payment-api-key");
if (fetched != null)
{
    var secretValue = fetched.Value; // "sk_live_..."
}

// Update by key + scope (omit scope params to use the builder's current scope)
await scoped.UpdateByKeyAsync(
    key: "payment-api-key",
    value: "sk_live_rotated_...",
    additionalData: new { env = "prod", service = "payments", rev = 2 }
);

// Delete by key + scope
var deleted = await scoped.DeleteByKeyAsync("payment-api-key");
```

---

## 4. Scopes – How Access Works

Each secret can be scoped across four dimensions:

| Scope          | Meaning when set                         | When null                          |
|----------------|-------------------------------------------|------------------------------------|
| `tenantId`     | Secret only for that tenant              | Cross-tenant (any tenant)         |
| `agentId`      | Secret only for that agent               | All agents                        |
| `userId`       | Only that user can access                | Any user                          |
| `activationName` | Only that activation can access        | Any activation of the agent       |

### 4.1 How scopes behave

If you omit a scope method, the effective access is:

- **TenantScope**: If you do not call `TenantScope(...)`, `Scope()` uses the tenant from `XiansContext` or the agent's certificate; system-scoped agents with no tenant in context get cross-tenant (`null`).
- **AgentScope**: If you do not call `AgentScope(...)`, the secret is available across all agents in that tenant.
- **UserScope**: If you do not call `UserScope(...)`, any user in that tenant may access it (subject to server-side auth).
- **ActivationScope**: If you do not call `ActivationScope(...)`, any activation of the agent can access it.

If you **do set** a scope value, then the secret is limited to that specific tenant / agent / user / activation, and you should use the **same scope** when reading, updating and deleting it back.

---

## 5. Common Usage Patterns

### 5.1 Per-Tenant Secret

Use when each tenant has its own Secret (for example, a tenant-specific API key or webhook signing Secret).

**Admin (one-time setup)**

- Create one Secret per tenant via Admin API or a setup script.

**Agent usage**

```csharp
var tenantSecrets = agent.Secrets.TenantScope(tenantId);

var secret = await tenantSecrets.FetchByKeyAsync("tenant-secret");
if (secret == null)
{
    throw new InvalidOperationException("Tenant Secret is not configured.");
}

// Use secret.Value in your HTTP client or SDK
```

### 5.2 Per-Agent Secret

Use when each agent needs its own Secret, isolated from other agents in the same tenant.

```csharp
var agentScoped = agent.Secrets
    .Scope()
    .TenantScope(tenantId)
    .AgentScope(agent.Name);

await agentScoped.CreateAsync("agent-secret", secretValue);

var secret = await agentScoped.FetchByKeyAsync("agent-secret");
```

### 5.3 Per-User Secret

Use when you need to store Secrets that are specific to a user (for example, OAuth tokens or per-user API tokens).

```csharp
var userScoped = agent.Secrets
    .Scope()
    .TenantScope(tenantId)
    .AgentScope(agent.Name)
    .UserScope(userId);

// Store Secret
await userScoped.CreateAsync("user-secret", secretValue);

// Later: use
var secret = await userScoped.FetchByKeyAsync("user-secret");
```

### 5.4 Per-Activation Secret (Workflow Instance)

Use when a specific workflow/activation needs its own Secret (for example, a one-off integration Secret).

```csharp
var activationScoped = agent.Secrets
    .Scope()
    .TenantScope(tenantId)
    .AgentScope(agent.Name)
    .ActivationScope("activation-1"); // often from XiansContext.SafeIdPostfix

await activationScoped.CreateAsync("activation-secret", keyValue);

var secret = await activationScoped.FetchByKeyAsync("activation-secret");
```

---

## 6. Admin vs Agent Responsibilities

- **Admin API (with Admin API key)**
  - Bootstrap Secrets (create/update/delete) across tenants
  - Audit and inspect configuration
  - Use when operating from admin tools, scripts, or CI

- **Agent API (`Xians.Lib`, certificate-based)**
  - Consume Secrets safely inside workflows and activities using an Agent API key that wraps a client certificate
  - Create/update Secrets within the tenant context when appropriate
  - Enforces scope validation in workflows for defence in depth

---

## 7. Quick Checklist

Before using Secret Vault in your solution:

- **Server**
  - [ ] `EncryptionKeys:UniqueSecrets:SecretVaultKey` configured
  - [ ] Admin API key created for `/api/v1/admin/secrets` (if admins will manage secrets)
  - [ ] Agent certificates configured for `/api/agent/secrets`

- **Agent**
  - [ ] `XiansPlatform` initialized with ServerUrl and client certificate
  - [ ] `agent.Secrets` used with correct scope (tenant/agent/user/activation)
  - [ ] `FetchByKeyAsync` always called with the same scope that was used to create the secret

