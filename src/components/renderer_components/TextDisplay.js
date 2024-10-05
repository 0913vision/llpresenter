import React from 'react';
import styles from './styles/TextDisplay.module.css';

function TextDisplay({ textFormat, textContent }) {
  console.log(textFormat);
  const textStyle = {
    fontFamily: textFormat.family,
    fontWeight: textFormat.weight,
    fontStyle: textFormat.style,
    fontSize: `${textFormat.size}px`,
    color: textFormat.color,
    textAlign: textFormat.alignment.horizontal,
    position: 'absolute',
    transform: `translate(${textFormat.position.x}%, ${textFormat.position.y}%)`,
    whiteSpace: 'pre-wrap',
    letterSpacing: `${(textFormat.letterSpacing)}em`,
    lineHeight: textFormat.lineHeight,
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

  return <div className={styles.textDisplay} style={textStyle}>{textContent}</div>;
}

export default TextDisplay;
