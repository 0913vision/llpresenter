// src/components/Sidebar.js
import React from 'react';

function Sidebar({ position }) {
  return (
    <div style={{ ...styles.sidebar, ...(position === 'left' ? styles.left : styles.right) }}>
      <h3>{position === 'left' ? 'Quick Menu' : 'Properties'}</h3>
      {/* 왼쪽 사이드바는 현재 비워두기 */}
    </div>
  );
}

const styles = {
  sidebar: {
    width: '250px',
    backgroundColor: '#f4f4f4',
    padding: '10px',
    height: '100dvh',
    boxShadow: '0px 0px 10px rgba(0,0,0,0.1)',
  },
  left: {
    borderRight: '1px solid #ddd',
  },
  right: {
    borderLeft: '1px solid #ddd',
  },
};

export default Sidebar;
