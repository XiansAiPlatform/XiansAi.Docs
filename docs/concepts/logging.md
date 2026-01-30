# Logging in Xians

## Overview

Xians provides a powerful, context-aware logging system that automatically captures workflow metadata and routes logs to appropriate destinations. The `Logger<T>` wrapper simplifies logging across workflows, activities, and message handlers.

## Quick Start

### 1. Add the Logger to Your Class

```csharp
using Xians.Lib.Logging;

public class MyWorkflow
{
    // Create a static logger instance - created once and reused
    private static readonly Logger<MyWorkflow> _logger = Logger<MyWorkflow>.For();
    
    public async Task ProcessAsync()
    {
        _logger.LogInformation("Processing started");
        // Your code here
    }
}
```

### 2. Configure Log Levels

```csharp
using Xians.Lib.Agents.Core;
using Microsoft.Extensions.Logging;

var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    ConsoleLogLevel = LogLevel.Information,  // Console output
    ServerLogLevel = LogLevel.Warning         // Uploaded to server
});
```

---

## Understanding Log Levels

### Console vs Server Logs

Xians uses **two independent log level configurations**:

| Configuration | Where Logs Go | Default | Purpose |
|--------------|---------------|---------|---------|
| **ConsoleLogLevel** | Terminal/Console | `Debug` | Development visibility |
| **ServerLogLevel** | Xians Server | `Error` | Production monitoring |

> **⏰ Server Log Retention:** Logs uploaded to the server are automatically deleted after **15 days** (default TTL). To change retention, contact your server admin or modify the `mongodb-indexes.yaml` configuration file.

### How It Works

```
Your Code           Console              Server
   │                   │                    │
   ├─ LogTrace     ────┼────────────────────┼──── (Below both thresholds)
   ├─ LogDebug     ────┼────────────────────┼──── (Below both thresholds)
   ├─ LogInfo      ────┼──> Displayed       │     (Above console, below server)
   ├─ LogWarning   ────┼──> Displayed   ────┼──> Uploaded
   ├─ LogError     ────┼──> Displayed   ────┼──> Uploaded
   └─ LogCritical  ────┼──> Displayed   ────┼──> Uploaded
```

**With `ConsoleLogLevel = Information` and `ServerLogLevel = Warning`:**
- **Console** shows: Information, Warning, Error, Critical
- **Server** receives: Warning, Error, Critical

---

## Configuration

### Option 1: Programmatic (Recommended)

```csharp
using Microsoft.Extensions.Logging;

var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    
    // Set log levels in code
    ConsoleLogLevel = LogLevel.Information,  // Console threshold
    ServerLogLevel = LogLevel.Warning         // Server upload threshold
});
```

### Option 2: Environment Variables

```bash
# In your .env file
CONSOLE_LOG_LEVEL=INFO
SERVER_LOG_LEVEL=WARNING
```

**Priority:** Code configuration > Environment variables > Defaults

---

## Log Levels Reference

| Level | Value | When to Use | Example |
|-------|-------|-------------|---------|
| `Trace` | 0 | Detailed execution flow | "Entering method X with param Y" |
| `Debug` | 1 | Development diagnostics | "Cache hit for key: user_123" |
| `Information` | 2 | General milestones | "Order processed successfully" |
| `Warning` | 3 | Potential issues | "API response time exceeded 2s" |
| `Error` | 4 | Recoverable errors | "Failed to send email, will retry" |
| `Critical` | 5 | Fatal failures | "Database connection lost" |

---

## Usage in Workflows

### Basic Workflow Logging

```csharp
using Xians.Lib.Logging;

public class OrderProcessingWorkflow
{
    private static readonly Logger<OrderProcessingWorkflow> _logger = 
        Logger<OrderProcessingWorkflow>.For();
    
    public async Task ProcessOrderAsync(string orderId)
    {
        _logger.LogInformation("Starting order processing for {OrderId}", orderId);
        
        try
        {
            await ValidateOrder(orderId);
            await ChargePayment(orderId);
            await FulfillOrder(orderId);
            
            _logger.LogInformation("Order {OrderId} processed successfully", orderId);
        }
        catch (PaymentException ex)
        {
            _logger.LogError("Payment failed for order {OrderId}", ex, orderId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogCritical("Critical failure processing order {OrderId}", ex, orderId);
            throw;
        }
    }
    
    private async Task ValidateOrder(string orderId)
    {
        _logger.LogDebug("Validating order {OrderId}", orderId);
        // Validation logic
    }
}
```

### Automatic Context Capture

The logger **automatically** includes workflow metadata:

```json
{
  "workflow_id": "tenant-abc:OrderAgent:OrderWorkflow:user-123",
  "workflow_run_id": "def456-789-abc",
  "workflow_type": "OrderAgent:OrderWorkflow",
  "agent": "OrderAgent",
  "participant_id": "user-123",
  "level": "Information",
  "message": "Order ORD-456 processed successfully",
  "created_at": "2026-01-25T10:30:00Z"
}
```

**You don't need to add this context manually!**

---

## Usage in Message Handlers

### OnUserChatMessage Handler

```csharp
using Xians.Lib.Logging;
using Xians.Lib.Agents.Core;

public class CustomerSupportAgent
{
    private static readonly Logger<CustomerSupportAgent> _logger = 
        Logger<CustomerSupportAgent>.For();
    
    public void SetupWorkflow(XiansWorkflow workflow)
    {
        workflow.OnUserChatMessage(async (context) =>
        {
            var userId = context.ParticipantId;
            var message = context.Message.Content;
            
            _logger.LogInformation(
                "Received message from user {UserId}: {MessagePreview}", 
                userId, 
                message.Substring(0, Math.Min(50, message.Length))
            );
            
            try
            {
                var response = await GenerateResponse(message);
                await context.ReplyAsync(response);
                
                _logger.LogInformation("Response sent to user {UserId}", userId);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    "Failed to process message for user {UserId}", 
                    ex, 
                    userId
                );
                
                await context.ReplyAsync("I apologize, I encountered an error. Please try again.");
            }
        });
    }
}
```

