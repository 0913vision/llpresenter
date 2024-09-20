// src/components/GroupComponent.js
import React from 'react';
import SlideComponent from './SlideComponent';

function GroupComponent({
  group,
  index,
  onSelectGroup,
  onGroupUpdate,
  onSlideUpdate,
}) {
  return (
    <div style={styles.group}
      onClick={() => onSelectGroup(group)}
    >
      <h3 style={styles.groupHeader}>{group.name}</h3>
      <div style={styles.slides}>
        {group.slides.map((slide, slideIndex) => (
          <SlideComponent
            key={slide.id}
            slide={slide}
            index={slideIndex}
            groupIndex={index}
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: '15px',
    borderRadius: '5px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    backgroundColor: '#f0f0f0',
    boxSizing: 'border-box', // padding 포함한 크기 계산
    marginBottom: '10px',
  },
  groupHeader: {
    width: '100%',
    marginBottom: '10px',
    fontWeight: 'bold',
  },
  slides: {
    display: 'flex',
    flexWrap: 'wrap', // 슬라이드가 한 줄을 넘으면 줄바꿈
    gap: '10px',
    maxWidth: '100%',
  },
};

export default GroupComponent;
