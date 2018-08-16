import * as ts from 'typescript';
import * as utils from '../utils';
import {
    getAngularDeclaration,
    getFirstCallExpressionIdentifier,
    isAngularExpressionButNotModuleDeclaration
} from './angularjs';
import {addExportToNode} from './exporter';
import {AngularDeclaration, moduleIdentifier, platformModuleNames} from '../model';
import {metaData} from '../metaData';

export function moduleTransformer(context: ts.TransformationContext) {
    let ngDeclarations: Array<AngularDeclaration>;
    let sf: ts.SourceFile;
    let addExports = context.getCompilerOptions().addExportsToAll;
    let refs: Set<string>;
    let ngRefs: Set<string>;
    return transformModuleDeclaration;


    function transformModuleDeclaration(sourceFile: ts.SourceFile) {
        if (sourceFile.isDeclarationFile) {
            return sourceFile;
        }
        ngDeclarations = [];
        refs = new Set<string>();
        ngRefs = new Set<string>();

        sf = sourceFile;
        sourceFile = ts.visitNode(sourceFile, visitSourceFile);
        ts.forEachChild(sourceFile, findReferences);

        ngDeclarations.forEach(dec => {
            metaData.addNgDeclaration(dec.module, dec.declarations);
        });

        return sourceFile;
    }

    function findReferences(node: ts.Node) {
        // TODO: config option for other fully qualified starts eg. de.conti
        if (node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const ref = node.getText(sf);
            if (ref.startsWith('cf.cplace.platform.')) {
                refs.add(ref);
            }
        } else {
            ts.forEachChild(node, findReferences);
        }
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
                    metaData.addNgModuleIdentifier(variableDeclaration.name.getText(), (<ts.CallExpression>initializer).arguments[0].getText());
                    moduleIdentifier.name = variableDeclaration.name.getText();
                    const dec = getAngularDeclaration(callExpression, moduleIdentifier.name);
                    // metaData.addNgDeclaration(dec.module, dec.declarations);
                    ngDeclarations.push(dec);
                }
            }
        }
    }

    function extractAndRemoveAngularDeclarations(node: ts.Node) {
        checkIfAngularModuleDeclaration(node);
        if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            if (isAngularExpressionButNotModuleDeclaration(<ts.ExpressionStatement>node)) {
                const dec = getAngularDeclaration((<ts.ExpressionStatement>node).expression as ts.CallExpression, moduleIdentifier.name);
                // metaData.addNgDeclaration(dec.module, dec.declarations);
                ngDeclarations.push(dec);
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
    function getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName: string, moduleDeclaration: ts.ModuleDeclaration): ts.ModuleDeclaration {
        typescriptModuleName = typescriptModuleName.concat(moduleDeclaration.name.text, '.');
        if (moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            const recursiveInnerModule = getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName, <ts.ModuleDeclaration>moduleDeclaration.body);
            return recursiveInnerModule || <ts.ModuleDeclaration>moduleDeclaration.body;
        }
        platformModuleNames.add(typescriptModuleName.slice(0, -1));
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
        if (node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let qualifiedName = node.getText();
            // all angular interfaces/types are prefixed with 'I' and we use them as 'ng.IScope'
            // we also make sure that we only replace type references
            if (qualifiedName.startsWith('ng.I') && node.kind === ts.SyntaxKind.TypeReference) {
                qualifiedName = qualifiedName.replace('ng.', '');
                ngRefs.add(qualifiedName);
                let qualifiedNameIdentifier = ts.createIdentifier(qualifiedName);
                return ts.updateTypeReferenceNode(<ts.TypeReferenceNode>node, qualifiedNameIdentifier, undefined);
            } else if (qualifiedName.startsWith('cf.cplace.platform')) {
                qualifiedName = qualifiedName.replace('cf.cplace.platform.', '');
                let qualifiedNameIdentifier = ts.createIdentifier(qualifiedName);
                if (node.kind === ts.SyntaxKind.TypeReference) {
                    return ts.updateTypeReferenceNode(<ts.TypeReferenceNode>node, qualifiedNameIdentifier, undefined);
                }
                if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
                    return ts.createIdentifier(qualifiedName);
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

