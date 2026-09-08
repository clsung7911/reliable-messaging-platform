# Troubleshooting Records

These are not copies of internal incident reports. Real names, addresses, logs, and settings are removed. I keep the investigation order and do not claim an unverified root cause.

## 1. OAuth refresh latency propagated into send latency

The FCM call itself was not the main delay; access-token issuance before it was slow. Token refresh was separated from normal sending, with Redis-backed caching and layered recovery.

## 2. Application protection did not remove an outbound-network root cause

When OAuth failures rose again, the application mitigations and the network team's outbound-policy correction were recorded as separate ownership.

## 3. Two instances wrote into the same log file

Instance logs looked impossibly similar. File evidence showed both containers writing to the same shared file. The fix separated paths and instance identity.

## 4. Common API did not recover after Redis became available

The process was alive while its Redis client had stopped reconnecting after initial failure.

The change separates fast command failure from persistent connection recovery.

```text
Code Change      COMPLETE
DEV Validation   COMPLETE
PROD Deployment  PENDING
PROD Validation  PENDING
```

## 5. FCM timeout with a sent request but no confirmed outcome

Observed evidence:

```text
FCM request started
→ upstream connection established
→ request bytes appeared to be forwarded
→ no response
→ application timeout
→ Nginx 499 after the application closed the connection
```

The request may have reached downstream, but FCM acceptance could not be confirmed.

```text
ROOT CAUSE: UNKNOWN / PENDING
```

This changed the retry model:

```text
timeout / 502 / 504
→ delivery_unknown
→ no automatic retry
```

The external cause remains unknown. The code change is complete, while overall DEV and production validation remain pending.

## Investigation rules

1. Do not treat a symptom as the cause.
2. Split timing by boundary.
3. Inspect shared dependencies when both instances fail.
4. Separate application mitigation from infrastructure root-cause repair.
5. Verify the evidence path when logs contradict the architecture.
6. A missing response is not proof of non-delivery.
7. Keep unverified causes as `unknown`.
