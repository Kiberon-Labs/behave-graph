# Behave-Graph

[![GitHub license](https://img.shields.io/npm/l/behave-graph)](https://github.com/kiberon-labs/behave-graph/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/@kiberon-labs/behave-graph)](https://www.npmjs.com/package/@kiberon-labs/behave-graph)

Behave-Graph is a standalone library that implements the concept of "behavior graphs" as a portable TypeScript library with no required external run-time dependencies. Behavior graphs are expressive, deterministic, and extensible state machines that can encode arbitrarily complex behavior.

Behavior graphs are used extensively in game development as a visual scripting language. For example, look at Unreal Engine Blueprints or Unity's Visual Scripting or NVIDIA Omniverse's OmniGraph behavior graphs.

This library is intended to follow industry best practices in terms of behavior graphs. It is also designed to be compatible with these existing implementations in terms of capabilities. Although, like all node-based systems, behavior graphs are always limited by their node implementations.

Another neat fact about behavior graphs is that they offer a sand boxed execution model. Because one can only execute what is defined by nodes exposed by the host system, you can restrict what can be executed by these graphs. This type of sand-boxing is not possible when you just load and execute arbitrary scripts.

## Documentation

See the dedicated documentation site [here](https://kiberon-labs.github.io/behave-graph/)

## Licence 

ISC. See [here](./LICENSE)