# behave-graph

The behave-graph editor context: visual graph authoring, the hosts it runs in, and the extensibility model that lets plugins contribute behaviour, state, and node types.

## Language

**Editor**:
The interactive graph-authoring environment as a whole, host-agnostic (web app, VS Code webview).
_Avoid_: IDE, studio

**System**:
The editor-level kernel object that owns graph sessions and the plugin container; one per host.
_Avoid_: core, engine, app

**Graph session**:
One open graph's editing state and lifecycle, created and disposed as a unit (a tab).
_Avoid_: tab, document, workspace

**Plugin**:
The single unit of extensibility: declares its dependencies, contributes state and behaviour, and owns a real lifecycle (load → ready → dispose). One concept spans the editor kernel, the webview, and node-registry contributions.
_Avoid_: extension, module, addon

**Service**:
A named capability exposed through the container — by a plugin, or provisioned by the kernel at boot — consumed via a declared dependency rather than attached onto the kernel by hand.
_Avoid_: helper, manager, singleton

**Profile**:
A coherent layer of node-type specs contributed to the node registry, delivered by a plugin or declared in loader config.
_Avoid_: preset, template, flavor

**Patch**:
A small delta layer applied on top of a profile — targeted spec changes without forking the whole profile.
_Avoid_: override, hotfix

**Node registry**:
The collection of node-type specs the editor can place into graphs.
_Avoid_: palette, toolbox

**Manifest**:
The static JSON a node package ships — its node types, value types, and contributions — loadable into the node registry, with code contributions trust-gated.
_Avoid_: descriptor, package definition
