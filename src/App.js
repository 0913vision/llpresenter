// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LyricsEditWindow from './components/LyricsEditWindow';
import MainWindow from './components/MainWindow';
import ColorModal from './components/ColorModal';
import LyricsAddWindow from './components/LyricsAddWindow';
import SceneRenderer from './components/SceneRenderer';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<MainWindow />}
        />
        <Route 
          path="/lyricsEditWindow"
          element={<LyricsEditWindow />}
        />
        <Route 
          path="/lyricsAddWindow"
          element={<LyricsAddWindow />}
        />
        <Route
          path="/ColorModal"
          element={<ColorModal />}
        />
        <Route
          path="/sceneRenderer"
          element={<SceneRenderer />}
        />
      </Routes>
    </Router>
  );
};

export default App;
