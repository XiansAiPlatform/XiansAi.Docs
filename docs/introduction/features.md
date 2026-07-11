# Agent Control Plane Features

**Xians** is the open source **Agent Control Plane (ACP)** for production AI agents. It sits *alongside* your agent framework — not replacing it — and handles everything that becomes painful once agents graduate from demos to production.

Build agents with any framework (Microsoft Agent Framework, LangChain, Semantic Kernel, raw OpenAI SDK), register them with Xians, and they gain the capabilities below. No changes to how your agents think — every feature links to a hands-on guide.

## Governance & Multi-Tenancy

Run one agent codebase for many customers, with complete isolation and central control.

- **[Multi-Tenancy](../concepts/multitenancy.md)** — Write an agent once as a *template*, deploy it per tenant. Conversations, documents, knowledge, and secrets are fully separated — no cross-tenant leakage, ever.
- **[Template-Based Deployment](../concepts/multitenancy.md)** — A three-phase lifecycle (register → deploy → activate) rolls agents out to any number of tenants from a single control point, each with their own prompts and configuration.
- **[Agent Registry](../studio/agent-descriptors.md)** — Every agent has a public face in Agent Studio: description, version, author, sample prompts. Operators managing 40 agents see more than a list of names.
- **[Per-Tenant OIDC](../studio/oidc-providers.md)** — Each tenant can bring its own identity provider and login rules, independent of the platform's global auth. Role-based access control (SysAdmin, Tenant Admin, users, participants) is enforced server-side.
- **[Tenant Branding](../studio/tenant-theme.md)** — Per-tenant logo and color theme across Agent Studio and the chat widget your participants see.

## Agent-User Collaboration

Rich, persistent conversations between humans and agents — the part every custom UI team ends up rebuilding from scratch.

