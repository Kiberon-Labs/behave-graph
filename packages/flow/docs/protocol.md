
# Behave-Graph Execution Protocol (WebSocket)

**Version:** 1.0.0

This protocol defines a WebSocket-based interface for decoupled execution of behavior graphs. It supports local or remote execution, tracing, session management, and server-sent events for real-time updates. All requests and responses involving graph execution must include the relevant graph IDs, as graphs may call other graphs.

## Overview
- **Transport:** WebSocket (JSON messages)
- **Client:** Graph editor or automation
- **Server:** Graph execution backend (local or remote)
- **Feature Discovery:** Clients query server capabilities
- **Event-Driven:** Server emits events for graph lifecycle, tracing, errors, etc.
- **Reconnection:** Sessions persist across WebSocket reconnections
- **Message Ordering:** Events are delivered in execution order per runId

---

## 1. Connection & Protocol Negotiation

### Initial Handshake

**CRITICAL:** The `hello` message **MUST** be the first message sent by the client after WebSocket connection is established. The server **MUST** reject any other message type sent before `hello` with an error.

### Protocol Version & Authentication
- **Client → Server (FIRST MESSAGE ONLY):**
	```json
	{
		"type": "hello",
		"protocolVersion": "1.0.0",
		"auth": {
			"type": "bearer",
			"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
		}
	}
	```

**Authentication Types:**
- `bearer` — Bearer token (JWT or API key)
- `apiKey` — Simple API key
- `none` — No authentication (development only)

**Example with API Key:**
```json
{
	"type": "hello",
	"protocolVersion": "1.0.0",
	"auth": {
		"type": "apiKey",
		"key": "your-api-key-here"
	}
}
```

**Example without authentication:**
```json
{
	"type": "hello",
	"protocolVersion": "1.0.0",
	"auth": {
		"type": "none"
	}
}
```

- **Server → Client (Success):**
	```json
	{
		"type": "welcome",
		"protocolVersion": "1.0.0",
		"serverId": "backend-1",
		"authenticated": true,
		"userId": "user-123"
	}
	```

**Error Responses:**

If versions are incompatible:
```json
{
	"type": "error",
	"code": "PROTOCOL_VERSION_MISMATCH",
	"message": "Unsupported version",
	"supportedVersions": ["1.0.0"]
}
```

If authentication fails:
```json
{
	"type": "error",
	"code": "AUTHENTICATION_FAILED",
	"message": "Invalid or expired token"
}
```

If hello is not the first message:
```json
{
	"type": "error",
	"code": "PROTOCOL_VIOLATION",
	"message": "Hello message must be sent first"
}
```

---

## 2. Session Management

### Create Session
- **Client → Server:**
	```json
	{ "type": "createSession", "metadata": { "clientId": "editor-1", "user": "dev" } }
	```
- **Server → Client:**
	```json
	{ "type": "sessionCreated", "sessionId": "sess-xyz", "expiresAt": 1234567890 }
	```

### Resume Session (after reconnection)
- **Client → Server:**
	```json
	{ "type": "resumeSession", "sessionId": "sess-xyz" }
	```
- **Server → Client:**
	```json
	{ "type": "sessionResumed", "sessionId": "sess-xyz", "activeRuns": ["abc123", "def456"] }
	```

### Close Session
- **Client → Server:**
	```json
	{ "type": "closeSession", "sessionId": "sess-xyz" }
	```
- **Server → Client:**
	```json
	{ "type": "sessionClosed", "sessionId": "sess-xyz" }
	```

### Heartbeat (every 30s recommended)
- **Client → Server:**
	```json
	{ "type": "ping", "timestamp": 1234567890 }
	```
- **Server → Client:**
	```json
	{ "type": "pong", "timestamp": 1234567890 }
	```

All subsequent requests must include the `sessionId`.

---

## 3. Capabilities

### Capabilities Request
- **Client → Server:**
	```json
	{ "type": "getCapabilities" }
	```
