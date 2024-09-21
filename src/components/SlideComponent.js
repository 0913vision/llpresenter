// src/components/SlideComponent.js
import React from 'react';

function SlideComponent({ slide, index}) {
  return (
    <div 
      style={styles.slide}
    >
      {slide.content}
    </div>
  );
}

const styles = {
  slide: {
    width: '150px',
    height: '84.375px',
    padding: '3px',
    backgroundColor: '#000',
    border: '1px solid #ddd',
    borderRadius: '2px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#fff',
    pointerEvents: 'none',
    userSelect: 'none',
  },
};

export default SlideComponent;
