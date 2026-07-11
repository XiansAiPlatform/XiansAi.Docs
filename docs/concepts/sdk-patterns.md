# SDK Access Patterns

## Why This Matters

A common frustration with large SDKs is not knowing *where* to find an operation — is replying to a message on the agent? The workflow? Some global helper? Xians avoids this by following one rule: **every operation lives on its logical owner**.

- A *reply* belongs to the **message** being handled.
- *Knowledge*, *documents*, *schedules*, *tasks*, *secrets*, and *metrics* belong to the **agent**.
- Anything that crosses these boundaries (messaging any user, starting workflows) lives on the global **`XiansContext`**.

Once you internalize this rule, you can guess where any API lives without reading docs.

## Choosing the Right Pattern

```mermaid
graph TD
    Q{What are you doing?}
    Q -->|Responding to the message<br/>you're handling| M["context.ReplyAsync(...)<br/><b>UserMessageContext</b>"]
    Q -->|Reading/writing agent data<br/>knowledge, documents, schedules| A["XiansContext.CurrentAgent<br/><b>Agent</b>"]
    Q -->|Reaching outside<br/>other users, workflows| X["XiansContext.Messaging / Workflows<br/><b>XiansContext</b>"]
```

## Quick Reference

| Pattern | Owns | Available In | Examples |
|---------|------|--------------|----------|
| `UserMessageContext` | The message being handled | Message handlers only | `context.ReplyAsync()`, `context.GetChatHistoryAsync()` |
| `XiansContext.CurrentAgent` | Agent-level data & schedules | All workflows | `Knowledge.GetAsync()`, `Documents.SaveAsync()`, `Schedules.Create<T>()` |
| `XiansContext` (static) | Cross-cutting orchestration | All workflows | `Messaging.SendChatAsync()`, `Workflows.StartAsync<T>()` |

## The Patterns in Code

### 1. UserMessageContext — respond to *this* message

Passed into every message handler. Use it for anything tied to the current conversation.

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var userId = context.Message.ParticipantId;

    await context.ReplyAsync("Response");                 // reply to THIS message
    var history = await context.GetChatHistoryAsync();    // THIS conversation's history
});
```

### 2. CurrentAgent — the agent's data

Knowledge, documents, schedules, tasks, secrets, and metrics belong to the agent as a whole, shared across all its workflows.

```csharp
var knowledge = await XiansContext.CurrentAgent.Knowledge.GetAsync("system-instructions");

await XiansContext.CurrentAgent.Documents.SaveAsync(new Document
{
    Type = "user-preferences",
    Key = "user-123",
    Content = JsonSerializer.SerializeToElement(data)
});

await XiansContext.CurrentAgent.Schedules
    .Create<DailyReportWorkflow>("daily-report")
    .Daily(hour: 9, minute: 0)
    .CreateIfNotExistsAsync();
```

### 3. XiansContext — reaching beyond your boundary

Anything that touches *other* users or workflows.

```csharp
// Message any user (not just the one you're replying to)
await XiansContext.Messaging.SendChatAsync(
    text: "Your order shipped!",
    participantId: "user-456");

// Start a sub-workflow
await XiansContext.Workflows.StartAsync<NotificationWorkflow>(
    new object[] { "user-123", "message" },
    uniqueKey: "notify-123");
```

## Rule of Thumb

> If the operation is about the **message**, use the handler's `context`. If it's about **your agent's data** (including schedules), use `CurrentAgent`. Everything else is `XiansContext`.
