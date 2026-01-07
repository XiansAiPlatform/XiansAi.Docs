# Temporal Workflows

## Starting and Executing Workflows

The Xians SDK provides `XiansContext.Workflows` to start and execute child workflows. These methods automatically create the necessary Temporal workflow search attributes and memo values that help keep workflows properly scoped (to tenant, agent, and user) and discoverable via the Xians UI.

**Always use `XiansContext.Workflows` instead of direct Temporal SDK calls when starting workflows.**

### XiansContext.Workflows API

`XiansContext.Workflows` provides methods for two primary patterns:

1. **Fire and Forget** - Start a workflow without waiting for completion (`StartAsync`)
2. **Wait for Result** - Execute a workflow and wait for its result (`ExecuteAsync`)

#### Method Reference

| Method | Description |
|--------|-------------|
| `StartAsync<TWorkflow>(string? idPostfix, params object[] args)` | Start child workflow by type without waiting |
| `StartAsync(string workflowType, string? idPostfix, params object[] args)` | Start child workflow by type string without waiting |
| `ExecuteAsync<TWorkflow, TResult>(string? idPostfix, params object[] args)` | Execute child workflow and wait for result |
| `ExecuteAsync<TResult>(string workflowType, string? idPostfix, params object[] args)` | Execute child workflow by type string and wait for result |

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
        await XiansContext.Workflows.StartAsync<BackgroundTaskWorkflow>(
            idPostfix: taskId,
            args: new object[] { "param1", "param2" }
        );
        
        // Continue without waiting for child to complete
        Workflow.Logger.LogInformation("Background task started");
        
        // You can start multiple workflows in parallel
        await Task.WhenAll(
            XiansContext.Workflows.StartAsync<Task1Workflow>(idPostfix: "task1"),
            XiansContext.Workflows.StartAsync<Task2Workflow>(idPostfix: "task2"),
            XiansContext.Workflows.StartAsync<Task3Workflow>(idPostfix: "task3")
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
    await XiansContext.Workflows.StartAsync(
        workflowType: "MyAgent:DynamicWorkflow",
        idPostfix: taskId,
        args: new object[] { "param1", "param2" }
    );
}
```

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
        var result = await XiansContext.Workflows.ExecuteAsync<ProcessingWorkflow, string>(
            idPostfix: "process",
            args: new object[] { data }
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
        workflowType: "MyAgent:DataProcessor",
        idPostfix: "processor",
        args: new object[] { input }
    );
    
    return result;
}
```

### Workflow ID Generation

The `idPostfix` parameter controls how workflow IDs are generated:

- **With idPostfix**: Workflow ID format is `{workflowType}-{idPostfix}`
- **Without idPostfix (null)**: A GUID is automatically generated

```csharp
// Predictable ID: "MyAgent:Task-12345"
await XiansContext.Workflows.StartAsync<TaskWorkflow>(idPostfix: "12345");

// Auto-generated ID: "MyAgent:Task-a1b2c3d4-e5f6-..."
await XiansContext.Workflows.StartAsync<TaskWorkflow>(idPostfix: null);
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
            idPostfix: taskId
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

### Context Behavior

`XiansContext.Workflows` works both inside workflows and outside of workflows (e.g., in message handlers):

| Context | Behavior |
|---------|----------|
| **Inside Workflow** | Starts/executes as a child workflow |
| **Outside Workflow** | Starts/executes as a new workflow using the Temporal client |

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
            idPostfix: order.Id,
            args: new object[] { order.PaymentInfo }
        );
        
        // Execute inventory check and wait for result
        var inventoryResult = await XiansContext.Workflows
            .ExecuteAsync<InventoryCheckWorkflow, bool>(
                idPostfix: $"inventory-{order.Id}",
                args: new object[] { order.Items }
            );
        
        if (!inventoryResult)
        {
            return new OrderResult { Success = false, Reason = "Out of stock" };
        }
        
        // Execute shipping calculation and wait for result
        var shippingCost = await XiansContext.Workflows
            .ExecuteAsync<ShippingWorkflow, decimal>(
                idPostfix: $"shipping-{order.Id}",
                args: new object[] { order.ShippingAddress }
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

For signaling, querying, or updating workflows after they've been started, use the standard Temporal .NET SDK. Xians does not provide wrapper methods for these operations to keep your workflows from depending on the Xians platform.

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

#### Using GetWorkflowHandleAsync (Recommended)

The simplest way to get a workflow handle is using `XiansContext.Workflows.GetWorkflowHandleAsync()`, which automatically constructs the workflow ID:

```csharp
using Xians.Lib.Agents.Core;

// Get workflow handle using the workflow class and ID postfix
// This automatically constructs the full workflow ID
var workflowHandle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>(
    idPostfix: "12345"
);

// Send signal
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

// Construct full workflow ID manually: {tenantId}:{agentName}:{workflowName}:{idPostfix}
var workflowHandle = temporalClient.GetWorkflowHandle<MyWorkflow>(
    workflowId: "tenant123:MyAgent:Task:12345"
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
var workflowHandle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>(
    idPostfix: "12345"
);

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