- **[Conversation Memory](../getting-started/chat-history.md)** — All messages are stored automatically with isolation per tenant, agent, workflow, thread, and topic. Agents remember context across sessions without you writing a persistence layer.
- **[Replying](../concepts/messaging-replying.md)** — Handle incoming chat and structured data messages with a simple `context.ReplyAsync()` — text, data payloads, or both.
- **[Proactive Messaging](../concepts/messaging-proactive.md)** — Agents reach out on their own: an order shipped, a schedule fired, a background job finished. Any workflow can message any user at any time.
- **[Live Progress Streaming](../concepts/messaging-progress.md)** — Stream reasoning steps and tool calls to the user while the agent thinks, so they see "calling `getWeather(...)`" instead of a blinking cursor.
- **[File Uploads](../concepts/messaging-fileupload.md)** — Users attach files to conversations; agents receive typed file objects, with large files handled transparently by reference.
- **[Multiple Transports](https://github.com/XiansAiPlatform/sdk-web-typescript)** — WebSocket, Server-Sent Events, and REST APIs, with a TypeScript SDK for building custom frontends. Authenticate with API keys or OIDC/OAuth 2.0.

## Business Process Automation

Durable orchestration built on [Temporal](https://temporal.io) — processes that span minutes or months, and survive anything.

- **[Durable Workflows](../concepts/workflows.md)** — Fault-tolerant workflows with automatic retries, state persistence, and recovery. A customer onboarding flow can span weeks; a compliance process can run for a year.
- **[Scheduling](../concepts/scheduling.md)** — Cron, interval, and calendar schedules with timezone support and full lifecycle control (pause, resume, trigger). Agents can even create schedules from conversations.
- **[Human-in-the-Loop](../concepts/hitl-tasks.md)** — Agents create tasks with drafts, then pause — for hours or weeks — while a human reviews, edits, and approves. The workflow resumes with the feedback, every decision audit-trailed.
- **[Cross-Agent Workflows](../concepts/cross-agent-workflows.md)** — One agent's workflow delegates to another's — an invoicing agent calling a fraud-detection agent — with routing and activation targeting handled by the platform.
- **[Inbound Webhooks](../concepts/webhook.md)** — External systems trigger agent workflows over HTTP, with requests queued and processed asynchronously.

## Channels & Integrations

Meet users where they already are, and keep external systems in sync.

- **[Slack Integration](../server/slack-integration.md)** — Bidirectional Slack conversations with thread support — agents reply in the right channel and thread automatically.
- **[Microsoft Teams Integration](../server/teams-integration.md)** — Chat with agents from Teams via the Bot Framework, including adaptive cards.
- **[Outbound Event Webhooks](../server/outbound-webhooks.md)** — The platform notifies your systems of lifecycle events (user added, tenant created, agent deleted) with signed, durable, retried deliveries.
- **[HTTP User API](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/user-api/index.md)** — A complete REST surface for integrating agent conversations into any application.

## Knowledge & Data

Everything an agent needs to remember, configured centrally and scoped automatically.

- **[Knowledge Management](../concepts/knowledge.md)** — Prompts, instructions, and reference content stored centrally, editable by both code (SDK) and humans (Agent Studio). **Change agent behavior without redeployment.** Resolution falls back activation → tenant → system.
- **[Document DB](../concepts/document-db.md)** — Tenant-scoped JSON storage for agent state and memory: user preferences, session state, caches. Semantic keys, metadata queries, and TTL auto-cleanup — no database to run.
- **[Secret Vault](../concepts/secret-vault.md)** — Encrypted storage for API keys and credentials, scoped to tenant, agent, user, or activation. Pluggable backends including Azure Key Vault.

## Visibility & Monitoring

Know what your fleet is doing — technically and commercially.

- **[Metrics & Cost Tracking](../concepts/metrics.md)** — Track anything with automatic tenant/user/workflow attribution: LLM tokens per model, API calls, business outcomes like approvals and documents generated. Per-tenant cost attribution comes free.
- **[Logging](../concepts/logging.md)** — Dual console + server logging with workflow-aware, replay-safe loggers. Search by agent, tenant, workflow, and time in Agent Studio.
- **[Tool & Reasoning Logs](../studio/tool-reasoning-logs.md)** — A live timeline of what each agent did during a conversation turn — every reasoning step and tool call, visible in Studio.
- **[Heartbeats](../studio/heartbeats.md)** — Worker liveness monitoring in Studio plus on-demand workflow availability checks, so you know an agent is down before users do.
- **Audit Trails** — Every [workflow execution](../concepts/workflows.md) keeps a complete, immutable history of state transitions and decisions — invaluable for debugging and compliance.

## Scalability & Security

An architecture designed for the enterprise network diagram, not the demo laptop.

- **[Horizontal Scaling](../server/scaling.md)** — Spawn more agent containers and throughput scales linearly; Temporal balances the load automatically. No service discovery, no manual configuration.
- **[Subnet Isolation](where-does-it-fit.md)** — Workers run in private subnets with **no incoming ports** — they only make outbound connections to pull work. Minimal attack surface, simple firewall rules.
- **[Message Encryption](../server/encryption.md)** — All conversation messages are encrypted at rest with a dual-key scheme, aligned with EU AI Act data-protection requirements.
- **Certificate-Based Agent Auth** — Agents authenticate to the control plane with X.509 certificates carrying tenant identity — see [Server Bootstrapping](../server/bootstrapping.md).
- **[Fault Tolerance](../concepts/workflows.md)** — Automatic retries with backoff, configurable timeouts, and state recovery after crashes — at every step of every workflow.

## Developer Experience

Production infrastructure shouldn't cost you your inner loop.

- **[Framework Agnostic](../getting-started/tool-execution.md)** — Bring any agent framework and any LLM provider; mix stacks within the same control plane. Xians never dictates how your agents think.
- **[Predictable SDK](../concepts/sdk-patterns.md)** — One rule: every operation lives on its logical owner (reply on the message, knowledge on the agent, cross-cutting on the context). Guess where an API lives without reading docs.
- **[Unit Testing](../concepts/unit-tests.md)** — Local Mode plus Temporal's time-skipping test environment: a "wait 24 hours" workflow finishes in milliseconds, in CI, with no Docker and no servers.
- **[Quick Start](../getting-started/quick-start.md)** — From `dotnet new` to a running, governed agent in minutes.

---

## The Control Plane Advantage

**Not another agent framework.** Keep your agent code focused on AI logic; let the control plane handle multi-tenant governance, durable orchestration, scaling, monitoring, and data management — the complete infrastructure you need but would never want to build yourself.

Ready to see it running? [Install Xians](../getting-started/installation.md) and follow the [Quick Start](../getting-started/quick-start.md).
