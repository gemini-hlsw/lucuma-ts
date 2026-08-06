/* eslint-disable  */
import type { GraphQLResolveInfo } from 'graphql';
import { parseResolveInfo, type ResolveTree } from 'graphql-parse-resolve-info';

import type {
  AltairGuideLoopSelect,
  AltairInstrumentSelect,
  CalParamsSelect,
  ConfigurationSelect,
  EngineeringTargetSelect,
  GemsGuideLoopSelect,
  GemsInstrumentSelect,
  GuideAlarmSelect,
  GuideLoopSelect,
  InstrumentSelect,
  MechanismSelect,
  NonsiderealTargetSelect,
  RotatorSelect,
  SiderealTargetSelect,
  SlewFlagsSelect,
  TargetSelect,
} from '../../prisma/gen/models.ts';

// Mapping of all Prisma models to their corresponding select types. This is used to ensure type safety when constructing select objects from GraphQLResolveInfo.
type ModelSelectMap = {
  Configuration: ConfigurationSelect;
  EngineeringTarget: EngineeringTargetSelect;
  Target: TargetSelect;
  SiderealTarget: SiderealTargetSelect;
  NonsiderealTarget: NonsiderealTargetSelect;
  Instrument: InstrumentSelect;
  Rotator: RotatorSelect;
  SlewFlags: SlewFlagsSelect;
  Mechanism: MechanismSelect;
  AltairInstrument: AltairInstrumentSelect;
  GemsInstrument: GemsInstrumentSelect;
  GuideLoop: GuideLoopSelect;
  AltairGuideLoop: AltairGuideLoopSelect;
  GemsGuideLoop: GemsGuideLoopSelect;
  GuideAlarm: GuideAlarmSelect;
  CalParams: CalParamsSelect;
};

type SelectQuery = { select: Record<string, SelectFields> };

type SelectFields = boolean | SelectQuery;

/**
 * Create a Prisma select object from given GraphQLResolveInfo to only query requested fields.
 *
 * Works recursively, as long as the GraphQL model resembles the Prisma model.
 */
export function resolveSelectFields<T extends keyof ModelSelectMap>(
  info: GraphQLResolveInfo,
): T extends keyof ModelSelectMap ? { select: ModelSelectMap[T] } : { select: undefined } {
  const variableValues = info.variableValues;
  const patchedInfo = (
    'coerced' in variableValues ? info : { ...info, variableValues: { coerced: variableValues, sources: {} } }
  ) satisfies GraphQLResolveInfo;
  const parsedInfo = parseResolveInfo(patchedInfo);

  const extractAllFields = (tree: ResolveTree) => {
    const result: SelectQuery = { select: {} };
    for (const typename in tree.fieldsByTypeName) {
      const fieldsOfType = tree.fieldsByTypeName[typename];
      for (const key in fieldsOfType) {
        if (key.startsWith('__')) continue; // Skip the __typename field
        const fieldInfo = fieldsOfType[key];
        if (fieldInfo && Object.keys(fieldInfo?.fieldsByTypeName ?? {}).length) {
          result.select![key] = extractAllFields(fieldInfo);
        } else {
          result.select![key] = true;
        }
      }
    }
    return result;
  };

  if (parsedInfo && 'fieldsByTypeName' in parsedInfo && Object.keys(parsedInfo.fieldsByTypeName).length) {
    return extractAllFields(parsedInfo as ResolveTree) as T extends keyof ModelSelectMap
      ? { select: ModelSelectMap[T] }
      : { select: undefined };
  }
  return { select: undefined } as T extends keyof ModelSelectMap
    ? { select: ModelSelectMap[T] }
    : { select: undefined };
}
