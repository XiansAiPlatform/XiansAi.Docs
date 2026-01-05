# Messaging with Users

Built-in workflows in Xians provide a powerful messaging system that allows your agents to listen for incoming messages and respond to users naturally. This guide covers everything you need to know about handling user messages and crafting responses.

## Overview

When you define a built-in workflow (like a Conversational workflow), you can register **message listeners** that are triggered when users send messages to your agent. These listeners receive a rich context object that contains the incoming message details and provides methods to respond.

## Message Listeners

### Listening to Chat Messages

The most common type of message is a chat message. Register a listener using `OnUserChatMessage`:

```csharp
var conversationalWorkflow = xiansAgent.Workflows.DefineBuiltIn(name: "Conversational");

conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Access the user's message
    var userMessage = context.Message.Text;
    
    // Process and respond
    await context.ReplyAsync($"You said: {userMessage}");
});
```

### Listening to Data Messages

For structured data messages, use `OnUserDataMessage`:

```csharp
conversationalWorkflow.OnUserDataMessage(async (context) =>
{
    // Access structured data from the message
    var data = context.Message.Data;
    
    // Process the data and respond
    await context.ReplyAsync("Data received and processed!");
});
```

## Accessing Message Properties

The `context.Message` property gives you access to all incoming message details:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Message content
    var text = context.Message.Text;
    var data = context.Message.Data;
    
    // User and conversation context
    var participantId = context.Message.ParticipantId;
    var threadId = context.Message.ThreadId;
    var requestId = context.Message.RequestId;
    
    // Additional context
    var scope = context.Message.Scope;
    var hint = context.Message.Hint;
    var tenantId = context.Message.TenantId;
    
    // Authorization (if applicable)
    var authorization = context.Message.Authorization;
});
```

### Message Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `Text` | `string` | The text content of the message |
| `Data` | `object?` | Structured data associated with the message |
| `ParticipantId` | `string` | Unique identifier for the conversation participant |
| `RequestId` | `string` | Unique identifier for this specific message request |
| `ThreadId` | `string?` | Thread identifier for conversation threading |
| `Scope` | `string?` | Optional scope for organizing messages into topics (see [Scope](#scope)) |
| `Hint` | `string?` | Optional hint for message handling |
| `TenantId` | `string` | Tenant identifier (for multi-tenant applications) |
| `Authorization` | `string?` | Authorization token if provided |

## Message Types

When responding to users, there are three distinct message types:

| Type | Purpose | Method | Use Case |
|------|---------|--------|----------|
| **Chat** | Standard agent-user conversations | `ReplyAsync()` | Text-based communication and typical conversational interactions |
| **Data** | Passing structured data between parties | `SendDataAsync()` | Sending structured data objects; data is the primary content |
| **Handoff** | Transfer user to a different workflow/sub-agent | `SendHandoffAsync()` | Routing to specialized agents; requests UI to switch to a different workflow ID |

## Responding to Users

Xians provides several methods for sending responses back to users, each optimized for different use cases.

### Simple Text Replies

The most straightforward way to respond is with plain text:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    await context.ReplyAsync("Hello! How can I help you today?");
});
```

### Replies with Data

Send both text and structured data together using the optional `data` parameter:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var result = new 
    {
        Status = "Success",
        Timestamp = DateTime.UtcNow,
        ProcessedItems = 42
    };
    
    await context.ReplyAsync("Processing complete!", result);
});
```

### Data-Focused Responses

When the primary response is structured data, use `SendDataAsync`:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var analyticsData = new 
    {
        Metrics = new[] { 100, 200, 300 },
        Labels = new[] { "Jan", "Feb", "Mar" }
    };
    
    // Data is the primary content
    await context.SendDataAsync(analyticsData, "Here are your analytics");
});
```

## Message Scope

**Scope** is a powerful feature for organizing messages into isolated topics within a conversation thread. When messages share the same scope value, they form a distinct topic, allowing you to manage multiple parallel conversations or subject areas with the same participant.

### How Scope Works

- Messages with the same scope string are grouped together as a topic
- Each scope creates an isolated conversation context within the thread
- Users and agents can set scope when sending messages or responding
- Scope is optional - messages without a scope belong to the main conversation

