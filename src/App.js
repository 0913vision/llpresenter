// src/App.js
import React, { useState, useRef, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LyricsEditWindow from './components/LyricsEditWindow';
import MainWindow from './components/MainWindow';
import ColorModal from './.deprecated/ColorModal';
import LyricsAddWindow from './components/LyricsAddWindow';
import SceneRenderer from './components/SceneRenderer';
import './assets/fonts/fonts.css'; 
import SceneSetupWindow from './components/SceneSetupWindow';

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
        <Route
          path="/sceneSetupWindow"
          element={<SceneSetupWindow />}
        />
      </Routes>
    </Router>
  );
};

export default App;


// import React, { useEffect, useState } from 'react';

// function App() {
//   const [fonts, setFonts] = useState(null);
//   const [selectedFont, setSelectedFont] = useState('');

//   useEffect(() => {
//     // Electron으로부터 폰트 목록 가져오기
//     window.electronAPI.getFontList().then((fonts) => {
//       setFonts(fonts);
//       console.log(fonts);
//     });
//   }, []);

//   useEffect(() => {
//     console.log(selectedFont);
//   }, [selectedFont]);


//   return (
//     <div style={{ fontFamily: selectedFont }}>
//       <h1>Choose a Font</h1>
//       {fonts && <select onChange={(e) => setSelectedFont(e.target.value)}>
//         {fonts.map((font, index) => (
//           <option key={index} value={font}>
//             {font}
//           </option>
//         ))}
//       </select>}

//       <p>This text will be displayed with the selected font!</p>
//     </div>
//   );
// }

// export default App;

