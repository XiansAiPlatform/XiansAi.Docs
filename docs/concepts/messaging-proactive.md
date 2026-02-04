# Messaging

Xians provides two distinct mechanisms for communicating with users, each designed for different scenarios:

## Two Flavors of Messaging

### 1. Replying to User Messages

When users send messages to your agent via `OnUserChatMessage` or `OnUserDataMessage` listeners, you respond using the **message context** methods:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // User initiated - you're responding
    await context.ReplyAsync("I received your message!");
});
```

**Key characteristics:**

- **User-initiated**: Responding to incoming messages
- **Context-aware**: Automatic participant ID, thread continuity, scope inheritance
- **Conversational**: Interactive back-and-forth exchanges
- **Access method**: `context.ReplyAsync()`, `context.SendDataAsync()`, `context.SendHandoffAsync()`

📖 **Full documentation**: [Replying to User Messages](./messaging-replying.md)

### 2. Proactive Messaging

When your agent needs to initiate conversations or send messages from anywhere in your workflows (background processes, scheduled tasks, events), use **XiansContext.Messaging**:

```csharp
// In any workflow or activity - with explicit participant ID
await XiansContext.Messaging.SendChatAsync(
    text: "Your order has shipped!",
    participantId: "user-123"
);

// Or use current participant from workflow context
await XiansContext.Messaging.SendChatAsync(
    text: "Your order has shipped!"
);
```

**Key characteristics:**

- **Agent-initiated**: Your workflows initiate the conversation
- **Flexible participant targeting**: Optionally specify participant ID or use current workflow context
- **Background-friendly**: Works from any workflow context, including scheduled/event-driven workflows
- **Access method**: `XiansContext.Messaging.<methods>` (exposed via MessagingHelper)

📖 **This document covers proactive messaging in detail below.**

---

## Proactive Messaging

Proactive messaging enables your agent to initiate conversations and send messages to users without waiting for user input. This is essential for background workflows, scheduled tasks, event-driven notifications, and any scenario where your agent needs to reach out to users independently.

### When to Use Each Mechanism

**Use Proactive Messaging** (`XiansContext.Messaging`) when:

- Background workflows need to notify users  
- Your agent detects system events requiring user notification  
- Time-based workflows send scheduled updates or reminders  
- One workflow needs to send messages on behalf of another  
- Background automation completes and needs to inform users

**Use Replying** (`context.ReplyAsync()`) when:

- Responding to incoming user messages  
- Engaged in active conversational flows  
- Processing messages in `OnUserChatMessage` or `OnUserDataMessage` listeners

### Accessing Proactive Messaging

Proactive messaging is available through `XiansContext.Messaging` from any workflow or activity:

```csharp
// With explicit participant ID
await XiansContext.Messaging.SendChatAsync(
    text: "Your order has shipped!",
    participantId: "user-123"
);

// Using current participant from workflow context
await XiansContext.Messaging.SendChatAsync(
    text: "Your order has shipped!"
);
```

## Message Types

Xians provides several methods for proactive messaging:

| Method | Purpose | Use Case |
|--------|---------|----------|
| `SendChatAsync` | Send chat messages from current workflow | Standard notifications and updates |
| `SendDataAsync` | Send data messages from current workflow | Structured data delivery |
| `SendChatAsWorkflowAsync` | Send chat messages as another workflow | Background workflows impersonating main workflows |
| `SendDataAsWorkflowAsync` | Send data messages as another workflow | Background data delivery from impersonated workflows |
| `SendChatAsSupervisorAsync` | Send chat messages as Supervisor workflow | Shorthand for messaging as Supervisor |
| `SendDataAsSupervisorAsync` | Send data messages as Supervisor workflow | Shorthand for data delivery as Supervisor |

## Sending Chat Messages

### Basic Chat Messages

The most common use case is sending simple text messages:

```csharp
// With explicit participant ID
await XiansContext.Messaging.SendChatAsync(
    text: "Reminder: Your appointment is tomorrow at 2 PM",
    participantId: "user-123"
);

// Using current workflow context participant
await XiansContext.Messaging.SendChatAsync(
    text: "Reminder: Your appointment is tomorrow at 2 PM"
);
```

### Chat Messages with Data

Include structured data alongside your message:

```csharp
var orderDetails = new
{
    OrderId = "ORD-12345",
    Status = "Shipped",
    TrackingNumber = "1Z999AA10123456784",
    EstimatedDelivery = DateTime.UtcNow.AddDays(3)
};

