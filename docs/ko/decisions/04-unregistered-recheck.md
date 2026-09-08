# `UNREGISTERED`를 재확인 후 비활성화

## 상황

FCM의 `UNREGISTERED`는 더 이상 쓸 수 없는 단말 토큰을 뜻한다.
그대로 두면 발송마다 실패하지만, 한 번의 응답으로 바로 비활성화하면 일시 오류로 멀쩡한 토큰까지 잃을 수 있다.

## 판단

최초 `UNREGISTERED` 뒤 같은 발송을 한 번 재확인한다.

현재 1차 리팩토링 기준:

- 재확인 성공: `accepted`
- 재확인도 `UNREGISTERED`: 토큰 논리 비활성화 + `skipped_unregistered`
- 재확인 timeout / 502 / 504: 토큰 유지 + `delivery_unknown`
- 재확인 retryable failure: 토큰 유지 + `failed / retryable`
- 재확인 non-retryable failure: 토큰 유지 + `failed`

중요한 것은 **재확인에서 다른 오류가 났다고 해서 토큰을 무효로 확정하지 않는 것**이다.

## 상위 Retry와의 연결

기존에는 Sender가 terminal 의미를 만들더라도 상위 발송 서비스가 HTTP status 중심으로
retry queue에 넣을 수 있는 known gap이 있었다.

1차 리팩토링 코드에서는 공통 API의 typed outcome을 연계 API가 우선 해석하고,
`skipped_unregistered`는 terminal로, 명확한 retryable 실패만 retry queue에 넣도록 보완했다.

```text
Code Change          COMPLETE
Development E2E      PENDING
Production Validation PENDING
```

## 선택의 대가

- 무효 토큰 후보 한 건에 확인 호출이 추가된다.
- 비활성화가 즉시 처리보다 늦어진다.
- 앱의 새 토큰 재등록 흐름과 함께 봐야 한다.

## 공개 제한

실제 재확인 간격, DB 필드, 내부 상태 코드와 단말 식별정보는 공개하지 않는다.
