import { configureStore } from '@reduxjs/toolkit';
import { sequenceReducer } from './slices/sequenceSlice';

const store = configureStore({
  reducer: {
    sequence: sequenceReducer
  }
});

export default store;
