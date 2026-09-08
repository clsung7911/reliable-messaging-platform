# 기존 Async 구조에서 Push 실행 자원만 격리

## 상황

Java Push 호출은 리팩토링 전부터 Event Publisher와 Async Listener 뒤에서 HTTP 호출을 수행하는 비동기 구조였다.

그래서 이번 작업을 "동기 Push를 비동기로 바꿨다"고 표현하지 않는다.

## 문제

비동기 구조여도 Push 작업이 다른 처리와 Executor나 HTTP 정책을 공유하면,
외부 API 지연과 saturation의 영향이 다른 요청 흐름으로 번질 수 있다.

## 판단

기존 Controller / Helper / Event 구조는 유지하고:

- Push 전용 Executor
- Push 전용 HTTP Client

만 분리한다.

Executor 포화 시 요청 스레드가 대신 Push HTTP를 실행하는 fallback은
비동기 격리 목적을 깨뜨릴 수 있어 사용하지 않는다.

## 왜 전체 구조를 갈아엎지 않았나

이번 목표는 새로운 메시징 시스템 구축이 아니라,
운영 중인 기존 구조에서 Push 장애의 영향 범위를 줄이는 것이었다.

Queue 기반 구조가 필요할 정도의 durable backlog/replay 요구는 이번 범위에 없었다.

## 선택의 대가

- Executor가 가득 차면 Push Task가 reject될 수 있다.
- 일부 DB/Redis 조회와 대상 결정은 비동기 실행 전 요청 흐름에 남아 있다.
- Resource isolation은 병목 제거와 같은 말이 아니다.

## 현재 상태

코드 변경 완료.
전체 DEV E2E와 운영 검증은 PENDING이다.
