# Human-in-the-Loop Tasks

Human-in-the-Loop (HITL) tasks enable workflows to pause and wait for human decisions. Unlike rigid automation, tasks create a collaborative space where humans and agents work together, each contributing their unique strengths.

## Overview

When a workflow needs human input—whether to approve an order, review content, or make a business decision—it creates a task with **custom actions** that fit your domain:

```csharp
Actions = ["approve", "reject", "hold"]           // Order processing
Actions = ["publish", "revise", "reject"]         // Content review  
Actions = ["ship", "refund", "escalate"]          // Customer service
```

The human performs one of these actions with an optional comment, and the workflow continues based on their choice. It's that simple.

## Enabling HITL Tasks

Tasks are **opt-in**. Enable them only for agents that need human collaboration by setting `EnableTasks = true` when registering the agent:

```csharp
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "OrderProcessor",
    IsTemplate = false,
    EnableTasks = true  // Creates OrderProcessor:Task Workflow at RunAllAsync
});

agent.Workflows.DefineCustom<OrderWorkflow>();

await agent.RunAllAsync();
```

**Key Points:**

- Each agent gets its own task workflow: `{AgentName}:Task Workflow`
- Set `EnableTasks = true` only for agents that need human input
- When `EnableTasks` is `false` or omitted, the Task Workflow is not registered

## Creating Tasks in Workflows

Create tasks with domain-specific actions:

```csharp
var taskHandle = await XiansContext.CurrentAgent.Tasks.StartTaskAsync(
    new TaskWorkflowRequest
    {
        TaskId = $"order-{orderId}",
        Title = "Review High-Value Order",
        Description = $"Order for ${amount} requires approval",
        ParticipantId = reviewerUserId, // optional, this is usually inherited from the parent workflow
        DraftWork = orderDetails,
        Actions = ["approve", "reject", "request-info"],  // Custom actions
        Timeout = TimeSpan.FromHours(24)  // Optional: auto-timeout after 24 hours
    }
);

// Later, wait for the result
var result = await XiansContext.CurrentAgent.Tasks.GetResultAsync(taskHandle);

// Check if task timed out
if (result.TimedOut)
{
    await HandleTimeout(result.TaskId);
    return;
}

// Handle based on the action performed
switch (result.PerformedAction)
{
    case "approve":
        await ProcessOrder(result.FinalWork);
        break;
    case "reject":
        await CancelOrder(result.Comment);
        break;
    case "request-info":
        await RequestMoreInfo(result.Comment);
        break;
}
```

!!! tip "Durable Waiting with Temporal"
    `GetResultAsync()` uses Temporal's durable execution—your workflow can wait days, weeks, or months without tying up resources. It survives restarts and guarantees the workflow resumes exactly where it left off when the human responds.

**Available Methods:**

| Method | Purpose |
|--------|---------|
| `CreateAndWaitAsync()` | Create task and block until completion |
| `StartTaskAsync()` | Create task, return handle immediately |
| `GetResultAsync()` | Wait for task completion using handle |
| `CreateAsync()` | Fire-and-forget (no result needed) |

## Task Timeouts

Tasks can specify an optional timeout to automatically complete after a given duration:

```csharp
var taskHandle = await XiansContext.CurrentAgent.Tasks.StartTaskAsync(
    new TaskWorkflowRequest
    {
        Title = "Review Content",
        Description = "Please review before publishing",
        Actions = ["publish", "reject", "revise"],
        Timeout = TimeSpan.FromHours(48)  // Auto-complete after 48 hours
    }
);

var result = await XiansContext.CurrentAgent.Tasks.GetResultAsync(taskHandle);

// Check if task timed out
if (result.TimedOut)
{
    // Handle timeout case - PerformedAction and Comment will be null
    _logger.LogWarning("Task {TaskId} timed out without human action", result.TaskId);
    await HandleTimeoutLogic();
}
else if (result.Completed)
{
    // Normal completion - human performed an action
    await ProcessAction(result.PerformedAction, result.Comment);
}
```

**Timeout Behavior:**

- When a timeout occurs, the task completes with `TimedOut = true`
- `PerformedAction` and `Comment` will be `null` for timed-out tasks
- `Completed` will be `false` (only `true` when a human performed an action)
- The workflow can distinguish between timeouts and explicit human actions
- If no timeout is specified, the task waits indefinitely

**Use Cases:**

- **SLA Enforcement**: Auto-escalate support tickets after 24 hours
- **Default Actions**: Auto-approve low-risk changes after review period
- **Workflow Progression**: Prevent workflows from waiting forever
- **Business Logic**: Implement time-based decision rules

