# FCM Reliability Refactoring v1 — Rethinking Failure and Retry

## Why I changed it

I did not start by replacing the architecture. Reviewing incidents and the existing code showed a more immediate problem: different failure meanings were being collapsed into one failure path.

The refactoring therefore kept the existing service boundaries and changed the semantics around:

- clear pre-send failure,
- ambiguous delivery after a request starts,
- UNREGISTERED token lifecycle,
- provider outcome vs logging/state side effects,
- retry decisions across services,
- `messageId` correlation,
- Push resource isolation.

## Before

```text
business service
→ Java async event / HTTP
→ integration API
→ recipient/state lookup
→ common API
→ FCM
→ result + logging / Redis post-processing
```

The system already had async events, Redis-backed token handling, `messageId`, parallel sends, and UNREGISTERED rechecks.

## Main decisions

1. Outcomes: `accepted / skipped_unregistered / delivery_unknown / failed`.
2. Track whether the FCM request actually started.
3. Do not automatically retry timeout/502/504.
4. Confirm UNREGISTERED twice before deactivation.
5. Finalize provider outcome before logging/Redis post-processing.
6. Let the common API define typed result semantics.
7. Keep the same `messageId` across retries and propagate `X-Message-Id`.
8. Keep the existing Java async flow and isolate Push executor/HTTP resources.
9. Separate Redis command failure from connection recovery.

## After

```text
Java async event
→ Push-specific executor / HTTP client
→ integration API
   ├─ preserve messageId
   ├─ consume typed outcome
   └─ enqueue only clear retryable failures
→ common API
   ├─ pre/post request failure boundary
   ├─ accepted / skipped / delivery_unknown / failed
   ├─ bounded retry
   ├─ UNREGISTERED confirmation
   └─ post-processing after outcome finalization
→ outbound path
→ FCM
```

This is an evolution of the existing system, not a replacement architecture.

## Validation status

```text
Code Changes                  COMPLETE
Redis reconnect DEV           VALIDATED
Overall Refactoring DEV E2E   PENDING
Development Deployment        PENDING
Production Deployment         PENDING
Production Validation         PENDING
```

The current public claim stops at implemented code and the separately DEV-validated Redis reconnect change. Operational effect is not yet claimed.
