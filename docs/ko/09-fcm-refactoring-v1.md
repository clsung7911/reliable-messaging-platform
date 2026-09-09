# FCM 1차 리팩토링 — 실패와 재시도 기준을 다시 정리한 이유

## 왜 다시 손댔는가

처음부터 구조를 새로 만들 생각은 없었다.

운영 장애와 기존 코드를 다시 보면서, 내가 더 크게 느낀 문제는 "Retry가 부족하다"가 아니라
**서로 다른 실패가 같은 실패처럼 처리되고 있었다는 것**이었다.

특히 다음이 한 흐름 안에서 섞였다.

- FCM 요청 전에 발생한 명확한 실패
- FCM 요청은 시작됐지만 response를 확인하지 못한 상태
- UNREGISTERED 같은 단말 토큰 수명 문제
- FCM 결과 뒤의 PushLog / Redis 상태 저장 실패
- 서비스마다 조금씩 다른 Retry 판단
- 기존 비동기 구조 안에서 Push가 사용하는 실행 자원

그래서 1차 리팩토링은 새로운 메시징 아키텍처로 교체하는 작업이 아니라,
**기존 실제 구조 안에서 실패의 의미와 경계를 다시 정리한 작업**으로 잡았다.

## Before

```text
기존 업무 서비스
→ Java 비동기 Event / HTTP
→ 연계 API
→ 사용자·단말 / 상태 조회
→ 공통 API
→ FCM
→ 결과 / 로그 / Redis 후처리
```

기존 구조에는 이미:

- Java Async Event
- NestJS 연계 API / 공통 API
- Redis access token 관리
- UNREGISTERED 재확인
- messageId
- 병렬 발송

이 있었다.

이번 작업을 "없던 구조를 새로 만들었다"고 설명하지 않는다.

## 운영과 코드에서 다시 확인한 문제

### 1. timeout이 정말 미전송인가?

한 timeout에서 upstream connection과 request 전달 정황은 확인했지만 response는 받지 못했다.

```text
요청은 나감
→ 응답은 없음
→ FCM 최종 수락 여부는 모름
```

이 상태를 단순 실패로 보고 다시 보내면 중복 알림 위험이 있었다.

### 2. FCM 성공 뒤 로그 저장이 실패하면?

FCM 성공과 PushLog/Redis 저장이 같은 exception boundary에 있으면,
후처리 실패가 Provider 결과까지 실패처럼 바꿀 수 있었다.

### 3. UNREGISTERED 재확인의 다른 오류는?

첫 UNREGISTERED 뒤 재확인에서 timeout이나 다른 오류가 나면
그것은 "토큰이 무효"라는 증거가 아니다.

### 4. 이미 Async인데 왜 또 손대나?

Java Push 호출은 이미 Async Event 뒤에서 실행되고 있었다.
문제는 비동기 여부보다 Push 전용 Executor와 HTTP 정책이 충분히 분리돼 있지 않았다는 점이었다.

## Engineering Decisions

### Decision 1. 결과를 네 상태로 분리

```text
accepted
skipped_unregistered
delivery_unknown
failed
```

`delivery_unknown`을 별도로 둔 것이 이번 작업의 중심이다.

### Decision 2. FCM 요청이 시작됐는지 구분

FCM 요청 전에 실패했는지, 실제 요청을 시작한 뒤 response를 못 받은 것인지 분리한다.

### Decision 3. 전달 여부가 불명확하면 자동 Retry하지 않음

```text
500 / 503
→ 제한적 Retry

timeout / 502 / 504
→ delivery_unknown
→ 자동 Retry 금지
```

### Decision 4. UNREGISTERED는 두 번째 확인에서만 확정

재확인 성공은 `accepted`,
재확인도 UNREGISTERED일 때만 토큰을 논리 비활성화하고 `skipped_unregistered`로 본다.

다른 오류는 토큰을 유지한다.

### Decision 5. Provider outcome을 먼저 확정

```text
FCM Result
→ outcome 확정
→ PushLog / Redis / token 후처리
```

로그 저장 실패가 실제 메시지를 다시 보내는 이유가 되지 않게 한다.

### Decision 6. 공통 API가 결과 의미를 정의

연계 API는 공통 API의 `status / retryable / deliveryUnknown`을 우선 해석한다.
서비스마다 HTTP status만 보고 서로 다른 Retry 결론을 내리지 않게 하는 목적이다.

### Decision 7. 같은 messageId를 Retry에서도 유지

