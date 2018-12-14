/**
 * Exports a global object that will be used to store meta data of plugins
 */

import {INgDeclarations} from './model';

export interface INgModuleInfo {
    fileName: string;
    tsModuleName: string;
    identifier: string;
    varIdentifier: string;
}

export class MetaData {
    private static readonly INSTANCE = new MetaData();

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

    private constructor() {
    }

    public static get(): MetaData {
        return this.INSTANCE;
    }

    public addNgModuleIdentifier(moduleName: string, fileName: string, tsModuleName: string, identifier?: string, varIdentifier?: string): void {
        const info = {fileName, tsModuleName, identifier, varIdentifier};
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

    getNgModuleForVarIdentifier(varIdentifier: string, tsModuleName: string): string {
        for (const [module, info] of this.ngModuleToInfo) {
            if (tsModuleName) {
                if (info.varIdentifier === varIdentifier && info.tsModuleName === tsModuleName) {
                    return module;
                }
            } else {
                if (info.varIdentifier === varIdentifier) {
                    return module;
                }
            }
        }

        return null;
    }

    getNgModuleForFileNameAndVarIdentifier(fileName: string, varIdentifier: string): string {
        for (const [module, info] of this.ngModuleToInfo) {
            if (info.fileName === fileName && info.varIdentifier === varIdentifier) {
                return module;
            }
        }

        return null;

    }

    public addNgDeclaration(moduleName: string, declarations: INgDeclarations): void {
        if (!declarations) {
            return;
        }

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

    toString() {
        this.ngModuleToInfo.forEach((value, key) => {
            console.log(key, value);
        });

        this.ngDeclarations.forEach((value, key) => {
            console.log(key, value);
        });
    }

}
