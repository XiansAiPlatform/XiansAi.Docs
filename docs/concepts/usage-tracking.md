# Usage Tracking

Track LLM token usage across all your agents with built-in reporting to the Xians platform.

---

## Overview

When your agents make LLM calls, you need visibility into token consumption for cost management, billing, and optimization. Xians provides usage tracking APIs that:

- **Capture token metrics** - Prompt tokens, completion tokens, total tokens
- **Automatic timing** - `UsageTracker` measures response time automatically
- **Conversation analytics** - Include message count to analyze usage by conversation depth
- **Platform integration** - Usage data flows to Xians platform for visualization and analytics
- **Simple API** - Works consistently across built-in workflows, custom workflows, and agent-to-agent calls

You invoke tracking methods after each LLM call, and the library handles the reporting.

---

## Quick Reference

| Method | When to Use | What It Does |
|--------|-------------|--------------|
| **`context.ReportUsageAsync()`** | Simple scenarios | Reports tokens (you track timing manually) |
| **`UsageTracker`** | Recommended for most cases | Measures response time automatically and ensures proper cleanup via IDisposable |

---

## Basic Usage Tracking

### Simple Extension Method

For basic scenarios where you manually track timing:

```csharp
workflow.OnUserChatMessage(async (context) => 
{
    var response = await CallLLM(context.Message.Text);
    
    // Report usage - the easy way
    await context.ReportUsageAsync(
        model: "gpt-4",
        promptTokens: response.PromptTokens,
        completionTokens: response.CompletionTokens,
        totalTokens: response.TotalTokens
    );
    
    await context.ReplyAsync(response.Text);
});
```

---

## Automatic Timing with UsageTracker

### Basic Pattern

`UsageTracker` automatically measures response time:

```csharp
workflow.OnUserChatMessage(async (context) => 
{
    // Create tracker - automatically starts timing
    using var tracker = new UsageTracker(context, "gpt-4");
    
    var response = await CallLLM(context.Message.Text);
    
    // Report includes automatic timing
    await tracker.ReportAsync(
        response.PromptTokens,
        response.CompletionTokens
    );
    
    await context.ReplyAsync(response.Text);
});
```

### With Conversation History

Track message count for better analytics:

```csharp
workflow.OnUserChatMessage(async (context) => 
{
    // Get conversation history
    var history = await context.GetChatHistoryAsync(page: 1, pageSize: 10);
    var messageCount = history.Count + 1;
    
    // Create tracker with message count
    using var tracker = new UsageTracker(
        context, 
        "gpt-4",
        messageCount: messageCount
    );
    
    var response = await CallLLM(context.Message.Text);
    
    await tracker.ReportAsync(
        response.PromptTokens,
        response.CompletionTokens
    );
    
    await context.ReplyAsync(response.Text);
});
```

### With Source Attribution

Track usage by workflow step or sub-agent:

```csharp
workflow.OnUserChatMessage(async (context) => 
{
    // Step 1: Analyze sentiment
    using (var tracker = new UsageTracker(context, "gpt-3.5-turbo", source: "SentimentAnalysis"))
    {
        var sentiment = await AnalyzeSentiment(context.Message.Text);
        await tracker.ReportAsync(sentiment.PromptTokens, sentiment.CompletionTokens);
    }
    
    // Step 2: Generate response
    using (var tracker = new UsageTracker(context, "gpt-4", source: "ResponseGeneration"))
    {
        var response = await GenerateResponse(context.Message.Text);
        await tracker.ReportAsync(response.PromptTokens, response.CompletionTokens);
        await context.ReplyAsync(response.Text);
    }
});
```

---

## Advanced Patterns

### Custom Metadata

Add custom metadata for advanced analytics:

```csharp
var metadata = new Dictionary<string, string>
{
    ["conversation_length"] = history.Count.ToString(),
    ["message_length"] = context.Message.Text.Length.ToString(),
    ["temperature"] = "0.7",
    ["user_tier"] = "premium"
};

var record = new UsageEventRecord(
    TenantId: context.Message.TenantId,
    UserId: context.Message.ParticipantId,
    Model: "gpt-4",
    PromptTokens: promptTokens,
    CompletionTokens: completionTokens,
    TotalTokens: totalTokens,
    MessageCount: messageCount,
    WorkflowId: XiansContext.WorkflowId,
    RequestId: context.Message.RequestId,
    Source: "MyAgent.DetailedTracking",
    Metadata: metadata,
    ResponseTimeMs: stopwatch.ElapsedMilliseconds
);

await UsageEventsClient.Instance.ReportAsync(record);
```

