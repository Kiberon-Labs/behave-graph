/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageHandler } from './messageHandler';

export type LoaderOpts = {
  uri: string;
};

export class Loader {
  nexus: MessageHandler;
  cache: Record<string, any> = {};

  constructor(nexus: MessageHandler) {
    this.nexus = nexus;

    this.nexus.on('updatedResource', ({ uri, data }) => {
      this.cache[uri] = data;
    });
  }

  public getLoader = () => {
    return async (opts: LoaderOpts) => {
      if (this.cache[opts.uri]) {
        return this.cache[opts.uri];
      }

      const data = await this.nexus.postMessageWithResponse(
        'loadResource',
        opts.uri
      );

      //Cache
      this.cache[opts.uri] = data;
      return data;
    };
  };
}
