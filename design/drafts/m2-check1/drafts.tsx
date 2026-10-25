import {useEffect, useState, type JSX} from 'react';
import {createRoot} from 'react-dom/client';
import {emptyLiveState} from '@shared/live';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {App} from '@renderer/control/App';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {applyService, useShow} from '@renderer/state/show';
import {sampleService} from '@renderer/show/testing/sampleService';
import {ServiceOrderList} from '@renderer/show/ServiceOrderList';
import {Icon, Panel, PanelHeader, PanelTitle} from '@renderer/ui';
import '@renderer/styles/base.css';
import './drafts.css';

const BASE_COMMIT = '3e31e01';
const SCREEN_NAMES = ['본 화면', '무대 화면', '방송 자막'] as const;
type ScreenName = (typeof SCREEN_NAMES)[number];
type PreviewVariant = 'pictures' | 'marker';
type HeaderVariant = 'current' | 'single' | 'stacked';

window.llp = fakeLlpApi();
const sourceTiles = sampleService.tiles['song-morning'] ?? [];
const tiles = Array.from({length: 12}, (_, index) => {
  const source = sourceTiles[index % sourceTiles.length];
  return {
    label: source?.label ?? '1절',
    labelColor: source?.labelColor ?? 'teal',
    lines: source?.lines ?? ['아침이 밝아 오네', '새로운 노래를 부르리'],
  };
});
applyService({
  ...sampleService,
  name: '10월 25일 주일 예배',
  tiles: {...sampleService.tiles, 'song-morning': tiles},
});
useShow.setState({openItemId: 'song-morning', selectedTile: 1});
const live = emptyLiveState();
useLive.setState({
  state: {
    ...live,
    outputs: {main: true, stage: true, broadcast: true},
    layers: {
      ...live.layers,
      slide: {
        itemId: 'song-morning',
        position: 1,
        label: '후렴',
        lines: ['함께 불러요', '함께 노래해요'],
      },
    },
  },
});

function OutputPicture({screen}: {readonly screen: ScreenName}): JSX.Element {
  return (
    <div className="draft-picture" data-draft-picture={screen}>
      <div className="picture-lyrics">
        함께 불러요
        <br />
        함께 노래해요
      </div>
      {screen === '무대 화면' ? (
        <div className="picture-next">
          낮은 언덕을 넘어
          <br />
          바람이 불어 오네
        </div>
      ) : null}
    </div>
  );
}