### Error Handling

Usage tracking should never break your agent:

```csharp
try
{
    var response = await CallLLM(context.Message.Text);
    
    try
    {
        await context.ReportUsageAsync(
            model: "gpt-4",
            promptTokens: response.PromptTokens,
            completionTokens: response.CompletionTokens
        );
    }
    catch (Exception ex)
    {
        // Log but continue - usage tracking is best-effort
        _logger.LogWarning(ex, "Failed to report usage");
    }
    
    await context.ReplyAsync(response.Text);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Agent error");
    await context.ReplyAsync("Sorry, I encountered an error.");
}
```

---

## Best Practices

### ✅ Do

- **Use `UsageTracker`** for automatic timing
- **Include message count** from conversation history for better analytics
- **Add source attribution** for multi-step workflows
- **Track all LLM calls** including agent-to-agent sub-agent calls
- **Handle errors gracefully** - don't let tracking break your agent

### ❌ Don't

- **Block on usage reporting** - it's best-effort, not critical path
- **Track non-LLM operations** - only track actual token consumption
- **Forget to dispose** - use `using` statements with UsageTracker
- **Hardcode costs** - let the platform calculate costs from tokens

---

## Viewing Usage Data

Usage data is visualized in the Xians platform UI at **Manager → Usage Stats** (`/manager/usage-statistics`):

### Available Features

- **Type Toggle** - Switch between Tokens and Messages views
- **Time Series Chart** - Visual line chart showing usage trends over time
- **Date Ranges** - Last 7, 30, or 90 days
- **Time Grouping** - Aggregate by day, week, or month
- **User Breakdown** - Sortable table showing per-user consumption (admins only)
- **Agent Breakdown** - Sortable table showing per-agent consumption
- **Role-Based Access** - Admins see all users, regular users see only their own data
- **Filtering** - Filter by specific user or agent (admins only)

---

## Complete Example

Here's a complete example showing the recommended pattern:

```csharp
using Xians.Lib.Agents.Core;
using Xians.Lib.Agents.Messaging;
using Xians.Lib.Common.Usage;

public class MyAgent
{
    public async Task<string> RunAsync(UserMessageContext context)
    {
        // Get conversation history for message count
        var history = await context.GetChatHistoryAsync(page: 1, pageSize: 10);
        var messageCount = history.Count + 1;

        // Use UsageTracker for automatic timing
        var modelName = "gpt-4o-mini";
        using var tracker = new UsageTracker(context, modelName, messageCount, source: "My Agent");

        // Call your LLM (any framework: OpenAI SDK, MAF, LangChain, etc.)
        var response = await CallYourLLM(context.Message.Text);
        
        // Extract token usage from your LLM's response
        // (Implementation depends on your chosen framework)
        var promptTokens = response.PromptTokens;
        var completionTokens = response.CompletionTokens;
        var totalTokens = response.TotalTokens;
        
        // Report usage (library handles timing and reporting)
        await tracker.ReportAsync(promptTokens, completionTokens, totalTokens);
        
        return response.Text;
    }

    private async Task<LLMResponse> CallYourLLM(string message)
    {
        // Your LLM framework implementation here
        // (OpenAI SDK, Microsoft Agents Framework, LangChain, Semantic Kernel, etc.)
        throw new NotImplementedException();
    }
}

// Your LLM response model (structure depends on your framework)
public class LLMResponse
{
    public string Text { get; set; }
    public long PromptTokens { get; set; }
    public long CompletionTokens { get; set; }
    public long TotalTokens { get; set; }
}
```

---

## Related Concepts

- [Observability](../introduction/features.md#observability) - Logs, metrics, and audit trails
- [Agent-to-Agent (A2A)](A2A.md) - Cross-agent communication patterns
- [SDK Patterns](sdk-patterns.md) - Core SDK access patterns
