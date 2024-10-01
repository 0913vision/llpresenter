import { configureStore } from '@reduxjs/toolkit';
import { sequenceReducer } from './slices/sequenceSlice';
import { sceneReducer } from './slices/sceneSlice';

const store = configureStore({
  reducer: {
    sequence: sequenceReducer,
    scene: sceneReducer,
  }
});

export default store;