function PreviewDraft({
  variant,
}: {
  readonly variant: PreviewVariant;
}): JSX.Element {
  const [selected, setSelected] = useState<ScreenName>('무대 화면');
  return (
    <Panel label="미리보기" className="preview-draft">
      <PanelHeader>
        <PanelTitle title="미리보기" />
      </PanelHeader>
      <div className="preview-body">
        <div className="large-picture" data-large-screen={selected}>
          <OutputPicture screen={selected} />
          <div className="large-caption">
            <strong>{selected}</strong>
            <span>
              {selected === '방송 자막'
                ? '캡처 창'
                : selected === '본 화면'
                  ? '모니터 2'
                  : '모니터 3'}
            </span>
          </div>
        </div>
        <div
          className="screen-strip"
          role="group"
          aria-label="미리보기 화면 선택"
        >
          {SCREEN_NAMES.map(screen => (
            <button
              key={screen}
              type="button"
              className="screen-slot"
              aria-pressed={selected === screen}
              onClick={() => setSelected(screen)}
              aria-label={`${screen} 미리보기`}
            >
              {variant === 'marker' && selected === screen ? (
                <span className="selected-marker" data-selected-marker>
                  <Icon name="arrow" size={24} />
                </span>
              ) : (
                <OutputPicture screen={screen} />
              )}
              <span className="slot-caption">
                {selected === screen ? <Icon name="check" size={12} /> : null}
                {screen}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function PreviewBoard(): JSX.Element {
  return (
    <div className="board preview-board">
      <div className="board-heading">
        <h1>Preview selection</h1>
        <p>
          Feedback 6 / two alternatives / 480px right column / click any screen
        </p>
      </div>
      <div className="preview-options">
        {(['pictures', 'marker'] as const).map((variant, index) => (
          <article className="draft-option" key={variant}>
            <h2>
              {index === 0
                ? 'A / All three pictures'
                : 'B / Selected slot as a marker'}
            </h2>
            <div data-capture={`preview-${index === 0 ? 'a' : 'b'}`}>
              <PreviewDraft variant={variant} />
            </div>
            <p>
              {index === 0
                ? 'Four preview surfaces: one large and three small.'
                : 'Three preview surfaces: one large and two small.'}
            </p>
            <p>
              Fixed order: 본 화면 / 무대 화면 / 방송 자막. Blue marks
              selection.
            </p>
          </article>
        ))}
      </div>
      <p className="board-footnote">
        Own proposals, informed by ProPresenter. Screen selection changes
        monitoring only. No output toggles in these slots.
      </p>
    </div>
  );
}

function ServiceHeader({
  variant,
  long = false,
}: {
  readonly variant: HeaderVariant;
  readonly long?: boolean;
}): JSX.Element {
  const name = long
    ? '10월 마지막 주일 온가족 감사 예배와 새가족 환영'
    : '주일 예배';
  if (variant === 'current') {
    return (
      <div className="current-service-header">
        <span>예배 순서</span>
      </div>
    );
  }
  return (
    <div className={`service-header ${variant}`}>
      <button
        type="button"
        className="service-switch"
        title={name}
        aria-label={`예배 순서 ${name}`}
      >
        {variant === 'stacked' ? (
          <span className="service-category">예배 순서</span>
        ) : null}
        <span className="service-name">
          <span>{name}</span>
          <Icon name="down" size={12} />
        </span>
      </button>
    </div>
  );
}

function HeaderBoard(): JSX.Element {
  return (
    <div className="board header-board">
      <div className="board-heading">
        <h1>The open service, in its panel</h1>
        <p>Feedback 1 / 280px left column / the menu bar title remains</p>
      </div>
      <div className="header-options">
        {(['current', 'single', 'stacked'] as const).map((variant, index) => (
          <article className="draft-option" key={variant}>
            <h2>{['Today', 'A / Name first', 'B / Two lines'][index]}</h2>
            <div className="header-capture" data-capture={`header-${variant}`}>
              <Panel label="예배 순서" className="service-draft">
                <ServiceHeader variant={variant} />
                <ServiceOrderList />
              </Panel>
            </div>
            <p>
              {index === 0
                ? '34px header, no service name.'
                : index === 1
                  ? '34px header, 16/22 semibold name.'
                  : '52px header, 12/16 category, 16/22 name.'}
            </p>
            {variant !== 'current' ? (
              <>
                <p className="long-name-label">
                  Long service name, same 280px width
                </p>
                <ServiceHeader variant={variant} long />
              </>
            ) : null}
          </article>
        ))}
      </div>
      <p className="board-footnote">
        The name is the service picker target. Ellipsis keeps long names on one
        line; the full name is available on hover.
      </p>
    </div>
  );
}

function TypeWorkspace({proposed}: {readonly proposed: boolean}): JSX.Element {
  const [store] = useState(createMemoryColumnWidthStore);
  useEffect(() => {
    document
      .querySelectorAll(
        'main > div > section > div:first-child > span:first-child',
      )
      .forEach(tab => tab.setAttribute('data-draft-tab', ''));
    document.documentElement.dataset['draftReady'] = 'true';
  }, []);
  return (
    <div className="type-workspace" data-type-proposed={proposed}>
      <App columnWidthStore={store} />
    </div>
  );
}

function TypePair(): JSX.Element {
  return (
    <div className="type-pair">
      <div>
        <h1>Today / body 13/18, caption 11/14, micro 10/12</h1>
        <img
          alt="Today's type scale"
          src="./renders/type-today.png"
          width={1920}
          height={1080}
        />
      </div>
      <div>
        <h1>Proposal / body 14/20, caption 12/16, UI minimum 12px</h1>
        <img
          alt="Windows ramp proposal"
          src="./renders/type-windows.png"
          width={1920}
          height={1080}
        />
      </div>
    </div>
  );
}

function Index(): JSX.Element {
  return (
    <div className="board index-board">
      <h1>M2 check 1 drafts</h1>
      <p>Part A only. Product source and design tokens are unchanged.</p>
      <p>
        Baseline: {BASE_COMMIT}. Read README.md for sources, tradeoffs, and
        rendering instructions.
      </p>
      <nav>
        {[
          ['previews', 'Preview variants'],
          ['headers', 'Service header variants'],
          ['type-today', 'Current type, 1920 x 1080'],
          ['type-windows', 'Proposed type, 1920 x 1080'],
          ['type-pair', 'Type comparison, two full-size workspaces'],
        ].map(([page, name]) => (
          <a key={page} href={`?page=${page}`}>
            {name}
          </a>
        ))}
      </nav>
    </div>
  );
}

const page = new URLSearchParams(location.search).get('page') ?? 'index';
document.documentElement.dataset['page'] = page;
document.documentElement.dataset['scale'] =
  page === 'type-windows' ? 'windows' : 'current';
const pages: Record<string, JSX.Element> = {
  previews: <PreviewBoard />,
  headers: <HeaderBoard />,
  'type-today': <TypeWorkspace proposed={false} />,
  'type-windows': <TypeWorkspace proposed />,
  'type-pair': <TypePair />,
};
const root = document.getElementById('root');
if (root !== null) createRoot(root).render(pages[page] ?? <Index />);
