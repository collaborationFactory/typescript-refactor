import fs = require('fs');
import * as ts from 'typescript';
import {moduleTransformer} from './transformer/moduleTransformer';
import {log, RConfig} from './index';
import {saveFile} from './utils';

//TODO: In the final version rename ts folder to ts-old and create new folder with name ts
export default class RefactorCplaceTS {
    static NEW_TS_NAME = 'ts-refactored';
    mainDirectory: string;
    printer: ts.Printer;

    /**
     * @param config
     */
    constructor(private config: RConfig) {
        this.mainDirectory = this.getMainDirectory();
        if (!this.mainDirectory) {
            log.fatal('Could not determine path to main folder. Make sure the script is running from either "main" directory or one of the plugins directory directly under "main"');
            // TODO: enable this
            // process.exit();
            // return;
        }
        this.printer = ts.createPrinter({
            removeComments: false,
        });
        this.start();
    }

    start() {
        for (let i = 0; i < this.config.plugins.length; i++) {
            this.refactorPlugin(this.config.plugins[i]);
        }
    }

    refactorPlugin(plugin: string) {
        const pluginAssetsPath = this.mainDirectory + '/' + plugin + '/assets';
        RefactorCplaceTS.createConfigFile(pluginAssetsPath, plugin);
        const fileList = this.getFileList(pluginAssetsPath);
        /*
                for (let i = 0; i < fileList.length; i++) {
                    let sourceFile = ts.createSourceFile(fileList[i], fs.readFileSync(fileList[i]).toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
                    if (this.shouldRefactor(sourceFile)) {
                        const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: this.config.addExports});
                        const transformed = this.printer.printFile(result.transformed[0]);
                        // console.log(transformed);
                        // saveFile(this.getRefactoredDirPath(fileList[i], plugin), transformed);
                    }
                }
        */

        const languageService = this.createLanguageService(fileList);

        if (this.config.addImports) {
            // importResolver(fileList, languageService);
        }


        // if (this.config.addImports) {
        //     let refactoredFiles: Array<string> = [];
        //     // for (let i = 0; i < fileList.length; i++) {
        //     //     refactoredFiles.push(this.getRefactoredDirPath(fileList[i], plugin));
        //     // }
        //
        //     refactoredFiles = this.getFiles(pluginAssetsPath + '/ts-refactored');
        //     importResolver(refactoredFiles, null, RefactorCplaceTS.getCompilerOptions(plugin));
        //     // this.testImportResolver(refactoredFiles, plugin);
        // }

        // this.formatFiles(fileList, languageService);
    }

    testImportResolver(refactoredFiles: Array<string>, plugin: string) {
        let readConfigFile = ts.readConfigFile('/Users/pragatisureka/Documents/test/main/cf.cplace.cp4p.planning/assets/ts-refactored/tsconfig.json', ts.sys.readFile);
        console.log(readConfigFile);
        const parsedCommandLine = ts.parseJsonConfigFileContent(readConfigFile.config, {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            fileExists: ts.sys.fileExists
        }, '/Users/pragatisureka/Documents/test/main/cf.cplace.cp4p.planning/assets/ts-refactored');

        console.log(parsedCommandLine);
    }

    getRefactoredDirPath(oldPath, plugin): string {
        const re = new RegExp('(.+/' + plugin + '/assets/)ts(/.+)');
        if (re.test(oldPath)) {
            return oldPath.replace(re, '$1' + RefactorCplaceTS.NEW_TS_NAME + '$2');
        } else {
            log.error('Unexpected file path, refactored file might be misplaced', oldPath);
        }
    }

