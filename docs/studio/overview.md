# Agent Studio

## What Agent Studio Is

Agent Studio is the **web console** for the XiansAi platform — the place where humans (rather than SDK code) configure, observe, and operate the agents your team has deployed. It sits in front of the same APIs your agents use, so anything you do in the Studio is just a UI on top of the platform's tenant-scoped, certificate-authenticated services.

If the SDK is how agents *act*, the Studio is how people *manage*.

!!! info "Setting up a new server?"
    If this is a **fresh XiansAi Server installation**, stand up Agent Studio first by following the [Installation guide](installation.md). It covers configuring the `.env` file, running locally from source, and deploying the published DockerHub image. Once the Studio is running and you've signed in, the rest of this page explains how to operate it.

## Studio Roles

Access to Agent Studio is governed by **five** roles. Four are tenant-scoped (assigned per tenant); the fifth is a platform-wide flag assigned independently.

| Role | Display Name | Scope | What they can do | Typical user |
| --- | --- | --- | --- | --- |
| **TenantParticipant** | Participant | Per tenant | Engage with agents — converse with them and complete Human-in-the-Loop (HITL) tasks assigned to them. No configuration access and no admin sidebar. | Business users, end customers |
| **TenantParticipantAdmin** | Participant Admin | Per tenant | Everything a Participant can do, **plus** full access to agent-level operations: Agent Store, Knowledge Base, Data Explorer, Connections, Schedules, Performance, Activity Logs, and Secrets. Cannot manage tenant users. | Agent operators, ops leads |
| **TenantUser** | Developer | Per tenant | Same agent-level access as Participant Admin, plus access to the **Developer** area (API keys). Intended for developers building on the platform. | Developers, integrators |
| **TenantAdmin** | Tenant Admin | Per tenant | Everything a Developer can do, **plus** user management: invite/remove tenant users and configure Tenant Admin settings (Branding, OIDC Providers). | Tenant owner, platform admin |
| **SysAdmin** | System Admin | Platform-wide (global flag) | All capabilities across every tenant: system-wide tenant and user management, and every agent-level and admin capability in any tenant. Independent of tenant roles — a SysAdmin is not automatically a participant in any tenant. | Platform operators, infrastructure admins |

A user can simultaneously be a `TenantAdmin` in one tenant, a `TenantParticipant` in another, and a `SysAdmin` across the whole platform — the roles are evaluated independently.

### What each role can access

| Area | TenantParticipant | TenantParticipantAdmin | TenantUser | TenantAdmin | SysAdmin |
| --- | :---: | :---: | :---: | :---: | :---: |
| Conversations & Tasks | ✓ | ✓ | ✓ | ✓ | ✓ |
| Agent Settings (Store, Knowledge, Data, Connections, Schedules, Performance, Logs, Secrets) | — | ✓ | ✓ | ✓ | ✓ |
| Developer area (API keys) | — | — | ✓ | ✓ | ✓ |
| Tenant Admin (Users, Branding, OIDC) | — | — | — | ✓ | ✓ |
| System Admin (Tenants, Users) | — | — | — | — | ✓ |

## What's Next?

- **[Making Agents Descriptive](agent-descriptors.md)** — fill in registration fields so operators and other agents can discover and understand your agent
- **[Tool & Reasoning Logs](tool-reasoning-logs.md)** — emit live thinking and tool-call events into the chat timeline
- **[Tenant Theme](tenant-theme.md)** — customize the color scheme and logo for your tenant
- **[Tenant OIDC Providers](oidc-providers.md)** — configure per-tenant identity provider rules
- **[Heartbeats](heartbeats.md)** — monitor agent liveness and act on missed heartbeats
- **[Operating Context](../concepts/context.md)** — what tenant, agent, and participant identity the Studio uses everywhere
- **[Multitenancy](../concepts/multitenancy.md)** — how tenant isolation works under the Studio
- **[Logging](../concepts/logging.md)** — what gets surfaced in the Studio's log views

---

**Bottom line**: Agent Studio is the human-facing operating layer over the same APIs your agents speak. Roles gate access, descriptors make agents findable, tool logs make runs auditable, themes make the platform yours, and heartbeats tell you what's actually alive.
