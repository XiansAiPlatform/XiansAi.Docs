# Scheduling

## Why Schedules?

AI agents should be proactive, not just reactive. Daily reports, hourly health checks, background research — these need time-based triggers. You could run external cron jobs, but then timing logic lives outside your agent, doesn't survive failures gracefully, and knows nothing about tenants.

Xians schedules are **cron jobs built into your workflows**, powered by [Temporal Schedules](https://docs.temporal.io/workflows#schedule):

- **Durable** — survive restarts and failures
- **Multi-tenant aware** — automatic isolation per tenant, zero configuration
- **Workflow-native** — safe to create from inside workflows (the SDK keeps it deterministic)
- **Production-ready** — built-in overlap policies, retries, and timeouts

The key insight: **a workflow that schedules itself is autonomous**. It controls its own timing and operates continuously without external coordination.

## Quick Start: A Self-Scheduling Workflow

```csharp
[Workflow("Daily Report Workflow")]
public class DailyReportWorkflow
{
    [WorkflowRun]
    public async Task RunAsync(string reportType)
    {
        // Do the work
        await GenerateReport(reportType);

        // Ensure the recurring schedule exists (idempotent — safe every run)
        await XiansContext.CurrentAgent.Schedules
            .Create<DailyReportWorkflow>("daily-report")
            .Daily(hour: 9, timezone: "America/New_York")
            .WithInput(reportType)
            .SkipIfRunning()
            .CreateIfNotExistsAsync();
    }
}
```

The workflow runs, does its work, and guarantees its own next run. That's the whole pattern.

## Defining When to Run

| Style | Methods | Example |
|-------|---------|---------|
| Time-based | `.Daily()`, `.Hourly()`, `.Weekdays()`, `.Weekly()`, `.Monthly()` | `.Daily(hour: 9, timezone: "America/New_York")` |
| Interval | `.EverySeconds()`, `.EveryMinutes()`, `.EveryHours()`, `.EveryDays()` | `.EveryMinutes(15)` |
| Cron | `.WithCronSchedule(expr, timezone?)` | `.WithCronSchedule("0 9 * * 1-5", timezone: "America/New_York")` |
| One-time | `.WithCalendarSchedule(dateTime, timezone?)` | `.WithCalendarSchedule(new DateTime(2026, 12, 25, 9, 0, 0))` |

```csharp
.Daily(hour: 9, timezone: "America/New_York")       // every day, timezone-aware
.Weekdays(hour: 8, minute: 30)                       // Mon–Fri
.Weekly(DayOfWeek.Monday, hour: 10)
.Monthly(dayOfMonth: 1, hour: 8)
.EveryHours(2)                                       // duration-based, no timezone
.WithCronSchedule("0 */2 * * *")                     // full cron power
```

!!! note "Multi-day intervals"
    `.EveryDays(n)` with `n > 1` ignores hour/minute parameters. `.EveryDays(1, hour: 9)` is equivalent to `.Daily(hour: 9)`.

## Overlap Policies: What If the Previous Run Is Still Going?

Schedules can fire faster than workflows finish. Decide up front what happens:

| Policy | Behavior | When to use |
|--------|----------|-------------|
| `.SkipIfRunning()` | Skip the new run | **Default choice** — prevents pile-up |
| `.BufferOne()` | Queue one run for after the current | Work must not be skipped, but shouldn't overlap |
| `.AllowOverlap()` | Run concurrently | Runs are independent |
| `.CancelOther()` | Cancel the running one, start fresh | New data supersedes old run |
| `.TerminateOther()` | Force-kill the running one | Last resort |

## Creation Methods: Idempotent by Default

Why three methods? Because self-scheduling workflows call the creation code on *every* run, so it must be safe to repeat:

```csharp
.CreateIfNotExistsAsync()  // Returns existing or creates — idempotent (recommended)
.CreateAsync()             // Throws ScheduleAlreadyExistsException if it exists — strict
.RecreateAsync()           // Deletes existing, creates new — for config changes
```

Use `CreateIfNotExistsAsync()` unless you specifically need strict failure (`CreateAsync`) or are changing the schedule's configuration (`RecreateAsync`).

## Managing Schedules

```csharp
var schedules = XiansContext.CurrentAgent.Schedules;

var schedule = await schedules.GetAsync("my-schedule");
bool exists  = await schedules.ExistsAsync("my-schedule");

await schedule.PauseAsync("System maintenance");
await schedule.UnpauseAsync("Maintenance complete");
await schedule.TriggerAsync();          // run now, without affecting the schedule
var info = await schedule.DescribeAsync(); // next run times, recent actions
await schedule.DeleteAsync();

// Backfill: run actions for a past period
await schedule.BackfillAsync(new[]
{
    new ScheduleBackfill(startAt: DateTime.UtcNow.AddDays(-7), endAt: DateTime.UtcNow.AddDays(-1))
});
```

All of these also exist as by-ID overloads on the collection (e.g. `schedules.PauseAsync("my-schedule")`). For advanced Temporal features, `schedule.GetHandle()` returns the native Temporal handle.

## Multi-Tenant Isolation

Schedule IDs are automatically namespaced as `{tenantId}:{agentName}:{idPostfix}:{scheduleId}`, so:

- Tenants can't see or trigger each other's schedules.
- The same agent code deployed to many tenants creates independent schedules per tenant.
- No manual filtering or prefixing required.

If you need extra uniqueness within an agent (e.g. per-user schedules), use a custom `idPostfix` with the non-generic overload:

```csharp
var workflowType = XiansContext.GetWorkflowTypeFor(typeof(SyncWorkflow));
await XiansContext.CurrentAgent.Schedules
    .Create("daily-sync", workflowType, idPostfix: "user123")
    .Daily(hour: 9)
    .CreateIfNotExistsAsync();

// Retrieve with the same idPostfix
var retrieved = await XiansContext.CurrentAgent.Schedules.GetAsync("daily-sync", idPostfix: "user123");
```

## Common Patterns

### Per-entity schedules

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

### Create paused, start later

```csharp
var schedule = await XiansContext.CurrentAgent.Schedules
    .Create<MaintenanceWorkflow>("maintenance-task")
    .Daily(hour: 2)
    .StartPaused(true, "Created for future use")
    .CreateIfNotExistsAsync();

// When ready:
await schedule.UnpauseAsync("Ready to start maintenance");
```

## Error Handling

| Exception | Thrown when |
|-----------|-------------|
| `ScheduleAlreadyExistsException` | `CreateAsync()` on an existing schedule |
| `ScheduleNotFoundException` | `GetAsync()` for a missing schedule |
| `InvalidScheduleSpecException` | Invalid schedule configuration |

## Best Practices

- **`CreateIfNotExistsAsync()` + `.SkipIfRunning()`** is the right default for nearly everything.
- **Always specify timezones** for time-based schedules — interval schedules don't need them.
- **Use descriptive IDs** — `daily-sync-{company}`, not `schedule1`.
- **Catch the specific exceptions** — they tell you exactly what went wrong.

## What's Next?

- [Workflows](workflows.md) — the workflows your schedules trigger
- [Agents](agents.md) — the self-scheduling pattern in context