### OnWebhook Handler

```csharp
public class WebhookProcessor
{
    private static readonly Logger<WebhookProcessor> _logger = 
        Logger<WebhookProcessor>.For();
    
    public void SetupWebhook(XiansWorkflow workflow)
    {
        workflow.OnWebhook((context) =>
        {
            var webhookName = context.Webhook.Name;
            var payload = context.Webhook.Payload;
            
            _logger.LogInformation(
                "Processing webhook: {WebhookName}", 
                webhookName
            );
            
            try
            {
                // Process webhook
                ProcessWebhookPayload(payload);
                
                context.Respond(new { status = "success" });
                _logger.LogInformation("Webhook {WebhookName} processed", webhookName);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    "Webhook processing failed: {WebhookName}", 
                    ex, 
                    webhookName
                );
                
                context.Respond(new 
                { 
                    status = "error", 
                    message = "Processing failed" 
                });
            }
        });
    }
}
```

---

## Complete Example: E-commerce Agent

```csharp
using Xians.Lib.Agents.Core;
using Xians.Lib.Logging;
using Microsoft.Extensions.Logging;

public class EcommerceAgent
{
    private static readonly Logger<EcommerceAgent> _logger = 
        Logger<EcommerceAgent>.For();
    
    public static async Task Main(string[] args)
    {
        // Configure logging
        var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
        {
            ServerUrl = Environment.GetEnvironmentVariable("XIANS_SERVER_URL"),
            ApiKey = Environment.GetEnvironmentVariable("XIANS_API_KEY"),
            
            // Development: See debug info, upload warnings+
            ConsoleLogLevel = LogLevel.Debug,
            ServerLogLevel = LogLevel.Warning
        });
        
        var agent = xiansPlatform.Agents.Register(new ()
        {
            Name = "EcommerceAgent",
            IsTemplate = true
        });
        
        var orderWorkflow = agent.Workflows.DefineBuiltIn(
            name: "Order Processing"
        );
        
        // Handle customer messages
        orderWorkflow.OnUserChatMessage(async (context) =>
        {
            var userId = context.ParticipantId;
            var message = context.Message.Content;
            
            _logger.LogInformation(
                "Customer {UserId} inquiry: {Message}", 
                userId, 
                message
            );
            
            if (message.Contains("order status", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogDebug("Checking order status for user {UserId}", userId);
                
                try
                {
                    var status = await GetOrderStatus(userId);
                    await context.ReplyAsync($"Your order status: {status}");
                    
                    _logger.LogInformation(
                        "Order status retrieved for {UserId}: {Status}", 
                        userId, 
                        status
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        "Failed to retrieve order status for {UserId}", 
                        ex, 
                        userId
                    );
                    
                    await context.ReplyAsync(
                        "I'm having trouble accessing your order. Please try again."
                    );
                }
            }
            else
            {
                _logger.LogDebug("General inquiry from {UserId}", userId);
                await context.ReplyAsync("How can I help you today?");
            }
        });
        
        _logger.LogInformation("EcommerceAgent started successfully");
        await agent.RunAllAsync();
    }
    
    private static async Task<string> GetOrderStatus(string userId)
    {
        // Implementation
        return "Shipped";
    }
}
```

## How Logs Are Uploaded to Server

### Batch Upload Mechanism

Logs are **not** uploaded immediately. Instead, they are queued and uploaded in periodic batches:

| Setting | Default | Description |
|---------|---------|-------------|
| **Batch Size** | 100 logs | Maximum logs per upload batch |
| **Upload Interval** | 60 seconds | Time between batch uploads |
| **Queue Type** | In-memory | Concurrent queue (thread-safe) |
| **Retry** | Automatic | Failed uploads are requeued |
| **Shutdown** | Flush all | Pending logs uploaded on exit |

### What This Means for You

**⏱️ Delay:** Logs may take **up to 60 seconds** to appear on the server dashboard.

**🔄 Reliability:** 
- Failed uploads are automatically retried
- Logs are flushed on application shutdown
- Network issues won't cause immediate log loss

**📊 Performance:**
- Minimal impact on application performance
- Batching reduces server API calls
- Asynchronous upload doesn't block your code

### Configuration (Advanced)

You can customize batch settings programmatically:

```csharp
using Xians.Lib.Logging;

// Customize batch upload settings (optional)
LoggingServices.ConfigureBatchSettings(
    batchSize: 50,              // Smaller batches
    processingIntervalMs: 30000 // Upload every 30 seconds
);
```

**When to customize:**
- **Smaller batches + frequent uploads** → Critical systems needing near real-time logs
- **Larger batches + less frequent** → High-volume systems to reduce API calls

---

## Log Retention on Server

### Default Retention Period

Server logs are automatically deleted after **15 days** by default due to MongoDB TTL (Time To Live) indexing.

**Important Considerations:**

1. **Logs are temporary** - Don't rely on server logs for long-term audit trails
2. **Adjust if needed** - Contact your server administrator to modify retention
3. **Storage costs** - Longer retention = more storage required
4. **Compliance** - Ensure retention meets your regulatory requirements

### How to Change Retention

**Consult with your server administrator** before making changes.
