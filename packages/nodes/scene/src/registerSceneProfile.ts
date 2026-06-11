import {
  getCoreValuesMap,
  getNodeDescriptions,
  getStringConversionsForValueType,
  memo
} from '@kiberon-labs/behave-graph';
import type {
  IRegistry,
  NodeDefinition,
  ValueType,
  ValueTypeMap
} from '@kiberon-labs/behave-graph';

import { AddLight } from './Nodes/Actions/AddLight.js';
import { CloneMesh } from './Nodes/Actions/CloneMesh.js';
import { CreateMesh } from './Nodes/Actions/CreateMesh.js';
import { DeleteMesh } from './Nodes/Actions/DeleteMesh.js';
import { LookAt } from './Nodes/Actions/LookAt.js';
import { MoveTowards } from './Nodes/Actions/MoveTowards.js';
import { RemoveLight } from './Nodes/Actions/RemoveLight.js';
import { SetLightProperty } from './Nodes/Actions/SetLightProperty.js';
import { SetMaterialProperty } from './Nodes/Actions/SetMaterialProperty.js';
import { SetMeshPosition } from './Nodes/Actions/SetMeshPosition.js';
import { SetMeshVisible } from './Nodes/Actions/SetMeshVisible.js';
import { SetSceneProperty } from './Nodes/Actions/SetSceneProperty.js';
import { OnAnyMeshClicked } from './Nodes/Events/OnAnyMeshClicked.js';
import { OnSceneChanged } from './Nodes/Events/OnSceneChanged.js';
import { OnSceneNodeClick } from './Nodes/Events/OnSceneNodeClick.js';
import * as ColorNodes from './Nodes/Logic/ColorNodes.js';
import * as EulerNodes from './Nodes/Logic/EulerNodes.js';
import * as Mat3Nodes from './Nodes/Logic/Mat3Nodes.js';
import * as Mat4Nodes from './Nodes/Logic/Mat4Nodes.js';
import * as QuatNodes from './Nodes/Logic/QuatNodes.js';
import * as Vec2Nodes from './Nodes/Logic/Vec2Nodes.js';
import * as Vec3Nodes from './Nodes/Logic/Vec3Nodes.js';
import * as Vec4Nodes from './Nodes/Logic/Vec4Nodes.js';
import { GetDistanceBetween } from './Nodes/Queries/GetDistanceBetween.js';
import { GetLightProperty } from './Nodes/Queries/GetLightProperty.js';
import { GetMaterialProperty } from './Nodes/Queries/GetMaterialProperty.js';
import { GetMeshPosition } from './Nodes/Queries/GetMeshPosition.js';
import { GetSceneProperty } from './Nodes/Queries/GetSceneProperty.js';
import { ColorValue } from './Values/ColorValue.js';
import { EulerValue } from './Values/EulerValue.js';
import { Mat3Value } from './Values/Mat3Value.js';
import { Mat4Value } from './Values/Mat4Value.js';
import { QuatValue } from './Values/QuatValue.js';
import { Vec2Value } from './Values/Vec2Value.js';
import { Vec3Value } from './Values/Vec3Value.js';
import { Vec4Value } from './Values/Vec4Value.js';

export const getSceneValuesMap = memo<ValueTypeMap>(() => {
  const valueTypes = [
    Vec2Value,
    Vec3Value,
    Vec4Value,
    ColorValue,
    EulerValue,
    QuatValue,
    Mat3Value,
    Mat4Value
  ];
  const temp = Object.fromEntries(
    valueTypes.map((valueType) => [valueType.name, valueType])
  );
  return temp;
});

export const getSceneStringConversions = (
  values: Record<string, ValueType>
): NodeDefinition[] =>
  Object.keys(values).flatMap((valueTypeName) =>
    getStringConversionsForValueType({ values, valueTypeName })
  );

export const getSceneNodesMap = memo<Record<string, NodeDefinition>>(() => {
  const allValueTypeNames = Object.keys({
    ...getCoreValuesMap(),
    ...getSceneValuesMap()
  });

  const nodeDefinitions = [
    // pull in value type nodes
    ...getNodeDescriptions(Vec2Nodes),
    ...getNodeDescriptions(Vec3Nodes),
    ...getNodeDescriptions(Vec4Nodes),
    ...getNodeDescriptions(ColorNodes),
    ...getNodeDescriptions(EulerNodes),
    ...getNodeDescriptions(QuatNodes),
    ...getNodeDescriptions(Mat3Nodes),
    ...getNodeDescriptions(Mat4Nodes),

    // events
    OnSceneNodeClick,
    OnSceneChanged,
    OnAnyMeshClicked,
    // actions - property
    ...SetSceneProperty(allValueTypeNames),
    // actions - mesh lifecycle
    CreateMesh,
    DeleteMesh,
    CloneMesh,
    // actions - spatial
    MoveTowards,
    LookAt,
    SetMeshPosition,
    SetMeshVisible,
    // actions - lighting
    AddLight,
    RemoveLight,
    SetLightProperty,
    // actions - material
    SetMaterialProperty,
    // queries
    ...GetSceneProperty(allValueTypeNames),
    GetLightProperty,
    GetMaterialProperty,
    GetMeshPosition,
    GetDistanceBetween,

    ...getSceneStringConversions(getSceneValuesMap())
  ];

  return Object.fromEntries(
    nodeDefinitions.map((nodeDefinition) => [
      nodeDefinition.typeName,
      nodeDefinition
    ])
  );
});

export const registerSceneProfile = (registry: IRegistry): IRegistry => {
  const values = {
    ...registry.values,
    ...getCoreValuesMap(),
    ...getSceneValuesMap()
  };
  return {
    values,
    nodes: { ...registry.nodes, ...getSceneNodesMap() },
    dependencies: registry.dependencies
  };
};
