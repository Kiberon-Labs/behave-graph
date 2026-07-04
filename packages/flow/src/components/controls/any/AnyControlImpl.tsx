import type { ControlProps } from '@/store/controls';
import { JsonEditor } from 'json-edit-react';

/**
 * The actual `any`-typed value editor. Split into its own module so the heavy
 * `json-edit-react` dependency (~50 kB) is loaded lazily by [`AnyControl`](./index.tsx)
 * only when an `any` control is first rendered, instead of sitting in the
 * editor's first-paint bundle.
 */
export const AnyControlImpl = (props: ControlProps) => {
  return (
    <JsonEditor data={props.value} setData={(data) => props.onChange(data)} />
  );
};
