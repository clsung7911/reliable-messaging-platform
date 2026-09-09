# Isolate Push Resources Without Replacing the Existing Async Flow

The Java Push path was already behind an async event listener.

The refactoring keeps that structure and isolates:

- a Push-specific executor,
- a Push-specific HTTP client.

A request-thread fallback under executor saturation would defeat the isolation goal, so saturation is allowed to surface as rejection instead.

This is blast-radius isolation, not a claim that the bottleneck is removed. Code change, DEV deployment, and the normal Push E2E are validated. Executor saturation/failure-path and production validation remain pending.
