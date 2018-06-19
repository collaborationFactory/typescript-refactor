import fs = require('fs');
import * as ts from 'typescript';
import {moduleTransformer} from "./transformer/moduleTransformer";
import {log, RConfig} from "./index";
import {fileData, IFileData, references} from "./model";
import {importResolver} from "./importResolver";
import {saveFile} from "./utils";


export default class RefactorPlugin {
    static NEW_TS_NAME = 'ts-refactored';
    assetsPath: string;
    files: Map<string, IFileData>;
    printer: ts.Printer;

    constructor(private pluginName: string, private pluginPath: string, private config: RConfig) {
        this.assetsPath = pluginPath + '/assets';
        this.createConfigFile();
        this.printer = ts.createPrinter({
            removeComments: false,
        });
        this.files = this.getFiles();
    }

    refactor() {
        for(let [fileName, file] of this.files) {
            let sourceFile = ts.createSourceFile(fileName, file.data, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
            if (this.shouldRefactor(sourceFile)) {
                const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: this.config.addExports});
                this.files.get(fileName).data = this.printer.printFile(result.transformed[0]);
            }
        }

        let languageService = this.createLanguageService();
        if(this.config.addImports) {
            // this.files = importResolver(this.files, languageService);
        }
        this.formatFiles(languageService)
        this.saveFiles();
    }

    getFiles(): Map<string, IFileData> {
        let tscom = fs.readFileSync(this.assetsPath + '/ts/tscommand.txt', 'utf8');
        let files = new Map<string, IFileData>();
        tscom.split('\n')
            .filter((val) => {
                val = val.trim();
                return (val && val.endsWith('.ts'));
            })
            .forEach((val) => {
                const path = this.assetsPath + '/' + val;
                files.set(path, {
                    data: fs.readFileSync(path, 'utf8'),
                    refactorInfo: null
                });
            });
        return files;
    }

    saveFiles() {
        for(let [fileName, file] of this.files) {

        }
    }

    formatFiles(languageService: ts.LanguageService) {
        for(let [fileName, file] of this.files) {
            const formattingEdits: ts.TextChange[] = languageService.getFormattingEditsForDocument(fileName, RefactorPlugin.defaultFormattingOptions());
            this.files.get(fileName).data = RefactorPlugin.applyChanges(file.data, formattingEdits);
        }
    }

    // from https://github.com/Microsoft/TypeScript/issues/1651#issuecomment-69877863
    static applyChanges(code: string, formattingEdits: ts.TextChange[]): string {
        let formattedCode = code;

        for (let i = formattingEdits.length - 1; i >= 0; i--) {
            let change = formattingEdits[i];
            let before = formattedCode.slice(0, change.span.start);
            let after = formattedCode.slice(change.span.start + change.span.length);
            formattedCode = before + change.newText + after;
        }

        return formattedCode;
    }

    static defaultFormattingOptions(): ts.FormatCodeOptions {
        return {
            IndentSize: 4,
            TabSize: 4,
            NewLineCharacter: '\n',
            ConvertTabsToSpaces: true,
            IndentStyle: ts.IndentStyle.Block,
            InsertSpaceAfterCommaDelimiter: true,
            InsertSpaceAfterSemicolonInForStatements: true,
            InsertSpaceBeforeAndAfterBinaryOperators: true,
            InsertSpaceAfterConstructor: false,
            InsertSpaceAfterKeywordsInControlFlowStatements: true,
            InsertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false,
            InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            PlaceOpenBraceOnNewLineForFunctions: false,
            PlaceOpenBraceOnNewLineForControlBlocks: false
        }
    }

    /**
     * if the file declares top level module(s) then the file can be refactored
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
        if (sourceFile.isDeclarationFile) {
            return false;
        }
        sourceFile.forEachChild((node) => {
            // console.log(ts.SyntaxKind[node.kind]);
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                refactor = true;
                return true;
            }
        });
        return refactor;
    }

    createConfigFile() {
        const platformPath = {
            "platform/*": ["../../../cf.cplace.platform/assets/" + RefactorPlugin.NEW_TS_NAME + "/*"]
        };
        let config = {
            "compilerOptions": {
                "sourceMap": true,
                "experimentalDecorators": true,
                "typeRoots": [
                    "../typings"
                ]
            }
        };

        if (this.pluginName !== 'cf.cplace.platform') {
            config['paths'] = platformPath;
        }
        let fileName = `${this.assetsPath}/${RefactorPlugin.NEW_TS_NAME}/tsconfig.json`;
        fs.writeFileSync(fileName, JSON.stringify(config, null, 4), (err) => {
            throw new Error('error creating config file ' + fileName)
        });
    }

    private createLanguageService() {
        const lsh = {
            getScriptFileNames: () => [...this.files.keys()],
            getScriptVersion: (fileName) => '0',
            getScriptSnapshot: (fileName) => {
                if (!this.files.has(fileName)) {
                    return undefined;
                }
                return ts.ScriptSnapshot.fromString(this.files.get(fileName).data);
            },
            getCurrentDirectory: () => process.cwd(),
            getCompilationSettings: () => ({}),
            getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
            getNewLine: () => '\n',
            fileExists: (fileName) => this.files.has(fileName),
            readFile: (fileName) => this.files.get(fileName).data,
        };

        return ts.createLanguageService(lsh, ts.createDocumentRegistry());
    }

}