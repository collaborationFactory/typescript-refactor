export interface AngularDeclaration {
    module: string;
    declarations: NgDeclarations;
}

export interface NgDeclarations {
    [type: string]: Array<{
        name: string;
        function: string;
    }>;
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


export let moduleIdentifier = {
    name: ''
};

/**
 * A map of variable identifiers to angular module name
 *
 * let MODULE = angular.module('my.module', []);
 *
 * Then map will contain
 *  {
 *      MODULE: 'my.module'
 *  }
 *
 */
export let ngModuleIdentifier: { [identifier: string]: string } = {};

export let platformModuleNames: Set<string> = new Set<string>();

export let fileData: Map<string, FileMetaData> = new Map();

export let references: Map<string, Set<string>> = new Map();

export interface IFileData {
    data: string;
    refactorInfo: FileMetaData;
}
