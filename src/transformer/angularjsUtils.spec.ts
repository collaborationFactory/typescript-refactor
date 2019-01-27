import * as ts from 'typescript';
import {getFirstCallExpressionIdentifier, isAngularExpression} from "./angularjsUtils";
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
    `;

    let sourceFile: ts.SourceFile;
    beforeEach(() => {
        sourceFile = ts.createSourceFile(
            'testSource.ts',
            TEST_SOURCE,
            ts.ScriptTarget.ES5
        );

        expect(sourceFile.statements.length).toBe(7);
        expect(sourceFile.statements
            .map(s => s.kind)
        ).toEqual([
            ts.SyntaxKind.VariableStatement,
            ts.SyntaxKind.VariableStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement,
            ts.SyntaxKind.ExpressionStatement
        ]);
    });

    test('check default isAngularExpression', () => {
        expect(
            // angular.module(MODULE_NAME).directive('blub', blubFn)
            isAngularExpression(sourceFile.statements[2] as ts.ExpressionStatement)
        ).toBeTruthy();
        expect(
            // angular.module(MODULE_NAME, [])
            isAngularExpression(sourceFile.statements[3] as ts.ExpressionStatement)
        ).toBeFalsy();
        expect(
            // blubDirective.test
            isAngularExpression(sourceFile.statements[4] as ts.ExpressionStatement)
        ).toBeFalsy();

        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularExpression(sourceFile.statements[5] as ts.ExpressionStatement)
        ).toBeFalsy(); // as long as we don't say moduleAssignment is an Angular module
        const spy = createGetNgModuleForIdentifierSpy();
        expect(
            // moduleAssignment.directive('call', callMe)
            isAngularExpression(sourceFile.statements[5] as ts.ExpressionStatement)
        ).toBeTruthy();
        spy.mockRestore();

        expect(
            // someMethodCall('argument1', 'argument2')
            isAngularExpression(sourceFile.statements[6] as ts.ExpressionStatement)
        ).toBeFalsy();
    });

    test('check getFirstCallExpressionIdentifier', () => {
        expect(
            // angular.module(MODULE_NAME).directive('blub', blubFn)
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[2]))
        ).toBe('angular');
        expect(
            // angular.module(MODULE_NAME, [])
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[3]))
        ).toBe('angular');
        expect(
            // blubDirective.test
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[4]))
        ).toBe('blubDirective');

        expect(
            // moduleAssignment.directive('call', callMe)
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[5]))
        ).toBe('moduleAssignment');
        expect(
            // moduleAssignment.directive('call', callMe)
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[5]))
        ).toBe('moduleAssignment'); // as long as we don't say moduleAssignment is an Angular module
        const spy = createGetNgModuleForIdentifierSpy();
        expect(
            // moduleAssignment.directive('call', callMe)
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[5]))
        ).toBe('angular');
        spy.mockRestore();

        expect(
            // someMethodCall('argument1', 'argument2')
            getFirstCallExpressionIdentifier(getCallExpression(sourceFile.statements[5]))
        ).toBe('someMethodCall');
    });

    function createGetNgModuleForIdentifierSpy() {
        return jest.spyOn(MetaData.get(), "getNgModuleForIdentifier")
            .mockImplementation((expr) => {
                return expr === 'moduleAssignment' ? 'testModule' : null;
            });
    }

    function getCallExpression(statement: ts.Statement): ts.CallExpression {
        expect(statement.kind).toBe(ts.SyntaxKind.ExpressionStatement);
        const expr = (statement as ts.ExpressionStatement).expression;
        expect(expr.kind).toBe(ts.SyntaxKind.CallExpression);
        return expr as ts.CallExpression;
    }
});
