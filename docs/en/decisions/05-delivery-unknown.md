# Represent Ambiguous Delivery as `delivery_unknown`

A missing response after an FCM request starts is not proof that the request was never processed.

The refactoring uses:

```text
request started + no confirmed response
→ delivery_unknown
→ retryable=false
```

This reduces duplicate-delivery risk for timeout/502/504 paths.

The external root cause remains `UNKNOWN / PENDING`. Retry semantics can be improved without pretending the root cause is known.

Code change is complete; DEV/production validation is pending.
