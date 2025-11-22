import { Fiber } from '../../../Execution/Fiber.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import { FlowNode } from '../../../Nodes/FlowNode.js';
import {
  NodeDescription,
  NodeDescription2
} from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';

// interface State {
//   triggeredMap: { [key: string]: boolean };
//   triggeredCount: number;
//   outputTriggered: boolean;
// }

// const initialState: State = {
//   triggeredMap: {},
//   triggeredCount: 0,
//   outputTriggered: false
// };

// export const WaitAll = makeAsyncNodeDefinition({
//   typeName: 'flow/waitAll',
//   category: NodeCategory.Flow,
//   label: 'WaitAll',
//   configuration: {
//     numInputs: {
//       valueType: 'number',
//       defaultValue: 3
//     },
//     autoReset: {
//       valueType: 'boolean',
//       defaultValue: false
//     }
//   },
//   in: (configuration, arg2) => {
//     const inputs = [];
//     console.log('CONFIGURATION', configuration);
//     for (let i = 1; i <= configuration.numInputs; i++) {
//       inputs.push({ key: `input${i}`, valueType: 'flow', label: `Input ${i}` });
//     }
//     inputs.push({ key: 'reset', valueType: 'flow', label: 'Reset' });
//     inputs.push({
//       key: 'autoReset',
//       valueType: 'boolean',
//       label: 'Auto Reset',
//       defaultValue: false
//     });
//     return inputs;
//   },
//   out: {
//     flow: 'flow'
//   },
//   initialState,
//   triggered: ({ state, commit, read }) => {
//     const reset = () => {
//       for (
//         let inputIndex = 1;
//         inputIndex <= read<number>('numInputs');
//         inputIndex++
//       ) {
//         state.triggeredMap[`input${inputIndex}`] = false;
//       }
//       state.triggeredCount = 0;
//       state.outputTriggered = false;
//     };

//     if (read('reset')) {
//       reset();
//       return state;
//     }

//     for (
//       let inputIndex = 1;
//       inputIndex <= read<number>('numInputs');
//       inputIndex++
//     ) {
//       let inputName = `input${inputIndex}`;
//       if (state.triggeredMap[inputName]) {
//         continue;
//       }
//       state.triggeredMap[inputName] = true;
//       state.triggeredCount++;

//       if (
//         state.triggeredCount === read<number>('numInputs') &&
//         !state.outputTriggered
//       ) {
//         commit('flow');
//         state.outputTriggered = true;

//         if (read('autoReset')) {
//           reset();
//           return state;
//         }
//       }
//     }

//     return state;
//   },
//   dispose: () => {
//     return initialState;
//   }
// });

// this is equivalent to Promise.all()
export class WaitAll extends FlowNode {
  public static Description = new NodeDescription2({
    typeName: 'flow/waitAll',
    category: 'Flow',
    label: 'WaitAll',
    configuration: {
      numInputs: {
        valueType: 'number',
        defaultValue: 3
      }
    },
    factory: (description, graph, config, id) =>
      new WaitAll(description, graph, config.numInputs, config, id)
  });

  private isOn = true;
  private numInputs: number;

  constructor(
    description: NodeDescription,
    graph: IGraph,
    numInputs: number,
    config: Record<string, unknown>,
    id: string
  ) {
    const inputs: Socket[] = [];
    for (let i = 1; i <= numInputs; i++) {
      inputs.push(new Socket('flow', `${i}`));
    }

    super(
      description,
      graph,
      [
        ...inputs,
        new Socket('flow', 'reset'),
        new Socket('boolean', 'autoReset')
      ],
      [new Socket('flow', 'flow')],
      config,
      id
    );
    this.numInputs = numInputs;
    this.reset();
  }

  private triggeredMap: { [key: string]: boolean } = {};
  private triggeredCount = 0;
  private outputTriggered = false;

  private reset() {
    for (let inputIndex = 1; inputIndex <= this.numInputs; inputIndex++) {
      this.triggeredMap[`${inputIndex}`] = false;
    }
    this.triggeredCount = 0;
    this.outputTriggered = false;
  }

  override triggered(fiber: Fiber, triggeringSocketName: string) {
    if (triggeringSocketName === 'reset') {
      this.reset();
      return;
    }

    if (this.triggeredMap[triggeringSocketName]) {
      return;
    }

    this.triggeredMap[triggeringSocketName] = true;
    this.triggeredCount++;

    // if a & b are triggered, first output!
    if (this.triggeredCount === this.numInputs && !this.outputTriggered) {
      fiber.commit(this, 'flow');
      this.outputTriggered = true;

      // auto-reset if required.
      if (this.readInput('autoReset') === true) {
        this.reset();
      }
    }
  }
}
