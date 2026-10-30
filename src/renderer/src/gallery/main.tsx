import '@renderer/styles/base.css';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Gallery, galleryFilter} from './Gallery';

const root = document.getElementById('root');
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <Gallery only={galleryFilter(window.location.search)} />
    </StrictMode>,
  );
}
