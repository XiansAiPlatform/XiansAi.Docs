# Heartbeats

There are two distinct heartbeat mechanisms in the XiansAi platform. Understanding the difference matters when you're diagnosing availability issues.

| Mechanism | Layer | Who initiates | What it checks |
| --- | --- | --- | --- |
| **Studio worker monitoring** | Platform / Server | Agent worker → Server (periodic ping) | Is the agent worker process running? |
| **SDK message heartbeat** | SDK / Messaging | Client → Workflow (on-demand message) | Is this specific workflow instance available right now? |

---

## Studio Worker Monitoring

Heartbeats are how the Studio knows an agent is **alive**, not just *deployed*. Every running agent worker pings the platform on a fixed interval; the Studio surfaces the result on the agent list and on the agent detail page.

This is a **server-side** feature managed by the XiansAi platform. The interval and grace window are configured in your server deployment.

### What a heartbeat carries

- Agent ID and instance ID (multiple workers per agent are normal)
- SDK version, runtime version, host name
- Workflow and activity worker status (queues being served, slots in use)
- Last successful poll timestamp

### How the Studio uses it

| State | Meaning |
| --- | --- |
| **Healthy** (green) | Heartbeat received within the last interval |
| **Stale** (yellow) | One missed interval — usually transient |
| **Down** (red) | Two or more missed intervals — alert the owner |
| **Unknown** (grey) | Never registered, or the agent hasn't started yet |

The default interval is **30 seconds**, with a 90-second grace window before an instance flips to **Down**.

### Acting on a missing heartbeat

From the agent detail page you can:

- **View last logs** — jump to the final log lines from the dead instance.
- **Drain & redeploy** — mark the instance as drained so the platform stops routing new work to it.
- **Page owner** — fire the agent's configured alert webhook (Slack, PagerDuty, MS Teams).

### What worker heartbeats are not

- Not a *correctness* check — a heartbeat says "the worker is up", not "the workflows are succeeding". Pair them with run-level metrics for that.
- Not a substitute for tracing — for *why* a request hung, use the run timeline and tool logs.

---

## SDK Message Heartbeat

The SDK provides an **in-band liveness check** at the workflow level. A client sends a message with `Type = "heartbeat"` to a specific workflow instance. The agent runtime handles it immediately — without invoking any user message handler — and replies with an availability status.

This is useful for UIs that need to know whether a particular workflow is currently reachable before sending a real message (e.g., showing a "connected" indicator in a chat widget).

### How it works

```
Client  →  { Type: "heartbeat", ... }  →  Workflow instance
                                                ↓
                                    Handled by MessageProcessor
                                    (no user handler invoked)
                                                ↓
Client  ←  { available: true }  OR  { available: false, reason: "configuration_error" }
```

### Response payloads

| Condition | Response |
| --- | --- |
| Workflow instance reachable and tenant extractable | `{ available: true }` |
| Tenant ID cannot be extracted from the workflow ID | `{ available: false, reason: "configuration_error" }` |

The response `Type` is `"Data"` and `Origin` is `"heartbeat"`, so it is easily distinguished from regular chat replies in your message handler.

### SDK internals

The `MessageType.Heartbeat` enum value maps to the string `"heartbeat"`. The platform normalizes the incoming message type (trims whitespace and lowercases) before matching, so `"Heartbeat"`, `"HEARTBEAT"`, and `"heartbeat"` are all equivalent.

!!! tip "Using heartbeats in a chat widget"
    Send a `heartbeat` message periodically (e.g. every 30 s) from your frontend SDK. A `{ available: false }` response — or a timeout — means the workflow is unreachable and the user should be shown a reconnecting state.
