export interface AngularDeclaration {
    module: string;
    types: {
        [type: string]: Array<string>;
    }
}

export interface FileMetaData {
    ngDeclaration: Array<AngularDeclaration>;
    references: Set<string>;
    moduleName: string;
}

interface propertyMap {
    filename: string;
    module: string;
}

export let moduleIdentifier = {
    name: ''
};

export let platformModuleNames: Set<string> = new Set<string>();

export let fileData: Map<string, FileMetaData> = new Map();

export let references: Map<string, Set<string>> = new Map();

export let _modules: Set<string> = new Set();

export interface IFileData {
    data: string;
    refactorInfo: FileMetaData;
}
