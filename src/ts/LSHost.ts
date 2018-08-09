import * as ts from 'typescript';


export class LSHost implements ts.LanguageServiceHost {

    parsedConfig: ts.ParsedCommandLine;

    fileVersions = new Map<string, string>();

    /**
     * Requires path of the typescript project. Provided folder should contain tsconfig.json
     * @param {string} path
     * @param additionalFiles
     */
    constructor(public path: string, private additionalFiles?: string[]) {
        if (!this.path.endsWith('/')) {
            this.path = this.path + '/';
        }
        this.parseConfigFile();
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

    getOrigialFileNames() {
        return this.parsedConfig.fileNames;
    }

    getScriptVersion(fileName: string) {
        if (!this.fileVersions.has(fileName)) {
            this.fileVersions.set(fileName, '0');
        }
        return this.fileVersions.get(fileName);
    }

    getScriptSnapshot(fileName: string) {
        if (!ts.sys.fileExists(fileName)) {
            return undefined;
        }
        return ts.ScriptSnapshot.fromString(ts.sys.readFile(fileName).toString());
    }

    getCurrentDirectory() {
        return '';
    }

    getDefaultLibFileName(options: ts.CompilerOptions): string {
        return ts.getDefaultLibFileName(options);
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
}