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
        var schedule = await XiansContext.CurrentAgent.Schedules
            .Create<DailyReportWorkflow>("daily-report")
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

// Hourly at specific minute
.Hourly(minute: 30)

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
.EveryDays(3)  // Note: Multi-day intervals (>1) ignore hour/minute parameters

// Multi-day intervals with specific time (only works for 1 day)
.EveryDays(1, hour: 9, minute: 30, timezone: "America/New_York") // Same as .Daily()
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
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<MyWorkflow>("my-schedule")
    .Daily(hour: 9)
    .CreateIfNotExistsAsync();

// 2. CreateAsync() - Strict
// Fails if schedule exists. Use when you need to guarantee a new schedule.
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<MyWorkflow>("unique-schedule")
    .EveryHours(2)
    .CreateAsync(); // Throws ScheduleAlreadyExistsException if exists

// 3. RecreateAsync() - Replace
// Deletes existing and creates new. Use when updating schedule configuration.
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<MyWorkflow>("my-schedule")
    .EveryMinutes(30) // Changed from every hour!
    .RecreateAsync(); // Deletes old, creates new
```

**Rule of thumb**: Use `CreateIfNotExistsAsync()` unless you have a specific reason not to.

## Managing Schedules

Full lifecycle control from within workflows:

```csharp
var agent = XiansContext.CurrentAgent;

// Get existing schedule
var schedule = await agent.Schedules.GetAsync("my-schedule");

// Check if schedule exists
bool exists = await agent.Schedules.ExistsAsync("my-schedule");

// Pause/resume schedules
await schedule.PauseAsync("System maintenance");
await schedule.UnpauseAsync("Maintenance complete");

// Or pause/unpause by ID directly
await agent.Schedules.PauseAsync("my-schedule", note: "System maintenance");
await agent.Schedules.UnpauseAsync("my-schedule", note: "Maintenance complete");

// Trigger immediate run (doesn't affect schedule)
await schedule.TriggerAsync();
await agent.Schedules.TriggerAsync("my-schedule"); // Or by ID

// Get schedule information
var description = await schedule.DescribeAsync(); // Contains next run times, recent actions, etc.

// Delete schedule
await schedule.DeleteAsync();
await agent.Schedules.DeleteAsync("my-schedule"); // Or by ID

// Update schedule configuration
await schedule.UpdateAsync(update => new ScheduleUpdate(
    update.Description.Schedule,
    TypedSearchAttributes: newSearchAttributes));

// Backfill schedule (run actions for past time periods)
await schedule.BackfillAsync(new[]
{
    new ScheduleBackfill(
        startAt: DateTime.UtcNow.AddDays(-7), 
        endAt: DateTime.UtcNow.AddDays(-1))
});

// Get underlying Temporal handle for advanced scenarios
var temporalHandle = schedule.GetHandle();
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
        // Schedule automatically scoped to current tenant
        await XiansContext.CurrentAgent.Schedules
            .Create<TenantTaskWorkflow>("daily-task")  // Internal ID: "{tenantId}:{agentName}:{idPostfix}:daily-task"
            .Daily(hour: 9)
            .CreateIfNotExistsAsync();
    }
}
```

**What you get:**

- Schedules prefixed with tenant ID and agent context internally
- Search attributes automatically inherited from parent workflow
- Cross-tenant access blocked automatically
- No manual tenant filtering needed
- Schedule IDs follow pattern: `{tenantId}:{agentName}:{idPostfix}:{scheduleId}`

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
        await XiansContext.CurrentAgent.Schedules
            .Create<ContentCrawlerWorkflow>($"crawler-{url}")
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
        foreach (var company in companies)
        {
            await XiansContext.CurrentAgent.Schedules
                .Create<ResearchWorkflow>($"research-{company.ToLower()}")
                .Weekdays(hour: 8, timezone: "America/New_York")
                .WithInput(company)
                .SkipIfRunning()
                .CreateIfNotExistsAsync();
        }
    }
}
```

## Advanced Configuration

### Starting Schedules Paused

Sometimes you want to create a schedule but not start it immediately:

```csharp
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<MaintenanceWorkflow>("maintenance-task")
    .Daily(hour: 2, timezone: "America/New_York")
    .WithInput("system-cleanup")
    .StartPaused(true, "Created for future use")
    .CreateIfNotExistsAsync();

// Later, unpause when ready
await schedule.UnpauseAsync("Ready to start maintenance");
```

### Custom idPostfix

The `idPostfix` parameter provides additional uniqueness to schedule IDs within the same tenant/agent context:

```csharp
// Use custom idPostfix - requires non-generic overload
var workflowType = XiansContext.GetWorkflowTypeFor(typeof(SyncWorkflow));
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create("daily-sync", workflowType, idPostfix: "user123")  // Results in: {tenantId}:{agent}:user123:daily-sync
    .Daily(hour: 9)
    .CreateIfNotExistsAsync();

// Retrieve with same idPostfix
var retrieved = await XiansContext.CurrentAgent.Schedules.GetAsync("daily-sync", idPostfix: "user123");
```

