# Temporal Workflows

## Starting and Executing Workflows

The Xians SDK provides `XiansContext.Workflows` to start and execute child workflows. These methods automatically create the necessary Temporal workflow search attributes and memo values that help keep workflows properly scoped (to tenant, agent, and user) and discoverable via the Xians UI.

**Always use `XiansContext.Workflows` instead of direct Temporal SDK calls when starting workflows.**

### XiansContext.Workflows API

`XiansContext.Workflows` provides methods for three primary patterns:

1. **Fire and Forget** - Start a workflow without waiting for completion (`StartAsync`)
2. **Wait for Result** - Execute a workflow and wait for its result (`ExecuteAsync`)
3. **Signal** - Send a signal to a running workflow (`SignalAsync`)

#### Method Reference

| Method | Description |
|--------|-------------|
| `StartAsync<TWorkflow>(object[] args, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null)` | Start child workflow by type without waiting |
| `StartAsync(string workflowType, object[] args, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null)` | Start child workflow by type string without waiting |
| `ExecuteAsync<TWorkflow, TResult>(object[] args, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null)` | Execute child workflow and wait for result |
| `ExecuteAsync<TResult>(string workflowType, object[] args, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null)` | Execute child workflow by type string and wait for result |
| `SignalAsync<TWorkflow>(string signalName, params object[] signalArgs)` | Send signal to workflow by type |
| `SignalAsync(string workflowType, string signalName, params object[] signalArgs)` | Send signal to workflow by type string |
| `SignalAsync<TWorkflow>(string signalName, object[] signalArgs, string activationName)` | Send signal to a workflow running under a specific activation |
| `SignalAsync(string workflowType, string signalName, object[] signalArgs, string activationName)` | Send signal by type string to a workflow running under a specific activation |
| `SignalWithStartAsync<TWorkflow>(object[] workflowArgs, string signalName, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null, params object[] signalArgs)` | Signal a workflow, starting it first if it does not exist (client-only) |
| `SignalWithStartAsync(string workflowType, object[] workflowArgs, string signalName, string? uniqueKey = null, TimeSpan? executionTimeout = null, string? activationName = null, params object[] signalArgs)` | Signal-with-start by type string (client-only) |

**Note:** For `StartAsync`, `ExecuteAsync`, and `SignalWithStartAsync`, the `uniqueKey` parameter provides additional workflow ID uniqueness, and `activationName` targets a specific activation of the child's agent with up-front validation (see [Cross-Agent Workflows and Activations](cross-agent-workflows.md)). For `SignalAsync`, the workflow ID is built from context only—unique keys cannot be passed externally; use the `activationName` overloads to signal a workflow that was started under an explicit activation.

> **Working across agents?** When a child workflow belongs to a different agent, or you need to target a specific activation, see the dedicated [Cross-Agent Workflows and Activations](cross-agent-workflows.md) page.

### Starting Workflows (Fire and Forget)

Use `StartAsync` to start a workflow without waiting for its completion. This is useful for background tasks or when you don't need the result immediately.

#### By Workflow Type

```csharp
using Temporalio.Workflows;
using Xians.Lib.Agents.Core;

[Workflow("MyAgent:ParentWorkflow")]
public class ParentWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string taskId)
    {
        // Start child workflow by type - fire and forget
        // Same-agent child: parent's idPostfix is automatically included in workflow ID
        await XiansContext.Workflows.StartAsync<BackgroundTaskWorkflow>(
            new object[] { "param1", "param2" }
        );
        
        // Continue without waiting for child to complete
        Workflow.Logger.LogInformation("Background task started");
        
        // You can start multiple workflows in parallel
        // Use Workflow.WhenAllAsync (not Task.WhenAll) inside workflows for determinism
        await Workflow.WhenAllAsync(
            XiansContext.Workflows.StartAsync<Task1Workflow>(Array.Empty<object>()),
            XiansContext.Workflows.StartAsync<Task2Workflow>(Array.Empty<object>()),
            XiansContext.Workflows.StartAsync<Task3Workflow>(Array.Empty<object>())
        );
    }
}
```

