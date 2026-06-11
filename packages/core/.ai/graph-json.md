# Graph JSON Structure

## Complete Graph Structure

```json
{
  "v": 1,
  "name": "My Graph",
  "metadata": {},
  "variables": [...],
  "customEvents": [...],
  "nodes": [...]
}
```

## Node Definition

```json
{
  "type": "math/add",
  "id": "node-1",
  "label": "My Add Node",
  "configuration": {},
  "metadata": {},
  "parameters": {
    "a": { "value": 5 },
    "b": { "link": { "nodeId": "node-0", "socket": "result" } }
  },
  "flows": {
    "flow": { "nodeId": "node-2", "socket": "flow" }
  }
}
```

**Properties**:
- `type`: Node type name (must exist in registry)
- `id`: Unique identifier for this node instance
- `label`: Optional display name
- `configuration`: Node-specific configuration values
- `metadata`: Arbitrary metadata (UI positions, etc.)
- `parameters`: Data input values or connections
- `flows`: Flow output connections

## Parameters vs Flows

### Data Inputs (parameters)

For non-flow sockets, use `parameters`:

```json
"parameters": {
  "inputName": { "value": 42 },
  "anotherInput": { 
    "link": { "nodeId": "upstream-node", "socket": "result" } 
  }
}
```

**Two forms**:
- `{ "value": X }` - Literal value
- `{ "link": { "nodeId": "...", "socket": "..." } }` - Connection to upstream output

### Flow Outputs (flows)

For flow sockets, use `flows`:

```json
"flows": {
  "true": { "nodeId": "node-2", "socket": "flow" },
  "false": { "nodeId": "node-3", "socket": "flow" }
}
```

Each flow output specifies the downstream node and socket.

**Important**: Flow *inputs* are never in JSON - they're inferred from upstream `flows`.

## Variables

```json
"variables": [
  {
    "id": "var-1",
    "name": "counter",
    "valueTypeName": "integer",
    "initialValue": 0,
    "label": "Frame Counter",
    "metadata": {}
  }
]
```

**Properties**:
- `id`: Unique identifier
- `name`: Variable name (used in get/set nodes)
- `valueTypeName`: Type (must exist in registry)
- `initialValue`: Starting value
- `label`: Optional display name
- `metadata`: Arbitrary metadata

## Custom Events

```json
"customEvents": [
  {
    "id": "evt-1",
    "name": "onButtonClick",
    "label": "Button Clicked",
    "metadata": {},
    "parameters": [
      {
        "name": "x",
        "valueTypeName": "float",
        "defaultValue": 0
      },
      {
        "name": "y",
        "valueTypeName": "float",
        "defaultValue": 0
      }
    ]
  }
]
```

**Properties**:
- `id`: Unique identifier
- `name`: Event name (used in trigger/listen nodes)
- `label`: Optional display name
- `parameters`: Event payload definition

## Examples

### Simple Linear Flow

```json
{
  "nodes": [
    {
      "type": "lifecycle/onStart",
      "id": "0"
    },
    {
      "type": "debug/log",
      "id": "1",
      "parameters": {
        "text": { "value": "Hello World!" }
      },
      "flows": {
        "flow": { "nodeId": "0", "socket": "flow" }
      }
    }
  ]
}
```

### Branch with Data Flow

```json
{
  "nodes": [
    {
      "type": "lifecycle/onStart",
      "id": "0"
    },
    {
      "type": "flow/branch",
      "id": "1",
      "parameters": {
        "condition": { "value": true }
      },
      "flows": {
        "flow": { "nodeId": "0", "socket": "flow" }
      }
    },
    {
      "type": "debug/log",
      "id": "2",
      "parameters": {
        "text": { "value": "True path" }
      },
      "flows": {
        "flow": { "nodeId": "1", "socket": "true" }
      }
    }
  ]
}
```

### Data Connection

```json
{
  "nodes": [
    {
      "type": "math/float",
      "id": "0",
      "parameters": {
        "value": { "value": 5 }
      }
    },
    {
      "type": "math/add",
      "id": "1",
      "parameters": {
        "a": { "link": { "nodeId": "0", "socket": "value" } },
        "b": { "value": 3 }
      }
    }
  ]
}
```

## Serialization Functions

**Write graph to JSON**:
```typescript
import { writeGraphToJSON } from '@kiberon-labs/behave-graph';

const json = writeGraphToJSON(graphInstance, registry);
```

**Read graph from JSON**:
```typescript
import { readGraphFromJSON } from '@kiberon-labs/behave-graph';

const graphInstance = readGraphFromJSON({ graphJson, registry });
```
