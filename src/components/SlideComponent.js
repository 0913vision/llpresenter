// src/components/SlideComponent.js
import React from 'react';

function SlideComponent({ slide, index, groupIndex, onSelectSlide, onSlideUpdate, selectedSlide }) {
  return (
    <div style={styles.slide} onClick={() => onSelectSlide(slide)}>
      {slide.content}
    </div>
  );
}

const styles = {
  slide: {
    width: '100px',
    height: '100px',
    padding: '10px',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '5px',
    cursor: 'pointer',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default SlideComponent;
