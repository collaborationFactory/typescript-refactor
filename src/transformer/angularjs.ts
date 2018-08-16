import * as ts from 'typescript';
import {AngularDeclaration, moduleIdentifier} from '../model';
import {metaData} from '../metaData';

/**
 * angular expression should always start with
 * angular.module
 *
 * @param node
 * @returns {boolean}
 */
export function isAngularExpressionButNotModuleDeclaration(node: ts.ExpressionStatement): boolean {
    if (node.expression.kind === ts.SyntaxKind.CallExpression) {
        let identifier = getFirstCallExpressionIdentifier(<ts.CallExpression>(node.expression));
        return identifier === 'angular';
    }

    return false;
}

/**
 * parses angular declarations of the form
 *      angular.module().controller().service().directive()
 *
 * @param node
 * @param moduleIdentifier
 */
export function getAngularDeclaration(node: ts.Node, moduleIdentifier: string): AngularDeclaration {
    return (function recurseChained(expr: ts.Node): AngularDeclaration {
        if (expr.kind === ts.SyntaxKind.Identifier) {
            return {} as AngularDeclaration;
        }

        let ng = recurseChained((<ts.CallExpression>expr).expression);
        if (expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let propertyAccessExpression = <ts.PropertyAccessExpression>(expr);
            let identifier = propertyAccessExpression.name as ts.Identifier;
            let parent = expr.parent as ts.CallExpression;
            if (identifier.text === 'module') {
                ng.module = parent.arguments[0].getText();
                ng.declarations = {};
            } else if (metaData.getNgModuleForIdentifier(propertyAccessExpression.expression.getText())) {
                ng.module = metaData.getNgModuleForIdentifier(propertyAccessExpression.expression.getText());
                ng.declarations = {};
                ng.declarations[identifier.text] = [];

                let decInfo = parent.arguments;
                ng.declarations[identifier.text].push({
                    name: decInfo[0].getText(),
                    function: decInfo[1].getText()
                });
            } else {
                let decInfo = parent.arguments;
                if (decInfo.length === 2) {
                    ng.declarations[identifier.text] = [];
                    ng.declarations[identifier.text].push({
                        name: decInfo[0].getText(),
                        function: decInfo[1].getText()
                    });
                }
            }
        }
        return ng;
    })(node);
}

/**
 * determines the first identifier of a function call
 *
 * the call can be of the form
 * 1. someMethod(...args) => someMethod
 * 2. prop.method1().prop2.method2().method3() => prop
 * 3. any combination of properties and methods but last part should be method call
 *
 * @param expr
 * @returns {string}
 */
export function getFirstCallExpressionIdentifier(expr: ts.CallExpression): string {
    if (expr.expression.kind === ts.SyntaxKind.PropertyAccessExpression && expr.arguments.length === 2) {
        let propertyAccessExpression = <ts.PropertyAccessExpression>(expr.expression);
        if (propertyAccessExpression.expression.kind === ts.SyntaxKind.Identifier
            && propertyAccessExpression.name.kind === ts.SyntaxKind.Identifier) {
            let expressionIdentifier = <ts.Identifier>(propertyAccessExpression.expression);
            let nameIdentifier = <ts.Identifier>(propertyAccessExpression.name);
            if (expressionIdentifier.text === 'angular' && nameIdentifier.text === 'module') {
                return 'angular.module';
            }
            if (expressionIdentifier.text === moduleIdentifier.name) {
                return 'angular';
            }
        } else {
            return getFirstCallExpressionIdentifier(<ts.CallExpression>(propertyAccessExpression.expression));
        }
    }
    return getCallExpressionIdentifier(expr);
}

function getCallExpressionIdentifier(expr: ts.Node): string {
    if (expr.kind === ts.SyntaxKind.Identifier) {
        return (<ts.Identifier>expr).text;
    }
    return getCallExpressionIdentifier((<ts.CallExpression>expr).expression);
}
