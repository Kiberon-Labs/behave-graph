export interface TopicEvents {
  // This interface is meant to be extended in other parts of the application
  // using module augmentation.
  // Example:
  // declare module './pubsub' {
  //   export interface TopicEvents {
  //     'user.created': { id: string; name: string };
  //     'notification': string;
  //   }
  // }
  [topic: string]: any;
}

type Subscriber<Events extends TopicEvents, K extends keyof Events> = (
  message: K,
  data: Events[K]
) => void;

type AnySubscriber = (message: string, data: any) => void;

export class PubSub<Events extends TopicEvents = TopicEvents> {
  private messages: Record<string, Record<string, AnySubscriber>> = {};
  private lastUid = -1;
  private static readonly ALL_SUBSCRIBING_MSG = '*';

  private hasKeys(obj: object): boolean {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return true;
      }
    }
    return false;
  }

  private throwException(ex: Error) {
    return function reThrowException() {
      throw ex;
    };
  }

  private callSubscriberWithDelayedExceptions(
    subscriber: AnySubscriber,
    message: string,
    data: any
  ) {
    try {
      subscriber(message, data);
    } catch (ex: any) {
      setTimeout(this.throwException(ex), 0);
    }
  }

  private callSubscriberWithImmediateExceptions(
    subscriber: AnySubscriber,
    message: string,
    data: any
  ) {
    subscriber(message, data);
  }

  private deliverMessage(
    originalMessage: string,
    matchedMessage: string,
    data: any,
    immediateExceptions?: boolean
  ) {
    const subscribers = this.messages[matchedMessage];
    const callSubscriber = immediateExceptions
      ? this.callSubscriberWithImmediateExceptions
      : this.callSubscriberWithDelayedExceptions;

    if (!Object.prototype.hasOwnProperty.call(this.messages, matchedMessage)) {
      return;
    }

    for (const s in subscribers) {
      if (Object.prototype.hasOwnProperty.call(subscribers, s)) {
        callSubscriber.call(this, subscribers[s]!, originalMessage, data);
      }
    }
  }

  private createDeliveryFunction<K extends keyof Events & string>(
    message: K,
    data: Events[K],
    immediateExceptions?: boolean
  ): () => void {
    return () => {
      const messageString = message as string;
      let topic = messageString;
      let position = topic.lastIndexOf('.');

      this.deliverMessage(
        messageString,
        messageString,
        data,
        immediateExceptions
      );

      while (position !== -1) {
        topic = topic.substr(0, position);
        position = topic.lastIndexOf('.');
        this.deliverMessage(messageString, topic, data, immediateExceptions);
      }

      this.deliverMessage(
        messageString,
        PubSub.ALL_SUBSCRIBING_MSG,
        data,
        immediateExceptions
      );
    };
  }

  private hasDirectSubscribersFor(message: string): boolean {
    const topic = String(message);
    return (
      Object.prototype.hasOwnProperty.call(this.messages, topic) &&
      this.hasKeys(this.messages[topic]!)
    );
  }

  private messageHasSubscribers(message: string): boolean {
    let topic = String(message);
    let found =
      this.hasDirectSubscribersFor(topic) ||
      this.hasDirectSubscribersFor(PubSub.ALL_SUBSCRIBING_MSG);
    let position = topic.lastIndexOf('.');

    while (!found && position !== -1) {
      topic = topic.substr(0, position);
      position = topic.lastIndexOf('.');
      found = this.hasDirectSubscribersFor(topic);
    }

    return found;
  }

  private internalPublish<K extends keyof Events & string>(
    message: K,
    data: Events[K],
    sync: boolean,
    immediateExceptions: boolean = false
  ): boolean {
    const messageString = message as string;

    const deliver = this.createDeliveryFunction(
      message,
      data,
      immediateExceptions
    );
    const hasSubscribers = this.messageHasSubscribers(messageString);

    if (!hasSubscribers) {
      return false;
    }

    if (sync) {
      deliver();
    } else {
      setTimeout(deliver, 0);
    }
    return true;
  }

  public publishHook<K extends keyof Events & string>(
    message: K,
    data: Events[K]
  ): boolean {
    return this.internalPublish(message, data, false, true);
  }

  public publish<K extends keyof Events & string>(
    message: K,
    data: Events[K]
  ): boolean {
    return this.internalPublish(message, data, false);
  }

  public publishSync<K extends keyof Events & string>(
    message: K,
    data: Events[K]
  ): boolean {
    return this.internalPublish(message, data, true);
  }

  public subscribe<K extends keyof Events & string>(
    message: K,
    func: Subscriber<Events, K>
  ): string | false {
    if (typeof func !== 'function') {
      return false;
    }

    const messageString = message as string;

    if (!Object.prototype.hasOwnProperty.call(this.messages, messageString)) {
      this.messages[messageString] = {};
    }

    const token = `uid_${String(++this.lastUid)}`;
    this.messages[messageString]![token] = func as AnySubscriber;

    return token;
  }

  public subscribeAll(func: AnySubscriber): string | false {
    return this.subscribe(PubSub.ALL_SUBSCRIBING_MSG as any, func as any);
  }

  public subscribeOnce<K extends keyof Events & string>(
    message: K,
    func: Subscriber<Events, K>
  ): this {
    const token = this.subscribe(message, (msg, data) => {
      this.unsubscribe(token as string);
      func(msg, data);
    });
    return this;
  }

  public clearAllSubscriptions(): void {
    this.messages = {};
  }

  public clearSubscriptions(topic: string): void {
    for (const m in this.messages) {
      if (
        Object.prototype.hasOwnProperty.call(this.messages, m) &&
        m.indexOf(topic) === 0
      ) {
        delete this.messages[m];
      }
    }
  }

  public countSubscriptions(topic: string): number {
    let count = 0;
    for (const m in this.messages) {
      if (
        Object.prototype.hasOwnProperty.call(this.messages, m) &&
        m.indexOf(topic) === 0
      ) {
        for (const token in this.messages[m]) {
          if (Object.prototype.hasOwnProperty.call(this.messages[m], token)) {
            count++;
          }
        }
      }
    }
    return count;
  }

  public getSubscriptions(topic: string): string[] {
    const list: string[] = [];
    for (const m in this.messages) {
      if (
        Object.prototype.hasOwnProperty.call(this.messages, m) &&
        m.indexOf(topic) === 0
      ) {
        list.push(m);
      }
    }
    return list;
  }

  private descendantTopicExists(topic: string): boolean {
    for (const m in this.messages) {
      if (
        Object.prototype.hasOwnProperty.call(this.messages, m) &&
        m.indexOf(topic) === 0
      ) {
        return true;
      }
    }
    return false;
  }

  public unsubscribe(value: string | Function): boolean | string {
    const isTopic =
      typeof value === 'string' &&
      (Object.prototype.hasOwnProperty.call(this.messages, value) ||
        this.descendantTopicExists(value));
    const isToken = !isTopic && typeof value === 'string';
    const isFunction = typeof value === 'function';
    let result: boolean | string = false;

    if (isTopic) {
      this.clearSubscriptions(value as string);
      return true; // Indicate success
    }

    for (const m in this.messages) {
      if (Object.prototype.hasOwnProperty.call(this.messages, m)) {
        const message = this.messages[m];

        if (!message) {
          continue;
        }

        if (isToken && message[value as string]) {
          delete message[value as string];
          result = value;
          break;
        }

        if (isFunction) {
          for (const t in message) {
            if (
              Object.prototype.hasOwnProperty.call(message, t) &&
              message[t] === value
            ) {
              delete message[t];
              result = true;
            }
          }
        }
      }
    }

    return result;
  }
}
