# Lessons and Limitations

## Lessons from operating and refactoring the system

### Failure and unknown delivery are different

A timeout or 502/504 does not prove that a provider request never arrived.

```text
confirmed failure
≠
delivery unknown
```

### Retry is not only a success-rate feature

Retry can recover a transient failure, but it can also duplicate a message that was already accepted. Duplicate-delivery risk is part of the retry decision.

### Observability failure and transport outcome are different domains

A PushLog or Redis write failure must not overturn a provider outcome and trigger another send.

### Async does not automatically isolate blast radius

The Java Push path was already asynchronous. The refactoring kept that flow and isolated a Push-specific executor and HTTP client instead of claiming a synchronous-to-asynchronous rewrite.

### CODE COMPLETE is not PROD VALIDATED

```text
Code Changes                  COMPLETE
Redis reconnect DEV           VALIDATED
Overall Refactoring DEV E2E   PENDING
Production Deployment         PENDING
Production Validation         PENDING
```

## Trade-offs

- `delivery_unknown` may leave some truly undelivered transient failures unretried.
- Executor saturation can reject Push work.
- Separating outcome and post-processing can temporarily leave provider and internal state inconsistent.
- `messageId` improves correlation but is not exactly-once delivery.

## Current limitations

- Flutter display is not proven by FCM acceptance.
- Real routes, keys, thresholds, retry counts, and topology are withheld.
- The current refactoring has not completed overall DEV or production validation.
- The external root cause of timeout/502/504 remains `UNKNOWN / PENDING`.
