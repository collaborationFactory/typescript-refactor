import * as path from 'path';
import * as ts from 'typescript';
import {moduleTransformer} from './transformer/moduleTransformer';
import {PLATFORM_PLUGIN} from './config';
import {applyTextChanges, copyFolderRecursiveSync, ensureDirExists, removeFileIfExists, saveFile} from './utils';
import {TSProject} from './ts/TSProject';
import {angularDeclarationsTransformer} from './transformer/angularModuleDeclarations';
import {Logger} from './logger';
import CplaceIJModule from './CplaceIJModule';
import {LSHost} from './ts/LSHost';
import {MetaData} from './metaData';

export interface IRefactoringOptions {
    addImports: boolean;
    addExports: boolean;
}

export default class RefactorPlugin {
    private static readonly IMPORT_FROM_REGEX = /^import (.+) from ["'](.+)["']/;

    private readonly tsPath: string;

    private project: TSProject;
    private printer: ts.Printer;
    private filesWithErrors: Set<string>;

    constructor(private readonly cplaceModule: CplaceIJModule,
                private readonly relativeRepoPathToMain: string,
                private readonly allModules: Map<string, CplaceIJModule>,
                private readonly options: IRefactoringOptions) {
        this.tsPath = path.join(this.cplaceModule.assetsPath, 'ts');
        this.printer = ts.createPrinter({
            removeComments: false
        });
    }

    prepareFiles(): void {
        // copy old ts files to a new folder "ts-old"
        const target = path.join(this.cplaceModule.assetsPath, 'ts-old');
        ensureDirExists(target);
        copyFolderRecursiveSync(this.tsPath, target);
        removeFileIfExists(this.tsPath, 'tscommand.txt');
        removeFileIfExists(this.tsPath, '_app.d.ts');

        this.createTsConfig();
        this.project = new TSProject(new LSHost(this.tsPath, []));
    }

    refactor(): void {
        const cwd = path.resolve(process.cwd());
        process.chdir(path.resolve(this.cplaceModule.assetsPath, 'ts'));

        try {
            Logger.log('Refactoring', this.cplaceModule.pluginName);
            this.filesWithErrors = new Set();

            this.refactorFiles();

            Logger.success('Successfully refactored', this.cplaceModule.pluginName);
            this.cplaceModule.setRefactored();
        } finally {
            process.chdir(cwd);
        }
    }

    private refactorFiles(): void {
        let projectFiles = this.project.getProjectFiles();

        projectFiles.forEach(file => {
            try {
                Logger.log(' ->', file.replace(this.tsPath + '/', ''));
                const sourceFile = this.project.getSourceFile(file);
                if (sourceFile.isDeclarationFile) {
                    return;
                }
                if (this.shouldRefactor(sourceFile)) {
                    const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: this.options.addExports});
                    const transformed = this.printer.printFile(result.transformed[0]);
                    this.project.updateSourceFile(file, transformed);
                }

                if (this.options.addImports) {
                    this.resolveImports(file);
                    this.organizeImports(file);
                }
            } catch (e) {
                Logger.error(file, e);
            }
        });

        const ngModuleInfo = MetaData.get().getNgModuleInfo();

        for (let [module, info] of ngModuleInfo) {
            const fileName: string = info.fileName;
            Logger.log(' ->', fileName.replace(this.tsPath + '/', ''));
            const sourceFile = this.project.getSourceFile(fileName);
            const result = ts.transform(sourceFile, [angularDeclarationsTransformer]);
            const transformed = this.printer.printFile(result.transformed[0]);
            this.project.updateSourceFile(fileName, transformed);

            if (this.options.addImports) {
                this.resolveImports(fileName);
                this.organizeImports(fileName);
            }
        }

