# MediaTile

배경 영상이나 그림 하나를 16:9 그림과 이름으로 보여 주는 미디어 칸이며, 진행 화면 아래 미디어 줄과 미디어 화면의 격자에 씁니다.

## 쓰는 곳

- 진행 화면 아래 미디어 줄(ShowH, Problems): 누르면 그 미디어가 배경으로 나갑니다.
- 미디어 화면의 재생목록 격자(Media): 누르면 고르고 오른쪽 속성 패널에 보입니다.

## 쓰지 않는 곳

- 슬라이드 장: SlideThumbnail을 씁니다(장에 넣은 그림도 장이면 썸네일입니다).
- 패널 머리글의 배경 고르기 드롭다운 안의 36×20 작은 그림: Select의 `ll-select__media`를 씁니다.
- 진행 도구 공지, 소품 칸.

## 구성

- 칸 `ll-media`: 버튼. 그림 틀 아래 `space-8`에 이름.
- 그림 틀 `ll-media__frame`: 16:9, 모서리 `radius-md`, 바탕 `bg-well`(그림을 불러오기 전). 그림 `ll-media__img`는 `object-fit: cover`.
- 길이 `ll-media__dur`: 그림 오른쪽 아래 `space-6` 안쪽. 높이 `size-count`(18), 좌우 `space-6`, `radius-sm`, 바탕 `scrim-strong`, 글자 `caption-strong`(11/14/600) `text`, tabular-nums. 반복 재생이면 앞에 12px `loop` 아이콘(사이 `space-4`). 그림(정지 화상)에는 길이를 쓰지 않습니다.
- 이름 `ll-media__name`: `label`(12/16) `text-2`, 한 줄 말줄임.
- 파일 없음 `ll-media__missing`: 틀 바탕을 빗금(`bg-inset`/`bg-well`, 135°, 6px)으로, 가운데 24px `filex` 아이콘 `warning`. 그림과 길이는 숨깁니다.
- 복사 중 `ll-media__busy`: 틀 위에 `scrim`, 가운데 퍼센트(`caption-strong` `text`), 아래 `space-6` 안쪽에 진행 막대(StatusMarks의 `ll-progress`).
- 격자 `ll-media-grid`: 열 수는 패널 바닥 줄의 크기 슬라이더(2–8열, `--ll-cols`), 틈 세로 `space-16` 가로 `space-12`. 바깥 여백은 패널 몸통 `panel-inset`.
- 미디어 줄 `ll-media-strip`: 한 줄, 칸 너비 150 고정(그림 84), 사이 `space-12`, 넘치면 가로로 스크롤. 고리가 잘리지 않게 줄 안쪽 4px 여백을 두고 그만큼 바깥으로 당깁니다. 패널 높이는 머리글 34 + 내용 136 = 170입니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| 격자 칸 | 너비 × 9/16 + 8 + 16 | 이름 `label`, 길이 `caption-strong` | 미디어 화면 |
| 줄 칸 | 84 + 8 + 16 (너비 150) | 같음 | 진행 화면 미디어 줄 |
| 영상(반복) / 영상(한 번) / 그림 | 같음 | 길이 앞 `loop` 있음 / 없음 / 길이 없음 | |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 기본 | 그림 | 이름 `text-2` | |
| 마우스 올림 | 그림 | 이름 `text-2` | 틀 1px `line-control` |
| 고름 | 그림 | 이름 `text` | 틀 `ring-selected` |
| 출력 중(지금 배경) | 그림 | 이름 `text` | 틀 `ring-live`. 고름보다 우선 |
| 포커스 | 그림 | 그대로 | 틀에 `outline: 2px solid accent`, offset 4px |
| 파일 없음 | 빗금 | `filex` 24 `warning` | 출력 중이면 `ring-live`도. 경로는 title 툴팁 |
| 복사 중 | 그림 + `scrim` | 퍼센트 `text`, 이름 `text-3` | 진행 막대 `accent`. 누를 수 없음(`aria-disabled`), hover 없음 |

## 동작

- 미디어 줄에서 누르면 그 미디어를 배경으로 내보냅니다. 미디어 화면에서는 누르면 고르고, 두 번 누르면 내보냅니다.
- 파일 없음 칸을 누르면 "다시 연결" 파일 열기 창을 엽니다. 우클릭 메뉴에도 "다시 연결"을 둡니다. 칸 안에 버튼을 넣지 않습니다.
- 복사 중 칸은 누를 수 없고 우클릭 메뉴에 "복사 멈추기"만 둡니다.
- 격자와 줄은 `role="listbox"`, 칸은 `role="option"` + `aria-selected`. 화살표 키로 옮기고 Enter로 누름과 같게 합니다.
- 상태 속성: `data-state="live"`, `data-state="warning"`, `data-state="busy"`(함께 쓸 때는 띄어 씀).
- 진행 막대는 `role="progressbar"` + `aria-valuenow`.

## 글쓰기

- 이름은 파일 이름에서 확장자를 뺀 것("따뜻한 빛"). 복사 중에는 원래 파일 이름 그대로("부활절 배경.mp4").
- 길이는 "0:30", "1:00", "5:00"처럼 분:초.
- 파일 없음 툴팁: "파일을 찾을 수 없습니다: D:\예배 미디어\배경\따뜻한 빛.mp4". 칸 아래에 "파일 없음" 글자를 붙이지 않습니다.

## 구현 메모

- `<MediaTile name="따뜻한 빛" src={thumb} duration="0:30" loop live selected missing progress={62} onActivate onRelink />`
- `<MediaGrid columns={5}>`, `<MediaStrip>`
- 클래스: `ll-media-grid`, `ll-media-strip`, `ll-media`, `ll-media__frame`, `ll-media__img`, `ll-media__dur`, `ll-media__name`, `ll-media__missing`, `ll-media__busy`.
- 길이 칩 바탕은 지금 `scrim`(0.6)입니다. 밝은 그림 위에서도 글자가 읽히도록 0.72짜리 토큰을 요청해 두었습니다.

## 시안과 달라진 점

- ShowH, Problems 미디어 줄: 출력 중 고리 2px → `ring-live` 3px, 이름 #d6d6d6 → `text-2`(출력 중 `text`), 이름과 그림 사이 7 → 8, 길이 칩 18px 좌우 5, 안쪽 5 → 좌우 6, 안쪽 6, 반복 아이콘 14 → 12. 패널 높이 220 → 170, 칸 너비 고정 150.
- Media 격자: 틈 18/14 → 16/12, 이름 #cfcfcf → `text-2`, 길이 칩 20px → 18px.
- 길이 칩 바탕 rgba(0, 0, 0, 0.72) → `scrim`(토큰 요청 참고).
- Problems 파일 없음 칸: 빗금 #1a1a1a/#151515 → `bg-inset`/`bg-well`, 칸 안 "다시 연결" 20px 버튼과 이름 옆 "파일 없음" 글자 → 없앰(누르면 다시 연결, 이유는 툴팁).
- Media 복사 중 칸: 그림 불투명도 0.35 + 막 0.45 + "복사 중" 글자 → `scrim` + 퍼센트만, 막대 3px #2b2b2b 바닥 끝 → `ll-progress` 4px를 안쪽 6에.
