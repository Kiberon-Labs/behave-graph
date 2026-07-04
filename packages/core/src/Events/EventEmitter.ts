export class EventEmitter<T> {
  private readonly listeners: ((t: T) => void)[] = [];

  addListener(listener: (t: T) => void) {
    this.listeners.push(listener);
  }

  removeListener(listener: (t: T) => void) {
    this.listeners.splice(this.listeners.indexOf(listener), 1);
  }

  clear() {
    this.listeners.splice(0, this.listeners.length);
  }

  emit(event: T) {
    if (this.listeners.length === 0) return;
    // single-listener fast path: no defensive copy needed since the loop
    // below completes in one call anyway
    if (this.listeners.length === 1) {
      this.listeners[0]!(event);
      return;
    }
    // copy array before emitting event to ensure even if listener array is modified, everyone listening initially gets the event.
    // inspired by mrdoob's EventDispatcher
    this.listeners.slice(0).forEach((listener) => {
      listener(event);
    });
  }

  get listenerCount(): number {
    return this.listeners.length;
  }
}
