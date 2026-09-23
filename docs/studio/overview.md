# Agent Studio

The activation **Connections** page provides the URL for connecting MCP-compatible clients to the platform. See [Xians MCP](../server/xians-mcp.md).

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
| **TenantParticipantAdmin** | Participant Admin | Per tenant | Everything a Participant can do, **plus** access to agent-level settings. With no per-agent grant, they get write-level access by role; an explicit Read/Write/Owner grant overrides that (see Per-agent access). Cannot manage tenant users. | Agent operators, ops leads |
| **TenantUser** | Developer | Per tenant | Same agent-edit defaults as Participant Admin, plus the **Developer** area (API keys). | Developers, integrators |
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

### Per-agent access

Beyond the tenant roles above, each agent can carry **explicit** Read / Write /
Owner grants. Tenant role decides whether you can open Agent Settings;
**per-agent level** (or the role default when none is set) decides what you can
do on a specific agent. The person who registers an agent is added as its first
Owner.

#### Access levels

| Level | What it allows |
| --- | --- |
| **Read** | See and use the agent (for example conversations). Not enough to edit Knowledge, Data, Schedules, Connections, or other agent configuration. |
| **Write** | Everything Read allows, **plus** edit that agent's knowledge, schedules, connections, data, and related configuration. |
| **Owner** | Everything Write allows, **plus** open **⋯ → Manage access** for this agent. |

#### Who can edit a given agent

| Role | When no per-agent grant | When an explicit grant exists |
| --- | --- | --- |
| **TenantParticipant** | No Agent Settings access | N/A (settings UI not available) |
| **TenantParticipantAdmin** (Participant Admin) | **Write**-level access (role default) | Grant wins: **Read** = no edit; **Write** / **Owner** = edit |
| **TenantUser** (Developer) | **Write**-level access (role default) | Same as Participant Admin |
| **TenantAdmin** | Full access (bypasses grants) | Full access (bypasses grants) |
| **SysAdmin** | Full access (bypasses grants) | Full access (bypasses grants) |

#### Manage access

Open **Agent Store** → an agent's **⋯ → Manage access**. The dialog lists **every
member of the tenant** (there is no separate "add user" control):

| Shown level | Meaning |
| --- | --- |
| Explicit **Read** / **Write** / **Owner** | A grant stored on this agent |
| **Write** with a **default** badge | No grant stored — Studio shows the role default (Write) |
| **Owner** with an **admin** badge | Tenant Admin / SysAdmin — always full access |

Change the dropdown to set or update an explicit grant. Removing an explicit
grant returns that person to the default **Write** display (for roles that use
the role default).

#### Who can open Manage access

| Actor | Can open Manage access? |
| --- | :---: |
| **Owner** of that agent | ✓ |
| **TenantAdmin** | ✓ |
| **SysAdmin** | ✓ |
| Participant Admin / Developer without Owner | — |
| Read or Write only | — |


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
