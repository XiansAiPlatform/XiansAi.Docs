# Proactive Messaging

Proactive messaging enables your agent to initiate conversations and send messages to users without waiting for user input. This is essential for background workflows, scheduled tasks, event-driven notifications, and any scenario where your agent needs to reach out to users independently.

## Overview

While **replying** handles responses to incoming user messages (covered in [Replying](./replying.md)), **proactive messaging** allows your agent to:

- Send notifications from background workflows
- Deliver scheduled reminders or updates
- Alert users about important events
- Communicate from automated processes
- Send messages from workflows that users didn't directly interact with

### When to Use Proactive Messaging

Use proactive messaging when:

**Background Workflows**: A scheduled or event-driven workflow needs to notify users  
**System Events**: Your agent detects an important event requiring user notification  
**Scheduled Updates**: Time-based workflows send periodic updates or reminders  
**Cross-Workflow Communication**: One workflow needs to send messages on behalf of another  
**Automated Processes**: Background automation completes and needs to inform users

Use [replying](./replying.md) (UserMessageContext.ReplyAsync) when:

**Responding to User Input**: You're handling an incoming message from a user  
**Conversational Flows**: You're in an active back-and-forth conversation

## Accessing Proactive Messaging

Proactive messaging is available through `XiansContext.Messaging` from any workflow or activity:

```csharp
// In any workflow or activity
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
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
// In a scheduled workflow
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
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
    participantId: "user-123",
    text: "Your order has shipped!",
    data: orderDetails
);
```

### Chat Messages with Scope

Use scope to organize messages into topics:

```csharp
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Your delivery is arriving today",
    scope: "Order #12345 - Delivery Updates"
);
```

