# Document DB

## Flexible Data Storage for AI

Your agents need to **remember things**. Customer profiles, order history, session data, analytics—structured information that doesn't fit neatly into prompts. Document DB gives your agents a schema-less, queryable memory that scales.

## The Data Storage Problem

**Traditional Databases:**

- Define rigid schema → Hope you got it right
- Need a new field? → Migration script, downtime, anxiety

**Document DB:**

- Store JSON documents → No schema needed
- New field? → Just add it
- Query flexibly → Find exactly what you need

## Understanding Type and Key

The foundation of Document DB is built on two critical fields:

### Type: Your Document Categories

`Type` is how you organize documents into logical groups. Think of it as your document's category:

```csharp
Type = "user-profile"     // Customer data
Type = "session"          // Active sessions
Type = "order"            // Purchase history
Type = "preferences"      // User settings
Type = "analytics-event"  // Event logs
```

**Why it matters:**
- Query all documents of a specific type
- Organize your data semantically
- Create natural data partitions per use case

### Key: Your Semantic Identifier

`Key` is a human-readable, business-meaningful identifier. Instead of random UUIDs, use keys that make sense:

```csharp
Key = "user-12345"           // User ID from your system
Key = "session-abc-def"      // Session identifier
Key = "order-2024-001"       // Order number
Key = "config-email-smtp"    // Configuration name
```

**Why it matters:**
- Instantly know what the document is
- Debug easily in logs and dashboards
- Retrieve without remembering random IDs

### Type + Key: Powerful Lookup

The real magic happens when you combine them:

```csharp
// Save with Type + Key as unique identifier
var doc = new Document
{
    Type = "user-preferences",
    Key = "user-12345",
    Content = JsonSerializer.SerializeToElement(prefs)
};

await agent.Documents.SaveAsync(doc, new DocumentOptions
{
    UseKeyAsIdentifier = true,  // Type+Key becomes the unique identifier
    Overwrite = true            // Update if already exists
});

// Retrieve directly with Type + Key
var userPrefs = await agent.Documents.GetByKeyAsync("user-preferences", "user-12345");
```

**The Pattern:**
```
Type = "What kind of data?"
Key = "Which specific instance?"
Type + Key = "Exactly this document"
```

Each agent can have multiple document types, and each type can have many documents with unique keys. This creates a powerful, self-documenting data organization system.

## Core Operations

Every agent gets its own document collection. Documents are automatically scoped to your agent—no manual filtering required.

### Save & Retrieve

```csharp
// Save any JSON-serializable data
var profile = new Document
{
    Type = "user-profile",
    Content = JsonSerializer.SerializeToElement(new
    {
        Name = "Alice",
        Plan = "premium",
        Credits = 1000
    })
};

var saved = await agent.Documents.SaveAsync(profile);

// Get it back
var retrieved = await agent.Documents.GetAsync(saved.Id);
```

### Working with Type + Key

Practical examples of the Type+Key pattern:

```csharp
// User preferences: One document per user
await agent.Documents.SaveAsync(new Document
{
    Type = "user-preferences",
    Key = $"user-{userId}",
    Content = JsonSerializer.SerializeToElement(preferences)
}, new DocumentOptions { UseKeyAsIdentifier = true, Overwrite = true });

// Configuration: Named settings
await agent.Documents.SaveAsync(new Document
{
    Type = "config",
    Key = "email-templates",
    Content = JsonSerializer.SerializeToElement(templates)
}, new DocumentOptions { UseKeyAsIdentifier = true, Overwrite = true });

// Retrieve by Type + Key - no GUID needed!
var userPrefs = await agent.Documents.GetByKeyAsync("user-preferences", $"user-{userId}");
var emailConfig = await agent.Documents.GetByKeyAsync("config", "email-templates");
```

### Query & Filter

Find exactly what you need:

```csharp
// Query by type
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

### Update & Delete

```csharp
// Update
profile.Content = JsonSerializer.SerializeToElement(new { Credits = 500 });
await agent.Documents.UpdateAsync(profile);

// Delete one
await agent.Documents.DeleteAsync(profileId);

// Delete many
await agent.Documents.DeleteManyAsync(new[] { id1, id2, id3 });

// Check existence
bool exists = await agent.Documents.ExistsAsync(profileId);
```

## Advanced Features

### Time-to-Live (TTL)

Auto-expire temporary data:

```csharp
var session = new Document
{
    Type = "session",
    Content = JsonSerializer.SerializeToElement(new { Token = "abc123" })
};

