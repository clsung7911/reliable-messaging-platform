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

## Development validation — 2026-09-09

The refactored services were deployed to the development environment and a normal-path Push smoke test was executed through the real service boundaries.

Verified in DEV:

- Java business service deployment: PASS
- integration API deployment: PASS
- common API deployment: PASS
- normal Push E2E: PASS
- `messageId` correlation: PASS
- normal FCM response → `accepted`: PASS
- Redis `delivering → delivered`: PASS
- normal success path `retryable=false`: PASS
- normal success path `deliveryUnknown=false`: PASS
- two consecutive normal sends: PASS

This validates the normal delivery path and normal result contract. It does not validate every failure branch such as `delivery_unknown=true`, retryable failures, UNREGISTERED rechecks, post-processing failure injection, or executor saturation.

## Validation status

```text
Code Changes                  COMPLETE
Development Deployment        COMPLETE
Normal Push E2E Smoke Test     PASS
Redis reconnect DEV           VALIDATED
Failure-path DEV Validation    PENDING
Production Deployment         PENDING
Production Validation         PENDING
```

The current public claim stops at implemented code plus the DEV-validated normal delivery path and Redis reconnect behavior. Production effect is not yet claimed.
