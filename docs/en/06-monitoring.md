# Monitoring and Logs

## HTTP status alone was not enough

The refactoring distinguishes:

```text
accepted
skipped_unregistered
delivery_unknown
failed
```

and treats `retryable` as a separate decision.

`delivery_unknown` matters operationally because it may represent a request that was already processed. It should not be hidden inside one generic failure counter and automatically resent.

## Existing metric names

Some operating metrics retain historical names such as `fcm_delivered`.

The intended interpretation is:

```text
fcm_delivered
≈ FCM accepted
≠ Flutter display confirmed
```

## Correlation

Retries retain the same `messageId`, and `X-Message-Id` carries correlation through service and proxy logs.

## Provider outcome vs internal evidence

Two questions are observed separately:

```text
What was the provider outcome?
Was that outcome successfully written to internal logs/state?
```

A mismatch is investigated as a state/evidence issue rather than automatically repaired by sending again.

## Redis connection state

After a restart incident, process liveness and dependency readiness are observed separately:

```text
process running
Redis connect / ready
Redis reconnecting / close / end
valid FCM access token
FCM request result
```

The Redis reconnect change is DEV validated; production recovery validation is still pending.
