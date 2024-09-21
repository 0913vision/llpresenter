// src/components/MenuBar.js
import React from 'react';

function MenuBar({ onFileUpload }) {
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        onFileUpload(text);
        event.target.value = '';
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={styles.menuBar}>
      <span>File</span>
      <span>Edit</span>
      <span>View</span>
      <span>Settings</span>
      <input
        type="file"
        accept=".txt"
        style={{ display: 'none' }}
        id="fileInput"
        onChange={handleFileUpload}
      />
      <label htmlFor="fileInput" style={styles.fileLabel}>
        Import Text
      </label>
    </div>
  );
}

const styles = {
  menuBar: {
    height: '2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.1rem 2.5rem',
    backgroundColor: '#333',
    color: '#fff',
  },
  fileLabel: {
    backgroundColor: '#444',
    color: '#fff',
    padding: '5px 10px',
    cursor: 'pointer',
  },
};

export default MenuBar;
