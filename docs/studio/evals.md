# Evals

Evals are automated checks that run against an agent activation on a schedule and record **pass**, **fail** or
**error**. They answer "is this agent still doing its job?" without anyone having to try it by hand. They can also
email your team when an agent starts failing.

Find them in Agent Studio under **Agent Settings → Evals**. Pick an agent and an activation to see its evals, their
latest status, and their run history.

!!! note "Evals vs. heartbeats"
    A [heartbeat](heartbeats.md) tells you the agent's worker process is **up**. An eval tells you the agent **behaves
    correctly**: it answers a chat message sensibly, its webhook returns the right data, or its schedule is still running.

---

## Eval types

| Type | What it does | Use it to check |
|---|---|---|
| **Chat** | Sends a message to the activation's chat workflow and checks the reply | The agent answers, and the answer contains (or avoids) certain text |
| **Webhook** | Calls one of the agent's webhooks with a body you choose and checks the response | Integrations respond with the right status code, JSON and headers, fast enough |
| **Schedule** | Reads the state of one of the agent's [schedules](../concepts/scheduling.md) | The schedule still exists, isn't paused, and its last run succeeded |

Each eval belongs to a single **activation** and runs against that activation only.

### Chat

- **Message to send:** the text the eval sends, up to 4,000 characters.
- **Workflow:** leave it blank to use the activation's conversational workflow.

Eval messages come from a dedicated participant, `xians-health-check`, so they appear in their own conversation
thread and never mix with real users' conversations.

!!! tip "Chat evals call your LLM"
    Every chat eval run is a real conversation turn, with the token cost that comes with it. Choose the interval
    accordingly.

### Webhook

Agents receive webhooks in one of two ways (see [Webhooks](../concepts/webhook.md)), and a webhook eval can call
either one:

| Calls | Agent code | Fields |
|---|---|---|
| **Built-in webhook** (default) | `workflow.OnWebhook(...)` on a built-in workflow such as the Integrator | **Workflow** and **Webhook name** |
| **Update method** | A `[WorkflowUpdate]` handler on a custom workflow | **Workflow**, **Method** and optional **Query parameters** |

- The **Workflow** dropdown lists the agent's workflows.
- In built-in mode, **Webhook name** lists the names registered for the activation under **Settings → Connections →
  Webhooks**. You can also type a name the agent's handler accepts.
- In update mode, **Method** lists the update handlers of the activation's running workflow.
- **Body** is sent as-is (up to 32 KB). **Expected status code** defaults to `200`.
- **Max response time** (milliseconds, optional) fails the eval when the agent is slower than this.

!!! tip "Give your agent a health endpoint"
    Add a cheap, side-effect-free webhook, such as `health-ping`, for evals to call. An eval that calls a real webhook
    (e.g. `github-push`) runs that webhook's logic every time.

### Schedule

- **Schedule:** choose one of the agent's schedules.
- **Require last run to succeed:** when this is on, a failed latest run fails the eval.

A schedule eval only reads the schedule's state and history. It **never triggers the schedule**, so it can't send
emails or do any other work the schedule does.

---

## Checks

Chat and webhook evals can have up to 10 checks. A run passes only when **every** check passes. With no checks, any
reply (chat) or any successful response (webhook) passes.

| Check | Example | Passes when | Eval types |
|---|---|---|---|
| **Contains** | `order confirmed` | The response contains the text (not case-sensitive) | Chat, webhook |
| **Does not contain** | `error` | The response doesn't contain the text (not case-sensitive) | Chat, webhook |
| **JSON equals** | `$.status` = `ok` | The JSON value at the path equals the value. Text must match exactly; numbers compare by value (`3` = `3.0`) | Webhook |
| **JSON exists** | `$.data.items[0]` | The path exists in the JSON response | Webhook |
| **Header equals** | `Content-Type` = `application/json` | The response header has that value (not case-sensitive) | Webhook |
| **Header exists** | `X-Request-Id` | The response has that header | Webhook |

JSON paths start with `$` and use `.name` and `[index]` steps, for example `$.status`, `$.data.user.id` or
`$.items[0].name`. Wildcards and filters aren't supported.

---

## Results

| Result | Meaning | Typical causes |
|---|---|---|
| **Pass** | Every check passed | — |
| **Fail** | The agent answered, but the answer was wrong | A check didn't pass, wrong status code, too slow, schedule paused or its last run failed |
| **Error** | No answer could be obtained | Timeout, the agent's worker isn't running, workflow or handler not found |

The difference matters: **fail** means the agent is up but misbehaving, while **error** usually means it's down or
misconfigured.

