# 모니터링과 로그

## HTTP status 하나로는 부족했다

운영 장애를 볼 때 500, 502, 504, timeout이 모두 `failed` 하나로 들어가면
무엇을 다시 보내야 하고 무엇을 조사해야 하는지 바로 알기 어려웠다.

이번 1차 리팩토링에서는 결과 의미를 다음처럼 본다.

```text
accepted
skipped_unregistered
delivery_unknown
failed
```

그리고 Retry 여부는 별도 의미로 본다.

```text
retryable = true / false
```

`delivery_unknown`은 특히 중요한 운영 상태다. 요청이 이미 전달됐을 수 있기 때문에
실패율 숫자 하나로 합치고 자동 재발송하면 안 된다.

## 기존 metric 이름과 의미

운영 metric에는 기존 호환성 때문에 `fcm_delivered` 같은 이름이 남아 있다.

하지만 의미는 다음에 가깝다.

```text
fcm_delivered
≈ FCM accepted
≠ Flutter 단말 화면 표출 완료
```

이 이름을 보고 실제 사용자 표시 완료까지 확장해서 해석하지 않는다.

## 구간별로 보는 값

- Java Push 실행 구간
- 연계 API → 공통 API 호출 구간
- Redis access token / 상태 조회 구간
- 공통 API → Nginx → FCM 호출 구간
- outcome 확정 뒤 로그/Redis 후처리 구간

전체 HTTP 시간 하나보다 어느 경계에서 시간이 늘었는지를 먼저 본다.

## `messageId`와 `X-Message-Id`

Retry에서도 같은 `messageId`를 유지하고, 서비스 간 HTTP 요청에는 `X-Message-Id`를 전달한다.

운영에서 확인하려는 흐름:

```text
Java 요청
→ 연계 API
→ 공통 API
→ Nginx / 외부 호출
→ outcome
```

같은 발송을 하나의 ID로 찾는 것이 목적이지, ID 자체로 exactly-once를 보장하는 것은 아니다.

실제 ID 규칙과 값은 공개하지 않는다.

## Outcome과 Observability를 따로 본다

FCM Provider 결과가 성공했는데 PushLog나 Redis 저장이 실패할 수 있다.
현재 코드는 이 둘을 같은 결과로 뒤집지 않도록 경계를 분리했다.

그래서 운영에서는 다음 두 질문을 따로 본다.

```text
Provider outcome은 무엇이었나?
내부 상태/로그는 정상적으로 남았나?
```

둘이 어긋나면 재발송부터 하지 않고 상태 저장 경로를 확인한다.

## Redis reconnect

서버 작업 뒤 프로세스는 살아 있지만 Redis connection이 복구되지 않아 503이 지속된 사건이 있었다.

이후에는:

```text
process running
Redis connect / ready
Redis reconnecting / close / end
valid FCM access token
FCM request result
```

을 분리해 본다.

Redis reconnect 변경은 개발환경에서 확인했고, 운영 반영/실제 자동복구 검증은 아직 PENDING이다.

## 내가 모니터링에서 지키는 기준

> 지표가 많아지는 것보다, 지금 이 결과가 다시 보내도 되는 실패인지 먼저 구분할 수 있어야 한다.

실제 metric 이름 전체, dashboard 주소, 내부 label과 경보 임계값은 공개하지 않는다.
