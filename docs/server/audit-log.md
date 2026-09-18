# Audit Log

The server records a durable **who / what / when** row for every domain event — the same events that [outbound webhooks](outbound-webhooks.md) deliver. Writes are best-effort and happen in the background, so they never delay or fail the originating API call.

High-volume telemetry (conversation messages, agent logs, metrics, heartbeats) is **not** audited.

## Who is recorded

Each row stores two identities from the request:

| Field | Meaning |
|-------|---------|
| `logged_in_user` | Authenticated credential: the OIDC user, or the **API-key owner**. |
| `participant_id` | The person the action is attributed to. Defaults to `logged_in_user`. |
| `action` | Event type (for example `agent.access.changed`). Same values as [webhook events](outbound-webhooks.md#supported-events). |
| `details` | Event payload (ids and names, never secrets). |
| `tenant_id` | Owning tenant, or `__platform__` for platform-scoped actions. |
| `created_at` | When the row was built. |

### `X-On-Behalf-Of` (Admin API)

Admin API calls authenticate with a shared API key, so `logged_in_user` is the key owner — not the human in Agent Studio. Trusted clients should send the signed-in UI user on **Admin API** requests only:

```http
Authorization: Bearer sk-Xnai-...
X-On-Behalf-Of: auth0|64f2ab...
```

A valid value is stored as `participant_id`. The header is **attribution, not impersonation**: it does not change authorization. Omit it when there is no UI user. Invalid or empty values are ignored (max 200 characters).

Do **not** send this header on Web API requests that already carry the user's OIDC token.

!!! note "Webhooks vs audit log"
    Webhook `actor.userId` is still the authenticated credential (`logged_in_user`). The UI user appears only on the audit row's `participant_id`.

## Tenant vs platform

- **Tenant events** (agent access, activations, secrets, …) are stamped with the customer tenant. Tenant admins can list them.
- **Platform events** (bootstrap, SysAdmin grant/revoke, global user edits, system template changes) are stamped `__platform__` so tenant admins cannot see them. Only SysAdmins can list those rows.

`__platform__` is reserved and cannot be used as a real tenant id.

## Reading the log

Admin API, API-key auth:

| Scope | Endpoint |
|-------|----------|
| Tenant | `GET /api/v1/admin/tenants/{tenantId}/audit-logs` |
| Platform (SysAdmin) | `GET /api/v1/admin/platform/audit-logs` |

Query params: `performedBy` (matches `participant_id`), `activationName`, `onlyWithoutActivation`, `startDate`, `endDate`, `page`, `pageSize` (max 100). Companion routes `/performed-by` and `/activation-names` return distinct filter values.
