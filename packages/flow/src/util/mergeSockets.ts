import type {
  InputSocketSpecJSON,
  OutputSocketSpecJSON
} from '@kiberon-labs/behave-graph';
import type { SocketBase } from '../types.js';

type SpecSocket = InputSocketSpecJSON | OutputSocketSpecJSON;

function toSocketBase(socket: SpecSocket): SocketBase {
  return { ...socket, key: socket.name };
}

/**
 * Merges spec sockets with dynamic port overrides.
 * Spec sockets use 'name' as identifier, dynamic ports use 'key'.
 * Dynamic ports can override spec sockets when their key matches the spec socket's name.
 */
export function mergeSockets(
  specSockets: SpecSocket[],
  dynamicPorts?: SocketBase[]
): SocketBase[] {
  const socketsMap = new Map(specSockets.map((s) => [s.name, toSocketBase(s)]));

  if (dynamicPorts) {
    dynamicPorts.forEach((s) => socketsMap.set(s.key, s));
  }

  return Array.from(socketsMap.values());
}
