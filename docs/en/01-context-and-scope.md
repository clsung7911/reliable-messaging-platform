# Context and Disclosure Boundary

## Why I rewrote this repository

This repository did not start as a greenfield design exercise. I needed a public way to explain an FCM notification path that I had already built and operated while preparing for a career move.

The first public draft removed so much company context that the real service order disappeared with it. It read like general messaging guidance rather than my work. Version 2 uses a different rule:

> Hiding proprietary information should not erase the actual experience.

Internal names and settings are removed, but the technology, service boundaries, operational problems, and order of decisions stay faithful to the work.

## Public names used in the documents

| Public name | Meaning |
|---|---|
| Legacy business service | The existing business area where a notification request begins |
| Java / data handoff | The Java-side handoff that passes business request data to the integration API |
| Integration API | The NestJS layer that receives the Java/data handoff and prepares the send request |
| Common API | The two-instance NestJS layer that calls FCM and owns access-token refresh |
| DB Repository | The data-access boundary for recipient and device-token lookup |
| Send / delivery | The server request to FCM and the recorded result |
| Access-token refresh | Obtaining a new access token for the FCM call |
| Device token | The FCM registration value for a client device |

These are general replacements for internal names. I do not introduce fictional production components to explain the flow.

## Actual flow and my scope

```text
Legacy business service
  → Java / data handoff
  → Integration API (NestJS)
  → Common API (NestJS, two instances)
  → FCM
  → Flutter client
```

My direct scope centers on the server-side delivery path after the Java/data handoff:

- the NestJS integration API and common API flow,
- recipient/device-token lookup through a DB repository,
- FCM access token, badge state, delivery status, and refresh coordination in Redis,
- end-to-end correlation and duplicate handling with `messageId`,
- parallel fan-out with item-level failure isolation,
- FCM access-token refresh and recovery,
- FCM `UNREGISTERED` handling,
- monitoring and log analysis with Grafana and Loki,
- investigation and application-side remediation of production incidents.

The legacy business service and Flutter client are the upstream and downstream boundaries. I do not claim ownership of their entire internal implementations, including the Flutter UI, display behavior, or complete client token-registration lifecycle.

## Problems that actually shaped the design

1. External OAuth refresh inside the send path propagated latency into 504 responses.
2. Two common API instances could refresh the same access token concurrently.
3. Sequential fan-out accumulated delay with each recipient.
4. One item failure could interrupt the rest of a batch.
5. FCM `UNREGISTERED` results polluted infrastructure-failure counts.
6. Logs from two instances were written to the same location, making the evidence itself unreliable.
7. The process was running, but a Redis connection did not recover and the API continued to fail.

The documents follow the same sequence: what happened, how I narrowed it down, what I changed, and how far the change was verified.

## Not disclosed

- real company, organization, site, or system names,
- production API paths or request bodies,
- hostnames, IPs, VIPs, firewall rules, or network addresses,
- real Redis keys, schedules, TTLs, and retry counts,
- credentials, access tokens, service accounts, or private keys,
- raw production logs, user data, device identifiers, or sensitive payloads,
- company source code and the complete topology.

Numbers are also omitted when they are not necessary to explain the engineering decision. Every sample value is synthetic.

## AI usage

I used AI to structure the writing, improve readability, prepare Mermaid diagrams, and translate the English version. Facts, technical decisions, incident sequences, and ownership boundaries were checked against my work records.

That disclosure is also a writing constraint: the repository does not add services that were not implemented or present an unverified improvement as a completed result.
