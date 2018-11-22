import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {availableModules, config, PLATFORM_PLUGIN} from './config';
import RefactorPlugin from './RefactorPlugin';
import {TSProject} from './ts/TSProject';
import {LSHost} from './ts/LSHost';
import {saveFile} from './utils';
import {Logger} from './logger';
import CplaceIJModule from './CplaceIJModule';

export default class Refactor {
    private platformProject: TSProject;

    constructor() {
    }

    public static typesAreInstalled(): boolean {
        // we can add more checks to be 100% sure
        return fs.existsSync(path.join(config.mainRepoPath, 'node_modules', '@types', 'angular', 'index.d.ts'));
    }

    public start() {
        const platformTsPath = path.join(config.platformPath, 'assets', 'ts');
        // We consider a plugin to be refactored if there is tsconfig.json present in assets/ts folder
        let isPlatformRefactored = fs.existsSync(path.join(platformTsPath, 'tsconfig.json'));
        isPlatformRefactored = false;
        if (config.isSubRepo && !isPlatformRefactored) {
            Logger.fatal('Before refactoring sub-repos make sure that at least platform plugin in main repo is already refactored');
            process.exit();
            return;
        }


        if (!Refactor.typesAreInstalled()) {
            Logger.fatal('To begin refactoring install required types in the platform plugin');
            process.exit();
            return;
        }

        // create base config files
        // Refactor.createBaseConfigFiles();

        for (let plugin of availableModules.values()) {
            this.refactorPlugin(plugin);
        }

    }

    refactorPlugin(plugin: CplaceIJModule) {
        if (!plugin.allDependenciesAlreadyRefactored()) {
            const dependencies = plugin.getDependencies();
            dependencies.forEach((dep) => {
                this.refactorPlugin(availableModules.get(dep));
            })
        }

        if (!plugin.isRefactored()) {
            new RefactorPlugin(plugin).refactor();
        }
    }

    /**
     * We create two base configs
     * 1. tsconfig.settings.json - contains configuration that are common to all
     * 2. tsconfig.base.json - inherits from tsconfig.settings.json and contains configuration that applies to only plugins that depend on platform and/or others
     *
     */
    private static createBaseConfigFiles() {
        // for tsconfig.base.json
        let settingsConfig = {
            compilerOptions: {
                experimentalDecorators: true,
                target: 'es5',
                strict: true,
                // null and undefined are not assignable to concrete types
                strictNullChecks: false,
                // any type has to be declared it cannot be inferred
                noImplicitAny: false,
                // https://github.com/Microsoft/TypeScript/issues/19661
                strictFunctionTypes: false,
                noImplicitThis: false,
                composite: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                typeRoots: ["./node_modules/@types", "./cf.cplace.platform/assets/@cplaceTypes"]

            }
        };

        const settingsConfigFile = path.join(config.mainRepoPath, 'tsconfig.base.json');
        saveFile(settingsConfigFile, JSON.stringify(settingsConfig, null, 4));
    }

    getDependencies() {

    }
}


