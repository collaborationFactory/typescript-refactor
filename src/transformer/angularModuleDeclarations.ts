import * as ts from 'typescript';
import {getFirstCallExpression, isAngularModuleCreationExpression} from './angularjsUtils';
import {INgDeclarations} from '../model';
import {MetaData} from '../metaData';


export function angularDeclarationsTransformer(context: ts.TransformationContext) {

    let sf: ts.SourceFile;

    return function transform(sourceFile: ts.SourceFile) {
        sf = sourceFile;
        return ts.visitNode(sourceFile, visitSourceFile);
    };

    function visitSourceFile(node: ts.SourceFile): ts.VisitResult<ts.Node> {
        let statements: ts.NodeArray<ts.Statement> = ts.visitLexicalEnvironment(node.statements, sourceElementVisitor, context, 0, false);
        return ts.updateSourceFileNode(node, statements);
    }

    function sourceElementVisitor(node: ts.Node): ts.VisitResult<ts.Node> {
        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
            case ts.SyntaxKind.ExpressionStatement:
                return addAngularDeclarations(sf, node);
        }
        return node;
    }
}

/**
 * Adds all tracked angular registrations to the given `node` iff `node` is a known
 * angular module registration.
 *
 * @param sourceFile
 * @param node
 */
export function addAngularDeclarations(sourceFile: ts.SourceFile, node: ts.Node): ts.Node {
    if (node.kind === ts.SyntaxKind.VariableStatement) {
        let variableStatementNode = <ts.VariableStatement>node;
        let variableDeclaration = variableStatementNode.declarationList.declarations[0];
        let initializer = variableDeclaration.initializer;
        // variable is only declared not initialized
        if (!initializer) {
            return node;
        }

        // Check if the initializer is the initialization of an angular module
        if (initializer.kind === ts.SyntaxKind.CallExpression) {
            const initializerExpressionStatement = ts.createExpressionStatement(initializer);
            const initializerCallExpression = initializerExpressionStatement.expression as ts.CallExpression;
            // if ('angular.module' === getFirstCallExpressionIdentifier(initializerCallExpression)) {
            if (isAngularModuleCreationExpression(initializerCallExpression)) {
                return ts.createExpressionStatement(
                    createAngularDeclarationNode(sourceFile, <ts.CallExpression>initializer)
                );
            }
        }
    } else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
        const expression = (node as ts.ExpressionStatement).expression;
        if (expression.kind === ts.SyntaxKind.CallExpression) {
            // const callExpressionStatement = ts.createExpressionStatement(expression);
            // const callExpression = callExpressionStatement.expression as ts.CallExpression;
            // if ('angular.module' === getFirstCallExpressionIdentifier(callExpression)) {
            if (isAngularModuleCreationExpression(expression)) {
                return ts.createExpressionStatement(
                    createAngularDeclarationNode(sourceFile, expression as ts.CallExpression)
                );
            }
        }
    }
    return node;
}

export function createAngularDeclarationNode(sourceFile: ts.SourceFile, node: ts.CallExpression): ts.Expression {
    let firstCallExpression = getFirstCallExpression(node);
    let angularDeclarationNode: ts.Expression;
    let angularModuleProp = ts.createPropertyAccess(
        ts.createIdentifier('angular'),
        'module'
    );
    angularDeclarationNode = ts.createCall(
        angularModuleProp,
        undefined,
        firstCallExpression.arguments
    );

    let declarationsForModule;
    const modId = firstCallExpression.arguments[0].getText();
    if (firstCallExpression.arguments[0].kind === ts.SyntaxKind.Identifier) {
        const ngModule = MetaData.get().getNgModuleForFileNameAndVarIdentifier(sourceFile.fileName, modId);
        declarationsForModule = MetaData.get().getDeclarationsForModule(ngModule);
    } else {
        declarationsForModule = MetaData.get().getDeclarationsForModule(modId);
    }

    // sort so that controllers are before directives
    const declarations: INgDeclarations = Object.keys(declarationsForModule).sort().reduce((acc, currentValue) => {
        acc[currentValue] = declarationsForModule[currentValue];
        return acc;
    }, {});

    for (let type in declarations) {
        if (declarations.hasOwnProperty(type)) {
            declarations[type].forEach((d, i) => {
                angularDeclarationNode = ts.createCall(
                    ts.createPropertyAccess(angularDeclarationNode, ts.createIdentifier(type)),
                    undefined,
                    [ts.createIdentifier(d.name), ts.createIdentifier(d.func)]
                );
            });

        }
    }
    return angularDeclarationNode;
}
