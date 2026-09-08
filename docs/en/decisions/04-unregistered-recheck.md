# Confirm `UNREGISTERED` Before Deactivation

## Context

FCM `UNREGISTERED` indicates a device token that is no longer usable. Keeping it causes repeated failures, while immediate deletion after one response risks deactivating a valid token after a transient anomaly.

## Decision

Confirm the same send once after the first `UNREGISTERED`.

- confirmation succeeds: `delivered`,
- confirmation returns a different error: keep the token and record `failed`,
- confirmation is also `UNREGISTERED`: logically deactivate the token and record `skipped`.

A confirmed invalid token is classified as non-retryable in the sender layer. A known gap remains in the upper retry queue, where incomplete status branching can still re-queue it within the bounded retry path.

## Trade-offs

- One extra FCM call is made for an invalid-token candidate.
- Deactivation is slower than immediate handling.
- The server state must be considered together with client token re-registration.

## Disclosure

The real confirmation delay, database fields, internal status codes, and device identifiers are not published.
