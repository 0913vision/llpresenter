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
    height: '100vh',
    padding: '10px',
    boxShadow: '0px 0px 10px rgba(0,0,0,0.1)',
    overflow: 'auto',
  },
  left: {
    backgroundColor: '#f4f4f4',
    borderRight: '1px solid #ddd',
  },
  right: {
    backgroundColor: '#f4f4f4',
    borderLeft: '1px solid #ddd',
  },
};

export default Sidebar;
