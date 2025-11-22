import { Socket } from '../Sockets/Socket.js';
import type { INode } from './NodeInstance.js';

export class Link {
  public _targetNode: INode | undefined = undefined;
  public _targetSocket: Socket | undefined = undefined;
  public nodeId: string;
  public socketName: string;

  constructor(nodeId: string = '', socketName: string = '') {
    this.nodeId = nodeId;
    this.socketName = socketName;
  }
}
