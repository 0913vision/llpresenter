import {useState, type JSX} from 'react';
import type {Macro} from '@core/schema/macros';
import type {Notice} from '@renderer/ui/notices';
import {MacroView} from './MacroView';
import {MacroPalette} from './MacroPalette';
import {MacroMenu} from './MacroMenu';
import {MacroEditors} from './MacroEditors';
import {macroDuplicateReason} from './macroMenuEntries';
import {useMacroPanel} from './useMacroPanel';
import styles from './MacroPanel.module.css';

export function MacroPanel({
  lastRunId,
  onProblem,
}: {
  readonly lastRunId?: Macro['id'] | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const model = useMacroPanel({onProblem});
  const {
    macros,
    collections,
    currentCollection,
    mode,
    selectedId,
    menu,
    palette,
    locked,
    lockReason,
    newDisabledReason,
    createCollection,
    askDeleteCollection,
    selectCollection,
    changeMode,
    start,
    openMenu,
    dropAction,
    create,
    choosePaletteAction,
    closeMenu,
    menuHandlers,
  } = model;
  const [paletteDragging, setPaletteDragging] = useState(false);
  return (
    <>
      <div className={styles.panel}>
        <MacroView
          macros={macros}
          collections={collections}
          collectionId={currentCollection}
          mode={mode}
          selectedId={selectedId}
          lastRunId={lastRunId}
          collectionLocked={locked}
          onNewCollection={createCollection}
          onCollectionDelete={askDeleteCollection}
          onProblem={onProblem}
          onCollection={selectCollection}
          onMode={changeMode}
          onRun={start}
          onMenu={openMenu}
          onDropAction={dropAction}
          onNew={create}
          newDisabledReason={newDisabledReason}
          onDuplicate={item => menuHandlers(item).duplicate()}
          duplicateReason={macroDuplicateReason({
            locked,
            lockReason,
            macroCount: macros.length,
          })}
        />
        {palette.open ? (
          <div
            className={styles.palette}
            data-dragging={paletteDragging || undefined}
            onDragStart={() => setPaletteDragging(true)}
            onDragEnd={() => setPaletteDragging(false)}
          >
            <MacroPalette
              onClose={palette.close}
              onChoose={choosePaletteAction}
            />
          </div>
        ) : null}
      </div>
      {menu ? (
        <MacroMenu
          anchor={menu.anchor}
          onClose={closeMenu}
          onProblem={onProblem}
          input={{
            item: macros.find(item => item.id === menu.item.id) ?? menu.item,
            collections,
            shown: currentCollection,
            macroCount: macros.length,
            locked,
            lockReason,
          }}
          handlersFor={menuHandlers}
        />
      ) : null}
      <MacroEditors model={model} />
    </>
  );
}
