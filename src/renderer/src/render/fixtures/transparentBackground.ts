import '../../styles/tokens.css';
import {classes} from '../classes';

const mode = new URLSearchParams(location.search).get('mode');
if (mode !== 'output' && mode !== 'preview') {
  throw new Error('Expected output or preview mode');
}

const root = document.createElement('div');
root.className = classes.root;
const background = mode === 'preview' ? 32 : 0;
root.style.setProperty(
  '--output-black',
  `rgb(${background} ${background} ${background})`,
);
document.body.append(root);

async function picture(transparent: boolean): Promise<HTMLImageElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 18;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Expected a 2D canvas');
  context.fillStyle = 'rgb(200 200 200)';
  if (transparent) {
    const band = canvas.width / 3;
    context.globalAlpha = 0.5;
    context.fillRect(band, 0, band, canvas.height);
    context.globalAlpha = 1;
    context.fillRect(2 * band, 0, band, canvas.height);
  } else {
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const image = document.createElement('img');
  image.className = classes.image;
  image.alt = '';
  image.src = canvas.toDataURL('image/png');
  await image.decode();
  return image;
}

async function showPictures(): Promise<void> {
  const [outgoing, incoming] = await Promise.all([
    picture(false),
    picture(true),
  ]);
  outgoing.id = 'outgoing';
  outgoing.classList.add(classes.shown);
  outgoing.style.zIndex = '0';
  incoming.id = 'incoming';
  incoming.style.zIndex = '1';
  root.append(outgoing, incoming);
  document.body.dataset['ready'] = 'true';
}

showPictures().catch((error: unknown) => {
  document.body.textContent = String(error);
  document.body.dataset['ready'] = 'failed';
});
