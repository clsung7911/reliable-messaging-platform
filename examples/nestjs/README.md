# NestJS Experience-Faithful Example

This is a small public example of the server-side boundaries described in the documents.

```text
Java / data handoff
  → IntegrationMessagingApiService
      → RecipientRepository (DB lookup)
      ↔ RedisStateService (badge / delivery status)
      → CommonApiService (two deployed instances in the real structure)
          ↔ AccessTokenService / RedisStateService
          → FcmClient
```

It is not copied from production source. Real controllers, routes, database entities, Redis keys, credentials, timing values, and payload fields are omitted.

## Files

```text
src/
├─ contracts.ts
├─ integration-messaging-api.service.ts
├─ recipient.repository.ts
├─ common-api.service.ts
├─ redis-state.service.ts
├─ access-token.service.ts
└─ fcm-client.ts
```

The example keeps only behaviors that existed in the experience described by this repository:

- preserve the actual service direction: integration API → common API → FCM,
- look up recipient/device-token data through a DB repository,
- keep access token, badge state, delivery status, and refresh coordination in Redis,
- propagate `messageId` and use it for duplicate handling,
- process a batch with `Promise.allSettled`,
- use a cached access token for normal sends,
- coordinate token refresh inside a process and across the two common API instances,
- confirm FCM `UNREGISTERED` once before logical deactivation and sender-level `skipped` classification.

The real system also has a **known gap above this sender path**: the upper retry queue does not yet branch completely on the confirmed `UNREGISTERED` status, so a deactivated token can still be re-queued within the bounded retry path. This example intentionally stops at the sender classification rather than pretending that gap has already been removed.

Run `npm install` and `npm run typecheck` to check the example. The in-memory bodies are public placeholders for DB, Redis, and FCM; they are not production-ready implementations.
