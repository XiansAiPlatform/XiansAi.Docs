# Introduction

Welcome to **Xians.ai** — the open source **Agent Control Plane (ACP)** for governing, monitoring, securing, and scaling fleets of AI agents in production.

## The Problem

Building an impressive agent demo takes a weekend. Taking it to production means solving a very different set of problems: serving many customers from one codebase with strict data isolation, running business processes that span days or weeks without losing state, letting humans review agent output before it ships, knowing what every agent did and what it cost, and deploying workers that security teams will actually approve.

None of that is AI logic. All of it is infrastructure — and every team building agents ends up rebuilding it.

## What is an Agent Control Plane?

An Agent Control Plane is a centralized platform that acts as a "control tower" for autonomous AI systems. Instead of reactive guardrails bolted onto individual agents, Xians provides **proactive, architectural control**: agents run as workers governed by the platform, which owns orchestration, tenancy, data, and visibility.

Xians sits *alongside* your agent framework — not replacing it. Build agents with any framework (Microsoft Agent Framework, LangChain, Semantic Kernel, or raw OpenAI SDK), then register them with Xians. Your code keeps deciding how the agent *thinks*; the control plane handles everything around it.

## What Xians Handles For You

| Function | What you get |
| -------- | ------------ |
| **Governance & Multi-Tenancy** | One agent template deployed to many tenants, complete data isolation, role-based access, per-tenant identity providers and branding |
| **Agent-User Collaboration** | Persistent conversations, proactive messaging, live progress streaming, file uploads — over WebSocket, SSE, and REST |
| **Business Process Automation** | Durable Temporal-backed workflows, scheduling, human-in-the-loop approvals, cross-agent orchestration, webhooks |
| **Channels & Integrations** | Slack and Microsoft Teams out of the box, outbound event webhooks, TypeScript SDK and HTTP APIs for custom UIs |
| **Knowledge & Data** | Centralized prompt/knowledge management editable without redeployment, tenant-scoped document storage, encrypted secret vault |
| **Visibility & Monitoring** | Metrics with per-tenant cost attribution, searchable logs, tool & reasoning timelines, heartbeats, audit trails |
| **Scalability & Security** | Linear horizontal scaling, workers in private subnets with no incoming ports, message encryption at rest, certificate-based agent auth |

## Where to Next

| Page | Description |
| ---- | ----------- |
| [Architecture](where-does-it-fit.md) | How Xians fits into your system — components, layered view, and the pull-based worker model |
| [Features](features.md) | The full feature catalog, with a hands-on guide linked for every capability |
| [Getting Started](../getting-started/installation.md) | Install the platform and run your first governed agent in minutes |
