import { lazy, Suspense } from 'react';
import type { ControlProps } from '@/store/controls';

// `json-edit-react` is a sizeable dependency and this is the *default* control
// (used whenever a socket has no specific control), so eager-importing it puts
// it on the editor's first-paint critical path. Load it lazily instead: the
// node still renders immediately, and the JSON editor swaps in once its chunk
// arrives.
const LazyAnyControl = lazy(() =>
  import('./AnyControlImpl').then((m) => ({ default: m.AnyControlImpl }))
);

export const AnyControl = (props: ControlProps) => {
  return (
    <Suspense fallback={null}>
      <LazyAnyControl {...props} />
    </Suspense>
  );
};
