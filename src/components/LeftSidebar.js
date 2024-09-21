import React from 'react';
import './styles/LeftSidebar.module.css'; // CSS 파일 import

const LeftSidebar = ({
  groups,
  selectedGroup,
  onGroupSelect,
}) => {
  return (
    <div className="sidebar">
      {groups.map((group, index) => (
        <div
          key={index}
          className={`group-item ${selectedGroup && selectedGroup.id === group.id ? 'selected' : ''}`}
          onClick={() => onGroupSelect(group)}
        >
          {group.name}
        </div>
      ))}
    </div>
  );
};

export default LeftSidebar;
