# Monitoring and Logs

## HTTP status did not locate the problem

A 504 initially looked like an Nginx problem. Timing later showed that the real bottleneck was external OAuth token refresh before the FCM call. After that incident, I started with **which stage became slow**, not only whether the send API failed.

## Values separated in operation

### Send results

```text
queued
delivered
failed
skipped
```

Policy-based skips were kept separate from actual send failures when interpreting the success rate.

### Stage timing

- integration API request to common API send result,
- DB recipient / device-token lookup,
- Redis badge and delivery-state lookup,
- FCM access-token read or refresh,
- FCM API call,
- Redis result update.

One total duration only says that messaging is slow. Stage timing separates OAuth, FCM, and Redis as investigation branches.

### Token-refresh state

- access-token availability and remaining lifetime,
- scheduled refresh execution, success, and failure,
- consecutive failures and emergency recovery,
- refresh timing on both instances,
- Redis-based coordination result.

Repeated refresh failures can move the token toward expiry while sends still succeed. Token health therefore had its own view.

## Correlation with `messageId`

Logs kept operational context rather than sensitive payloads:

```text
messageId
instance
stage
result
duration
retry flag
dependency
```

This allowed the Java/data handoff, integration API, common API, DB lookup, Redis state, and FCM result to be reconstructed as one flow. Device tokens, user identifiers, access tokens, and sensitive payloads are excluded.

## Grafana and Loki

Grafana was used for delivery results, stage timing, access-token state, and refresh outcomes. Loki was used to narrow logs by `messageId` and instance.

The investigation order mattered more than the tool names:

```text
is queued volume normal?
→ which of delivered / failed / skipped changed?
→ which stage became slower?
→ what changed in Redis / OAuth / FCM?
→ do these messageId and instance logs represent the right execution?
```

## When the logs themselves were wrong

Logs exported for the two common API instances were suspiciously identical. Byte-level checks showed that both containers were writing to the same file on shared storage. Execution data was mixed, and concurrent writes could corrupt content.

I changed the following:

- separate paths per instance,
- an instance identifier on every log event,
- rolling application one instance at a time,
- verification of the collection path when evidence conflicts with the known architecture.

The incident changed how I treat logs: they are evidence only when their generation, storage, and collection path are trustworthy.

## Process state versus capability state

After a server restart, the common API process was running but its Redis connection did not recover, so sending requests continued to fail.

I now separate:

```text
process running
Redis ready
valid FCM access token available
external OAuth reachable
FCM reachable
```

A single `UP` status does not identify what an operator needs to recover.

## Monitoring principle

> The goal is not to produce many metrics. The system should tell the operator where to look next.

Real metric names, dashboard addresses, organization/site labels, and alert thresholds are not published.
