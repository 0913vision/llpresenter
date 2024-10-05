import React from 'react';
import './styles/LeftSidebar.module.css'; // CSS 파일 import
import { useSelector, useDispatch } from 'react-redux';
import { sequenceActions } from '@/redux/slices/sequenceSlice';

const LeftSidebar = () => {
  const sequences = useSelector((state) => state.sequence.sequences);
  const currentSequence = useSelector((state) => state.sequence.currentSequence);
  const dispatch = useDispatch();
  return (
    <div className="sidebar">
      {sequences.map((sequence, index) => (
        <div
          key={index}
          className={`group-item ${currentSequence && currentSequence === sequence.id ? 'selected' : ''}`}
          onClick={() => dispatch(sequenceActions.setCurrentSequence({ id: sequence.id }))}
        >
          {sequence.name}
        </div>
      ))}
    </div>
  );
};

export default LeftSidebar;