await XiansContext.Messaging.SendChatAsync(
    text: "Your order has shipped!",
    data: orderDetails,
    participantId: "user-123"
);
```

### Chat Messages with Scope

Use scope to organize messages into topics:

```csharp
await XiansContext.Messaging.SendChatAsync(
    text: "Your delivery is arriving today",
    scope: "Order #12345 - Delivery Updates",
    participantId: "user-123"
);
```

Learn more about message scope in [Replying - Message Scope](./messaging-replying.md#message-scope).

### Chat Messages with Hints

Provide hints for message processing and additional context. Hints can be used by client applications to determine how to display or handle messages, and can also store additional context information that may be passed to LLMs along with chat history:

```csharp
await XiansContext.Messaging.SendChatAsync(
    text: "Your payment method needs updating",
    hint: "payment-reminder",
    participantId: "user-123"
);
```

The `hint` field serves multiple purposes:

- **UI Processing**: Client applications can use hints to apply special styling, routing, or behavior
- **LLM Context**: Hints can store additional context information that gets passed to language models with chat history, helping them better understand the nature and intent of messages

### Associating Messages with Tasks

You can associate messages with specific tasks using the `taskId` parameter. This helps frontend UIs assist users in navigating to the associated task:

```csharp
await XiansContext.Messaging.SendChatAsync(
    text: "Your analysis task has been completed",
    taskId: "task-789",
    participantId: "user-123"
);
```

The `taskId` is sent to the server alongside the message, enabling client applications to create clickable links or navigation elements that direct users to the relevant task details.

## Sending Data Messages

When the primary content is structured data (not text), use `SendDataAsync`:

```csharp
var analyticsReport = new
{
    Period = "2026-01",
    TotalRevenue = 125000,
    NewCustomers = 47,
    ConversionRate = 0.23,
    TopProducts = new[] { "Widget A", "Gadget B", "Tool C" }
};

await XiansContext.Messaging.SendDataAsync(
    text: "Your monthly analytics report is ready",
    data: analyticsReport,
    participantId: "user-123"
);
```

**Key Difference:**

- `SendChatAsync`: Text is primary, data is supplementary
- `SendDataAsync`: Data is primary, text is descriptive

## Workflow Impersonation

Background workflows often need to send messages that appear to come from the user's main conversational workflow. This is called **workflow impersonation**.

### Why Impersonate Workflows?

Consider this scenario:

1. User chats with your "Customer Support" workflow
2. You start a background "Order Monitoring" workflow to track their order
3. When the order ships, the monitoring workflow needs to notify the user
4. The message should appear in the user's "Customer Support" conversation, not from an unknown background workflow

### Sending Chat Messages as Another Workflow

Use `SendChatAsWorkflowAsync` to send messages on behalf of a different BuiltIn workflow:

```csharp
// In a background "OrderMonitoring" workflow
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",  // The workflow to impersonate
    text: "Great news! Your order has shipped and is on its way.",
    participantId: "user-123"
);
```

The user receives this message as if it came from their "Conversational" workflow, maintaining conversation continuity.

### Sending Data Messages as Another Workflow

Similarly, send data messages while impersonating a workflow:

```csharp
// In a background analytics workflow
var dashboardData = new
{
    Metrics = new[] { 100, 200, 150, 300 },
    Labels = new[] { "Week 1", "Week 2", "Week 3", "Week 4" }
};

await XiansContext.Messaging.SendDataAsWorkflowAsync(
    builtinWorkflowName: "Dashboard",
    text: "Your weekly dashboard has been updated",
    data: dashboardData,
    participantId: "user-123"
);
```

### Understanding Workflow Names

The `builtinWorkflowName` parameter refers to the **workflow name** you defined when creating built-in workflows, not the full workflow type:

```csharp
// When you define a workflow
var chatWorkflow = agent.Workflows.DefineBuiltIn(name: "Conversational");
var analyticsWorkflow = agent.Workflows.DefineBuiltIn(name: "Analytics");

// Use the name when impersonating
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",  // ✅ Use the workflow name
    text: "Message from background process",
    participantId: "user-123"
);

// NOT the full workflow type
// ❌ Don't use "MyAgent:Conversational"
```

## Supervisor Workflow Shortcuts

For the common scenario of sending messages as the Supervisor workflow, Xians provides convenience methods that eliminate the need to specify the workflow name:

### SendChatAsSupervisorAsync

Send chat messages as the Supervisor workflow without specifying the workflow name:

```csharp
// Instead of this
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Supervisor Workflow",
    text: "Task completed successfully",
    participantId: "user-123"
);

// Use this shorthand with explicit participant ID
await XiansContext.Messaging.SendChatAsSupervisorAsync(
    text: "Task completed successfully",
    participantId: "user-123"
);

// Or without explicit participantId (uses current participant from context)
await XiansContext.Messaging.SendChatAsSupervisorAsync(
    text: "Background processing complete",
    data: new { Status = "Success", ProcessedItems = 150 }
);
```

### SendDataAsSupervisorAsync

Send data messages as the Supervisor workflow:

```csharp
// Shorthand for sending data as Supervisor with explicit participant ID
await XiansContext.Messaging.SendDataAsSupervisorAsync(
    text: "Task execution report",
    data: new
    {
        TaskId = "task-456",
        Duration = TimeSpan.FromMinutes(5),
        Result = "Success"
    },
    participantId: "user-123"
);

