# Use `messageId` as the End-to-End Identity

## Context

One send request crosses the legacy service, Java/data handoff, integration API, common API, Redis state, and FCM call. Per-service request IDs made it difficult to reconstruct the same send during an incident.

## Decision

Keep the business `messageId` across every boundary.

```text
Java/data handoff log
Integration API log
Common API log
Redis delivery status
FCM result
          ↑ same messageId
```

The value supports both log correlation and duplicate-request handling.

## Trade-offs

- Conflicting reuse of one `messageId` with a different payload must be rejected.
- Very old retries need a policy after state retention expires.
- The identifier must not be described as exactly-once delivery across FCM and the device.

## Disclosure

The real ID format and values are not published. The example shows only the field's role.
