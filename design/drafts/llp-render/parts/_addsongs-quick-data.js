const quickAdd = (() => {
const hl = (title, q) => { const i = title.indexOf(q); return { pre: title.slice(0, i), match: q, post: title.slice(i + q.length) }; };
const songs = [['주 하나님 지으신 모든 세계', '4장'], ['주님 다시 오실 때까지', '6장'], ['주의 친절한 팔에 안기세', '4장'], ['나를 향한 주의 사랑', '6장'], ['만복의 근원 하나님', '4장']];
return {
songs: songs.map((s, i) => Object.assign(hl(s[0], '주'), { count: s[1], bg: i === 0 ? '#333333' : 'transparent', selected: i === 0 ? 'true' : 'false' })),
kinds: [['rows', '머리글'], ['frame', '빈 자리'], ['book', '성경 구절'], ['film', '미디어'], ['notice', '공지']].map((k) => ({ icon: k[0], label: k[1] }))
};
})();
