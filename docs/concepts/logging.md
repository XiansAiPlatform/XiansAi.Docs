# Logging in Xians

## Overview

Xians provides a context-aware logging system that automatically captures workflow metadata and routes logs to the console and/or the Xians server. Use the standard **ILogger** interface from `Microsoft.Extensions.Logging` for all logging.

---

## Logging in Workflows and Activities

| Context | Logger | How to Obtain |
|---------|--------|---------------|
| **Workflows** | Temporal's `Workflow.Logger` | Built-in; Xians uploads these logs to the server |
| **Activities** | `ILogger` via XiansLogger | `XiansLogger.GetLogger<T>()` or `XiansLogger.ForILogger(Type)` |

### Workflow Logging: Workflow.Logger

Workflows run in Temporal's deterministic environment. Use **Temporal's built-in `Workflow.Logger`**—Xians captures these logs and uploads them to the Xians server.

```csharp
using Temporalio.Exceptions;
using Temporalio.Workflows;

[Workflow(Constants.AGENT_NAME + ":News Search Workflow")]
public class NewsSearchWf
{
    [WorkflowRun]
    public async Task<string> SearchNewsAsync()
    {
        try
        {
            var sources = await Workflow.ExecuteActivityAsync(
                (NewsSearchActivities a) => a.FetchGenericNewsSourcesAsync(),
                new ActivityOptions { StartToCloseTimeout = TimeSpan.FromMinutes(5) });

            foreach (var source in sources)
            {
                Workflow.Logger.LogDebug($"Source {source.Name} has companies with stale scans");
            }
            return "News search completed.";
        }
        catch (Exception ex)
        {
            Workflow.Logger.LogError($"News search workflow failed: {ex.Message}", ex);
            throw new ApplicationFailureException($"News search workflow failed: {ex.Message}");
        }
    }
}
```

### Activity Logging: ILogger via XiansLogger

In activities, obtain an **ILogger** using `XiansLogger.GetLogger<T>()` or `XiansLogger.ForILogger(Type)`:

```csharp
using Microsoft.Extensions.Logging;
using Temporalio.Activities;
using Xians.Lib.Logging;

public class NewsSearchActivities
{
    private readonly IDataContext _data;
    private static readonly ILogger _logger = XiansLogger.GetLogger<NewsSearchActivities>();

    public NewsSearchActivities(IDataContext data) => _data = data;

    [Activity]
    public async Task<IReadOnlyList<NewsSourceItem>> FetchGenericNewsSourcesAsync()
    {
        var sources = await _data.NewsSources.GetActiveGenericSourcesAsync();
        _logger.LogDebug("Fetched {Count} generic news sources", sources.Count);
        return sources.Select(s => new NewsSourceItem(s.Id, s.Url, s.Name)).ToList();
    }

    [Activity]
    public async Task<int> ValidateAndSaveArticlesAsync(SearchItem item, Guid newsSourceId, Guid peerCompanyId)
    {
        if (string.IsNullOrWhiteSpace(item.Link))
        {
            _logger.LogWarning("Skipping item with no link: {Title}", item.Title);
            return 0;
        }
        _logger.LogDebug("Saved article for {Link}", item.Link);
        return 1;
    }
}
```

**Using runtime type:**

```csharp
private static readonly ILogger _logger = XiansLogger.ForILogger(typeof(NewsSearchActivities));
```

All standard `ILogger` extension methods are available: `LogTrace`, `LogDebug`, `LogInformation`, `LogWarning`, `LogError`, `LogCritical`, plus structured logging with message templates.

### Automatic Context Capture

Both workflow and activity logs **automatically** include workflow metadata when uploaded to the server:

```json
{
  "workflow_id": "tenant-abc:Market Analysts:News Search Workflow:user-123",
  "workflow_run_id": "def456-789-abc",
  "workflow_type": "Market Analysts:News Search Workflow",
  "agent": "Market Analysts",
  "participant_id": "user-123",
  "level": "Information",
  "message": "Fetched 4 generic news sources",
  "created_at": "2026-01-25T10:30:00Z"
}
```

**You don't need to add this context manually!**

---

## Server Upload Configuration

Logs from both workflows and activities can be sent to the Xians server. Server upload is **disabled by default**; you must set `ServerLogLevel` during platform initialization.

### Console vs Server Log Levels

Two independent thresholds control where logs go:

| Configuration | Where Logs Go | Default |
|---------------|---------------|---------|
| **ConsoleLogLevel** | Terminal/console | `Debug` |
| **ServerLogLevel** | Xians server | Disabled |

With `ConsoleLogLevel = LogLevel.Debug` and `ServerLogLevel = LogLevel.Information`:

- **Console** shows: Debug, Information, Warning, Error, Critical
- **Server** receives: Information, Warning, Error, Critical

```text
Your Code                Console              Server
   ├─ LogTrace        ────┼────────────────────┼──── (Below both)
   ├─ LogDebug        ────┼──> Displayed       │     (Console only)
   ├─ LogInformation  ────┼──> Displayed   ────┼──> Uploaded
   ├─ LogWarning      ────┼──> Displayed   ────┼──> Uploaded
   ├─ LogError        ────┼──> Displayed   ────┼──> Uploaded
   └─ LogCritical     ────┼──> Displayed   ────┼──> Uploaded
```

### Enable Server Upload

Set `ServerLogLevel` in code or via environment variables:

```csharp
// Program.cs or startup
var xiansPlatform = await XiansPlatform.InitializeAsync(new()
{
    ServerUrl = config.XiansServerUrl,
    ApiKey = config.XiansAgentCertificate,
    ServerLogLevel = LogLevel.Information,  // Enables upload; Information and above sent
    ConsoleLogLevel = LogLevel.Debug
});
```

Or via environment variables:

```bash
CONSOLE_LOG_LEVEL=DEBUG
SERVER_LOG_LEVEL=INFO
```

**Priority:** Code configuration > Environment variables > Defaults

### Log Levels Reference

| Level | Value | Example |
|-------|-------|---------|
| `Trace` | 0 | "Entering method X with param Y" |
| `Debug` | 1 | "Fetched 4 generic news sources" |
| `Information` | 2 | "News search completed" |
| `Warning` | 3 | "Skipping item with no link" |
| `Error` | 4 | "Workflow failed: connection timeout" |
| `Critical` | 5 | "Database connection lost" |

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

**Solution:** Set `ServerLogLevel` to enable server upload:

```csharp
var xiansPlatform = await XiansPlatform.InitializeAsync(new ()
{
    ServerUrl = serverUrl,
    ApiKey = xiansApiKey,
    ServerLogLevel = LogLevel.Warning  // ✅ This enables server logging
});
```

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
