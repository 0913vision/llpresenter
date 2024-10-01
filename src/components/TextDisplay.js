import React from 'react';

function TextDisplay({ visible, textFormat, textContent }) {
  if (!visible) {
    return null; // 텍스트가 보이지 않을 경우 렌더링하지 않음
  }

  const textStyle = {
    fontFamily: textFormat.font,
    fontSize: `${textFormat.size}px`,
    color: textFormat.color,
    textAlign: textFormat.alignment,
    position: 'absolute',
    top: `${textFormat.position.top}%`,
    left: `${textFormat.position.left}%`,
  };

  return <div style={textStyle}>{textContent}</div>;
}

export default TextDisplay;
