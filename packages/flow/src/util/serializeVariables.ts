/**
 * Serialize variables to JSON using pure metadata
 * This replaces the need for WriteVariablesToJSON from @kiberon-labs/behave-graph
 */

import type { INodeRegistry } from '../types/NodeMetadata';

export interface VariableJSON {
  id: string;
  name: string;
  valueTypeName: string;
  initialValue: any;
  label?: string;
  metadata?: Record<string, any>;
}

export interface Variable {
  id: string;
  name: string;
  valueTypeName: string;
  initialValue: any;
  label?: string;
  metadata?: Record<string, any>;
}

/**
 * Serialize a single variable to JSON
 */
export function serializeVariable(
  variable: Variable,
  registry: INodeRegistry
): VariableJSON {
  const valueType = registry.values[variable.valueTypeName];
  const serializedValue = valueType?.serialize
    ? valueType.serialize(variable.initialValue)
    : variable.initialValue;

  const variableJson: VariableJSON = {
    id: variable.id,
    name: variable.name,
    valueTypeName: variable.valueTypeName,
    initialValue: serializedValue
  };

  if (variable.label && variable.label.length > 0) {
    variableJson.label = variable.label;
  }

  if (variable.metadata && Object.keys(variable.metadata).length > 0) {
    variableJson.metadata = variable.metadata;
  }

  return variableJson;
}

/**
 * Serialize multiple variables to JSON array
 */
export function writeVariablesToJSON(
  registry: INodeRegistry,
  variables: Record<string, Variable>
): VariableJSON[] {
  return Object.values(variables).map((variable) =>
    serializeVariable(variable, registry)
  );
}
