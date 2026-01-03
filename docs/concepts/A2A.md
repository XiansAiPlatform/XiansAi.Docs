# Agent-to-Agent (A2A) Communication

A2A enables workflows to communicate with each other—whether sending chat messages, data payloads, or invoking Temporal operations like signals, queries, and updates.

## Overview

| Source | Target | Communication Method |
|--------|--------|---------------------|
| Any workflow | Built-in workflow | `SendChatAsync`, `SendDataAsync` |
| Any workflow | Custom workflow | `SendSignalAsync`, `QueryAsync`, `UpdateAsync` |

All A2A operations are accessed via `XiansContext.A2A` within workflow or activity contexts.

---

## Communicating with Built-in Workflows

Built-in workflows handle A2A messages through message listener methods (`OnUserChatMessage`, `OnUserDataMessage`).

### Sending Chat Messages

```csharp
// Send to a specific workflow instance
var response = await XiansContext.A2A.SendChatAsync(targetWorkflow, new A2AMessage 
{ 
    Text = "Hello" 
});

// Send to a built-in workflow by name
var response = await XiansContext.A2A.SendChatToBuiltInAsync("WebWorkflow", new A2AMessage 
{ 
    Text = "Process this request" 
});

// Shorthand for text-only messages
var response = await XiansContext.A2A.SendTextAsync("WebWorkflow", "Hello");
```

### Sending Data Messages

```csharp
var message = new A2AMessage
{
    Text = "Process order",
    Data = new { orderId = "12345", items = new[] { "item1", "item2" } }
};

var response = await XiansContext.A2A.SendDataToBuiltInAsync("OrderProcessor", message);
```

### Receiving Messages (Target Workflow)

```csharp
var workflow = agent.Workflows.DefineBuiltIn(name: "OrderProcessor");

// Handle chat messages
workflow.OnUserChatMessage(async context =>
{
    var incomingText = context.Message.Text;
    await context.Messages.ReplyAsync($"Processed: {incomingText}");
});

// Handle data messages
workflow.OnUserDataMessage(async context =>
{
    var orderData = context.Data;
    await context.Messages.ReplyWithDataAsync("Order received", new { status = "confirmed" });
});
```

---

## Communicating with Custom Workflows

Custom workflows use Temporal's native signal, query, and update mechanisms. These are ideal for structured, typed communication.

### Sending Signals (Fire-and-Forget)

```csharp
await XiansContext.A2A.SendSignalAsync(
    workflowId: "order-workflow-123",
    signalName: "ProcessOrder",
    new { orderId = "12345", priority = "high" }
);
```

### Querying State (Read-Only)

```csharp
var state = await XiansContext.A2A.QueryAsync<OrderState>(
    workflowId: "order-workflow-123",
    queryName: "GetOrderStatus",
    "12345"  // query arguments
);
```

### Sending Updates (Request-Response)

Updates are synchronous operations that modify state and return a result. Requires Temporal Server 1.20+.

```csharp
var result = await XiansContext.A2A.UpdateAsync<ProcessResult>(
    workflowId: "order-workflow-123",
    updateName: "UpdateOrderStatus",
    new { orderId = "12345", status = "shipped" }
);
```

### Receiving in Custom Workflows

```csharp
[Workflow("MyAgent:OrderWorkflow")]
public class OrderWorkflow
{
    private readonly Queue<object> _requests = new();
    private int _processedCount = 0;

    [WorkflowRun]
    public async Task RunAsync()
    {
        while (true)
        {
            await Workflow.WaitConditionAsync(() => _requests.Count > 0);
            var request = _requests.Dequeue();
            // Process request...
        }
    }

    [WorkflowSignal("ProcessOrder")]
    public Task ProcessOrder(object request)
    {
        _requests.Enqueue(request);
        return Task.CompletedTask;
    }

    [WorkflowQuery("GetOrderStatus")]
    public OrderState GetOrderStatus(string orderId)
    {
        return new OrderState { OrderId = orderId, Count = _processedCount };
    }

    [WorkflowUpdate("UpdateOrderStatus")]
    public Task<ProcessResult> UpdateOrderStatus(object request)
    {
        _processedCount++;
        return Task.FromResult(new ProcessResult { Status = "Updated" });
    }
}
```

---

## A2AMessage Properties

| Property | Description |
|----------|-------------|
| `Text` | Primary text content |
| `Data` | Structured data payload (any serializable object) |
| `Metadata` | Key-value pairs for custom metadata |
| `Authorization` | Auth token passed to target context |
| `ThreadId` | Conversation/correlation tracking |
| `ParticipantId` | Original user/caller identifier |
| `Scope` | Defaults to `"A2A"` |
| `Hint` | Processing hint for the target |

### Preserving Context

Use `A2AMessage.FromContext()` to forward context fields when chaining A2A calls:

```csharp
workflow.OnUserChatMessage(async context =>
{
    // Preserve original context when forwarding
    var message = A2AMessage.FromContext(context, text: "Forward this");
    message.Metadata = new Dictionary<string, string> { ["source"] = "forwarder" };
    
    var response = await XiansContext.A2A.SendChatToBuiltInAsync("TargetWorkflow", message);
});
```

---

## Error Handling

Use `Try*` variants for non-throwing error handling:

```csharp
var (success, response, error) = await XiansContext.A2A.TrySendChatToBuiltInAsync(
    "WebWorkflow", 
    new A2AMessage { Text = "Hello" }
);

if (!success)
{
    logger.LogWarning("A2A failed: {Error}", error);
}
```

---

## Quick Reference

```csharp
// To Built-in workflows
await XiansContext.A2A.SendTextAsync("WorkflowName", "message");
await XiansContext.A2A.SendChatToBuiltInAsync("WorkflowName", message);
await XiansContext.A2A.SendDataToBuiltInAsync("WorkflowName", message);

// To Custom workflows  
await XiansContext.A2A.SendSignalAsync(workflowId, "SignalName", args);
var result = await XiansContext.A2A.QueryAsync<T>(workflowId, "QueryName", args);
var result = await XiansContext.A2A.UpdateAsync<T>(workflowId, "UpdateName", args);
```


