import * as ts from 'typescript';
import * as helper from './helper';
import {log} from "util";

export interface AngularDeclaration {
    module: string;
    types: {
        [type: string]: Array<string>;
    }
}
/**
 * angular expression should always start with
 * angular.module
 *
 * @param node
 * @returns {boolean}
 */
export function isAngularExpression(node: ts.ExpressionStatement): boolean {
    if (node.expression.kind === ts.SyntaxKind.CallExpression) {
        let identifier = helper.getFirstCallExpressionIdentifier(node.expression);
        return identifier === 'angular';
    }

    return false;
}
/**
 * parses angular declarations of the form
 *      angular.module().controller().service().directive()
 *
 * @param node
 */
export function getAngularDeclaration(node: ts.CallExpression): AngularDeclaration {
    return (function recurseChained(expr: ts.Node) {
        if(expr.kind === ts.SyntaxKind.Identifier) {
            return {} as AngularDeclaration;
        }

        let ng = recurseChained((<ts.CallExpression>expr).expression);
        if(expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let identifier = (<ts.PropertyAccessExpression>expr).name as ts.Identifier;
            let parent = expr.parent as ts.CallExpression;
            if(identifier.text === 'module') {
                ng.module = parent.arguments[0].getText();
                ng.types = {};
            } else {
                ng.types[identifier.text] = [];
                for(let i = 0; i < parent.arguments.length; i++) {
                    if(identifier.text === 'module') {
                        ng.module = identifier.text;
                    } else {
                        ng.types[identifier.text].push((parent.arguments[i]).getText());
                    }
                }
            }
        }
        return ng;
    })(node);
}