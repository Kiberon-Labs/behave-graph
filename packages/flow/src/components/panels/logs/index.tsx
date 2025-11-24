import React, { useCallback, useEffect, useRef } from 'react';
import { Search, Trash } from 'iconoir-react';
import { VscodeBadge, VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';

export function LogsPanel() {

  const system = useSystem();
  const logs = useStore(system.logsStore, (x => x.logs));
  const clearLogs = useStore(system.logsStore, (x => x.clear));

  const [searchText, setSearchText] = React.useState('');
  const [currentSearchTerm, setCurrentSearchTerm] = React.useState('');

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
    },
    [],
  );

  const handleSearch = useCallback(() => {
    setCurrentSearchTerm(searchText);
  }, [searchText]);

  const filteredLogs = React.useMemo(() => {
    if (!currentSearchTerm) {
      return logs;
    }
    const lowerCaseSearchText = currentSearchTerm.toLowerCase();
    return logs.filter(log => {
      const logDataString = JSON.stringify(log.data).toLowerCase();
      const logTypeString = log.type.toLowerCase();
      return logDataString.includes(lowerCaseSearchText) || logTypeString.includes(lowerCaseSearchText);
    });
  }, [logs, currentSearchTerm]);

  return (
    <div className='flex-col gap-1 h-100 flex-1 p-1'>
      <div className="flex">
        <VscodeTextfield
          className='flex-1'
          value={searchText}
          placeholder="Search logs..."
          onChange={onSearchChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
        <VscodeButton secondary iconOnly onClick={handleSearch}>
          <Search />
        </VscodeButton>
        <VscodeButton secondary onClick={clearLogs} iconOnly >
          <Trash />
        </VscodeButton>
      </div>

      <div
        style={{
          padding: 'var(--component-spacing-xs)',
          overflow: 'auto',
          fontSize: 'smaller',
        }}
      >
        <div className='flex-col gap-1 p-1'>
          {filteredLogs.map((log, index) => (
            <div
              key={index}
              style={{
                border: '1px solid var(--color-neutral-stroke-subtle)',
                padding: 'var(--component-spacing-sm)',
              }}
            >
              <div className='flex gap-1 items-center'>

                <VscodeBadge>
                  {log.type}
                </VscodeBadge>
                <span
                  style={{
                    fontSize: '0.7em'
                  }}
                >
                  {log.time.toLocaleTimeString()}
                </span>


                <div className="flex-1"  >
                  {JSON.stringify(log.data)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
