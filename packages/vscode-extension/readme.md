# Kinforge Behave Graphs for VScode

This is a proof of concept exploration of embedding the graph engine inside of VS Code for faster iteration of behave graph

## Features

- Provides a custom editor for the new file extension type `.klbgraph` which is a Kinforge specific format for the serialized behave graph.

- Custom icons for the `.klbgraph` format

- Provides a command to quick create new Graph files

## Requirements

No special requirements needed

## Extension Settings

No settings are currently exposed.

## Known Issues

Due to how serialization occurs for array buffers and typed arrays, you must use engine 1.57.0 and above of vscode to prevent huge data transfer inefficiencies

## Release Notes

Please see the changelog included in the project for more information
