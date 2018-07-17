import * as ts from 'typescript';

export function addExportToNode(node: ts.Node, sf) {
    if (!hasExportModifier(node)) {
        let modifiers = node.modifiers;
        let exportToken = ts.createToken(ts.SyntaxKind.ExportKeyword);
        if(!modifiers) {
            modifiers = ts.createNodeArray([exportToken]);
        } else {
            modifiers = ts.createNodeArray(modifiers.concat(exportToken));
        }

        switch (node.kind) {
            case ts.SyntaxKind.VariableStatement:
                return addExportToVariable(<ts.VariableStatement>node, modifiers);
            case ts.SyntaxKind.FunctionDeclaration:
                return addExportToFunction(<ts.FunctionDeclaration>node, modifiers);
            case ts.SyntaxKind.ClassDeclaration:
                return addExportToClass(<ts.ClassDeclaration>node, modifiers);
            case ts.SyntaxKind.InterfaceDeclaration:
                return addExportToInterface(<ts.InterfaceDeclaration>node, modifiers);
        }
    }
    return node;
}

function addExportToVariable(node: ts.VariableStatement, modifiers) {
    return ts.updateVariableStatement(node, modifiers, node.declarationList);
}
function addExportToClass(node: ts.ClassDeclaration, modifiers) {
    return ts.updateClassDeclaration(node, node.decorators, modifiers, node.name, node.typeParameters, node.heritageClauses, node.members);
}
function addExportToFunction(node: ts.FunctionDeclaration, modifiers) {
    return ts.updateFunctionDeclaration(node, node.decorators, modifiers, undefined, node.name, node.typeParameters, node.parameters, node.type, node.body);
}
function addExportToInterface(node: ts.InterfaceDeclaration, modifiers) {
    return ts.updateInterfaceDeclaration(node, node.decorators, modifiers, node.name, node.typeParameters, node.heritageClauses, node.members)
}

export function hasExportModifier(node) {
    if (!(node.kind === ts.SyntaxKind.InterfaceDeclaration
        || node.kind === ts.SyntaxKind.ClassDeclaration
        || node.kind === ts.SyntaxKind.FunctionDeclaration
        || node.kind === ts.SyntaxKind.VariableStatement)) {
        // only add export to above kind
        return true;
    }
    if (!node.modifiers || node.modifiers.length == 0) {
        return false;
    }

    for (let i = 0; i < node.modifiers.length; i++) {
        if (node.modifiers[i].kind === ts.SyntaxKind.ExportKeyword) {
            return true;
        }
    }
    return false;
}