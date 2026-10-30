# Graceful Shutdown

When the server or an agent is stopped — a deploy, a scale-down, a restart — it gets a stop signal (SIGTERM, or Ctrl+C locally) and a short time to finish its work before it exits. This page explains what each part does in that time and how to configure it.

!!! note "Workflows are not stopped"
    Shutdown never cancels or terminates workflows. Temporal keeps their state, and they carry on when an agent worker is running again. Only the work happening *inside the process* at that moment needs time to finish.

## Server

On a stop signal, `XiansAi.Server`:

1. Stops accepting new connections.
2. Closes open live-update (SSE) streams. Browsers reconnect on their own.
3. Lets in-flight HTTP requests finish.
4. Finishes queued background database writes (activity history, conversation messages) instead of dropping them.
5. Exits.

| Setting | Default | What it does |
|---------|---------|--------------|
| `Server__ShutdownTimeoutSeconds` | `45` | Total time the server gets to shut down cleanly. |
| `Server__BackgroundTaskDrainTimeoutSeconds` | `30` | Max time to finish queued database writes. Anything not written in time is logged as a warning. |

```bash
# Optional — defaults shown
Server__ShutdownTimeoutSeconds=45
Server__BackgroundTaskDrainTimeoutSeconds=30
```

## Agents

On a stop signal, an agent started with `RunAllAsync()`:

1. Stops picking up new workflow and activity tasks.
2. Lets activities that are already running finish (LLM calls, HTTP calls, emails, ...).
3. Exits.

Activities still running when the time is up are cancelled, and Temporal retries them on a running worker.

The time is set per workflow with `GracefulShutdownTimeout` (default **30 seconds**):

```csharp
agent.Workflows.DefineCustom<ReportWorkflow>(new WorkflowOptions
{
    // Long activities: give them more time to finish on shutdown
    GracefulShutdownTimeout = TimeSpan.FromSeconds(90),
});
```

Set it to `TimeSpan.Zero` to cancel running activities right away.

!!! note "Passing your own cancellation token"
    `RunAllAsync()` handles Ctrl+C and SIGTERM for you only when called **without** a token. If you call `RunAllAsync(token)`, cancel that token yourself when the process is asked to stop — for example from `IHostApplicationLifetime.ApplicationStopping` when the agent runs inside a .NET host.

!!! tip "Write activities that are safe to retry"
    An activity can still be cut off — by a timeout, a crash, or a forced kill — and Temporal will run it again. Avoid side effects that must not happen twice (such as sending the same email), or check whether the work was already done before doing it.

## Container stop timeout

The orchestrator must wait **longer** than the timeouts above before it force-kills the process. Otherwise the clean shutdown is cut short.

| Platform | Default wait | Setting |
|----------|--------------|---------|
| `docker stop` / `docker run` | 10s | `docker stop -t 60` or `docker run --stop-timeout 60` |
| Docker Compose | 10s | `stop_grace_period: 60s` |
| Kubernetes | 30s | `terminationGracePeriodSeconds: 60` |

```yaml
# Docker Compose
services:
  xiansai-server:
    image: 99xio/xiansai-server:latest
    stop_grace_period: 60s
```

```yaml
# Kubernetes
spec:
  terminationGracePeriodSeconds: 60
```

!!! warning "`docker rm -f` and `docker kill` skip graceful shutdown"
    They kill the process immediately. Use `docker stop` first.

## Related

- [Installation](installation.md)
- [Scaling](scaling.md)
- [Agents](../concepts/agents.md)
