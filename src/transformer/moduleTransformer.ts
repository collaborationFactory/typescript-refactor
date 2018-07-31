import * as ts from 'typescript';
import * as utils from '../utils';
import {
    AngularDeclaration,
    getAngularDeclaration,
    getFirstCallExpressionIdentifier,
    isAngularExpressionButNotModuleDeclaration
} from './angularjs';
import {addExportToNode} from './exporter';
import {fileData, moduleIdentifier, platformModuleNames} from '../model';

export function moduleTransformer(context: ts.TransformationContext) {
    let ngDeclarations: Array<AngularDeclaration>;
    let sf: ts.SourceFile;
    let addExports = context.getCompilerOptions().addExportsToAll;
    let refs: Set<string>;
    return transformModuleDeclaration;


    function transformModuleDeclaration(sourceFile: ts.SourceFile) {
        if (sourceFile.isDeclarationFile) {
            return sourceFile;
        }
        ngDeclarations = [];
        refs = new Set();
        console.log('processing file', sourceFile.fileName);
        // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, sourceFile, sourceFile));

        sf = sourceFile;
        sourceFile = ts.visitNode(sourceFile, visitSourceFile);
        ts.forEachChild(sourceFile, findReferences);

        fileData.set(sourceFile.fileName, {
            ngDeclaration: ngDeclarations,
            references: refs,
            moduleName: ''
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
        return ts.updateSourceFileNode(node, statements);
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
            let variableStatementNode = <ts.VariableStatement>(node);
            let variableDeclaration = variableStatementNode.declarationList.declarations[0];
            let initializer = variableDeclaration.initializer;
            if (initializer.kind === ts.SyntaxKind.CallExpression) {
                let callExpression = ts.createStatement(<ts.CallExpression>(initializer));
                if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                    moduleIdentifier.name = variableDeclaration.name.getText();
                    ngDeclarations.push(getAngularDeclaration(callExpression, moduleIdentifier.name));
                }
            }
        }
    }

    function extractAndRemoveAngularDeclarations(node: ts.Node) {
        checkIfAngularModuleDeclaration(node);
        if (node.kind === ts.SyntaxKind.ExpressionStatement) {
            if (isAngularExpressionButNotModuleDeclaration(<ts.ExpressionStatement>node)) {
                ngDeclarations.push(getAngularDeclaration((<ts.ExpressionStatement>node).expression as ts.CallExpression, moduleIdentifier.name));
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
     * @param typescriptModuleName
     * @param moduleDeclaration
     * @returns {ts.ModuleDeclaration}
     */
    function getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName: string, moduleDeclaration: ts.ModuleDeclaration): ts.ModuleDeclaration {
        typescriptModuleName = typescriptModuleName.concat(moduleDeclaration.name.text, ".");
        if (moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
            const recursiveInnerModule = getInnerMostModuleDeclarationFromDottedModule(typescriptModuleName, <ts.ModuleDeclaration>moduleDeclaration.body);
            return recursiveInnerModule || <ts.ModuleDeclaration>moduleDeclaration.body;
        }
        platformModuleNames.add(typescriptModuleName.slice(0, -1));
    }

    function refactorModule(node: ts.ModuleDeclaration): Array<ts.Statement> {
        const statements: ts.Statement[] = [];
        let typesciptModuleName: string = "";
        context.startLexicalEnvironment();
        // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, sf));

        let moduleBlock: ts.ModuleBlock;
        if (node.body.kind === ts.SyntaxKind.ModuleBlock) {
            moduleBlock = <ts.ModuleBlock>node.body;
        } else {
            let moduleDec = getInnerMostModuleDeclarationFromDottedModule(typesciptModuleName, node);
            moduleBlock = <ts.ModuleBlock>moduleDec.body;
        }
        // console.log(ts.createPrinter().printNode(ts.EmitHint.Unspecified, moduleBlock, sf));
        moduleBlock = ts.visitEachChild(moduleBlock, extractAndRemoveAngularDeclarations, context);
        moduleBlock = ts.visitEachChild(moduleBlock, visitDirectChildOfModule, context);
        moduleBlock = ts.visitEachChild(moduleBlock, checkAndReplaceForModuleReferences, context);
        utils.addRange(statements, moduleBlock.statements);
        let endLexicalEnvironment = context.endLexicalEnvironment();
        utils.addRange(statements, endLexicalEnvironment);
        return statements;
    }

    function checkAndReplaceForModuleReferences(node: ts.Node): ts.VisitResult<ts.Node> {
        if (node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.PropertyAccessExpression) {
            let qualifiedName = node.getText();
            if (qualifiedName.startsWith('cf.cplace.platform')) {
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
            return ts.visitEachChild(node, checkAndReplaceForModuleReferences, context);
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
                if (ngDeclaration.types.controller) {
                    if (ngDeclaration.types.controller[1] === node.name.text) {
                        // angular controller declaration is using string value
                        if (ngDeclaration.types.controller[0].startsWith("'")
                            || ngDeclaration.types.controller[0].endsWith("'")
                            || ngDeclaration.types.controller[0].startsWith('"')
                            || ngDeclaration.types.controller[0].endsWith('"')) {
                            let members = node.members;
                            let initExpr;
                            if (!ngDeclaration.types.controller[0].startsWith("'") || !ngDeclaration.types.controller[0].startsWith('"')) {
                                initExpr = ts.createIdentifier(ngDeclaration.types.controller[0]);
                            } else {
                                initExpr = ts.createLiteral(ngDeclaration.types.controller[0]);
                            }

                            let propertyDeclaration = ts.createProperty(undefined, [ts.createToken(ts.SyntaxKind.StaticKeyword)], 'CTRL_NAME', undefined, undefined, initExpr);
                            // members.unshift(propertyDeclaration);
                            let classElements: ts.ClassElement[] = [];
                            classElements.push(propertyDeclaration);
                            classElements = classElements.concat(members);

                            return ts.updateClassDeclaration(node, node.decorators, node.modifiers, node.name, node.typeParameters, node.heritageClauses, classElements);
                        }
                    }
                }
            }
        }
        return node;
    }
}

