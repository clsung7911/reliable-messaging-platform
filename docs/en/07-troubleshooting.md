# Troubleshooting Records

These are not copies of internal incident reports. Real names, addresses, logs, and settings are removed while the investigation order and decisions remain. I do not claim a root cause that was not verified.

## 1. Token-refresh latency propagated into FCM-send 504s

### Symptom

Sending was healthy just after restart, but 504s appeared and increased as the access-token expiry window approached.

### Initial checks

- Nginx timeout,
- Redis lookup latency,
- FCM service errors,
- device-token validity,
- external network behavior.

When the symptom did not decide among them, I instrumented stage timing.

### Verified cause

The FCM call itself was normal, but external OAuth access-token issuance before it was slow. Because refresh ran inside the send request, OAuth latency propagated from the common API back through the integration API and Java/data handoff into the upstream timeout. Concurrent callers could also amplify refresh load at expiry.

### Changes

1. Store the FCM access token in Redis.
2. Separate normal sending from proactive refresh.
3. Stagger refresh timing between the two common API instances.
4. Share the in-flight promise inside each process.
5. Coordinate refresh across instances with Redis.
6. Add startup checks, scheduled refresh, expiry monitoring, and emergency recovery.

OAuth failures did not disappear, but a valid cached token reduced propagation into live sends.

## 2. Refresh failures rose again despite application protection

### Symptom

External OAuth timeouts rose above their normal level. Consecutive failures began to threaten actual access-token expiry even though refresh protection was already deployed.

### Investigation path

```text
common API container
→ internal proxy path
→ web tier
→ external OAuth
```

I repeated the same request from host and container boundaries. Successful responses and timeouts cut off at a consistent earlier limit formed two distinct groups, and the HTTP 504 was created before the application timeout.

### Verified cause

An outbound-policy change made the container-to-OAuth path unreliable.

### Ownership kept separate

- My work: stage-by-stage investigation and application changes for retry, cached-token retention, monitoring, and operator recovery.
- Network team's work: correct the outbound policy.

The first absorbed impact; the second removed the cause. I do not merge both into my ownership.

## 3. Two instances wrote into the same log file

### Symptom

Aggregates from common API A and B were almost identical and contradicted the expected execution timing.

### Investigation

I compared file sizes, hashes, and instance-specific log characteristics. The two exports were effectively the same data, and corruption was present.

### Verified cause and change

Both containers wrote concurrently to the same file on shared storage.

- separate paths by instance,
- add an instance identifier to every log line,
- roll the change one instance at a time.

The lasting rule was to verify the evidence path before adding more code hypotheses when logs contradict the architecture.

## 4. Common API did not recover after Redis became available

### Symptom

After scheduled server work, both common API processes were running while send-related requests continued to return 503. Redis operations reported a closed connection.

### Verified cause

The common API started before Redis, failed its initial connection, and the Redis client stopped reconnecting after a limited number of attempts. Redis later became healthy, but the application-side connection remained closed. Restarting the common API restored it immediately.

### Change and current public claim

- separate fast failure for individual Redis commands from connection retry,
- keep reconnecting with bounded backoff,
- log `connect`, `ready`, `close`, `reconnecting`, and `end` separately.

The source record confirms the code change and development validation. This repository does not claim that production rollout and a real restart reproduction had already completed.

## Investigation rules I kept

1. Do not treat the symptom as the cause.
2. Split end-to-end time into stages.
3. When both instances fail, inspect shared dependencies.
4. Separate application mitigation from infrastructure root-cause repair.
5. Verify log and metric collection when evidence contradicts the known flow.
6. Leave an unverified cause as `unknown`.
