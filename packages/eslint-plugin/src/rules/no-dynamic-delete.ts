import type { TSESLint, TSESTree } from '@typescript-eslint/utils';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import * as tsutils from 'ts-api-utils';

import { createRule } from '../util';

export default createRule({
  name: 'no-dynamic-delete',
  meta: {
    docs: {
      description:
        'Disallow using the `delete` operator on computed key expressions',
      recommended: 'strict',
    },
    fixable: 'code',
    messages: {
      dynamicDelete: 'Do not delete dynamically computed property keys.',
    },
    schema: [],
    type: 'suggestion',
  },
  defaultOptions: [],
  create(context) {
    function createFixer(
      member: TSESTree.MemberExpression,
    ): TSESLint.ReportFixFunction | undefined {
      if (
        member.property.type === AST_NODE_TYPES.Literal &&
        typeof member.property.value === 'string'
      ) {
        return createPropertyReplacement(
          member.property,
          `.${member.property.value}`,
        );
      }

      return undefined;
    }

    return {
      'UnaryExpression[operator=delete]'(node: TSESTree.UnaryExpression): void {
        if (
          node.argument.type !== AST_NODE_TYPES.MemberExpression ||
          !node.argument.computed ||
          isNecessaryDynamicAccess(
            diveIntoWrapperExpressions(node.argument.property),
          )
        ) {
          return;
        }

        context.report({
          fix: createFixer(node.argument),
          messageId: 'dynamicDelete',
          node: node.argument.property,
        });
      },
    };

    function createPropertyReplacement(
      property: TSESTree.Expression,
      replacement: string,
    ) {
      return (fixer: TSESLint.RuleFixer): TSESLint.RuleFix =>
        fixer.replaceTextRange(getTokenRange(property), replacement);
    }

    function getTokenRange(property: TSESTree.Expression): [number, number] {
      return [
        context.sourceCode.getTokenBefore(property)!.range[0],
        context.sourceCode.getTokenAfter(property)!.range[1],
      ];
    }
  },
});

function diveIntoWrapperExpressions(
  node: TSESTree.Expression,
): TSESTree.Expression {
  if (node.type === AST_NODE_TYPES.UnaryExpression) {
    return diveIntoWrapperExpressions(node.argument);
  }

  return node;
}

function isNecessaryDynamicAccess(property: TSESTree.Expression): boolean {
  if (property.type !== AST_NODE_TYPES.Literal) {
    return false;
  }

  if (typeof property.value === 'number') {
    return true;
  }

  return (
    typeof property.value === 'string' &&
    !tsutils.isValidPropertyAccess(property.value)
  );
}
