const {Buffer} = require('node:buffer');
const k = require('koffi');
// NOTE(0913vision): Slots follow IUnknown, ID3D11Device, ID3D11Device1, ID3D11Texture2D, and ID3D11DeviceContext.
const D3D11_SLOT = {
  QUERY_INTERFACE: 0,
  RELEASE: 2,
  CREATE_TEXTURE_2D: 5,
  GET_DESC: 10,
  MAP: 14,
  UNMAP: 15,
  COPY_SUBRESOURCE_REGION: 46,
  OPEN_SHARED_RESOURCE1: 48,
};
const D3D11_CREATE_DEVICE_BGRA_SUPPORT = 0x20;
const D3D11_SDK_VERSION = 7;
const D3D_DRIVER_TYPE_HARDWARE = 1;
const PROCESS_DUP_HANDLE = 0x40;
const DUPLICATE_SAME_ACCESS = 2;
const D3D11_USAGE_STAGING = 3;
const D3D11_CPU_ACCESS_READ = 0x20000;
const D3D11_MAP_READ = 1;
const TEXTURE_DESC_SIZE = 44;
const BOX_SIZE = 24;
const MAPPED_SUBRESOURCE_SIZE = 16;
const POINTER_SIZE = 8;
const BYTES_PER_PIXEL = 4;
const UINT_SIZE = 4;
const DESC_FORMAT_OFFSET = 16;
const DESC_USAGE_OFFSET = 28;
const DESC_BIND_FLAGS_OFFSET = 32;
const DESC_CPU_ACCESS_OFFSET = 36;
const DESC_MISC_FLAGS_OFFSET = 40;
const MAPPED_ROW_PITCH_OFFSET = 8;

const win = k.load('kernel32.dll'),
  d3d = k.load('d3d11.dll'),
  crt = k.load('msvcrt.dll');
