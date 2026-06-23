# Agent Studio

## What Agent Studio Is

Agent Studio is the **web console** for the XiansAi platform — the place where humans (rather than SDK code) configure, observe, and operate the agents your team has deployed. It sits in front of the same APIs your agents use, so anything you do in the Studio is just a UI on top of the platform's tenant-scoped, certificate-authenticated services.

If the SDK is how agents *act*, the Studio is how people *manage*.

!!! info "Setting up a new server?"
    If this is a **fresh XiansAi Server installation**, stand up Agent Studio first by following the [Installation guide](installation.md). It covers configuring the `.env` file, running locally from source, and deploying the published DockerHub image. Once the Studio is running and you've signed in, the rest of this page explains how to operate it.

## Studio Roles

Access to Agent Studio is governed by **three** roles. The first two are tenant-scoped and mutually exclusive — a user is one or the other inside a given tenant. The third is a platform-wide role assigned independently of the tenant roles.

| Role | Scope | What they can do | Typical user |
| --- | --- | --- | --- |
| **TenantParticipant** | Per tenant | Engage with the agents in the tenant — converse with them and complete Human-in-the-Loop (HITL) tasks assigned to them. No configuration access. | Business users, end customers |
| **TenantParticipantAdmin** | Per tenant | Everything a TenantParticipant can do, **plus** full access to all agent operations in the tenant: onboard agents, edit knowledge, manage secrets, view data, logs and metrics, configure tenant settings, and manage users within the tenant. | Tenant owner, ops lead, agent developers |
| **SystemAdmin** | Platform-wide (assigned independently) | Deploy agents into any tenant and perform system-wide operations across the platform. Independent of tenant roles — a SystemAdmin is not automatically a participant in any tenant. | Platform operators, infrastructure admins |

A user can simultaneously be a `TenantParticipantAdmin` in one tenant, a `TenantParticipant` in another, and a `SystemAdmin` across the whole platform — the three are evaluated independently.

## Making Agents Descriptive

A bare `Name = "SupportBot"` tells nobody what the agent does, when to call it, who built it, or how to start a conversation with it. Operators staring at a list of 40 agents in the Studio — and *other agents* discovering this one over A2A — need more than that.

Every field on `XiansAgentRegistration` becomes part of the agent's public face in Agent Studio. Fill them in at registration time:

```csharp
var xiansAgent = xiansPlatform.Agents.Register(new()
{
    Name = "Progress Indicators Agent",
    Summary = "Streams typing/thinking/working signals back to the UI during long-running agent turns.",
    Description = """
        Drop-in helper agent that emits structured progress events while a sibling
        agent is working. Use it to drive typing indicators, multi-step progress bars,
        and 'still thinking…' messaging in your chat surface.

        Inputs: a parent run id and an optional stage label.
        Outputs: progress events on the standard messaging channel.
        Limits: best-effort delivery; do not use as a substitute for run state.
        """,
    Version = "1.4.0",
    Author = "99x",
    Category = "UX / Messaging",
    IsTemplate = true,
    EnableTasks = false,
    SamplePrompts = new[]
    {
        "Show progress while my research agent is running.",
        "Send a 'thinking…' indicator for the next 30 seconds.",
        "Stream step-by-step status for the current workflow.",
    },
});
```

### What each field is for

| Field | Type | What it powers in the Studio |
| --- | --- | --- |
| `Name` | `string?` | The agent's identity — shown everywhere (lists, chat headers, A2A directory). Keep it short and stable; it's also used for routing. |
| `Summary` | `string?` | One-liner shown in the agent list and in the A2A picker. **This is what other agents' LLMs see first** when deciding whether to call you — make it accurate. |
| `Description` | `string?` | Long-form writeup on the agent detail page. Cover capabilities, inputs, outputs, and known limits. Multi-line is fine. |
| `Version` | `string?` | Surfaced in the Studio header and in run logs. Use semver so operators can correlate behavior with deploys. |
| `Author` | `string?` | Team or person responsible — shown on the detail page and used for routing alerts. |
| `Category` | `string?` | Groups the agent in the Studio's category browser and filters in the A2A directory. |
| `IsTemplate` | `bool` | Marks the agent as a **template** other tenants/users can clone. Templates show up in the Studio's template gallery. |
| `EnableTasks` | `bool?` | Auto-configures HITL task workflow support. Leave `null` to inherit the platform default; set explicitly when you want the answer to be obvious from the registration call. |
| `SamplePrompts` | `IReadOnlyList<string>?` | Renders as the **starter chips** in the chat surface. Good prompts dramatically improve first-message quality and discoverability. |

