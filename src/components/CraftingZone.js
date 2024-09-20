// src/components/CraftingZone.js
import React from 'react';
import GroupComponent from './GroupComponent';
import styles from './CraftingZone.module.css';


function CraftingZone({
  groups,
  selectedGroup,
  selectedSlide,
  onSelectGroup,
  onGroupUpdate,
  onSlideUpdate,
  onSelectSlide
}) {

  return (
    <div className={styles.craftingZone}>
      {groups.map((group, index) => (
        <div id={`group-${group.id}`} key={group.id}>
          <GroupComponent
            group={group}
            index={index}
            onSelectGroup={onSelectGroup}
            onGroupUpdate={onGroupUpdate}
            onSlideUpdate={onSlideUpdate}
            selectedGroup={selectedGroup}
            selectedSlide={selectedSlide}
            onSelectSlide={onSelectSlide}
          />
        </div>
      ))}
    </div>
  );
}

export default CraftingZone;
