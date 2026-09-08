# Move Token Refresh Outside the Send Path

## Context

External OAuth refresh inside a send request propagated latency into common API 504s. Redis caching reduced normal calls but did not prevent concurrent refresh at expiry.

## Decision

Normal sends use a valid access token in Redis. Refresh runs through startup checks, proactive scheduling, expiry monitoring, and emergency recovery.

Inside a process, callers share the in-flight promise. Across the two instances, Redis coordinates refresh ownership.

## Trade-offs

- Multiple refresh paths must not race with one another.
- Cached-token retention and emergency thresholds require an operating policy.
- Redis and external OAuth health need separate monitoring.
- Application mitigation must not be confused with repairing a network root cause.

## Disclosure

Real schedules, expiry thresholds, retry timing, counts, and Redis lock values are not published.