## Adding Tool & Reasoning Logs

While an agent is thinking, the participant on the other end of the chat is staring at a blinking cursor. Agent Studio (and any frontend built on the messaging SDK) renders **reasoning** and **tool-execution** events as a live timeline — typing-style updates, "calling `getWeather(...)`", "got result: …" — so users see *what the agent is doing*, not just the final answer.

These aren't traditional "log files". They are first-class messages emitted via `UserMessageContext` from inside your message handler, and they ride the same channel back to the user as your final reply.

### The two emitters

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

### Minimal example: narrate before you work

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

### Real-world example: streaming an LLM run

When you're driving a model that emits reasoning and tool-call updates as it streams, fan each update out to the right method. The `ProgressIndicators` example does exactly this:

```csharp
public async Task<string> RunAsync(UserMessageContext context)
{
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

Inside `Tracker.StreamAgentAndReturnTextAsync`, each streamed update is routed to the matching emitter:

```csharp
foreach (var content in update.Contents)
{
    switch (content)
    {
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

        // …other cases (DataContent, ErrorContent, UsageContent, …) → SendReasoningAsync
    }
}
```

The Studio renders all of this as a chronological per-run timeline, with reasoning rows folded into a "thinking" group and tool rows shown as collapsible call/result pairs.

### What to put in `data` vs. `content`

| Goal | Use |
| --- | --- |
| Quick textual narration | `SendReasoningAsync("Analyzing the user's question...")` — pass a plain string as `data`. |
| Structured tool call | `SendToolExecAsync(new { tool = "getWeather", args = new { city } }, content: "Calling getWeather(Toronto)")` — `data` is queryable; `content` is what shows in the timeline. |
| Tool result | `SendToolExecAsync(new { tool = "getWeather", result = payload }, content: $"Got {payload.TempC}°C")` — keep `data` structured so the Studio can render it nicely on expand. |

### Best practices

- **Narrate transitions, not every line.** One reasoning event per logical step ("Analyzing…", "Calling weather API…", "Composing answer…"), not one per token.
- **Pair every tool call with its result.** Two events — one before the call, one after — so the timeline tells a complete story.
- **Keep `content` short, put detail in `data`.** The timeline label needs to fit on one line; the structured payload is what the user sees when they expand.
- **Redact at the call site.** PII, secrets, raw tokens — strip them *before* `SendReasoningAsync` / `SendToolExecAsync`. Anything you send is shown in the chat UI.
- **Don't fabricate reasoning.** Only emit reasoning events when the agent really is doing that step. Fake "thinking…" messages erode trust faster than no messages at all.

For free-form diagnostic logs that are *not* user-facing (server-side errors, debug traces), use the platform's logging surface ([Logging](../concepts/logging.md)) — those appear in the Studio's log views, not in the participant's chat.

## Changing the Default Tenant Theme

Each tenant has its own visual theme — colors, logo, name shown in the Studio chrome and (optionally) in the chat widget your participants see. Changing it is an admin-only operation.

### Where

`Settings → Tenant → Branding`

### What you can change

| Field | Notes |
| --- | --- |
| **Tenant display name** | Shown in the header and on every chat surface |
| **Logo (light)** | SVG or PNG, ≤ 200 KB, shown in light mode |
| **Logo (dark)** | Optional; falls back to the light logo |
| **Favicon** | PNG / ICO, 32×32 minimum |
| **Primary color** | Hex; drives buttons, links, accents |
| **Accent color** | Hex; drives highlights and interactive states |
| **Font family** | Choose from the curated list, or supply a Google Fonts name |
| **Custom CSS** | Optional escape hatch — scoped to your tenant only |

### Scope and rollout

- Theme changes apply to **the entire tenant** — every user, every embedded chat widget, every email template.
- Changes are **live within ~30 seconds** (no rebuild required).
- The previous theme is retained for one rollback. Use **Revert** if a change ships badly.

!!! tip "Preview before publish"
    Hit **Preview** to see the theme applied to your own session only. Nothing else changes until you click **Publish**.

## File Upload Handling

Agent Studio is the operator-facing side of the SDK's file upload flow ([Messaging - File Upload](../concepts/messaging-fileupload.md)). It's where you configure *what* a tenant accepts and *how* uploads are routed and reviewed.

### Tenant-level configuration

`Settings → Tenant → Uploads`

- **Allowed MIME types** — explicit allow-list (no wildcards).
- **Max file size** — per file and per message.
- **Storage backend** — platform-managed object store (default) or your own S3-compatible bucket.
- **Retention policy** — how long uploaded files are kept after the conversation closes.
- **Virus scanning** — on by default; uploads are quarantined until the scanner clears them.

### Per-agent overrides

An agent can tighten (never loosen) the tenant defaults:

- Restrict to a subset of MIME types (`image/png`, `application/pdf`).
- Lower the max size.
- Require a tag/label before upload (e.g. `invoice`, `receipt`).

### What you see in the Studio per upload

- File metadata: name, size, MIME type, hash
- Scan result and any quarantine reason
- The conversation, participant, and agent that received it
- A signed, expiring download link (audit-logged on click)
- Lifecycle state: `received → scanning → ready → expired → deleted`

### Operational notes

- Uploads are **never** sent inline to the LLM by default. The agent must explicitly fetch and pass them — this prevents prompt injection via file contents.
- Failed scans page the tenant's configured security webhook.
- Bulk-deleting uploads is a Tenant Admin action and is irreversible.

## Heartbeats

Heartbeats are how the Studio knows an agent is **alive**, not just *deployed*. Every running agent worker pings the platform on a fixed interval; the Studio surfaces the result on the agent list and on the agent detail page.

### What a heartbeat carries

- Agent ID and instance ID (multiple workers per agent are normal)
- SDK version, runtime version, host name
- Workflow and activity worker status (queues being served, slots in use)
- Last successful poll timestamp

### How the Studio uses it

| State | Meaning |
| --- | --- |
| **Healthy** (green) | Heartbeat received within the last interval |
| **Stale** (yellow) | One missed interval — usually transient |
| **Down** (red) | Two or more missed intervals — alert the owner |
| **Unknown** (grey) | Never registered, or the agent hasn't started yet |

The default interval is **30 seconds**, with a 90-second grace window before an instance flips to **Down**. Both are configurable in `Settings → Tenant → Reliability`.

### Acting on a missing heartbeat

From the agent detail page you can:

- **View last logs** — jump to the final log lines from the dead instance.
- **Drain & redeploy** — mark the instance as drained so the platform stops routing new work to it.
- **Page owner** — fire the agent's configured alert webhook (Slack, PagerDuty, MS Teams).

### What heartbeats are not

- Not a *correctness* check — a heartbeat says "the worker is up", not "the workflows are succeeding". Pair them with run-level metrics for that.
- Not a substitute for tracing — for *why* a request hung, use the run timeline and tool logs.

## What's Next?

- **[Operating Context](../concepts/context.md)** — what tenant, agent, and participant identity the Studio uses everywhere
- **[Multitenancy](../concepts/multitenancy.md)** — how tenant isolation works under the Studio
- **[Messaging - File Upload](../concepts/messaging-fileupload.md)** — the SDK side of the upload flow
- **[Logging](../concepts/logging.md)** — what gets surfaced in the Studio's log views

---

**Bottom line**: Agent Studio is the human-facing operating layer over the same APIs your agents speak. Roles gate access, descriptors make agents findable, tool logs make runs auditable, themes make the platform yours, uploads stay safe, and heartbeats tell you what's actually alive.