    configure() {

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

    formatFiles(files: string[], languageService: ts.LanguageService) {
        let program = languageService.getProgram();
        for (let i = 0; i < files.length; i++) {
            const formattingEdits: ts.TextChange[] = languageService.getFormattingEditsForDocument(files[i], RefactorCplaceTS.defaultFormattingOptions());
            console.log(formattingEdits);

            let code = this.formatCode(program.getSourceFile(files[i]).getFullText(), formattingEdits);

            // fs.writeFile(files[i], code, (err) => {
            //     if (err) {
            //         log.error('Error writing file ' + files[i], err);
            //     }
            // });
        }
    }

    // from https://github.com/Microsoft/TypeScript/issues/1651#issuecomment-69877863
    formatCode(code: string, formattingEdits: ts.TextChange[]): string {
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

    getMainDirectory() {
        // let dirStack =  process.cwd().split('/');
        let dirStack = '/Users/pragatisureka/Documents/test/main'.split('/');

        let mainPath = '';
        while (dirStack.length) {
            if (dirStack.pop() === 'main') {
                mainPath = dirStack.join('/') + '/main';
                break;
            }
        }
        return mainPath;
    }

    getFileList(pluginAssetsPath: string) {
        let data = fs.readFileSync(pluginAssetsPath + '/ts/tscommand.txt', 'utf8');
        return data.split('\n').filter((val) => {
            val = val.trim();
            return (val && val.endsWith('.ts'));
        })
            .map((val) => {
                return pluginAssetsPath + '/' + val;
            });
    }

    private createLanguageService(fileList: string[]) {
        const lsh = {
            getScriptFileNames: () => fileList,
            getScriptVersion: (fileName) => '0',
            getScriptSnapshot: (fileName) => {
                if (!fs.existsSync(fileName)) {
                    return undefined;
                }
                return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
            },
            getCurrentDirectory: () => process.cwd(),
            getCompilationSettings: () => ({}),
            getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
            getNewLine: () => '\n',
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
            readDirectory: ts.sys.readDirectory,
        };

        return ts.createLanguageService(lsh, ts.createDocumentRegistry());
    }

    static createConfigFile(assetsPath, pluginName) {
        //TODO: rename ts-refactored to ts when everything is ready
        const paths = {
            '*': ['../../../cf.cplace.platform/assets/node_modules/@types/*'],
            '@platform/*': ['../../../cf.cplace.platform/assets/ts-refactored/*']
        };

        const references = [
            {
                path: '../../../cf.cplace.platform/assets/ts-refactored'
            }
        ];

        let config = {
            "compilerOptions": {
                'baseUrl': '.',
                'experimentalDecorators': true,
                'target': 'es5',
                'outDir': '../generated_js',
                'strict': true,
                'composite': true,
                'declaration': true,
                'declarationMap': true,
                'sourceMap': true
            },
            'include': ['./**/*.ts']
        };

        if(pluginName !== 'cf.cplace.platform') {
            config.compilerOptions['paths'] = paths;
            config['references'] = references;
        }

        let fileName = assetsPath + '/' + RefactorCplaceTS.NEW_TS_NAME + '/tsconfig.json';
        saveFile(fileName, JSON.stringify(config, null, 4));
    }

    testProgram(plugin: string) {
        const pluginPath = this.mainDirectory + '/' + plugin;
        const fileList = this.getFileList(pluginPath);
        let compilerHost = ts.createCompilerHost({}, true);
        let p = ts.createProgram(fileList, {}, compilerHost);

        for (let i = 0; i < fileList.length; i++) {
            console.log(fileList);
            let sourceFile = p.getSourceFile(fileList[i]);
            if (this.shouldRefactor(sourceFile)) {
                const result = ts.transform(sourceFile, [moduleTransformer]);
                const transformed = this.printer.printFile(result.transformed[0]);
                console.log(transformed);
            }
        }


        let typeChecker = p.getTypeChecker();

        // p.getSourceFiles().forEach((sourceFile) => {
        //
        //     console.log(sourceFile.fileName);
        //     if (this.shouldRefactor(sourceFile)) {
        //         const result = ts.transform(sourceFile, [moduleTransformer]);
        //         const transformed = this.printer.printFile(result.transformed[0]);
        //         console.log(transformed);
        //     }
        // });

        // let filename = '/Users/pragatisureka/Documents/test/main/cf.cplace.cp4p.planning/assets2/ts/controllers/CalculationMethodFormCtrl.ts';
        // let filename = '/Users/pragatisureka/Documents/test/main/cf.cplace.cp4p.planning/assets/ts/ctrl.ts';
        // let sourceFile = ts.createSourceFile(filename, fs.readFileSync(filename).toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
        // if (this.shouldRefactor(sourceFile)) {
        //     const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: this.config.addExports});
        //     const transformed = this.printer.printFile(result.transformed[0]);
        //     console.log(transformed);
        // }
    }

}