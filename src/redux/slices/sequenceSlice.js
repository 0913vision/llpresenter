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
      const { name, text, update } = action.payload;
      
      const newItems = generateItems(text);
      const newSequence = createNewSequence(name, newItems);
      newItems.forEach(item => item.sequence = newSequence.id);

      // console.log(newItems);
      // console.log(newSequence);

      // 상태 업데이트
      state.sequences.push(newSequence);
      state.items.push(...newItems);

      if(update) {
        state.currentSequence = newSequence.id;
      }
    },
    // Placeholder for adding a new item
    addItem: (state, action) => {
      // code to add a new item
    },
    updateItem: (state, action) => {
      const { items } = action.payload;
      items.forEach(item => {
        Object.assign(state.items.find(i => i.id === item.id), item);
      });
    },
    setCurrentSequence: (state, action) => {
      // console.log("setCurrentSequence", action.payload);
      const { id } = action.payload;
      state.currentSequence = id;
    },
    setCurrentItems: (state, action) => {
      // console.log("setCurrentItems", action.payload);
      const { ids } = action.payload;
      state.currentItems = ids;
    },
    deleteItems: (state, action) => {
      const { ids } = action.payload;
      ids.forEach(id => {
        const item = state.items.find(item => item.id === id);
        const sequence = state.sequences.find(sequence => sequence.id === item.sequence);
        sequence.items = sequence.items.filter(itemId => itemId !== id); // 시퀀스에서 아이템 제거
      })
      state.items = state.items.filter(item => !ids.includes(item.id)); // 아이템에서 제거
      state.currentItems = state.currentItems.filter(id => !ids.includes(id)); // 현재 아이템에서 제거
    }
  }
});

export const sequenceActions = sequenceSlice.actions;
export const sequenceReducer = sequenceSlice.reducer;
