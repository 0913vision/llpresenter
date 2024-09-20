// src/App.js
import React, { useState } from 'react';
import MenuBar from './components/MenuBar';
import Sidebar from './components/Sidebar';
import CraftingZone from './components/CraftingZone';

function App() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedSlide, setSelectedSlide] = useState(null);

  const handleFileUpload = (text) => {
    const newSlides = text.split('\n\n').map((slide, index) => ({
      id: index,
      content: slide.trim(),
    }));
    const newGroup = {
      id: groups.length,
      name: `Group ${groups.length + 1}`,
      slides: newSlides,
    };
    setGroups([...groups, newGroup]);
    setSelectedGroup(newGroup);
    setSelectedSlide(null);
  };

  const handleSelectGroup = (group) => {
    console.log(group);
    setSelectedGroup(group);
    setSelectedSlide(null);
  };

  const handleSelectSlide = (slide) => {
    setSelectedSlide(slide);
  };

  const handleGroupUpdate = (updatedGroups) => {
    setGroups(updatedGroups);
  };

  const handleSlideUpdate = (updatedSlide) => {
    const updatedGroups = groups.map((group) => {
      if (group.id === selectedGroup.id) {
        return {
          ...group,
          slides: group.slides.map((slide) =>
            slide.id === updatedSlide.id ? updatedSlide : slide
          ),
        };
      }
      return group;
    });
    setGroups(updatedGroups);
  };

  return (
    <div style={styles.appContainer}>
      <MenuBar onFileUpload={handleFileUpload} />
      <div style={styles.mainContainer}>
        <div style={styles.craftingZoneContainer}>
          <CraftingZone
            groups={groups}
            selectedSlide={selectedSlide}
            onSlideUpdate={handleSlideUpdate}
            onSelectSlide={handleSelectSlide}
          />
        </div>
        <Sidebar position="right" />
      </div>
    </div>
  );
}

const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    margin:0,
    padding:0,
    height: '100vh',
  },
  mainContainer: {
    display: 'flex',
    height: '100%',
    flex: 1,
  },
  craftingZoneContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
};

export default App;
