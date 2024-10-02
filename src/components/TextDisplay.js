import React from 'react';

function TextDisplay({ textFormat, textContent }) {

  const textStyle = {
    fontFamily: textFormat.family,
    fontWeight: textFormat.weight,
    fontStyle: textFormat.style,
    fontSize: `${textFormat.size}px`,
    color: textFormat.color,
    textAlign: textFormat.alignment,
    position: 'absolute',
    top: `${textFormat.position.top}%`,
    left: `${textFormat.position.left}%`,
    whiteSpace: 'pre-wrap',
    letterSpacing: `${(textFormat.letterSpacing-100)/100}em`,
    textShadow: 
      (textFormat.outline || textFormat.shadow)
        ? `${
            textFormat.outline 
              ? '-0.03em -0.03em 0 #000, 0.03em -0.03em 0 #000, -0.03em 0.03em 0 #000, 0.03em 0.03em 0 #000'
              : ''
          }${
            textFormat.outline && textFormat.shadow ? ', ' : ''
          }${
            textFormat.shadow
              ? '0 0.05em 0.05em rgba(0,0,0,0.5), 0 0.05em 0.1em rgba(0,0,0,0.5), 0 0.1em 0.2em rgba(0,0,0,0.5)'
              : ''
          }`
        : 'none'
  };
  console.log(textFormat);

  return <div style={textStyle}>{textContent}</div>;
}

export default TextDisplay;
