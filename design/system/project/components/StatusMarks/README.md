# StatusMarks

LIVE 배지, 상태 점, 개수 배지, 진행 막대 네 가지 작은 표시이며, 다른 컴포넌트 안에 넣어 출력 중, 연결 상태, 개수, 진행을 알립니다.

## 쓰는 곳

- LIVE 배지 `ll-badge ll-badge--live`: 지금 출력 중인 목록 줄의 오른쪽 끝(예배 순서의 "만복의 근원 하나님").
- 상태 점 `ll-dot`: 상태 표시줄의 출력 상태(본 화면 60fps), 툴바 출력 버튼 아이콘의 오른쪽 위(`ll-dot--cut`), 화면 설정의 NDI 연결.
- 개수 배지 `ll-count`: 패널 탭 이름 뒤의 개수(진행 도구 "표시 중 3").
- 진행 막대 `ll-progress`: 미디어 복사(Media), 가져오기처럼 끝이 있는 작업. `ll-progress--playback`은 오디오, 영상의 재생 위치.

## 쓰지 않는 곳

- 상태를 설명하는 글자 칩("출력 중", "정지 화면", "파일 없음"): 만들지 않습니다(규칙 18). 출력 중은 빨강 고리나 LIVE 배지, 경고는 주황 아이콘이나 테두리, 이유는 툴팁입니다.
- 썸네일, 미디어 칸, 칩의 출력 중 표시: 그 컴포넌트의 `ring-live`를 씁니다. 그 위에 LIVE 배지를 또 얹지 않습니다.
- 목록 줄 앞에 상태 점을 붙이는 것: LIVE 배지를 씁니다.
- 끌어서 위치를 바꾸는 재생 위치(시간 막대 손잡이): Slider를 씁니다.

## 구성

- LIVE 배지: 높이 16, 좌우 `space-4`, 모서리 `radius-sm`, 바탕 `live`, 글자 `text-on-fill` `micro`(10/12/700), 자간 0.04em. 글자는 영문 대문자 "LIVE" 하나입니다.
- 상태 점: 6×6, `radius-full`. `ll-dot--ok`(`ok`), `--warning`(`warning`), `--live`(`live`), `--off`(`line-strong`). 아이콘 위에 얹을 때는 `ll-dot--cut`으로 `ring-dot-cut`(2px `bg-app`)을 더하고, 위치는 부모가 정합니다(18px 아이콘 기준 right −4, top −3). 글자 옆에 둘 때 사이 `space-6`.
- 개수 배지: 높이 18, 최소 너비 18, 좌우 `space-4`, 모서리 `radius-sm`, 바탕 `selection`, 글자 `text-on-selection` `caption-strong`(11/14/600), tabular-nums. 탭 이름과 사이 `space-6`(탭이 정함).
- 진행 막대: 높이 4, 모서리 `radius-xs`, 바닥 `line-strong`, 막대 `ll-progress__bar`는 `accent`(재생 위치는 `text`). 길이는 막대의 `width`(%)로 줍니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| `ll-badge--live` | 16 | `micro` | 목록 줄 |
| `ll-dot` | 6 | 없음 | 상태 표시줄, 툴바 출력 버튼, NDI |
| `ll-dot--cut` | 6 + 2px 고리 | 없음 | 아이콘 위 |
| `ll-count` | 18 | `caption-strong` | 패널 탭 |
| `ll-progress` | 4 | 없음 | 복사, 가져오기 |
| `ll-progress--playback` | 4 | 없음 | 오디오, 영상 재생 위치(보기만) |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 배지: 출력 중 | `live` | `text-on-fill` | 고른 줄(`selection`) 위에서도 같음 |
| 점: 정상 | `ok` | | 점 외에는 `ok`를 쓰지 않습니다 |
| 점: 경고 | `warning` | 옆 글자도 `warning` | 이유는 툴팁 |
| 점: 출력 중(켜짐) | `live` | | 툴바 출력 버튼 |
| 점: 꺼짐 | `line-strong` | 버튼 글자 `text-off` | 툴바 출력 버튼 |
| 개수: 0 | 보이지 않음 | | 0이면 배지를 숨깁니다 |
| 막대: 0–100% | `line-strong` 위 `accent` | | 끝나면 막대를 거둡니다 |

## 동작

- 배지와 점은 장식이 아니라 정보이므로 읽히는 이름을 줍니다. 배지는 글자가 그대로 읽히고, 점은 부모에 이름을 줍니다(예: 출력 버튼 `aria-label="본 화면 출력 켜짐"`, 상태 표시줄 항목 title "모니터 3 연결 끊김, 창으로 표시 중"). 점 자체는 `aria-hidden="true"`.
- 개수 배지는 탭 이름에 이어 읽히도록 탭의 `aria-label`을 "표시 중 3개"로 줍니다.
- 진행 막대는 `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`, 대상 이름을 `aria-label`로("부활절 배경.mp4 복사"). 재생 위치는 `aria-valuetext="1:24 / 3:42"`.
- 막대 길이가 바뀔 때 움직임을 넣지 않습니다(받은 값대로 바로 그립니다).

## 글쓰기

- 배지 글자는 "LIVE" 하나만 씁니다. 다른 배지를 만들지 않습니다.
- 개수 배지에는 숫자만 씁니다. 99를 넘으면 "99+".
- 점 옆 글자는 화면 이름과 값만 씁니다("본 화면 60fps"). "정상", "연결됨" 같은 말을 붙이지 않습니다.

## 구현 메모

- `<LiveBadge />`, `<StatusDot tone="ok|warning|live|off" cut />`, `<CountBadge value={3} />`, `<Progress value={62} variant="task|playback" label="부활절 배경.mp4 복사" />`
- 클래스(다른 컴포넌트가 이 이름을 그대로 씁니다): `ll-badge ll-badge--live`, `ll-dot ll-dot--ok|--warning|--live|--off`, `ll-dot--cut`, `ll-count`, `ll-progress` + `ll-progress__bar`, `ll-progress--playback`.

## 시안과 달라진 점

- ShowH, Problems 예배 순서 LIVE 배지: 좌우 5 → `space-4`. Compact: 15px, 9px, 좌우 4 → 16px, 10px(`micro`).
- ShowH, PrepService, Media 툴바 출력 버튼 점 7px → 6px.
- ShowH, Compact, Overlays, Macros 탭 개수: 16px 둥근 알약 #3a3a3a 글자 #ececec 10px → 18px `radius-sm` `selection` 글자 `text-on-selection` 11px 600.
- Compact 진행 도구 "더 보기" 뒤의 개수 알약(5): 없앱니다.
- Media 복사 막대 3px #2b2b2b 위 #3d8bf0 → 4px `line-strong` 위 `accent`, `radius-xs`. Overlays 오디오 탭의 재생 위치 막대(#3a3a3a 위 #ececec, 모서리 2) → `ll-progress--playback`(같은 값을 토큰으로). Media 속성 패널의 구간 막대는 손잡이가 있어 이 컴포넌트가 아닙니다.