const memcpy = crt.func('memcpy', 'void *', ['void *', 'void *', 'size_t']);
const outPtr = k.out(k.pointer('void *'));
const OpenProcess = win.func('OpenProcess', 'void *', [
  'uint32_t',
  'int',
  'uint32_t',
]);
const GetCurrentProcess = win.func('GetCurrentProcess', 'void *', []);
const DuplicateHandle = win.func('DuplicateHandle', 'int', [
  'void *',
  'void *',
  'void *',
  outPtr,
  'uint32_t',
  'int',
  'uint32_t',
]);
const CloseHandle = win.func('CloseHandle', 'int', ['void *']);
const GetLastError = win.func('GetLastError', 'uint32_t', []);
const CreateDevice = d3d.func('D3D11CreateDevice', 'int32_t', [
  'void *',
  'uint32_t',
  'void *',
  'uint32_t',
  'void *',
  'uint32_t',
  'uint32_t',
  outPtr,
  'void *',
  outPtr,
]);
const qiType = k.proto('NDIQI', 'int32_t', ['void *', 'void *', outPtr]);
const relType = k.proto('NDIRel', 'uint32_t', ['void *']);
const openType = k.proto('NDIOpen', 'int32_t', [
  'void *',
  'void *',
  'void *',
  outPtr,
]);
const descType = k.proto('NDIDesc', 'void', ['void *', 'void *']);
const createType = k.proto('NDICreate', 'int32_t', [
  'void *',
  'void *',
  'void *',
  outPtr,
]);
const copyType = k.proto('NDICopy', 'void', [
  'void *',
  'void *',
  'uint32_t',
  'uint32_t',
  'uint32_t',
  'uint32_t',
  'void *',
  'uint32_t',
  'void *',
]);
const mapType = k.proto('NDIMap', 'int32_t', [
  'void *',
  'void *',
  'uint32_t',
  'uint32_t',
  'uint32_t',
  'void *',
]);
const unmapType = k.proto('NDIUnmap', 'void', ['void *', 'void *', 'uint32_t']);
const iidDevice1 = Buffer.from('29fb4ba0ef08d643a49ca9bdbdcbe686', 'hex');
const iidTexture = Buffer.from('f2aa156f08d2894e9ab4489535d34f9c', 'hex');
function method(obj, index, type, ...args) {
  const v = k.decode(obj, 'void *');
  const fn = k.decode(v, index * POINTER_SIZE, 'void *');
  return k.call(fn, type, obj, ...args);
}
function release(obj) {
  if (obj) method(obj, D3D11_SLOT.RELEASE, relType);
}
function check(hr, name) {
  if (hr < 0) throw Error(`${name} HRESULT 0x${(hr >>> 0).toString(16)}`);
}
function create() {
  const device = [null],
    context = [null];
  check(
    CreateDevice(
      null,
      D3D_DRIVER_TYPE_HARDWARE,
      null,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT,
      null,
      0,
      D3D11_SDK_VERSION,
      device,
      null,
      context,
    ),
    'D3D11CreateDevice',
  );
  const dev1 = [null];
  check(
    method(device[0], D3D11_SLOT.QUERY_INTERFACE, qiType, iidDevice1, dev1),
    'QueryInterface device1',
  );
  let staging = null,
    stagingKey = '';
  return {
    read(pid, raw, dirty, consume) {
      const proc = OpenProcess(PROCESS_DUP_HANDLE, 0, pid);
      if (!proc) throw Error(`OpenProcess ${GetLastError()}`);
      const handle = [null];
      let texture = null,
        mapped = false;
      try {
        if (
          !DuplicateHandle(
            proc,
            BigInt(`0x${raw}`),
            GetCurrentProcess(),
            handle,
            0,
            0,
            DUPLICATE_SAME_ACCESS,
          )
        ) {
          throw Error(`DuplicateHandle ${GetLastError()}`);
        }
        const out = [null];
        check(
          method(
            dev1[0],
            D3D11_SLOT.OPEN_SHARED_RESOURCE1,
            openType,
            handle[0],
            iidTexture,
            out,
          ),
          'OpenSharedResource1',
        );
        texture = out[0];
        const desc = Buffer.alloc(TEXTURE_DESC_SIZE);
        method(texture, D3D11_SLOT.GET_DESC, descType, desc);
        const width = desc.readUInt32LE(0),
          height = desc.readUInt32LE(4),
          format = desc.readUInt32LE(DESC_FORMAT_OFFSET);
        const key = `${width}:${height}:${format}`;
        if (key !== stagingKey) {
          release(staging);
          staging = null;
          const target = Buffer.from(desc);
          target.writeUInt32LE(D3D11_USAGE_STAGING, DESC_USAGE_OFFSET);
          target.writeUInt32LE(0, DESC_BIND_FLAGS_OFFSET);
          target.writeUInt32LE(D3D11_CPU_ACCESS_READ, DESC_CPU_ACCESS_OFFSET);
          target.writeUInt32LE(0, DESC_MISC_FLAGS_OFFSET);
          const outStage = [null];
          check(
            method(
              device[0],
              D3D11_SLOT.CREATE_TEXTURE_2D,
              createType,
              target,
              null,
              outStage,
            ),
            'CreateTexture2D',
          );
          staging = outStage[0];
          stagingKey = key;
        }
        const {x, y, width: w, height: h} = dirty;
        if (
          x < 0 ||
          y < 0 ||
          w <= 0 ||
          h <= 0 ||
          x + w > width ||
          y + h > height
        ) {
          throw Error('bad dirty');
        }
        const box = Buffer.alloc(BOX_SIZE);
        [x, y, 0, x + w, y + h, 1].forEach((v, i) =>
          box.writeUInt32LE(v, i * UINT_SIZE),
        );
        method(
          context[0],
          D3D11_SLOT.COPY_SUBRESOURCE_REGION,
          copyType,
          staging,
          0,
          x,
          y,
          0,
          texture,
          0,
          box,
        );
        const mappedData = Buffer.alloc(MAPPED_SUBRESOURCE_SIZE);
        check(
          method(
            context[0],
            D3D11_SLOT.MAP,
            mapType,
            staging,
            0,
            D3D11_MAP_READ,
            0,
            mappedData,
          ),
          'Map',
        );
        mapped = true;
        const ptr = k.decode(mappedData, 'void *'),
          pitch = mappedData.readUInt32LE(MAPPED_ROW_PITCH_OFFSET);

        const bytes = Buffer.allocUnsafe(w * h * BYTES_PER_PIXEL);
        if (x === 0 && w === width && pitch === w * BYTES_PER_PIXEL) {
          memcpy(bytes, ptr + BigInt(y * pitch), w * h * BYTES_PER_PIXEL);
        } else {
          for (let row = 0; row < h; row++) {
            memcpy(
              bytes.subarray(row * w * BYTES_PER_PIXEL),
              ptr + BigInt((y + row) * pitch + x * BYTES_PER_PIXEL),
              w * BYTES_PER_PIXEL,
            );
          }
        }

        consume({bytes, pitch, width, height, format, dirty});
        method(context[0], D3D11_SLOT.UNMAP, unmapType, staging, 0);
        mapped = false;
        return {width, height, format, pitch};
      } finally {
        if (mapped) method(context[0], D3D11_SLOT.UNMAP, unmapType, staging, 0);
        release(texture);
        if (handle[0]) CloseHandle(handle[0]);
        CloseHandle(proc);
      }
    },
    close() {
      release(staging);
      release(dev1[0]);
      release(context[0]);
      release(device[0]);
    },
  };
}
module.exports = {create};
