// src/App.js
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

import MainWindow from './components/MainWindow';
import SceneRenderWindow from './components/SceneRenderWindow';
import LyricsEditWindow from './components/sub_windows/LyricsEditWindow';
import LyricsAddWindow from './components/sub_windows/LyricsAddWindow';
import SceneSetupWindow from './components/sub_windows/SceneSetupWindow';

import './App.css';
import './assets/fonts/fonts.css'; 

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
          path="/sceneRenderer"
          element={<SceneRenderWindow />}
        />
        <Route
          path="/sceneSetupWindow"
          element={<SceneSetupWindow />}
        />
      </Routes>
    </Router>
  );
};

export default App;