### Accessing Current Message Scope

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var currentScope = context.Message.Scope;
    
    if (currentScope != null)
    {
        await context.ReplyAsync($"Discussing topic: {currentScope}");
    }
    else
    {
        await context.ReplyAsync("General conversation");
    }
});
```

### Best Practices for Scope

**Use Human-Readable Scope Values**

Always use descriptive, human-readable strings for scope values. These can be displayed to users when showing conversation threads:

```csharp
// Good - Clear, human-readable scope
var scope = "Order #12345 - Delivery Status";
var scope = "Project Alpha - Budget Discussion";
var scope = "Technical Support - Login Issues";

// Bad - Technical IDs or codes
var scope = "ord_12345_dlv_sts";
var scope = "uuid-1234-5678-9abc";
```

### Creating Scoped Conversations

When you want to start a new topic or respond within a specific scope, you can set the scope in your context. Messages will automatically inherit the current scope:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var userMessage = context.Message.Text.ToLower();
    
    if (userMessage.Contains("order status"))
    {
        // The scope from the incoming message will be preserved in the reply
        // All subsequent messages in this topic will share this scope
        await context.ReplyAsync(
            "Let me check your order status. Which order would you like to know about?"
        );
    }
});
```

### Scope with Chat History

When retrieving chat history, only messages with the same scope are returned, maintaining topic isolation:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var currentScope = context.Message.Scope;
    
    // This returns only messages with the same scope
    var scopedHistory = await context.GetChatHistoryAsync(pageSize: 20);
    
    if (currentScope != null)
    {
        // All messages in scopedHistory will share the same scope
        await context.ReplyAsync(
            $"I see we've discussed '{currentScope}' in {scopedHistory.Count} previous messages."
        );
    }
});
```

### Reply Scope

When you send a reply, it automatically inherits the scope from the incoming message, maintaining topic continuity:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // This reply automatically uses the same scope as context.Message.Scope
    await context.ReplyAsync("Your message is within the current scope.");
    
    // The sent message will have the same scope as the incoming message
});
```

### Null Scope

Messages sent without a specified scope (scope is `null`) form their own isolated context - the general conversation area within the thread:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    if (context.Message.Scope == null)
    {
        // This is a general conversation message
        // History will only include other messages with null scope
        var generalHistory = await context.GetChatHistoryAsync(pageSize: 20);
        
        await context.ReplyAsync("Discussing general topics.");
    }
    else
    {
        // This is a scoped topic message
        var topicHistory = await context.GetChatHistoryAsync(pageSize: 20);
        
        await context.ReplyAsync($"Discussing: {context.Message.Scope}");
    }
});
```

**Key Points:**

- Messages with `scope = null` are NOT accessible when querying with a specific scope
- Messages with `scope = "Topic A"` are NOT accessible when querying with `scope = null` or `scope = "Topic B"`
- Each scope (including `null`) forms a completely isolated conversation context
- Scope isolation happens automatically - you don't need to manually filter messages

## Chat History

Access the conversation history to provide context-aware responses:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Get the last 10 messages
    var history = await context.GetChatHistoryAsync(page: 1, pageSize: 10);
    
    // Use history to understand context
    var messageCount = history.Count;
    await context.ReplyAsync($"I see we've exchanged {messageCount} messages so far.");
});
```

### Pagination

For longer conversations, use pagination:

```csharp
// Get second page with 20 messages per page
var page2 = await context.GetChatHistoryAsync(page: 2, pageSize: 20);
```

## Working with Hints

Retrieve the last hint to understand user intent or context:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var lastHint = await context.GetLastHintAsync();
    
    if (lastHint != null)
    {
        await context.ReplyAsync($"Based on your hint '{lastHint}', I'll help with that.");
    }
});
```

## Skipping Responses

Sometimes you want to process a message without sending a response:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Set this flag to prevent automatic responses
    context.SkipResponse = true;
    
    // Process the message silently
    await LogMessageToDatabase(context.Message.Text);
    
    // No response will be sent to the user
});
```

This is useful for:

