# Context and Disclosure Boundary

## Why this repository exists

This did not start as a greenfield messaging design. I needed a public way to explain an FCM notification path that I had already built and operated while preparing for a career move.

Removing proprietary information should not erase the real architecture or the experience behind it.

> Hiding company details and hiding the actual engineering experience are different things.

Internal names and settings are removed, while the technology, service order, incidents, and decision sequence remain faithful to the work.

## Public names used in the documents

| Public name | Meaning |
|---|---|
| Legacy business service | Existing business area where the notification event begins |
| Java integration process | Java path that forwards the business event |
| Integration API | NestJS layer that resolves recipient/device/state context and calls the common API |
| Common API | Two-instance NestJS layer that performs the actual FCM provider call |
| Send / delivery | Server request to FCM and the recorded result |
| Access-token refresh | Obtaining a new access token for the FCM call |
| Device token | FCM registration value for a client device |

These are general replacements for internal names. I do not add fictional deployed components to explain the flow.

## Actual flow and my scope

```text
Legacy business service
  → Java integration process
  → Integration API (NestJS)
  → Common API (NestJS, two instances)
  → Nginx / outbound path
  → FCM
  → Flutter client
```

The two NestJS layers have different responsibilities.

- Integration API: recipient/device/state lookup, `messageId`, outcome interpretation, retry decision
- Common API: FCM access-token/send context and the actual provider request

My direct scope centers on the Push path after the Java integration boundary, and I also directly developed and built the Flutter mobile app at the receiving end:

- the existing Java async event path and Push resource isolation,
- the NestJS integration and common API delivery path,
- Redis-backed access token, delivery/badge state, and refresh coordination,
- `messageId` / `X-Message-Id` correlation,
- parallel fan-out and item-level failure isolation,
- access-token refresh and recovery,
- `UNREGISTERED` handling,
- `delivery_unknown` and retry semantics,
- monitoring and log analysis,
- incident investigation and application-side remediation,
- direct development and build-out of the Flutter mobile app and its FCM integration.

I do not claim ownership of the legacy business service as a whole. The Flutter mobile app, however, was directly developed and built by me. It remains the downstream boundary in these diagrams because this repository focuses on the messaging-server path; detailed app internals are intentionally outside the documentation scope.

## Problems that shaped the design

1. OAuth refresh latency propagated into send latency.
2. Two common API instances competed to refresh the same token.
3. Sequential fan-out accumulated delay.
4. One item failure could affect a batch.
5. `UNREGISTERED` required a different operational meaning from infrastructure failure.
6. Two instances wrote into the same log path, making the evidence itself unreliable.
7. The process was alive while its Redis connection had stopped recovering.
8. timeout/502/504 could leave delivery ambiguous, turning retry into a duplicate-delivery risk.
9. provider outcome and logging/Redis side effects shared an exception path.

The documents follow the same order: what happened, how I narrowed it down, what changed, and how far the change has been validated.

## Not disclosed

- real company, organization, site, or system names,
- production API paths or request bodies,
- hostnames, IPs, VIPs, firewall rules, or detailed network addresses,
- real Redis keys, schedules, TTLs, and retry counts,
- credentials, access tokens, service accounts, or private keys,
- raw production logs, user data, device identifiers, or sensitive payloads,
- company source code and the complete topology.

## AI usage

I used AI to structure the writing, improve readability, prepare Mermaid diagrams, and translate the English version. Facts, technical decisions, incident sequences, and ownership boundaries were reviewed against my work records.

The repository does not add services that were not implemented or present an unverified change as a completed operational result.