- **Server → Client:**
	```json
	{
		"type": "capabilities",
		"capabilities": {
			"trace": true,
			"validation": true,
			"graphRegistry": true,
			"eventFiltering": true,
			"batchOperations": true,
			"runHistory": true,
			"runtimeMetadata": true,
			"maxConcurrentRuns": 100
		}
	}
	```

---

## 4. Runtime Metadata (Optional)

These endpoints provide the editor with information about server-side runtime state and constraints.

### Query Server Variables
```json
{ "type": "getServerVariables", "sessionId": "sess-xyz" }
```
- **Response:**
	```json
	{
		"type": "serverVariables",
		"variables": [
			{
				"name": "playerHealth",
				"type": "number",
				"currentValue": 100,
				"readonly": false,
				"description": "Current player health points"
			},
			{
				"name": "gameMode",
				"type": "string",
				"currentValue": "survival",
				"readonly": true,
				"description": "Current game mode"
			}
		]
	}
	```

### Query Server Events
```json
{ "type": "getServerEvents", "sessionId": "sess-xyz" }
```
- **Response:**
	```json
	{
		"type": "serverEvents",
		"events": [
			{
				"name": "onPlayerDeath",
				"description": "Triggered when a player dies",
				"payloadSchema": {
					"playerId": "string",
					"cause": "string",
					"position": "vector3"
				}
			},
			{
				"name": "onLevelComplete",
				"description": "Triggered when a level is completed",
				"payloadSchema": {
					"levelId": "number",
					"score": "number",
					"timeElapsed": "number"
				}
			}
		]
	}
	```

### Query Socket Constraints
Get metadata about specific node sockets, including allowed values/types.

```json
{
	"type": "getSocketConstraints",
	"sessionId": "sess-xyz",
	"nodeType": "math/operation",
	"socketName": "operation"
}
```
- **Response:**
	```json
	{
		"type": "socketConstraints",
		"nodeType": "math/operation",
		"socketName": "operation",
		"valueType": "string",
		"constraints": {
			"type": "enum",
			"choices": [
				{ "value": "add", "label": "Add (+)" },
				{ "value": "subtract", "label": "Subtract (-)" },
				{ "value": "multiply", "label": "Multiply (×)" },
				{ "value": "divide", "label": "Divide (÷)" }
			]
		}
	}
	```

### Query All Node Types
Get metadata about all available node types and their sockets.

```json
{ "type": "getNodeTypes", "sessionId": "sess-xyz" }
```
- **Response:**
	```json
	{
		"type": "nodeTypes",
		"nodes": [
			{
				"type": "math/operation",
				"category": "math",
				"label": "Math Operation",
				"description": "Perform mathematical operations",
				"inputs": [
					{ "name": "a", "valueType": "number", "required": true },
					{ "name": "b", "valueType": "number", "required": true },
					{ "name": "operation", "valueType": "string", "hasConstraints": true }
				],
				"outputs": [
					{ "name": "result", "valueType": "number" }
				]
			}
		]
	}
	```

---

## 5. Graph Registry (Optional)

### Register Graph
```json
{
	"type": "registerGraph",
	"sessionId": "sess-xyz",
	"graphId": "my-graph-1",
	"graph": { /* graph definition */ }
}
```
- **Response:**
	```json
	{ "type": "graphRegistered", "graphId": "my-graph-1" }
	```

### List Registered Graphs
```json
{ "type": "listGraphs", "sessionId": "sess-xyz" }
```
- **Response:**
	```json
	{ "type": "graphList", "graphs": [{ "graphId": "my-graph-1", "registeredAt": 1234567890 }] }
	```

---

## 6. Graph Validation

### Validate Graph
```json
{
	"type": "validateGraph",
	"sessionId": "sess-xyz",
	"graphId": "my-graph-1",
	"graph": { /* graph definition */ }
}
```
- **Response:**
	```json
	{
		"type": "validationResult",
		"graphId": "my-graph-1",
		"valid": false,
		"errors": [
			{ "nodeId": "node5", "message": "Missing required input", "severity": "error" }
		],
		"warnings": [
			{ "nodeId": "node10", "message": "Unused output", "severity": "warning" }
		]
	}
	```

---

## 7. Commands (Client → Server)


