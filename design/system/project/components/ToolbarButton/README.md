# ToolbarButton

툴바에 놓는 버튼입니다. 아이콘 위에 이름을 두며, 작업 공간 탭, 미디어 열고 닫기, Look 고르기, 세 화면의 출력 켜고 끄기에 씁니다.

## 쓰는 곳

- 작업 공간 탭: 진행, 준비, 화면 설정
- 보기 켜고 끄기: 미디어(미디어 칸 열고 닫기)
- 메뉴를 여는 동작 버튼: Look 고르기(평상시)
- 화면 출력: 본 화면, 무대, 방송 자막
- 좁은 창(1366)의 40px 툴바에서는 같은 버튼을 좁은 형태로 씁니다.

## 쓰지 않는 곳

- 패널과 대화상자 안: Button, IconButton.
- 툴바의 검색 칸: TextField(`ll-field`). 배치는 Toolbar가 정합니다.
- 출력 상태를 글자나 칩으로 덧붙이지 않습니다. 점과 아이콘 색만 씁니다. 자세한 이유는 툴팁에 씁니다.

## 구성

- 높이 `size-toolbar-button`(48px), 모서리 `radius-lg`(5px), 바탕 없음.
- 아이콘 `size-icon-18`을 위에, 이름 `toolbar-label`(11/14/500)을 아래에 두고 사이 `space-4`. 아이콘과 이름은 가운데 정렬.
- 작업 공간 탭: 너비 64, 좌우 여백 없음.
- 동작 버튼과 출력 버튼: 좌우 `space-8`, 최소 너비 64. Look처럼 메뉴를 여는 버튼은 좌우 `space-12`이고, 아이콘 오른쪽 `space-4`에 `size-icon-12` 아래 화살표(`text-3`)를 둡니다.
- 출력 버튼의 상태 점: 6px 원(`radius-full`), 아이콘의 오른쪽 위 모서리에 걸침(위 −3px, 오른쪽 −4px). `ring-dot-cut`으로 아이콘과 떼어 놓고, 버튼에 마우스를 올리거나 누르면 고리 색도 버튼 바탕(`bg-toolbar-hover`, `bg-raised`)으로 바꿉니다.
- 아이콘: 진행 `slides`, 준비 `edit`, 화면 설정 `gear`, 미디어 `film`, Look `layers` + `down`, 본 화면과 무대 `mplay`, 방송 자막 `capture`.
- 좁은 형태: 높이 32, 아이콘 `size-icon-16`을 이름 왼쪽에, 사이 `space-6`, 이름 `label`(12/16), 좌우 `space-8` `space-10`. Look은 이름 뒤에 화살표를 두고 오른쪽 `space-6`. 미디어는 아이콘만 32×32. 작업 공간 탭도 너비를 글자에 맞춥니다.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 작업 공간 탭 | `size-toolbar-button` 48, 너비 64 | `toolbar-label` | 진행, 준비, 화면 설정 |
| 보기 켜고 끄기 | 48, 최소 64 | `toolbar-label` | 미디어 |
| 메뉴 동작 | 48, 좌우 12 | `toolbar-label` | Look(평상시) |
| 화면 출력 | 48, 최소 64 | `toolbar-label` | 본 화면, 무대, 방송 자막 |
| 좁은 형태 | 32 | `label` | 툴바 40(`size-toolbar-compact`)의 모든 버튼 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본(동작 버튼) | 없음 | `text` | 화살표 `text-3` |
| 작업 공간 탭 고르지 않음 | 없음 | `text-3` | |
| 작업 공간 탭 고름 | `bg-raised` | `text` | 마우스를 올려도 그대로 |
| 미디어 켜짐 / 꺼짐 | 없음 | `text` / `text-3` | 바탕으로 켜짐을 보이지 않습니다 |
| 출력 켜짐 | 없음 | `text` | `live` 점 6px + `ring-dot-cut` |
| 출력 꺼짐 | 없음 | `text-off` | 점 없음(회색 점을 그리지 않습니다) |
| 출력 모니터 없음 | 없음 | 아이콘 `warning`, 이름 `text` | `warning` 점 6px + `ring-dot-cut` |
| 마우스 올림 | `bg-toolbar-hover` | 그대로 | 100ms ease-out, 점 고리도 같은 색 |
| 누름, 메뉴 열림(`aria-expanded`) | `bg-raised` | 그대로 | |
| 포커스 | 그대로 | 그대로 | 키보드 포커스에만 `outline: 2px solid accent`, offset 1px |
| 쓸 수 없음 | 없음 | `text-off` | hover 없음, 이유는 툴팁으로 |

## 동작

