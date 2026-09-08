# NestJS Experience-Faithful Example

This is a small public example of the NestJS server-side direction described in the documents.

```text
Java integration process
  → IntegrationMessagingApiService
      ↔ RedisStateService (recipient / delivery state)
      → CommonApiService
          ↔ AccessTokenService / RedisStateService
          → FcmClient
```

In the real system, the integration API and common API are separate HTTP service boundaries and the common API runs as two instances. This example uses direct TypeScript calls only to keep the sample small; it preserves the **direction of responsibility**, not the production transport.

It is not copied from production source. Real controllers, routes, database entities, Redis keys, credentials, timing values, network paths, and payload fields are omitted.

## Files

```text
src/
├─ contracts.ts
├─ integration-messaging-api.service.ts
├─ common-api.service.ts
├─ redis-state.service.ts
├─ access-token.service.ts
└─ fcm-client.ts
```

The example reflects code-level decisions from the current refactoring:

- keep the same `messageId` through the call chain,
- let the integration side own recipient/delivery-state handling,
- let the common API own the provider outcome semantics,
- classify `accepted / skipped_unregistered / delivery_unknown / failed`,
- do not automatically treat timeout/502/504 as a safe retry,
- confirm FCM `UNREGISTERED` once before logical deactivation,
- keep access-token refresh outside normal sending.

The Java Push executor/HTTP-client isolation is documented in the architecture notes but is intentionally not modeled inside this NestJS-only example.

**Validation note:** this example mirrors the current code-level design. It is not evidence that the full refactoring has completed DEV E2E or production validation.

Run `npm install` and `npm run typecheck` to check the sample.