### Run Graph
```json
{
	"type": "runGraph",
	"sessionId": "sess-xyz",
	"graphId": "main-graph-1",
	"graph": { /* graph definition or omit if registered */ },
	"inputs": { /* optional input values */ },
	"options": {
		"trace": true,
		"eventFilter": { "variables": ["score", "health"], "events": ["onDeath"] },
		"maxExecutionTimeMs": 30000,
		// Whether the graph should complete with no more pending fibres
		"autoEnd":true
	}
}
```
- **Response:**
	```json
	{ "type": "runStarted", "runId": "abc123", "graphId": "main-graph-1", "startedAt": 1234567890 }
	```


### Stop Graph
```json
{ "type": "stopGraph", "sessionId": "sess-xyz", "runId": "abc123" }
```
- **Response:**
	```json
	{ "type": "stopped", "runId": "abc123", "graphId": "main-graph-1", "reason": "user_requested" }
	```



### Query Status
```json
{ "type": "getStatus", "sessionId": "sess-xyz", "runId": "abc123" }
```
- **Response:**
	```json
	{
		"type": "status",
		"runId": "abc123",
		"graphId": "main-graph-1",
		"status": "running",
		"startedAt": 1234567890,
		"elapsedMs": 1532,
		"currentNodeId": "node42",
		"startedGraphs": [
			{ "runId": "child-1", "graphId": "sub-graph-1", "status": "completed" },
			{ "runId": "child-2", "graphId": "sub-graph-2", "status": "running" }
		],
		"performance": {
			"nodesExecuted": 42,
			"eventsEmitted": 15,
			"variableChanges": 8
		}
	}
	```

### Batch Status Query
```json
{ "type": "batchGetStatus", "sessionId": "sess-xyz", "runIds": ["abc123", "def456"] }
```
- **Response:**
	```json
	{
		"type": "batchStatus",
		"statuses": [
			{ "runId": "abc123", "status": "running", "elapsedMs": 1532 },
			{ "runId": "def456", "status": "completed", "elapsedMs": 890 }
		]
	}
	```

### Subscribe to Events
```json
{
	"type": "subscribe",
	"sessionId": "sess-xyz",
	"runId": "abc123",
	"filter": {
		"eventTypes": ["variableChanged", "eventEmitted"],
		"variableNames": ["score"],
		"eventNames": ["onDeath"]
	}
}
```

### Unsubscribe from Events
```json
{ "type": "unsubscribe", "sessionId": "sess-xyz", "runId": "abc123" }
```

---

## 8. Run History

### Query Run History
```json
{
	"type": "getRunHistory",
	"sessionId": "sess-xyz",
	"limit": 10,
	"graphId": "main-graph-1"
}
```
- **Response:**
	```json
	{
		"type": "runHistory",
		"runs": [
			{
				"runId": "abc123",
				"graphId": "main-graph-1",
				"status": "completed",
				"startedAt": 1234567890,
				"completedAt": 1234567900,
				"elapsedMs": 10000,
				"result": { /* output values */ }
			}
		]
	}
	```

---

## 9. Server-Sent Events (Server → Client)

### Graph Lifecycle Events

#### Run Started
```json
{ "type": "runStarted", "runId": "abc123", "graphId": "main-graph-1", "startedAt": 1234567890 }
```

#### Completed
```json
{
	"type": "completed",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"completedAt": 1234567900,
	"elapsedMs": 10000,
	"result": { /* output values */ },
	"performance": {
		"nodesExecuted": 150,
		"eventsEmitted": 45,
		"variableChanges": 23
	}
}
```

#### Stopped
```json
{ "type": "stopped", "runId": "abc123", "graphId": "main-graph-1", "reason": "user_requested" }
```

#### Error
```json
{
	"type": "error",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"code": "NODE_EXECUTION_ERROR",
	"message": "Division by zero",
	"nodeId": "node42",
	"stack": "..."
}
```



### Tracing/Debug Events

#### Trace Event
```json
{
	"type": "trace",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"nodeId": "node42",
	"event": "activated",
	"data": { "inputs": { ... }, "outputs": { ... } }
}
```

