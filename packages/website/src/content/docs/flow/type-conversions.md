---
title: Type Conversions
description: Auto-convert between compatible socket types by splicing in a converter node, with customizable rules.
---

When you connect an output socket to an input socket of a **different but
convertible** value type, the editor can automatically splice a **converter
node** between them so the connection is valid. This is *auto-convert*.

For example, dragging an `integer` output into a `string` input inserts a
`math/toString/integer` node, wired source → converter → target.

## Enabling auto-convert

Auto-convert is controlled by the **Auto-convert types** toggle in **System
Settings**. When it's on, a convertible mismatch inserts the converter
automatically; when off, the connection is simply rejected as a type mismatch.

## How a converter is chosen

For a given `from` → `to` type pair the editor resolves a converter in this
order:

1. **A custom rule**, if one is registered for that exact pair (see below).
2. Otherwise, a **spec scan**: it looks for a node with exactly one value input
   of the `from` type and one value output of the `to` type, and no flow sockets
   , i.e. a pure value function like `math/toString/integer`.

If neither yields a converter, the connection is left as a mismatch.

## Custom conversion rules

You can define your own conversions , for type pairs the spec scan can't resolve,
or to override the default choice. A rule pins both the converter node **and the
specific ports** to use:

```typescript
system.registerConversion({
  from: 'integer',
  to: 'string',
  nodeType: 'math/toString/integer',
  inputKey: 'a',      // which input receives the `from` value
  outputKey: 'result' // which output produces the `to` value
});
```

`inputKey` / `outputKey` matter when the converter node has **more than one**
input or output , they tell the editor exactly which port handles the conversion.
When omitted, the editor matches a port by type (the input whose type is `from`,
the output whose type is `to`).

Rules registered this way take precedence over the built-in spec scan, so a
plugin or profile can supply richer conversions than the generic heuristic.

## Editing rules in the UI

Custom rules can also be managed without code, under **System Settings →
Type Conversions**:

1. Choose the **from** and **to** value types.
2. Choose the **converter node**.
3. Choose the **input port** and **output port**. The choices are filtered to
   ports whose type actually matches `from`/`to`, and default to the first
   compatible socket , so single-port converters are one click, and multi-port
   nodes resolve unambiguously. If the chosen node has no compatible port for the
   pair, the editor tells you it isn't a valid converter.

Rules created here are persisted with your editor settings.

## See also

- [Plugin System → Automatic type conversions](./plugins#automatic-type-conversions)
  for the `registerConversion` API in a plugin.
- [Customizing the Editor](./customizing-the-editor) for the full set of
  extension surfaces.
