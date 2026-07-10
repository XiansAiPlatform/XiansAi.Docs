# Logging

## Why a Special Logging Setup?

Two things make agent logging different from ordinary app logging. First, **workflow code runs in Temporal's deterministic environment**, so it needs Temporal's logger rather than a regular one. Second, logs are most useful when they're **attached to the right workflow, tenant, and user** — context you'd otherwise have to thread through every log call. Xians handles both: use the right logger for the context, and every uploaded log automatically carries the full workflow metadata.

| Where your code runs | Logger to use | Why |
|----------------------|---------------|-----|
| **Workflows** | Temporal's `Workflow.Logger` | Replay-safe in the deterministic environment; Xians uploads these to the server |
| **Activities** (and everywhere else) | `ILogger` from `XiansLogger.GetLogger<T>()` | Standard `Microsoft.Extensions.Logging` with context capture |

## Logging in Workflows

```csharp
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

            Workflow.Logger.LogDebug("Fetched {Count} sources", sources.Count);
            return "News search completed.";
        }
        catch (Exception ex)
        {
            Workflow.Logger.LogError(ex, "News search workflow failed");
            throw new ApplicationFailureException($"News search workflow failed: {ex.Message}");
        }
    }
}
```

## Logging in Activities

```csharp
using Microsoft.Extensions.Logging;
using Xians.Lib.Logging;

public class NewsSearchActivities
{
    private static readonly ILogger _logger = XiansLogger.GetLogger<NewsSearchActivities>();
    // or: XiansLogger.ForILogger(typeof(NewsSearchActivities));

    [Activity]
    public async Task<IReadOnlyList<NewsSourceItem>> FetchGenericNewsSourcesAsync()
    {
        var sources = await _data.NewsSources.GetActiveGenericSourcesAsync();
        _logger.LogDebug("Fetched {Count} generic news sources", sources.Count);
        return sources.Select(s => new NewsSourceItem(s.Id, s.Url, s.Name)).ToList();
    }
}
```

All standard `ILogger` methods work (`LogTrace` through `LogCritical`), including structured message templates.

## Context Comes Free

Logs uploaded to the server automatically include the workflow metadata — no manual enrichment:

```json
{
  "workflow_id": "tenant-abc:Market Analysts:News Search Workflow:user-123",
  "workflow_type": "Market Analysts:News Search Workflow",
  "agent": "Market Analysts",
  "participant_id": "user-123",
  "level": "Information",
  "message": "Fetched 4 generic news sources",
  "created_at": "2026-01-25T10:30:00Z"
}
```

## Where Logs Go: Console vs Server

Two independent thresholds decide each log's destinations:

| Setting | Destination | Default |
|---------|-------------|---------|
| `ConsoleLogLevel` | Terminal | `Debug` |
| `ServerLogLevel` | Xians server | **Disabled** — you must opt in |

```csharp
var xiansPlatform = await XiansPlatform.InitializeAsync(new()
{
    ServerUrl = config.XiansServerUrl,
    ApiKey = config.XiansAgentCertificate,
    ConsoleLogLevel = LogLevel.Debug,
    ServerLogLevel = LogLevel.Information   // enables server upload
});
```

Or via environment variables (`CONSOLE_LOG_LEVEL=DEBUG`, `SERVER_LOG_LEVEL=INFO`). Code configuration wins over environment variables.

With the example above: the console shows Debug and up, while the server receives Information and up.

## How Server Upload Works

Logs are queued in memory and uploaded in batches — this keeps logging cheap and resilient, at the cost of a small delay:

| Behavior | Detail |
|----------|--------|
| Batch size / interval | 100 logs / every 60 seconds (defaults) |
| Visibility delay | Logs may take **up to 60 seconds** to appear in the dashboard |
| Failures | Failed uploads are automatically requeued |
| Shutdown | Pending logs are flushed on exit |
| Retention | Server logs are deleted after **15 days** by default (MongoDB TTL) — don't rely on them for long-term audit trails |

Tune batching when needed — smaller/faster for near-real-time visibility, larger/slower for high-volume systems:

```csharp
LoggingServices.ConfigureBatchSettings(
    batchSize: 50,
    processingIntervalMs: 30000);
```

## Troubleshooting: "My logs aren't on the server"

The most common cause is that server upload is **disabled by default** — set `ServerLogLevel` as shown above. To verify it's working:

```csharp
_logger.LogWarning("Test message - server logging verification");

var (queuedCount, retryingCount) = LoggingServices.GetLoggingStats();
Console.WriteLine($"Queued logs: {queuedCount}, Retrying: {retryingCount}");
```

A `queuedCount > 0` means logs are being captured and queued for upload. Remember the up-to-60-second batch delay before they appear.
