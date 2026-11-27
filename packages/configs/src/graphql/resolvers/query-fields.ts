import {
  getDirectiveValues,
  GraphQLIncludeDirective,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  Kind,
  type SelectionNode,
  type SelectionSetNode,
} from 'graphql';

type Select = Record<string, true | { select: Select }>;

/**
 * Create a Prisma select object from given GraphQLResolveInfo to only query requested fields.
 *
 * Works recursively, as long as the GraphQL model resembles the Prisma model:
 * - fields are keyed by schema name, not alias
 * - named and inline fragments are expanded, and `@skip`/`@include` are applied
 * - `__typename` is ignored, and a relation with only `__typename` selects all its scalars
 * - a field without a selection set (a scalar) gives `undefined`, which selects everything
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- `S` is inferred from the Prisma call that receives the select.
export function resolveSelectFields<S>(info: GraphQLResolveInfo): S {
  const select = collectSelect(info, selectionSetsOf(info.fieldNodes));

  return (Object.keys(select).length ? select : undefined) as S;
}

/**
 * Merge the selection sets of one field into a Prisma select.
 */
function collectSelect(info: GraphQLResolveInfo, selectionSets: readonly SelectionSetNode[]): Select {
  // Sub-selection sets by field name. Empty for scalar fields.
  const fields = new Map<string, SelectionSetNode[]>();

  const visit = (selectionSet: SelectionSetNode) => {
    for (const selection of selectionSet.selections) {
      if (!isIncluded(selection, info)) continue;

      switch (selection.kind) {
        case Kind.FIELD: {
          const name = selection.name.value;
          if (name.startsWith('__')) break;
          const subSelectionSets = fields.getOrInsert(name, []);
          if (selection.selectionSet) subSelectionSets.push(selection.selectionSet);
          break;
        }
        case Kind.INLINE_FRAGMENT:
          visit(selection.selectionSet);
          break;
        case Kind.FRAGMENT_SPREAD: {
          // Validation already rejects fragment cycles and unknown fragments.
          const fragment = info.fragments[selection.name.value];
          if (fragment) visit(fragment.selectionSet);
          break;
        }
      }
    }
  };
  selectionSets.forEach(visit);

  const select: Select = {};
  for (const [name, subSelectionSets] of fields) {
    const nested = collectSelect(info, subSelectionSets);
    select[name] = Object.keys(nested).length ? { select: nested } : true;
  }
  return select;
}

function selectionSetsOf(nodes: readonly { selectionSet?: SelectionSetNode | undefined }[]): SelectionSetNode[] {
  return nodes.flatMap((node) => (node.selectionSet ? [node.selectionSet] : []));
}

/**
 * Apply `@skip` and `@include` like the GraphQL executor.
 */
function isIncluded(node: SelectionNode, { variableValues }: GraphQLResolveInfo): boolean {
  if (getDirectiveValues(GraphQLSkipDirective, node, variableValues)?.if === true) return false;
  return getDirectiveValues(GraphQLIncludeDirective, node, variableValues)?.if !== false;
}