#### Log Event
```json
{
	"type": "log",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"level": "info",
	"message": "Processing item 42",
	"data": { /* optional context */ }
}
```

### Variable Change Events
- `variableChanged` — Emitted when a variable's value changes during execution.
	- Includes: `runId`, `graphId`, `variableName`, `oldValue`, `newValue`, and optionally `nodeId` (if the change was triggered by a node).

#### Example Variable Change Event
```json
{
	"type": "variableChanged",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"variableName": "score",
	"oldValue": 10,
	"newValue": 11,
	"nodeId": "node99"
}
```

### Event Emission
- `eventEmitted` — Emitted when an event is triggered during graph execution.
  - Includes: `runId`, `graphId`, `eventName`, `payload`, and optionally `nodeId` (if the event was triggered by a specific node).

#### Example Event Emission
```json
{
  "type": "eventEmitted",
  "runId": "abc123",
  "graphId": "main-graph-1",
  "eventName": "onPlayerDeath",
  "payload": { "playerId": "player123", "cause": "fall" },
  "nodeId": "node55"
}
```

### Node Addition Events
- `nodeAdded` — Emitted when a node is added to a graph during execution.
  - Includes: `runId`, `graphId`, `nodeId`, `nodeType`, and optionally `nodeData` with the full node configuration.

#### Example Node Addition Event
```json
{
  "type": "nodeAdded",
  "runId": "abc123",
  "graphId": "main-graph-1",
  "nodeId": "node42",
  "nodeType": "math/add",
  "nodeData": {
    "id": "node42",
    "type": "math/add",
    "position": { "x": 100, "y": 200 },
    "configuration": {}
  }
}
```

---

## 10. Error Handling

### Error Codes
- `PROTOCOL_VERSION_MISMATCH` — Incompatible protocol versions
- `PROTOCOL_VIOLATION` — Protocol rules violated (e.g., hello not sent first)
- `AUTHENTICATION_FAILED` — Invalid or missing authentication credentials
- `AUTHENTICATION_REQUIRED` — Authentication is required but not provided
- `SESSION_NOT_FOUND` — Session does not exist or expired
- `SESSION_EXPIRED` — Session timed out
- `INVALID_GRAPH` — Graph definition is malformed
- `VALIDATION_FAILED` — Graph failed validation
- `RUN_NOT_FOUND` — Run ID does not exist
- `NODE_EXECUTION_ERROR` — Error during node execution
- `TIMEOUT` — Execution exceeded max time
- `CONCURRENT_LIMIT_EXCEEDED` — Too many concurrent runs
- `PERMISSION_DENIED` — Unauthorized operation

### Error Response Format
```json
{
	"type": "error",
	"code": "NODE_EXECUTION_ERROR",
	"message": "Division by zero in node42",
	"runId": "abc123",
	"graphId": "main-graph-1",
	"nodeId": "node42",
	"details": { /* additional context */ }
}
```

---

## 11. Extensibility & Best Practices

### Protocol Evolution
- New message types and capabilities can be added without breaking existing clients
- Clients must check `capabilities` before using optional features
- Unknown message types should be ignored (forward compatibility)
- Protocol version follows semantic versioning

### Performance Recommendations
- Use event filtering to reduce network traffic
- Batch status queries when checking multiple runs
- Register frequently-used graphs to avoid re-sending definitions
- Implement client-side caching of graph validation results
- Use heartbeat to detect connection issues early

### Security Considerations
- **Authentication is strongly recommended for production environments**
- Use bearer tokens (JWT) for secure, stateless authentication
- Tokens should have reasonable expiration times (e.g., 1 hour for access tokens)
- Implement token refresh mechanisms for long-lived sessions
- Sessions should have reasonable expiration times (default: 1 hour)
- Implement rate limiting on graph execution and authentication attempts
- Validate all graph definitions before execution
- Enforce that `hello` is always the first message (reject connections otherwise)
- Use TLS/WSS in production to encrypt WebSocket traffic
- Sanitize error messages to avoid information leakage

---
## 12. Typescript interface 

See the [../src/plugin/graphrunner/types.ts](Typescript interface)