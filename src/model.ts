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

// these are all the typescript module in platform plugin as of 20.08.2018
export let platformModuleNames: Set<string> = new Set<string>([
    'cf.cplace.platform',
    'cf.cplace.platform.utils',
    'cf.cplace.platform.apps',
    'cf.cplace.platform.ckEditor',
    'cf.cplace.platform.controllers',
    'cf.cplace.platform.controls',
    'cf.cplace.platform.controls.utils',
    'cf.cplace.platform.directives',
    'cf.cplace.platform.events',
    'cf.cplace.platform.flexigrid',
    'cf.cplace.platform.forms',
    'cf.cplace.platform.directives.fragmentedDiagram',
    'cf.cplace.platform.layoutControllers',
    'cf.cplace.platform.miscControllers',
    'cf.cplace.platform.search',
    'cf.cplace.platform.commonServices',
    'cf.cplace.platform.simpleTree',
    'cf.cplace.platform.tableUtils',
    'cf.cplace.platform.widgetConfiguration',
    'cf.cplace.platform.widgetControllers',
    'cf.cplace.platform.widgetLayout'
]);

export let fileData: Map<string, FileMetaData> = new Map();

export let references: Map<string, Set<string>> = new Map();

export interface IFileData {
    data: string;
    refactorInfo: FileMetaData;
}