`X-Message-Id`로 서비스와 외부 통신 로그 correlation도 보강했다.

### Decision 8. 기존 Async 구조는 유지하고 Push 자원만 격리

전용 Executor와 HTTP Client를 분리했다.
이번 범위에서 Queue 기반 구조로 갈아타지는 않았다.

### Decision 9. Redis Command 실패와 Connection 복구를 분리

개별 명령은 빠르게 실패시키고, dependency가 살아나면 connection은 계속 복구를 시도하도록 했다.

## After

```text
기존 업무 서비스
→ Java Async Event
→ Push 전용 Executor / HTTP Client
→ 연계 API
   ├─ messageId 유지
   ├─ typed outcome 해석
   └─ 명확한 retryable 실패만 retry_queue
→ 공통 API
   ├─ FCM 요청 전/후 failure boundary
   ├─ accepted / skipped / delivery_unknown / failed
   ├─ 제한적 Retry
   ├─ UNREGISTERED 재확인
   └─ outcome 확정 후 후처리
→ Nginx / 외부 통신
→ FCM
```

새 시스템이 된 것이 아니다. 같은 시스템에서 **실패의 의미와 책임 경계가 더 구체적으로 나뉜 것**이다.

## Before → After

| 영역 | Before | 1차 Refactoring |
|---|---|---|
| 결과 의미 | 성공/실패 중심 | accepted / skipped / delivery_unknown / failed |
| timeout/502/504 | 실패로 해석될 여지 | delivery_unknown / 자동 Retry 금지 |
| FCM 요청 전/후 | response 없음으로 섞일 수 있음 | request-started 기준 분리 |
| UNREGISTERED | 재확인 정책은 있었음 | 재확인 다른 오류까지 결과 의미 분리 |
| 후처리 | Provider 결과와 같은 예외 경계 | outcome 먼저 확정 후 분리 |
| 서비스 간 계약 | HTTP status 중심 | typed outcome 우선 |
| messageId | E2E 개념 존재 | Retry 유지 + X-Message-Id correlation |
| Java Push | 기존 Async | Async 유지 + 전용 Executor/HTTP Client |
| Redis reconnect | 제한 후 중단 가능 | Command fast fail + connection 지속 reconnect |

## Development Validation — 2026-09-09

1차 리팩토링 코드를 개발환경의 실제 서비스 경로에 배포한 뒤 정상 Push 경로를 기준으로 Smoke Test를 진행했다.

### Deployment

- Java 업무 서비스: PASS
- 연계 API: PASS
- 공통 API: PASS

### Verified Behaviors

- 정상 Push E2E: PASS
- `messageId` correlation: PASS
- FCM 정상 응답 → `accepted` contract: PASS
- Redis 발송 상태 `delivering → delivered`: PASS
- 정상 성공 경로 `retryable=false`: PASS
- 정상 성공 경로 `deliveryUnknown=false`: PASS
- 동일 조건 연속 정상 발송 2회: PASS

이 결과로 확인한 것은 **정상 발송 경로와 정상 contract가 개발환경에서 실제로 동작한다는 것**이다.
`delivery_unknown=true`, `retryable=true`, UNREGISTERED 재확인, 후처리 실패 주입, Executor saturation 같은 오류 경로 전체가 검증됐다는 뜻은 아니다.

## Validation Status

```text
Code Changes                  COMPLETE
Development Deployment        COMPLETE
Normal Push E2E Smoke Test     PASS
Redis reconnect DEV           VALIDATED
Failure-path DEV Validation    PENDING
Production Deployment         PENDING
Production Validation         PENDING
```

## Remaining Work

- timeout / 502 / 504를 실제로 발생시켜 `delivery_unknown=true`와 자동 Retry 제외 확인
- `retryable=true` 오류 경로와 retry queue 진입 여부 확인
- UNREGISTERED 재확인 분기 확인
- 후처리 실패 주입 시 이미 확정한 outcome 보존 확인
- Push Executor saturation / reject와 HTTP 오류 경로 확인
- 운영 반영 후 실제 로그·상태·messageId correlation 확인
- timeout/502/504 외부 Root Cause는 별도 조사 유지

## 지금 이 문서가 주장하는 범위

> 실제 운영 장애와 코드를 다시 보고 실패와 재시도 기준을 바꿨고,
> **개발환경의 정상 Push E2E 경로에서 변경된 contract와 correlation이 동작하는 것까지 확인했다.**

Failure-path 전체 검증과 Production 검증은 아직 남아 있다.
