# MacroTile

매크로 하나를 64px 색 타일과 이름으로 보여 주는 버튼이며, 진행 도구의 매크로 탭(격자 보기, 목록 보기)에 씁니다. 누르면 매크로의 동작이 바로 실행됩니다.

## 쓰는 곳

- 진행 도구 매크로 탭 격자 보기(Macros, Overlays): 타일 `ll-macro`.
- 같은 탭의 목록 보기(Macros): 30px 줄 `ll-macro-row`.

## 쓰지 않는 곳

- 예배 순서 항목의 "시작할 때" 드롭다운 안의 22px 매크로 칸: Select의 `ll-select__tile`을 씁니다.
- 동작 팔레트의 동작 줄: 목록 줄(ListRow)을 씁니다.
- 퀵 실행 목록: 목록 줄을 씁니다.

## 구성

- 색: 이름표 색 8가지 중 하나(`data-color`, LabelChip의 색 연결). 매크로에는 "색 없음"이 없습니다.
- 타일 `ll-macro__tile`: 64×64, 모서리 `radius-tile`(14), 바탕 `label-*`, 가운데 아이콘 `size-icon-28` `text-on-label`.
- 이름 `ll-macro__name`: 타일 아래 `space-8`, `label`(12/16) `text-2`, 가운데 정렬, 두 줄까지(넘치면 말줄임), `word-break: keep-all`.
- 예약 표시 `ll-macro__clock`: 시작할 때 실행하거나 시각을 정한 매크로에만. 타일 오른쪽 위 −6px에 20px 원, 바탕 `bg-control`, 2px `bg-panel` 고리, 12px `clock` 아이콘 `text`. 시각은 title 툴팁으로.
- 새 매크로 자리 `ll-macro--new`: 같은 64px 틀에 1px 점선 `line-control`, 24px `plus` 아이콘과 이름 "새 매크로" 모두 `text-3`. 격자 맨 끝.
- 격자 `ll-macro-grid`: `repeat(auto-fill, minmax(76px, 1fr))`, 틈 세로 `space-16` 가로 `space-8` 이상, 칸 가운데 정렬. 패널 안쪽(머리글 아래 도구 줄 다음) 위 10, 좌우와 아래 `panel-inset`. 오른쪽 열 480(안쪽 452)에서 5열, 360에서 4열이 됩니다.
- 목록 줄 `ll-macro-row`: 목록 줄 규칙(높이 `size-row` 30, 좌우 `panel-inset`, 글자 `body`, 앞 칸과 글자 사이 `space-10`)에 아이콘 대신 20×20 색 칸(`radius-md`, 14px 아이콘 `text-on-label`). 오른쪽 부가 정보 `caption` `text-3`: 예약 시각(12px `clock` + "10:30"), 동작 수("동작 4개"), 둘 사이 `space-10`.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
|---|---|---|---|
| 타일 `ll-macro` | 64 + 8 + 이름(16 또는 32) | `label` | 격자 보기 |
| 새 매크로 `ll-macro--new` | 같음 | `label` `text-3` | 격자 끝 |
| 목록 줄 `ll-macro-row` | 30 `size-row` | `body`, 부가 `caption` | 목록 보기 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
|---|---|---|---|
| 기본 | `label-*` | 아이콘 `text-on-label`, 이름 `text-2` | |
| 마우스 올림 | 같음 | 같음 | 2px 틈(`bg-panel`) + 1px `line-control` |
| 마지막 실행 | 같음 | 이름 `text`, 굵기 600 | 2px 틈 + 2px `text` |
| 고름(편집, 우클릭 메뉴) | 같음 | 같음 | 2px 틈 + 2px `accent`. 마지막 실행 고리보다 우선 |
| 포커스 | 같음 | 같음 | 타일에 `outline: 2px solid accent`, offset 5px |
| 예약 | 같음 | 같음 | 오른쪽 위 시계 원 |
| 새 매크로 마우스 올림 | 틀 안 `bg-raised` | `text-3` | |
| 목록 줄 마우스 올림 / 고름 | `bg-raised` / `selection` | `text`, 부가 `text-3` / `text-on-selection` | 마지막 실행은 이름 굵기 600 |

마지막 실행 고리는 시안 그대로 흰색입니다. 매크로는 화면에 "나가 있는" 것이 아니라 한 번 실행되는 동작이라 `live` 빨강을 쓰지 않습니다. 고름은 썸네일과 같은 `accent`이고, 색 타일이라 고리 앞에 2px 틈을 둡니다.

## 동작

- 누르면 바로 실행합니다. 확인을 묻지 않습니다. 실행하면 마지막 실행 고리가 그 타일로 옮겨 갑니다.
- 우클릭하면 매크로 메뉴(실행, 이름 바꾸기, 아이콘 바꾸기, 색, 동작 추가 …, 삭제)를 열고, 열려 있는 동안 그 타일을 고름 상태로 둡니다.
- 격자와 목록은 `role="listbox"`, 항목은 `role="option"`. 화살표 키로 옮기고 Enter, Space로 실행합니다. Shift + F10이나 메뉴 키로 우클릭 메뉴를 엽니다.
- `aria-label`은 이름과 예약을 씁니다: "예배 시작, 10:30에 실행".
- 상태 속성: 마지막 실행 `data-state="last-run"`, 고름 `aria-selected="true"`.

## 글쓰기

- 이름은 예배 순서의 순간을 가리키는 짧은 명사입니다: "예배 시작", "찬양", "말씀", "광고", "헌금", "영상", "축도", "예배 끝".
- 목록 줄 부가 정보는 "동작 4개"처럼 수만 씁니다. 동작 내용은 우클릭 메뉴의 동작 편집에서 봅니다.

## 구현 메모

- `<MacroTile name="찬양" icon="song" color="teal" lastRun selected scheduled="10:30" onRun onContextMenu />`
- `<MacroRow …같은 props… actionCount={2} />`, `<MacroGrid>`
- 클래스: `ll-macro-grid`, `ll-macro`, `ll-macro__tile`, `ll-macro__name`, `ll-macro__clock`, `ll-macro--new`, `ll-macro-row`, `ll-macro-row__swatch`, `ll-macro-row__name`, `ll-macro-row__meta`.
- 버튼 기본 글자 초기화(`.ll-root button { color: inherit }`)보다 앞서도록 블록 규칙을 `:is(.ll-root, .ll-preview) .ll-macro`로 한 단 올려 두었습니다.

## 시안과 달라진 점

- Macros, Overlays 격자: 이름 #cfcfcf 500 → `text-2` 400(마지막 실행은 `text` 600 그대로), 새 매크로 점선 #4a4a4a → `line-control`, 새 매크로 hover는 버튼 전체(모서리 6) → 64px 틀 안만. 타일 hover 없음 → 2px 틈 + 1px `line-control`. 고름 상태가 없음 → 2px 틈 + 2px `accent`.
- Macros 목록 보기: 34px 색 칸 + 동작 칩 줄(두 줄, 줄마다 9px 위아래 여백) → 30px 목록 줄 + 20px 색 칸 + "동작 4개". 마지막 실행 줄 바탕 #232323 → 이름 굵기 600만.
