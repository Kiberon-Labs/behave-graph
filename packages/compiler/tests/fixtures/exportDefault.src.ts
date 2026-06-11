import type { Output } from 'behave-graph';

export default (num1: number, num2: number, output: Output<number>) => {
  output(num1 + num2);
};
