import React, { createContext, useContext, type ReactNode } from 'react';
import { System } from './system';

export const SystemContext = createContext<System | undefined>(undefined);


export type SystemProviderProps = {
    children: ReactNode;
    value: System;
};
export function SystemProvider({ children, value }: SystemProviderProps) {
    return <SystemContext value={value}>{children}</SystemContext>;
}

export function useSystem() {
    const context = useContext(SystemContext);

    if (context === undefined) {
        throw new Error('useSystem must be used within a SystemProvider');
    }

    return context;
}