Learn more about message scope in [Replying - Message Scope](./replying.md#message-scope).

### Chat Messages with Hints

Provide hints for message processing:

```csharp
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Your payment method needs updating",
    hint: "payment-reminder"
);
```

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
    participantId: "user-123",
    text: "Your monthly analytics report is ready",
    data: analyticsReport
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

Use `SendChatAsWorkflowAsync` to send messages on behalf of a different workflow:

```csharp
// In a background "OrderMonitoring" workflow
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",  // The workflow to impersonate
    participantId: "user-123",
    text: "Great news! Your order has shipped and is on its way."
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
    participantId: "user-123",
    text: "Your weekly dashboard has been updated",
    data: dashboardData
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
    participantId: "user-123",
    text: "Message from background process"
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
    participantId: "user-123",
    text: "Task completed successfully"
);

// Use this shorthand
await XiansContext.Messaging.SendChatAsSupervisorAsync(
    participantId: "user-123",
    text: "Task completed successfully"
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
// Shorthand for sending data as Supervisor
await XiansContext.Messaging.SendDataAsSupervisorAsync(
    participantId: "user-123",
    text: "Task execution report",
    data: new
    {
        TaskId = "task-456",
        Duration = TimeSpan.FromMinutes(5),
        Result = "Success"
    }
);

// Or using current participant
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
    string participantId,       // Required: User ID to send to
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

### SendDataAsync

```csharp
Task SendDataAsync(
    string participantId,       // Required: User ID to send to
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

### SendChatAsWorkflowAsync

```csharp
Task SendChatAsWorkflowAsync(
    string builtinWorkflowName, // Required: Workflow name to impersonate
    string participantId,       // Required: User ID to send to
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

### SendDataAsWorkflowAsync

```csharp
Task SendDataAsWorkflowAsync(
    string builtinWorkflowName, // Required: Workflow name to impersonate
    string participantId,       // Required: User ID to send to
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

### SendChatAsSupervisorAsync

```csharp
// With explicit participant ID
Task SendChatAsSupervisorAsync(
    string participantId,       // Required: User ID to send to
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)

// Using current participant from context
Task SendChatAsSupervisorAsync(
    string text,                // Required: Message text
    object? data = null,        // Optional: Structured data
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

### SendDataAsSupervisorAsync

```csharp
// With explicit participant ID
Task SendDataAsSupervisorAsync(
    string participantId,       // Required: User ID to send to
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)

// Using current participant from context
Task SendDataAsSupervisorAsync(
    string text,                // Required: Descriptive text
    object data,                // Required: Data to send
    string? scope = null,       // Optional: Message scope/topic
    string? hint = null         // Optional: Processing hint
)
```

## Practical Examples

### Example 1: Scheduled Reminder Workflow

A background workflow that sends daily reminders:

```csharp
var reminderWorkflow = agent.Workflows.DefineBuiltIn(name: "DailyReminder");

reminderWorkflow.RegisterWorkflow(async () =>
{
    // Get users who need reminders
    var usersToNotify = await GetUsersWithPendingTasks();
    
    foreach (var user in usersToNotify)
    {
        var tasks = await GetUserTasks(user.Id);
        
        // Send as the main Conversational workflow
        await XiansContext.Messaging.SendChatAsWorkflowAsync(
            builtinWorkflowName: "Conversational",
            participantId: user.Id,
            text: $"You have {tasks.Count} pending tasks for today!",
            data: new { Tasks = tasks },
            scope: "Daily Reminders"
        );
    }
});
```

### Example 2: Event-Driven Notification

A workflow that monitors events and notifies users:

```csharp
var monitoringWorkflow = agent.Workflows.DefineBuiltIn(name: "PriceMonitoring");

monitoringWorkflow.RegisterWorkflow(async () =>
{
    // Monitor price changes
    var priceChange = await WaitForPriceChangeEvent();
    
    if (priceChange.PercentChange >= 10)
    {
        // Alert user from their main workflow
        await XiansContext.Messaging.SendChatAsWorkflowAsync(
            builtinWorkflowName: "Conversational",
            participantId: priceChange.UserId,
            text: $"🔔 Price Alert: {priceChange.ProductName} dropped by {priceChange.PercentChange}%!",
            data: priceChange,
            hint: "price-alert"
        );
    }
});
```

### Example 3: Background Processing Completion

Notify users when long-running tasks complete:

```csharp
var processingWorkflow = agent.Workflows.DefineBuiltIn(name: "DataProcessing");

processingWorkflow.RegisterWorkflow(async (DataProcessingRequest request) =>
{
    // Perform long-running processing
    var result = await ProcessLargeDataset(request.DatasetId);
    
    // Notify user of completion
    await XiansContext.Messaging.SendDataAsWorkflowAsync(
        builtinWorkflowName: "Conversational",
        participantId: request.UserId,
        text: "Your data processing is complete! Results are ready.",
        data: new
        {
            ProcessingTime = result.Duration,
            RecordsProcessed = result.RecordCount,
            ResultsUrl = result.DownloadUrl,
            Status = "Success"
        },
        scope: $"Processing Job #{request.JobId}"
    );
});
```

### Example 4: Multi-Tenant Notification System

Send notifications across different tenants:

```csharp
var notificationWorkflow = agent.Workflows.DefineBuiltIn(name: "NotificationService");

notificationWorkflow.RegisterWorkflow(async (NotificationRequest notification) =>
{
    // Automatically uses correct tenant from workflow context
    var tenantId = XiansContext.TenantId;
    
    // Send to users within the tenant
    foreach (var userId in notification.RecipientIds)
    {
        await XiansContext.Messaging.SendChatAsync(
            participantId: userId,
            text: notification.Message,
            data: notification.Data,
            scope: notification.Category
        );
    }
});
```

### Example 5: Analytics Dashboard Updates

Periodically update user dashboards:

```csharp
var analyticsWorkflow = agent.Workflows.DefineBuiltIn(name: "WeeklyAnalytics");

analyticsWorkflow.RegisterWorkflow(async () =>
{
    var users = await GetActiveUsers();
    
    foreach (var user in users)
    {
        var analytics = await GenerateUserAnalytics(user.Id);
        
        // Send dashboard data as the Dashboard workflow
        await XiansContext.Messaging.SendDataAsWorkflowAsync(
            builtinWorkflowName: "Dashboard",
            participantId: user.Id,
            text: "Your weekly analytics report",
            data: new
            {
                WeekEnding = DateTime.UtcNow.Date,
                Summary = analytics.Summary,
                Charts = analytics.ChartData,
                Insights = analytics.AutomatedInsights
            },
            scope: "Weekly Reports"
        );
    }
});
```

## Best Practices

### 1. Choose the Right Message Type

```csharp
// ✅ Good: Text is primary content
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Your package will arrive tomorrow between 2-4 PM"
);

// ✅ Good: Data is primary content
await XiansContext.Messaging.SendDataAsync(
    participantId: "user-123",
    text: "Dashboard update",
    data: dashboardMetrics
);

// ❌ Bad: Sending important structured data via chat
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Here's your data",
    data: complexAnalytics  // Should use SendDataAsync instead
);
```

### 2. Use Workflow Impersonation for User Context

```csharp
// ✅ Good: Background workflow sends as main workflow
// User sees message in their familiar conversation context
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",
    participantId: "user-123",
    text: "Update from background monitoring"
);

// ❌ Bad: Background workflow sends as itself
// User receives message from unfamiliar workflow name
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Update from OrderMonitoringWorkflow_Background_v2"
);
```

### 3. Provide Clear, Actionable Messages

```csharp
// ❌ Vague message
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Update"
);

// ✅ Clear and informative
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Your order #12345 has shipped and will arrive by Friday, Jan 24th"
);
```

### 4. Use Scope for Topic Organization

```csharp
// ✅ Good: Organized by topic
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Delivery scheduled for tomorrow",
    scope: "Order #12345 - Delivery Updates"
);

await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Payment received, thank you!",
    scope: "Order #12345 - Payment"
);

