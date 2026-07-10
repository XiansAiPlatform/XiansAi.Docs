# Document DB

## Why Document DB?

Agents need to **remember things** between executions — customer profiles, order state, sessions, event logs. Standing up and migrating a relational database for every agent is heavy, and the data agents store is rarely relational anyway. Document DB gives every agent a built-in, schema-less JSON store with automatic isolation: no schema design, no migrations, no manual tenant filtering.

| | Traditional database | Document DB |
|---|---|---|
| Schema | Designed up front, migrations forever | None — store any JSON |
| New field | Migration script | Just add it |
| Isolation | You implement it | Automatic (agent, tenant, context) |
| Identifiers | Auto-increment IDs / UUIDs | Human-readable Type + Key |

## The Type + Key Model

Every document has two organizing fields, and understanding them is 90% of using Document DB well:

- **`Type`** — the category: *what kind of data is this?* (`"user-profile"`, `"order"`, `"session"`, `"config"`)
- **`Key`** — the semantic identifier: *which specific one?* (`"user-12345"`, `"order-2024-001"`, `"email-smtp"`)

Together they uniquely identify a document, so you retrieve data without ever tracking GUIDs:

```text
Agent: "OrderProcessingAgent"
├── Type: "user-profile"
│   ├── Key: "user-001" → { name, email, plan }
│   └── Key: "user-002" → { name, email, plan }
├── Type: "order"
│   ├── Key: "order-2024-001" → { items, total, status }
│   └── Key: "order-2024-002" → { items, total, status }
└── Type: "config"
    └── Key: "payment-gateway" → { apiKey, endpoint }
```

> **Golden rule:** if you can phrase your need as "I need the `{Type}` for `{Key}`" — *the user-profile for user-12345* — you're modeling it right.

### Defaults that make Type + Key work

| Default | Value | Effect |
|---------|-------|--------|
| `UseKeyAsIdentifier` | `true` | Type+Key is the unique identifier |
| `Overwrite` | `true` | Saving the same Type+Key updates the document |
| `TtlMinutes` | `null` | Documents persist until deleted |

Override any of these via `DocumentOptions` when saving.

## Core Operations

```csharp
// Save — creates or updates the document for this Type+Key
await agent.Documents.SaveAsync(new Document
{
    Type = "user-preferences",
    Key = $"user-{userId}",
    Content = JsonSerializer.SerializeToElement(preferences)
});

// Retrieve by Type + Key — no GUID needed
var prefs = await agent.Documents.GetByKeyAsync("user-preferences", $"user-{userId}");

// Update / delete / existence
await agent.Documents.UpdateAsync(doc);
await agent.Documents.DeleteAsync(docId);
await agent.Documents.DeleteManyAsync(new[] { id1, id2 });
bool exists = await agent.Documents.ExistsAsync(docId);
```

### Querying

```csharp
var activeUsers = await agent.Documents.QueryAsync(new DocumentQuery
{
    Type = "user-profile",
    MetadataFilters = new Dictionary<string, object>
    {
        ["status"] = "active",
        ["plan"] = "premium"
    },
    Limit = 50
});
```

Queries are **automatically scoped**: `AgentId` is always applied, and inside workflow contexts `ActivationName` and `ParticipantId` are added too. You never see another agent's — or another user's — documents unless you explicitly override the scope in the query.

## Automatic Scoping and Metadata

Why don't you need `WHERE tenant_id = ...` anywhere? Because every document is enriched and every operation is filtered automatically:

| Level | Field(s) | Guarantee |
|-------|----------|-----------|
| Agent | `AgentId` | Agents can't read each other's documents |
| Context | `ActivationName`, `ParticipantId`, `WorkflowId` | Set when saving inside workflows — per-instance and per-user isolation |
| Tenant | (headers) | Multi-tenant security on every operation |
| Audit | `CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy` | Timestamps and user info for free |

```csharp
// Agent "OrderProcessor" saves a document
var doc = await orderAgent.Documents.SaveAsync(myDoc);

// Agent "UserManager" tries to read it
var result = await userAgent.Documents.GetAsync(doc.Id);
// Returns null — different agent, access denied
```

## Time-to-Live for Temporary Data

Documents persist forever by default. For sessions, caches, and other ephemeral data, set a TTL and let cleanup happen automatically:

```csharp
await agent.Documents.SaveAsync(sessionDoc, new DocumentOptions
{
    TtlMinutes = 30   // auto-deleted after 30 minutes
});
```

## Common Patterns

```csharp
// User preferences — one document per user, updated in place
await agent.Documents.SaveAsync(new Document
{
    Type = "user-preferences",
    Key = userId,
    Content = JsonSerializer.SerializeToElement(prefs)
});

// Event log — no Key needed when documents are append-only
await agent.Documents.SaveAsync(new Document
{
    Type = "analytics-event",
    Content = JsonSerializer.SerializeToElement(new { Event = "purchase", UserId = userId, Amount = 99.99 }),
    Metadata = new Dictionary<string, object> { ["category"] = "revenue" }
});
```

## When Not to Use It

- **No joins** — it's not a relational database; denormalize or restructure your data.
- **No large binaries** — use blob storage (or [file upload](messaging-fileupload.md) for user files).
- **Not for high-frequency writes** — add a caching layer for hot paths.

Document DB is your agent's **persistent memory**: configuration, state, user data, and anything it needs to remember between runs.