// Or using current participant from context
await XiansContext.Messaging.SendDataAsSupervisorAsync(
    text: "Workflow metrics",
    data: workflowMetrics,
    scope: "System Monitoring"
);
```

### When to Use Supervisor Shortcuts

These convenience methods are ideal for:

- **Multi-agent systems** where the Supervisor workflow coordinates other agents
- **Background task notifications** that need to appear from the Supervisor
- **System-level updates** sent from monitoring or orchestration workflows
- **Reducing boilerplate** in code that frequently messages as Supervisor

```csharp
// Example: Background monitoring workflow notifying as Supervisor
var monitoringWorkflow = agent.Workflows.DefineBuiltIn(name: "SystemMonitoring");

monitoringWorkflow.RegisterWorkflow(async () =>
{
    var healthStatus = await CheckSystemHealth();
    
    if (healthStatus.HasIssues)
    {
        // Simplified: No need to specify workflow name
        await XiansContext.Messaging.SendChatAsSupervisorAsync(
            text: $"⚠️ System health check detected {healthStatus.IssueCount} issues",
            data: healthStatus,
            hint: "system-alert"
        );
    }
});
```

## Complete Method Signatures

### SendChatAsync

```csharp
Task SendChatAsync(
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

### SendDataAsync

```csharp
Task SendDataAsync(
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

### SendChatAsWorkflowAsync

```csharp
Task SendChatAsWorkflowAsync(
    string builtinWorkflowName, // Required: Workflow name to impersonate
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

### SendDataAsWorkflowAsync

```csharp
Task SendDataAsWorkflowAsync(
    string builtinWorkflowName, // Required: Workflow name to impersonate
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

### SendChatAsSupervisorAsync

```csharp
Task SendChatAsSupervisorAsync(
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

### SendDataAsSupervisorAsync

```csharp
Task SendDataAsSupervisorAsync(
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null,        // Optional: Processing hint
    string? taskId = null,      // Optional: Task ID for UI navigation
    string? participantId = null // Optional: User ID to send to (uses current context if null)
)
```

## Best Practices

### 1. Choose the Right Message Type

```csharp
// ✅ Good: Text is primary content
await XiansContext.Messaging.SendChatAsync(
    text: "Your package will arrive tomorrow between 2-4 PM",
    participantId: "user-123"
);

// ✅ Good: Data is primary content
await XiansContext.Messaging.SendDataAsync(
    text: "Dashboard update",
    data: dashboardMetrics,
    participantId: "user-123"
);

// ❌ Bad: Sending important structured data via chat
await XiansContext.Messaging.SendChatAsync(
    text: "Here's your data",
    data: complexAnalytics,  // Should use SendDataAsync instead
    participantId: "user-123"
);
```

### 2. Use Workflow Impersonation for User Context

```csharp
// ✅ Good: Background workflow sends as main workflow
// User sees message in their familiar conversation context
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",
    text: "Update from background monitoring",
    participantId: "user-123"
);

// ❌ Bad: Background workflow sends as itself
// User receives message from unfamiliar workflow name
await XiansContext.Messaging.SendChatAsync(
    text: "Update from OrderMonitoringWorkflow_Background_v2",
    participantId: "user-123"
);
```

### 3. Provide Clear, Actionable Messages

```csharp
// ❌ Vague message
await XiansContext.Messaging.SendChatAsync(
    text: "Update",
    participantId: "user-123"
);

// ✅ Clear and informative
await XiansContext.Messaging.SendChatAsync(
    text: "Your order #12345 has shipped and will arrive by Friday, Jan 24th",
    participantId: "user-123"
);
```

### 4. Use Scope for Topic Organization

```csharp
// ✅ Good: Organized by topic
await XiansContext.Messaging.SendChatAsync(
    text: "Delivery scheduled for tomorrow",
    scope: "Order #12345 - Delivery Updates",
    participantId: "user-123"
);

await XiansContext.Messaging.SendChatAsync(
    text: "Payment received, thank you!",
    scope: "Order #12345 - Payment",
    participantId: "user-123"
);

// ❌ Bad: Everything in general conversation
await XiansContext.Messaging.SendChatAsync(
    text: "Various updates about different things",
    participantId: "user-123"
    // No scope = messages get mixed together
);
```

### 5. Handle Errors Gracefully

```csharp
// ✅ Good: Proper error handling
try
{
    await XiansContext.Messaging.SendChatAsync(
        text: notificationMessage,
        participantId: userId
    );
}
catch (Exception ex)
{
    // Log the error
    logger.LogError(ex, "Failed to send notification to user {UserId}", userId);
    
    // Consider retry logic or fallback mechanisms
    await QueueForRetry(userId, notificationMessage);
}

// ❌ Bad: Unhandled failures
await XiansContext.Messaging.SendChatAsync(
    text: notificationMessage,
    participantId: userId
); // No error handling - failures go unnoticed
```

### 6. Use Hints for Message Processing

```csharp
// ✅ Good: Hints help client applications process messages
await XiansContext.Messaging.SendChatAsync(
    text: "Critical: Your subscription expires in 24 hours",
    hint: "subscription-urgent",  // UI can show special styling
    participantId: "user-123"
);

await XiansContext.Messaging.SendChatAsync(
    text: "Your weekly summary is ready",
    hint: "weekly-summary",  // UI can route to appropriate view
    participantId: "user-123"
);
```

### 7. Associate Task-Related Messages with Task IDs

```csharp
// ✅ Good: Include taskId for task-related notifications
await XiansContext.Messaging.SendChatAsync(
    text: "Your data analysis task has completed successfully",
    taskId: "task-456",  // Frontend can create a link to navigate to the task
    participantId: "user-123"
);

// ✅ Good: Combine with hint for enhanced UI behavior
await XiansContext.Messaging.SendChatAsync(
    text: "Task failed: Unable to process the uploaded file",
    hint: "task-error",
    taskId: "task-789",  // UI can show error styling and task navigation
    participantId: "user-123"
);

// ❌ Bad: Mentioning task without linking
await XiansContext.Messaging.SendChatAsync(
    text: "Task task-456 has completed",  // User can't easily navigate to the task
    participantId: "user-123"
);
```


## Comparison: Proactive Messaging vs Replying

| Aspect | Proactive Messaging | Replying |
|--------|---------------------|----------|
| **Initiator** | Agent initiates | User initiates |
| **Context** | No incoming message | Responding to user message |
| **Access** | `XiansContext.Messaging.<methods>` | `context.ReplyAsync()` / `context.SendDataAsync()` |
| **Available In** | Any workflow or activity | Inside `OnUserChatMessage` / `OnUserDataMessage` listeners |
| **Participant ID** | Optional - can specify `participantId` or use current context | Automatic from incoming message context |
| **Scope** | Must explicitly set (or null) | Automatically inherits from incoming message |
| **Use Cases** | Background workflows, events, scheduled tasks, notifications | Conversational interactions, responding to user input |
| **Implementation** | MessagingHelper class methods | UserMessageContext methods |

## Troubleshooting

### Messages Not Appearing

**Problem**: Messages sent but users don't receive them.

**Solutions**:

1. Verify the participant ID is correct
2. Check that the workflow context is properly initialized
3. Ensure tenant ID is correctly set for multi-tenant scenarios
4. Review logs for HTTP service errors

```csharp
// Add logging for debugging
logger.LogInformation(
    "Sending message to participant {ParticipantId} in tenant {TenantId}",
    participantId,
    XiansContext.TenantId
);

await XiansContext.Messaging.SendChatAsync(
    text: message,
    participantId: participantId
);
```

### Workflow Impersonation Not Working

**Problem**: Messages appear from wrong workflow.

**Solutions**:
1. Use the workflow **name** (not full type) in `builtinWorkflowName`
2. Ensure the target workflow exists and is properly defined
3. Verify the workflow name matches exactly (case-sensitive)

```csharp
// ✅ Correct: Use the workflow name
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",  // Name from DefineBuiltIn
    text: message,
    participantId: userId
);

// ❌ Wrong: Don't use full workflow type
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "MyAgent:Conversational",  // Too specific
    text: message,
    participantId: userId
);
```

### Messages in Wrong Scope

**Problem**: Messages appearing in unexpected conversation topics.

**Solutions**:
1. Explicitly set `scope` parameter to organize messages
2. Use consistent scope naming across related messages
3. Remember that `null` scope is a distinct conversation area

```csharp
// ✅ Explicit scope management
await XiansContext.Messaging.SendChatAsync(
    text: "Order shipped",
    scope: "Order #12345",  // Explicit scope
    participantId: userId
);

// Later messages use same scope
await XiansContext.Messaging.SendChatAsync(
    text: "Order delivered",
    scope: "Order #12345",  // Same scope = same topic
    participantId: userId
);
```

## Next Steps

- **[Replying to User Messages](./messaging-replying.md)** - Learn how to respond to incoming user messages in `OnUserChatMessage` listeners
- **[Workflows](./workflows.md)** - Understand workflow structure and lifecycle
- **[Scheduling](./scheduling.md)** - Set up time-based proactive messaging with scheduled workflows
- **[A2A Communication](./A2A.md)** - Enable agent-to-agent messaging for multi-agent systems
