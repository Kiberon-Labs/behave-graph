import type { Output, Flow } from 'behave-graph';

export const flow = (
  flow: Flow,
  num1: number,
  num2: number,
  output: Output<number>
) => {
  output(num1 + num2);
  flow.complete();
};
