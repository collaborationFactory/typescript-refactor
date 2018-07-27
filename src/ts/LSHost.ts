import * as ts from 'typescript';


export class LSHost implements ts.LanguageServiceHost {

    parsedConfig: ts.ParsedCommandLine;

    /**
     * Requires path of the typescript project. Provided folder should contain tsconfig.json
     * @param {string} path
     */
    constructor(public path: string) {
        if (this.path.endsWith('/')) {
            this.path = this.path.slice(0, -1);
        }
        this.parseConfigFile();
    }

    getCompilationSettings() {
        return this.parsedConfig.options;
    };

    getScriptFileNames() {
        return this.parsedConfig.fileNames;
    }

    getScriptVersion(fileName: string) {
        return '0';
    }

    getScriptSnapshot(fileName: string) {
        return undefined;
    }

    getCurrentDirectory() {
        return "";
    }

    getDefaultLibFileName(options: ts.CompilerOptions): string {
        return ts.getDefaultLibFileName(options);
    }


    parseConfigFile() {
        let readConfigFile = ts.readConfigFile(this.path + '/tsconfig.json', ts.sys.readFile);
        this.parsedConfig = ts.parseJsonConfigFileContent(readConfigFile.config, {
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            readDirectory: ts.sys.readDirectory,
            readFile: ts.sys.readFile,
            fileExists: ts.sys.fileExists
        }, this.path);

    }

}