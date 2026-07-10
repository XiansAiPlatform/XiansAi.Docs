# Replying to User Messages

## Why Message Handlers?

Conversational agents spend most of their time doing one thing: receiving a user message and responding. Xians built-in workflows make this a one-liner — you register a **listener**, and every incoming message arrives as a rich `UserMessageContext` that already knows who sent it, which conversation it belongs to, and how to reply. You never manage connections, routing, or conversation state yourself.

!!! note "Replying vs. proactive messaging"
    This page covers **responding** to messages users send you. To *initiate* a message from a background workflow (notifications, alerts), use `XiansContext.Messaging` — see [Proactive Messaging](messaging-proactive.md).

## Registering Listeners

Register a handler per message type on a built-in workflow:

```csharp
var conversationalWorkflow = xiansAgent.Workflows.DefineSupervisor();

// Chat (plain text)
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.ReplyAsync($"You said: {context.Message.Text}");
});

// Data (structured payloads)
conversationalWorkflow.OnUserDataMessage(async (context) =>
{
    var data = context.Message.Data;
    await context.ReplyAsync("Data received and processed!");
});

// File uploads — see the File Upload page for details
conversationalWorkflow.OnFileUpload(async (context) =>
{
    foreach (var file in context.Message.Files)
    {
        var bytes = file.GetBytes();
    }
    await context.ReplyAsync("File received!");
});
```

> `DefineSupervisor()` creates a built-in workflow named **`Supervisor Workflow`** — the name Agent Studio connects to by default for user chat. See [Workflow Naming Conventions](../studio/workflow-conventions.md).

## The Incoming Message

Everything about the incoming message is on `context.Message`:

| Property | Type | Description |
|----------|------|-------------|
| `Text` | `string` | Text content |
| `Data` | `object?` | Structured payload |
| `Files` | `IReadOnlyList<UploadedFile>` | Decoded files (for `File` messages) |
| `ParticipantId` | `string` | Who sent it |
| `ThreadId` | `string?` | Conversation thread |
| `Scope` | `string?` | Topic within the thread (see below) |
| `RequestId` | `string` | Unique ID of this request |
| `TenantId` | `string` | Tenant (multi-tenancy) |
| `Hint` | `string?` | Optional handling hint |
| `Authorization` | `string?` | Auth token if provided |

## Ways to Respond

Pick the method based on what the *primary* content is:

| Method | Primary content | Example use |
|--------|-----------------|-------------|
| `ReplyAsync(text)` | Text | Normal conversation |
| `ReplyAsync(text, data)` | Text + attached data | "Order ready!" plus order details |
| `SendDataAsync(data, text?)` | Data | Charts, structured results |

```csharp
await context.ReplyAsync("Hello! How can I help?");

await context.ReplyAsync("Processing complete!", new { ProcessedItems = 42 });

await context.SendDataAsync(analyticsData, "Here are your analytics");
```

### Skipping the Response

Set `context.SkipResponse = true` to process a message silently (analytics, logging, background processing):

```csharp
if (context.Message.Text.StartsWith("LOG:"))
{
    context.SkipResponse = true;
    await LogSystemEvent(context.Message.Text);
    return;
}
```

## Threads and Scopes: How Conversations Are Organized

### Why threads?

Every user needs their own private, persistent conversation with each workflow. Xians handles this with **threads**: one thread per (Tenant, Workflow, Participant) combination. You never create threads — they exist automatically, persist forever, and are fully isolated from each other.

### Why scopes?

A single thread can cover many subjects — an order issue, a billing question, general chat. **Scopes** partition a thread into isolated topics, so history for one topic never bleeds into another.

```text
Thread  (Tenant + Workflow + Participant)
├── Scope: null              ← general conversation
│   ├── Message 1
│   └── Message 2
├── Scope: "Order #12345"    ← isolated topic
│   ├── Message 3
│   └── Message 4
└── Scope: "Technical Support"
    └── Message 5
```

Think of it as: **thread** = the book, **scope** = a chapter, **messages** = the pages.

### Scope rules

- Replies automatically **inherit the scope** of the incoming message — topic continuity is free.
- Chat history is **scope-isolated**: `GetChatHistoryAsync()` returns only messages in the current scope.
- `null` scope is itself an isolated context (the "general" conversation).
- Use **human-readable scope values** (they may be shown to users): `"Order #12345 - Delivery Status"`, not `"ord_12345_dlv"`.

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var scope = context.Message.Scope;

    // Returns only messages sharing this message's scope
    var history = await context.GetChatHistoryAsync(pageSize: 20);

    // This reply automatically keeps the same scope
    await context.ReplyAsync(scope != null
        ? $"Continuing our discussion about '{scope}'."
        : "General conversation.");
});
```

## Chat History

Use history to give context-aware responses. It's paginated — fetch only what you need:

```csharp
var recent = await context.GetChatHistoryAsync(page: 1, pageSize: 10);
```

Avoid fetching very large pages in real-time handlers; a small `pageSize` (5–20) is almost always enough.

## Hints and Metadata

```csharp
// Last hint provided for this conversation (user intent/context)
var lastHint = await context.GetLastHintAsync();

// Metadata set internally by the platform — never comes from the user
if (context.Metadata?.TryGetValue("priority", out var priority) == true && priority == "high")
{
    await HandleUrgentMessage(context);
}
```

## Best Practices

- **Handle errors gracefully** — wrap processing in try/catch and reply with a friendly message on failure; never leave the user without a response.
- **Be specific in replies** — "I've updated your preferences; daily summaries arrive at 9 AM" beats "Done".
- **Match the method to the content** — text goes in `ReplyAsync`, data-first responses in `SendDataAsync`.
- **Keep scopes human-readable** — they double as topic labels in the UI.

## Next Steps

- [Messaging – Progress](messaging-progress.md) — stream "working on it" updates before the final reply
- [Messaging – File Upload](messaging-fileupload.md) — handle files from users
- [Proactive Messaging](messaging-proactive.md) — initiate messages from background workflows
