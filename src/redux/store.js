import { configureStore } from '@reduxjs/toolkit';
import { sequenceReducer } from './slices/sequenceSlice';
import { sceneReducer } from './slices/sceneSlice';
import { videoReducer } from './slices/videoSlice';

const store = configureStore({
  reducer: {
    sequence: sequenceReducer,
    scene: sceneReducer,
    video: videoReducer,
  }
});

export default store;
