# Keep Short-Lived Shared State in Redis

## Context

The common API ran as two instances, and sending and token refresh needed state visible to more than one process.

## Decision

Use Redis for:

- the FCM access token,
- badge / recipient state,
- delivery status by `messageId`,
- access-token refresh coordination.

This was not an attempt to turn Redis into a message broker. It kept short-lived operational state requiring fast shared access.

## Trade-offs

- Redis connection health affects actual send capability.
- Process health and Redis readiness must be checked separately.
- Lock expiry must remain valid for the work it protects.
- Keys, TTLs, failure behavior, and monitoring require deliberate policy.

## Disclosure

Real keys, hosts, TTLs, lock timing, badge rules, and recipient identifiers are not published.