// ❌ Bad: Everything in general conversation
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Various updates about different things"
    // No scope = messages get mixed together
);
```

### 5. Handle Errors Gracefully

```csharp
// ✅ Good: Proper error handling
try
{
    await XiansContext.Messaging.SendChatAsync(
        participantId: userId,
        text: notificationMessage
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
    participantId: userId,
    text: notificationMessage
); // No error handling - failures go unnoticed
```

### 6. Use Hints for Message Processing

```csharp
// ✅ Good: Hints help client applications process messages
await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Critical: Your subscription expires in 24 hours",
    hint: "subscription-urgent"  // UI can show special styling
);

await XiansContext.Messaging.SendChatAsync(
    participantId: "user-123",
    text: "Your weekly summary is ready",
    hint: "weekly-summary"  // UI can route to appropriate view
);
```

### 7. Respect User Preferences

```csharp
// ✅ Good: Check user preferences before sending
var preferences = await GetUserNotificationPreferences(userId);

if (preferences.AllowMarketingNotifications)
{
    await XiansContext.Messaging.SendChatAsync(
        participantId: userId,
        text: "New features available in your dashboard!"
    );
}

// For critical notifications, always send but respect quiet hours
if (preferences.QuietHoursEnabled && IsInQuietHours(preferences))
{
    // Queue for later delivery
    await QueueNotificationForLater(userId, message);
}
else
{
    await XiansContext.Messaging.SendChatAsync(
        participantId: userId,
        text: message
    );
}
```

### 8. Batch Notifications Efficiently

```csharp
// ✅ Good: Efficient batching
var users = await GetUsersToNotify();
var sendTasks = new List<Task>();

foreach (var user in users)
{
    // Start all sends concurrently
    sendTasks.Add(XiansContext.Messaging.SendChatAsync(
        participantId: user.Id,
        text: $"Hello {user.Name}, your report is ready!",
        scope: "Weekly Reports"
    ));
}

// Wait for all to complete
await Task.WhenAll(sendTasks);

// ❌ Bad: Sequential sending (slow)
foreach (var user in users)
{
    await XiansContext.Messaging.SendChatAsync(
        participantId: user.Id,
        text: message
    );
    // Waits for each to complete before starting next
}
```

## Common Use Cases

### 1. Order Status Updates

```csharp
// When order status changes
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",
    participantId: order.CustomerId,
    text: $"Order #{order.Id} status: {order.Status}",
    data: order,
    scope: $"Order #{order.Id}"
);
```

### 2. Scheduled Reports

```csharp
// Daily/weekly/monthly reports
await XiansContext.Messaging.SendDataAsWorkflowAsync(
    builtinWorkflowName: "Dashboard",
    participantId: user.Id,
    text: "Your monthly analytics report",
    data: reportData,
    scope: "Monthly Reports"
);
```

### 3. System Alerts

```csharp
// Critical system notifications
await XiansContext.Messaging.SendChatAsync(
    participantId: admin.Id,
    text: "⚠️ Server CPU usage exceeded 90%",
    data: new { Server = "prod-01", CPU = 94.2 },
    hint: "critical-alert"
);
```

### 4. Approval Requests

```csharp
// Request human approval
await XiansContext.Messaging.SendChatAsync(
    participantId: approver.Id,
    text: "Approval needed: Purchase order for $5,000",
    data: purchaseOrder,
    scope: $"Approval Request #{purchaseOrder.Id}",
    hint: "approval-request"
);
```

### 5. Completion Notifications

```csharp
// Background task completion
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "Conversational",
    participantId: user.Id,
    text: "✅ Your export is ready! Download link expires in 24 hours.",
    data: new { DownloadUrl = exportUrl, ExpiresAt = expiryTime }
);
```

## Comparison: Proactive Messaging vs Replying

| Aspect | Proactive Messaging | Replying |
|--------|---------------------|----------|
| **Initiator** | Agent initiates | User initiates |
| **Context** | No incoming message | Responding to user message |
| **Access** | `XiansContext.Messaging` | `context.ReplyAsync()` in listeners |
| **Use Cases** | Background workflows, events, schedules | Conversational interactions |
| **Workflow** | Any workflow or activity | Message listener context |
| **Participant** | Must specify `participantId` | Automatic from incoming message |

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
    participantId: participantId,
    text: message
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
    participantId: userId,
    text: message
);

// ❌ Wrong: Don't use full workflow type
await XiansContext.Messaging.SendChatAsWorkflowAsync(
    builtinWorkflowName: "MyAgent:Conversational",  // Too specific
    participantId: userId,
    text: message
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
    participantId: userId,
    text: "Order shipped",
    scope: "Order #12345"  // Explicit scope
);

// Later messages use same scope
await XiansContext.Messaging.SendChatAsync(
    participantId: userId,
    text: "Order delivered",
    scope: "Order #12345"  // Same scope = same topic
);
```

## Next Steps

- Learn about [Replying to User Messages](./replying.md) for handling incoming messages
- Explore [Workflows](./workflows.md) to understand workflow structure
- Review [Scheduling](./scheduling.md) for time-based proactive messaging
- Check out [A2A Communication](./A2A.md) for agent-to-agent messaging
