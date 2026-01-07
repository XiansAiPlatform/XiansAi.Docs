# Human-in-the-Loop Tasks

Human-in-the-Loop (HITL) tasks are a special type of workflow that enable seamless collaboration between agents and humans. They allow workflows to pause and wait for human approval, rejection, or iterative refinement before proceeding.

## Overview

HITL tasks are the foundation of human-agent collaboration in Xians. When a workflow needs human input - whether to approve content, provide feedback, or make a decision - it creates a task that waits for human interaction. The task can be:

- **Approved** - Human accepts the work and workflow continues
- **Rejected** - Human rejects with a reason, workflow handles accordingly  
- **Refined** - Human or agent iteratively updates the draft work before final decision

## Creating Tasks in Workflows

Tasks are created from within workflows using the `XiansContext.CurrentAgent.Tasks` API:

```csharp
// Start a task and get a handle (non-blocking)
var taskHandle = await XiansContext.CurrentAgent.Tasks.StartTaskAsync(
    new TaskWorkflowRequest
    {
        TaskId = $"content-approval-{Workflow.NewGuid()}",
        Title = "Approve Content",
        Description = "Approve the content before it is published",
        ParticipantId = userId,
        DraftWork = contentUrl
    }
);

// Later, wait for the task to complete
var result = await XiansContext.CurrentAgent.Tasks.GetResultAsync(taskHandle);

if (result.Success)
{
    // Task was approved - continue with finalWork
    await PublishContentAsync(result.FinalWork);
}
else
{
    // Task was rejected - handle rejection
    _logger.LogWarning("Task rejected: {Reason}", result.RejectionReason);
}
```

!!! note "Durable Execution with Temporal"
    The waiting mechanism in `GetResultAsync()` is powered by **Temporal's durable execution**. This means:
    - **Survives restarts**: The workflow can wait even if your application restarts or crashes
    - **Long-running**: Can wait for days, weeks, months, or even years if needed
    - **No polling**: The wait is event-driven, not polling-based, so it's highly efficient
    - **Guaranteed delivery**: When the task completes, the workflow will resume exactly where it left off
    
    This is a fundamental advantage of building on Temporal - your workflows can reliably wait for human input without tying up resources or risking data loss.

**Key Methods:**

- `CreateAndWaitAsync()` - Creates task and blocks until completion
- `StartTaskAsync()` - Creates task and returns handle immediately  
- `GetResultAsync()` - Waits for task completion using handle
- `CreateAsync()` - Fire-and-forget task creation (no result needed)

## Linking Tasks to Conversations

The power of HITL tasks comes from linking them to conversational contexts using **message hints**:

```csharp
// Send message with task workflow ID as a hint
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    conversationWorkflow,
    userId,
    "This article is ready to be published. Please review.",
    scope: contentUrl,
    hint: taskHandle.Id  // Task workflow ID becomes the hint
);
```

The hint associates the task with the conversation scope, allowing agents to retrieve and interact with the task contextually.

## Interacting with Tasks via Agents

Conversational agents can interact with tasks using the `HitlTask` class. The typical pattern retrieves the task from the conversation hint:

```csharp
// In an agent tool function
var taskWorkflowId = await context.GetLastHintAsync();
var task = await HitlTask.FromWorkflowIdAsync(taskWorkflowId);

// Get task information
var info = await task.GetInfoAsync();
var draft = await task.GetDraftAsync();

// Update the draft
await task.UpdateDraftAsync(updatedContent);

// Approve or reject
await task.ApproveAsync();
// or
await task.RejectAsync("Content needs more detail");
```

**Common HitlTask Methods:**

- `GetInfoAsync()` - Get full task details (title, description, status, draft, metadata)
- `GetDraftAsync()` - Get current draft work
- `UpdateDraftAsync()` - Update draft work (collaborative editing)
- `ApproveAsync()` / `CompleteAsync()` - Approve the task
- `RejectAsync()` - Reject with a reason
- `IsCompletedAsync()`, `IsPendingAsync()`, `IsRejectedAsync()` - Check task state

## Complete Example: Content Approval Workflow

