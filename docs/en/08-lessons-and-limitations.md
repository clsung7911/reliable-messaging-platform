# Lessons and Limitations

## Conclusions from operating the system

### 1. State around the FCM call was harder than the call itself

Access-token expiry, refresh competition across two instances, invalid device tokens, partial failures, and log correlation consumed more operational work than the provider request.

### 2. A cache and a refresh design are different

Redis storage did not solve concurrent refresh at expiry or recovery after a failed refresh. The design also needed an owner, retry timing, cached-token retention, and a recovery path.

### 3. Two instances require more than two running processes

Refresh coordination, Redis connection state, per-instance logs, and scheduled work all had to be observed by instance.

### 4. Separating failure states changes incident questions

After separating `failed` and `skipped`, the first question could become “is a dependency slow, or did invalid devices increase?” instead of one undifferentiated failure-rate question.

### 5. Operational evidence must be verified

The shared-log-file incident showed that a broken collection path can make correct code look wrong.

## Why Redis fit this system

The need was short-lived shared state, not long-term event storage:

- FCM access token and remaining lifetime,
- badge state,
- delivery status by `messageId`,
- short refresh coordination between two instances.

Redis already served that operational need. Kafka was not rejected as a technology; durable backlog, replay, and consumer-group processing were simply not the core requirement at the time.

## Trade-offs accepted

- Redis became an important dependency for sending and token refresh.
- Multiple refresh paths require coordination and monitoring.
- Parallel sending increases burst load and result-aggregation work.
- `UNREGISTERED` confirmation protects valid tokens at the cost of one extra call. The sender marks confirmed invalid tokens non-retryable, while incomplete branching in the upper retry queue remains a known gap.
- `messageId` reduces duplicate logical sends but does not provide exactly-once FCM delivery.

## Repository limitations

- A successful FCM response does not prove display on the Flutter device.
- This is not an executable reproduction of company source or topology.
- Real API paths, Redis keys, token TTLs, lock timing, retry counts, and alert thresholds are withheld.
- Durable large-scale queues, replay, global ordering, and cross-region deployment are out of scope.
- Migration to Firebase Admin SDK was a plan under consideration, not a completed implementation claimed here.
- The Redis reconnect change is not presented as fully verified recurrence prevention before production validation.

## What I would inspect first now

1. Does `messageId` cross every end-to-end boundary?
2. Does normal sending wait for external OAuth refresh?
3. Can both common API instances refresh the same token?
4. Is `UNREGISTERED` mixed with infrastructure failure?
5. Are Redis, OAuth, and FCM health separate from process health?
6. Can one item failure stop an entire batch?
7. Are the instance identity and log collection path trustworthy?

These questions were not a checklist chosen before implementation. They are the order left by actual incidents.
