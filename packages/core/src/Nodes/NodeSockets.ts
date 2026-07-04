import { Socket } from '../Sockets/Socket.js';

// plain for-loops instead of Array.find: these run once per socket read/write
// on the engine hot path, and the predicate closure allocation adds up.
export const readInputFromSockets = <T>(
  inputs: Socket[],
  inputName: string,
  nodeTypeName: string
) => {
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i]!.name === inputName) {
      return inputs[i]!.value as T;
    }
  }
  throw new Error(
    `can not find input socket with name ${inputName} on node of type ${nodeTypeName}`
  );
};

export const writeOutputsToSocket = <T>(
  outputs: Socket[],
  outputName: string,
  value: T,
  nodeTypeName: string
) => {
  for (let i = 0; i < outputs.length; i++) {
    const outputSocket = outputs[i]!;
    if (outputSocket.name === outputName) {
      outputSocket.value = value;
      return;
    }
  }
  throw new Error(
    `can not find output socket with name ${outputName} on node of type ${nodeTypeName}`
  );
};
