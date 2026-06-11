import type { ChoiceJSON } from '@kiberon-labs/behave-graph';

export interface SocketBase {
  name: string;
  key: string;
  choices?: ChoiceJSON;
  valueType: string;
  defaultValue?: any;
}

export type Socket = SocketBase;

export interface DynamicPorts {
  inputs?: SocketBase[];
  outputs?: SocketBase[];
}