        if (this.filesWithErrors.size > 0) {
            Logger.warn('Manual cleanup is required for the following files:');
            this.filesWithErrors.forEach(fileName => {
                Logger.warn(' ->', fileName.replace(this.tsPath + '/', ''));
            });
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

        let hasUnresolvedErrors = false;
        semanticDiagnostics.forEach(diag => {
            // code 2304 is when typescript cannot find "name"
            if (diag.code === 2304) {
                const fixes = this.project.getCodeFixes(fileName, diag);
                // We only apply fixes if there is exactly one option, It's better not to apply fix than to apply wrong fix.
                if (fixes.length && fixes.length === 1) {
                    const cleanedChanges = this.cleanImportChanges(fileName, fixes[0].changes[0].textChanges);
                    text = applyTextChanges(text, cleanedChanges);
                } else {
                    hasUnresolvedErrors = true;
                }
            }
        });

        if (text && text.length) {
            if (hasUnresolvedErrors) {
                this.filesWithErrors.add(fileName);
            } else {
                this.filesWithErrors.delete(fileName);
            }
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

    private createTsConfig(): void {
        const relativePathToRepoRoot = '../../..';
        const dependencies = this.cplaceModule.getDependencies();

        let paths = {};
        let refs = [];

        dependencies.forEach((dep) => {
            const module = this.allModules.get(dep);
            if (!module.hasTsAssets()) {
                return;
            }

            const relPathToModule = module.repo === this.cplaceModule.repo
                ? relativePathToRepoRoot
                : path.join(relativePathToRepoRoot, '..', module.repo);

            let relPath = path.join(relPathToModule, `${dep}/assets/ts`);
            paths[`@${dep}/*`] = [relPath + '/*'];
            refs.push({
                path: relPath
            });
        });

        if (this.cplaceModule.isInSubRepo) {
            paths = {
                ...paths,
                '*': [
                    '*',
                    `${relativePathToRepoRoot}/../main/node_modules/@types/*`
                ]
            };
        }

        const tsconfig: any = {
            extends: path.join(relativePathToRepoRoot, this.relativeRepoPathToMain, 'tsconfig.base.json'),
            compilerOptions: {
                rootDir: '.',
                baseUrl: '.',
                outDir: '../generated_js',
            },
            include: ['./**/*.ts']
        };

        if (this.cplaceModule.pluginName !== PLATFORM_PLUGIN) {
            tsconfig.compilerOptions.paths = paths;
            tsconfig.references = refs;
        }

        const tsconfigPath = path.join(this.tsPath, 'tsconfig.json');
        saveFile(tsconfigPath, JSON.stringify(tsconfig, null, 4));
    }

    private cleanImportChanges(fileName: string, textChanges: ts.TextChange[]): ts.TextChange[] {
        return textChanges.map(tc => {
            const tcCopy = {...tc};
            const match = RefactorPlugin.IMPORT_FROM_REGEX.exec(tc.newText);
            if (match !== null) {
                const fromPath = match[2];
                const newRelativePath = this.tryResolveRelativeImport(fileName, fromPath);
                if (newRelativePath !== null) {
                    tcCopy.newText = `import ${match[1]} from '${newRelativePath}';\n\n`;
                }
            }
            return tcCopy;
        });
    }

    private tryResolveRelativeImport(fileName: string, fromPath: string): string | null {
        const resolvedFromPath = path.resolve(fromPath);
        const moduleTsPath = path.resolve(this.cplaceModule.assetsPath, 'ts');

        if (resolvedFromPath.indexOf(moduleTsPath) !== 0) {
            return null;
        }

        let commonDirectory = path.dirname(fileName);
        let prefix = '';
        while (resolvedFromPath.indexOf(commonDirectory) !== 0) {
            prefix = path.join('..', prefix);
            commonDirectory = path.resolve(prefix, commonDirectory);
            if (moduleTsPath === commonDirectory) {
                break;
            }
        }

        if (resolvedFromPath.indexOf(commonDirectory) === 0) {
            const relativePathRemaining = resolvedFromPath.substring(commonDirectory.length);
            return './' + path.join('.', prefix, relativePathRemaining);
        } else {
            return null;
        }
    }
}
