# 운영에서 남은 판단과 한계

## 내가 실제로 얻은 결론

### 1. FCM 호출보다 그 앞뒤 상태가 더 어려웠다

access token 만료, 두 인스턴스의 갱신 경쟁, 무효 단말, 부분 실패, Redis reconnect,
로그 연결과 Retry 의미를 정하는 일이 Provider 호출 자체보다 운영에서 더 복잡했다.

### 2. 실패와 전달 여부 불명은 다르다

`timeout`이나 `502/504`에서 response가 없다고 해서 FCM 요청이 전달되지 않았다고 확정할 수 없다.

이번 리팩토링에서 가장 크게 바꾼 기준은:

```text
확실한 실패
≠
전달 여부 불명
```

이다.

### 3. Retry는 성공률만 높이는 기능이 아니다

Retry가 성공할 수도 있지만, 이미 처리된 메시지를 다시 보내 중복 알림을 만들 수도 있다.
그래서 이번 정책은 실패율 숫자만 보지 않고 **중복 발송 비용**도 같이 본다.

### 4. Observability 실패와 Transport Result는 분리해야 한다

FCM은 정상 응답했는데 로그나 Redis 저장이 실패할 수 있다.
그 부가 실패 때문에 이미 확인된 Provider outcome을 실패로 바꾸고 다시 보내면 안 된다고 봤다.

### 5. 비동기라고 장애 영향이 자동으로 격리되는 것은 아니다

기존 Java Push 흐름은 이미 Async Event 구조였다.
그래서 "동기 → 비동기"가 아니라 Push 전용 Executor와 HTTP Client를 분리해
다른 요청 자원으로 영향이 번지는 범위를 줄이는 쪽을 선택했다.

Executor isolation은 병목 제거와 같은 말이 아니다.

### 6. CODE COMPLETE와 PROD VALIDATED는 다르다

현재 1차 리팩토링은 코드 변경과 개발환경 배포를 완료했고, 정상 Push E2E Smoke Test와 Redis reconnect를 DEV에서 확인했다. failure-path 전체 검증은 아직 남아 있다.

```text
Code Changes                  COMPLETE
Development Deployment        COMPLETE
Normal Push E2E Smoke Test     PASS
Redis reconnect DEV           VALIDATED
Failure-path DEV Validation    PENDING
Production Deployment         PENDING
Production Validation         PENDING
```

따라서 지금 문서에서 효과 검증 완료나 운영 안정화 완료를 주장하지 않는다.

## Redis를 선택한 이유

필요했던 것은 대규모 이벤트 보관보다 짧은 공유 상태였다.

- FCM access token
- 발송 상태와 badge
- `messageId` 기준 correlation 상태
- 두 인스턴스의 token refresh 조정

Kafka 같은 broker가 나쁜 것이 아니라, 당시 핵심 요구가 durable backlog/replay가 아니었다.

## 선택의 대가

- Redis가 중요한 의존성이 된다.
- `delivery_unknown`을 재시도하지 않으면 실제 미전송인 일부 일시 오류를 복구하지 못할 수 있다.
- Push Executor가 포화되면 작업이 reject될 수 있다.
- Outcome과 후처리를 분리하면 Provider 결과와 내부 상태가 일시적으로 어긋날 수 있다.
- `UNREGISTERED` 재확인은 확인 호출이 한 번 추가된다.
- `messageId`는 correlation에 도움이 되지만 Provider까지 exactly-once를 보장하지 않는다.

## 이 저장소의 한계

- FCM 성공 응답 이후 Flutter 화면 표출을 보장하지 않는다.
- 회사 운영 소스와 topology를 재현한 실행 가능한 제품이 아니다.
- 실제 API 경로, Redis key, token TTL, lock 시간, 재시도 횟수와 운영 임계값을 공개하지 않는다.
- 대규모 durable queue, replay, global ordering, cross-region 구성을 다루지 않는다.
- 1차 Reliability Refactoring의 전체 DEV/PROD 검증은 아직 완료되지 않았다.
- timeout/502/504 외부 Root Cause는 아직 `UNKNOWN / PENDING`이다.

## 지금 다시 확인하는 순서

1. FCM 요청이 실제로 시작됐는가
2. response가 없는 상태를 미전송으로 잘못 보고 있지 않은가
3. common API와 연계 API가 같은 outcome 의미를 쓰는가
4. Retry가 같은 `messageId`를 유지하는가
5. Provider outcome과 로그/Redis 후처리가 같은 catch에 묶여 있지 않은가
6. Redis connection이 dependency 복구 뒤 자동으로 살아나는가
7. Push Executor 포화가 요청 스레드로 되돌아오지 않는가
8. 검증 상태가 CODE / DEV / PROD 중 어디까지인가

이 순서는 책에서 먼저 만든 체크리스트가 아니라, 실제 장애와 리팩토링을 거치면서 남은 순서다.
