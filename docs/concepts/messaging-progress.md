# Message Progress

Between the moment a user sends a message and when the agent responds, you can stream **intermediate progress** to the user. This keeps the UI informed while the agent thinks, searches knowledge, or calls tools.

## Overview

Use the message context's progress methods inside `OnUserChatMessage` (or similar handlers). Each call sends an intermediate message to the user before the final reply. The frontend can render these as loading steps, thinking indicators, or tool execution logs.

## Reasoning Messages

Use `SendReasoningAsync` to stream the agent's thinking or reasoning steps:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.SendReasoningAsync("Analyzing the user's question to identify the core requirements...");
    // ... more processing ...
    await context.SendReasoningAsync("Breaking down the problem into logical steps.");
    // ...
    await context.ReplyAsync("Here's my analysis...");
});
```

- **Purpose**: Show internal reasoning or planning steps.
- **Method**: `SendReasoningAsync(object data, string? content = null)` — pass a string or object as `data`; use `content` for optional text.
- **Display**: Frontends typically show these as "thinking" or "reasoning" indicators.

## Tool Execution Messages

Use `SendToolExecAsync` to stream tool call steps:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.SendToolExecAsync("search_knowledge_base(query=\"best practices\")");
    // ... tool runs ...
    await context.SendToolExecAsync("format_response(template=\"user_friendly\")");
    // ...
    await context.ReplyAsync("Here's the result...");
});
```

- **Purpose**: Show which tools are being invoked (e.g., searches, lookups, formatting).
- **Method**: `SendToolExecAsync(object data, string? content = null)` — pass tool name/args as `data`; use `content` for optional text.
- **Display**: Frontends typically show these as "tool execution" or "calling..." steps.

## Example

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.SendReasoningAsync("Analyzing the user's question...");
    await context.SendToolExecAsync("search_knowledge_base(query=\"...\")");
    await context.SendReasoningAsync("Synthesizing findings...");
    await context.SendToolExecAsync("format_response(...)");
    await context.ReplyAsync("Here's my answer.");
});
```

Progress messages are intermediate: they appear while the agent works and before the final `ReplyAsync`. Use them to keep the user informed during longer processing.

## Related

- [Replying to User Messages](./messaging-replying.md) — `ReplyAsync`, `SendDataAsync`, and other response methods
