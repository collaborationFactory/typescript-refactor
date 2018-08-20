import * as ts from 'typescript';
import * as utils from '../utils';
import {getAngularDeclaration, getFirstCallExpressionIdentifier, isAngularExpression} from './angularjs';
import {addExportToNode} from './exporter';
import {AngularDeclaration, platformModuleNames} from '../model';
import {metaData} from '../metaData';

export function moduleTransformer(context: ts.TransformationContext) {
    let ngDeclarations: Array<AngularDeclaration>;
    let sf: ts.SourceFile;
    let addExports = context.getCompilerOptions().addExportsToAll;
    let ngRefs: Set<string>;
    let tsModuleName = '';

    return transformModuleDeclaration;


    function transformModuleDeclaration(sourceFile: ts.SourceFile) {
        if (sourceFile.isDeclarationFile) {
            return sourceFile;
        }
        ngDeclarations = [];
        ngRefs = new Set<string>();

        sf = sourceFile;
        sourceFile = ts.visitNode(sourceFile, visitSourceFile);

        ngDeclarations.forEach(dec => {
            metaData.addNgDeclaration(dec.module, dec.declarations);
        });

        return sourceFile;
    }

    /**
     * Should only have a top level module declaration of the form cf.cpalce...
     */
    function visitSourceFile(node: ts.SourceFile) {
        let statements: ts.NodeArray<ts.Statement> = ts.visitLexicalEnvironment(node.statements, sourceElementVisitor, context, 0, false);
        const statement = createAngularImportStatement();

        if (statement) {
            statements = ts.createNodeArray([statement].concat(statements));
        }
        return ts.updateSourceFileNode(node, statements);
    }

    function createAngularImportStatement(): ts.Statement {
        if (ngRefs.size == 0) {
            return null;
        }
        let importSpecifiers: Array<ts.ImportSpecifier> = [];
        for (let ngRef of ngRefs) {
            // remove generic/diamond marker
            ngRef = ngRef.replace(/<.*>$/i, '');

            const importSpecifier = ts.createImportSpecifier(undefined,
                ts.createIdentifier(ngRef));
            importSpecifiers.push(importSpecifier);
        }
        const importClause = ts.createImportClause(undefined, ts.createNamedImports(importSpecifiers));
        return ts.createImportDeclaration(undefined, undefined, importClause, ts.createStringLiteral('angular'));

    }

    function sourceElementVisitor(node: ts.Node): ts.VisitResult<ts.Node> {
        switch (node.kind) {
            case ts.SyntaxKind.ModuleDeclaration:
                return refactorModule(<ts.ModuleDeclaration>node);
            default:
                return node;
        }
    }

    function visitDirectChildOfModule(node: ts.Node): ts.VisitResult<ts.Node> {
        switch (node.kind) {
            case ts.SyntaxKind.ExpressionStatement:
                return visitExpressionStatement(<ts.ExpressionStatement>node);

            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.VariableStatement:
            case ts.SyntaxKind.InterfaceDeclaration:
                return visitDeclaration(node);
        }
        return node;
    }

    function visitExpressionStatement(node: ts.ExpressionStatement): ts.VisitResult<ts.Node> {
        if (isUseStrict(node)) {
            return undefined;
        }
        return node;
    }

    function checkIfAngularModuleDeclaration(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.VariableStatement) {
            let variableStatementNode = <ts.VariableStatement>node;
            let variableDeclaration = variableStatementNode.declarationList.declarations[0];
            let initializer = variableDeclaration.initializer;

            // variable is only declared not initialized
            if (!initializer) {
                return;
            }

            if (initializer.kind === ts.SyntaxKind.CallExpression) {
                let callExpression = ts.createExpressionStatement(initializer);
                if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                    metaData.addNgModuleIdentifier((<ts.CallExpression>initializer).arguments[0].getText(), sf.fileName, tsModuleName, variableDeclaration.name.getText());
                    ngDeclarations.push(getAngularDeclaration(callExpression, tsModuleName));
                }
            }
        } else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            const expression = (<ts.ExpressionStatement>node).expression;
            if (expression.kind === ts.SyntaxKind.CallExpression) {
                let callExpression = ts.createExpressionStatement(expression);
                if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                    metaData.addNgModuleIdentifier((<ts.CallExpression>expression).arguments[0].getText(), sf.fileName, tsModuleName);
                    ngDeclarations.push(getAngularDeclaration(callExpression, tsModuleName));
                }
            }
        }
    }

    function extractAndRemoveAngularDeclarations(node: ts.Node) {
        checkIfAngularModuleDeclaration(node);
        if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            if (isAngularExpression(<ts.ExpressionStatement>node)) {
                ngDeclarations.push(getAngularDeclaration((<ts.ExpressionStatement>node).expression as ts.CallExpression, tsModuleName));
                return undefined;
            }
        }
        return node;
    }

    function visitDeclaration(node: ts.Node): ts.Node {
        if (addExports) {
            node = addExportToNode(node, sf);
        }
        if (node.kind === ts.SyntaxKind.ClassDeclaration) {
            node = addStaticFieldForController(<ts.ClassDeclaration>node);
        }

        return node;
    }

    /**
     *
     * In typescript module declaration of the form
     *      module cf.cplace.platform.search { // module code}
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
     * @param typescriptModuleName
     * @param moduleDeclaration
     * @returns {ts.ModuleDeclaration}
     */
    function getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName: string, moduleDeclaration: ts.ModuleDeclaration): ts.ModuleDeclaration {
        typescriptModuleName = typescriptModuleName.concat(moduleDeclaration.name.text, '.');
        if (moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            const recursiveInnerModule = getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName, <ts.ModuleDeclaration>moduleDeclaration.body);
            return recursiveInnerModule || <ts.ModuleDeclaration>moduleDeclaration.body;
        }

        tsModuleName = typescriptModuleName.slice(0, -1);
        platformModuleNames.add(tsModuleName);
    }

    function refactorModule(node: ts.ModuleDeclaration): Array<ts.Statement> {
        const statements: ts.Statement[] = [];
        let typescriptModuleName: string = '';
        context.startLexicalEnvironment();

        let moduleBlock: ts.ModuleBlock;
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            moduleBlock = <ts.ModuleBlock>node.body;
        } else {
            let moduleDec = getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName, node);
            moduleBlock = <ts.ModuleBlock>moduleDec.body;
        }
        moduleBlock = ts.visitEachChild(moduleBlock, extractAndRemoveAngularDeclarations, context);
        moduleBlock = ts.visitEachChild(moduleBlock, visitDirectChildOfModule, context);
        moduleBlock = ts.visitEachChild(moduleBlock, checkAndReplaceReferences, context);

        utils.addRange(statements, moduleBlock.statements);
        let endLexicalEnvironment = context.endLexicalEnvironment();
        utils.addRange(statements, endLexicalEnvironment);

        return statements;
    }

    /**
     * This method will replace platform and angular references
     *
     * angular references - ng.IScope => IScope
     * platform references - cf.cplace.platform.widgetLayout.WidgetCtrl => WidgetCtrl
     *
     * @param node
     */
    function checkAndReplaceReferences(node: ts.Node): ts.VisitResult<ts.Node> {
        if (node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.PropertyAccessExpression || node.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
            let qualifiedName = node.getText();
            // all angular interfaces/types are prefixed with 'I' and we use them as 'ng.IScope'
            // we also make sure that we only replace type references
            if (qualifiedName.startsWith('ng.I')) {
                qualifiedName = qualifiedName.replace('ng.', '');
                ngRefs.add(qualifiedName);
                let qualifiedNameIdentifier = ts.createIdentifier(qualifiedName);
                if (node.kind === ts.SyntaxKind.TypeReference) {
                    return ts.updateTypeReferenceNode(<ts.TypeReferenceNode>node, qualifiedNameIdentifier, undefined);
                } else if (node.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
                    return ts.updateExpressionWithTypeArguments(<ts.ExpressionWithTypeArguments>node, undefined, qualifiedNameIdentifier);
                }
            } else if (qualifiedName.startsWith('cf.cplace.platform')) {
                qualifiedName = qualifiedName.replace('cf.cplace.platform.', '');
                let qualifiedNameIdentifier = ts.createIdentifier(qualifiedName);
                if (node.kind === ts.SyntaxKind.TypeReference) {
                    return ts.updateTypeReferenceNode(<ts.TypeReferenceNode>node, qualifiedNameIdentifier, undefined);
                } else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    return ts.createIdentifier(qualifiedName);
                } else if (node.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
                    return ts.updateExpressionWithTypeArguments(<ts.ExpressionWithTypeArguments>node, undefined, qualifiedNameIdentifier);
                }
            }
        } else {
            return ts.visitEachChild(node, checkAndReplaceReferences, context);
        }
        return node;
    }

    function isUseStrict(node: ts.ExpressionStatement): boolean {
        if (node.kind !== ts.SyntaxKind.ExpressionStatement) return false;
        const exprStmt = node as ts.ExpressionStatement;
        const expr = exprStmt.expression;
        if (expr.kind !== ts.SyntaxKind.StringLiteral) return false;
        const literal = expr as ts.StringLiteral;
        return literal.text === 'use strict';
    }

    function addStaticFieldForController(node: ts.ClassDeclaration) {
        if (ngDeclarations.length > 0) {
            // check if static member CTRL_NAME needs to be added
            for (let i = 0; i < ngDeclarations.length; i++) {
                let ngDeclaration = ngDeclarations[i];
                if (ngDeclaration.declarations.controller) {
                    for (let controller of ngDeclaration.declarations.controller) {
                        if (controller.function === node.name.text) {
                            // angular controller declaration is using string value
                            if (controller.name.startsWith('\'') || controller.name.endsWith('\'')
                                || controller.name.startsWith('"') || controller.name.endsWith('"')) {
                                let members = node.members;
                                let initExpr;
                                if (!controller.name.startsWith('\'') || !controller.name.startsWith('"')) {
                                    initExpr = ts.createIdentifier(controller.name);
                                } else {
                                    initExpr = ts.createLiteral(controller.name);
                                }

                                let propertyDeclaration = ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'CTRL_NAME', undefined, undefined, initExpr);
                                let classElements: ts.ClassElement[] = [];
                                classElements.push(propertyDeclaration);
                                classElements = classElements.concat(members);

                                return ts.updateClassDeclaration(node, node.decorators, node.modifiers, node.name, node.typeParameters, node.heritageClauses, classElements);
                            }
                        }
                    }
                }
            }
        }
        return node;
    }
}