- Analytics and logging
- Background processing
- Conditional response logic

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Conditionally skip responses
    if (context.Message.Text.StartsWith("LOG:"))
    {
        context.SkipResponse = true;
        await LogSystemEvent(context.Message.Text);
        return;
    }
    
    await context.ReplyAsync("Message received!");
});
```

## Handing Off to Another Workflow

Transfer the conversation to a different workflow when needed:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    if (context.Message.Text.Contains("talk to sales"))
    {
        await context.SendHandoffAsync(
            targetWorkflowId: "sales-workflow-id",
            message: "Customer wants to discuss sales",
            data: new { Source = "chat", Priority = "high" },
            userMessage: "Connecting you with our sales team..."
        );
    }
});
```

## Best Practices

### 1. Always Handle Errors Gracefully

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    try
    {
        var response = await ProcessMessageAsync(context.Message.Text);
        await context.ReplyAsync(response);
    }
    catch (Exception ex)
    {
        // Log the error
        logger.LogError(ex, "Error processing message");
        
        // Send friendly error message to user
        await context.ReplyAsync(
            "I encountered an error processing your request. Please try again."
        );
    }
});
```

### 2. Provide Clear, Actionable Responses

```csharp
//  Vague response
await context.ReplyAsync("Done");

//  Clear, informative response
await context.ReplyAsync("I've updated your preferences. You'll now receive daily summaries at 9 AM.");
```

### 3. Use Appropriate Response Methods

```csharp
// For text-only responses
await context.ReplyAsync("Simple message");

// For text with data
await context.ReplyAsync("Your order is ready!", orderDetails);

// When data is the primary response
await context.SendDataAsync(chartData, "Here's your analytics dashboard");
```

### 4. Leverage Chat History Wisely

```csharp
// Don't fetch too much history unnecessarily
var recentHistory = await context.GetChatHistoryAsync(pageSize: 5); // Good

// Avoid excessive pagination in real-time handlers
var allHistory = await context.GetChatHistoryAsync(pageSize: 1000); // Potentially slow
```

### 5. Use Descriptive Scopes for Topic Organization

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var scope = context.Message.Scope;
    
    // ✅ Good - Users can understand the topic
    if (scope == "Order #12345 - Delivery Questions")
    {
        await HandleOrderDeliveryQuestions(context);
    }
    
    // ❌ Bad - Cryptic scope values
    if (scope == "ord_dlv_12345")
    {
        await HandleOrderDeliveryQuestions(context);
    }
});
```

## Metadata Access

Access optional metadata passed with messages internally in the agent (For example in A2A message passing). Metada is not returned or obtained from the user.

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    if (context.Metadata != null)
    {
        if (context.Metadata.TryGetValue("priority", out var priority))
        {
            // Handle high-priority messages differently
            if (priority == "high")
            {
                await HandleUrgentMessage(context);
            }
        }
    }
    
    await context.ReplyAsync("Processing your request...");
});
```

## Message Threads

Message threads are the fundamental organizational unit for conversations between users and agents in the Xians platform. Every message exchange is associated with a specific thread that groups related interactions together.

### Thread Identity

Each message thread is uniquely identified by a composite primary key consisting of three components:

1. **Tenant ID**: Identifies the organization or tenant
2. **Workflow ID**: Identifies the specific workflow or agent instance  
3. **Participant ID**: Identifies the user or participant in the conversation

This three-part identifier ensures that conversations are properly isolated and organized across different tenants, workflows, and users.

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // Thread identity components
    var tenantId = context.Message.TenantId;           // Which organization
    var workflowId = XiansContext.CurrentWorkflow.WorkflowType; // Which agent/workflow
    var participantId = context.Message.ParticipantId; // Which user
    
    // Together, these three values uniquely identify this conversation thread
    // All messages between this user and this workflow in this tenant
    // belong to the same thread
});
```

### Thread Continuity

