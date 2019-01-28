import * as ts from 'typescript';
import {IAngularDeclaration} from '../model';
import {MetaData} from '../metaData';

/**
 * parses angular declarations of the form
 *      angular.module().controller().service().directive()
 *
 * @param node
 * @param tsModuleName
 */
export function getAngularDeclaration(node: ts.Node, tsModuleName: string): IAngularDeclaration {
    return (function recurseChained(expr: ts.Node): IAngularDeclaration {
        if (expr.kind === ts.SyntaxKind.Identifier) {
            return {} as IAngularDeclaration;
        }

        let dec = recurseChained((<ts.CallExpression>expr).expression);
        if (expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let propertyAccessExpression = <ts.PropertyAccessExpression>(expr);
            let identifier = propertyAccessExpression.name as ts.Identifier;
            let parent = expr.parent as ts.CallExpression;
            if (identifier.text === 'module') {
                let moduleId = parent.arguments[0];
                let moduleName = moduleId.getText();
                if (moduleId.kind === ts.SyntaxKind.Identifier) {
                    let ngModuleForVarIdentifier = MetaData.get().getNgModuleForVarIdentifier(moduleId.getText(), tsModuleName);
                    moduleName = ngModuleForVarIdentifier ? ngModuleForVarIdentifier : moduleId.getText();
                }
                dec.ngModule = moduleName;
                dec.declarations = {};
            } else if (MetaData.get().getNgModuleForIdentifier(propertyAccessExpression.expression.getText(), tsModuleName)) {
                dec.ngModule = MetaData.get().getNgModuleForIdentifier(propertyAccessExpression.expression.getText(), tsModuleName);
                dec.declarations = {};
                dec.declarations[identifier.text] = [];

                let decInfo = parent.arguments;
                dec.declarations[identifier.text].push({
                    name: decInfo[0].getText(),
                    func: decInfo[1].getText()
                });
            } else {
                let decInfo = parent.arguments;
                if (decInfo.length === 2) {
                    dec.declarations = dec.declarations || {};
                    dec.declarations[identifier.text] = [];
                    dec.declarations[identifier.text].push({
                        name: decInfo[0].getText(),
                        func: decInfo[1].getText()
                    });
                }
            }
        }
        return dec;
    })(node);
}

/**
 * Checks if a given `CallExpression` is either directly rooted by an `angular.module(...)`
 * call or sources from a variable that is known to contain an Angular module.
 *
 * `angular.module().directive(...)` -> directly rooted
 *
 * ```
 * let MODULE = angular.module('my.angular.module', []);
 * MODULE.directive(...):
 * ```
 * Here `MODULE` is known to be assigned an Angular module.
 *
 * @param expr
 * @returns {boolean}
 */
export function isAngularModuleBasedCallExpression(expr: ts.Expression): boolean {
    if (expr.kind !== ts.SyntaxKind.CallExpression) {
        return false;
    }
    const call = expr as ts.CallExpression;
    if (call.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const propertyAccess = call.expression as ts.PropertyAccessExpression;
        if (isAngularModulePropertyAccessExpression(propertyAccess, undefined, true)) {
            return true;
        } else {
            return isAngularModuleBasedCallExpression(propertyAccess.expression);
        }
    } else {
        return false;
    }
}

export function isAngularModuleCreationExpression(expr: ts.Expression): boolean {
    if (expr.kind === ts.SyntaxKind.CallExpression) {
        const call = expr as ts.CallExpression;
        if (isAngularModulePropertyAccessExpression(call.expression, 'module')
            && call.arguments.length === 2) {
            return true;
        } else {
            return isAngularModuleCreationExpression(call.expression);
        }
    } else if (expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
        const property = expr as ts.PropertyAccessExpression;
        const expression = property.expression;
        if (expression.kind === ts.SyntaxKind.CallExpression) {
            return isAngularModuleCreationExpression(expression);
        } else {
            return false;
        }
    } else {
        return false;
    }
}

export function isAngularModulePropertyAccessExpression(expr: ts.Expression,
                                                        limitToFunction: string = undefined,
                                                        checkForKnownModuleVariable = false): boolean {
    if (expr.kind !== ts.SyntaxKind.PropertyAccessExpression) {
        return false;
    }

    const property = expr as ts.PropertyAccessExpression;
    const propertyExpression = property.expression;
    if (!!limitToFunction && property.name.text !== limitToFunction) {
        return false;
    }
    if (propertyExpression.kind !== ts.SyntaxKind.Identifier) {
        return false;
    }

    if ((propertyExpression as ts.Identifier).text === 'angular') {
        return true;
    } else {
        return checkForKnownModuleVariable
            && !!MetaData.get().getNgModuleForIdentifier((propertyExpression as ts.Identifier).text);
    }
}

/**
 * returns first call expression from chain of call expressions
 * eg. angular.module().controller().directive().... => angular.module()
 */
export function getFirstCallExpression(node: ts.CallExpression) {
    let more = true;
    let firstCallExpression: ts.CallExpression = node;
    while (more) {
        if (firstCallExpression.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let pae = <ts.PropertyAccessExpression>firstCallExpression.expression;
            if (pae.expression.kind === ts.SyntaxKind.CallExpression) {
                firstCallExpression = <ts.CallExpression>pae.expression;
            } else {
                more = false;
            }
        } else {
            more = false;
        }
    }
    return firstCallExpression;
}