Each eval card shows its latest result, when it last passed, and how many runs in a row have failed. **Run history**
lists every run, newest first. Expand a run to see each check's result, the value that came back for failed checks
(e.g. *got "degraded"*), and the start of the response. You can filter the history to failed or errored runs.

Run history is kept for **30 days** by default (see [Server configuration](#server-configuration)).

---

## Email notifications

Under **Notify on failure**, choose who gets an email when the eval breaks. You can pick up to 10 of the tenant's
contacts, which are managed in **Tenant Settings → Contacts**.

Contacts are emailed when the eval **changes state**, not after every failed run:

| Previous result | This run | Email |
|---|---|---|
| Passing, or never run | Fail or error | **Eval failing**: the result, the failure detail and the start of the response |
| Fail or error | Pass | **Eval recovered**: how many runs failed in a row |
| Fail or error | Fail or error | None: the eval is still broken |
| Passing | Pass | None |

- Each contact gets their own email, so recipients don't see each other's addresses.
- Emails are sent through the tenant's email server (**Tenant Settings → Email**), or the platform default. If neither
  is set up, nothing is sent and the eval form warns you.
- A contact who has been deleted no longer gets emails, and is removed from the eval the next time it's saved.

---

## When evals run

- An eval runs every **interval** you choose: at least 5 minutes, at most 24 hours. Intervals line up with the
  clock, so a 15-minute eval runs at about :00, :15, :30 and :45. Its first result can arrive before a full interval
  has passed.
- A run that's still in progress when the next one is due skips the next one. Missed runs (for example, while the
  server was down) are not replayed.
- **Disabled** evals keep their history but don't run.
- When an activation is **deactivated**, all its evals pause. When it's activated again, its enabled evals resume.
- Deleting an activation deletes its evals and their history.

---

## Permissions

Creating, editing, deleting and viewing evals needs the `tenant.healthChecks.manage` capability. By default only
**Tenant Admins** have it. Agent Studio also requires that you can edit the agent.

Eval runs execute as a system identity limited to the eval's own tenant.

---

## Server configuration

Evals run on the Xians server, which hosts a Temporal worker for them in the platform namespace. Each eval is a
Temporal schedule named `healthcheck:{tenantId}:{evalId}`.

```bash
HealthChecks__Enabled=true                    # false: creating and editing evals returns 503; reads and deletes still work
HealthChecks__TaskQueue=xians-server-health-checks
HealthChecks__MinIntervalMinutes=5            # can be raised, never lowered below 5
HealthChecks__MaxChecksPerActivation=20
HealthChecks__ReconcileIntervalMinutes=60     # how often schedules are re-synced with the database
```

**Run history retention.** Runs expire after 30 days by default. To change that, see [Data Retention](../server/data-retention.md):

```bash
MongoIndexes__agent_health_check_runs__health_check_run_ttl__ExpireAfter=60d
```

**Email.** Notifications need an SMTP server: the platform default (`Email__Smtp__*` settings) or the tenant's own,
set under **Tenant Settings → Email**. For local development, [Mailpit](https://mailpit.axllent.org/) works well:

```bash
docker run -d --name=mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

```bash
Email__Smtp__Host=localhost
Email__Smtp__Port=1025
Email__Smtp__Security=None
Email__Smtp__SenderEmail=noreply@xians.local
```

Emails then appear at `http://localhost:8025`.

!!! tip "Testing an eval right away"
    Instead of waiting for the next interval, trigger the eval's schedule from the Temporal CLI:
    `temporal schedule trigger --schedule-id "healthcheck:<tenantId>:<evalId>"`

---

## Admin API

Everything in the Evals page is also available through the Admin API, under
`/api/v1/admin/tenants/{tenantId}/agentActivations/{activationId}/health-checks`:

| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/` | List or create evals |
| `GET` / `PUT` / `DELETE` | `/{checkId}` | Read, replace or delete an eval |
| `GET` | `/{checkId}/runs` | Run history (paged; filter by `status`, `from`, `to`) |
| `GET` | `/summary` | The activation's overall health: `healthy`, `degraded`, `unhealthy` or `unknown` |
| `GET` | `/webhook-targets` | The agent's workflows, update methods and registered built-in webhooks |

`GET /api/v1/admin/tenants/{tenantId}/health-checks?status=fail,error` lists every broken eval in the tenant.

In the API, evals are called **health checks**. The full request and response schemas are in the server's OpenAPI
docs at `/api-docs`.

---

## Limitations

- Webhook evals call the agent directly. They don't go through the public HTTP endpoint, so they don't test URLs,
  API keys or rate limits.
- Built-in webhook evals don't send query parameters or HTTP headers.
- Checks are deterministic text, JSON and header comparisons. There are no regular expressions and no LLM-graded
  checks.
- Notifications are email only.
