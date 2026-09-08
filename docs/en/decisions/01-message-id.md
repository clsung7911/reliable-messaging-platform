# Use `messageId` as the End-to-End Identity

A send crosses Java integration, the integration API, the common API, Redis state, the outbound proxy path, and FCM.

The same `messageId` is kept across retries. `X-Message-Id` carries that correlation through HTTP and proxy evidence.

This supports log/state/retry correlation; it does not provide exactly-once delivery. The real ID format is not published.

The code change is complete. Overall DEV E2E and production validation remain pending.
