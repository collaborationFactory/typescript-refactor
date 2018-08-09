import * as ts from 'typescript';
import * as fs from 'fs';
import {LSHost} from './LSHost';
import {applyTextChanges} from '../utils';

export class Project {

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
        importModuleSpecifierPreference: 'non-relative'
    };

    service: ts.LanguageService;
    private documentRegistry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames);

    constructor(public host: LSHost) {
        // just for god measure. make sure config is upto-date
        this.host.parseConfigFile();
        this.service = ts.createLanguageService(this.host, this.documentRegistry);
    }

    fileInProject(fileName: string) {
        return (this.getProjectFiles().indexOf(fileName) > -1) && !!this.service.getProgram().getSourceFile(fileName);
    }

    getProjectFiles() {
        return this.host.getOrigialFileNames()
    }

    getCodeFixes(fileName: string, diagnostic: ts.Diagnostic) {
        return this.service.getCodeFixesAtPosition(fileName, diagnostic.start, diagnostic.start + diagnostic.length, [diagnostic.code], Project.DEFAULT_FORMATTING_OPTIONS, Project.USER_PREFERENCES);
    }

    getSourceFile(fileName: string) {
        if (!this.fileInProject(fileName)) {
            console.log('File not in project', fileName);
            return null;
        }
        return this.service.getProgram().getSourceFile(fileName)
    }

    updateSourceFile(fileName: string, snapshot: ts.IScriptSnapshot) {
        let version = parseInt(this.host.getScriptVersion(fileName)) + 1;
        const newVersion = version.toString();
        this.documentRegistry.updateDocument(fileName, this.host.getCompilationSettings(), snapshot, newVersion);
        this.host.fileVersions.set(fileName, newVersion);
    }

    getCurrentContents(fileName: string) {
        const snapshot = this.host.getScriptSnapshot(fileName);
        return snapshot.getText(0, snapshot.getLength());
    }

    getImportOrganizeChanges(fileName: string) {
        return this.service.organizeImports({
            type: 'file',
            fileName: fileName
        }, Project.DEFAULT_FORMATTING_OPTIONS, Project.USER_PREFERENCES);
    }

    getSemanticDiagnostics(fileName: string) {
        if (!this.fileInProject(fileName)) {
            console.log('File not in project', fileName);
            return null;
        }
        return this.service.getSemanticDiagnostics(fileName);
    }

    private formatFiles() {
        const projectFiles = this.getProjectFiles();
        projectFiles.forEach(file => {
            const formattingEdits = this.service.getFormattingEditsForDocument(file, Project.DEFAULT_FORMATTING_OPTIONS);
            const text = applyTextChanges(this.getCurrentContents(file), formattingEdits);
            this.updateSourceFile(file, ts.ScriptSnapshot.fromString(text))
        });
    }

    // format and persist all files
    persist() {
        this.formatFiles();
        const projectFiles = this.getProjectFiles();
        projectFiles.forEach(file => fs.writeFileSync(file, this.getCurrentContents(file)));
    }
}