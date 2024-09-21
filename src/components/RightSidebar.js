// src/components/RightSidebar.js
import React from 'react';

function RightSidebar({
  
}) {
  return (
    <div style={styles.sidebar}>
      <h3>Screen Control part</h3>
    </div>
  );
}

const styles = {
  sidebar: {
    height: '100vh',
    padding: '10px',
    boxShadow: '0px 0px 10px rgba(0,0,0,0.1)',
    overflow: 'auto',
    backgroundColor: '#f4f4f4',
    borderLeft: '1px solid #ddd',
  },
};

export default RightSidebar;
