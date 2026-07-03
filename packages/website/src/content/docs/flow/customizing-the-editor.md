---
title: Customizing the Editor
description: A map of every way you can extend and customize the Behave-Graph Flow editor.
---

Almost everything in the Flow editor is extensible through small **registries**.
This page is a map of those surfaces and where each is documented in depth.
Everything here is reached from the `System` (the editor) , see the
[Plugin System](./plugins) reference for the full APIs, and the
[Build your own plugin](../guides/build-a-plugin) tutorial for a worked example.

## Registry vs. plugins

Two completely separate mechanisms extend the editor, and they answer different
questions. Keeping them straight is the most important thing on this page:

| | **Registry** | **Plugins** |
| --- | --- | --- |
| Answers | *What nodes exist?* | *How does the editor behave?* |
| Adds | Nodes, value types, dependencies | Commands, panels, controls, icons, per-graph state, … |
| Layer | Core / runtime (the graph's vocabulary) | Editor / UI |
| Entry point | the registry you pass to `new System(registry)` | `system.registerPlugin(...)` |
| Built with | `registerCoreProfile` + profiles (core) | the `plugin()` helper + the registries below |

The **registry is the only way to add nodes**; a plugin cannot. Conversely, the
registry says nothing about the editor experience. They compose: you build a
registry of nodes, then layer plugins that make those nodes pleasant to work with
(icons, controls, generators, conversions, panels).

The rest of this page is about the **plugin** side. For the **registry** side,
see [Defining custom nodes](#defining-custom-nodes) below. In the
[VS Code extension](../vscode/using-the-extension) the two are pointed to
separately by a `.kbworkspace` manifest (a `registry` file and a `plugins` file).

## Two layers

Customization happens at two layers:

- the **editor** (`System`) , shared across all open graphs, and
- a **graph session** (`GraphSession`) , one per open graph tab, holding
  per-graph state.

Understanding which layer you're targeting is the key idea behind the
[Plugin System](./plugins#the-mental-model-editor-vs-graph).

## Extension surfaces

| Want to… | Use | Reference |
| --- | --- | --- |
| Add a named, dispatchable action | `system.commandStore` + `system.runCommand` | [Commands](./plugins#commands) |
| Add a right-click menu item | `system.contextMenuStore` | [Context menus](./plugins#context-menus) |
| Add a keyboard shortcut | `system.hotKeyStore` | [Keyboard shortcuts](./plugins#keyboard-shortcuts) |
| Add a toolbar button | `system.toolbarStore` | [Toolbar buttons](./plugins#toolbar-buttons) |
| Add a menu-bar item | `system.menubarStore` | [Menu-bar items](./plugins#menu-bar-items) |
| Add a dockable panel | `system.tabLoader` | [Dockable panels](./plugins#dockable-panels) |
| Edit a value type's input control | `system.controlStore` | [Input controls](./plugins#input-controls) |
| Set socket icons & colours | `system.legendStore` | [Socket icons & colours](./plugins#socket-icons--colours-legend) |
| Auto-convert between socket types | `system.registerConversion` | [Type Conversions](./type-conversions) |
| Build dynamic ports for a node | `system.socketGeneratorStore` | [Socket generators](./plugins#socket-generators) |
| Attach state to **every graph** | `system.registerSessionExtension` | [Per-graph state](./plugins#per-graph-state-session-extensions) |
| Attach an editor-wide service | `system.decorate` | [Editor-level services](./plugins#editor-level-services) |
| React to editor / graph events | `system.pubsub` / `session.pubsub` | [Events](./plugins#events-pubsub) |

## Defining custom nodes

Custom **nodes** are not an editor concern , they live in the graph **registry**
you pass to `new System(registry)`, defined with the core node/value-type
machinery and bundled into a profile. See
[Core Concepts → Nodes](../core-concepts/nodes),
[Profiles](../core-concepts/profiles) and
[Registry](../core-concepts/registry). The editor surfaces above then layer the
*experience* (icons, controls, generators, conversions) on top of those nodes.

## Built-in features that use these surfaces

These shipped features are themselves built on the surfaces above , useful as
references:

- [Subgraphs](./subgraphs) , boundary/call nodes via **socket generators** and a
  **session extension** that keeps callers in sync.
- [Type Conversions](./type-conversions) , the **conversion** registry.
- The [**graph runners**](./graph-runners) , three execution models over a
  shared client, each adding toolbar buttons, a hotkey, and a per-graph run
  controller via a session extension.
