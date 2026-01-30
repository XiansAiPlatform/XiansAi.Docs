# Metrics & Usage Tracking

Track everything your agents do—from LLM token usage to business outcomes—with zero configuration required.

## Choose Your Starting Point

The metrics system has two entry points depending on where you're working:

### 📨 In Message Listeners? Use `context.Metrics`

When handling user messages, the context already knows everything:

```csharp
workflow.OnUserChatMessage(async (context) => 
{
    await context.Metrics
        .WithMetric("tokens", "total", 150, "tokens")
        .ReportAsync();
});
```

### ⚙️ In Custom Workflows? Use `XiansContext.Metrics`

For workflows and activities, grab context from the Xians runtime:

```csharp
[WorkflowRun]
public async Task RunAsync()
{
    await XiansContext.Metrics
        .WithMetric("workflow", "started", 1, "count")
        .ReportAsync();
}
```

## Beyond the Basics

Want more control? Chain these fluent methods:

```csharp
await context.Metrics
    .WithCustomIdentifier($"msg-{messageId}")    // Link to your systems
    .WithMetadata("version", "2.1.0")            // Add context
    .WithMetadata(customTags)                    // Or bulk metadata
    .WithRequestId("trace-123")                  // For request tracing
    .WithMetrics(                                // Track multiple values
        ("tokens", "prompt", 45, "tokens"),
        ("tokens", "completion", 105, "tokens")
    )
    .ReportAsync();
```

**Optional:** Only add `.ForModel("gpt-4")` when tracking model-specific costs or performance.

---

## Why Track Metrics?

Agent work spans **technical** (tokens, API calls), **business** (approvals, documents), and **operational** (HITL tasks) layers. Xians auto-captures context (tenant, user, workflow) so you track what matters.

---

## Automatic Context Population

Every metric report automatically includes:

| Field | Auto-Populated From | Purpose |
|-------|-------------------|---------|
| `TenantId` | `XiansContext.SafeTenantId` | Multi-tenant isolation |
| `ParticipantId` | `XiansContext.SafeParticipantId` | User attribution |
| `WorkflowId` | `XiansContext.SafeWorkflowId` | Session tracking |
| `AgentName` | `XiansContext.SafeAgentName` | Agent attribution |
| `ActivationName` | `XiansContext.SafeWorkflowType` | Workflow type |

**No setup required.** Call it from anywhere in your workflow or activity.

---

## Common Patterns

### Track LLM Token Usage

```csharp
var response = await CallLLM(prompt);

await context.Metrics
    .ForModel("gpt-4")
    .WithMetrics(
        ("tokens", "prompt", response.PromptTokens, "tokens"),
        ("tokens", "completion", response.CompletionTokens, "tokens"),
        ("tokens", "total", response.TotalTokens, "tokens")
    )
    .ReportAsync();
```

### Track Business Outcomes

```csharp
await context.Metrics
    .WithMetrics(
        ("approvals", "submitted", 1, "count"),
        ("documents", "generated", 1, "count"),
        ("emails", "sent", 3, "count")
    )
    .ReportAsync();
```

### Track Performance

```csharp
var stopwatch = Stopwatch.StartNew();
var result = await ProcessData(input);
stopwatch.Stop();

await context.Metrics
    .WithMetrics(
        ("performance", "processing_time", stopwatch.ElapsedMilliseconds, "ms"),
        ("performance", "records_processed", result.Count, "count")
    )
    .ReportAsync();
```

### Link to External Systems

Use custom identifiers to correlate metrics with your external systems:

```csharp
await context.Metrics
    .ForModel("gpt-4")
    .WithCustomIdentifier($"msg-{messageId}")  // Your message ID
    .WithMetric("tokens", "total", 150, "tokens")
    .ReportAsync();
```

---

## Fine-Tune When Needed

Need to override auto-populated values? Chain any of these:

- `.WithTenantId(string)` - Override tenant
- `.WithUserId(string)` - Override participant/user  
- `.WithWorkflowId(string)` - Override workflow
- `.WithRequestId(string)` - Set request correlation ID
- `.FromSource(string)` - Override source identifier

**Example:**
```csharp
await XiansContext.Metrics
    .WithTenantId("custom-tenant")     
    .WithUserId("admin-override")         
    .WithMetric("admin", "action", 1, "count")
    .ReportAsync();
```

---

## A2A-Aware Tracking

In Agent-to-Agent (A2A) scenarios, metrics automatically use the **target** workflow context:

```csharp
// Metrics tracked against TargetWorkflow, not SourceWorkflow
await context.Metrics  // A2AMessageContext
    .WithMetric("a2a_call", "completed", 1, "count")
    .ReportAsync();
```

No special handling required—the builder detects A2A context automatically.

---

## Workflow vs Activity Context

The metrics system handles both seamlessly:

- **In Workflows**: Uses Temporal activities (deterministic)
- **In Activities**: Direct HTTP calls (non-deterministic allowed)

You call the same API everywhere. The system chooses the right approach.

---

## Best Practices

✅ **Track early and often** - Metrics are cheap, insights are valuable  
✅ **Use meaningful categories** - "tokens", "approvals", "emails", not "metric1"  
✅ **Include units** - "tokens", "count", "ms", "usd"  
✅ **Link to business value** - Track what matters to your users  
✅ **Use custom identifiers** - Correlate with your external systems  

❌ **Don't track PII** - Metrics are for aggregation, not user data  
❌ **Don't track secrets** - Never include API keys or credentials  
❌ **Don't over-specify** - Let auto-population handle context fields  

---

## Summary

Metrics in Xians are:

- **Automatic**: Context population with zero configuration
- **Flexible**: Track any metric with any label
- **Universal**: Same API in workflows, activities, and message handlers
- **Smart**: A2A-aware, workflow-aware, determinism-aware

Just call `.WithMetric()` and `.ReportAsync()`. Everything else is handled for you.
