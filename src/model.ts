export interface AngularDeclaration {
    module: string;
    types: {
        [type: string]: Array<string>;
    }
}

interface FileMetaData {
    ngDeclaration: Array<AngularDeclaration>;
    references: Set<string>;
    moduleName: string;
}

interface propertyMap {
    filename: string;
    module: string;
}

export let fileData: Map<string, FileMetaData> = new Map();

export let references: Map<string, Set<string>> = new Map();

export let _modules: Set<string> = new Set();

export interface IFileData {
    data: string;
    refactorInfo: FileMetaData;
}
