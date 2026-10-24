const bible = (() => {
const verses = [
['16', '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 저를 믿는 자마다 멸망치 않고 영생을 얻게 하려 하심이니라'],
['17', '하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요 저로 말미암아 세상이 구원을 받게 하려 하심이라'],
['18', '저를 믿는 자는 심판을 받지 아니하는 것이요 믿지 아니하는 자는 하나님의 독생자의 이름을 믿지 아니하므로 벌써 심판을 받은 것이니라']
];
const seg = (labels, active) => labels.map((l, i) => ({ label: l, bg: i === active ? '#333333' : 'transparent', fg: i === active ? '#ececec' : '#8c8c8c' }));
const sw = (label, on) => ({ label: label, checked: on ? 'true' : 'false', track: on ? '#2a70dc' : '#3a3a3a', knob: on ? '14px' : '2px' });
const hint = (match, rest, bg) => ({ match: match, rest: rest, range: '3:16-18', note: '3절', bg: bg, selected: bg === 'transparent' ? 'false' : 'true' });
return {
title: '요한복음 3:16-18', count: '3장',
split: seg(['한 장에 한 절', '두 절씩', '길이에 맞춤'], 0),
toggles: [sw('절 번호', true), sw('역본 이름', false)],
slides: verses.map((v, i) => ({ n: i + 1, num: v[0], text: v[1], ref: '3:' + v[0], full: '요한복음 3:' + v[0], state: i === 0 ? 'selected' : 'idle' })),
current: verses[0][1],
suggest: [hint('요', '한복음', '#333333'), hint('요', '한일서', 'transparent'), hint('요', '엘', 'transparent')],
recent: [{ book: '창세기', range: '1:1-5' }, { book: '시편', range: '23:1-6' }]
};
})();
