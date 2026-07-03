import type { FC } from 'react';
import type { TabData } from 'rc-dock';
import {
  ContributionKind,
  type ContributionSpec
} from '@kiberon-labs/behave-graph';
import type { System } from '@/system/system';
import type { ControlProps } from '@/store/controls';
import type { Specific } from '@/store/specific';
import type { SocketGenerator } from '@/store/socketGenerator';
import type { ConversionRule } from '@/store/conversions';
import type { Command } from '@/store/commands';
import type { ContextMenuItem } from '@/store/contextMenu';
import type { ValueTypeMetadata } from '@/types/NodeMetadata';

/**
 * Registers a single resolved contribution into the right editor store. `value`
 * is whatever the host's resolver loaded for the contribution's `export` (its
 * concrete shape depends on the kind).
 */
export type ContributionApplier = (
  system: System,
  contribution: ContributionSpec,
  value: unknown
) => void;

/** Dispatch table mapping each {@link ContributionKind} to its store action. */
export const contributionAppliers: Record<string, ContributionApplier> = {
  [ContributionKind.Control]: (system, c, value) => {
    const name = c.bind?.controlName ?? c.bind?.valueType;
    if (!name) {
      throw new Error(
        `control contribution '${c.id}' needs bind.controlName (or bind.valueType)`
      );
    }
    system.controlStore
      .getState()
      .registerControl(name, value as FC<ControlProps>);
  },

  [ContributionKind.Specific]: (system, _c, value) => {
    system.specificStore.getState().registerSpecific(value as Specific);
  },

  [ContributionKind.Panel]: (system, c, value) => {
    // A panel resolves to a tab loader `() => TabData`, registered under the
    // contribution id (the tab id the host opens).
    system.tabLoader.register(c.id, value as () => TabData);
  },

  [ContributionKind.SocketGenerator]: (system, _c, value) => {
    system.socketGeneratorStore
      .getState()
      .registerGenerator(value as SocketGenerator);
  },

  [ContributionKind.Conversion]: (system, _c, value) => {
    system.conversionStore
      .getState()
      .registerConversion(value as ConversionRule);
  },

  [ContributionKind.Command]: (system, _c, value) => {
    system.commandStore.getState().register(value as Command);
  },

  [ContributionKind.ContextMenu]: (system, _c, value) => {
    system.contextMenuStore.getState().register(value as ContextMenuItem);
  },

  [ContributionKind.ValueType]: (system, c, value) => {
    // Replaces the pass-through value type with the real, function-bearing one.
    const vt = value as ValueTypeMetadata;
    const name = c.bind?.valueType ?? vt.name;
    system.registry.getState().updateValues({ [name]: { ...vt, name } });
  }
};

/** Apply a resolved contribution, warning (not throwing) on an unknown kind. */
export function applyContribution(
  system: System,
  contribution: ContributionSpec,
  value: unknown
): void {
  const applier = contributionAppliers[contribution.kind];
  if (!applier) {
    console.warn(
      `[manifest] no applier for contribution kind '${contribution.kind}' (${contribution.id})`
    );
    return;
  }
  applier(system, contribution, value);
}
