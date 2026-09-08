# FCM 결과와 후처리 Failure Domain을 분리

## 상황

FCM 요청 뒤에는 PushLog, Redis 발송 상태, 단말 토큰 상태 같은 후처리가 이어진다.

기존 코드에서는 Provider 요청이 성공해도 후속 로그 저장이 실패하면 같은 exception path로 들어가
이미 확인한 FCM 결과가 실패처럼 처리될 가능성이 있었다.

## 판단

Provider outcome을 먼저 확정한다.

```text
FCM Result
→ accepted / skipped_unregistered / delivery_unknown / failed
→ outcome 확정
→ PushLog / Redis status / token 후처리
```

후처리 실패는 별도 운영 문제로 남기되 이미 확정한 FCM 결과를 뒤집지 않는다.

## 왜 이렇게 했나

로그 저장 실패와 실제 메시지 전송 결과는 서로 다른 failure domain이다.

둘을 같은 실패로 취급하면:

```text
FCM accepted
→ log write failed
→ send failed로 오해
→ retry
→ 중복 발송 가능
```

이 생길 수 있다.

## 선택의 대가

Provider outcome과 내부 Redis/로그 상태가 일시적으로 어긋날 수 있다.
하지만 그 불일치를 재발송으로 보정하지 않는다.

## 현재 상태

코드 변경 완료.
DEV E2E와 운영 검증은 PENDING이다.