#### By Workflow Type String

```csharp
[WorkflowRun]
public async Task RunAsync(string workflowType, string taskId)
{
    // Start workflow by type string (useful for dynamic workflow selection)
    // The agent in the type string may differ from the calling agent
    await XiansContext.Workflows.StartAsync(
        "MyAgent:DynamicWorkflow",
        new object[] { "param1", "param2" }
    );
}
```

**Note:** `"WorkflowName"` in the `"AgentName:WorkflowName"` string must match the name declared in the target class's `[Workflow("AgentName:WorkflowName")]` attribute - it is not necessarily the same as the C# class name. Use this string-based form whenever the target workflow's class type isn't available to reference as a generic type parameter (e.g. it lives in another assembly, or the workflow is selected dynamically at runtime); every `StartAsync`, `ExecuteAsync`, `SignalAsync`, and `SignalWithStartAsync` overload has a matching string-based counterpart.

### Executing Workflows (Wait for Result)

Use `ExecuteAsync` to execute a workflow and wait for its result. This is useful when you need the workflow's output before continuing.

#### Execute By Workflow Type

```csharp
[Workflow("MyAgent:ParentWorkflow")]
public class ParentWorkflow
{
    [WorkflowRun]
    public async Task<ProcessingResult> RunAsync(string data)
    {
        // Execute child workflow and wait for result
        // Same-agent child: parent's idPostfix is automatically included in workflow ID
        var result = await XiansContext.Workflows.ExecuteAsync<ProcessingWorkflow, string>(
            new object[] { data }
        );
        
        // Use the result
        Workflow.Logger.LogInformation("Processing completed: {Result}", result);
        
        return new ProcessingResult { Data = result };
    }
}
```

#### Execute By Workflow Type String

```csharp
[WorkflowRun]
public async Task<string> RunAsync(string workflowType, string input)
{
    // Execute workflow by type string and wait for result
    var result = await XiansContext.Workflows.ExecuteAsync<string>(
        "MyAgent:DataProcessor",
        new object[] { input }
    );
    
    return result;
}
```

### Signaling Workflows

Use `SignalAsync` to send a signal to a running workflow. The workflow must already be running; signals cannot be sent to closed workflows. Workflow ID is built from context only; unique keys cannot be passed externally. The caller's `idPostfix` is used in the target workflow ID only when the target workflow belongs to the same agent, mirroring how child workflow IDs are generated. To signal a cross-agent workflow or one running under a specific activation, see [Cross-Agent Workflows and Activations](cross-agent-workflows.md#signaling-a-workflow-under-a-specific-activation).

#### Signal By Workflow Type

```csharp
[Workflow("MyAgent:ParentWorkflow")]
public class ParentWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        // Signal a workflow by type - e.g. approve or update state
        // Workflow ID is built from context (idPostfix) only
        await XiansContext.Workflows.SignalAsync<GreetingWorkflow>(
            "ApproveAsync",
            new ApproveInput("MyUser")
        );
    }
}
```

#### Signal By Workflow Type String

```csharp
[WorkflowRun]
public async Task RunAsync(string workflowType, string signalName)
{
    // Signal workflow by type string (useful for dynamic workflow selection)
    await XiansContext.Workflows.SignalAsync(
        workflowType,
        signalName,
        new ApproveInput("MyUser")
    );
}
```

**Note:** The signal name must match a handler with `[WorkflowSignal]` on the target workflow. The call returns when the server accepts the signal; it does not wait for the workflow to process it.

