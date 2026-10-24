# Notification

앱이 스스로 알려야 하는 일을 오른쪽 위 카드로 보입니다. 출력 모니터가 빠진 것 같은 경고는 해결될 때까지 남고, 다시 연결됨 같은 정보는 6초 뒤 닫힙니다.

## 쓰는 곳

- 경고: 출력 화면의 모니터 연결 끊김("무대 모니터 연결 끊김", 창으로 표시 중)
- 정보: 빠졌던 모니터가 다시 연결됨("무대 모니터 다시 연결됨")

## 쓰지 않는 곳

- 장 하나, 미디어 하나의 문제(미디어 파일 없음): 그 자리에서 보입니다. 미디어 칸은 `MediaTile`, 썸네일은 `SlideThumbnail`의 파일 없음 모양, 목록 줄은 `ListRow`의 경고 아이콘. 알림 카드를 띄우지 않습니다.
- 사용자가 방금 한 일의 결과(지움, 저장됨): 띄우지 않습니다. 저장은 상태 표시줄의 "23:41 저장됨"이 알립니다.
- 답이 필요한 것: `AlertDialog`를 씁니다.

## 구성

- 자리 `ll-notice-stack`: 툴바 아래 `panel-gap`(4px), 창 오른쪽 4px. 보통 창은 위 90px(30 + 56 + 4), 좁은 창(`--compact`)은 74px(30 + 40 + 4). 너비는 오른쪽 열과 같은 `col-right`(480px), 좁은 창 `col-right-compact`(360px). 쌓임 `z-notification`(대화상자와 막보다 위).
- 카드 `ll-notice`: 바탕 `bg-raised`, 모서리 `radius-2xl`, 그림자 `shadow-dialog`, 안쪽 위 12 오른쪽 8 아래 12 왼쪽 14, 부품 사이 `space-12`.
  - 아이콘 `ll-notice__icon`: 18px. 경고는 `warning`, 정보는 `text-2`. 경고 카드는 왼쪽 안쪽에 3px `warning` 막대를 긋습니다.
  - 제목 줄 `ll-notice__head`: 제목 `ll-notice__title`(`title` 13/18/600) + 시각 `ll-notice__time`(`label` `text-3`), 사이 `space-10`.
  - 부가 줄 `ll-notice__meta`: 제목 줄 아래 `space-2`, `label` `text-2`, 사이 `space-10`, 화살표 `arrow` 12px `text-3`("모니터 3 → 창으로 표시 중").
  - 동작 `ll-notice__actions`: 글 아래 `space-10`, sm 보조 버튼(앞 아이콘 14px), 사이 `space-6`, 두 개까지.
  - 닫기 `ll-notice__close`: 26×26, `x` 16px `text-2`, 4px 위로 올려 제목 줄 가운데에 맞춥니다. 카드가 `bg-raised`라서 마우스 올림 바탕은 `bg-control-hover`입니다.
- 쌓기: 새 알림이 맨 위, 사이 4px, 최대 3장. 넘치면 가장 오래된 정보 알림부터 닫습니다. 같은 원인(같은 화면, 같은 모니터)의 알림은 새로 쌓지 않고 그 카드를 바꿉니다(끊김 → 다시 연결됨).

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 경고 | 96 (12 + 36 + 10 + 26 + 12) | title 13/18/600, label | 모니터 연결 끊김 |
| 정보 | 60 (12 + 36 + 12) | title, label | 다시 연결됨 |
| 좁은 창 | 같음, 너비 360 | 같음 | 1366×768 등 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 경고 | `bg-raised` | 아이콘 `warning` | 왼쪽 3px `warning` 막대. 해결되거나 닫을 때까지 남음. `role="alert"` |
| 정보 | `bg-raised` | 아이콘 `text-2` | 6초 뒤 닫힘. `role="status"` |
| 포인터 올림, 포커스 안에 있음 | 그대로 | 그대로 | 닫힐 시간을 멈추고, 벗어나면 6초를 다시 셉니다 |
| 닫기 마우스 올림 | `bg-control-hover` | `text-2` | 100ms |
| 닫기 누름 | `bg-control-hover` | `text` | |
| 닫기, 동작 포커스 | 그대로 | 그대로 | outline 2px `accent`, offset 1px |
| 나타남 | | | 120ms 페이드, `prefers-reduced-motion`이면 바로 |