All conversations between a specific user and agent workflow are grouped within a single thread, maintaining context and conversation history throughout the interaction lifecycle:

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var threadId = context.Message.ThreadId;
    
    if (threadId != null)
    {
        // This conversation has history
        var allMessages = await context.GetChatHistoryAsync(pageSize: 100);
        
        await context.ReplyAsync(
            $"We've exchanged {allMessages.Count} messages in this ongoing conversation."
        );
    }
    else
    {
        // First message in this thread
        await context.ReplyAsync("Welcome! This is the start of our conversation.");
    }
});
```

**Key Thread Characteristics:**

- **Persistent**: Threads persist across multiple message exchanges and sessions
- **Isolated**: Messages in one thread are never visible to other threads
- **Tenant-Scoped**: Threads are isolated per tenant in multi-tenant applications
- **Workflow-Specific**: Each workflow maintains separate threads with the same user
- **User-Specific**: Each user has their own thread with each workflow

## Thread and Scope Management

Threads and scopes work together in a hierarchical structure to organize conversations and manage context.

### Hierarchical Organization

The Xians messaging system uses a three-level hierarchy:

```text
Thread (Top Level)
├── Scope: null (Default/General Conversation)
│   ├── Message 1
│   ├── Message 2
│   └── Message 3
├── Scope: "Order #12345"
│   ├── Message 4
│   ├── Message 5
│   └── Message 6
└── Scope: "Technical Support"
    ├── Message 7
    └── Message 8
```

**Hierarchy Breakdown:**

1. **Thread**: The top-level container (identified by Tenant + Workflow + Participant)
2. **Scope**: Sub-organization within the thread (optional string identifier)
3. **Messages**: Individual messages within a specific scope

```csharp
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var threadId = context.Message.ThreadId;
    var scope = context.Message.Scope;
    
    if (threadId != null)
    {
        // This is part of a thread
        var threadHistory = await context.GetChatHistoryAsync(pageSize: 20);
        
        if (scope != null)
        {
            // Scoped topic within a thread
            await context.ReplyAsync(
                $"Continuing our discussion about '{scope}' in this thread..."
            );
        }
        else
        {
            // General thread conversation (null scope)
            await context.ReplyAsync("Continuing our conversation in this thread...");
        }
    }
    else
    {
        // New conversation
        await context.ReplyAsync("Starting a new conversation!");
    }
});
```

### Understanding Threads vs Scope

- **Thread**: A continuous conversation session between a user and agent workflow
  - **Purpose**: Groups all interactions between a specific user and workflow
  - **Lifetime**: Persists indefinitely across all message exchanges
  - **Uniqueness**: One thread per (Tenant, Workflow, Participant) combination

- **Scope**: Topics or subject areas within a thread for organizing messages
  - **Purpose**: Isolates related messages into distinct topics within a thread
  - **Lifetime**: Exists as long as messages reference it
  - **Uniqueness**: Multiple scopes can exist within a single thread

Think of it as:

- **Thread** = The entire conversation book
- **Scope** = Individual chapters within that book
- **Messages** = Pages within each chapter

### Practical Examples

**Single Thread, Multiple Scopes:**

```csharp
// Example: Multiple topics within one thread
conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    var threadId = context.Message.ThreadId; // e.g., "thread-123"
    var scope = context.Message.Scope;
    
    // Same thread, different scopes = different topics in the same conversation
    // - Thread "thread-123", Scope "Order #5678" (messages about this order)
    // - Thread "thread-123", Scope "Shipping Questions" (shipping-related messages)
    // - Thread "thread-123", Scope null (general chat messages)
    
    // Each scope maintains its own isolated message history
    var scopeHistory = await context.GetChatHistoryAsync(pageSize: 20);
    // Only returns messages from the current scope
});
```

**Multi-User, Multi-Workflow Isolation:**

```csharp
// Different users with same workflow = different threads
// User A + Workflow "Sales" + Tenant "ACME" = Thread 1
// User B + Workflow "Sales" + Tenant "ACME" = Thread 2

// Same user with different workflows = different threads  
// User A + Workflow "Sales" + Tenant "ACME" = Thread 1
// User A + Workflow "Support" + Tenant "ACME" = Thread 3

conversationalWorkflow.OnUserChatMessage(async (context) =>
{
    // This user's history with THIS specific workflow
    var workflowSpecificHistory = await context.GetChatHistoryAsync(pageSize: 50);
    
    // Messages from other workflows are never visible here
});
```
