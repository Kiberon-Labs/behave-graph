import type { LogSeverity } from '@kiberon-labs/behave-graph';
import { create } from 'zustand';

export interface ILog {
  data: Record<string, unknown> | string;
  time: Date;
  type: LogSeverity;
}

export type LogStore = {
  logs: ILog[];
  append: (log: ILog) => void;
  clear: () => void;
};

export const logStoreFactory = () =>
  create<LogStore>((set) => ({
    logs: [],
    append: (log: ILog) =>
      set((state) => {
        return { logs: [...state.logs, log] };
      }),
    clear: () => set(() => ({ logs: [] }))
  }));
