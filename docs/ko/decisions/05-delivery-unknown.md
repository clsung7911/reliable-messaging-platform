# `delivery_unknown`을 별도 결과로 둔다

## 상황

timeout이나 502/504에서 response를 받지 못했다고 해서 FCM 요청이 전달되지 않았다고 확정할 수 없다.

실제 운영 사례 중에는 upstream connection과 request 전달 정황은 있었지만 response를 확인하지 못한 경우가 있었다.

## 판단

이 상태를 일반 `failed`와 분리해 `delivery_unknown`으로 둔다.

```text
FCM 요청 시작
+ response 미확인
→ delivery_unknown
→ retryable=false
```

반대로 FCM 요청 전에 연결 자체가 실패했다고 판단 가능한 경우는 `failed / retryable`로 본다.

## 왜 Retry하지 않나

자동 Retry는 일시 오류를 복구할 수 있지만,
이미 Provider가 처리한 메시지를 다시 보내 중복 알림을 만들 수도 있다.

이번 판단에서는 "가능하면 한 번 더 보낸다"보다 **이미 전달됐을 가능성을 무시하지 않는 것**을 우선했다.

## Root Cause와 분리

`delivery_unknown`을 도입했다고 timeout/502/504의 외부 Root Cause가 확인된 것은 아니다.

```text
External Root Cause: UNKNOWN / PENDING
Retry Semantics: CODE COMPLETE
```

원인을 모르는 상태에서도 재시도 의미는 더 안전하게 정할 수 있다고 봤다.

## 현재 상태

코드 반영과 정상 성공 contract(`deliveryUnknown=false`)는 DEV에서 확인했다. 실제 ambiguous failure에서 `delivery_unknown=true`가 되는 경로와 PROD 검증은 PENDING이다.
