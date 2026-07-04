import { create } from 'zustand';

export interface Command {
  name: string;
  execute(): void;
  undo(): void;
  /**
   * Optional redo method if different from execute
   */
  redo?(): void;
}

export type UndoStackEntry = {
  name: string;
};

export type UndoStore = {
  canUndo: boolean;
  canRedo: boolean;
  history: UndoStackEntry[];
  redoStack: UndoStackEntry[];
  setSnapshot: (snapshot: {
    canUndo: boolean;
    canRedo: boolean;
    history: UndoStackEntry[];
    redoStack: UndoStackEntry[];
  }) => void;
};

const undoStoreFactory = () =>
  create<UndoStore>((set) => ({
    canUndo: false,
    canRedo: false,
    history: [],
    redoStack: [],
    setSnapshot: (snapshot) => set(() => snapshot)
  }));

export class UndoManager {
  private history: Command[] = [];
  private stack: Command[] = [];
  private limit = 100; // optional limit
  public store = undoStoreFactory();

  constructor() {
    this.syncStore();
  }

  private syncStore() {
    this.store.getState().setSnapshot({
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      history: this.history.map((c) => ({ name: c.name })),
      redoStack: this.stack.map((c) => ({ name: c.name }))
    });
  }

  execute(command: Command) {
    command.execute();
    this.history.push(command);
    this.stack = []; // clear redo stack

    if (this.history.length > this.limit) {
      this.history.shift();
    }

    this.syncStore();
  }

  undo() {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.stack.push(command);
      this.syncStore();
    }
  }

  redo() {
    const command = this.stack.pop();
    if (command) {
      if (command.redo) {
        command.redo();
      } else {
        command.execute();
      }
      this.history.push(command);
      this.syncStore();
    }
  }

  canUndo() {
    return this.history.length > 0;
  }
  canRedo() {
    return this.stack.length > 0;
  }
  clear() {
    this.history = [];
    this.stack = [];
    this.syncStore();
  }
}
