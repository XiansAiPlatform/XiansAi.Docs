# Logging in Xians

## Overview

Xians provides a context-aware logging system that automatically captures workflow metadata and routes logs to appropriate destinations. 

## Quick Start

### 1. Add the Logger to Your Class

You can create loggers using two different approaches:

**Option A: Type-based Logger (Best for static classes)**

```csharp
using Xians.Lib.Logging;

public static class MyWorkflow
{
    // Create using typeof() - ideal for static classes and runtime types
    private static readonly IXiansLogger _logger = Logger.For(typeof(MyWorkflow));
    
    public static async Task ProcessAsync()
    {
        _logger.LogInformation("Processing started");
        // Your code here
    }
}
```

**Option B: Generic Logger (Best for instance classes)**

```csharp
using Xians.Lib.Logging;

public class MyWorkflow
{
    // Create using generic type parameter - clean syntax for instance classes
    private static readonly IXiansLogger _logger = Logger<MyWorkflow>.For();
    
    public async Task ProcessAsync()
    {
        _logger.LogInformation("Processing started");
        // Your code here
    }
}
```

> **💡 Which approach to use?** Both return the same `IXiansLogger` interface. Use `Logger.For(typeof())` in **static classes** or when working with runtime types. Use `Logger<T>.For()` in **instance classes** for cleaner generic syntax.

### 2. Enable Server Logging (Required)

> **🚨 Important:** Server log upload is **disabled by default**. To enable logs to be sent to the Xians server, you must set the `ServerLogLevel` property during platform initialization.

```csharp
using Xians.Lib.Agents.Core;
using Microsoft.Extensions.Logging;

var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    ConsoleLogLevel = LogLevel.Information,  // Console output
    ServerLogLevel = LogLevel.Warning         // ✨ This enables server upload!
});
```

> **✨ Automatic Initialization:** Setting `ServerLogLevel` to any value automatically enables server log upload. No manual initialization required!

---

## Understanding Log Levels

### Console vs Server Logs

Xians uses **two independent log level configurations**:

| Configuration | Where Logs Go | Default | Purpose |
|--------------|---------------|---------|---------|
| **ConsoleLogLevel** | Terminal/Console | `Debug` | Development visibility |
| **ServerLogLevel** | Xians Server | **Disabled** | Production monitoring |

> **⚠️ Server Logging Disabled by Default:** To enable server log upload, you must explicitly set `ServerLogLevel` to any log level (e.g., `LogLevel.Warning`). If not set, logs are only displayed in the console.

> **⏰ Server Log Retention:** Logs uploaded to the server are automatically deleted after **15 days** (default TTL). To change retention, contact your server admin or modify the `mongodb-indexes.yaml` configuration file.

### How It Works

**With `ConsoleLogLevel = Information` and `ServerLogLevel = Warning`:**

- **Console** shows: Information, Warning, Error, Critical
- **Server** receives: Warning, Error, Critical

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

---

## Configuration

### Option 1: Programmati

```csharp
using Microsoft.Extensions.Logging;

var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    
    // Set log levels in code
    ConsoleLogLevel = LogLevel.Information,  // Console threshold
    ServerLogLevel = LogLevel.Warning        // ✨ Enables & configures server upload
});
```

> **✨ Setting `ServerLogLevel` automatically enables server log upload** - no additional configuration needed!

### Option 2: Environment Variables

```bash
# In your .env file
CONSOLE_LOG_LEVEL=INFO
SERVER_LOG_LEVEL=WARNING
```

**Priority:** Code configuration > Environment variables > Defaults

---

### Performance & Caching

All logger creation patterns use the same underlying infrastructure:

- **Thread-safe caching** - Each type gets one cached logger instance
- **Lazy initialization** - Underlying ILogger created only when first used  
- **Automatic cleanup** - Cached instances cleared when app shuts down
- **Zero performance difference** - Both patterns have identical performance

```csharp
// These all return the same cached instance for MyClass
var logger1 = Logger.For(typeof(MyClass));
var logger2 = Logger.For(typeof(MyClass)); // Same instance as logger1
var logger3 = Logger<MyClass>.For();       // Same instance as logger1 & logger2
```

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
    // Option 1: Type-based logger (good for static classes)
    private static readonly IXiansLogger _logger = 
        Logger.For(typeof(OrderProcessingWorkflow));
    
    // Option 2: Generic logger (good for instance classes)  
    // private static readonly IXiansLogger _logger = 
    //     Logger<OrderProcessingWorkflow>.For();
    
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

---

## Troubleshooting

### "My logs aren't appearing on the server"

**Most common cause:** Server logging is disabled by default.

**✅ Solution:** Set `ServerLogLevel` to enable server upload:

```csharp
var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    ServerLogLevel = LogLevel.Warning  // ✅ This enables server logging
});
```

### Other Common Issues

**Issue: Logs appear in console but not on server**

- ✅ **Check:** Is `ServerLogLevel` set?
- ✅ **Check:** Are your logs meeting the server threshold?
- ✅ **Check:** Wait up to 60 seconds for batch upload

**Issue: Only some logs appear on server**

- ✅ **Check:** Server log level threshold (only logs at or above the level are uploaded)
- Example: `ServerLogLevel = LogLevel.Warning` → only Warning, Error, Critical uploaded

**Issue: No logs at all (console or server)**

- ✅ **Check:** Logger creation and method calls
- ✅ **Check:** Log level meets console threshold
- ✅ **Check:** Application lifecycle (logs flushed on shutdown)

**Issue: Server logging explicitly disabled**

- ✅ **Check:** `DisableServerLogging = false` (default)
- ✅ **Environment:** Ensure test environment allows server connections

### Verification

**Confirm server logging is enabled:**

```csharp
// Log a test message at server threshold level
_logger.LogWarning("Test message - server logging verification");

// Check logging service status
var (queuedCount, retryingCount) = LoggingServices.GetLoggingStats();
Console.WriteLine($"Queued logs: {queuedCount}, Retrying: {retryingCount}");
```

If `queuedCount > 0`, server logging is working and logs are queued for upload.
