# Tool & Reasoning Logs

While an agent is thinking, the participant on the other end of the chat is staring at a blinking cursor. Agent Studio (and any frontend built on the messaging SDK) renders **reasoning** and **tool-execution** events as a live timeline — typing-style updates, "calling `getWeather(...)`", "got result: …" — so users see *what the agent is doing*, not just the final answer.

These aren't traditional "log files". They are first-class messages emitted via `UserMessageContext` from inside your message handler, and they ride the same channel back to the user as your final reply.

## The two emitters

Both methods live on `UserMessageContext` (the `context` you receive in a message handler):

| Method | Message type on the wire | Use it for |
| --- | --- | --- |
| `context.SendReasoningAsync(data, content?)` | `"reasoning"` | Narration of the agent's thought process — analyzing, planning, summarizing. Renders as the "thinking" stream in the Studio. |
| `context.SendToolExecAsync(data, content?)` | `"tool"` | Tool calls and tool results — what was invoked, with what arguments, and what came back. Renders as collapsible tool steps in the timeline. |

Both signatures are the same:

```csharp
Task SendReasoningAsync(object data, string? content = null);
Task SendToolExecAsync (object data, string? content = null);
```

- `data` — the structured payload (string, anonymous object, DTO). Stored as-is and shown in the Studio's expandable detail view.
- `content` — optional human-readable label rendered in the timeline; falls back to empty string.

## Minimal example: narrate before you work

The simplest use is a one-liner that tells the user "I'm on it" before kicking off a long-running step:

```csharp
public async Task<string> RunAsync(UserMessageContext context)
{
    await context.SendReasoningAsync(
        "Analyzing the user's question to identify the core requirements...");

    // ... do the actual work ...
    return finalAnswer;
}
```

That single call shows up in Agent Studio as a reasoning bubble in the live conversation, immediately, while the rest of the handler runs.

## Real-world example: streaming an LLM run

When you're driving a model that emits reasoning and tool-call updates as it streams, fan each update out to the right method. The `ProgressIndicators` example in `Xians.Examples` does exactly this:

!!! note "Example project reference"
    `Tracker` and `XiansChatMessageStore` live in the `Xians.Examples/ProgressIndicators` project, not in the core `Xians.Lib`. You can copy this pattern directly into your own agent or reference the examples project as a starting point.

```csharp
public async Task<string> RunAsync(UserMessageContext context)
{
    var tools = new MafSubAgentTools(context);

    var agent = _chatClient.CreateAIAgent(new ChatClientAgentOptions
    {
        ChatOptions = new ChatOptions
        {
            Instructions = "You are a helpful assistant. Use the available tools when relevant.",
            Tools =
            [
                AIFunctionFactory.Create(tools.GetCurrentDateTime),
                AIFunctionFactory.Create(tools.GetWeatherInfo),
            ],
        },
        ChatMessageStoreFactory = ctx => new XiansChatMessageStore(context),
    });

    await context.SendReasoningAsync(
        "Analyzing the user's question to identify the core requirements...");

    return await Tracker.StreamAgentAndReturnTextAsync(
        agent.RunStreamingAsync(context.Message.Text),
        context);
}
```

Inside `Tracker.StreamAgentAndReturnTextAsync`, each streamed update is routed to the matching emitter. Text fragments accumulate into the final reply; all other content types are broadcast as reasoning or tool events:

```csharp
await foreach (var update in updates)
{
    // Plain text chunks accumulate into the final reply — not emitted as events
    if (!string.IsNullOrEmpty(update.Text))
    {
        fullText.Append(update.Text);
        continue;
    }

    foreach (var content in update.Contents)
    {
        switch (content)
        {
            case TextContent text:
                fullText.Append(text.Text);
                break;

            case TextReasoningContent reasoning:
                await context.SendReasoningAsync(reasoning.Text);
                break;

            case FunctionCallContent call:
                var argText = string.Join(" ",
                    call.Arguments?.Select(kv => $"{kv.Key}={FormatArg(kv.Value)}") ?? []);
                await context.SendToolExecAsync($"[Tool Call] {call.Name}({argText})");
                break;

            case FunctionResultContent result:
                await context.SendToolExecAsync($"[Tool Result] → {ToPreview(result.Result)}");
                break;

            case DataContent data:
                await context.SendReasoningAsync($"[Data] {ToPreview(data.Data)}");
                break;

            case ErrorContent err:
                await context.SendReasoningAsync($"[Error] {err.Message}");
                break;

            case UsageContent usage when usage.Details is not null:
                await context.SendReasoningAsync(
                    $"[Usage] Total: {usage.Details.TotalTokenCount} tokens");
                break;

            // HostedFileContent, HostedVectorStoreContent, UriContent, etc.
            // → also routed to SendReasoningAsync in the full implementation
        }
    }
}
```

The Studio renders all of this as a chronological per-run timeline, with reasoning rows folded into a "thinking" group and tool rows shown as collapsible call/result pairs.

## What to put in `data` vs. `content`

| Goal | Use |
| --- | --- |
| Quick textual narration | `SendReasoningAsync("Analyzing the user's question...")` — pass a plain string as `data`. |
| Structured tool call | `SendToolExecAsync(new { tool = "getWeather", args = new { city } }, content: "Calling getWeather(Toronto)")` — `data` is queryable; `content` is what shows in the timeline. |
| Tool result | `SendToolExecAsync(new { tool = "getWeather", result = payload }, content: $"Got {payload.TempC}°C")` — keep `data` structured so the Studio can render it nicely on expand. |

## Best practices

- **Narrate transitions, not every line.** One reasoning event per logical step ("Analyzing…", "Calling weather API…", "Composing answer…"), not one per token.
- **Pair every tool call with its result.** Two events — one before the call, one after — so the timeline tells a complete story.
- **Keep `content` short, put detail in `data`.** The timeline label needs to fit on one line; the structured payload is what the user sees when they expand.
- **Redact at the call site.** PII, secrets, raw tokens — strip them *before* `SendReasoningAsync` / `SendToolExecAsync`. Anything you send is shown in the chat UI.
- **Don't fabricate reasoning.** Only emit reasoning events when the agent really is doing that step. Fake "thinking…" messages erode trust faster than no messages at all.

For free-form diagnostic logs that are *not* user-facing (server-side errors, debug traces), use the platform's logging surface ([Logging](../concepts/logging.md)) — those appear in the Studio's log views, not in the participant's chat.
