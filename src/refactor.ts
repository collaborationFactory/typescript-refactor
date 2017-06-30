import {readFileSync} from 'fs';
import * as ts from 'typescript';
import {moduleTransformer} from "./transformers/moduleTransformer";

export default class Refactor {
    sourceFile: ts.SourceFile;
    printer: ts.Printer;

    /**
     * @param fileName absolute path of the .ts file
     */
    constructor(private fileName: string) {
        this.printer = ts.createPrinter();
        this.parse();
    }

    parse() {
        this.sourceFile = ts.createSourceFile(this.fileName, readFileSync(this.fileName).toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        if(this.shouldRefactor(this.sourceFile)) {
            const result = ts.transform(this.sourceFile, [moduleTransformer]);
            const transformed = this.printer.printFile(result.transformed[0]);
            console.log(transformed);
        }
    }

    /**
     * if the file declares top level module(s) then the file can be refactored
     * eg.
     * <code>
     *    module some.module.name {
     *      function somefunc() {}
     *      class someClass {}
     *    }
     * </code>
     * @param sourceFile
     */
    shouldRefactor(sourceFile: ts.SourceFile) {
        let refactor = false;
        sourceFile.forEachChild((node) => {
            // console.log(ts.SyntaxKind[node.kind]);
            if(node.kind === ts.SyntaxKind.ModuleDeclaration) {
                refactor = true;
                return true;
            }
        });
        return refactor;
    }
}