import * as ts from 'typescript';


/**
 *
 * In typescript module declaration of the form
 *      module cf.cplace.paltform.search { // module code}
 * is converted to
 *   module cf {
 *      module cplace {
 *          module platform {
 *              module search {
 *                  // module code
 *              }
 *          }
 *      }
 *   }
 *
 * @param moduleDeclaration
 * @returns {ts.ModuleDeclaration}
 */
export function getInnerMostModuleDeclarationFromDottedModule(moduleDeclaration: ts.ModuleDeclaration): ts.ModuleDeclaration {
    if (moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
        const recursiveInnerModule = getInnerMostModuleDeclarationFromDottedModule(<ts.ModuleDeclaration>moduleDeclaration.body);
        return recursiveInnerModule || <ts.ModuleDeclaration>moduleDeclaration.body;
    }
}

/**
 * determines the first identifier for a method call
 *
 * the call can be of the form
 * 1. someMethod(...args) => someMethod
 * 2. prop.method1().prop2.method2().method3() => prop
 * 3. any combination of properties and methods but last part should be method call
 *
 * @param expr
 * @returns {string}
 */
export function getFirstCallExpressionIdentifier(expr: ts.Node): string {
    // reached end of chain
    if(expr.kind === ts.SyntaxKind.Identifier) {
        return (<ts.Identifier>expr).text;
    }
    return  getFirstCallExpressionIdentifier((<ts.CallExpression>expr).expression);
}