To signal a cross-agent workflow or one running under a specific activation, see [Signaling a Workflow Under a Specific Activation](cross-agent-workflows.md#signaling-a-workflow-under-a-specific-activation).

### Workflow ID Generation

Workflow IDs are automatically constructed with the following format:

**Format**: `{tenantId}:{agentName}:{workflowName}[:{idPostfix}][:{uniqueKey}]`

- **idPostfix**: The child's activation context. For same-agent children, the caller's `idPostfix` is inherited (or an explicit `activationName` when provided). For cross-agent behavior, see [Cross-Agent Workflow ID Generation](cross-agent-workflows.md#cross-agent-workflow-id-generation).
- **uniqueKey**: Optional parameter for additional uniqueness (e.g., order ID, task ID, session ID)

**Examples**:

```csharp
// Same-agent child, inside workflow with parent idPostfix "session-abc123"
// Result: tenant1:MyAgent:Task:session-abc123
await XiansContext.Workflows.StartAsync<TaskWorkflow>(
    Array.Empty<object>()
);

// Same-agent child with uniqueKey
// Result: tenant1:MyAgent:Task:session-abc123:order-456
await XiansContext.Workflows.StartAsync<TaskWorkflow>(
    Array.Empty<object>(),
    uniqueKey: "order-456"
);

// Outside workflow context (no parent idPostfix)
// Result: tenant1:MyAgent:Task:order-456
await XiansContext.Workflows.StartAsync<TaskWorkflow>(
    Array.Empty<object>(),
    uniqueKey: "order-456"
);
```

### Error Handling

```csharp
using Xians.Lib.Agents.Workflows;

[WorkflowRun]
public async Task RunAsync(string taskId)
{
    try
    {
        await XiansContext.Workflows.StartAsync<ProcessWorkflow>(
            Array.Empty<object>()
        );
    }
    catch (WorkflowAlreadyStartedException ex)
    {
        // Workflow with this ID is already running
        Workflow.Logger.LogWarning(
            "Workflow already started: {WorkflowId}", 
            ex.WorkflowId
        );
    }
}
```

When starting a workflow with an explicit `activationName`, also handle activation validation failures—see [Activation Validation](cross-agent-workflows.md#activation-validation) for the exception types and an example.

### Context Behavior

`XiansContext.Workflows` works both inside workflows and outside of workflows (e.g., in message handlers):

| Context | Behavior |
|---------|----------|
| **Inside Workflow** | Starts/executes as child workflow; signals via external workflow handle |
| **Outside Workflow** | Starts/executes/signals via the Temporal client |

This allows you to use the same API consistently throughout your application.

### Complete Example

```csharp
using Temporalio.Workflows;
using Xians.Lib.Agents.Core;

[Workflow("MyAgent:OrderProcessor")]
public class OrderProcessorWorkflow
{
    [WorkflowRun]
    public async Task<OrderResult> ProcessOrderAsync(Order order)
    {
        // Start payment processing in the background
        await XiansContext.Workflows.StartAsync<PaymentWorkflow>(
            new object[] { order.PaymentInfo }
        );
        
        // Execute inventory check and wait for result
        var inventoryResult = await XiansContext.Workflows
            .ExecuteAsync<InventoryCheckWorkflow, bool>(
                new object[] { order.Items }
            );
        
        if (!inventoryResult)
        {
            return new OrderResult { Success = false, Reason = "Out of stock" };
        }
        
        // Execute shipping calculation and wait for result
        var shippingCost = await XiansContext.Workflows
            .ExecuteAsync<ShippingWorkflow, decimal>(
                new object[] { order.ShippingAddress }
            );
        
        return new OrderResult 
        { 
            Success = true, 
            TotalCost = order.Total + shippingCost 
        };
    }
}
```

## Communicating with Workflows

For signaling workflows, you can use `XiansContext.Workflows.SignalAsync()` (see [Signaling Workflows](#signaling-workflows)) or obtain a workflow handle for more control. For querying and updating, use the standard Temporal .NET SDK via `GetWorkflowHandleAsync()` or the Temporal client.

### Obtaining the Temporal Client

The Xians SDK provides easy access to the Temporal client through `XiansContext.Workflows`:

```csharp
using Temporalio.Client;
using Xians.Lib.Agents.Core;

// Get the Temporal client from the current agent context
// All agents share the same Temporal connection
var temporalClient = await XiansContext.Workflows.GetClientAsync();
```

The client is automatically configured when you initialize the platform with `XiansPlatform.InitializeAsync()`. Since all agents share the same Temporal connection, `GetClientAsync()` returns the shared client regardless of which agent is calling it.

### Signal Example

#### Using SignalAsync (Recommended for context-scoped signals)

When you want to signal the workflow identified by the current context (idPostfix), use `SignalAsync`:

```csharp
using Xians.Lib.Agents.Core;

// Send signal by workflow type - workflow ID built from context only
// Works both inside and outside workflow context
await XiansContext.Workflows.SignalAsync<MyWorkflow>(
    "HandleSignalAsync",
    new SignalData { Message = "Update" }
);
```

#### Using GetWorkflowHandleAsync (Typed signals)

Use `GetWorkflowHandleAsync()` when you need the typed signal API (lambda expression) or want to chain multiple operations (signal + query):

```csharp
using Xians.Lib.Agents.Core;

// Get workflow handle using the workflow class and ID postfix
// This automatically constructs the full workflow ID
var workflowHandle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>("12345");

// Send typed signal (compile-time checked)
await workflowHandle.SignalAsync(
    wf => wf.HandleSignalAsync(new SignalData { Message = "Update" })
);
```

#### Using Manual Workflow ID

Alternatively, you can construct the workflow ID manually:

```csharp
using Temporalio.Client;
using Xians.Lib.Agents.Core;

// Get the Temporal client
var temporalClient = await XiansContext.Workflows.GetClientAsync();

// Construct full workflow ID manually: {tenantId}:{agentName}:{workflowName}[:{idPostfix}][:{uniqueKey}]
// Example: tenant123:MyAgent:Task:session-abc:order-12345
var workflowHandle = temporalClient.GetWorkflowHandle<MyWorkflow>(
    workflowId: "tenant123:MyAgent:Task:session-abc:order-12345"
);

// Send signal
await workflowHandle.SignalAsync(
    wf => wf.HandleSignalAsync(new SignalData { Message = "Update" })
);
```

### Query Example

```csharp
using Xians.Lib.Agents.Core;

// Get workflow handle (automatically constructs workflow ID)
var workflowHandle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>("12345");

// Query workflow state
var status = await workflowHandle.QueryAsync(wf => wf.GetStatus());
```

### Advanced: Access to Temporal Service

For advanced scenarios like health monitoring or reconnection, you can access the underlying `ITemporalClientService`:

```csharp
using Xians.Lib.Agents.Core;

// Get the Temporal service
var temporalService = XiansContext.Workflows.GetService();

// Check connection health
bool isHealthy = temporalService.IsConnectionHealthy();

// Force reconnection if needed
if (!isHealthy)
{
    await temporalService.ForceReconnectAsync();
}
```

For more information on message passing, see the [Temporal .NET SDK documentation](https://docs.temporal.io/develop/dotnet/message-passing).

## Other Temporal Features

You are free to use all other Temporal SDK features when designing your agents, including:

- **Timers and Sleep** - `Workflow.DelayAsync()`
- **Conditions** - `Workflow.WaitConditionAsync()`
- **Activities** - `Workflow.ExecuteActivityAsync()`
- **Queries** - `[WorkflowQuery]`
- **Signals** - `[WorkflowSignal]`
- **Updates** - `[WorkflowUpdate]`
- **Continue-As-New** - `Workflow.ContinueAsNewAsync()`
- **Local Activities** - For fast, local operations
- **Side Effects** - For non-deterministic operations

Refer to [Temporal Docs](https://docs.temporal.io/develop/dotnet/)

The Xians SDK enhances Temporal with multi-tenancy, agent scoping, and built-in workflows, but doesn't restrict your use of Temporal's powerful features.

## Related

- [Cross-Agent Workflows and Activations](cross-agent-workflows.md) — starting, executing, and signaling child workflows that belong to a different agent, plus activation targeting and validation.