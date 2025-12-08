import type { NodeSpecJSON } from '@kinforge/behave-graph';
import { useEffect, useState } from 'react';
import type { NodeTypes } from 'reactflow';

import { Node } from '../components/nodes/behave/Node.js';
import { CommentNode } from '@/components/nodes/comment/comment.js';
import type { AnyNodeType } from '@/types.js';

const getCustomNodeTypes = (
  allSpecs: NodeSpecJSON[]
): Record<string, React.ComponentType<any>> => {
  //Conver the nodespecs to a dictionary
  const specDict: { [key: string]: NodeSpecJSON } = {};
  allSpecs.forEach((spec) => {
    specDict[spec.type] = spec;
  });

  return {
    behaveNode: (props) => (
      <Node spec={specDict[props.data.type]} allSpecs={allSpecs} {...props} />
    )
  };
};

export const useCustomNodeTypes = ({
  specJson
}: {
  specJson: NodeSpecJSON[] | undefined;
}) => {
  const [customNodeTypes, setCustomNodeTypes] = useState<NodeTypes>();
  useEffect(() => {
    if (!specJson) return;
    const customNodeTypes: Record<
      AnyNodeType,
      React.ComponentType<any>
    > = getCustomNodeTypes(specJson);

    customNodeTypes['commentNode'] = CommentNode;

    setCustomNodeTypes(customNodeTypes);
  }, [specJson]);

  return customNodeTypes;
};
