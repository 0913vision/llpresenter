function distinguishArrayTypes(data) {
  if (Array.isArray(data)) {
    if (data.length === 0 || typeof data[0] === 'string') {
      // 문자열 배열 처리
      return 'string';
    } else if (typeof data[0] === 'object') {
      // 객체 배열 처리
      return 'object';
    }
  } else {
    return false;
  }
}

export default distinguishArrayTypes;