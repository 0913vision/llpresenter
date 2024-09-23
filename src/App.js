// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LyricsEditWindow from './components/LyricsEditWindow';
import MainWindow from './components/MainWindow';
import ColorModal from './components/ColorModal';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<MainWindow />}
        />
        <Route 
          path="/LyricsEditWindow"
          element={<LyricsEditWindow />}
        />
        <Route
          path="/ColorModal"
          element={<ColorModal />}
        />
      </Routes>
    </Router>
  );
};

export default App;
