import React from 'react';
import type { PropsWithChildren } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';

import { useOnPressKey } from '../../hooks/useOnPressKey.js';

export type ModalAction = {
  label: string;
  onClick: () => void;
};

export type ModalProps = {
  open?: boolean;
  onClose: () => void;
  title: string;
  actions: ModalAction[];
};

export const Modal: React.FC<PropsWithChildren<ModalProps>> = ({
  open = false,
  onClose,
  title,
  children,
  actions
}) => {
  useOnPressKey('Escape', onClose);

  if (open === false) return null;

  const actionColors = {
    primary: 'bg-teal-400 hover:bg-teal-500',
    secondary: 'bg-gray-400 hover:bg-gray-500'
  };

  return (
    <>
      <div
        className="z-[19] fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
        onClick={onClose}
      ></div>
      <div className="z-20 relative top-20 mx-auto border w-96 shadow-lg bg-white text-sm rounded-md">
        <div className="p-3 border-b">
          <h2 className="text-lg text-center font-bold">{title}</h2>
        </div>
        <div className="p-3">{children}</div>
        <div className="flex gap-3 p-3">
          {actions.map((action, ix) => (
            <VscodeButton
              key={ix}
              className={'w-full'}
              secondary={ix !== actions.length - 1}
              onClick={action.onClick}
            >
              {action.label}
            </VscodeButton>
          ))}
        </div>
      </div>
    </>
  );
};