Here's how all the pieces come together in a real workflow:

```csharp
[WorkflowRun]
public async Task<string?> RunAsync(string contentUrl, string userId)
{
    // 1. Notify user about new content
    await XiansContext.Messaging.SendChatAsWorkflowAsync(
        ConversationWorkflow, 
        userId, 
        $"New article found: {contentUrl}", 
        scope: contentUrl);

    // 2. Create approval task
    var taskHandle = await XiansContext.CurrentAgent.Tasks.StartTaskAsync(
        new TaskWorkflowRequest
        {
            TaskId = $"content-approval-{Workflow.NewGuid()}",
            Title = "Approve Content",
            Description = "Approve the content before publishing",
            ParticipantId = userId,
            DraftWork = contentUrl
        }
    );

    // 3. Link task to conversation via hint
    await XiansContext.Messaging.SendChatAsWorkflowAsync(
        ConversationWorkflow,
        userId,
        "Please review. Should I publish this article?",
        scope: contentUrl,
        hint: taskHandle.Id);  // Critical: task ID as hint

    // 4. Wait for human decision
    var result = await XiansContext.CurrentAgent.Tasks.GetResultAsync(taskHandle);

    // 5. Handle result
    return result.Success 
        ? $"Published: {result.FinalWork}"
        : $"Rejected: {result.RejectionReason}";
}
```

## Agent Tools for Task Management

Conversational agents expose tasks through AI function tools:

```csharp
[Description("Get information about the current task")]
public async Task<string> GetTaskInfo()
{
    var taskWorkflowId = await _context.GetLastHintAsync();
    var task = await HitlTask.FromWorkflowIdAsync(taskWorkflowId);
    var info = await task.GetInfoAsync();
    
    return $"Task: {info.Title}\n" +
           $"Status: {(info.IsCompleted ? "Complete" : "Pending")}\n" +
           $"Draft: {info.CurrentDraft}";
}

[Description("Approve and complete the current task")]
public async Task<string> ApproveTask()
{
    var taskWorkflowId = await _context.GetLastHintAsync();
    var task = await HitlTask.FromWorkflowIdAsync(taskWorkflowId);
    await task.ApproveAsync();
    return "Task approved successfully.";
}
```

These tools empower the AI agent to understand pending tasks and facilitate human decisions through natural conversation.

## The Hint Pattern

The **hint pattern** is central to Xians HITL design:

1. **Workflow** creates a task and sends a message with the task workflow ID as a hint
2. **Message hint** scopes the task to that conversation context
3. **Agent tool** retrieves the hint from conversation context (`GetLastHintAsync()`)
4. **HitlTask** is reconstructed from the workflow ID to interact with the task
5. **Human** approves/rejects through conversation, agent executes via tools
6. **Workflow** resumes when task completes

This pattern creates a seamless bridge between long-running workflows and conversational agents, enabling natural human-agent collaboration without exposing workflow complexity to the user.

## Direct Task Operations (Outside Workflows)

You can also manage tasks directly from non-workflow code using the Temporal client:

```csharp
// From outside a workflow
var task = new HitlTask(taskId, tenantId, temporalClient);

// Or from workflow ID
var task = await HitlTask.FromWorkflowIdAsync(workflowId);

// Query and control
var info = await task.GetInfoAsync();
await task.UpdateDraftAsync(updatedContent);
await task.ApproveAsync();
```

This is useful for external integrations, webhooks, or administrative tools that need to interact with tasks outside the workflow context.

## Best Practices

1. **Always use hints** - Link tasks to conversations for contextual agent interaction
2. **Descriptive titles and descriptions** - Help users understand what they're approving
3. **Meaningful draft work** - Pre-populate drafts to give users a starting point
4. **Handle rejections gracefully** - Use rejection reasons to improve or retry
5. **Proactive agents** - Configure agents to check for pending tasks and prompt users
6. **Use metadata** - Store additional context (URLs, references, etc.) for rich interactions

---

HITL tasks transform workflows from rigid automation into collaborative experiences where humans and agents work together naturally, each contributing their unique strengths.
