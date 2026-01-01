# Schedules

## Time-Based AI Automation

Your agents shouldn't just react—they should **proactively work while you sleep**. Schedules let you automate agents and workflows to run at specific times, turning your AI from reactive to autonomous.

## The Timing Problem

**Manual Trigger Hell:**
```
→ Remember to run the daily report... forgot again
→ Process overnight data... at 3 AM? Who's awake?
→ Send weekly summaries... missed last week
```

**With Schedules:**
```
→ Reports generate automatically every morning at 9 AM
→ Data processing runs every night at 2 AM
→ Weekly summaries sent every Friday at 5 PM
→ You do nothing. It just works.
```

## Why Schedules Transform AI Development

### The Challenge: AI Agents Are Reactive
By default, agents wait for input. But many business processes need to happen **on a schedule**, not on-demand.

### The Solution: Time-Based Orchestration
Schedules enable:
- **Automated Workflows**: Run complex processes at specified times
- **Periodic Data Processing**: Sync, analyze, and report on a cadence
- **Proactive Agents**: Agents that reach out, not just respond
- **Reliability**: Never forget, never miss a deadline

## Core Concepts

### Cron Expressions Made Simple

```typescript
// Every day at 9 AM
await xians.createSchedule({
  name: "daily-report",
  cron: "0 9 * * *",
  workflow: "GenerateDailyReport"
});

// Every Monday at 8 AM
await xians.createSchedule({
  name: "weekly-meeting-prep",
  cron: "0 8 * * 1",
  agent: "MeetingPrepAgent"
});

// Every hour
await xians.createSchedule({
  name: "sync-data",
  cron: "0 * * * *",
  workflow: "DataSyncWorkflow"
});
```

### Common Patterns

| Pattern | Cron | Description |
|---------|------|-------------|
| Every 5 minutes | `*/5 * * * *` | Real-time monitoring |
| Every hour | `0 * * * *` | Regular syncs |
| Daily at 9 AM | `0 9 * * *` | Morning reports |
| Weekdays at 9 AM | `0 9 * * 1-5` | Business hours only |
| Weekly on Monday | `0 9 * * 1` | Weekly tasks |
| Monthly on 1st | `0 9 1 * *` | Monthly reports |

## Quick Start

### Schedule a Daily Report

```typescript
const schedule = await xians.createSchedule({
  name: "sales-report",
  description: "Generate daily sales report and email to team",
  
  // When: Every day at 8 AM EST
  cron: "0 8 * * *",
  timezone: "America/New_York",
  
  // What: Run this workflow
  workflow: "SalesReportWorkflow",
  
  // With what data
  input: {
    recipients: ["sales@company.com"],
    format: "pdf"
  }
});
```

### Schedule an Agent Task

```typescript
const schedule = await xians.createSchedule({
  name: "customer-followup",
  description: "AI agent follows up with inactive customers",
  
  // Every Friday at 10 AM
  cron: "0 10 * * 5",
  
  // This agent runs
  agent: "CustomerEngagementAgent",
  
  input: {
    action: "followup-inactive",
    inactiveDays: 30
  }
});
```

## Why This Changes AI Development

### Before Schedules: Manual Cron Jobs

```bash
# In crontab
0 9 * * * /usr/bin/node /app/scripts/daily-report.js
30 8 * * 1 /usr/bin/python /app/scripts/weekly-sync.py
0 2 * * * /usr/bin/node /app/scripts/cleanup.js

# Each script manually calls agents
# No monitoring, no retry logic, no observability
# Failures go unnoticed
```

### With Xians Schedules

```typescript
// Create schedule once
const schedule = await xians.createSchedule({
  name: "daily-report",
  cron: "0 9 * * *",
  workflow: "DailyReportWorkflow",
  
  // Built-in reliability
  retry: {
    maxAttempts: 3,
    backoff: "exponential"
  },
  
  // Built-in monitoring
  alerts: {
    onFailure: ["ops@company.com"]
  }
});

// Monitor from dashboard
const status = await schedule.getStatus();
console.log(`Success rate: ${status.successRate}%`);
```

## Powerful Schedule Patterns

### Pattern 1: Business Hours Only
**Run during work hours, respect time zones.**

```typescript
const schedule = await xians.createSchedule({
  name: "business-hours-monitoring",
  
  // Every 30 minutes
  cron: "*/30 * * * *",
  
  // But only during business hours
  executionWindow: {
    startTime: "09:00",
    endTime: "17:00",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    timezone: "America/Los_Angeles"
  },
  
  agent: "CustomerSupportMonitor"
});
```

### Pattern 2: Smart Retry Logic
**Because cloud services fail sometimes.**

```typescript
const schedule = await xians.createSchedule({
  name: "critical-data-sync",
  cron: "0 2 * * *",
  workflow: "CriticalDataSync",
  
  // Retry on failure
  retry: {
    maxAttempts: 5,
    backoff: "exponential",     // 1s, 2s, 4s, 8s, 16s
    retryableErrors: ["network", "timeout", "rate-limit"]
  },
  
  // Alert if all retries fail
  alerts: {
    onFailure: {
      channels: ["email", "slack"],
      recipients: ["ops@company.com"],
      message: "Critical sync failed after 5 attempts"
    }
  }
});
```

