# Operating Context

`XiansContext` is the central hub for accessing all Xians SDK functionality. It provides unified access to agents, workflows, messaging, knowledge, documents, and schedules through a static API that works seamlessly in both workflow and activity contexts.

## Quick Reference

| Category | Properties/Methods | Description |
|----------|-------------------|-------------|
| **Context** | `WorkflowId`, `TenantId`, `InWorkflow`, `InActivity`, `InWorkflowOrActivity` | Current execution context |
| **Safe Context** | `SafeWorkflowId`, `SafeWorkflowRunId`, `SafeWorkflowType`, `SafeAgentName` | Non-throwing context access for logging |
| **Context Methods** | `GetParticipantId()`, `GetIdPostfix()`, `GetTaskQueue()` | Extract metadata from context |
| **Current Instances** | `CurrentAgent`, `CurrentWorkflow` | Access current agent/workflow instances |
| **Helpers** | `Workflows`, `Messaging`, `A2A` | Operation helpers |
| **Registry** | `GetAgent()`, `TryGetAgent()`, `GetWorkflow()`, `GetBuiltInWorkflow()`, `GetAllAgents()`, `GetAllWorkflows()` | Access registered resources |
| **Identity Construction** | `BuildBuiltInWorkflowType()`, `BuildBuiltInWorkflowId()`, `GetWorkflowTypeFor()` | Build workflow identifiers |

---

## Context Properties

### Basic Context
```csharp
// Get current context information (throws if not in Temporal context)
var workflowId = XiansContext.WorkflowId;     // Current workflow ID
var tenantId = XiansContext.TenantId;         // Current tenant ID

// Check execution context
if (XiansContext.InWorkflow) { }              // In workflow?
if (XiansContext.InActivity) { }              // In activity?
if (XiansContext.InWorkflowOrActivity) { }    // In either?
```

### Safe Context (No Exceptions)
```csharp
// Use for logging - returns null if not in context
_logger.LogInfo("Workflow: {0}", XiansContext.SafeWorkflowId ?? "N/A");
_logger.LogInfo("Agent: {0}", XiansContext.SafeAgentName ?? "N/A");
```

### Context Methods
```csharp
var userId = XiansContext.GetParticipantId();  // Get user ID from context
var idPostfix = XiansContext.GetIdPostfix();   // Get ID postfix
var taskQueue = XiansContext.GetTaskQueue();   // Get current task queue
```

---

## Current Instance Access

### CurrentAgent
Access agent-scoped operations (Knowledge, Documents):
```csharp
var agent = XiansContext.CurrentAgent;

// Access agent resources
var knowledge = await agent.Knowledge.GetAsync("config-key");
var documents = await agent.Documents.QueryAsync(new DocumentQuery());
```

### CurrentWorkflow
Access workflow-scoped operations (Schedules):
```csharp
var workflow = XiansContext.CurrentWorkflow;

// Access workflow resources
var schedule = await workflow.Schedules.GetAsync("my-schedule");
var workflowType = workflow.WorkflowType;
```

---

## Helper Operations

### Workflows Helper
Manage workflow lifecycle:
```csharp
// Start workflow
await XiansContext.Workflows.StartAsync<MyWorkflow>(args, uniqueKey);

// Execute and wait for result
var result = await XiansContext.Workflows.ExecuteAsync<MyWorkflow, string>(args, uniqueKey);

// Get workflow handle for signaling/querying
var handle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>(idPostfix);
await handle.SignalAsync(wf => wf.ProcessSignal, data);
var status = await handle.QueryAsync(wf => wf.GetStatus);
```

### Messaging Helper
Send messages to users:
```csharp
// Send chat message to user
await XiansContext.Messaging.SendChatAsync("userId123", "Your order shipped!");

// Send data message
await XiansContext.Messaging.SendDataAsync("userId123", "Order data", orderObject);
```

### A2A Helper
Agent-to-agent communication:
```csharp
// Send message to built-in workflow
var response = await XiansContext.A2A.SendChatToBuiltInAsync(
    "WebWorkflow", 
    new A2AMessage { Text = "Fetch data" }
);

// Send simple text
var response = await XiansContext.A2A.SendTextAsync("WebWorkflow", "Hello");

// Send data
var response = await XiansContext.A2A.SendDataToBuiltInAsync("DataWorkflow", 
    new A2AMessage { Data = myData });
```

---

## Registry Access

### Agent Registry
```csharp
// Get agent (throws if not found)
var agent = XiansContext.GetAgent("MyAgent");

// Try get agent (returns bool)
if (XiansContext.TryGetAgent("MyAgent", out var agent))
{
    // Use agent
}

// Get all agents
var allAgents = XiansContext.GetAllAgents();
```

### Workflow Registry
```csharp
// Get workflow by type (throws if not found)
var workflow = XiansContext.GetWorkflow("MyAgent:CustomWorkflow");

// Get built-in workflow (auto-constructs type from current agent)
var webWorkflow = XiansContext.GetBuiltInWorkflow("WebWorkflow");

// Try methods (return bool)
if (XiansContext.TryGetWorkflow("MyAgent:CustomWorkflow", out var wf)) { }
if (XiansContext.TryGetBuiltInWorkflow("WebWorkflow", out var wf)) { }

// Get all workflows
var allWorkflows = XiansContext.GetAllWorkflows();
```

---

## Workflow Identity Construction

