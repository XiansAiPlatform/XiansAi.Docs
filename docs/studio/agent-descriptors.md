# Making Agents Descriptive

A bare `Name = "SupportBot"` tells nobody what the agent does, when to call it, who built it, or how to start a conversation with it. Operators staring at a list of 40 agents in the Studio need more than that.

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

## What each field is for

| Field | Type | What it powers in the Studio |
| --- | --- | --- |
| `Name` | `string?` | The agent's identity — shown everywhere (lists, chat headers). Keep it short and stable; it's also used for routing. |
| `Summary` | `string?` | One-liner shown in the agent list. **This is what operators see first** when deciding whether to use you — make it accurate. |
| `Description` | `string?` | Long-form writeup on the agent detail page. Cover capabilities, inputs, outputs, and known limits. Multi-line is fine. |
| `Version` | `string?` | Surfaced in the Studio header and in run logs. Use semver so operators can correlate behavior with deploys. |
| `Author` | `string?` | Team or person responsible — shown on the detail page and used for routing alerts. |
| `Category` | `string?` | Groups the agent in the Studio's category browser. |
| `IsTemplate` | `bool` | Marks the agent as a **template** other tenants/users can clone. Templates show up in the Studio's template gallery. |
| `EnableTasks` | `bool?` | Auto-configures HITL task workflow support. Leave `null` to inherit the platform default (`false`); set explicitly when you want the answer to be obvious from the registration call. |
| `SamplePrompts` | `IReadOnlyList<string>?` | Renders as the **starter chips** in the chat surface. Good prompts dramatically improve first-message quality and discoverability. |

!!! warning "Deprecated: `SystemScoped`"
    Older codebases may use `SystemScoped = true` instead of `IsTemplate = true`. The two are exact aliases — `SystemScoped` is marked `[Obsolete]` and will be removed in a future SDK version. Migrate to `IsTemplate`.
