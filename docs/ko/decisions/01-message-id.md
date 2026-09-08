# `messageId`를 E2E 식별자로 사용

## 상황

하나의 발송 요청이 Java 연계, 연계 API, 공통 API, Redis 상태, Nginx/외부 통신과 FCM 호출을 지난다.
서비스별 요청 ID만으로는 장애 때 같은 발송을 다시 이어 붙이기 어려웠다.

## 판단

업무 요청의 `messageId`를 끝까지 유지한다.

```text
Java 연계 로그
연계 API 로그
공통 API 로그
Redis 발송 상태
Nginx / 외부 호출 로그
FCM 결과
          ↑ 같은 messageId
```

이번 1차 리팩토링에서는 Retry에서도 새 ID를 만들지 않고 같은 `messageId`를 유지한다.
서비스 간 HTTP에는 `X-Message-Id`를 전달해 프록시와 외부 호출 로그까지 correlation할 수 있게 했다.

## 왜 이렇게 했나

timeout이나 `delivery_unknown`처럼 결과가 애매한 상황에서
재시도가 새로운 논리 발송인지 기존 발송의 연장인지 구분할 수 있어야 했다.

`messageId`는:

- 로그 연결
- Redis 상태 확인
- Retry correlation
- 운영 중 특정 발송 추적

에 사용한다.

## 선택의 대가

- 같은 `messageId`가 다른 payload에 재사용되는 경우를 막아야 한다.
- 상태 보관 기간이 끝난 오래된 재시도는 별도 정책이 필요하다.
- 이 값이 FCM과 단말까지 exactly-once를 보장한다고 과장하지 않는다.

## 현재 상태

`X-Message-Id` 전파와 Retry ID 유지 코드는 반영했다.
전체 DEV E2E와 운영 검증은 아직 PENDING이다.

## 공개 제한

실제 ID 생성 규칙과 실제 값은 공개하지 않는다.
