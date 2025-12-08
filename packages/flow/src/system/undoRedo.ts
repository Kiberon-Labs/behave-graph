interface Command {
  execute(): void;
  undo(): void;
  /**
   * Optional redo method if different from execute
   */
  redo?(): void;
}

export class UndoManager {
  private history: Command[] = [];
  private stack: Command[] = [];
  private limit = 100; // optional limit

  execute(command: Command) {
    command.execute();
    this.history.push(command);
    this.stack = []; // clear redo stack

    if (this.history.length > this.limit) {
      this.history.shift();
    }
  }

  undo() {
    const command = this.history.pop();
    if (command) {
      command.undo();
      this.stack.push(command);
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
  }
}
