# Scheduling Concepts

## What Are Schedules?

Schedules are **cron jobs for AI agents**. They let your workflows execute on time-based triggers - daily reports at 9 AM, hourly health checks, weekly analytics, or any recurring task your agents need to handle.

Unlike traditional cron jobs, Xians schedules are:

- **Durable** - Survive restarts and failures
- **Multi-tenant aware** - Automatic isolation per tenant
- **Workflow-native** - Fully deterministic when used inside workflows
- **Production-ready** - Built-in retries, timeouts, and overlap policies

Powered by [Temporal Schedules](https://docs.temporal.io/workflows#schedule), wrapped in a fluent API that feels natural to use.

## Why Scheduling?

AI agents need to be proactive, not just reactive. Schedules let your agents:

- Run daily data syncs without manual triggers
- Generate morning briefings automatically
- Perform background research on a schedule
- Monitor systems at regular intervals
- Orchestrate recurring business processes

**The key insight**: Workflows that schedule themselves are autonomous. They control their own timing, create follow-up work, and operate continuously without external coordination.

## Quick Start

Here's a workflow that schedules itself to run every day at 9 AM:

```csharp
[Workflow("Daily Report Workflow")]
public class DailyReportWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string reportType)
    {
        // Do the work
        await GenerateReport(reportType);
        
        // Schedule next run (idempotent - safe to call repeatedly)
        var schedule = await XiansContext.CurrentWorkflow.Schedules!
            .Create("daily-report")
            .Daily(hour: 9, timezone: "America/New_York")
            .WithInput(reportType)
            .SkipIfRunning()
            .CreateIfNotExistsAsync(); // Returns existing or creates new
    }
}
```

That's it. The workflow runs, does its work, and schedules itself. Your agent is now autonomous.

## Scheduling Options

### Time-Based Schedules

```csharp
// Daily at specific time (timezone-aware)
.Daily(hour: 9, timezone: "America/New_York")

// Weekdays only
.Weekdays(hour: 8, minute: 30, timezone: "America/Chicago")

// Weekly on specific day
.Weekly(DayOfWeek.Monday, hour: 10, timezone: "Europe/London")

// Monthly
.Monthly(dayOfMonth: 1, hour: 8, timezone: "Asia/Tokyo")
```

### Interval-Based Schedules

```csharp
// Fixed intervals (no timezone - duration-based)
.EverySeconds(30)
.EveryMinutes(15)
.EveryHours(2)
.EveryDays(3)
```

### Cron Expressions

```csharp
// Every 2 hours
.WithCronSchedule("0 */2 * * *")

// Weekdays at 9 AM ET
.WithCronSchedule("0 9 * * 1-5", timezone: "America/New_York")

// First of month at midnight
.WithCronSchedule("0 0 1 * *", timezone: "America/New_York")
```

### One-Time Execution

```csharp
// Specific future date/time
var futureDate = new DateTime(2026, 12, 25, 9, 0, 0);
.WithCalendarSchedule(futureDate, timezone: "America/New_York")
```

## Overlap Policies

What happens when a schedule triggers but the previous execution is still running?

```csharp
.SkipIfRunning()      // Skip new run (recommended for most cases)
.AllowOverlap()       // Allow concurrent executions
.BufferOne()          // Queue one execution for after current
.CancelOther()        // Cancel running, start new
.TerminateOther()     // Force stop running (use with caution)
```

**Recommendation**: Use `.SkipIfRunning()` by default. It prevents execution pile-up when workflows take longer than the schedule interval.

## Creation Methods

Choose the right method for your use case:

```csharp
// 1. CreateIfNotExistsAsync() - Idempotent (recommended)
// Returns existing schedule or creates new one. Safe to call repeatedly.
var schedule = await workflow.Schedules!
    .Create("my-schedule")
    .Daily(hour: 9)
    .CreateIfNotExistsAsync();

// 2. CreateAsync() - Strict
// Fails if schedule exists. Use when you need to guarantee a new schedule.
var schedule = await workflow.Schedules!
    .Create("unique-schedule")
    .EveryHours(2)
    .CreateAsync(); // Throws ScheduleAlreadyExistsException if exists

// 3. RecreateAsync() - Replace
// Deletes existing and creates new. Use when updating schedule configuration.
var schedule = await workflow.Schedules!
    .Create("my-schedule")
    .EveryMinutes(30) // Changed from every hour!
    .RecreateAsync(); // Deletes old, creates new
```

**Rule of thumb**: Use `CreateIfNotExistsAsync()` unless you have a specific reason not to.

## Managing Schedules

Full lifecycle control from within workflows:

```csharp
var workflow = XiansContext.CurrentWorkflow;

// Get existing schedule
var schedule = await workflow.Schedules!.GetAsync("my-schedule");

// Pause/resume
await schedule.PauseAsync("System maintenance");
await schedule.UnpauseAsync("Maintenance complete");

// Trigger immediate run (doesn't affect schedule)
await schedule.TriggerAsync();

// Delete
await schedule.DeleteAsync();

// List all schedules (tenant-filtered automatically)
var allSchedules = await workflow.Schedules!.ListAsync();
```

## Multi-Tenant Isolation

Schedules automatically respect tenant boundaries - **zero configuration required**:

```csharp
[Workflow("Multi-Tenant Task")]
public class TenantTaskWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        // Schedule automatically scoped to current tenant
        await workflow.Schedules!
            .Create("daily-task")  // Internal ID: "{tenantId}:daily-task"
            .Daily(hour: 9)
            .StartAsync();
    }
}
```

**What you get:**

- Schedules prefixed with tenant ID internally
- `ListAsync()` only returns current tenant's schedules
- Search attributes automatically inherited from parent workflow
- Cross-tenant access blocked automatically
- No manual tenant filtering needed

## Common Patterns

### Self-Scheduling Workflow (Recommended)

Workflows that create their own recurring schedules:

```csharp
[Workflow("Content Crawler")]
public class ContentCrawlerWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string url, int intervalHours)
    {
        // Do the work
        var content = await CrawlContent(url);
        await ProcessContent(content);
        
        // Schedule next run (idempotent)
        await XiansContext.CurrentWorkflow.Schedules!
            .Create($"crawler-{url}")
            .EveryHours(intervalHours)
            .WithInput(url, intervalHours)
            .SkipIfRunning()
            .CreateIfNotExistsAsync();
    }
}
```

**Why this works well:**

- Workflow controls its own timing
- Automatic determinism (SDK uses activities internally)
- Tenant context always available
- Clean separation of concerns

### Bulk Schedule Creation

Set up schedules for multiple entities:

```csharp
[Workflow("Research Setup")]
public class ResearchSetupWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string[] companies)
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        foreach (var company in companies)
        {
            await workflow.Schedules!
                .Create($"research-{company.ToLower()}")
                .Weekdays(hour: 8, timezone: "America/New_York")
                .WithInput(company)
                .SkipIfRunning()
                .CreateIfNotExistsAsync();
        }
    }
}
```

## How It Works: Workflow-Aware API

The scheduling SDK is **context-aware**:

**Inside workflows**:

- SDK detects `Workflow.InWorkflow == true`
- Routes to pre-registered `ScheduleActivities` for determinism
- Search attributes automatically inherited from parent workflow
- Tenant context passed through seamlessly

**Outside workflows**:

- Direct Temporal client calls
- Explicit tenant/user context required

**Important**: `XiansContext.CurrentWorkflow` only works inside workflows/activities.

## Production Features

Every schedule can have:

```csharp
await workflow.Schedules!
    .Create("production-task")
    .Daily(hour: 9, timezone: "America/New_York")
    .WithInput(params)
    
    // Retry failed executions
    .WithRetryPolicy(new RetryPolicy
    {
        MaximumAttempts = 3,
        InitialInterval = TimeSpan.FromSeconds(10),
        BackoffCoefficient = 2.0
    })
    
    // Timeout protection
    .WithTimeout(TimeSpan.FromHours(2))
    
    // Prevent pile-up
    .SkipIfRunning()
    
    // Custom metadata for tracking
    .WithMemo(new Dictionary<string, object>
    {
        { "team", "data-engineering" },
        { "priority", "high" }
    })
    
    .CreateIfNotExistsAsync();
```

## Best Practices

**Do:**

- Use `CreateIfNotExistsAsync()` for most cases (idempotent)
- Use `.SkipIfRunning()` to prevent execution pile-up
- Add retry policies for production schedules
- Specify timezones for time-based schedules
- Use descriptive IDs: `daily-sync-{company}` not `schedule1`

**Don't:**

- Use `CreateAsync()` unless you need strict failure on duplicates
- Forget to handle timezone differences
- Create schedules without overlap policies
- Use generic schedule IDs

## Quick Reference

```csharp
// Common schedule patterns
.Daily(hour: 9, timezone: "America/New_York")
.Weekdays(hour: 8, minute: 30, timezone: "America/Chicago")
.EveryMinutes(30)
.EveryHours(2)
.Monthly(dayOfMonth: 1, hour: 9, timezone: "America/New_York")
.WithCronSchedule("0 */2 * * *")  // Every 2 hours
```

## What's Next?

- **[Agents](agents.md)** - Agent architecture and patterns
- **[Workflows](workflows.md)** - Workflow patterns and lifecycle

---

**Bottom line**: Schedules turn reactive workflows into autonomous agents. They're the difference between "run this when I tell you" and "run this every day at 9 AM until I tell you to stop."
