# Scheduling Deep Dive

This guide provides comprehensive coverage of Xians scheduling capabilities, including advanced patterns, production configurations, error handling, and real-world examples.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Complete Scheduling Patterns](#complete-scheduling-patterns)
- [Production Configuration](#production-configuration)
- [Lifecycle Management](#lifecycle-management)
- [Error Handling](#error-handling)
- [Workflow-Aware Execution](#workflow-aware-execution)
- [Multi-Tenant Security](#multi-tenant-security)
- [Real-World Examples](#real-world-examples)
- [API Reference](#api-reference)

## Architecture Overview

### How Xians Scheduling Works

Xians scheduling is built on **Temporal's Schedule feature**, which provides:

1. **Durable Storage** - Schedules are persisted in Temporal's database
2. **Distributed Execution** - No single point of failure; runs across cluster
3. **Event-Driven** - Triggers workflow executions based on time rules
4. **Audit Trail** - Complete history of schedule changes and executions

### Xians Enhancements

Xians adds several layers on top of Temporal:

```
┌─────────────────────────────────────────┐
│  Fluent API (ScheduleBuilder)           │  ← Developer-friendly interface
├─────────────────────────────────────────┤
│  Multi-Tenant Isolation                 │  ← Automatic tenant scoping
├─────────────────────────────────────────┤
│  Workflow-Aware Context Detection       │  ← Auto-determinism
├─────────────────────────────────────────┤
│  Schedule Activities (System)           │  ← Pre-registered activities
├─────────────────────────────────────────┤
│  Temporal Schedule API                  │  ← Core scheduling engine
└─────────────────────────────────────────┘
```

### Key Components

**ScheduleCollection** (`workflow.Schedules!`)
- Factory for creating and managing schedules
- Tenant-aware querying and filtering
- Lifecycle operations (create, get, list, delete)

**ScheduleBuilder**
- Fluent API for schedule configuration
- Type-safe scheduling options
- Terminal `.StartAsync()` method

**XiansSchedule**
- Handle to individual schedule instance
- Operations: pause, resume, trigger, update, delete
- Information retrieval via `DescribeAsync()`

**ScheduleActivities**
- System-registered activities for workflow context
- Automatic usage when `Workflow.InWorkflow == true`
- Maintains determinism in workflow executions

## Complete Scheduling Patterns

### Time-Based Schedules with Timezones

All time-based schedules support IANA timezone configuration:

```csharp
using Xians.Lib.Agents;
using Xians.Lib.Agents.Scheduling;
using Temporalio.Workflows;

[Workflow("Schedule Setup Workflow")]
public class ScheduleSetupWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        // Get current workflow context
        var workflow = XiansContext.CurrentWorkflow;

        // Daily at specific time
        await workflow.Schedules!
            .Create("daily-morning-report")
            .Daily(hour: 9, minute: 30, timezone: "America/New_York")
            .WithInput("report-type", "daily")
            .StartAsync();

        // Weekly on specific day
        await workflow.Schedules!
            .Create("weekly-monday-sync")
            .Weekly(DayOfWeek.Monday, hour: 10, timezone: "Europe/London")
            .WithInput("sync-config")
            .StartAsync();

        // Monthly on specific day
        await workflow.Schedules!
            .Create("monthly-first-billing")
            .Monthly(dayOfMonth: 1, hour: 8, timezone: "Asia/Tokyo")
            .WithInput("billing-params")
            .StartAsync();

        // Weekdays only (Monday-Friday)
        await workflow.Schedules!
            .Create("weekday-check")
            .Weekdays(hour: 8, minute: 30, timezone: "America/Chicago")
            .WithInput("health-check")
            .StartAsync();

        // Every hour at specific minute
        await workflow.Schedules!
            .Create("hourly-quarter-past")
            .Hourly(minute: 15)
            .WithInput("monitoring-data")
            .StartAsync();
            
        Workflow.Logger.LogInformation("All schedules created successfully");
    }
}
```

**Timezone Behavior:**
- **Default**: UTC if timezone not specified
- **DST Handling**: Temporal automatically adjusts for daylight saving time
- **IANA Names**: Use standard names like `"America/New_York"`, not abbreviations like `"EST"`

### Interval-Based Schedules

Duration-based schedules that don't use timezones:

```csharp
[Workflow("Interval Schedule Setup")]
public class IntervalScheduleWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        // Simple intervals
        await workflow.Schedules!
            .Create("every-30-seconds")
            .EverySeconds(30)
            .WithInput("fast-polling")
            .StartAsync();

        await workflow.Schedules!
            .Create("every-30-minutes")
            .EveryMinutes(30)
            .WithInput("medium-polling")
            .StartAsync();

        await workflow.Schedules!
            .Create("every-2-hours")
            .EveryHours(2)
            .WithInput("slow-polling")
            .StartAsync();

        // Custom interval with offset
        await workflow.Schedules!
            .Create("custom-interval")
            .WithIntervalSchedule(
                interval: TimeSpan.FromMinutes(5),
                offset: TimeSpan.FromSeconds(30)  // Start 30 seconds into each 5-minute window
            )
            .WithInput("offset-task")
            .StartAsync();

        // Every N days (uses Daily internally if days=1)
        await workflow.Schedules!
            .Create("every-3-days")
            .EveryDays(3, hour: 9, minute: 0, timezone: "America/New_York")
            .WithInput("tri-daily-task")
            .StartAsync();
            
        Workflow.Logger.LogInformation("Interval schedules created");
    }
}
```

### Cron Expression Schedules

Advanced scheduling patterns using 5-field cron expressions:

```csharp
[Workflow("Cron Schedule Setup")]
public class CronScheduleWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        // Every day at 9 AM UTC
        await workflow.Schedules!
            .Create("cron-daily")
            .WithCronSchedule("0 9 * * *")
            .WithInput("daily-cron")
            .StartAsync();

        // Weekdays at 9 AM with timezone
        await workflow.Schedules!
            .Create("cron-weekdays")
            .WithCronSchedule("0 9 * * 1-5", timezone: "America/New_York")
            .WithInput("weekday-cron")
            .StartAsync();

        // First of month at midnight
        await workflow.Schedules!
            .Create("cron-monthly")
            .WithCronSchedule("0 0 1 * *", timezone: "America/New_York")
            .WithInput("monthly-cron")
            .StartAsync();

        // Every 30 minutes
        await workflow.Schedules!
            .Create("cron-30min")
            .WithCronSchedule("*/30 * * * *")
            .WithInput("half-hourly")
            .StartAsync();

        // Every 2 hours
        await workflow.Schedules!
            .Create("cron-2hours")
            .WithCronSchedule("0 */2 * * *")
            .WithInput("bi-hourly")
            .StartAsync();

        // Complex pattern: Every 15 minutes during business hours (9 AM - 5 PM) on weekdays
        await workflow.Schedules!
            .Create("cron-business-hours")
            .WithCronSchedule("*/15 9-17 * * 1-5", timezone: "America/New_York")
            .WithInput("business-hours-monitoring")
            .StartAsync();
            
        Workflow.Logger.LogInformation("Cron schedules created");
    }
}
```

**Cron Format** (5 fields):
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

### Calendar-Based (One-Time) Schedules

Execute at a specific date and time:

```csharp
[Workflow("Calendar Schedule Setup")]
public class CalendarScheduleWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        // Specific future date and time
        var scheduledTime = new DateTime(2026, 12, 25, 9, 0, 0);

        await workflow.Schedules!
            .Create("christmas-morning")
            .WithCalendarSchedule(scheduledTime, timezone: "America/New_York")
            .WithInput("holiday-greeting")
            .StartAsync();

        // Relative to current time
        var futureTime = DateTime.UtcNow.AddHours(24);

        await workflow.Schedules!
            .Create("delayed-start")
            .WithCalendarSchedule(futureTime)
            .WithInput("delayed-task")
            .StartAsync();
            
        Workflow.Logger.LogInformation("Calendar schedules created");
    }
}
```

## Production Configuration

### Complete Production-Ready Schedule

This example shows all recommended production features:

```csharp
using Temporalio.Common;
using Temporalio.Workflows;
using Xians.Lib.Agents.Scheduling.Models;

[Workflow("Production Schedule Setup")]
public class ProductionScheduleWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        var schedule = await workflow.Schedules!
            .Create("production-daily-report")
            
            // Schedule timing
            .Daily(hour: 9, timezone: "America/New_York")
            
            // Workflow input
            .WithInput("report-config", "additional-params")
            
            // Retry policy - handle transient failures
            .WithRetryPolicy(new RetryPolicy
            {
                MaximumAttempts = 5,
                InitialInterval = TimeSpan.FromSeconds(10),
                BackoffCoefficient = 2.0,  // Exponential backoff: 10s, 20s, 40s, 80s, 160s
                MaximumInterval = TimeSpan.FromMinutes(10)
            })
            
            // Timeout - prevent runaway workflows
            .WithTimeout(TimeSpan.FromHours(2))
            
            // Overlap policy - prevent execution pile-up
            .SkipIfRunning()
            
            // Metadata - tracking and debugging
            .WithMemo(new Dictionary<string, object>
            {
                { "environment", "production" },
                { "owner", "data-team" },
                { "priority", "high" },
                { "version", "2.1.0" },
                { "created_by", workflow.GetType().Name }
            })
            
            // Start the schedule
            .StartAsync();

        Workflow.Logger.LogInformation("Production schedule created: {ScheduleId}", schedule.Id);
    }
}
```

### Overlap Policies Explained

Control behavior when new execution is triggered while previous is still running:

```csharp
// RECOMMENDED: Skip if already running
// Use case: Most scenarios - prevents pile-up
.SkipIfRunning()

// Allow concurrent executions
// Use case: Independent, fast executions
.AllowOverlap()

// Queue one execution for after current completes
// Use case: Must process at least once more after current
.BufferOne()

// Cancel currently running execution, start new one
// Use case: Newer data supersedes current processing
.CancelOther()

// Terminate currently running execution (immediate stop)
// Use case: Rare - forces stop without cleanup
.TerminateOther()

// Or use the policy method directly
.WithOverlapPolicy(ScheduleOverlapPolicy.Skip)
```

**Decision Matrix:**

| Scenario | Recommended Policy |
|----------|-------------------|
| Daily reports that take hours | `SkipIfRunning()` |
| Fast, independent health checks | `AllowOverlap()` |
| Data sync that must catch up | `BufferOne()` |
| Real-time data where latest matters | `CancelOther()` |
| Emergency shutdown required | `TerminateOther()` (use with caution) |

### Retry Policies

Configure automatic retry behavior for failed executions:

```csharp
.WithRetryPolicy(new RetryPolicy
{
    // Maximum number of retry attempts
    MaximumAttempts = 5,
    
    // Initial delay before first retry
    InitialInterval = TimeSpan.FromSeconds(10),
    
    // Multiplier for exponential backoff
    BackoffCoefficient = 2.0,
    
    // Cap for maximum delay between retries
    MaximumInterval = TimeSpan.FromMinutes(10),
    
    // Optional: Retry only specific exception types
    // NonRetryableErrorTypes = new[] { "BusinessLogicException" }
})
```

**Example Retry Sequence:**
- Attempt 1 fails → wait 10s
- Attempt 2 fails → wait 20s (10s × 2.0)
- Attempt 3 fails → wait 40s (20s × 2.0)
- Attempt 4 fails → wait 80s (40s × 2.0)
- Attempt 5 fails → wait 160s, but capped at 600s (10 minutes)

### Workflow Timeouts

Set execution time limits:

```csharp
// Absolute timeout for workflow execution
.WithTimeout(TimeSpan.FromHours(2))

// Workflow will be terminated if it exceeds 2 hours
```

### Custom Metadata

Add tracking information to scheduled workflows:

```csharp
.WithMemo(new Dictionary<string, object>
{
    { "environment", "production" },
    { "team", "data-engineering" },
    { "cost_center", "engineering-ops" },
    { "sla", "99.9%" },
    { "on_call", "team-alpha" },
    { "documentation", "https://docs.example.com/workflows/daily-sync" }
})
```

Metadata is attached to each workflow execution and visible in Temporal UI.

### Start Paused

Create schedule in paused state for later activation:

```csharp
[Workflow("Approval-Based Schedule Setup")]
public class ApprovalScheduleWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(bool approved)
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        // Create paused schedule
        await workflow.Schedules!
            .Create("pending-approval-schedule")
            .Daily(hour: 9, timezone: "America/New_York")
            .WithInput("data")
            .StartPaused(paused: true, note: "Awaiting stakeholder approval")
            .StartAsync();

        if (approved)
        {
            // Activate immediately if already approved
            var schedule = await workflow.Schedules!.GetAsync("pending-approval-schedule");
            await schedule.UnpauseAsync("Approved by stakeholder on 2026-01-15");
            
            Workflow.Logger.LogInformation("Schedule approved and activated");
        }
        else
        {
            Workflow.Logger.LogInformation("Schedule created in paused state, awaiting approval");
        }
    }
}
```

## Lifecycle Management

### Retrieve and Inspect Schedules

```csharp
var workflow = XiansContext.CurrentWorkflow;

// Get specific schedule
var schedule = await workflow.Schedules!.GetAsync("my-schedule");

// Get detailed information
var description = await schedule.DescribeAsync();

// Access schedule information
var nextRun = description.Info.NextActionTimes.FirstOrDefault();
var recentRuns = description.Info.RecentActions;
var isPaused = description.Schedule.State.Paused;
var pauseNote = description.Schedule.State.Note;

Console.WriteLine($"Schedule ID: {schedule.Id}");
Console.WriteLine($"Next execution: {nextRun}");
Console.WriteLine($"Status: {(isPaused ? "Paused" : "Active")}");
if (!string.IsNullOrEmpty(pauseNote))
{
    Console.WriteLine($"Note: {pauseNote}");
}

// Recent execution history
Console.WriteLine("Recent executions:");
foreach (var action in recentRuns.Take(5))
{
    Console.WriteLine($"  - {action.ActualTime}: {action.TakenAt}");
}
```

### Pause and Resume

```csharp
var workflow = XiansContext.CurrentWorkflow;
var schedule = await workflow.Schedules!.GetAsync("my-schedule");

// Pause with descriptive note
await schedule.PauseAsync("System maintenance - database migration in progress");

// ... perform maintenance ...

// Resume with completion note
await schedule.UnpauseAsync("Maintenance completed successfully at 2026-01-15 10:30 UTC");

// Or use collection methods
await workflow.Schedules!.PauseAsync("my-schedule", "Temporary pause for testing");
await workflow.Schedules!.UnpauseAsync("my-schedule", "Testing complete");
```

### Trigger Immediate Execution

Execute schedule immediately without affecting its regular timing:

```csharp
var workflow = XiansContext.CurrentWorkflow;
var schedule = await workflow.Schedules!.GetAsync("daily-report");

// Trigger now (doesn't change next scheduled execution)
await schedule.TriggerAsync();

Console.WriteLine("Manual execution triggered");

// Or via collection
await workflow.Schedules!.TriggerAsync("daily-report");
```

**Use Cases:**
- Manual report generation
- Testing schedule configuration
- Catch-up after fixing a bug
- User-requested immediate execution

### Update Schedule Configuration

Modify existing schedule settings:

```csharp
var schedule = await workflow.Schedules!.GetAsync("my-schedule");

await schedule.UpdateAsync(input => 
{
    var updatedSchedule = input.Description.Schedule;
    
    // Change schedule time (e.g., from 9 AM to 10 AM)
    updatedSchedule = new Schedule(
        Action: updatedSchedule.Action,
        Spec: new ScheduleSpec
        {
            CronExpressions = new List<string> 
            { 
                "0 10 * * *"  // 10 AM instead of 9 AM
            },
            TimeZoneName = "America/New_York"
        })
    {
        Policy = updatedSchedule.Policy,
        State = updatedSchedule.State
    };
    
    return new ScheduleUpdate(updatedSchedule);
});

Console.WriteLine("Schedule updated to 10 AM");
```

### Delete Schedules

```csharp
var workflow = XiansContext.CurrentWorkflow;

// Delete via schedule instance
var schedule = await workflow.Schedules!.GetAsync("my-schedule");
await schedule.DeleteAsync();

// Or via collection
await workflow.Schedules!.DeleteAsync("my-schedule");

// Check existence first (idempotent deletion)
if (await workflow.Schedules!.ExistsAsync("my-schedule"))
{
    await workflow.Schedules!.DeleteAsync("my-schedule");
    Console.WriteLine("Schedule deleted");
}
else
{
    Console.WriteLine("Schedule doesn't exist");
}
```

### List All Schedules

```csharp
var workflow = XiansContext.CurrentWorkflow;

// List all schedules for this workflow (automatically filtered by tenant)
var schedules = await workflow.Schedules!.ListAsync();

Console.WriteLine("All schedules:");
await foreach (var scheduleInfo in schedules)
{
    Console.WriteLine($"\nSchedule ID: {scheduleInfo.Id}");
    
    // Get full details
    var schedule = await workflow.Schedules!.GetAsync(scheduleInfo.Id);
    var description = await schedule.DescribeAsync();
    
    var nextRun = description.Info.NextActionTimes.FirstOrDefault();
    var isPaused = description.Schedule.State.Paused;
    var memo = description.Memo;
    
    Console.WriteLine($"  Next run: {nextRun}");
    Console.WriteLine($"  Status: {(isPaused ? "Paused" : "Active")}");
    
    if (memo?.Fields != null && memo.Fields.ContainsKey("environment"))
    {
        Console.WriteLine($"  Environment: {memo.Fields["environment"]}");
    }
}
```

### Backfill Missed Executions

Execute schedule for past time ranges (useful after system downtime):

```csharp
var schedule = await workflow.Schedules!.GetAsync("my-schedule");

// Run schedule for last week (e.g., after outage)
var backfills = new List<ScheduleBackfill>
{
    new(
        StartAt: DateTime.UtcNow.AddDays(-7),
        EndAt: DateTime.UtcNow,
        Overlap: ScheduleOverlapPolicy.AllowAll  // Allow all backfill executions
    )
};

await schedule.BackfillAsync(backfills);
Console.WriteLine("Backfill started for past 7 days");
```

## Error Handling

### Exception Types

```csharp
using Xians.Lib.Agents.Scheduling.Models;

var workflow = XiansContext.CurrentWorkflow;

try
{
    var schedule = await workflow.Schedules!
        .Create("my-schedule")
        .Daily(hour: 9)
        .WithInput("data")
        .StartAsync();
    
    Console.WriteLine($"Schedule created: {schedule.Id}");
}
catch (ScheduleAlreadyExistsException ex)
{
    // Schedule with this ID already exists
    Console.WriteLine($"Warning: Schedule '{ex.ScheduleId}' already exists");
    
    // Option 1: Get existing schedule
    var existing = await workflow.Schedules!.GetAsync(ex.ScheduleId);
    Console.WriteLine("Using existing schedule");
    
    // Option 2: Delete and recreate
    // await workflow.Schedules!.DeleteAsync(ex.ScheduleId);
    // var newSchedule = await workflow.Schedules!.Create(ex.ScheduleId)...StartAsync();
}
catch (InvalidScheduleSpecException ex)
{
    // Invalid schedule configuration
    Console.WriteLine($"Error: Invalid schedule specification: {ex.Message}");
    // Examples: Missing spec, invalid cron, invalid parameters
}
catch (ScheduleNotFoundException ex)
{
    // Trying to access non-existent schedule
    Console.WriteLine($"Error: Schedule '{ex.ScheduleId}' not found");
}
```

### Idempotent Schedule Creation

Safe creation that handles existing schedules:

```csharp
var workflow = XiansContext.CurrentWorkflow;
var scheduleId = "my-recurring-task";

// Pattern 1: Check existence first
if (!await workflow.Schedules!.ExistsAsync(scheduleId))
{
    await workflow.Schedules!
        .Create(scheduleId)
        .Daily(hour: 9, timezone: "America/New_York")
        .WithInput("data")
        .StartAsync();
    
    Console.WriteLine("Schedule created");
}
else
{
    Console.WriteLine("Schedule already exists");
}

// Pattern 2: Try-catch approach
try
{
    await workflow.Schedules!
        .Create(scheduleId)
        .Daily(hour: 9)
        .StartAsync();
}
catch (ScheduleAlreadyExistsException)
{
    // Already exists - safe to continue
    Console.WriteLine("Schedule already exists");
}
```

### Graceful Degradation

```csharp
async Task<XiansSchedule?> CreateScheduleSafely(string scheduleId)
{
    try
    {
        return await workflow.Schedules!
            .Create(scheduleId)
            .Daily(hour: 9)
            .WithInput("data")
            .WithRetryPolicy(new RetryPolicy
            {
                MaximumAttempts = 3,
                InitialInterval = TimeSpan.FromSeconds(10)
            })
            .StartAsync();
    }
    catch (ScheduleAlreadyExistsException)
    {
        _logger.LogInformation("Schedule {ScheduleId} already exists", scheduleId);
        return await workflow.Schedules!.GetAsync(scheduleId);
    }
    catch (InvalidScheduleSpecException ex)
    {
        _logger.LogError(ex, "Invalid schedule specification for {ScheduleId}", scheduleId);
        return null;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Unexpected error creating schedule {ScheduleId}", scheduleId);
        return null;
    }
}
```

## Workflow-Aware Execution

** Recommended Pattern**: Create schedules from within workflows for automatic determinism and tenant context.

### Inside Workflow Context (Recommended)

Workflows create and manage schedules with automatic activity usage for determinism:

```csharp
using Temporalio.Workflows;
using Xians.Lib.Agents;
using Xians.Lib.Agents.Scheduling;

[Workflow("Self-Scheduling Workflow")]
public class SelfSchedulingWorkflow
{
    private readonly ILogger _logger = Workflow.CreateLogger<SelfSchedulingWorkflow>();

    [WorkflowRun]
    public async Task RunAsync(string taskName, int intervalHours)
    {
        _logger.LogInformation("Creating recurring schedule for {TaskName}", taskName);
        
        // Get current workflow context
        var workflow = XiansContext.CurrentWorkflow;
        
        // SDK detects Workflow.InWorkflow == true
        // Automatically uses ScheduleActivities for determinism!
        var schedule = await workflow.Schedules!
            .Create($"recurring-{taskName}")
            .EveryHours(intervalHours)
            .WithInput(taskName, intervalHours)
            .SkipIfRunning()
            .StartAsync();
        
        _logger.LogInformation("Schedule created: {ScheduleId}", schedule.Id);
    }
}
```

**How It Works:**

1. SDK checks `Workflow.InWorkflow` property
2. **If true**: Automatically delegates to pre-registered `ScheduleActivities`
3. Maintains workflow determinism
4. **No manual activity registration needed!**

**Benefits:**
-  Automatic determinism through activities
-  Tenant context automatically available
-  Clean workflow-centric design
-  No external setup required

### System Activities Auto-Registered

System activities are **automatically registered** - no configuration needed:

```csharp
// You DON'T need to do this - activities auto-registered!
// worker.AddActivity<ScheduleActivities>();

// Just use the schedule API from within your workflow
[WorkflowRun]
public async Task RunAsync()
{
    var workflow = XiansContext.CurrentWorkflow;
    
    var schedule = await workflow.Schedules!
        .Create("auto-schedule")
        .Daily(hour: 9)
        .StartAsync();
}
```

**Important**: `XiansContext.CurrentWorkflow` can **only** be used inside workflows or activities. It will throw `InvalidOperationException` if used outside workflow context.

## Multi-Tenant Security

### Automatic Tenant Isolation

Schedules are automatically scoped to the current tenant when created from workflows:

```csharp
[Workflow("Multi-Tenant Report Workflow")]
public class MultiTenantReportWorkflow
{
    [WorkflowRun]
    public async Task RunAsync()
    {
        // Get current workflow context - automatically includes tenant context
        var workflow = XiansContext.CurrentWorkflow;
        
        // When this workflow runs for tenant "acme-corp"
        await workflow.Schedules!
            .Create("daily-report")  // Internal ID: "acme-corp:daily-report"
            .Daily(hour: 9)
            .StartAsync();
        
        Workflow.Logger.LogInformation("Schedule created for tenant: {TenantId}", 
            XiansContext.TenantId);
    }
}

// When the same workflow runs for tenant "techco"
// It creates: "techco:daily-report" (completely separate schedule)

// Both schedules exist independently - complete isolation!
```

### Tenant-Scoped Queries

All schedule operations respect tenant boundaries:

```csharp
// In workflow context for tenant "acme-corp"
var workflow = XiansContext.CurrentWorkflow;

// List only returns schedules for "acme-corp"
var schedules = await workflow.Schedules!.ListAsync();

// Get only works for "acme-corp" schedules
var schedule = await workflow.Schedules!.GetAsync("daily-report");
// This gets "acme-corp:daily-report", NOT "techco:daily-report"

// Delete only affects "acme-corp" schedules
await workflow.Schedules!.DeleteAsync("daily-report");
// This deletes "acme-corp:daily-report", NOT "techco:daily-report"
```

### Security Guarantees

**Complete Isolation**
- Tenants cannot access each other's schedules
- Schedule IDs automatically prefixed with tenant ID
- All operations filtered by current tenant context

**No Cross-Tenant Leakage**
- List operations only return current tenant's schedules
- Get operations fail for other tenants' schedules
- Delete operations cannot affect other tenants

**Automatic Enforcement**
- No manual tenant filtering required
- SDK enforces security transparently
- Works in both workflow and non-workflow contexts

## Real-World Examples

### Example 1: Daily Report Generation

Complete production setup for daily morning reports:

```csharp
using Temporalio.Workflows;
using Temporalio.Common;
using Xians.Lib.Agents;
using Xians.Lib.Agents.Scheduling;
using Xians.Lib.Agents.Scheduling.Models;

// Define the report workflow
[Workflow("Daily Report Workflow")]
public class DailyReportWorkflow
{
    private readonly ILogger _logger = Workflow.CreateLogger<DailyReportWorkflow>();

    [WorkflowRun]
    public async Task RunAsync(string reportType, string recipients)
    {
        _logger.LogInformation("Generating {ReportType} report for {Recipients}", 
            reportType, recipients);
        
        // Report generation logic...
        await GenerateReport(reportType);
        await EmailReport(recipients);
        
        _logger.LogInformation("Report generated and sent");
    }

    private async Task GenerateReport(string reportType)
    {
        // Implementation...
        await Task.CompletedTask;
    }

    private async Task EmailReport(string recipients)
    {
        // Implementation...
        await Task.CompletedTask;
    }
}

// Setup schedule (in Program.cs or agent initialization)
var agent = xiansPlatform.Agents.Register(new XiansAgentRegistration
{
    Name = "ReportingAgent",
    SystemScoped = true
});

var workflow = await agent.Workflows.DefineCustom<DailyReportWorkflow>(workers: 1);

var schedule = await workflow.Schedules!
    .Create("daily-morning-report")
    .Daily(hour: 9, timezone: "America/New_York")
    .WithInput("sales-summary", "team@company.com")
    .WithRetryPolicy(new RetryPolicy
    {
        MaximumAttempts = 3,
        InitialInterval = TimeSpan.FromSeconds(30),
        BackoffCoefficient = 2.0
    })
    .WithTimeout(TimeSpan.FromHours(1))
    .SkipIfRunning()
    .WithMemo(new Dictionary<string, object>
    {
        { "team", "sales" },
        { "report_type", "daily_sales_summary" },
        { "priority", "high" }
    })
    .StartAsync();

Console.WriteLine($"Daily report schedule created: {schedule.Id}");
```

### Example 2: Self-Scheduling Content Discovery

Workflow that creates its own recurring schedule:

```csharp
using Temporalio.Workflows;
using Xians.Lib.Agents;
using Xians.Lib.Agents.Scheduling;
using Xians.Lib.Agents.Scheduling.Models;

[Workflow("Content Discovery Workflow")]
public class ContentDiscoveryWorkflow
{
    private readonly ILogger _logger = Workflow.CreateLogger<ContentDiscoveryWorkflow>();

    [WorkflowRun]
    public async Task RunAsync(string contentUrl, int checkIntervalHours)
    {
        _logger.LogInformation("Discovering content from {Url}", contentUrl);

        // Process content
        var newContent = await DiscoverContent(contentUrl);
        
        if (newContent != null)
        {
            await ProcessNewContent(newContent);
        }

        // Create recurring schedule for future checks
        // SDK automatically uses ScheduleActivities for determinism!
        try
        {
            var scheduleId = $"content-discovery-{SanitizeUrl(contentUrl)}-{checkIntervalHours}h";
            
            var schedule = await XiansContext.CurrentWorkflow.Schedules!
                .Create(scheduleId)
                .EveryHours(checkIntervalHours)
                .WithInput(contentUrl, checkIntervalHours)
                .SkipIfRunning()
                .WithRetryPolicy(new RetryPolicy
                {
                    MaximumAttempts = 3,
                    InitialInterval = TimeSpan.FromSeconds(10)
                })
                .WithMemo(new Dictionary<string, object>
                {
                    { "content_url", contentUrl },
                    { "interval_hours", checkIntervalHours }
                })
                .StartAsync();
            
            _logger.LogInformation("Recurring schedule created: {ScheduleId}", schedule.Id);
        }
        catch (ScheduleAlreadyExistsException ex)
        {
            _logger.LogInformation("Schedule {ScheduleId} already exists - content discovery will continue", 
                ex.ScheduleId);
        }
        catch (InvalidScheduleSpecException ex)
        {
            _logger.LogError("Invalid schedule specification: {Message}", ex.Message);
            throw;
        }
    }

    private async Task<object?> DiscoverContent(string url)
    {
        // Content discovery logic...
        await Task.CompletedTask;
        return new { Title = "Sample Content" };
    }

    private async Task ProcessNewContent(object content)
    {
        // Process discovered content...
        await Task.CompletedTask;
    }

    private string SanitizeUrl(string url)
    {
        // Convert URL to safe schedule ID component
        return url.Replace("https://", "")
                  .Replace("http://", "")
                  .Replace("/", "-")
                  .Replace(".", "-");
    }
}
```

### Example 3: Multi-Entity Scheduling

Create schedules for multiple entities dynamically within a workflow:

```csharp
using Xians.Lib.Agents;
using Xians.Lib.Agents.Scheduling;
using Xians.Lib.Agents.Scheduling.Models;
using Temporalio.Common;
using Temporalio.Workflows;

[Workflow("Company Research Setup Workflow")]
public class CompanyResearchSetupWorkflow
{
    private readonly ILogger _logger = Workflow.CreateLogger<CompanyResearchSetupWorkflow>();

    [WorkflowRun]
    public async Task RunAsync()
    {
        // Get current workflow context
        var workflow = XiansContext.CurrentWorkflow;
        
        // Create schedules for multiple companies
        var companies = new[] 
        { 
            new { Name = "ACME Corp", Ticker = "ACME" },
            new { Name = "TechCo", Ticker = "TECH" },
            new { Name = "GlobalInc", Ticker = "GLOB" }
        };

        foreach (var company in companies)
        {
            var scheduleId = $"research-{company.Ticker.ToLower()}";
            
            try
            {
                var schedule = await workflow.Schedules!
                    .Create(scheduleId)
                    .Weekdays(hour: 8, minute: 30, timezone: "America/New_York")
                    .WithInput(company.Name, company.Ticker)
                    .WithRetryPolicy(new RetryPolicy
                    {
                        MaximumAttempts = 3,
                        InitialInterval = TimeSpan.FromSeconds(15),
                        BackoffCoefficient = 2.0
                    })
                    .SkipIfRunning()
                    .WithMemo(new Dictionary<string, object>
                    {
                        { "company_name", company.Name },
                        { "ticker", company.Ticker },
                        { "research_type", "daily_market_analysis" }
                    })
                    .StartAsync();
                
                _logger.LogInformation("Schedule created for {Company} ({ScheduleId})", 
                    company.Name, schedule.Id);
            }
            catch (ScheduleAlreadyExistsException)
            {
                _logger.LogWarning("Schedule for {Company} already exists", company.Name);
            }
        }

        _logger.LogInformation("Created {Count} research schedules", companies.Length);
    }
}
```

### Example 4: Scheduled Monitoring with Alerts

Health monitoring that runs every 5 minutes:

```csharp
using Temporalio.Workflows;
using Xians.Lib.Agents;

[Workflow("System Health Check")]
public class HealthCheckWorkflow
{
    private readonly ILogger _logger = Workflow.CreateLogger<HealthCheckWorkflow>();

    [WorkflowRun]
    public async Task RunAsync(string[] services)
    {
        _logger.LogInformation("Running health check for {ServiceCount} services", services.Length);

        var unhealthyServices = new List<string>();

        foreach (var service in services)
        {
            var isHealthy = await CheckServiceHealth(service);
            
            if (!isHealthy)
            {
                unhealthyServices.Add(service);
                _logger.LogWarning("Service {Service} is unhealthy", service);
            }
        }

        if (unhealthyServices.Any())
        {
            await SendAlert(unhealthyServices);
        }
        
        _logger.LogInformation("Health check complete");
    }

    private async Task<bool> CheckServiceHealth(string service)
    {
        // Health check logic...
        await Task.CompletedTask;
        return true;
    }

    private async Task SendAlert(List<string> unhealthyServices)
    {
        // Alert logic...
        await Task.CompletedTask;
    }
}

// Setup within a workflow
[Workflow("Health Check Setup Workflow")]
public class HealthCheckSetupWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string[] services)
    {
        var workflow = XiansContext.CurrentWorkflow;
        
        var schedule = await workflow.Schedules!
            .Create("health-check-5min")
            .EveryMinutes(5)
            .WithInput(services)
            .AllowOverlap()  // Health checks are independent and fast
            .WithRetryPolicy(new RetryPolicy
            {
                MaximumAttempts = 2,  // Fail fast for health checks
                InitialInterval = TimeSpan.FromSeconds(5)
            })
            .WithTimeout(TimeSpan.FromMinutes(2))
            .WithMemo(new Dictionary<string, object>
            {
                { "monitor_type", "health_check" },
                { "alert_channel", "ops-alerts" }
            })
            .StartAsync();
            
        Workflow.Logger.LogInformation("Health check schedule created: {ScheduleId}", schedule.Id);
    }
}
```

### Example 5: Schedule Management Dashboard

List and manage all schedules:

```csharp
using Xians.Lib.Agents;

public class ScheduleManager
{
    private readonly XiansWorkflowContext _workflow;

    public ScheduleManager(XiansWorkflowContext workflow)
    {
        _workflow = workflow;
    }

    public async Task DisplayAllSchedules()
    {
        Console.WriteLine("=== All Schedules ===\n");

        var schedules = await _workflow.Schedules!.ListAsync();

        await foreach (var scheduleInfo in schedules)
        {
            var schedule = await _workflow.Schedules!.GetAsync(scheduleInfo.Id);
            var description = await schedule.DescribeAsync();

            var nextRun = description.Info.NextActionTimes.FirstOrDefault();
            var isPaused = description.Schedule.State.Paused;
            var pauseNote = description.Schedule.State.Note;

            Console.WriteLine($"Schedule: {schedule.Id}");
            Console.WriteLine($"   Status: {(isPaused ? "Paused" : "Active")}");
            Console.WriteLine($"   Next run: {nextRun?.ToString() ?? "N/A"}");
            
            if (!string.IsNullOrEmpty(pauseNote))
            {
                Console.WriteLine($"   Note: {pauseNote}");
            }

            // Display memo if available
            if (description.Memo?.Fields != null)
            {
                Console.WriteLine("   Metadata:");
                foreach (var kvp in description.Memo.Fields)
                {
                    Console.WriteLine($"     - {kvp.Key}: {kvp.Value}");
                }
            }

            // Recent execution history
            if (description.Info.RecentActions.Any())
            {
                Console.WriteLine("   Recent executions:");
                foreach (var action in description.Info.RecentActions.Take(3))
                {
                    Console.WriteLine($"     - {action.ActualTime}");
                }
            }

            Console.WriteLine();
        }
    }

    public async Task PauseAllSchedules(string reason)
    {
        var schedules = await _workflow.Schedules!.ListAsync();

        await foreach (var scheduleInfo in schedules)
        {
            var schedule = await _workflow.Schedules!.GetAsync(scheduleInfo.Id);
            await schedule.PauseAsync(reason);
            Console.WriteLine($"Paused: {scheduleInfo.Id}");
        }
    }

    public async Task ResumeAllSchedules(string reason)
    {
        var schedules = await _workflow.Schedules!.ListAsync();

        await foreach (var scheduleInfo in schedules)
        {
            var schedule = await _workflow.Schedules!.GetAsync(scheduleInfo.Id);
            await schedule.UnpauseAsync(reason);
            Console.WriteLine($"Resumed: {scheduleInfo.Id}");
        }
    }
}

// Usage
var workflow = XiansContext.CurrentWorkflow;
var manager = new ScheduleManager(workflow);

await manager.DisplayAllSchedules();

// Pause all for maintenance
await manager.PauseAllSchedules("Database migration in progress");

// Resume after maintenance
await manager.ResumeAllSchedules("Migration completed successfully");
```

## API Reference

### ScheduleCollection

**Access**: `workflow.Schedules!` or `XiansContext.CurrentWorkflow.Schedules!`

#### Creation
- `Create(scheduleId)` → `ScheduleBuilder` - Start building new schedule

#### Retrieval
- `GetAsync(scheduleId)` → `Task<XiansSchedule>` - Get schedule (async)
- `Get(scheduleId)` → `XiansSchedule` - Get schedule (sync)
- `ListAsync()` → `Task<IAsyncEnumerable<ScheduleListDescription>>` - List all schedules
- `ExistsAsync(scheduleId)` → `Task<bool>` - Check existence

#### Management
- `PauseAsync(scheduleId, note?)` → `Task` - Pause schedule
- `UnpauseAsync(scheduleId, note?)` → `Task` - Resume schedule
- `TriggerAsync(scheduleId)` → `Task` - Trigger immediate execution
- `DeleteAsync(scheduleId)` → `Task` - Delete schedule

### ScheduleBuilder

#### Schedule Timing Methods (choose one)

**Convenience Extensions:**
- `.Daily(hour, minute = 0, timezone?)` - Daily at specific time
- `.Weekly(dayOfWeek, hour, minute = 0, timezone?)` - Weekly on day
- `.Monthly(dayOfMonth, hour, minute = 0, timezone?)` - Monthly on day
- `.Hourly(minute = 0)` - Every hour at minute
- `.Weekdays(hour, minute = 0, timezone?)` - Monday-Friday
- `.EverySeconds(seconds)` - Interval in seconds
- `.EveryMinutes(minutes)` - Interval in minutes
- `.EveryHours(hours)` - Interval in hours
- `.EveryDays(days, hour = 0, minute = 0, timezone?)` - Interval in days

**Core Methods:**
- `.WithCronSchedule(expression, timezone?)` - Cron expression
- `.WithIntervalSchedule(interval, offset?)` - Duration interval
- `.WithCalendarSchedule(dateTime, timezone?)` - Specific date/time
- `.WithScheduleSpec(spec)` - Custom Temporal spec

#### Workflow Configuration
- `.WithInput(params object[] args)` - Workflow input arguments
- `.WithMemo(Dictionary<string, object>)` - Custom metadata
- `.WithRetryPolicy(RetryPolicy)` - Retry policy
- `.WithTimeout(TimeSpan)` - Execution timeout

#### Overlap Policies
- `.SkipIfRunning()` - Skip if running (recommended)
- `.AllowOverlap()` - Allow concurrent executions
- `.BufferOne()` - Queue one execution
- `.CancelOther()` - Cancel running, start new
- `.TerminateOther()` - Terminate running (caution)
- `.WithOverlapPolicy(ScheduleOverlapPolicy)` - Set policy
- `.WithSchedulePolicy(SchedulePolicy)` - Advanced policy

#### Schedule State
- `.StartPaused(paused = true, note?)` - Create paused

#### Execution
- `.StartAsync()` - **Create and start schedule** (required)

### XiansSchedule

#### Properties
- `Id` → `string` - Schedule identifier

#### Information
- `DescribeAsync()` → `Task<ScheduleDescription>` - Get details
  - `Info.NextActionTimes` - Upcoming executions
  - `Info.RecentActions` - Execution history
  - `Schedule.State.Paused` - Paused status
  - `Schedule.State.Note` - State note
  - `Schedule.Spec` - Schedule specification

#### Operations
- `PauseAsync(note?)` → `Task` - Pause
- `UnpauseAsync(note?)` → `Task` - Resume
- `TriggerAsync()` → `Task` - Trigger now
- `UpdateAsync(updater)` → `Task` - Modify config
- `DeleteAsync()` → `Task` - Delete
- `BackfillAsync(backfills)` → `Task` - Execute for past ranges

#### Advanced
- `GetHandle()` → `ScheduleHandle` - Temporal handle

### Exceptions

**Namespace**: `Xians.Lib.Agents.Scheduling.Models`

- `ScheduleAlreadyExistsException` - Schedule ID exists
- `ScheduleNotFoundException` - Schedule not found
- `InvalidScheduleSpecException` - Invalid configuration

## Best Practices Summary

### 1. Always Configure Overlap Policies

```csharp
.SkipIfRunning()  // Recommended for most cases
```

### 2. Add Retry Policies for Production

```csharp
.WithRetryPolicy(new RetryPolicy
{
    MaximumAttempts = 3,
    InitialInterval = TimeSpan.FromSeconds(10),
    BackoffCoefficient = 2.0
})
```

### 3. Use Timezones for User-Facing Schedules

```csharp
.Daily(hour: 9, timezone: "America/New_York")
```

### 4. Check Existence for Idempotency

```csharp
if (!await workflow.Schedules!.ExistsAsync("my-schedule"))
{
    await workflow.Schedules!.Create("my-schedule")...StartAsync();
}
```

### 5. Use Meaningful Schedule IDs

```csharp
.Create($"daily-sync-{companyId}")  // Good
.Create("schedule1")                // Bad
```

### 6. Add Metadata with Memo

```csharp
.WithMemo(new Dictionary<string, object>
{
    { "owner", "team-name" },
    { "purpose", "data-sync" }
})
```

### 7. Set Appropriate Timeouts

```csharp
.WithTimeout(TimeSpan.FromHours(2))
```

### 8. Use Descriptive Pause Notes

```csharp
await schedule.PauseAsync("Database migration - ETA 2 hours");
```

---

## Conclusion

Xians scheduling provides **production-grade time-based automation** for AI agents with:

- **Flexible scheduling** - Cron, intervals, calendars, convenience methods
- **Production features** - Retries, timeouts, overlap policies
- **Multi-tenant security** - Automatic isolation and filtering
- **Developer experience** - Fluent API, auto-determinism, zero config
- **Enterprise reliability** - Built on Temporal's proven scheduling engine

Use schedules to transform reactive agents into **autonomous, proactive systems** that operate on your timeline.

---

**Next Steps:**

- **[Scheduling Concepts](../concepts/scheduling.md)** - Quick start guide
- **[Agents](../concepts/agents.md)** - Agent architecture

