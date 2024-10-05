// videoSlice.js

import { createSlice } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

const initialState = {
  videos: [], // [{id:v4, title:str, duration:int(seconds), filePath:str, thumbnails:[]}]
};

const videoSlice = createSlice({
  name: 'sequence',
  initialState,
  reducers: {
    addVideo: (state, action) => {
      const { title, duration, filePath, thumbnails } = action.payload;
      const newVideo = { id: uuidv4(), title, duration, filePath, thumbnails };
      state.videos.push(newVideo);
    },
    deleteVideo: (state, action) => {
      const id = action.payload.id;
      state.videos = state.videos.filter((video) => video.id !== id);
    },
  }
});

export const videoActions = videoSlice.actions;
export const videoReducer = videoSlice.reducer;
