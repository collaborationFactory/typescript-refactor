/**
 * Exports a global object that will be used to store meta data of plugins
 */

import {INgDeclarations} from './model';

export let metaData: MetaData;

interface INgModuleInfo {
    fileName: string;
    tsModuleName: string;
    identifier: string;
}

class MetaData {

    /**
     * A map of angular module name to variable identifiers
     *
     * eg.
     * // in /some/absolute/path/app.ts
     * module cf.cplace.my {
     *      let MODULE = angular.module('my.module', []);
     * }
     * Then map will contain
     *  {
     *      'my.module': {
     *          fileName: '/some/absolute/path/app.ts',
     *          tsModule: 'cf.cplace.my'
     *          identifier: MODULE
     *
     *      }
     * }
     */
    private ngModuleToInfo: Map<string, INgModuleInfo> = new Map<string, INgModuleInfo>();

    // angular module to angular declarations
    private ngDeclarations: Map<string, INgDeclarations> = new Map<string, INgDeclarations>();

    constructor(private plugin: string) {
    }

    public addNgModuleIdentifier(moduleName: string, fileName: string, tsModuleName: string, identifier?: string): void {
        const info = {fileName, tsModuleName, identifier};
        this.ngModuleToInfo.set(moduleName, info);
    }

    /**
     * If tsModuleName is provided then the it is also checked else only identifier is checked
     *
     * @param identifier
     * @param tsModuleName
     */
    public getNgModuleForIdentifier(identifier: string, tsModuleName?: string): string {
        for (const [module, info] of this.ngModuleToInfo) {
            if (tsModuleName) {
                if (info.identifier === identifier && info.tsModuleName === tsModuleName) {
                    return module;
                }
            } else {
                if (info.identifier === identifier) {
                    return module;
                }
            }
        }

        return null;
    }

    public addNgDeclaration(moduleName: string, declarations: INgDeclarations): void {
        const curDeclarations = this.ngDeclarations.get(moduleName);
        if (curDeclarations) {
            Object.keys(declarations).forEach(declarationsKey => {
                if (curDeclarations[declarationsKey]) {
                    curDeclarations[declarationsKey] = curDeclarations[declarationsKey].concat(declarations[declarationsKey]);
                } else {
                    curDeclarations[declarationsKey] = declarations[declarationsKey];
                }
            });
            this.ngDeclarations.set(moduleName, curDeclarations);
        } else {
            this.ngDeclarations.set(moduleName, declarations);
        }
    }

    public getNgModuleInfo(): Map<string, INgModuleInfo> {
        return this.ngModuleToInfo;
    }

    public getDeclarationsForModule(moduleName: string): INgDeclarations {
        return this.ngDeclarations.get(moduleName);
    }
}

export function initMetaData(plugin: string): void {
    metaData = new MetaData(plugin);
}
