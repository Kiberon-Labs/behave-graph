import { HotKeys as HotKeysComp } from 'react-hotkeys';
import { useSystem } from '@/system';
import { useStore } from 'zustand';

export const HotKeys = ({ children }: { children: React.ReactNode }) => {
  const sys = useSystem();
  const keyMap = useStore(sys.hotKeyStore, (x) => x.keymap);
  const handlers = useStore(sys.hotKeyStore, (x) => x.handlers);
  return (
    <HotKeysComp
      keyMap={keyMap}
      handlers={handlers}
      allowChanges
      style={{ height: '100%', width: '100%' }}
    >
      {children}
    </HotKeysComp>
  );
};
