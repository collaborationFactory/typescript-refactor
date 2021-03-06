import * as ts from 'typescript';
import * as utils from '../utils';
import {getAngularDeclaration, getFirstCallExpression, getFirstCallExpressionIdentifier, isAngularExpression} from './angularjsUtils';
import {addExportToNode} from './exporter';
import {IAngularDeclaration, platformModuleNames} from '../model';
import {MetaData} from '../metaData';

export function createModuleTransformer(replaceablePluginNames: string[]) {
    return function (context: ts.TransformationContext) {
        let ngDeclarations: Array<IAngularDeclaration>;
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
                MetaData.get().addNgDeclaration(dec.ngModule, dec.declarations);
            });

            return sourceFile;
        }

        /**
         * Should only have a top level module declaration of the form cf.cplace...
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

                const importSpecifier = ts.createImportSpecifier(undefined, ts.createIdentifier(ngRef));
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

                case ts.SyntaxKind.ImportEqualsDeclaration:
                    // we just drop those - they reference qualified names
                    return undefined;
            }
            return node;
        }

        function visitExpressionStatement(node: ts.ExpressionStatement): ts.VisitResult<ts.Node> {
            if (isUseStrict(node)) {
                return undefined;
            }
            return node;
        }

        function getNgModuleNameFromIdentifier(node: ts.Identifier) {
            let str = '';
            let moduleBlock;
            if (sf.statements[0].kind === ts.SyntaxKind.ModuleBlock) {
                moduleBlock = <ts.ModuleBlock>sf.statements[0];
            } else {
                let moduleDec = getInnerMostModuleDeclarationFromDottedModule(str, <ts.ModuleDeclaration>sf.statements[0]);
                moduleBlock = <ts.ModuleBlock>moduleDec.body;
            }

            let moduleName = node.getText();
            moduleBlock.statements.find(statement => {
                if (statement.kind === ts.SyntaxKind.VariableStatement) {
                    let declaration = (<ts.VariableStatement>statement).declarationList.declarations[0] as ts.VariableDeclaration;
                    if (declaration.name.getText() === node.getText()) {
                        moduleName = declaration.initializer.getText();
                        return true;
                    }
                }
            });

            return moduleName;
        }

        function checkIfAngularModuleDeclaration(node: ts.Node): boolean {
            if (node.kind === ts.SyntaxKind.VariableStatement) {
                let variableStatementNode = <ts.VariableStatement>node;
                let variableDeclaration = variableStatementNode.declarationList.declarations[0];
                let initializer = variableDeclaration.initializer;

                // variable is only declared not initialized
                if (!initializer) {
                    return false;
                }

                if (initializer.kind === ts.SyntaxKind.CallExpression) {
                    let callExpression = ts.createExpressionStatement(initializer);
                    if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                        const ngCallExpr = getFirstCallExpression(<ts.CallExpression>initializer);
                        const moduleId = ngCallExpr.arguments[0];
                        let moduleName = moduleId.getText();
                        if (moduleId.kind === ts.SyntaxKind.Identifier) {
                            moduleName = getNgModuleNameFromIdentifier(<ts.Identifier>moduleId);
                        }
                        MetaData.get().addNgModuleIdentifier(moduleName, sf.fileName, tsModuleName, variableDeclaration.name.getText(), moduleId.getText());
                        ngDeclarations.push(getAngularDeclaration(callExpression, tsModuleName));
                        return true;
                    }
                }
            } else if (node.kind === ts.SyntaxKind.ExpressionStatement) {
                const expression = (<ts.ExpressionStatement>node).expression;
                if (expression.kind === ts.SyntaxKind.CallExpression) {
                    let callExpression = ts.createExpressionStatement(expression);
                    if ('angular.module' === getFirstCallExpressionIdentifier(<ts.CallExpression>(callExpression.expression))) {
                        const moduleId = (<ts.CallExpression>expression).arguments[0];
                        let moduleName = moduleId.getText();
                        if (moduleId.kind === ts.SyntaxKind.Identifier) {
                            moduleName = getNgModuleNameFromIdentifier(<ts.Identifier>moduleId);
                        }

                        MetaData.get().addNgModuleIdentifier(moduleName, sf.fileName, tsModuleName, undefined, moduleId.getText());
                        ngDeclarations.push(getAngularDeclaration(callExpression, tsModuleName));
                        return true;
                    }
                }
            }
            return false;
        }

        function extractAndRemoveAngularDeclarations(node: ts.Node) {
            let isModule = checkIfAngularModuleDeclaration(node);
            if (node.kind === ts.SyntaxKind.ExpressionStatement) {
                if (isAngularExpression(<ts.ExpressionStatement>node)) {
                    ngDeclarations.push(getAngularDeclaration((<ts.ExpressionStatement>node).expression as ts.CallExpression, tsModuleName));
                    return isModule ? node : undefined;
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
            if (node.kind === ts.SyntaxKind.TypeReference
                || node.kind === ts.SyntaxKind.PropertyAccessExpression
                || node.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
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
                } else if (startsWithReplaceablePluginName(qualifiedName)) {
                    let platformModule = getLongestModuleReference(qualifiedName);
                    qualifiedName = qualifiedName.replace(platformModule + '.', '');
                    if (node.kind === ts.SyntaxKind.TypeReference) {
                        let qualifiedNameIdentifier = ts.createIdentifier(qualifiedName);
                        return ts.updateTypeReferenceNode(<ts.TypeReferenceNode>node, qualifiedNameIdentifier, undefined);
                    } else if (node.kind === ts.SyntaxKind.PropertyAccessExpression) {
                        return ts.createIdentifier(qualifiedName);
                    } else if (node.kind === ts.SyntaxKind.ExpressionWithTypeArguments) {
                        // we strip any generic type signature from the identifier
                        qualifiedName = qualifiedName.replace(/<.*>/g, '');
                        const expressionNode = node as ts.ExpressionWithTypeArguments;
                        let typeArguments = undefined;
                        if (expressionNode.typeArguments) {
                            typeArguments = expressionNode.typeArguments.map(typeNode => {
                                return checkAndReplaceReferences(typeNode) as ts.TypeNode;
                            });
                        }
                        return ts.updateExpressionWithTypeArguments(expressionNode, typeArguments, ts.createIdentifier(qualifiedName));
                    }
                }
            } else {
                return ts.visitEachChild(node, checkAndReplaceReferences, context);
            }
            return node;
        }


        function getLongestModuleReference(qualifiedName: string): string {
            for (const platformName of platformModuleNames) {
                if (qualifiedName.startsWith(platformName)) {
                    return platformName;
                }
            }

            // example: qualifiedName = cf.cplace.plugin.events.THIS_IS_A_CONST
            const parts = qualifiedName.split('.');
            const lastIdentifier = parts[parts.length - 1]; // -> THIS_IS_A_CONST
            if (isLikeAConstant(lastIdentifier)) {
                // we remove the constant part: THIS_IS_A_CONST
                parts.splice(parts.length - 1);
            }
            // we remove the last identifier
            parts.splice(parts.length - 1); // -> parts: ['cf', 'cplace', 'plugin']
            return parts.join('.');
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
                            if (controller.func === node.name.text) {
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

        function startsWithReplaceablePluginName(qualifiedName: string): boolean {
            for (const pluginName of replaceablePluginNames) {
                if (qualifiedName.startsWith(`${pluginName}.`)) {
                    return true;
                }
            }
            return false;
        }

        function isLikeAConstant(identifier: string): boolean {
            return /^[A-Z0-9_]+$/.test(identifier);
        }
    };
}