```csharp
// Example: Auto-approve after 72 hours if not reviewed
var result = await XiansContext.CurrentAgent.Tasks.GetResultAsync(taskHandle);

if (result.TimedOut)
{
    // Auto-approve on timeout
    await ApproveOrder("Auto-approved after 72-hour review period");
}
else if (result.PerformedAction == "reject")
{
    await RejectOrder(result.Comment);
}
else
{
    await ApproveOrder(result.Comment);
}
```

## Linking Tasks to Conversations

Connect tasks to conversations using **message hints**:

```csharp
// Send message with task workflow ID as hint
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    "MyAgent:Conversational",
    userId,
    "I found a high-value order. Please review it.",
    scope: orderId,
    hint: taskHandle.Id  // Links task to this conversation
);
```

The hint makes the task available to conversational agents, enabling natural task management through chat.

## Interacting with Tasks via Agents

Conversational agents retrieve and manage tasks using `HitlTask`:

```csharp
// In an agent tool
var taskWorkflowId = await context.GetLastHintAsync();
var task = await HitlTask.FromWorkflowIdAsync(taskWorkflowId);

// Check available actions
var info = await task.GetInfoAsync();
Console.WriteLine($"Available: {string.Join(", ", info.AvailableActions)}");

// Perform an action with a comment
await task.PerformActionAsync("approve", "Verified by support team");

// Or use convenience methods
await task.ApproveAsync("Looks good!");
await task.RejectAsync("Missing required documentation");
```

**HitlTask Methods:**

| Method | Description |
|--------|-------------|
| `GetInfoAsync()` | Get task details, available actions, status |
| `PerformActionAsync(action, comment)` | Perform any available action |
| `ApproveAsync(comment)` | Shortcut for "approve" action |
| `RejectAsync(comment)` | Shortcut for "reject" action |
| `UpdateDraftAsync(draft)` | Update work in progress |
| `GetDraftAsync()` | Get current draft |
| `GetAvailableActionsAsync()` | Get actions for this task |

## Complete Example: Order Processing

Here's how it all comes together:

```csharp
[Workflow("OrderProcessor:Order Workflow")]
public class OrderWorkflow
{
    [WorkflowRun]
    public async Task<OrderResult> RunAsync(string customerId, decimal amount)
    {
        // Auto-approve small orders
        if (amount <= 100)
        {
            return new OrderResult { Status = "Auto-Approved", Amount = amount };
        }

        // High-value orders need human review
        var taskHandle = await XiansContext.CurrentAgent.Tasks.StartTaskAsync(
            new TaskWorkflowRequest
            {
                Title = "Review Order",
                Description = $"Customer {customerId} - ${amount}",
                Actions = ["approve", "reject", "hold", "escalate"],
                Timeout = TimeSpan.FromHours(48)  // Auto-timeout after 48 hours
            }
        );

        var result = await taskHandle.GetResultAsync(taskHandle);

        // Handle timeout case
        if (result.TimedOut)
        {
            return new OrderResult { Status = "Escalated-Timeout", Amount = amount };
        }

        return result.PerformedAction switch
        {
            "approve" => ProcessApprovedOrder(result.Comment),
            "reject" => CancelOrder(result.Comment),
            "hold" => PutOnHold(result.Comment),
            "escalate" => EscalateToManager(result.Comment),
            _ => throw new InvalidOperationException($"Unknown action: {result.PerformedAction}")
        };
    }
}
```

**TaskWorkflowResult Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `TaskId` | `string` | The unique identifier for the task |
| `InitialWork` | `string?` | The original draft when the task was created |
| `FinalWork` | `string?` | The final draft when the task completed (may have been updated) |
| `PerformedAction` | `string?` | The action that was performed (e.g., "approve", "reject"). `null` if timed out |
| `Comment` | `string?` | Optional comment provided with the action. `null` if timed out |
| `CompletedAt` | `DateTime` | When the task was completed (either by action or timeout) |
| `TimedOut` | `bool` | `true` if the task timed out, `false` if completed by human action |
| `Completed` | `bool` | `true` if a human performed an action, `false` if timed out |

You can compare `InitialWork` and `FinalWork` to see if the draft was modified during the task lifecycle. Use `TimedOut` to distinguish between timeout and explicit human completion.

## Agent Tools for Task Management

Expose tasks through AI function tools:

