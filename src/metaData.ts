import {NgDeclarations} from './model';

export let metaData: _MetaData;

interface ngModuleInfo {
    fileName: string;
    tsModuleName: string;
    identifier: string;
}

class _MetaData {

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
    private ngModuleToInfo: Map<string, ngModuleInfo> = new Map<string, ngModuleInfo>();

    // angular module to angular declarations
    private ngDeclarations: Map<string, NgDeclarations> = new Map<string, NgDeclarations>();

    constructor(private plugin: string) {
    }

    addNgModuleIdentifier(module: string, fileName: string, tsModuleName: string, identifier?: string) {
        let info = {
            fileName: fileName,
            tsModuleName: tsModuleName,
            identifier: identifier
        };

        this.ngModuleToInfo.set(module, info)
    }

    /**
     * If tsModuleName is provided then the it is also checked else only identifier is checked
     *
     * @param identifier
     * @param tsModuleName
     */
    getNgModuleForIdentifier(identifier: string, tsModuleName?: string): string {
        for (let [module, info] of this.ngModuleToInfo) {
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

    addNgDeclaration(module: string, declarations: NgDeclarations) {
        let curDeclarations = this.ngDeclarations.get(module);
        if (curDeclarations) {
            for (let declarationsKey in declarations) {
                if (curDeclarations[declarationsKey]) {
                    curDeclarations[declarationsKey] = curDeclarations[declarationsKey].concat(declarations[declarationsKey]);
                } else {
                    curDeclarations[declarationsKey] = declarations[declarationsKey];
                }
            }
            this.ngDeclarations.set(module, curDeclarations)
        } else {
            this.ngDeclarations.set(module, declarations);
        }
    }

    getNgDeclarations(module: string) {

    }

    getAllNgDeclarations() {
    }


    toString() {
        console.log(this.ngModuleToInfo);
        console.log(this.ngDeclarations);
    }
}


export function initMetaData(plugin) {
    metaData = new _MetaData(plugin);
}

