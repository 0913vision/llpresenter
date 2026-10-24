// src/*.html의 표식을 공통 머리, 메뉴줄, 툴바로 바꿔 project/*.dc.html로 쓴다.
// 표식: @@HEAD:제목@@  @@MENUBAR@@  @@TOOLBAR:show|prep|screens@@
// 사용: node assemble.js [파일 이름...]
const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, 'src')
const out = path.join(__dirname, '..', 'llp-design', 'project')

const icons = {
  song: '092e6bd96c603ecacf1c00ad0bbf748e', film: 'd12ba04335e89ec2ac23de5b5dadf567', image: '9d15cc9d2c473dc54657232c2c22a8c1',
  notice: '6b2eac21a222b4c93acf292071cab142', book: 'e3e503de1d6d5ad2610069e5d01528c1', msg: 'e02523b5ae105efe6c86fc720a501e57',
  prop: '68b060ad4ffc69c1338360ba8efe8a1f', audio: 'dc05560aeb38844764508b2df7d96d6c', monitor: '4596f5b35b01b97a40839716be255a9c',
  mplay: '031f927502f663ccac998d6fe5b98b1d', capture: 'a02b5557a5163772bc93ea2c2cb50327', search: 'bbe74be6639a3b46c8c1503c6202be21',
  gear: '69e70c0d7363ab992c10c8d1b137af7a', plus: '60593869febedd0f7cc96739b15ff702', down: 'fdede3cf9294bdfffe2831e4985b91ba',
  right: '5249c813e7ba012f5c569e3c397de778', loop: '4afb40c8c3a4a9342611dfa4bc802b9a', text: 'fad9bd8182817dd8386ba2d9a4144a8a',
  undo: 'a2058ad29839212362f1def041dbadbc', folder: '236c73aa5600731e48757a0cf05cfe42', x: '20ff3492ea768cacd467480e386ad17b',
  min: '8d63b8e1ce9257fb14f3127e569bfdd9', max: 'dfd093184afe9416f5bb254275395bb4', slides: 'bedc5702dad0889627007797be138a91',
  saved: '01da7eed53f9c4eb05f356a971869f1a', layers: '26735e490823c1caf40a326325857fb0', edit: '02e581d39b6e4686773acdbad7de4894',
  grid: '12440a2e5cf9c86989e4e10cb96385b0', timer: '6b75efeb960a461bd13cd9f112aaa22e', check: '9a89a2bff58b8395511703929514cb66',
  grip: 'adf12ef1071c6732b8adbd90b6b53029', more: '741a7bdb89a46c2b08b7993aef3595f9', clock: 'd849921f7532c4b3289a2b95beeddf24',
  aleft: 'c6adb26fe5c36eb302e8d78c2a71d02c', acenter: '3916f14042df5bfa323beb82d7a4e10f', play: 'dbc6266bf70afbe4c6a251234322ef84',
  pause: '75fca11ec9e9b1e77a2ee975bb6246ce', playf: '7ff7f54d7e72c5d0a1e12cdd55d0dea9', pausef: 'd105a8b2a530bc1e1e68c176c7f2afcc',
  prev: '2de47db7bef436a4c73f50e02224a23b', next: '9d17be870f23412d5273180a3aaa24d0', send: 'eb64b09fc82162120a1d36b708635a52',
  user: 'c79c250b176fd30d1be7cfb0da5923e1', warn: '0d34555750cd45ff01b4f5120b0ea2f8', macro: '721f34ba44aa8d9f4882bf2349cd2ac2',
  eye: '48ce504b81032937bed7f9e546bbfa7a', eyeoff: '401f27618db8ad33e140decf9eed462d', lock: '0882cf9f3620cf9ce560199d63609905',
  sliders: '89efa017d50b55fda0f8bf041e0f1e02', wave: '363e645b929d957e1ed2d4f640cef5db', cal: '9cbee7fd30cf3885c1738a4536ea7ef6',
  rows: '8bbcc101a537d6fc78bc97267bd1bd34', link: '3f9809c521bcc49b863e2d7df3c0e7d5', pray: 'a94d767ef65baf4d297ba94950a8f7da',
  coins: 'b39548d084b8f75aa903bff9ea27ee4e', mic: '30ccef2a951169492c795ce4c2a09b24', note: '46708e306efe909ebdd9d6d8a329ee6a',
  stop: 'abcd41b6ae1ed0dd1d6883e914a2063b', sun: '2c8c0f1009c85cb856b86bc27d182e78', eraser: '692dfe138a87aa771a652dee17c0471c',
  open: '5703b0bac8933bc9900033165c277ef2',
  warning: 'fceec591119a8a5f4c070b3fba6760db', plug: 'cbb1592b8aa6edfcd80b90b521176e1f', filex: '5f65ad0963702fec4f2926c2ea0aff5f',
  refresh: '65eab3caa918183bad8610df67e6cb1a', history: 'a867801907f14d2b022e45d364e06eaf', folderopen: 'd80725a49f82b68bc28c744977e85e15',
  download: '22d2befe43764b57b2eab33c0c88cbc2', upload: '51b9b4232855ad8e062a46611b595f65', filetext: '20270d968b2a045648f3e2350399f8a7',
  fileppt: '92f9c6698a3333e8099348783ca1980b', keyboard: '05eda8a4cfecb57f7571d27f7d3661c1', laptop: '182116a97452f14985196942e50d63ed',
  copy: '5e5f4aa71701fa4a852863d3a50eb63e', calplus: 'f387fc743a44bd67dede0acfbba31e8e', trash: 'bddecde2de4f2a3d3147ba33f66c6d73',
  checkc: '0139b06cc10282e835092bea17c7dde9', info: '55cb2afabbc41bf4c15197306afc7e5a', textaa: 'fe07d775a12a51d8ac4242d9a8b15db4',
  frame: 'fdbaf2404af13384af4a18f43d43ab8f', translate: '1dcabf18a0c6913f37de4f9a9becc02f', arrow: 'b34cca8935965d99e7938be79c5846fa',
  bookmark: 'd05a22072fff73b94ff7c858bbd282c2', listplus: 'aa29172410c2dcde66e3e6c8c557dc44', drives: 'bec23bbf58a0b70c5abca248cf8e3b00',
  plugs: 'b78ff4652eda39bb8565f8699dcbb313'
}

