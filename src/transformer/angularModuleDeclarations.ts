import * as ts from 'typescript';
import {getFirstCallExpression, getFirstCallExpressionIdentifier} from './angularjsUtils';
import {metaData} from '../metaData';
import {INgDeclarations} from '../model';


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
                return addAngularDeclarations(node);

        }
        return node;
    }


    function addAngularDeclarations(node: ts.Node): ts.Node {
        if (node.kind === ts.SyntaxKind.VariableStatement) {
            let variableStatementNode = <ts.VariableStatement>node;
            let variableDeclaration = variableStatementNode.declarationList.declarations[0];
            let initializer = variableDeclaration.initializer;
            // variable is only declared not initialized
            if (!initializer) {
                return node;
            }

            if (initializer.kind === ts.SyntaxKind.CallExpression) {
                let callExpression = ts.createExpressionStatement(initializer);
                if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                    return ts.createExpressionStatement(createAngularDeclarationNode(<ts.CallExpression>initializer));
                }
            }
        } else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            const expression = (<ts.ExpressionStatement>node).expression;
            if (expression.kind === ts.SyntaxKind.CallExpression) {
                let callExpression = ts.createExpressionStatement(expression);
                if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                    return ts.createExpressionStatement(createAngularDeclarationNode(<ts.CallExpression>expression));
                }
            }
        }
        return node;
    }


    function createAngularDeclarationNode(node: ts.CallExpression): ts.Expression {
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

        const declarationsForModule = metaData.getDeclarationsForModule(firstCallExpression.arguments[0].getText());
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
}