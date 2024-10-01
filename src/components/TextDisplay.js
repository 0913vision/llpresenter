import React from 'react';

function TextDisplay({ textFormat, textContent }) {

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
