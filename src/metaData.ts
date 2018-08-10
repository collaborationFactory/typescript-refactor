import {NgDeclarations} from './model';

export let metaData: _MetaData;

class _MetaData {

    /**
     * A map of variable identifiers to angular module name
     *
     * eg.
     * let MODULE = angular.module('my.module', []);
     * Then map will contain
     *  { MODULE: 'my.module'}
     *
     */
    private ngModuleIdentifiers: Map<string, string> = new Map<string, string>();
    // module to angular declarations
    private ngDeclarations: Map<string, NgDeclarations> = new Map<string, NgDeclarations>();

    constructor(private plugin: string) {
    }

    addNgModuleIdentifier(identifier: string, module: string) {
        this.ngModuleIdentifiers.set(identifier, module)
    }

    getNgModuleForIdentifier(identifier: string): string {
        return this.ngModuleIdentifiers.get(identifier);
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
}


export function initMetaData(plugin) {
    metaData = new _MetaData(plugin);
}

