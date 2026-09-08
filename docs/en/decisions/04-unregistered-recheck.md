# Confirm `UNREGISTERED` Before Deactivation

After the first `UNREGISTERED`, the same send is confirmed once.

- success → `accepted`
- second `UNREGISTERED` → logically deactivate token + `skipped_unregistered`
- timeout/502/504 → keep token + `delivery_unknown`
- other retryable failure → keep token + `failed / retryable`
- other failure → keep token + `failed`

A different error during confirmation is not proof that the token is invalid.

The refactoring also propagates typed outcome semantics upward so confirmed UNREGISTERED is terminal instead of being blindly placed on a retry queue. Code change is complete; overall DEV/production validation is pending.
