import { Node, Socket, type Output } from 'behave-graph';
import exportDefault__impl from './exportDefault.src';
export default class exportDefault extends Node {
  constructor() {
    super();
    this.inputs = [
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
      const num1 = this.read('num1') as number;
      const num2 = this.read('num2') as number;
      const output = this.getOutput('output') as Output<number>;
      exportDefault__impl(num1, num2, output);
    };
  }
}
