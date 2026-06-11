import { type Output, type Flow, Description } from 'behave-graph';

export class flow {
  static exec(
    @Description('The flow control object') flow: Flow,
    @Description('The first number to add') num1: number,
    @Description('The second number to add') num2: number,
    @Description('The output of the addition') output: Output<number>
  ) {
    output(num1 + num2);
    flow.complete();
  }
}
