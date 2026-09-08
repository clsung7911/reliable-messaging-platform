# Keep Short-Lived Shared State in Redis

## Context

The send path had both database-backed source data and short-lived operational state that more than one server process needed to share. Treating them as one generic store would no longer match the system I worked with.

## Decision

Recipient and device-token lookup stays in a DB repository. Redis holds only:

- the FCM access token,
- badge state,
- delivery status by `messageId`,
- access-token refresh coordination.

Redis was not used as a message broker or recipient database. It was used for short-lived state requiring fast shared access.

## Trade-offs

- Redis connection health affects actual send capability.
- Process health and Redis readiness must be checked separately.
- Lock expiry must remain valid for the refresh work it protects.
- Keys, TTLs, failure behavior, and monitoring require deliberate policy.

## Disclosure

Real keys, hosts, TTLs, lock timing, and badge rules are not published. User/device identifiers and the database structure are also withheld.
