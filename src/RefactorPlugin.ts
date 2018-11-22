import * as path from 'path';
import * as ts from 'typescript';
import {moduleTransformer} from './transformer/moduleTransformer';
import {config, PLATFORM_PLUGIN} from './config';
import {applyTextChanges, saveFile} from './utils';
import {TSProject} from './ts/TSProject';
import {metaData} from './metaData';
import {angularDeclarationsTransformer} from './transformer/angularModuleDeclarations';
import {Logger} from './logger';
import CplaceIJModule from './CplaceIJModule';

export default class RefactorPlugin {
    private readonly tsPath: string;
    private readonly project: TSProject;
    printer: ts.Printer;

    constructor(private readonly cplaceModule: CplaceIJModule) {
        console.log(`refactored - ${cplaceModule.moduleName}`);
        cplaceModule.setRefactored();
    }

    // constructor(private cplaceModule: string, private readonly platformProject?: TSProject) {
    //     this.tsPath = path.join(config.mainRepoPath, cplaceModule, 'assets', 'ts');
    //
    //     this.printer = ts.createPrinter({
    //         removeComments: false,
    //     });
    //
    //     let additionalFiles = this.platformProject ? this.platformProject.getProjectFiles() : [];
    //     this.project = new TSProject(new LSHost(this.tsPath, additionalFiles));
    //     initMetaData(cplaceModule);
    //     // this.files = this.getFiles();
    // }

    refactor() {
        // copy old ts files to a new folder "ts-old"
        const target = path.join(config.mainRepoPath, this.cplaceModule.moduleName, 'assets', 'ts-old');
        // ensureDirExists(target);
        // copyFolderRecursiveSync(this.tsPath, target);
        // create a config file with required settings
        this.createConfigFile();

        // this.refactorFiles();

        return this.project;
    }

    private refactorFiles() {
        let projectFiles = this.project.getProjectFiles();

        projectFiles.forEach(file => {
            try {
                Logger.log('Processing file', file);
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
                Logger.error(file, e);
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
    }

    private resolveImports(fileName: string) {
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

    private organizeImports(fileName: string) {
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
    private shouldRefactor(sourceFile: ts.SourceFile) {
        let refactor = false;
        sourceFile.forEachChild((node) => {
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                return refactor = true;
            }
        });
        return refactor;
    }

    createConfigFile() {
        const dependencies = this.cplaceModule.getDependencies();

        let paths = {};
        let refs = [];

        dependencies.forEach((dep) => {
            // we do not add platform paths and references here as some modules might not have direct dependency on platform
            if (dep !== PLATFORM_PLUGIN) {
                let relPath = `../../../${dep}/assets/ts`;
                if (config.isSubRepo) {
                    relPath = '../' + relPath;
                }
                paths[`@${dep}/*`] = [relPath + '/*'];

                refs.push({
                    path: relPath
                });
            }
        });

        //add platform path and reference
        let platformRelPath = '../../../cf.cplace.platform/assets/ts';
        if(config.isSubRepo) {
            platformRelPath = '../' + platformRelPath;
        }
        paths[`@${PLATFORM_PLUGIN}/*`] = [platformRelPath + '/*'];
        refs.unshift({
            path: platformRelPath
        });

        let tsconfig: any = {
            extends: '../../../tsconfig.base.json',
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: '../generated_js',
            },
            include: ['./**/*.ts']
        };

        if (this.cplaceModule.moduleName !== 'cf.cplace.platform') {
            tsconfig.compilerOptions.paths = paths;
            tsconfig.references = refs;
        }
        const tsconfigPath = path.join(this.cplaceModule.assetsPath, 'ts', 'tsconfig.json');
        saveFile(tsconfigPath, JSON.stringify(tsconfig, null, 4));
    }
}