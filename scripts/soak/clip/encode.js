globalThis.encodeClip = async ({width, height, fps, seconds, bitrate}) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  const frameUs = 1_000_000 / fps;
  const frames = [];
  let failure = null;
  const encoder = new VideoEncoder({
    output: chunk => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      frames.push({
        data,
        timestampMs: chunk.timestamp / 1000,
        key: chunk.type === 'key',
      });
    },
    error: error => {
      failure = error;
    },
  });
  encoder.configure({codec: 'vp8', width, height, bitrate, framerate: fps});
  const total = fps * seconds;
  for (let index = 0; index < total; index += 1) {
    drawFrame(context, {width, height, fps, index});
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(index * frameUs),
      duration: Math.round(frameUs),
    });
    encoder.encode(frame, {keyFrame: index % fps === 0});
    frame.close();
    if (encoder.encodeQueueSize > fps) await encoder.flush();
  }
  await encoder.flush();
  encoder.close();
  if (failure !== null) throw failure;
  return frames;
};

const LIGHT_COUNT = 48;

function drawFrame(context, {width, height, fps, index}) {
  const time = index / fps;
  const hue = (time * 12) % 360;
  const sky = context.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, `hsl(${hue} 60% 22%)`);
  sky.addColorStop(1, `hsl(${(hue + 80) % 360} 55% 38%)`);
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  for (let light = 0; light < LIGHT_COUNT; light += 1) {
    const phase = (light / LIGHT_COUNT) * Math.PI * 2;
    const x = width * (0.5 + 0.45 * Math.sin(time * 0.7 + phase * 3));
    const y = height * (0.5 + 0.4 * Math.cos(time * 0.9 + phase * 2));
    const radius = (height / 14) * (1 + 0.5 * Math.sin(time * 2 + phase));
    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `hsl(${(hue + light * 7) % 360} 90% 75% / 0.8)`);
    glow.addColorStop(1, 'transparent');
    context.fillStyle = glow;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  context.fillStyle = '#ffffff';
  context.font = `${Math.round(height / 12)}px sans-serif`;
  context.fillText(String(index), width / 30, height / 8);
}

globalThis.checkClip = async url => {
  const video = document.createElement('video');
  video.muted = true;
  video.src = url;
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error(`the clip does not load: ${url}`));
  });
  const {duration, videoWidth, videoHeight} = video;
  video.currentTime = duration / 2;
  await new Promise((resolve, reject) => {
    video.onseeked = resolve;
    video.onerror = () => reject(new Error('the clip does not seek'));
  });
  video.removeAttribute('src');
  video.load();
  return {duration, width: videoWidth, height: videoHeight};
};
