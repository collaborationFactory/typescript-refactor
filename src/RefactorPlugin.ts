import * as path from 'path';
import * as ts from 'typescript';
import {createModuleTransformer} from './transformer/moduleTransformer';
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
    private allPluginNames: string[];

    private prefixPathToGeneratedJsToPluginMapping: Map<string, string>;

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

        const pluginNames = new Set<string>();
        pluginNames.add(this.cplaceModule.pluginName);

        this.createTsConfig();
        const lsHost = new LSHost(this.tsPath, []);
        this.cplaceModule.getDependencies().forEach(depName => {
            const depPlugin = this.allModules.get(depName);
            lsHost.addSourceFilesFromPlugin(depPlugin);
            pluginNames.add(depName);
        });
        this.project = new TSProject(lsHost);
        this.allPluginNames = [...pluginNames.values()];
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
                Logger.debug('... [moduleTransformer]');
                const sourceFile = this.project.getSourceFile(file);
                if (sourceFile.isDeclarationFile) {
                    Logger.warn('... !! Please rewrite declaration files manually:', path.basename(sourceFile.fileName));
                    return;
                }

                if (this.shouldRefactor(sourceFile)) {
                    const result = ts.transform(
                        sourceFile,
                        [createModuleTransformer(this.allPluginNames)],
                        {addExportsToAll: this.options.addExports}
                    );
                    Logger.debug('... Transformed file');
                    const transformed = this.printer.printFile(result.transformed[0]);
                    Logger.debug('... Updating source file');
                    this.project.updateSourceFile(file, transformed);
                }

                if (this.options.addImports) {
                    Logger.debug('... Resolving imports');
                    this.resolveImports(file);
                    Logger.debug('... Organizing imports');
                    this.organizeImports(file);
                }
            } catch (e) {
                Logger.error(file, e);
            }
        });

        const ngModuleInfo = MetaData.get().getNgModuleInfo();

        for (let [module, info] of ngModuleInfo) {
            const fileName: string = info.fileName;
            if (fileName.indexOf(this.tsPath) !== 0) {
                Logger.debug(' -> ... skipping file outside project:', fileName);
                continue;
            }

            Logger.log(' ->', fileName.replace(this.tsPath + '/', ''));
            Logger.debug('... [angularDeclarationsTransformer]');
            const sourceFile = this.project.getSourceFile(fileName);
            const result = ts.transform(sourceFile, [angularDeclarationsTransformer]);
            Logger.debug('... Transformed file');
            const transformed = this.printer.printFile(result.transformed[0]);
            Logger.debug('... Updating source file');
            this.project.updateSourceFile(fileName, transformed);

            if (this.options.addImports) {
                Logger.debug('... Resolving imports');
                this.resolveImports(fileName);
                Logger.debug('... Organizing imports');
                this.organizeImports(fileName);
            }
        }

        if (this.options.addImports && this.filesWithErrors.size > 0) {
            Logger.log('Trying to stabilize missing imports...');
            let importsStable;
            let i = 1;
            do {
                Logger.log('... Stabilization run:', i);
                importsStable = true;
                const errorFiles = [...this.filesWithErrors.values()];
                for (const fileName of errorFiles) {
                    Logger.log(' ->', fileName.replace(this.tsPath + '/', ''));
                    Logger.debug('... Resolving imports again');
                    const changedImports = this.resolveImports(fileName);
                    if (changedImports) {
                        Logger.log('... Found new imports!');
                        importsStable = false;
                    }
                    this.organizeImports(fileName);
                }
                i += 1;
            } while (!importsStable);
        }

        // YaY!! All done. Save all files
        this.project.persist();

        if (this.filesWithErrors.size > 0) {
            Logger.warn('Manual cleanup is required for the following files:');
            this.filesWithErrors.forEach(fileName => {
                Logger.warn(' ->', fileName.replace(this.tsPath + '/', ''));
            });
        }
    }

    private resolveImports(fileName: string): boolean {
        const semanticDiagnostics = this.project.getSemanticDiagnostics(fileName);
        Logger.debug('... Got diagnostics:', semanticDiagnostics.length);

        let text: string;
        if (semanticDiagnostics.length) {
            text = this.project.getCurrentContents(fileName);
        }

        let changedImports = false;
        let hasUnresolvedErrors = false;
        semanticDiagnostics.forEach((diag: ts.Diagnostic) => {
            // code 2304 is when typescript cannot find "name"
            if (diag.code === 2304) {
                const fixes = this.project.getCodeFixes(fileName, diag);
                // We only apply fixes if there is exactly one option, It's better not to apply fix than to apply wrong fix.
                if (fixes.length && fixes.length === 1) {
                    Logger.debug('... Found a fix at start', diag.start);
                    const cleanedChanges = this.cleanImportChanges(fileName, fixes[0].changes[0].textChanges);
                    text = applyTextChanges(text, cleanedChanges);
                    changedImports = true;
                } else {
                    Logger.debug('... Found', fixes.length, 'fixes, message text:', diag.messageText);
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
        return changedImports;
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

        this.prefixPathToGeneratedJsToPluginMapping = new Map();
        dependencies.forEach((dep) => {
            const module = this.allModules.get(dep);
            if (!module.hasTsAssets()) {
                return;
            }

            const relPathToModuleRepo = module.repo === this.cplaceModule.repo
                ? relativePathToRepoRoot
                : path.join(relativePathToRepoRoot, '..', module.repo);

            let relPath = path.join(relPathToModuleRepo, `${dep}/assets/ts`);
            paths[`@${dep}/*`] = [relPath + '/*'];
            refs.push({
                path: relPath
            });
            this.prefixPathToGeneratedJsToPluginMapping.set(path.join(relPathToModuleRepo, dep, 'assets', 'generated_js'), dep);
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
        if (fromPath.startsWith('@')) {
            return null;
        }

        for (const [prefix, plugin] of this.prefixPathToGeneratedJsToPluginMapping.entries()) {
            if (fromPath.startsWith(prefix)) {
                return fromPath.replace(prefix, `@${plugin}`);
            }
        }

        const resolvedFromPath = path.resolve(fromPath);
        const moduleTsPath = path.resolve(this.cplaceModule.assetsPath, 'ts');

        if (!resolvedFromPath.startsWith(moduleTsPath)) {
            return null;
        }

        let commonDirectory = path.dirname(fileName);
        let prefix = '';
        while (!resolvedFromPath.startsWith(commonDirectory)) {
            prefix = path.join('..', prefix);
            commonDirectory = path.resolve(commonDirectory, prefix);
            if (moduleTsPath === commonDirectory) {
                break;
            }
        }

        if (resolvedFromPath.startsWith(commonDirectory)) {
            const relativePathRemaining = resolvedFromPath.substring(commonDirectory.length);
            let result = path.join('.', prefix, relativePathRemaining);
            result = result.replace(/\\/g, '/');
            if (result.startsWith('.')) {
                return result;
            } else {
                return './' + result;
            }
        } else {
            return null;
        }
    }
}
