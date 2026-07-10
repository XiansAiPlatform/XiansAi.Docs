# Temporal Workflows

## Why `XiansContext.Workflows`?

Xians workflows are standard Temporal workflows, and you could start them with the raw Temporal SDK. Don't. `XiansContext.Workflows` does the same thing **plus** everything the platform needs:

- Workflow IDs are built with the correct tenant/agent/activation structure.
- Search attributes and memos are set so workflows stay scoped and appear in the Xians UI.
- The same API works inside workflows (starts child workflows) and outside them (uses the Temporal client) — you write the same code in both places.

| Pattern | Method | When |
|---------|--------|------|
| Fire and forget | `StartAsync` | Background work; you don't need the result |
| Wait for result | `ExecuteAsync` | You need the child's output before continuing |
| Notify a running workflow | `SignalAsync` | Push data/decisions into a running workflow |
| Signal or start | `SignalWithStartAsync` | Signal a workflow, creating it first if needed (client-only) |

> **Working across agents?** When the target workflow belongs to a different agent, or you need to target a specific activation, see [Cross-Agent Workflows and Activations](cross-agent-workflows.md).

## Starting Workflows (Fire and Forget)

```csharp
[Workflow("MyAgent:ParentWorkflow")]
public class ParentWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string taskId)
    {
        await XiansContext.Workflows.StartAsync<BackgroundTaskWorkflow>(
            new object[] { "param1", "param2" });

        // Start several in parallel — use Workflow.WhenAllAsync inside
        // workflows (not Task.WhenAll) to stay deterministic
        await Workflow.WhenAllAsync(
            XiansContext.Workflows.StartAsync<Task1Workflow>(Array.Empty<object>()),
            XiansContext.Workflows.StartAsync<Task2Workflow>(Array.Empty<object>()));
    }
}
```

### By type string

When the target's class isn't referenceable (another assembly, or chosen at runtime), every method has a string-based overload:

```csharp
await XiansContext.Workflows.StartAsync(
    "MyAgent:DynamicWorkflow",
    new object[] { "param1", "param2" });
```

The `"WorkflowName"` part must match the name declared in the target's `[Workflow("AgentName:WorkflowName")]` attribute — not necessarily the C# class name.

## Executing Workflows (Wait for Result)

```csharp
var result = await XiansContext.Workflows.ExecuteAsync<ProcessingWorkflow, string>(
    new object[] { data });

// Or by type string
var result2 = await XiansContext.Workflows.ExecuteAsync<string>(
    "MyAgent:DataProcessor",
    new object[] { input });
```

## Signaling Workflows

Signals push data into an already-running workflow (it must have a matching `[WorkflowSignal]` handler). The call returns when the server accepts the signal, not when the workflow processes it:

```csharp
await XiansContext.Workflows.SignalAsync<GreetingWorkflow>(
    "ApproveAsync",
    new ApproveInput("MyUser"));
```

For `SignalAsync`, the target workflow ID is built from context only — unique keys can't be passed. The caller's `idPostfix` is used only when the target belongs to the same agent. To signal a cross-agent workflow or a specific activation, use the `activationName` overloads described in [Cross-Agent Workflows](cross-agent-workflows.md#signaling-a-workflow-under-a-specific-activation).

### Typed signals and queries via workflow handle

When you want compile-time-checked signals or need to query state, get a handle:

```csharp
var handle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>("12345");

await handle.SignalAsync(wf => wf.HandleSignalAsync(new SignalData { Message = "Update" }));
var status = await handle.QueryAsync(wf => wf.GetStatus());
```

## How Workflow IDs Are Generated

Understanding the ID format explains most "workflow not found" and "already started" surprises:

```text
{tenantId}:{agentName}:{workflowName}[:{idPostfix}][:{uniqueKey}]
```

- **`idPostfix`** — the activation context. Same-agent children inherit the caller's `idPostfix` automatically (or an explicit `activationName`). Cross-agent behavior is described in [Cross-Agent Workflow ID Generation](cross-agent-workflows.md#cross-agent-workflow-id-generation).
- **`uniqueKey`** — optional extra uniqueness you supply (order ID, session ID, ...).

```csharp
// Inside a workflow with idPostfix "session-abc123":
// → tenant1:MyAgent:Task:session-abc123
await XiansContext.Workflows.StartAsync<TaskWorkflow>(Array.Empty<object>());

// With a uniqueKey:
// → tenant1:MyAgent:Task:session-abc123:order-456
await XiansContext.Workflows.StartAsync<TaskWorkflow>(
    Array.Empty<object>(), uniqueKey: "order-456");
```

Starting a workflow whose ID already exists throws `WorkflowAlreadyStartedException`:

```csharp
try
{
    await XiansContext.Workflows.StartAsync<ProcessWorkflow>(Array.Empty<object>());
}
catch (WorkflowAlreadyStartedException ex)
{
    Workflow.Logger.LogWarning("Workflow already started: {WorkflowId}", ex.WorkflowId);
}
```

When passing an explicit `activationName`, also handle activation validation failures — see [Activation Validation](cross-agent-workflows.md#activation-validation).

## Complete Example

```csharp
[Workflow("MyAgent:OrderProcessor")]
public class OrderProcessorWorkflow
{
    [WorkflowRun]
    public async Task<OrderResult> ProcessOrderAsync(Order order)
    {
        // Payment runs in the background
        await XiansContext.Workflows.StartAsync<PaymentWorkflow>(
            new object[] { order.PaymentInfo });

        // Inventory check must complete before we continue
        var inStock = await XiansContext.Workflows
            .ExecuteAsync<InventoryCheckWorkflow, bool>(new object[] { order.Items });

        if (!inStock)
            return new OrderResult { Success = false, Reason = "Out of stock" };

        var shippingCost = await XiansContext.Workflows
            .ExecuteAsync<ShippingWorkflow, decimal>(new object[] { order.ShippingAddress });

        return new OrderResult { Success = true, TotalCost = order.Total + shippingCost };
    }
}
```

## Method Reference

All of `StartAsync`, `ExecuteAsync`, and `SignalWithStartAsync` accept optional `uniqueKey`, `executionTimeout`, and `activationName` parameters. Each generic method has a string-based counterpart.

| Method | Description |
|--------|-------------|
| `StartAsync<TWorkflow>(args, ...)` | Start without waiting |
| `ExecuteAsync<TWorkflow, TResult>(args, ...)` | Start and wait for the result |
| `SignalAsync<TWorkflow>(signalName, args)` | Signal a running workflow (context-built ID) |
| `SignalAsync<TWorkflow>(signalName, args, activationName)` | Signal a workflow under a specific activation |
| `SignalWithStartAsync<TWorkflow>(workflowArgs, signalName, ...)` | Signal, starting the workflow first if missing (client-only) |
| `GetWorkflowHandleAsync<TWorkflow>(idPostfix)` | Typed handle for signals/queries |
| `GetClientAsync()` | The shared Temporal client (all agents share one connection) |
| `GetService()` | Underlying `ITemporalClientService` — health checks, `ForceReconnectAsync()` |

## Using the Rest of Temporal

Xians adds multi-tenancy, scoping, and built-in workflows on top of Temporal — it doesn't take anything away. Timers (`Workflow.DelayAsync`), conditions (`Workflow.WaitConditionAsync`), activities, queries, updates, continue-as-new, local activities, and side effects all work as documented in the [Temporal .NET SDK docs](https://docs.temporal.io/develop/dotnet/).

## Related

- [Cross-Agent Workflows and Activations](cross-agent-workflows.md) — targeting workflows of other agents and specific activations
- [Agents](agents.md) — defining and registering workflows
