# Failure Handling and UNREGISTERED

## Failure is not one state

The current outcome model is:

| Outcome | Meaning |
|---|---|
| `accepted` | successful FCM response observed |
| `skipped_unregistered` | token confirmed UNREGISTERED on recheck |
| `delivery_unknown` | request may have started, but processing cannot be confirmed |
| `failed` | failure that can be classified as non-delivery or explicit provider failure |

`accepted` does not mean the Flutter client displayed the notification.

## `delivery_unknown`

In one operating case, upstream connection and request-transfer evidence existed while no response returned. Automatically retrying that case could duplicate a message already accepted downstream.

The current code therefore classifies timeout/502/504 as `delivery_unknown` and does not immediately resend them.

This does not claim that the external root cause is known. The root cause remains `UNKNOWN / PENDING`; the retry semantics can still be made safer.

## UNREGISTERED confirmation

After the first `UNREGISTERED`, the same send is confirmed once.

- success → `accepted`
- second `UNREGISTERED` → logical token deactivation + `skipped_unregistered`
- timeout/502/504 → keep token + `delivery_unknown`
- other retryable failure → keep token + `failed / retryable`
- other non-retryable failure → keep token + `failed`

A different error during recheck is not treated as proof that the token is invalid.

## Provider outcome vs post-processing

The refactoring finalizes the FCM outcome before PushLog/Redis/token-state side effects. A logging failure must not turn a confirmed provider result into a reason to resend.

## Current validation status

The code changes are complete. Overall DEV E2E and production validation are still pending.
