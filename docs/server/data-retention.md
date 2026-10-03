# Data Retention

`XiansAi.Server` removes short-lived data automatically using MongoDB TTL indexes. Retention windows ship with sensible defaults and can be changed per deployment with environment variables, without editing `mongodb-indexes.yaml`.

All durations use the same format everywhere: one or more `<number><unit>` parts, where the unit is `s`, `m`, `h`, `d` or `w`.

| Valid | Invalid |
|-------|---------|
| `30d` | `30 days` (use `30d`) |
| `12h` | `12hours` (use `12h`) |
| `5d 6h` or `5d6h` | `5d,6h` (only whitespace may separate parts) |
| `1w 2d 12h 30m` | `-5d`, `5` (a unit is required, negatives are not allowed) |

The total must not exceed `int.MaxValue` seconds (about 68 years). Values are read once at startup, so changes take effect on the next restart.

## Fixed-duration indexes

For these collections, documents expire a fixed time after their timestamp. Override the duration with:

```
MongoIndexes__{collection}__{index_name}__ExpireAfter=<duration>
```

| Environment variable | Default |
|---|---|
| `MongoIndexes__logs__logs_ttl_created_at__ExpireAfter` | `15d` |
| `MongoIndexes__usage_metrics__usage_metrics_ttl__ExpireAfter` | `90d` |
| `MongoIndexes__webhook_deliveries__webhook_delivery_ttl__ExpireAfter` | `15d` |

```bash
MongoIndexes__logs__logs_ttl_created_at__ExpireAfter=30d
MongoIndexes__usage_metrics__usage_metrics_ttl__ExpireAfter=1w 2d
```

- **Unset or empty:** the default is used.
- **Invalid value:** a warning is logged and the default is used.
- **Changing the value** drops and recreates the index with the new duration on the next restart.
- **Removing the variable** reverts to the default, which recreates the index again.

!!! warning "The new duration applies to existing documents"
    Shortening a duration deletes older documents shortly after the restart. Lengthening it does not bring back documents that were already deleted.

!!! warning "No minimum value"
    `0s` expires every document. Whoever sets the variable is responsible for choosing a safe value.

!!! note "Cosmos DB"
    On Cosmos DB the server does not modify existing indexes, so an override only takes effect when the index is first created.

## Conversation message retention

Conversation messages expire at an `expires_at` timestamp stored on each message when it is saved. Because the window is stamped per message, it is configured in the server rather than on the index.

| Environment variable | Applies to | Default |
|---|---|---|
| `Messaging__HeartbeatRetention` | Heartbeat messages (incoming and outgoing) | `1h` |
| `Messaging__MessageRetention` | All other messages | `180d` |

```bash
Messaging__HeartbeatRetention=30m
Messaging__MessageRetention=90d
```

Unset, empty or invalid values use the default (an invalid value also logs a warning).

!!! warning "Only new messages are affected"
    Existing messages keep the `expires_at` they were given. Lowering `Messaging__MessageRetention` (for example from `180d` to `30d`) does not delete existing messages sooner, and raising it does not extend messages that already carry an earlier `expires_at`. There is no automatic backfill. Shortening retention for existing data requires a one-off manual update of `expires_at`.

- No index change is involved, so there is no index rebuild.
- Documents in the [Document DB](../concepts/document-db.md) work the same way: `expires_at` is set when the document is saved.
- Feedback copies of a message keep the expiry of the message they were copied from.

## Not overridable

Indexes defined with `expire_after: 0s` (`conversation_message_ttl`, `documents_ttl`) expire documents at their own `expires_at` timestamp, so overriding them with `MongoIndexes__...__ExpireAfter` is not supported. Use the settings in [Conversation message retention](#conversation-message-retention) instead.

## See also

- [Server logging retention](../concepts/logging.md) for how agent logs are batched and stored.
- [Server installation](installation.md) for how environment variables map to configuration.
- [Indexes and TTL guide](https://github.com/XiansAiPlatform/XiansAi.Server/blob/main/XiansAi.Server.Src/docs/INDEXES_AND_TTL.md) on GitHub for contributors adding new indexes.
