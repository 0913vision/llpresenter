# Slider

값을 끌어서 정하는 가로 슬라이더입니다. 장 격자 아래의 썸네일 크기와 진행 도구, 미디어 속성의 음량에 씁니다.

## 쓰는 곳

- 진행 화면, 준비 화면, 미디어의 격자 아래 줄(32px): 썸네일 크기(1~5 다섯 단계, 라이브러리 곡 편집은 1~3)
- 진행 도구 오디오 탭: 음량
- 미디어 속성의 소리 묶음: 음량

## 쓰지 않는 곳

- 정확한 숫자가 필요한 값(글자 크기, 줄 간격, 여백, 가장자리 여백): `TextField`의 숫자 칸을 씁니다.
- 재생 위치(시간 막대): 재생 막대는 따로 정합니다. 이 슬라이더를 늘려 쓰지 않습니다.

## 구성

- 네이티브 `input[type="range"]`를 `appearance: none`으로 다시 그립니다.
- 누르는 높이 16px, 줄 4px `radius-full`.
- 채운 부분 `text`, 남은 부분 `line-strong`. 시안의 `accent-color: #ececec`를 그대로 옮긴 것입니다. 파랑(`accent`)은 쓰지 않습니다. 슬라이더는 상태가 아니라 크기와 양을 나타내므로, 선택과 포커스에만 쓰는 파랑과 섞지 않습니다.
- 손잡이 12×12 원, `text`.
- 너비: 보통 창 120px, 좁은 창과 진행 도구 음량 96px(`ll-slider--compact`), 속성 칸에서는 조작 칸을 채움(`ll-slider--block`).
- 앞 아이콘 줄 `ll-slider-row`: 아이콘 14px `text-3`, 슬라이더와 8px. 썸네일 크기는 `grid`, 음량은 `audio`.
- 채운 비율은 CSS 변수 `--ll-value`(0%~100%)로 넘깁니다. 값이 바뀔 때마다 `(value − min) / (max − min)`으로 다시 넣습니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 기본 | 16(줄 4) | - | 격자 아래 줄 썸네일 크기, 너비 120 |
| compact | 16 | - | 좁은 창 썸네일 크기, 진행 도구 음량, 너비 96 |
| block | 16 | - | 속성 칸 안의 음량, 칸 너비만큼 |

## 상태

| 상태 | 줄 | 손잡이 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | 채움 text, 남음 line-strong | text | |
| 마우스 올림 | 바뀌지 않음 | 바뀌지 않음 | |
| 끄는 중 | 바뀌지 않음 | 바뀌지 않음 | 값은 끄는 동안 바로 적용 |
| 포커스 | 같음 | 1px 틈 + 2px accent 고리 | 고리는 손잡이에만 그립니다. 틈 색은 `--ll-slider-cut`(기본 bg-panel) |
| 쓸 수 없음 | 채움 text-off, 남음 line-strong | text-off | 앞 아이콘도 text-off. 이유는 툴팁(예: 소리가 꺼져 있을 때 음량) |

## 동작

- 줄 어디를 눌러도 그 자리로 손잡이가 옮겨 가고, 그대로 끌 수 있습니다.
- 키보드: 좌우, 위아래 화살표로 한 단계, PageUp/PageDown으로 10%, Home/End로 처음과 끝. 썸네일 크기는 한 단계가 1입니다.
- 썸네일 크기는 끄는 동안 격자가 바로 바뀌고, 음량은 끄는 동안 소리가 바로 바뀝니다.
- aria: 이름이 보이지 않으므로 `aria-label`("썸네일 크기", "음량")을 줍니다. 음량은 `aria-valuetext="70%"`를 줍니다.

## 글쓰기

- 슬라이더 옆에 값이나 설명을 글로 쓰지 않습니다. 이름은 앞 아이콘과 `aria-label`, 툴팁으로 알립니다(툴팁 "썸네일 크기", "음량").

## 구현 메모

- `<Slider min={1} max={5} step={1} value={size} onChange aria-label="썸네일 크기" icon="grid" />`
- `<Slider compact min={0} max={100} value={70} aria-label="음량" icon="audio" />`
- 마크업: `span.ll-slider-row > span.ll-i + input[type=range].ll-slider[.ll-slider--compact|--block][style="--ll-value: 25%"]`.
- 포커스 고리의 틈 색이 바탕과 다르면(대화상자 위) `--ll-slider-cut`을 `var(--bg-dialog)`로 바꿉니다.
- 클래스: `ll-slider`, `ll-slider--compact`, `ll-slider--block`, `ll-slider-row`.

## 시안과 달라진 점

- ShowH, PrepService, Reflow, NewService, AddSongs, AddSongsQuick, ServiceImport, ServiceSwitch, ImportEdit, ImportSave, Problems, Media의 썸네일 크기, Compact의 썸네일 크기, Overlays와 Media의 음량: 브라우저 기본 range(`accent-color`) → `ll-slider`(줄 4, 손잡이 12). 너비는 120, 96 그대로.
- ShowH 등 격자 아래 줄: `grid` 아이콘과 슬라이더 사이 10 → 8.
- Overlays 음량: `audio` 아이콘 16 → 14. Media 음량: 아이콘 16 → 14, 사이 10 → 8, 쓸 수 없을 때 `accent-color: #6e6e6e` → 채움과 손잡이 `text-off`.
