# Metrics & Usage Tracking

## Why Metrics?

Agents burn LLM tokens, produce business outcomes, and take time doing it. Without measurement you can't answer basic questions: *What does this tenant cost us? Which agent is slow? How many approvals ran this week?* The Xians metrics API lets any workflow, activity, or message handler report a metric in one call — and the platform **auto-attaches all the context** (tenant, user, workflow, agent), so a metric reported anywhere is automatically attributable to the right customer and session.

| Field auto-populated | Purpose |
|----------------------|---------|
| `TenantId` | Multi-tenant cost/usage attribution |
| `ParticipantId` | Which user this work served |
| `WorkflowId` | Session tracking |
| `AgentName` / `ActivationName` | Agent and workflow-type attribution |

## Reporting a Metric

Two entry points, same fluent API:

```csharp
// In message handlers — the context already knows everything
workflow.OnUserChatMessage(async (context) =>
{
    await context.Metrics
        .WithMetric("tokens", "total", 150, "tokens")
        .ReportAsync();
});

// In workflows and activities
[WorkflowRun]
public async Task RunAsync()
{
    await XiansContext.Metrics
        .WithMetric("workflow", "started", 1, "count")
        .ReportAsync();
}
```

A metric is `(category, name, value, unit)` — e.g. `("tokens", "prompt", 45, "tokens")`. You define the categories that matter to your domain.

## Common Patterns

### LLM token usage

```csharp
var response = await CallLLM(prompt);

await context.Metrics
    .ForModel("gpt-4")   // only when tracking per-model cost/performance
    .WithMetrics(
        ("tokens", "prompt", response.PromptTokens, "tokens"),
        ("tokens", "completion", response.CompletionTokens, "tokens"),
        ("tokens", "total", response.TotalTokens, "tokens"))
    .ReportAsync();
```

### Business outcomes

```csharp
await context.Metrics
    .WithMetrics(
        ("approvals", "submitted", 1, "count"),
        ("documents", "generated", 1, "count"),
        ("emails", "sent", 3, "count"))
    .ReportAsync();
```

### Performance

```csharp
var stopwatch = Stopwatch.StartNew();
var result = await ProcessData(input);
stopwatch.Stop();

await context.Metrics
    .WithMetrics(
        ("performance", "processing_time", stopwatch.ElapsedMilliseconds, "ms"),
        ("performance", "records_processed", result.Count, "count"))
    .ReportAsync();
```

## Enriching and Overriding

Chain additional builders when the defaults aren't enough:

| Method | Use for |
|--------|---------|
| `.WithCustomIdentifier(id)` | Correlate with your external systems (message ID, order ID) |
| `.WithMetadata(key, value)` / `.WithMetadata(dict)` | Extra context tags (version, region, ...) |
| `.WithRequestId(id)` | Request tracing |
| `.ForModel(name)` | Model-specific cost/performance |
| `.WithTenantId()` / `.WithUserId()` / `.WithWorkflowId()` / `.FromSource()` | Override auto-populated fields (rarely needed) |

```csharp
await context.Metrics
    .WithCustomIdentifier($"msg-{messageId}")
    .WithMetadata("version", "2.1.0")
    .WithMetrics(
        ("tokens", "prompt", 45, "tokens"),
        ("tokens", "completion", 105, "tokens"))
    .ReportAsync();
```

## It Just Works, Everywhere

- **Workflow vs activity**: inside workflows the report goes through a Temporal activity (deterministic); inside activities it's a direct HTTP call. Same API, right mechanism chosen automatically.

## Best Practices

- **Meaningful categories and units** — `"tokens"`, `"approvals"`, `"ms"`, `"usd"`; not `"metric1"`.
- **Track business value, not just tech** — approvals and documents matter as much as tokens.
- **Use custom identifiers** to join metrics with your external systems.
- **Never include PII or secrets** — metrics are for aggregation.
- **Don't set context fields manually** — auto-population already handles tenant/user/workflow.
