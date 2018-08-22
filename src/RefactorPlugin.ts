import * as path from 'path';
import * as ts from 'typescript';
import {moduleTransformer} from './transformer/moduleTransformer';
import {config} from './config';
import {applyTextChanges, copyFolderRecursiveSync, ensureDirExists, saveFile} from './utils';
import {Project} from './ts/Project';
import {LSHost} from './ts/LSHost';
import {initMetaData, metaData} from './metaData';
import {angularDeclarationsTransformer} from './transformer/angularModuleDeclarations';

export default class RefactorPlugin {
    private readonly tsPath: string;
    private project: Project;
    printer: ts.Printer;

    constructor(private plugin: string, private readonly platformProject?: Project) {
        this.tsPath = path.join(config.mainRepoPath, plugin, 'assets', 'ts');

        this.printer = ts.createPrinter({
            removeComments: false,
        });

        initMetaData(plugin);
        // this.files = this.getFiles();
    }

    refactor() {
        // copy old ts files to a new folder "ts-old"
        const target = path.join(config.mainRepoPath, this.plugin, 'assets', 'ts-old');
        ensureDirExists(target);
        copyFolderRecursiveSync(this.tsPath, target);
        // create a config file with required settings
        this.createConfigFile();

        let additionalFiles = this.platformProject ? this.platformProject.getProjectFiles() : [];
        this.project = new Project(new LSHost(this.tsPath, additionalFiles));
        let projectFiles = this.project.getProjectFiles();

        projectFiles.forEach(file => {
            try {
                console.log('processing file', file);
                const sourceFile = this.project.getSourceFile(file);
                if (sourceFile.isDeclarationFile) {
                    return;
                }
                if (this.shouldRefactor(sourceFile)) {
                    const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: config.addExports});
                    const transformed = this.printer.printFile(result.transformed[0]);
                    this.project.updateSourceFile(file, transformed);
                }

                if (config.addImports) {
                    this.resolveImports(file);
                    this.organizeImports(file);
                }
            } catch (e) {
                console.log(file, e)
            }
        });

        const ngModuleInfo = metaData.getNgModuleInfo();

        for (let [module, info] of  ngModuleInfo) {
            const sourceFile = this.project.getSourceFile(info.fileName);
            const result = ts.transform(sourceFile, [angularDeclarationsTransformer]);
            const transformed = this.printer.printFile(result.transformed[0]);
            this.project.updateSourceFile(info.fileName, transformed);

            if (config.addImports) {
                this.resolveImports(info.fileName);
                this.organizeImports(info.fileName);
            }
        }

        // YaY!! All done. Save all files
        this.project.persist();

        return this.project;
    }

    resolveImports(fileName: string) {
        const semanticDiagnostics = this.project.getSemanticDiagnostics(fileName);

        let text: string;
        if (semanticDiagnostics.length) {
            text = this.project.getCurrentContents(fileName);
        }

        semanticDiagnostics.forEach(diag => {
            // code 2304 is when typescript cannot find "name"
            if (diag.code === 2304) {
                const fixes = this.project.getCodeFixes(fileName, diag);
                // We only apply fixes if there is exactly one option, It's better not to apply fix than to apply wrong fix.
                if (fixes.length && fixes.length === 1) {
                    text = applyTextChanges(text, fixes[0].changes[0].textChanges);
                }
            }
        });

        if (text && text.length) {
            this.project.updateSourceFile(fileName, text);
        }
    }

    organizeImports(fileName: string) {
        const importOrganizeChanges = this.project.getImportOrganizeChanges(fileName);

        if (importOrganizeChanges && importOrganizeChanges.length) {
            let text = this.project.getCurrentContents(fileName);
            text = applyTextChanges(text, importOrganizeChanges[0].textChanges);
            this.project.updateSourceFile(fileName, text);
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
        sourceFile.forEachChild((node) => {
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                return refactor = true;
            }
        });
        return refactor;
    }

    createConfigFile() {
        let tsconfig: any = {
            extends: '',
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.'
            },
            include: ['./**/*.ts']
        };

        if (this.plugin === 'cf.cplace.platform') {
            tsconfig.extends = '../../../tsconfig.settings.json';
        } else {
            tsconfig.extends = '../../../tsconfig.base.json';
        }
        const tsconfigPath = path.join(this.tsPath, 'tsconfig.json');
        saveFile(tsconfigPath, JSON.stringify(tsconfig, null, 4));
    }
}