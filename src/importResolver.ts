import * as ts from 'typescript';
import {applyTextChanges, saveFile} from "./utils";

const fs = require('fs');

export function importResolver(fileList: string[], langServ2: ts.LanguageService) {
    let options = {};
    const serviceHost: ts.LanguageServiceHost = {
        getScriptFileNames: () => fileList,
        getScriptVersion: (fileName) => '0',
        getScriptSnapshot: (fileName) => {
            if (!fs.existsSync(fileName)) {
                return undefined;
            }

            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
        },
        getCurrentDirectory: () => process.cwd(),
        getCompilationSettings: () => options,
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        getNewLine: () => '\n',
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        readDirectory: ts.sys.readDirectory,
    };

    const langServ = ts.createLanguageService(serviceHost, ts.createDocumentRegistry());

    fileList.forEach((fileName) => {
       console.log('//START ***', fileName, '***');
       let fileData = resolve(langServ, fileName);
       saveFile(fileName, fileData);
       console.log('//END ***', fileName, '***');
    });

    function resolve(languageService: ts.LanguageService, fileName: string) {
        let semanticDiagnostics = languageService.getSemanticDiagnostics(fileName);

        let changes: ts.TextChange[] = [];
        let msgs: Set<string> = new Set();
        semanticDiagnostics.forEach((diag) => {
            const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
            console.log(msg);
            let codeFixes = languageService.getCodeFixesAtPosition(fileName, diag.start, diag.length, [diag.code], defaultFormattingOptions, {});
            codeFixes.forEach((cf) => {
                console.log(cf.changes[0].textChanges);
                if(!msgs.has(msg)) {
                    msgs.add(msg);
                    changes = changes.concat(cf.changes[0].textChanges);
                }
            });
        });
        let code = languageService.getProgram().getSourceFile(fileName).getFullText();
        return applyTextChanges(code, changes);
    }

    function defaultFormattingOptions(): ts.FormatCodeSettings {
        return {
            indentSize: 4,
            tabSize: 4,
            newLineCharacter: '\n',
            convertTabsToSpaces: true,
            indentStyle: ts.IndentStyle.Smart,

            insertSpaceAfterCommaDelimiter: true,
            insertSpaceAfterSemicolonInForStatements: true,
            insertSpaceBeforeAndAfterBinaryOperators: true,
            insertSpaceAfterConstructor: false,
            insertSpaceAfterKeywordsInControlFlowStatements: true,
            insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
            insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: false,
            insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
            placeOpenBraceOnNewLineForFunctions: false,
            placeOpenBraceOnNewLineForControlBlocks: false
        }
    }


}