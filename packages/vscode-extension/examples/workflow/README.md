# Workflow example

An n8n-style automation that runs headlessly on the engine — the way a server or
cron host runs a saved workflow:

```
onStart → httpRequest → branch(statusOk?) → setResult(result | error)
```

## Run it

Open [`workflow.kbgraph`](workflow.kbgraph) and press **Run**. The log panel
shows the stored result, e.g.:

```
[result] result = {"ok":true,"url":"https://api.example.com/data"}
```

## What it demonstrates

- **Custom nodes mixed with built-ins.** `workflow/httpRequest` (async),
  `workflow/statusOk` (function) and `workflow/setResult` (flow) sit alongside
  the core `flow/branch`.
- **Typed host capabilities.** The HTTP client and the result sink are declared
  as `defineCapability` keys, provided in the registry's dependency bag, and
  read back type-safely by key — not via stringly-typed `getDependency('http')`.

## Notes

The HTTP client in [`registry.ts`](registry.ts) is a deterministic mock so the
example runs offline. Swap its `get` for one backed by the global `fetch` to
call a real endpoint.
