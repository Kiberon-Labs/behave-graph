import { Node, Socket, type Flow, type Output } from 'behave-graph';
import { flow as flow__impl } from './class.src';
export class flow extends Node {
  constructor() {
    super();
    this.inputs = [
      new Socket<Flow>({
        name: 'flow',
        node: this
      }),
      new Socket<number>({
        name: 'num1',
        node: this
      }),
      new Socket<number>({
        name: 'num2',
        node: this
      })
    ];
    this.outputs = [
      new Socket<number>({
        name: 'output',
        node: this
      })
    ];
    this.exec = () => {
      const flow = this.read('flow') as Flow;
      const num1 = this.read('num1') as number;
      const num2 = this.read('num2') as number;
      const output = this.getOutput('output') as Output<number>;
      flow__impl.exec(flow, num1, num2, output);
    };
  }
}
