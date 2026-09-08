# Separate Provider Outcome from Post-processing Failure

The provider result is finalized before PushLog, Redis status, or token-state side effects.

```text
FCM result
→ finalize outcome
→ logging / Redis / token post-processing
```

A logging failure must not turn a confirmed provider result into a reason to resend.

The trade-off is temporary mismatch between provider outcome and internal state. Code change is complete; overall validation is pending.
