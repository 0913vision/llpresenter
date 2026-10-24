// 출력 상태. 메인 프로세스가 유일한 원본을 들고, 조작 창과 출력 창은 사본만 받는다.
// 층은 아래에서 위 순서로 쌓인다. 화면마다 어떤 층을 보일지는 그 화면의 Look이 정한다.
// 층을 더할 때는 layerKinds, LiveLayers, emptyLayers에 함께 넣는다.

export const layerKinds = ['media', 'slide', 'prop', 'audio', 'message', 'notice'] as const

export type LayerKind = (typeof layerKinds)[number]

/** 배경 미디어. 미디어 라이브러리의 id만 가리킨다. */
export interface MediaLayer {
  readonly mediaId: string
  readonly loop: boolean
}

/** 지금 출력 중인 장. 예배 순서 항목과 그 구성 안의 위치, 그리고 그릴 내용. */
export interface SlideLayer {
  readonly itemId: string
  readonly position: number
  readonly label: string | null
  readonly lines: readonly string[]
}

export interface PropLayer {
  readonly propId: string
}

export interface AudioLayer {
  readonly mediaId: string
}

export interface MessageLayer {
  readonly messageId: string
  readonly text: string
}

export interface NoticeLayer {
  readonly noticeId: string
}

export interface LiveLayers {
  readonly media: MediaLayer | null
  readonly slide: SlideLayer | null
  readonly prop: PropLayer | null
  readonly audio: AudioLayer | null
  readonly message: MessageLayer | null
  readonly notice: NoticeLayer | null
}

export interface LiveState {
  /** 상태가 바뀔 때마다 1씩 늘어난다. 창은 이미 받은 판보다 오래된 판을 버린다. */
  readonly version: number
  readonly layers: LiveLayers
  /** 화면 id별 출력 켜짐. 없는 화면은 꺼진 것으로 본다. */
  readonly outputs: Readonly<Record<string, boolean>>
}

export function emptyLayers(): LiveLayers {
  return { media: null, slide: null, prop: null, audio: null, message: null, notice: null }
}

export function emptyLiveState(): LiveState {
  return { version: 0, layers: emptyLayers(), outputs: {} }
}

export function hasAnyLayer(layers: LiveLayers): boolean {
  return layerKinds.some((kind) => layers[kind] !== null)
}
