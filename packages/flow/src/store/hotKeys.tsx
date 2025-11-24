
import { create } from 'zustand';


export type HotkeyStore = {
    keymap: Record<string, string | string[]>,
    handlers: Record<string, (e: KeyboardEvent) => any>
    descriptions: Record<string, string>,
    register(action: string, trigger: string | string[]): void
    registerDescription(action: string, description: string): void
    registerHandler(action: string, handler: (e: KeyboardEvent) => any): void
};

export const hotKeyStoreFactory = () =>
    create<HotkeyStore>((set) => ({
        keymap: {},
        descriptions: {},
        handlers: {},
        register(action, trigger) {
            set((s) => ({
                keymap: {
                    ...s.keymap,
                    [action]: trigger
                }
            }))
        },
        registerHandler(name, handler) {
            set((s) => ({
                handlers: {
                    ...s.handlers,
                    [name]: handler
                }
            }))
        },
        registerDescription(name, desc) {
            set((s) => ({
                descriptions: {
                    ...s.descriptions,
                    [name]: desc
                }
            }))
        },
    }));
