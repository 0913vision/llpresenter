import {useState, type JSX} from 'react';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useClearKeys} from '@renderer/show/clearKeys';
import {MenuBar} from '@renderer/shell/MenuBar';
import {StatusBar} from '@renderer/shell/StatusBar';
import {Toolbar, type Workspace as WorkspaceId} from '@renderer/shell/Toolbar';
import {useSizeClass} from '@renderer/shell/useSizeClass';
import {Workspace} from '@renderer/shell/Workspace';
import styles from './App.module.css';

export function App(): JSX.Element {
  useClearKeys();
  const sizeClass = useSizeClass();
  const [store] = useState(createMemoryColumnWidthStore);
  const [workspace, setWorkspace] = useState<WorkspaceId>('show');
  return (
    <div className={styles.app} data-size={sizeClass}>
      <MenuBar title="LoveLight Presenter" />
      <Toolbar
        sizeClass={sizeClass}
        workspace={workspace}
        onWorkspace={setWorkspace}
      />
      <Workspace id={workspace} sizeClass={sizeClass} store={store} />
      <StatusBar />
    </div>
  );
}
