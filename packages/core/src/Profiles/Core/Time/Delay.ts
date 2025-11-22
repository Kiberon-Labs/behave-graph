import { makeAsyncNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '~/Nodes/Registry/NodeCategory.js';

// New format
export const Delay = makeAsyncNodeDefinition({
  typeName: 'time/delay',
  otherTypeNames: ['flow/delay'],
  category: NodeCategory.Time,
  label: 'Delay',
  in: {
    flow: {
      valueType: 'flow'
    },
    duration: {
      valueType: 'float',
      defaultValue: 1
    }
  },
  out: {
    flow: 'flow'
  },
  initialState: {
    timeoutPending: false
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  triggered: async ({ state, finished = () => {}, commit, read }) => {
    // if there is a valid timeout running, leave it.
    if (state.timeoutPending) {
      return {
        timeoutPending: true
      };
    }

    state.timeoutPending = true;

    setTimeout(
      async () => {
        // check if cancelled
        if (!state.timeoutPending) return;

        state.timeoutPending = false;
        commit('flow');
        finished();
      },
      read<number>('duration') * 1000
    );

    return {
      timeoutPending: true
    };
  },
  dispose: () => {
    return {
      timeoutPending: false
    };
  }
});

// Old format
// export class Delay extends AsyncNode {
//   public static Description = new NodeDescription2({
//     typeName: 'time/delay',
//     otherTypeNames: ['flow/delay'],
//     category: 'Time',
//     label: 'Delay',
//     factory: (description, graph, config, id) =>
//       new Delay(description, graph, config, id)
//   });

//   constructor(
//     description: NodeDescription,
//     graph: IGraph,
//     config: Record<string, unknown>,
//     id: string
//   ) {
//     super(
//       description,
//       graph,
//       [new Socket('flow', 'flow'), new Socket('float', 'duration', 1)],
//       [new Socket('flow', 'flow')],
//       config,
//       id
//     );
//   }

//   private timeoutPending = false;

//   triggered(
//     engine: Engine,
//     triggeringSocketName: string,
//     finished: () => void
//   ) {
//     // if there is a valid timeout running, leave it.
//     if (this.timeoutPending) {
//       return;
//     }

//     // otherwise start it.
//     this.timeoutPending = true;
//     setTimeout(() => {
//       // check if cancelled
//       if (!this.timeoutPending) return;
//       this.timeoutPending = false;
//       console.log('delay finished!!!!!!!!!');
//       engine.commitToNewFiber(this, 'flow');
//       finished();
//     }, this.readInput<number>('duration') * 1000);
//   }

//   dispose() {
//     this.timeoutPending = false;
//   }
// }
