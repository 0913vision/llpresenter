# Switch

누르는 즉시 적용되는 설정을 켜고 끄는 30×18 스위치입니다. 환경설정, 화면 설정, Look 편집, 무대 배치, 미디어 속성, 텍스트 가져오기 설정 줄에 씁니다.

## 쓰는 곳

- 환경설정: 오류 보고 보내기, 켤 때 화면 출력, 출력 중 절전 막기, 하드웨어 가속, 자동 백업, 절 번호, 자동 확인
- 화면 설정: 항상 위, 절전 막기, 알파 채널
- Look 편집: 그림자, 외곽선 / 무대 배치와 미디어 속성의 켜고 끄기(소리 켜기)
- 텍스트 가져오기의 설정 줄: 이름표 인식

## 쓰지 않는 곳

- 여러 개를 골라 담는 곳(가져올 항목, 복구할 상태): `Checkbox`를 씁니다.
- [확인]을 눌러야 적용되는 대화상자 안의 선택: `Checkbox`를 씁니다.
- 화면 출력 켜기처럼 지금 출력 상태를 바꾸는 큰 조작: 툴바의 화면 출력 단추(`ToolbarButton`)입니다.

## 구성

- 트랙: 30×18, 모서리 `radius-full`. 꺼짐 `line-strong`, 켜짐 `accent-fill`.
- 손잡이: 14×14 원, `text`, 트랙 안 여백 `space-2`. 켜지면 오른쪽으로 12px 옮깁니다.
- 움직임: 트랙 색과 손잡이 위치 100ms ease-out. `prefers-reduced-motion`이면 바로 바뀝니다.
- 속성 줄 안에서는 `PropertyRow`의 조작 칸 왼쪽 끝에 둡니다(이름 왼쪽, 스위치는 조작 칸 시작). 조작 칸 오른쪽 끝으로 밀지 않습니다. 다른 줄의 드롭다운, 입력 칸과 왼쪽 선이 맞아야 합니다.
- 이름 + 스위치 줄 `ll-switch-row`: 설정 줄처럼 여러 조작이 가로로 늘어선 곳. 이름 `label`(12/16) `text-2`, 스위치와 10px.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 스위치 | 18 | - | 한 가지 크기만 둡니다 |
| 속성 줄 | 36(패널) / 38(창) | 이름 label 12/16 text-2 | 환경설정, 화면 설정, Look, 무대, 미디어 |
| 이름 + 스위치 | 18 | label 12/16 text-2 | 텍스트 가져오기 설정 줄 |

## 상태

| 상태 | 바탕(트랙) | 손잡이 | 그 밖 |
| --- | --- | --- | --- |
| 꺼짐 | line-strong | text, 왼쪽 | `aria-checked="false"` |
| 켜짐 | accent-fill | text, 오른쪽 | `aria-checked="true"` |
| 마우스 올림 | 바뀌지 않음 | 바뀌지 않음 | |
| 포커스 | 같음 | 같음 | outline 2px accent, offset 1px(트랙 둘레를 따라 둥글게) |
| 쓸 수 없음 | bg-control | text-off, 위치는 그대로 | 이름도 text-off. 투명도를 낮추지 않습니다. 이유는 툴팁 |

## 동작

- 누르거나 Space로 바꿉니다. 바뀐 값은 바로 저장되고 적용됩니다.
- 이름을 눌러도 바뀝니다(`label for` 또는 `label`로 감싸기).
- 좌우 화살표로는 바꾸지 않습니다. 탭으로 스위치마다 멈춥니다.
- aria: `button[role="switch"][aria-checked]`. 이름은 줄의 이름 글자로 잇습니다(`label for` 또는 `aria-labelledby`).

## 글쓰기

- 이름은 켰을 때 일어나는 일을 짧게 씁니다: "항상 위", "절전 막기", "오류 보고 보내기", "이름표 인식". "~을 사용" "~ 여부" 같은 꼬리를 붙이지 않습니다.
- 스위치 옆에 "켜짐", "꺼짐"을 글로 쓰지 않습니다.

## 구현 메모

- `<Switch checked onChange label="항상 위" />`. 속성 줄 안에서는 `<PropertyRow label="항상 위"><Switch checked /></PropertyRow>`.
- 마크업: `button.ll-switch[role=switch][aria-checked]`(손잡이는 `::after`). 이름 줄은 `label.ll-switch-row`로 감쌉니다.
- 클래스: `ll-switch`, `ll-switch-row`.

## 시안과 달라진 점

- Prefs, Shortcuts, Screens, ScreensNDI, Looks, StageEditor, Media, ImportText의 켜진 트랙: #3d8bf0(`accent`) → `accent-fill`.
- 같은 보드의 손잡이: #fff → `text`(#ececec).