Build workflow identifiers:
```csharp
// Build workflow type: "MyAgent:WebWorkflow"
var workflowType = XiansContext.BuildBuiltInWorkflowType("MyAgent", "WebWorkflow");

// Build workflow ID: "tenant123:MyAgent:WebWorkflow"
var workflowId = XiansContext.BuildBuiltInWorkflowId("MyAgent", "WebWorkflow");

// Get workflow type from class
var workflowType = XiansContext.GetWorkflowTypeFor(typeof(MyCustomWorkflow));
```

---

## Common Patterns

### Pattern 1: Safe Context Check
```csharp
public void LogState()
{
    if (XiansContext.InWorkflowOrActivity)
    {
        _logger.LogInfo("Workflow: {0}", XiansContext.WorkflowId);
    }
    else
    {
        _logger.LogInfo("Outside Temporal context");
    }
}
```

### Pattern 2: Access Current Resources
```csharp
// Agent-scoped operations
var config = await XiansContext.CurrentAgent.Knowledge.GetAsync("config");

// Workflow-scoped operations
var schedule = await XiansContext.CurrentWorkflow.Schedules.GetAsync("daily-task");
```

### Pattern 3: Optional Resource Access
```csharp
if (XiansContext.TryGetAgent("OptionalAgent", out var agent))
{
    // Agent exists
}
else
{
    // Handle missing agent
}
```

### Pattern 4: Workflow Management
```csharp
// Start and signal pattern
await XiansContext.Workflows.StartAsync<MyWorkflow>(args);
var handle = await XiansContext.Workflows.GetWorkflowHandleAsync<MyWorkflow>(idPostfix);
await handle.SignalAsync(wf => wf.Process, data);
```

### Pattern 5: A2A Communication
```csharp
// Send to sub-workflow and wait for response
var response = await XiansContext.A2A.SendChatToBuiltInAsync(
    "WebWorkflow",
    new A2AMessage { Text = "Fetch data from example.com" }
);
```

---

## API Reference

### Context Properties
| Property | Type | Throws | Description |
|----------|------|--------|-------------|
| `WorkflowId` | `string` | Yes | Current workflow ID |
| `TenantId` | `string` | Yes | Current tenant ID |
| `InWorkflow` | `bool` | No | In workflow context? |
| `InActivity` | `bool` | No | In activity context? |
| `InWorkflowOrActivity` | `bool` | No | In either context? |
| `SafeWorkflowId` | `string?` | No | Safe workflow ID |
| `SafeWorkflowRunId` | `string?` | No | Safe run ID |
| `SafeWorkflowType` | `string?` | No | Safe workflow type |
| `SafeAgentName` | `string?` | No | Safe agent name |
| `CurrentAgent` | `XiansAgent` | Yes | Current agent instance |
| `CurrentWorkflow` | `XiansWorkflow` | Yes | Current workflow instance |
| `Workflows` | `WorkflowHelper` | No | Workflow operations |
| `Messaging` | `MessagingHelper` | No | Messaging operations |
| `A2A` | `A2AContextOperations` | No | A2A operations |

### Context Methods
| Method | Returns | Throws | Description |
|--------|---------|--------|-------------|
| `GetParticipantId()` | `string` | Yes | Get user ID from context |
| `GetIdPostfix()` | `string` | Yes | Get ID postfix |
| `GetTaskQueue()` | `string` | Yes | Get current task queue |

### Agent Registry Methods
| Method | Returns | Throws | Description |
|--------|---------|--------|-------------|
| `GetAgent(name)` | `XiansAgent` | Yes | Get agent by name |
| `TryGetAgent(name, out agent)` | `bool` | No | Try get agent |
| `GetAllAgents()` | `IEnumerable<XiansAgent>` | No | Get all agents |

### Workflow Registry Methods
| Method | Returns | Throws | Description |
|--------|---------|--------|-------------|
| `GetWorkflow(type)` | `XiansWorkflow` | Yes | Get workflow by type |
| `GetBuiltInWorkflow(name)` | `XiansWorkflow` | Yes | Get built-in workflow |
| `TryGetWorkflow(type, out wf)` | `bool` | No | Try get workflow |
| `TryGetBuiltInWorkflow(name, out wf)` | `bool` | No | Try get built-in workflow |
| `GetAllWorkflows()` | `IEnumerable<XiansWorkflow>` | No | Get all workflows |

### Identity Construction Methods
| Method | Returns | Description |
|--------|---------|-------------|
| `BuildBuiltInWorkflowType(agent, name)` | `string` | Build workflow type identifier |
| `BuildBuiltInWorkflowId(agent, name)` | `string` | Build workflow ID with tenant |
| `GetWorkflowTypeFor(type)` | `string` | Get workflow type from class |

---

## Error Handling

Most methods throw `InvalidOperationException` when called outside Temporal context:

```csharp
// Will throw if not in context
var workflowId = XiansContext.WorkflowId;

// Safe alternative
var workflowId = XiansContext.SafeWorkflowId;
if (workflowId != null)
{
    // In Temporal context
}

// Or check first
if (XiansContext.InWorkflowOrActivity)
{
    var workflowId = XiansContext.WorkflowId;
}
```

---

## See Also

- [Agent Operations](./agents.md)
- [Workflow Operations](./workflows.md)
- [A2A Communication](./A2A.md)
- [Knowledge Management](./knowledge.md)
- [Document Management](./document-db.md)
