// src/components/SlideComponent.js
import React from 'react';
import styles from './styles/SlideComponent.module.css';

function SlideComponent({ slide, index}) {
  return (
    <div className={`${styles.slide}`}>
      <div className={`${styles.text}`}>
        {slide.content}
      </div>
      <div className={styles.label}>
        {slide.isLabeled && (
          <div
            className={styles.labelColor}
            style={{ backgroundColor: slide.labelColor }}
          >
            {slide.subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
export default SlideComponent;
