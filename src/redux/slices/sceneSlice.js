import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  scenes: [],
};

/**
 * Scene slice
 * scene: {id, name, objectsVisibility:{}, format:{text{font, size, position, alignment, color}}}
 */

const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    createScene: (state, action) => {
      const { monitorId, name, objectsVisibility, camera, format } = action.payload;
      const newScene = { monitorId, name, objectsVisibility, camera, format };
      state.scenes.push(newScene);
    },
    updateScene: (state, action) => {
      const { monitorId, name, objectsVisibility, camera, format } = action.payload;
      const scene = state.scenes.find((scene) => scene.monitorId === monitorId);
      scene.name = name;
      scene.objectsVisibility = objectsVisibility;
      scene.camera = camera;
      scene.format = format;
    },
    deleteScene: (state, action) => {
      const id = action.payload.id;
      state.scenes = state.scenes.filter((scene) => scene.id !== id);
    },
  },
});

export const sceneActions = sceneSlice.actions;
export const sceneReducer = sceneSlice.reducer;