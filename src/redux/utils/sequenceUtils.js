// src/redux/utils/sequenceUtils.js

import { v4 as uuidv4 } from 'uuid';

// 새로운 items 배열을 생성하는 함수
export const generateItems = (text) => {
  return text.split('\n\n').map(slide => ({
    id: uuidv4(),
    type: 'text',
    content: slide.trim(),
    sequence: '',
    isLabeled: false,
    subtitle: '',
    labelColor: ''
  }));
};

// 새로운 sequence 객체를 생성하는 함수
export const createNewSequence = (name, items) => {
  return {
    id: uuidv4(),
    name: name,
    items: items.map(item => item.id)
  };
};

export const getCurrentSequenceById = (state, id) => {
  return state.sequence.sequences.find(sequence => sequence.id === id);
}