function head(title) {
  const iconCss = Object.entries(icons).map(([k, id]) => `.i-${k}{-webkit-mask-image:url("/_blob/${id}");mask-image:url("/_blob/${id}")}`).join('\n')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
@font-face{font-family:"Pretendard Variable";src:url("/_blob/44ae4219c075570535882b3a34ea3567") format("woff2");font-weight:45 920;font-display:swap}
body{margin:0;background:#0e0e0e}
button,input{font:inherit;cursor:default}
input::placeholder{color:#8c8c8c}
.hv:hover{background:#262626}
.hvc:hover{background:#333333}
.tb:hover{background:#232323}
.tbd{box-shadow:0 0 0 2px #0e0e0e}
.tb:hover .tbd{box-shadow:0 0 0 2px #232323}
.th{box-shadow:none}
.th:hover{box-shadow:0 0 0 1px #6e6e6e}
.th[data-state=selected],.th[data-state=selected]:hover{box-shadow:0 0 0 2px #3d8bf0}
.th[data-state=live],.th[data-state=live]:hover{box-shadow:0 0 0 3px #d2343a}
.pvf{box-shadow:0 0 0 1px #2b2b2b}
.pv:hover .pvf{box-shadow:0 0 0 1px #6e6e6e}
.pvf[data-state=warning],.pv:hover .pvf[data-state=warning]{box-shadow:0 0 0 1px #e3a23b}
.mt .mtt{box-shadow:none}
.mt:hover .mtt{box-shadow:0 0 0 2px #1c1c1c,0 0 0 3px #6e6e6e}
.mt[data-state=last-run] .mtt{box-shadow:0 0 0 2px #1c1c1c,0 0 0 4px #ececec}
.mt[aria-selected=true] .mtt{box-shadow:0 0 0 2px #1c1c1c,0 0 0 4px #3d8bf0}
.mtn:hover .mtt{background:#262626}
input[type=range]{--ll-value:50%;-webkit-appearance:none;appearance:none;box-sizing:border-box;width:120px;height:16px;margin:0;padding:0;border:0;background:transparent;vertical-align:middle}
input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:9999px;background:linear-gradient(to right,#ececec 0 var(--ll-value),#3a3a3a var(--ll-value) 100%)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;box-sizing:border-box;width:12px;height:12px;margin-top:-4px;border:0;border-radius:50%;background:#ececec}
input[type=range]:disabled::-webkit-slider-runnable-track{background:linear-gradient(to right,#6e6e6e 0 var(--ll-value),#3a3a3a var(--ll-value) 100%)}
input[type=range]:disabled::-webkit-slider-thumb{background:#6e6e6e}
.i{display:inline-block;flex:none;width:16px;height:16px;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}
.i12{width:12px;height:12px}
.i14{width:14px;height:14px}
.i18{width:18px;height:18px}
.i24{width:24px;height:24px}
.i28{width:28px;height:28px}
${iconCss}
</style>
</helmet>`
}

const menubar = `<div style="position: relative; flex: none; height: 30px; display: flex; align-items: center; padding-left: 12px; background: #0e0e0e">
<span style="margin-right: 14px; font-size: 12px; font-weight: 700; letter-spacing: -0.01em">LoveLight</span>
<nav style="display: flex; font-size: 12px; color: #b4b4b4" aria-label="메뉴">
${['파일', '편집', '보기', '출력', '창', '도움말'].map((m) => `<button type="button" class="hv" style="height: 24px; padding: 0 9px; border: 0; border-radius: 3px; background: transparent; color: inherit">${m}</button>`).join('\n')}
</nav>
<span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: 12px; color: #8c8c8c">주일 예배</span>
<span style="margin-left: auto; display: flex">
<button type="button" class="hv" aria-label="최소화" style="width: 46px; height: 30px; border: 0; background: transparent; color: #b4b4b4; display: inline-flex; align-items: center; justify-content: center"><span class="i i14 i-min"></span></button>
<button type="button" class="hv" aria-label="최대화" style="width: 46px; height: 30px; border: 0; background: transparent; color: #b4b4b4; display: inline-flex; align-items: center; justify-content: center"><span class="i i14 i-max"></span></button>
<button type="button" class="hv" aria-label="닫기" style="width: 46px; height: 30px; border: 0; background: transparent; color: #b4b4b4; display: inline-flex; align-items: center; justify-content: center"><span class="i i14 i-x"></span></button>
</span>
</div>`

function toolbar(kind) {
  const outputsOff = /Off$/.test(kind)
  const active = kind.replace(/Off$/, '')
  const tool = (label, icon, on, extra = '') => `<button type="button" class="tb"${on ? ' aria-pressed="true"' : ''} style="width: 64px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 0; border-radius: 5px; background: ${on ? '#262626' : 'transparent'}; color: ${on ? '#ececec' : '#8c8c8c'}; font-size: 11px; font-weight: 500"${extra}><span class="i i18 i-${icon}"></span>${label}</button>`
  const out = (label, icon) => outputsOff
    ? `<button type="button" class="tb" aria-pressed="false" title="${label} 출력 켜기" style="min-width: 64px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; color: #6e6e6e; font-size: 11px; font-weight: 500"><span style="position: relative; display: inline-flex"><span class="i i18 i-${icon}"></span></span>${label}</button>`
    : `<button type="button" class="tb" aria-pressed="true" style="min-width: 64px; height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0 8px; border: 0; border-radius: 5px; background: transparent; color: #ececec; font-size: 11px; font-weight: 500"><span style="position: relative; display: inline-flex"><span class="i i18 i-${icon}"></span><span class="tbd" style="position: absolute; right: -4px; top: -3px; width: 6px; height: 6px; border-radius: 50%; background: #d2343a"></span></span>${label}</button>`
  const divider = '<span style="width: 1px; height: 24px; margin: 0 8px; background: #2b2b2b"></span>'
  return `<header style="flex: none; height: 56px; display: flex; align-items: center; gap: 6px; padding: 0 4px">
${tool('진행', 'slides', active === 'show')}
${tool('준비', 'edit', active === 'prep')}
${tool('화면 설정', 'gear', active === 'screens')}
${divider}
${tool('미디어', 'film', false)}
<div style="flex: 1; display: flex; justify-content: center">
<span style="display: flex; align-items: center; gap: 8px; width: 420px; height: 30px; padding: 0 10px; box-sizing: border-box; border-radius: 4px; background: #121212; box-shadow: inset 0 0 0 1px #2b2b2b; color: #8c8c8c"><span class="i i-search"></span><input aria-label="검색" placeholder="곡, 가사, 초성" style="flex: 1; min-width: 0; height: 28px; padding: 0; border: 0; background: transparent; color: #ececec; font-size: 13px"></span>
</div>
<button type="button" class="tb" style="height: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0 12px; border: 0; border-radius: 5px; background: transparent; color: #ececec; font-size: 11px; font-weight: 500"><span style="display: inline-flex; align-items: center; gap: 4px"><span class="i i18 i-layers"></span><span class="i i12 i-down" style="color: #8c8c8c"></span></span>평상시</button>
${divider}
${out('본 화면', 'mplay')}
${out('무대', 'mplay')}
${out('방송 자막', 'capture')}
</header>`
}

const footer = `<footer style="flex: none; height: 28px; display: flex; align-items: center; gap: 18px; padding: 0 18px; font-size: 11px; color: #8c8c8c">
<span style="display: inline-flex; align-items: center; gap: 6px"><span class="i i14 i-saved"></span>23:41 저장됨</span>
<span style="margin-left: auto; display: inline-flex; align-items: center; gap: 6px"><span style="width: 6px; height: 6px; border-radius: 50%; background: #3dbb6b"></span>본 화면 60fps</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 6px; height: 6px; border-radius: 50%; background: #3dbb6b"></span>무대 화면 60fps</span>
<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 6px; height: 6px; border-radius: 50%; background: #3dbb6b"></span>방송 자막 60fps</span>
</footer>`

const names = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(src).filter((f) => f.endsWith('.html'))
for (const name of names) {
  let s = fs.readFileSync(path.join(src, name), 'utf8')
  s = s.replace(/@@HEAD:([^@]+)@@/, (_, t) => head(t))
  s = s.replace('@@MENUBAR@@', menubar)
  s = s.replace(/@@TOOLBAR:(\w+)@@/, (_, a) => toolbar(a))
  s = s.replace('@@FOOTER@@', footer)
  if (s.includes('@@')) throw new Error('unreplaced marker in ' + name)
  fs.writeFileSync(path.join(out, name.replace(/\.html$/, '.dc.html')), s)
  console.log('built', name)
}
