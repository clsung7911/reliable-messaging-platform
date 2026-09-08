# 정리 배경과 공개 범위

## 왜 이 문서를 만들었나

이 저장소의 출발점은 새 시스템 설계가 아니다. 실무에서 이미 만들고 운영한 FCM 알림 경로를
이직 준비 과정에서 공개 가능한 형태로 설명하기 위해 정리했다.

회사 정보를 지우는 과정에서 실제 구조와 경험까지 사라지면, 결국 내가 한 일을 보여주는 문서가 아니라
일반적인 메시징 설명서가 된다. 그래서 기준을 이렇게 잡았다.

> 회사 정보를 숨기는 것과 실제 경험을 지우는 것은 다르다.

서비스명과 설정값은 공개하지 않되, 실제 기술, 서비스 순서, 운영 중 겪은 문제와 판단 흐름은 유지한다.

## 공개 문서에서 사용하는 이름

| 한국어 | English | 의미 |
|---|---|---|
| 기존 업무 서비스 | Legacy business service | 알림 요청이 시작되는 기존 업무 영역 |
| Java 연계 프로세스 | Java integration process | 기존 업무 요청을 다음 구간으로 전달하는 Java 구간 |
| 연계 API | Integration API | 사용자·단말·발송 상태를 확인하고 공통 API를 호출하는 NestJS 구간 |
| 공통 API | Common API | 이중화되어 실제 FCM Provider 호출을 수행하는 NestJS 구간 |
| 발송 | send / delivery | 서버가 FCM에 메시지를 요청하고 결과를 기록하는 일 |
| 토큰 갱신 | access-token refresh | FCM 호출에 필요한 access token을 새로 받는 일 |
| 단말 토큰 | device token | FCM이 단말을 식별할 때 사용하는 등록값 |

실제 내부 이름을 이런 일반적인 말로 바꿨을 뿐, 별도의 추상 컴포넌트를 새로 만들어
실제 구조인 것처럼 설명하지 않는다.

## 실제 흐름과 직접 담당 범위

```text
기존 업무 서비스
  → Java 연계 프로세스
  → 연계 API (NestJS)
  → 공통 API (NestJS, 이중화)
  → Nginx / 외부 통신 경로
  → FCM
  → Flutter 단말
```

연계 API와 공통 API는 같은 역할이 아니다.

- 연계 API: 사용자·단말·발송 상태를 확인하고 `messageId`를 관리하며 공통 API 결과를 해석
- 공통 API: FCM access token과 발송 문맥을 확인하고 실제 Provider 요청을 수행

제가 직접 다룬 핵심 범위는 Java 연계 이후의 Push 호출 구조와 서버 발송 구간이다.

- Java의 기존 비동기 Event 흐름과 Push 실행 자원 격리
- NestJS 연계 API와 공통 API의 FCM 발송 흐름
- Redis를 이용한 access token, badge/발송 상태, token refresh 조정
- `messageId` / `X-Message-Id` 기반 correlation
- 다수 대상 병렬 발송과 개별 실패 격리
- FCM access token 갱신과 장애 복구
- `UNREGISTERED` 단말 토큰 처리
- `delivery_unknown`과 Retry 정책
- Grafana/Loki를 이용한 모니터링과 로그 분석
- 운영 장애 조사와 애플리케이션 측 보완

기존 업무 서비스와 Flutter 앱은 E2E 흐름에 포함되지만, 이 저장소에서는 그 내부 구현 전체를
제 소유 범위로 잡지 않는다.

## 운영 중 실제로 문제였던 것

FCM 요청 한 번을 보내는 코드보다 운영 중 상태와 실패 의미가 더 어려웠다.

1. access token 만료 시점의 외부 OAuth 지연이 발송 요청으로 번진 문제
2. 공통 API 두 인스턴스의 token refresh 경합
3. 다수 대상 순차 발송의 지연 누적
4. 한 건의 실패가 배치 전체로 번질 수 있는 문제
5. `UNREGISTERED`와 시스템 장애를 같은 실패로 보기 어려운 문제
6. 두 인스턴스 로그가 같은 경로에 섞여 분석 근거를 믿기 어려웠던 문제
7. 프로세스는 떠 있지만 Redis connection이 복구되지 않은 문제
8. timeout/502/504에서 요청 전달 여부를 확정할 수 없어 Retry가 중복 알림 위험이 된 문제
9. Provider 결과와 PushLog/Redis 후처리 실패가 같은 exception path에 섞인 문제

문서는 “무엇이 있었는지 → 어떻게 범위를 좁혔는지 → 무엇을 바꿨는지 → 어디까지 검증했는지” 순서로 적는다.

## 공개하지 않는 것

- 회사·조직·센터·내부 시스템의 실제 이름
- 운영 API 경로와 요청 원문
- 호스트명, IP, VIP, 방화벽 규칙과 세부 네트워크 주소
- 실제 Redis key와 운영 시간·TTL·재시도 횟수 같은 설정값
- credential, access token, service account, private key
- 운영 로그 원문, 사용자 정보, 단말 식별정보, 민감 payload
- 회사 소스코드와 전체 topology

수치도 경험을 설명하는 데 꼭 필요하지 않다면 공개하지 않는다. 예제 값은 모두 공개용 값이다.

## AI를 사용한 범위

문서 구조화, 문장 다듬기, Mermaid 다이어그램, 영문 번역에는 AI를 활용했다.
사실관계, 기술 판단, 장애 대응 순서와 담당 범위는 실제 업무 기록을 기준으로 검토했다.

원래 구현에 없던 서비스를 추가하거나, 아직 검증하지 않은 개선을 완료된 결과처럼 쓰지 않는 것을
문서 작성 원칙으로 둔다.
