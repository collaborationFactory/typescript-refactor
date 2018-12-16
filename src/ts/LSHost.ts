import * as ts from 'typescript';
import CplaceIJModule from '../CplaceIJModule';
import * as path from 'path';
import {Logger} from '../logger';


export class LSHost implements ts.LanguageServiceHost {

    parsedConfig: ts.ParsedCommandLine;
    files: {
        [name: string]: {
            version: number;
            snapshot: ts.IScriptSnapshot
        }
    } = {};

    /**
     * Requires path of the typescript project. Provided folder should contain tsconfig.json
     * @param {string} path
     * @param additionalFiles
     */
    constructor(public path: string, private additionalFiles: string[] = []) {
        if (!this.path.endsWith('/')) {
            this.path = this.path + '/';
        }

        const resolvedEsLib = require.resolve('typescript/lib/lib.es2016.full.d.ts');
        if (this.additionalFiles.indexOf(resolvedEsLib) === -1) {
            // this.additionalFiles.push(resolvedEsLib);
        }

        this.parseConfigFile();
    }

    addSourceFilesFromPlugin(plugin: CplaceIJModule): void {
        if (!plugin.hasTsAssets()) {
            return;
        }
        const tsPath = path.resolve(plugin.assetsPath, 'ts');
        const files = this.readDirectory(tsPath, ['ts'], ['*.js']);
        if (files && files.length) {
            Logger.debug('... Added all source files from', plugin.pluginName);
            this.additionalFiles = this.additionalFiles.concat(files);
        }
    }

    getCompilationSettings() {
        return this.parsedConfig.options;
    };

    getScriptFileNames() {
        let files = [];
        if (this.additionalFiles && this.additionalFiles.length) {
            files = this.additionalFiles;
        }
        return files.concat(this.parsedConfig.fileNames);
    }

    getOriginalFileNames() {
        return this.parsedConfig.fileNames;
    }

    getScriptVersion(fileName: string) {
        if (this.files[fileName]) {
            return String(this.files[fileName].version);
        }

        return '0';
    }

    getScriptSnapshot(fileName: string) {
        if (this.files[fileName]) {
            return this.files[fileName].snapshot;
        } else {
            const text = ts.sys.readFile(fileName);

            this.files[fileName] = {
                version: 0,
                snapshot: typeof text === 'string' ? ts.ScriptSnapshot.fromString(text) : undefined
            };
        }

        return this.files[fileName].snapshot;
    }

    getCurrentDirectory() {
        return '';
    }

    getDefaultLibFileName(options: ts.CompilerOptions): string {
        return ts.getDefaultLibFilePath(options);
    }

    getProjectReferences() {
        return this.parsedConfig.projectReferences;
    }

    parseConfigFile() {
        const configFilePath = this.path + 'tsconfig.json';
        let readConfigFile = ts.readConfigFile(configFilePath, ts.sys.readFile);
        this.parsedConfig = ts.parseJsonConfigFileContent(readConfigFile.config, {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            fileExists: ts.sys.fileExists
        }, this.path, {}, configFilePath);

        return this.parsedConfig;
    }

    readDirectory = ts.sys.readDirectory;
    readFile = ts.sys.readFile;
    fileExists = ts.sys.fileExists;
}
