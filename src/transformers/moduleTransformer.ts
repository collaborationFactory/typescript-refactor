import * as ts from 'typescript';
import * as utils from '../utils';
import * as helper from './helper';
import {AngularDeclaration, getAngularDeclaration, isAngularExpression} from "./angularjs";

export function moduleTransformer(context: ts.TransformationContext) {


    let sf: ts.SourceFile;
    return transformModuleDeclaration;

    function transformModuleDeclaration(sourceFile: ts.SourceFile) {
        if (sourceFile.isDeclarationFile) {
            return sourceFile;
        }

        sf = sourceFile;
        sourceFile = ts.visitNode(sourceFile, visitSourceFile);
        return sourceFile;
    }


    /**
     * Should only have a top level module declaration of the form cf.cpalce...
     */
    function visitSourceFile(node: ts.SourceFile) {
        let statements: ts.Statement[] = ts.visitLexicalEnvironment(node.statements, sourceElementVisitor, context, 0, false);
        return ts.updateSourceFileNode(node, statements);
    }

    function sourceElementVisitor(node: ts.Node): ts.VisitResult<ts.Node> {
        switch (node.kind) {
            case ts.SyntaxKind.ModuleDeclaration:
                return visitModuleDeclaration(<ts.ModuleDeclaration>node);
            default:
                return node;
        }
    }

    function visitModuleDeclaration(node: ts.ModuleDeclaration): ts.VisitResult<ts.Statement> {
        let visited = ts.visitEachChild(node, visitOthersNodes, context);

        return refactorModule(visited);
    }

    function visitOthersNodes(node: ts.Node): ts.VisitResult<ts.Node> {
        switch (node.kind) {
            case ts.SyntaxKind.ExpressionStatement:
                return visitExpressionStatement(<ts.ExpressionStatement>node);

            case ts.SyntaxKind.ClassDeclaration:
                return visitClassDeclaration(<ts.ClassDeclaration>node);

            case ts.SyntaxKind.VariableDeclaration:
                return visitVariableDeclaration(<ts.VariableDeclaration>node);
        }
        return ts.visitEachChild(node, visitOthersNodes, context);
    }

    function visitExpressionStatement(node: ts.ExpressionStatement): ts.VisitResult<ts.Node> {
        console.log('visiting expression');
        if (isUseStrict(node)) {
            return undefined;
        } else if (isAngularExpression(node)) {
            console.log(getAngularDeclaration((<ts.ExpressionStatement>node).expression as ts.CallExpression));
            return undefined;
        }

        return node;
    }

    function visitVariableDeclaration(node: ts.VariableDeclaration): ts.VisitResult<ts.Node> {
        return node;
    }

    function visitClassDeclaration(node: ts.Node): ts.Node {
        // node.forEachChild((child) => {
        //     console.log(child.kind);
        // });
        return node;
    }

    function refactorModule(node: ts.ModuleDeclaration): Array<ts.Statement> {
        const statements: ts.Statement[] = [];
        context.startLexicalEnvironment();

        let statementsLocation: ts.TextRange;
        let blockLocation: ts.TextRange;

        // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, body, sf));

        let moduleBlock: ts.ModuleBlock;
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            moduleBlock = <ts.ModuleBlock>node.body;
        } else {
            moduleBlock = <ts.ModuleBlock>helper.getInnerMostModuleDeclarationFromDottedModule(node).body;
        }

        utils.addRange(statements, moduleBlock.statements);

        let endLexicalEnvironment = context.endLexicalEnvironment();
        utils.addRange(statements, endLexicalEnvironment);

        // const block = ts.createBlock(
        //     ts.setTextRange(
        //         ts.createNodeArray(statements),
        //         /*location*/ statementsLocation
        //     ),
        //     /*multiLine*/ true
        // );
        // ts.setTextRange(block, blockLocation);


        return statements;
    }


    function isUseStrict(node: ts.ExpressionStatement): boolean {
        if (node.kind !== ts.SyntaxKind.ExpressionStatement) return false;
        const exprStmt = node as ts.ExpressionStatement;
        const expr = exprStmt.expression;
        if (expr.kind !== ts.SyntaxKind.StringLiteral) return false;
        const literal = expr as ts.StringLiteral;
        return literal.text === 'use strict';
    }

    function createStaticFieldForControllerClass(value: string) {
        // ts.createVariableStatement();
    }


}

