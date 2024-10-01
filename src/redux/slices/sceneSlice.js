import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  scenes: [],
};

/**
 * Scene slice
 * scene: {id, name, visibleObjects:[booleans], textFormat:{font, size, position, alignment, color}}
 */

const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    createScene: (state, action) => {
      const { name, objectsVisibility, camera, format } = action.payload;
      state.scenes.push({ id: uuidv4(), name, objectsVisibility, camera, format });
    },
    updateScene: (state, action) => {
      const { id, name, visibleObjects, textFormat } = action.payload;
      const scene = state.scenes.find((scene) => scene.id === id);
      scene.name = name;
      scene.visibleObjects = visibleObjects;
      scene.textFormat = textFormat;
    },
    deleteScene: (state, action) => {
      const id = action.payload.id;
      state.scenes = state.scenes.filter((scene) => scene.id !== id);
    },
  },
});

export const sceneActions = sceneSlice.actions;
export const sceneReducer = sceneSlice.reducer;