### Pattern 3: Conditional Execution
**Run only when conditions are met.**

```typescript
const schedule = await xians.createSchedule({
  name: "weekend-processing",
  cron: "0 0 * * 0",  // Every Sunday
  
  workflow: "ExpensiveProcessingWorkflow",
  
  // Only run if there's work to do
  condition: async () => {
    const queue = await checkWorkQueue();
    return queue.length > 100;  // Only if 100+ items queued
  }
});
```

## Real-World Examples

### Daily Customer Engagement

```typescript
// Every morning: AI analyzes customer data and sends personalized messages
const engagement = await xians.createSchedule({
  name: "daily-engagement",
  cron: "0 9 * * *",
  timezone: "America/New_York",
  
  workflow: await xians.createWorkflow({
    name: "CustomerEngagementWorkflow",
    steps: [
      // Step 1: Identify customers to engage
      {
        id: "identify",
        agent: "DataAnalysisAgent",
        input: {
          criteria: "inactive > 7 days OR high-value"
        }
      },
      
      // Step 2: Generate personalized messages
      {
        id: "personalize",
        agent: "PersonalizationAgent",
        input: "{{identify.customers}}"
      },
      
      // Step 3: Send via their preferred channel
      {
        id: "send",
        agent: "CommunicationAgent",
        input: "{{personalize.messages}}"
      }
    ]
  })
});
```

### Weekly Performance Report

```typescript
// Every Monday morning: Compile and send performance report
const report = await xians.createSchedule({
  name: "weekly-performance",
  cron: "0 8 * * 1",  // Monday 8 AM
  
  agent: "PerformanceReportAgent",
  
  input: {
    period: "last-week",
    sections: [
      "revenue",
      "customer-growth",
      "agent-performance",
      "top-issues"
    ],
    recipients: ["leadership@company.com"],
    format: "pdf-and-email"
  }
});
```

### Hourly Data Pipeline

```typescript
// Every hour: Fetch, process, analyze, alert
const pipeline = await xians.createSchedule({
  name: "data-pipeline",
  cron: "0 * * * *",  // Top of every hour
  
  workflow: "DataPipelineWorkflow",
  
  timeout: "15m",  // Must complete in 15 minutes
  
  onTimeout: {
    action: "alert",
    recipients: ["data-team@company.com"]
  }
});
```

## Schedule Management

### Monitor Schedule Health

```typescript
const schedule = await xians.getSchedule("daily-report");

// Check status
const status = await schedule.getStatus();
console.log({
  enabled: status.enabled,
  lastRun: status.lastExecution,
  nextRun: status.nextExecution,
  successRate: status.successRate,
  avgDuration: status.avgDuration
});

// Get recent executions
const executions = await schedule.getExecutions({ limit: 10 });
executions.forEach(exec => {
  console.log(`${exec.timestamp}: ${exec.status} (${exec.duration}ms)`);
});
```

### Pause and Resume

```typescript
// Pause during maintenance
await schedule.pause();

// Resume when ready
await schedule.resume();

// Update schedule
await schedule.update({
  cron: "0 10 * * *",  // Change from 9 AM to 10 AM
  enabled: true
});
```

### One-Time Schedules

```typescript
// Run once at specific time
const oneTime = await xians.createSchedule({
  name: "year-end-report",
  type: "one-time",
  executeAt: new Date("2024-12-31T23:59:00Z"),
  workflow: "YearEndReportWorkflow"
});
```

## Best Practices

**✅ Use Descriptive Names**
```typescript
// Good
name: "daily-customer-engagement-report"

// Bad  
name: "cron-job-1"
```

**✅ Set Appropriate Timeouts**
```typescript
timeout: "30m",  // Long-running workflows
timeout: "5m",   // Quick data syncs
```

**✅ Monitor and Alert**
```typescript
alerts: {
  onFailure: ["team@company.com"],
  onTimeout: ["ops@company.com"],
  onSuccess: false  // Don't spam on success
}
```

**✅ Respect Time Zones**
```typescript
timezone: "America/New_York",  // Explicit
// Not: cron in UTC and hope for the best
```

**❌ Don't Overlap Executions**
```typescript
// If a task takes 2 hours, don't run it every hour
// Use locks or check if previous run is complete
concurrency: "skip-if-running"
```

**❌ Don't Ignore Failures**
Always set up monitoring and alerts. Silent failures = data loss.

## Integration Points

Schedules work seamlessly with:

- **[Workflows](workflows.md)**: Orchestrate complex multi-step processes
- **[Agents](agents.md)**: Run agent tasks on autopilot
- **[Webhooks](webhooks.md)**: Alternative for event-driven triggers
- **[Knowledge](knowledge.md)**: Scheduled knowledge base updates

---

**The Bottom Line**: Schedules turn your reactive AI agents into proactive autonomous workers. Set them up once, and they'll run reliably forever—or until you tell them to stop.
