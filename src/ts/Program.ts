import * as ts from 'typescript';
import {LSHost} from "./LSHost";

export class Program {

    static DEFAULT_FORMATTING_OPTIONS: ts.FormatCodeSettings = {
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
    };


    static USER_PREFERENCES: ts.UserPreferences = {
        quotePreference: 'single',
        importModuleSpecifierPreference: "non-relative"
    };

    service: ts.LanguageService;

    constructor(public host: LSHost) {
        this.service = ts.createLanguageService(this.host, ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames))
    }

    getCodeFixes(fileName: string, start: number, end: number, errorCodes: ReadonlyArray<number>) {
        return this.service.getCodeFixesAtPosition(fileName, start, end, errorCodes, Program.DEFAULT_FORMATTING_OPTIONS, Program.USER_PREFERENCES);
    }

    getSourceFile(fileName: string) {
        this.service.getProgram().getSourceFile(fileName)
    }


}