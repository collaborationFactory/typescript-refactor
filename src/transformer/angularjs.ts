import * as ts from 'typescript';

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
        let identifier = getFirstCallExpressionIdentifier(<ts.CallExpression>(node.expression));
        console.log(identifier);
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
export function getAngularDeclaration(node: ts.Node): AngularDeclaration {
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
function getFirstCallExpressionIdentifier(expr: ts.CallExpression): string {
    if (expr.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        let propertyAccessExpression = <ts.PropertyAccessExpression>(expr.expression);
        if (propertyAccessExpression.expression.kind === ts.SyntaxKind.Identifier) {
            return "module";
        } else {
            return getCallExpressionIdentier(expr);
        }
    }
}

function getCallExpressionIdentier(expr: ts.Node): string {
    if(expr.kind === ts.SyntaxKind.Identifier) {
        return (<ts.Identifier>expr).text;
    }
    return getCallExpressionIdentier((<ts.CallExpression>expr).expression);
}
