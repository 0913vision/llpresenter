import {useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {useUiZoomKeys} from '../../uiZoomKeys';

function Fixture() {
  useUiZoomKeys();
  useEffect(() => {
    const record = (event: KeyboardEvent): void => {
      document.body.dataset['keyPrevented'] = String(event.defaultPrevented);
    };
    window.addEventListener('keydown', record, {capture: true});
    document.body.dataset['ready'] = 'true';
    return () => window.removeEventListener('keydown', record, {capture: true});
  }, []);
  return <input id="field" aria-label="조합 입력" />;
}

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<Fixture />);
