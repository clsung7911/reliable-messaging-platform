# 장애 대응 기록

이 문서는 운영 장애보고서 원문이 아니다. 실제 사건에서 내부 이름, 주소, 로그와 설정값을 빼고,
내가 확인한 순서와 판단만 남겼다. 확인하지 못한 원인은 확정해서 쓰지 않는다.

## 1. 토큰 갱신 지연이 FCM 발송 504로 이어진 문제

### 보였던 현상

서버 기동 직후에는 정상인데 access token 만료 주기가 가까워지면 발송 504가 나타나고 점차 늘었다.

### 확인된 원인

FCM 호출보다 그 직전의 외부 OAuth token 발급이 오래 걸렸다. 발송 요청 안에서 token을 갱신하던
구조 때문에 OAuth 지연이 상위 요청 timeout으로 번졌다.

### 바꾼 내용

- FCM access token을 Redis에 저장
- 발송 요청과 선제 갱신을 분리
- 프로세스 안 Promise single-flight
- 인스턴스 사이 Redis 기반 조정
- 기동/정기/감시/긴급 복구 경로 구성

외부 OAuth 실패 자체가 사라진 것이 아니라, 유효한 token이 있을 때 정상 발송이 갱신을 기다리지 않게 한 것이다.

## 2. 애플리케이션 방어 이후에도 OAuth 실패가 늘어난 문제

외부 통신 정책 변경으로 컨테이너에서 OAuth로 나가는 경로가 불안정해진 사건이 있었다.

- 내가 한 일: 구간별 조사, 기존 token 유지, 재시도/감시/복구 기능 보강
- 네트워크 담당이 한 일: 외부 통신 정책 수정

애플리케이션 보완과 인프라 원인 제거를 하나의 성과로 합치지 않는다.

## 3. 두 인스턴스 로그가 같은 파일에 섞인 문제

공통 API 두 인스턴스의 로그가 이상할 정도로 같았다. 파일 크기와 해시를 비교해
두 컨테이너가 공유 스토리지의 같은 로그 파일에 동시에 기록하는 구조를 확인했다.

- 인스턴스별 로그 경로 분리
- 로그에 인스턴스 식별값 추가
- 한 인스턴스씩 순서대로 적용

이 사건 이후 "코드로 설명되지 않는 로그"를 보면 코드 가설만 늘리지 않고 로그가 만들어지는 경로부터 확인한다.

## 4. 서버 재기동 뒤 Redis가 살아나도 공통 API가 복구되지 않은 문제

### 보였던 현상

정기 서버 작업 뒤 공통 API 프로세스는 실행 중인데 발송 관련 요청은 503을 계속 반환했다.
두 인스턴스에서 같은 증상이었고 Redis connection이 닫힌 상태였다.

### 확인된 원인

공통 API가 Redis보다 먼저 시작해 초기 연결에 실패했고,
Redis client가 제한된 재연결 뒤 connection retry를 중단했다.
Redis가 나중에 정상화돼도 애플리케이션 연결은 복구되지 않았다.

### 변경과 검증

- 개별 Redis Command는 빠르게 실패
- Connection은 backoff를 두고 지속 reconnect
- `connect / ready / close / reconnecting / error / end` 로그 분리

```text
Code Change      COMPLETE
DEV Validation   COMPLETE
PROD Deployment  PENDING
PROD Validation  PENDING
```

운영 재발 방지 완료라고 표현하지 않는다.

## 5. FCM timeout에서 요청은 나갔지만 결과를 확인하지 못한 문제

### 보였던 현상

한 발송에서 다음 정황을 확인했다.

```text
FCM 요청 시작
→ upstream connection 성립
→ request bytes 전달 정황
→ response 없음
→ 애플리케이션 timeout
→ 연결 종료에 따른 Nginx 499
```

### 어디까지 확인했나

요청이 중간 경로까지 전달된 정황은 있었다.
하지만 FCM이 최종적으로 메시지를 수락했는지는 확인하지 못했다.

Google FCM 자체 문제인지, 연결 이후 네트워크 경로 문제인지,
중간 프록시 문제인지는 현재 증거로 확정하지 않는다.

```text
ROOT CAUSE: UNKNOWN / PENDING
```

### 이 사건에서 바꾼 판단

예전처럼:

```text
timeout
→ 실패
→ 다시 발송
```

으로 단순하게 보면 안 된다고 판단했다.

응답을 받지 못한 상태는 "미전송 확정"이 아니기 때문에 `delivery_unknown`을 별도 결과로 만들었다.

```text
timeout / 502 / 504
→ delivery_unknown
→ 자동 Retry 금지
```

반대로 FCM 요청 전에 연결 자체가 실패했다고 판단 가능한 오류는 `failed / retryable`로 분리한다.

### 현재 상태

```text
Policy / Code Change           COMPLETE
Normal-path DEV Smoke          PASS
Ambiguous Failure-path DEV     PENDING
PROD Deployment                PENDING
PROD Validation                PENDING
```

2026-09-09 정상 Push 경로에서는 `messageId`, `accepted`, `retryable=false`, `deliveryUnknown=false` contract를 확인했다.
하지만 실제 timeout/502/504를 발생시켜 `delivery_unknown=true`가 되는 경로는 아직 검증하지 않았다.
이 사건의 외부 원인도 여전히 모른다. "원인을 모르는 것"과 "중복 발송 위험을 줄이기 위한 Retry 기준을 정하는 것"은 별개로 본다.

## 공통으로 지키는 조사 방식

1. 증상과 원인을 같은 것으로 두지 않는다.
2. 서비스 전체 시간보다 구간별 시간을 먼저 나눈다.
3. 두 인스턴스가 함께 실패하면 공통 의존성을 본다.
4. 애플리케이션 방어와 인프라 원인 제거를 구분한다.
5. 로그와 지표가 구조와 맞지 않으면 수집 경로를 검증한다.
6. 응답이 없다고 미전송으로 단정하지 않는다.
7. 확인되지 않은 원인은 `unknown`으로 남긴다.
