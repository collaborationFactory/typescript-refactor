/**
 * Global interfaces and data structures
 */

export interface IAngularDeclaration {
    ngModule: string;
    declarations: INgDeclarations;
}

export interface INgDeclarations {
    [declarationType: string]: Array<{
        name: string;
        func: string;
    }>;
}

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
