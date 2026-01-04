# SDK Access Patterns

The Xians SDK is designed around **explicit ownership**—every operation is accessed through its logical owner. No confusion, no guessing. Just four simple access patterns that cover everything.

## Quick Reference

| Access Pattern | What It's For | Available In | Common Examples |
|----------------|---------------|--------------|-----------------|
| **`UserMessageContext`** | Message-specific operations | Message handlers only | `context.ReplyAsync()`<br>`context.GetChatHistoryAsync()` |
| **`CurrentAgent`** | Agent-level data | All workflows | `XiansContext.CurrentAgent.Knowledge.SearchAsync()`<br>`XiansContext.CurrentAgent.Documents.SaveAsync()` |
| **`CurrentWorkflow`** | Workflow-level operations | All workflows | `XiansContext.CurrentWorkflow.Schedules.Create()`<br>`XiansContext.CurrentWorkflow.WorkflowId` |
| **`XiansContext`** | Cross-cutting orchestration | All workflows | `XiansContext.Messaging.SendChatAsync()`<br>`XiansContext.A2A.SendChatAsync()`<br>`XiansContext.Workflows.StartAsync<T>()`<br>`XiansContext.GetAgent()` / `GetWorkflow()` |

## The Four Access Patterns

### 1. **UserMessageContext** → For Message-Specific Operations

When handling user messages in built-in workflows, use the `UserMessageContext` parameter for message-specific operations.

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) => 
{
    // Message metadata
    var userId = context.Message.ParticipantId;
    var threadId = context.Message.ThreadId;
    
    // Reply to THIS message
    await context.ReplyAsync("Response");
    
    // Get THIS conversation's history
    var history = await context.GetChatHistoryAsync();
    
    // A2A communication
    var targetWorkflow = XiansContext.GetWorkflow("Agent:Workflow");
    var response = await XiansContext.A2A.SendChatAsync(
        targetWorkflow, 
        new A2AMessage { Text = "message" }
    );
});
```

**When:** Inside built-in workflow message handlers only  
**Use for:** Replying, conversation history, message metadata, contextual A2A

---

### 2. **CurrentAgent** → For Agent-Level Data

Access knowledge and documents—data that belongs to your agent across all workflows.

```csharp
// Search agent's knowledge base
var results = await XiansContext.CurrentAgent.Knowledge.SearchAsync("query");

// Store agent-wide documents
await XiansContext.CurrentAgent.Documents.SaveAsync(new Document
{
    Type = "user-preferences",
    Key = "user-123",
    Content = JsonSerializer.SerializeToElement(data)
});
```

**When:** Any workflow (built-in or custom)  
**Use for:** Knowledge search, document storage, agent metadata

---

### 3. **CurrentWorkflow** → For Workflow-Level Operations

Access schedules and workflow-specific information.

```csharp
// Create a schedule for THIS workflow
await XiansContext.CurrentWorkflow.Schedules!
    .Create("daily-report")
    .Daily(hour: 9, minute: 0)
    .WithInput("user-123")
    .StartAsync();

// Get workflow metadata
var workflowId = XiansContext.CurrentWorkflow.WorkflowId;
var taskQueue = XiansContext.CurrentWorkflow.TaskQueue;
```

**When:** Any workflow (built-in or custom)  
**Use for:** Schedules, workflow identity, task queue info

---

### 4. **XiansContext** → For Cross-Cutting Operations

Access orchestration features—messaging, sub-workflows, and agent/workflow discovery.

```csharp
// Start a sub-workflow
await XiansContext.Workflows.StartAsync<NotificationWorkflow>(
    idPostfix: "notify-123",
    args: new object[] { "user-123", "message" }
);

// Send proactive message to any user
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-456",
    text: "Your order shipped!"
);

// A2A communication
var analyzer = XiansContext.GetWorkflow("Analyzer:Process");
var result = await XiansContext.A2A.SendChatAsync(
    analyzer,
    new A2AMessage { Text = "Analyze this content" }
);

// Discover agents and workflows
var allAgents = XiansContext.GetAllAgents();
var tenant = XiansContext.TenantId;
```

**When:** Any workflow (built-in or custom)  
**Use for:** Proactive messaging, A2A, sub-workflows, agent/workflow registry

---

## Design Philosophy

**Explicit ownership.** Every SDK feature is accessed through its logical owner:

- **UserMessageContext** owns reply operations
- **Agent** owns knowledge and documents
- **Workflow** owns schedules
- **XiansContext** orchestrates everything else


