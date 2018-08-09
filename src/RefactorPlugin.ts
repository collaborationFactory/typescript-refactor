import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {moduleTransformer} from './transformer/moduleTransformer';
import {config} from './config';
import {IFileData} from './model';
import {applyTextChanges, copyFolderRecursiveSync, ensureDirExists, saveFile} from './utils';
import {Project} from './ts/Project';
import {LSHost} from './ts/LSHost';

export default class RefactorPlugin {
    private readonly tsPath: string;
    private project: Project;
    files: Map<string, IFileData>;
    printer: ts.Printer;

    constructor(private plugin: string, private readonly platformProject?: Project) {
        this.tsPath = path.join(config.mainRepoPath, plugin, 'assets', 'ts');

        this.printer = ts.createPrinter({
            removeComments: false,
        });

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
        console.log(this.project.host.getScriptFileNames());

        let projectFiles = this.project.getProjectFiles();
        // console.log(projectFiles);

        projectFiles.forEach(file => {
            console.log(file);
            const sourceFile = this.project.getSourceFile(file);
            if (sourceFile.isDeclarationFile) {
                return;
            }
            if (this.shouldRefactor(sourceFile)) {
                const result = ts.transform(sourceFile, [moduleTransformer], {addExportsToAll: config.addExports});
                const transformed = this.printer.printFile(result.transformed[0]);
                this.project.updateSourceFile(file, ts.ScriptSnapshot.fromString(transformed));
            }

            if (config.addImports) {
                this.resolveImports(file);
                this.organizeImports(file);
            }
        });

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
            this.project.updateSourceFile(fileName, ts.ScriptSnapshot.fromString(text));

        }
    }

    organizeImports(fileName: string) {
        const importOrganizeChanges = this.project.getImportOrganizeChanges(fileName);

        if (importOrganizeChanges && importOrganizeChanges.length) {
            let text = this.project.getCurrentContents(fileName);
            text = applyTextChanges(text, importOrganizeChanges[0].textChanges);
            this.project.updateSourceFile(fileName, ts.ScriptSnapshot.fromString(text));
        }
    }


    getFiles(): Map<string, IFileData> {
        let tscom = fs.readFileSync(this.tsPath + '/tscommand.txt', 'utf8');
        let files = new Map<string, IFileData>();
        tscom.split('\n')
            .filter((val) => {
                val = val.trim();
                return (val && val.endsWith('.ts'));
            })
            .forEach((val) => {
                const path = this.tsPath + '/' + val;
                files.set(path, {
                    data: fs.readFileSync(path, 'utf8'),
                    refactorInfo: null
                });
            });
        return files;
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
            // console.log(ts.SyntaxKind[node.kind]);
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                return refactor = true;
            }
        });
        return refactor;
    }

    createConfigFile() {
        const paths = {
            '*': ['../../../cf.cplace.platform/assets/node_modules/@types/*'],
            '@platform/*': ['../../../cf.cplace.platform/assets/ts/*']
        };

        const references = [
            {
                path: '../../../cf.cplace.platform/assets/ts'
            }
        ];

        let config = {
            'compilerOptions': {
                'baseUrl': '.',
                'rootDir': '.',
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

        if (this.plugin !== 'cf.cplace.platform') {
            config.compilerOptions['paths'] = paths;
            config['references'] = references;
        } else {
            config.compilerOptions['composite'] = true;
        }
        const tsconfigPath = path.join(this.tsPath, 'tsconfig.json');
        saveFile(tsconfigPath, JSON.stringify(config, null, 4));
    }
}