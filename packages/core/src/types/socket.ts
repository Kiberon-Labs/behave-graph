import type { Choices } from '~/Sockets/Socket';
import type { IGraph, NodeConfiguration } from '..';

export interface SocketDefinition {
  valueType: string;
  defaultValue?: any;
  choices?: Choices;
  label?: string;
}

export type SocketsMap = Record<
  string,
  | SocketDefinition
  | string
  | ((nodeConfig: NodeConfiguration, graph: IGraph) => SocketDefinition)
>;
export type SocketListDefinition = SocketDefinition & { key: string };
export type SocketsList = SocketListDefinition[];
