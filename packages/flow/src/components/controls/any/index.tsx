import type { ControlProps } from '@/store/controls';
import { JsonEditor } from 'json-edit-react';

export const AnyControl = (props: ControlProps) => {
  return (
    <JsonEditor data={props.value} setData={(data) => props.onChange(data)} />
  );
};