**Note**: If not specified, `idPostfix` defaults to the current workflow context's idPostfix. The generic `Create<TWorkflow>()` method uses the default idPostfix; use the non-generic overload for custom idPostfix values.

### Calendar-Based Scheduling

For one-time or specific date scheduling:

```csharp
// Schedule for a specific future date/time
var futureDate = new DateTime(2026, 12, 25, 9, 0, 0);
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<HolidayReportWorkflow>("holiday-report")
    .WithCalendarSchedule(futureDate, timezone: "America/New_York")
    .WithInput("holiday-summary")
    .CreateIfNotExistsAsync();
```

### Low-Level Temporal Integration

For advanced scenarios, you can access the underlying Temporal schedule handle:

```csharp
var schedule = await XiansContext.CurrentAgent.Schedules.GetAsync("my-schedule");
var temporalHandle = schedule.GetHandle();

// Use native Temporal APIs
var temporalDescription = await temporalHandle.DescribeAsync();
```

## Error Handling

The SDK provides specific exceptions for different error scenarios:

```csharp
try
{
    var schedule = await XiansContext.CurrentAgent.Schedules
        .Create<MyWorkflow>("my-schedule")
        .Daily(hour: 9)
        .CreateAsync(); // Strict creation
}
catch (ScheduleAlreadyExistsException ex)
{
    // Handle case where schedule already exists
    var existing = await XiansContext.CurrentAgent.Schedules.GetAsync("my-schedule");
    // ... use existing schedule
}
catch (ScheduleNotFoundException ex)
{
    // Handle case where schedule wasn't found during GetAsync()
    Console.WriteLine($"Schedule '{ex.ScheduleId}' not found");
}
catch (InvalidScheduleSpecException ex)
{
    // Handle invalid schedule configuration
    Console.WriteLine($"Invalid schedule configuration: {ex.Message}");
}
```

## Best Practices

**Do:**

- Use `CreateIfNotExistsAsync()` for most cases (idempotent)
- Use `.SkipIfRunning()` to prevent execution pile-up
- Add retry policies for production schedules
- Specify timezones for time-based schedules
- Use descriptive IDs: `daily-sync-{company}` not `schedule1`
- Handle schedule-specific exceptions appropriately

**Don't:**

- Use `CreateAsync()` unless you need strict failure on duplicates
- Forget to handle timezone differences
- Create schedules without overlap policies
- Use generic schedule IDs
- Ignore specific exception types - they provide valuable context

## Quick Reference

### Schedule Patterns
```csharp
// Time-based patterns
.Daily(hour: 9, timezone: "America/New_York")
.Hourly(minute: 30)
.Weekdays(hour: 8, minute: 30, timezone: "America/Chicago")
.Weekly(DayOfWeek.Monday, hour: 10, timezone: "Europe/London")
.Monthly(dayOfMonth: 1, hour: 9, timezone: "America/New_York")

// Interval-based patterns
.EverySeconds(30)
.EveryMinutes(15)
.EveryHours(2)
.EveryDays(3)

// Advanced patterns
.WithCronSchedule("0 */2 * * *", timezone: "UTC")  // Every 2 hours
.WithCalendarSchedule(futureDateTime, timezone: "America/New_York")
```

### Creation Methods
```csharp
.CreateIfNotExistsAsync()  // Idempotent (recommended)
.CreateAsync()             // Strict (fails if exists)
.RecreateAsync()          // Replace existing
```

### Overlap Policies
```csharp
.SkipIfRunning()    // Skip if previous still running (recommended)
.AllowOverlap()     // Allow concurrent executions
.BufferOne()        // Queue one execution
.CancelOther()      // Cancel running, start new
.TerminateOther()   // Force stop running (use with caution)
```

### Management Operations
```csharp
// Direct schedule operations
await schedule.PauseAsync("reason");
await schedule.UnpauseAsync("reason");
await schedule.TriggerAsync();
await schedule.DeleteAsync();
await schedule.DescribeAsync();

// Operations by ID
await schedules.GetAsync("schedule-id");
await schedules.ExistsAsync("schedule-id");
await schedules.PauseAsync("schedule-id");
await schedules.UnpauseAsync("schedule-id");
await schedules.TriggerAsync("schedule-id");
await schedules.DeleteAsync("schedule-id");
```

## What's Next?

- **[Agents](agents.md)** - Agent architecture and patterns
- **[Workflows](workflows.md)** - Workflow patterns and lifecycle

---

**Bottom line**: Schedules turn reactive workflows into autonomous agents. They're the difference between "run this when I tell you" and "run this every day at 9 AM until I tell you to stop."
