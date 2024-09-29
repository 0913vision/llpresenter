import { createSlice } from '@reduxjs/toolkit';
import { generateItems, createNewSequence } from '../utils/sequenceUtils';

const initialState = {
  sequences: [],        // [{id, title, items: [ids]}]
  items: [],            // [{id, type, content, parameters: {...}}]
  currentItems: [],     // [ids]
  currentSequence: null // id
};

const sequenceSlice = createSlice({
  name: 'sequence',
  initialState,
  reducers: {
    // Placeholder for adding a new sequence
    createSequence: (state, action) => {
      const { name, text } = action.payload;
      
      // 유틸리티 함수를 이용하여 items 생성
      const newItems = generateItems(text);
      // 유틸리티 함수를 이용하여 새로운 sequence 생성
      const newSequence = createNewSequence(name, newItems);

      console.log(newSequence);

      // 상태 업데이트
      state.sequences.push(newSequence);
      state.items.push(...newItems);
    },
    // Placeholder for adding a new item
    addItem: (state, action) => {
      // code to add a new item
    },
    // Placeholder for updating an item content
    updateItem: (state, action) => {
      // code to update item content
    },
    // Placeholder for setting the current sequence
    setCurrentSequence: (state, action) => {
      // code to set the current sequence
    },
    // Placeholder for setting the current items
    setCurrentItems: (state, action) => {
      // code to set the current items
    }
  }
});

export const sequenceActions = sequenceSlice.actions;
export const sequenceReducer = sequenceSlice.reducer;
