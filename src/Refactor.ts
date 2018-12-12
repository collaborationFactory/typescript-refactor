import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import RefactorPlugin from './RefactorPlugin';
import {Logger} from './logger';
import CplaceIJModule from './CplaceIJModule';
import {IConfig} from './config';

export default class Refactor {
    private readonly availableModules = new Map<string, CplaceIJModule>();

    constructor(private readonly config: IConfig) {
    }

    public start() {
        this.config.plugins.forEach(pluginName => {
            const module = new CplaceIJModule(pluginName, moduleName => this.config.plugins.indexOf(moduleName) > -1);
            this.availableModules.set(pluginName, module);
        });

        const platformTsPath = path.join(this.config.platformPath, 'assets', 'ts');
        // We consider a plugin to be refactored if there is tsconfig.json present in assets/ts folder
        let isPlatformRefactored = fs.existsSync(path.join(platformTsPath, 'tsconfig.json'));
        if (this.config.isSubRepo && !isPlatformRefactored) {
            Logger.fatal('Before refactoring sub-repos make sure that at least platform plugin in main repo is already refactored');
            process.exit();
            return;
        }


        if (!this.typesAreInstalled()) {
            Logger.fatal('To begin refactoring install required types in the platform plugin');
            process.exit();
            return;
        }

        // create base config files
        // Refactor.createBaseConfigFiles();

        for (let plugin of this.availableModules.values()) {
            this.refactorPlugin(plugin);
        }

    }

    private refactorPlugin(plugin: CplaceIJModule) {
        if (!plugin.allDependenciesAlreadyRefactored(this.availableModules)) {
            const dependencies = plugin.getDependencies();
            dependencies.forEach((dep) => {
                this.refactorPlugin(this.availableModules.get(dep));
            })
        }

        if (!plugin.isRefactored()) {
            new RefactorPlugin(plugin).refactor();
        }
    }

    private typesAreInstalled(): boolean {
        // we can add more checks to be 100% sure
        return fs.existsSync(path.join(this.config.mainRepoPath, 'node_modules', '@types', 'angular', 'index.d.ts'));
    }

    /**
     * We create two base configs
     * 1. tsconfig.settings.json - contains configuration that are common to all
     * 2. tsconfig.base.json - inherits from tsconfig.settings.json and contains configuration that applies to only plugins that depend on platform and/or others
     *
     */
    // private static createBaseConfigFiles() {
    //     // for tsconfig.base.json
    //     let settingsConfig = {
    //         compilerOptions: {
    //             experimentalDecorators: true,
    //             target: 'es5',
    //             strict: true,
    //             // null and undefined are not assignable to concrete types
    //             strictNullChecks: false,
    //             // any type has to be declared it cannot be inferred
    //             noImplicitAny: false,
    //             // https://github.com/Microsoft/TypeScript/issues/19661
    //             strictFunctionTypes: false,
    //             noImplicitThis: false,
    //             composite: true,
    //             declaration: true,
    //             declarationMap: true,
    //             sourceMap: true,
    //             typeRoots: ["./node_modules/@types", "./cf.cplace.platform/assets/@cplaceTypes"]
    //
    //         }
    //     };
    //
    //     const settingsConfigFile = path.join(this.config.mainRepoPath, 'tsconfig.base.json');
    //     saveFile(settingsConfigFile, JSON.stringify(settingsConfig, null, 4));
    // }
}