```csharp
[Description("Get information about the current task including available actions")]
public async Task<string> GetTaskInfo()
{
    var taskId = await _context.GetLastHintAsync();
    var task = await HitlTask.FromWorkflowIdAsync(taskId);
    var info = await task.GetInfoAsync();
    
    var actions = string.Join(", ", info.AvailableActions ?? []);
    var status = info.IsCompleted 
        ? $"Completed ({info.PerformedAction})" 
        : "Pending";
    
    return $"Task: {info.Title}\n" +
           $"Status: {status}\n" +
           $"Available Actions: {actions}\n" +
           $"Draft: {info.CurrentDraft ?? "None"}";
}

[Description("Perform an action on the current task")]
public async Task<string> PerformAction(
    [Description("The action to perform (e.g., approve, reject)")] string action,
    [Description("Optional comment for the action")] string? comment = null)
{
    var taskId = await _context.GetLastHintAsync();
    var task = await HitlTask.FromWorkflowIdAsync(taskId);
    
    await task.PerformActionAsync(action, comment);
    
    return $"Task action '{action}' performed successfully.";
}
```

The AI agent can now naturally guide humans through task decisions in conversation.

## The Hint Pattern

The **hint pattern** connects long-running workflows with conversational agents:

1. **Workflow** creates a task → sends message with task ID as hint
2. **Hint** scopes the task to the conversation context
3. **Agent** retrieves hint → reconstructs `HitlTask` from workflow ID
4. **Human** decides through natural conversation
5. **Agent** performs action via tools
6. **Workflow** resumes instantly

This creates seamless human-agent collaboration without exposing workflow complexity to users.

## Direct Task Operations

Manage tasks outside workflows (e.g., webhooks, admin tools):

```csharp
var task = await HitlTask.FromWorkflowIdAsync(workflowId);

var info = await task.GetInfoAsync();
await task.UpdateDraftAsync(updatedContent);
await task.PerformActionAsync("approve", "Verified externally");
```

## Default Actions

If you don't specify actions, tasks default to `["approve", "reject"]`. Timeout is optional and tasks wait indefinitely if not specified:

```csharp
new TaskWorkflowRequest
{
    Title = "Simple Approval",
    // Actions defaults to ["approve", "reject"]
    // Timeout is null by default (waits indefinitely)
}
```

## Task Lifecycle Control

Tasks can be configured to survive beyond their parent workflow using the `SurviveParentClose` attribute:

```csharp
new TaskWorkflowRequest
{
    Title = "Long-Running Approval",
    Description = "This task will continue even if parent workflow terminates",
    Actions = ["approve", "reject"],
    SurviveParentClose = true  // Task survives parent termination (defaults to false)
}
```

**Behavior:**

- **Default (`false`)**: When the parent workflow terminates, the task is automatically abandoned
- **Enabled (`true`)**: The task continues to exist and wait for human action even after the parent workflow closes

**Use Cases:**

- **Independent Approvals**: Tasks that should complete regardless of the requesting workflow's state
- **Audit Trails**: Ensure human decisions are recorded even if the initiating process fails
- **Decoupled Processes**: When task completion doesn't need to update the parent workflow

!!! warning "Important Consideration"
    When `SurviveParentClose = true`, the parent workflow cannot retrieve the task result via `GetResultAsync()` since it may have already terminated. Design your workflow accordingly, such as having the task trigger a separate callback workflow upon completion.

## Best Practices

**Design**

- Use domain-specific actions that match your business process
- Keep action names simple and clear (`ship`, `refund`, not `initiateShippingProcess`)
- Provide meaningful titles and descriptions
- Set appropriate timeouts based on SLAs and business requirements

**Implementation**

- Enable tasks only for agents that need human input
- Always use hints to link tasks to conversations
- Handle all possible actions in your workflow logic
- Always check `result.TimedOut` before processing `PerformedAction`
- Consider timeout behavior as part of your business logic, not just error handling

**User Experience**

- Pre-populate draft work to give context
- Use comments to capture rationale for decisions
- Configure agents to proactively notify users of pending tasks
- Send reminders before tasks timeout (using scheduled workflows)

## Architecture

When `EnableTasks = true` is set on agent registration, Xians creates an agent-specific workflow at `RunAllAsync()`:

```
{AgentName}:Task Workflow
```

This ensures:

- **Isolation** - Each agent has its own task queue
- **Independent scaling** - Task workers scale per agent
- **Multi-tenancy** - Tasks are automatically tenant-scoped
- **No conflicts** - Multiple agents can use tasks simultaneously

---

HITL tasks transform rigid automation into flexible collaboration, letting humans and agents each do what they do best.
