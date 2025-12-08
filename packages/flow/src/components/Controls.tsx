import type { GraphJSON, NodeSpecJSON } from '@kinforge/behave-graph';
import {
  faPause,
  faPlay,
  faQuestion,
  faUpload
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import React from 'react';
import { ControlButton, Controls } from 'reactflow';

import { ClearModal } from './modals/ClearModal.js';
import { type Examples, LoadModal } from './modals/LoadModal.js';
import { SaveModal } from './modals/SaveModal.js';
import { Download, Trash } from 'iconoir-react';

export type CustomControlsProps = {
  playing: boolean;
  togglePlay: () => void;
  setBehaviorGraph: (value: GraphJSON) => void;
  examples: Examples;
  specJson: NodeSpecJSON[] | undefined;
};

export const CustomControls: React.FC<CustomControlsProps> = ({
  playing,
  togglePlay,
  setBehaviorGraph,
  examples,
  specJson
}: {
  playing: boolean;
  togglePlay: () => void;
  setBehaviorGraph: (value: GraphJSON) => void;
  examples: Examples;
  specJson: NodeSpecJSON[] | undefined;
}) => {
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  return (
    <>
      <Controls>
        <ControlButton title="Load" onClick={() => setLoadModalOpen(true)}>
          <FontAwesomeIcon icon={faUpload} />
        </ControlButton>
        <ControlButton title="Save" onClick={() => setSaveModalOpen(true)}>
          <Download />
        </ControlButton>
        <ControlButton title="Clear" onClick={() => setClearModalOpen(true)}>
          <Trash />
        </ControlButton>
        <ControlButton title="Run" onClick={togglePlay}>
          <FontAwesomeIcon icon={playing ? faPause : faPlay} />
        </ControlButton>
      </Controls>
      <LoadModal
        open={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        setBehaviorGraph={setBehaviorGraph}
        examples={examples}
      />
      {specJson && (
        <SaveModal
          open={saveModalOpen}
          specJson={specJson}
          onClose={() => setSaveModalOpen(false)}
        />
      )}

      <ClearModal
        open={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
      />
    </>
  );
};

export default CustomControls;