- 작업 공간 탭: 세 탭을 `role="tablist"`(이름 "작업 공간")로 묶고 각 탭은 `role="tab"` + `aria-selected`. 왼쪽/오른쪽 화살표로 옮기며 바로 바꿉니다. Tab은 고른 탭 하나에만 멈춥니다.
- 미디어: `aria-pressed`로 켜짐을 알립니다. 툴팁 "미디어 열기" / "미디어 닫기".
- Look: `aria-haspopup="menu"`, 메뉴가 열리면 `aria-expanded="true"`. 메뉴는 버튼 아래 왼쪽 끝에 맞춰 엽니다. 이름에는 지금 Look 이름(평상시)을 씁니다.
- 화면 출력: 누르면 그 화면의 출력을 켜거나 끕니다. `aria-pressed`는 출력을 켜 둔 상태(켜짐과 모니터 없음은 `true`), 그리는 상태는 `data-state="live|off|warning"`으로 줍니다. 세 버튼은 `role="group"`(이름 "화면 출력")으로 묶습니다.
- 모니터를 다시 찾으면 바로 켜짐으로 돌아갑니다. 모니터 없음 상태에서 누르면 출력을 끕니다.
- 툴팁(600ms 뒤, Tooltip 규칙):
  - 켜짐: "본 화면 출력 끄기 (모니터 2)", "무대 화면 출력 끄기 (모니터 3)", "방송 자막 출력 끄기 (NDI)"
  - 꺼짐: "본 화면 출력 켜기 (모니터 2)"
  - 모니터 없음: "본 화면: 모니터 2를 찾을 수 없습니다"
- 좁은 형태에서 이름을 숨긴 버튼(미디어)은 `aria-label`을 줍니다.

## 글쓰기

- 이름은 한두 낱말의 명사입니다: 진행, 준비, 화면 설정, 미디어, 본 화면, 무대, 방송 자막.
- 출력 버튼의 툴팁은 "누르면 일어날 일 (대상)"으로 씁니다: "본 화면 출력 끄기 (모니터 2)". 대상은 화면 설정의 출력 대상 이름을 그대로 씁니다.
- 문제가 있을 때의 툴팁은 "화면 이름: 무엇이 안 되는지"로 씁니다: "본 화면: 모니터 2를 찾을 수 없습니다". 해결 방법을 길게 적지 않습니다.

## 구현 메모

```jsx
<ToolbarTab icon="slides" label="진행" selected={ws === 'show'} onSelect={() => setWs('show')} />
<ToolbarButton icon="film" label="미디어" pressed={binOpen} onPressedChange={setBinOpen} />
<ToolbarButton icon="layers" label={look.name} menu expanded={lookOpen} />
<OutputToggle icon="mplay" label="본 화면" target="모니터 2" state="live" onToggle={toggleMain} />
<OutputToggle icon="capture" label="방송 자막" target="NDI" state="off" compact />
```

- `OutputToggle`의 `state`: `'live'` | `'off'` | `'warning'`. 툴팁 문구는 `label`(툴팁에서는 "무대 화면"처럼 전체 이름), `target`, `state`로 만듭니다.
- 모든 버튼에 `compact`(좁은 형태) prop을 둡니다. 좁은 형태에서는 화살표를 이름 뒤로 옮기므로 마크업 순서가 다릅니다.
- 클래스: `ll-tbtn`, 변형 `ll-tbtn--tab` `ll-tbtn--toggle` `ll-tbtn--menu` `ll-tbtn--output`, 좁은 형태 `ll-tbtn--compact`, 아이콘만 `ll-tbtn--icon-only`. 부품 `ll-tbtn__icon`(아이콘, 화살표, 점을 묶음), `ll-tbtn__chevron`, `ll-tbtn__dot`, `ll-tbtn__label`.

```html
<button class="ll-tbtn ll-tbtn--output" aria-pressed="true" data-state="live">
  <span class="ll-tbtn__icon"><span class="ll-i ll-i-mplay"></span><span class="ll-tbtn__dot"></span></span>
  <span class="ll-tbtn__label">본 화면</span>
</button>
```

## 시안과 달라진 점

- 모든 보드(assemble.js `toolbar()`): 출력 점 7px(오른쪽 −5, 위 −3) → 6px(오른쪽 −4, 위 −3).
- ShowH, Bible: 꺼진 출력의 회색 점(#3a3a3a) → 점 없음. 꺼진 출력 글자 #6e6e6e는 `text-off` 그대로.
- Problems: 모니터 없음 출력의 바탕 #2a2210과 이름까지 칠한 #e3a23b → 바탕 없음, 아이콘과 점만 `warning`, 이름 `text`. 점 고리 #2a2210 → `ring-dot-cut`. 툴팁 "모니터 3 연결 끊김, 창으로 표시 중" → "무대 화면: 모니터 3을 찾을 수 없습니다".
- 모든 보드: Look 화살표 14px → 12px.
- Compact: 작업 공간 탭의 바닥 홈(#161616, 안쪽 2, 모서리 6) 없앰. 고른 탭 #2f2f2f → `bg-raised`. 탭, Look, 출력 버튼 높이 30 → 32, 모서리 4 → `radius-lg`. 탭 이름 굵기 500 → 400. 미디어 34×34 → 32×32.