## 동작

- 미리보기를 오래 가리지 않습니다.
  - 남는 경고 카드가 있는 동안 오른쪽 열은 카드 묶음 높이 + 4px만큼 아래로 내려갑니다. 미리보기 패널과 그 조작은 가려지지 않습니다(Problems 시안과 같은 배치). 높이가 모자라면 `Layout` 규칙대로 진행 도구가 먼저 줄어듭니다.
  - 정보 카드는 열을 내리지 않고 그 자리에 떠서 6초 뒤 닫힙니다. 잠깐 가리는 곳은 미리보기 머리글과 화면 위쪽 일부입니다.
  - 경고를 닫기(×)로 닫으면 카드만 사라지고 오른쪽 열은 제자리로 돌아갑니다. 문제는 툴바 출력 버튼의 `warning` 표시와 상태 표시줄 글자("무대 화면 창으로 표시 중")로 남고, 상태 표시줄의 그 글자를 누르면 카드를 다시 엽니다.
- 문제가 풀리면 경고 카드는 정보 카드("무대 모니터 다시 연결됨")로 바뀌고 6초 뒤 닫힙니다.
- 알림은 포커스를 옮기지 않습니다. 카드의 동작과 닫기 버튼은 Tab 순서에서 오른쪽 열 앞에 들어갑니다. Esc로 닫지 않습니다(Esc는 메뉴와 대화상자가 씁니다).
- 대화상자가 열려 있어도 같은 자리, 막 위에 보이고 동작 버튼을 누를 수 있습니다.
- 소리를 내지 않습니다.
- aria: 경고 `role="alert"`, 정보 `role="status"`, 카드에 `aria-labelledby`로 제목.

## 글쓰기

- 제목은 무엇이 어떻게 되었는지 명사구로, 마침표 없이: "무대 모니터 연결 끊김", "무대 모니터 다시 연결됨".
- 시각은 24시간, 초 없이: "11:24".
- 부가 줄은 지금 상태: "모니터 3 → 창으로 표시 중".
- 동작은 동사로 두 개까지: "모니터 다시 찾기", "창 보기".
- 사과, 감탄, 설명 문장을 쓰지 않습니다.

## 구현 메모

- `<NotificationStack compact={isCompact} />` + `notify({ kind: 'warning' | 'info', key: 'screen:stage', icon: 'plug', title: '무대 모니터 연결 끊김', time: '11:24', meta: ['모니터 3', '창으로 표시 중'], actions: [{ icon: 'refresh', label: '모니터 다시 찾기' }, { icon: 'open', label: '창 보기' }] })`. 같은 `key`면 카드를 바꿉니다.
- 오른쪽 열 밀어 내기: 남는 경고 카드 묶음의 높이를 재어(ResizeObserver) 오른쪽 열의 `padding-top`에 높이 + 4px을 줍니다. 정보 카드만 있을 때는 0입니다.
- 알림 층은 모달의 `inert` 밖에 둡니다.
- 클래스: `ll-notice-stack`, `ll-notice-stack--compact`, `ll-notice`, `ll-notice__icon`, `ll-notice__body`, `ll-notice__text`, `ll-notice__head`, `ll-notice__title`, `ll-notice__time`, `ll-notice__meta`, `ll-notice__actions`, `ll-notice__close`. 경고는 `data-state="warning"`.

## 시안과 달라진 점

- Problems 알림 카드: 바탕 #1c1c1c(`bg-panel`), 모서리 5, 그림자 없음 → `bg-raised`, `radius-2xl`, `shadow-dialog`. 왼쪽 3px `warning` 막대는 그대로. 닫기 아이콘 14px #8c8c8c → 16px `text-2`. 부가 줄 화살표 #6e6e6e → `text-3`. 제목 줄과 부가 줄 사이 3 → 2.
