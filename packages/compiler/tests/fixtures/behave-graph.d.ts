declare module 'behave-graph' {
  export type Flow = {
    complete(): void;
  };

  export const Description: (desc: string) => ParameterDecorator;

  export class Node<
    I extends Record<string, Socket<any>> = {},
    O extends Record<string, Socket<any>> = {}
  > {
    inputs: I;
    outputs: O;
    exec: (() => void) | undefined;
    read<K extends keyof I>(name: K): I[K] extends Socket<infer T> ? T : never;

    getOutput<K extends keyof O>(
      name: K
    ): O[K] extends Socket<infer T> ? Output<T> : never;
  }

  export class Socket<T = any> {
    constructor(opts: { name?: string; node: any });
  }

  export type Output<T> = (value: T) => void;
}
