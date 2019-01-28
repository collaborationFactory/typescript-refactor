import * as ts from 'typescript';
import {
    isAngularModuleBasedCallExpression,
    isAngularModuleCreationExpression,
    isAngularModulePropertyAccessExpression
} from "./angularjsUtils";
import {MetaData} from '../metaData';

describe('angularjsUtils', () => {
    const TEST_SOURCE = `
        const notAssigned: boolean;
        const variable: string = 'This is a variable';
        angular.module(MODULE_NAME).directive('blub', blubFn);
        angular.module(MODULE_NAME, []);
        blubDirective.test;
        moduleAssignment.directive('call', callMe);
        someMethodCall('argument1', 'argument2');
        angular.module('testModule')
            .directive('blub', blubFn);
        angular.module('testModule', [])
            .directive('blub', blubFn);
    `;

    let sourceFile: ts.SourceFile;
    beforeEach(() => {
        sourceFile = ts.createSourceFile(
            'testSource.ts',
            TEST_SOURCE,
            ts.ScriptTarget.ES5
        );

        expect(sourceFile.statements
            .map(s => s.kind)
        ).toEqual([
            ts.SyntaxKind.VariableStatement,
            ts.SyntaxKind.VariableStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement
        ]);
    });

    test('check default isAngularModuleCallExpression', () => {
        expect(
            // angular.module(MODULE_NAME).directive('blub', blubFn)
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[2]))
        ).toBeTruthy();
        expect(
            // angular.module(MODULE_NAME, [])
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[3]))
        ).toBeTruthy();
        expect(
            // blubDirective.test
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[4]))
        ).toBeFalsy();

        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[5]))
        ).toBeFalsy(); // as long as we don't say moduleAssignment is an Angular module
        const spy = createGetNgModuleForIdentifierSpy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[5]))
        ).toBeTruthy();
        spy.mockRestore();

        expect(
            // someMethodCall('argument1', 'argument2')
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[6]))
        ).toBeFalsy();

        expect(
            // angular.module('testModule')
            //             .directive('blub', blubFn);
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[7]))
        ).toBeTruthy();
        expect(
            // angular.module('testModule', [])
            //             .directive('blub', blubFn);
            isAngularModuleBasedCallExpression(getExpressionFromStatement(sourceFile.statements[8]))
        ).toBeTruthy();
    });

    test('check isAngularModulePropertyAccessExpression', () => {
        expect(
            // angular.module(MODULE_NAME).directive('blub', blubFn)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[2]).expression)
        ).toBeFalsy();
        expect(
            // angular.module(MODULE_NAME, [])
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[3]).expression)
        ).toBeTruthy();
        expect(
            // blubDirective.test
            isAngularModulePropertyAccessExpression(getExpressionFromStatement(sourceFile.statements[4]))
        ).toBeFalsy();

        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]).expression)
        ).toBeFalsy();
        const spy = createGetNgModuleForIdentifierSpy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]).expression)
        ).toBeFalsy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]).expression, undefined, true)
        ).toBeTruthy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]).expression, 'controller', true)
        ).toBeFalsy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]).expression, 'directive', true)
        ).toBeTruthy();
        spy.mockRestore();

        expect(
            // someMethodCall('argument1', 'argument2')
            isAngularModulePropertyAccessExpression(getExpressionFromStatement(sourceFile.statements[5]))
        ).toBeFalsy();
        expect(
            // angular.module('testModule')
            //             .directive('blub', blubFn);
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[7]).expression)
        ).toBeFalsy();
        expect(
            // angular.module('testModule', [])
            //             .directive('blub', blubFn);
            isAngularModulePropertyAccessExpression(getCallOrPropertyAccessExpression(sourceFile.statements[8]).expression)
        ).toBeFalsy();
    });

    test('check isAngularModuleCreationExpression', () => {
        expect(
            // angular.module(MODULE_NAME).directive('blub', blubFn)
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[2]))
        ).toBeFalsy();

        expect(
            // angular.module(MODULE_NAME, [])
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[3]))
        ).toBeTruthy();

        expect(
            // blubDirective.test
            isAngularModuleCreationExpression(getExpressionFromStatement(sourceFile.statements[4]))
        ).toBeFalsy();

        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]))
        ).toBeFalsy();
        const spy = createGetNgModuleForIdentifierSpy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[5]))
        ).toBeFalsy();
        spy.mockRestore();

        expect(
            // angular.module('testModule')
            //             .directive('blub', blubFn);
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[7]))
        ).toBeFalsy();

        expect(
            // angular.module('testModule', [])
            //             .directive('blub', blubFn);
            isAngularModuleCreationExpression(getCallOrPropertyAccessExpression(sourceFile.statements[8]))
        ).toBeTruthy();
    });

    function createGetNgModuleForIdentifierSpy() {
        return jest.spyOn(MetaData.get(), "getNgModuleForIdentifier")
            .mockImplementation((expr) => {
                return expr === 'moduleAssignment' ? 'testModule' : null;
            });
    }

    function getCallOrPropertyAccessExpression(statement: ts.Statement): ts.CallExpression | ts.PropertyAccessExpression {
        expect(statement.kind).toBe(ts.SyntaxKind.ExpressionStatement);
        const expr = (statement as ts.ExpressionStatement).expression;
        if (expr.kind === ts.SyntaxKind.CallExpression) {
            return expr as ts.CallExpression;
        } else if (expr.kind === ts.SyntaxKind.PropertyAccessExpression) {
            return expr as ts.PropertyAccessExpression;
        }
        fail('Expected either a Call or PropertyAccessExpression - got: ' + expr.kind);
    }

    function getExpressionFromStatement(statement: ts.Statement): ts.Expression {
        expect(statement.kind).toBe(ts.SyntaxKind.ExpressionStatement);
        return (statement as ts.ExpressionStatement).expression;
    }
});