await agent.Documents.SaveAsync(session, new DocumentOptions
{
    TtlMinutes = 60  // Expires in 1 hour
});
```

### Metadata Enrichment

Every document automatically includes:
- `AgentId` - Scoped to your agent
- `WorkflowId` - Linked to the workflow that created it (when applicable)
- `CreatedAt`, `UpdatedAt` - Automatic timestamps
- `ExpiresAt` - When TTL is set

### Agent Isolation

Documents are private to each agent. Agent A cannot access Agent B's documents—it's automatic:

```csharp
// Agent 1 saves a document
var doc = await agent1.Documents.SaveAsync(myDoc);

// Agent 2 tries to get it
var result = await agent2.Documents.GetAsync(doc.Id);
// Returns null - different agent, can't access
```

## Common Patterns

### Document Organization by Type

Here's how an e-commerce agent might organize its documents:

```
Agent: "OrderProcessingAgent"
├── Type: "user-profile"
│   ├── Key: "user-001" → { name, email, plan }
│   ├── Key: "user-002" → { name, email, plan }
│   └── Key: "user-003" → { name, email, plan }
│
├── Type: "order"
│   ├── Key: "order-2024-001" → { items, total, status }
│   ├── Key: "order-2024-002" → { items, total, status }
│   └── Key: "order-2024-003" → { items, total, status }
│
├── Type: "session"
│   ├── Key: "session-abc" → { userId, cart, expires }
│   └── Key: "session-xyz" → { userId, cart, expires }
│
└── Type: "config"
    ├── Key: "payment-gateway" → { apiKey, endpoint }
    └── Key: "shipping-rates" → { zones, rates }
```

**Query examples:**
```csharp
// Get all orders
var orders = await agent.Documents.QueryAsync(new DocumentQuery { Type = "order" });

// Get specific user profile
var profile = await agent.Documents.GetByKeyAsync("user-profile", "user-001");

// Get configuration
var paymentConfig = await agent.Documents.GetByKeyAsync("config", "payment-gateway");
```

### User Preferences Store

```csharp
public async Task SaveUserPreferences(string userId, object prefs)
{
    var doc = new Document
    {
        Type = "user-preferences",
        Key = userId,
        Content = JsonSerializer.SerializeToElement(prefs)
    };
    
    await agent.Documents.SaveAsync(doc, new DocumentOptions
    {
        UseKeyAsIdentifier = true,
        Overwrite = true
    });
}
```

### Session Cache

```csharp
var session = new Document
{
    Type = "session",
    Key = sessionId,
    Content = JsonSerializer.SerializeToElement(sessionData)
};

await agent.Documents.SaveAsync(session, new DocumentOptions
{
    UseKeyAsIdentifier = true,
    TtlMinutes = 30,  // Auto-cleanup
    Overwrite = true
});
```

### Event Log

```csharp
var event = new Document
{
    Type = "analytics-event",
    Content = JsonSerializer.SerializeToElement(new
    {
        Event = "purchase",
        UserId = userId,
        Amount = 99.99,
        Timestamp = DateTime.UtcNow
    }),
    Metadata = new Dictionary<string, object>
    {
        ["category"] = "revenue",
        ["priority"] = "high"
    }
};

await agent.Documents.SaveAsync(event);
```

**Golden Rule:** If you can describe your data as "I need the `{Type}` for `{Key}`", you're doing it right.

Examples:

- "I need the **user-profile** for **user-12345**"
- "I need the **session** for **session-abc-123**"  
- "I need the **config** for **email-smtp**"

## What You Get

- **Schema-less** - Store any JSON structure  
- **Auto-scoped** - Documents isolated per agent  
- **Type-based categorization** - Organize by document type  
- **Semantic keys** - Human-readable identifiers  
- **Type + Key lookup** - Direct retrieval without GUIDs  
- **Queryable** - Filter by type, metadata, keys  
- **TTL Support** - Auto-expire temporary data  
- **Scalable** - Handles small configs to large datasets  
- **Type-safe** - Full C# typing with `JsonSerializer`

## What It's NOT

- Not a relational database (no joins)  
- Not for large binary files (use blob storage)  
- Not for high-frequency writes (use caching layers)

Document DB is your agent's **persistent memory**. Use it for configuration, state, user data, and anything your agent needs to remember between executions.
