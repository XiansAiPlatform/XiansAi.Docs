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
[Workflow("MyAgent:Daily Report Workflow")]
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
| Interval | `.EverySeconds()`, `.EveryMinutes()`, `.EveryHours()`, `.EveryDays()` / `.WithIntervalSchedule(...)` | `.EveryMinutes(15)` |
| Cron | `.WithCronSchedule(expr, timezone?)` — see [Cron String Formats](#cron-string-formats) | `.WithCronSchedule("0 9 * * 1-5", timezone: "America/New_York")` |
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

## Cron String Formats

`.WithCronSchedule(expr, timezone?)` hands `expr` to Temporal untouched — the SDK only rejects
null/empty. Everything else is validated by the server at creation time, so a bad expression
surfaces as `Invalid schedule spec: ...` from `CreateIfNotExistsAsync()`, not as a compile-time or
startup error. That makes it worth knowing exactly what the server accepts.

### Field counts: 5, 6, or 7

| Fields | Layout | Example | Meaning |
|--------|--------|---------|---------|
| 5 | `minute hour day-of-month month day-of-week` | `0 9 * * 1-5` | 09:00, Mon–Fri |
| 6 | the five above **+ year** | `0 9 * * * 2027` | 09:00 daily, only in 2027 |
| 7 | **second +** the five **+ year** | `*/30 * * * * * *` | every 30 seconds |

With 5 or 6 fields, seconds are pinned to `0`. Fields accept the usual cron syntax: steps
(`*/15`), ranges (`1-5`), lists (`1,3,5`), and names (`MON-FRI`, `JAN`).

!!! warning "The 6th field is the year — not seconds"
    A 6-field string is the 5-field layout with a year appended, so `*/30 * * * * *` is **every 30
    minutes**, not every 30 seconds: `*/30` lands on minutes and the trailing `*` is the year.
    Seconds only appear once you supply all 7 fields. Anything outside 5–7 fields is rejected with
    `CronString does not have 5-7 fields`. A miscounted string that happens to land on 6 or 7
    fields usually fails on the year instead — `Year is not in range [2000-2100]` — because the last
    field is being read as one.

### Descriptors

| Descriptor | Fires |
|------------|-------|
| `@every <duration>` | Repeatedly, on an interval — `@every 30s`, `@every 1h30m` |
| `@hourly` | Top of every hour |
| `@daily` / `@midnight` | 00:00 daily |
| `@weekly` | 00:00 Sunday |
| `@monthly` | 00:00 on the 1st |
| `@yearly` / `@annually` | 00:00 on January 1 |

`@every` takes a Go duration string and becomes an *interval* spec rather than a calendar one, so
it is the only cron-string form that can go sub-minute. The unit is required (`@every 30` fails
with `missing unit in duration`), sub-second intervals are rejected (`interval is too small`), and
an optional phase offset after a slash shifts the alignment — `@every 45s/10s` fires 10s into each
45s window.

### Timezone prefix and comments

```csharp
.WithCronSchedule("CRON_TZ=America/New_York 0 9 * * *")   // same as timezone: "America/New_York"
.WithCronSchedule("0 9 * * * #daily standup")             // trailing comment, kept on the spec
```

!!! note "`CRON_TZ` does nothing for `@every`"
    `CRON_TZ=Asia/Colombo @every 30s` is accepted, but the timezone is silently dropped — an
    interval has no wall-clock anchor to shift. Timezones only affect calendar-style specs.

### Going sub-minute

Three ways to say "every 30 seconds", in order of preference:

```csharp
.EverySeconds(30)                      // clearest, no cron parsing involved
.WithCronSchedule("@every 30s")        // when the value comes from config (env var, DB, Studio input)
.WithCronSchedule("*/30 * * * * * *")  // 7-field form; easy to miscount, see the warning above
```

The first two produce an interval spec, anchored to when the schedule was created; the 7-field
form is a calendar spec, so it fires on wall-clock `:00` and `:30` of each minute. Reach for
`@every` when a single configurable setting has to express both "daily at 03:00" and "every 30
seconds during local testing"; otherwise prefer the typed interval methods.

!!! info "Verified behavior"
    The field-count semantics, descriptors and error messages above were checked against Temporal
    Server 1.28 by creating each spec and reading back the stored schedule.

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

Self-scheduling workflows call the creation code on *every* run, so it must be safe to repeat:

```csharp
.CreateIfNotExistsAsync()  // Returns existing or creates — idempotent (recommended)
.CreateAsync()             // Throws ScheduleAlreadyExistsException if it exists — strict
```

Use `CreateIfNotExistsAsync()` unless you specifically need strict failure (`CreateAsync`).

## Managing Schedules

```csharp
var schedules = XiansContext.CurrentAgent.Schedules;

var schedule = await schedules.GetAsync("my-schedule");

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

All of these also exist as by-name overloads on the collection (e.g. `schedules.PauseAsync("my-schedule")`). For advanced Temporal features, `schedule.GetHandle()` returns the native Temporal handle.

## Multi-Tenant Isolation

Schedule IDs are automatically namespaced as `{tenantId}:{agentName}:{idPostfix}:{scheduleName}`, so:

- Tenants can't see or trigger each other's schedules.
- The same agent code deployed to many tenants creates independent schedules per tenant.
- No manual filtering or prefixing required.

## Common Patterns

### Per-entity schedules

```csharp
[Workflow("MyAgent:Research Setup")]
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
- **`[Workflow("AgentName:WorkflowName")]`** — custom workflows need the agent-prefixed type name.

## What's Next?

- [Workflows](workflows.md) — the workflows your schedules trigger
- [Agents](agents.md) — the self-scheduling pattern in context
