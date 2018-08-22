import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {config, PLATFORM_PLUGIN} from './config';
import RefactorPlugin from './RefactorPlugin';
import {Project} from './ts/Project';
import {LSHost} from './ts/LSHost';
import {saveFile} from './utils';
import {logger} from './logger';

export default class Refactor {
    private platformProject: Project;
    private currentDir: string;

    constructor() {
        this.currentDir = process.cwd();
    }

    public static typesAreInstalled(): boolean {
        // we can add more checks to be 100% sure
        return fs.existsSync(path.join(config.platformPath, 'assets', 'node_modules', '@types', 'angular', 'index.d.ts'));
    }

    public start() {
        const platformTsPath = path.join(config.platformPath, 'assets', 'ts');
        // We consider a plugin to be refactored if there is tsconfig.json present in assets/ts folder
        const isPlatformRefactored = fs.existsSync(path.join(platformTsPath, 'tsconfig.json'));
        if (config.isSubRepo && !isPlatformRefactored) {
            logger.fatal('Before refactoring sub-repos make sure that at least platform plugin in main repo is already refactored');
            process.exit();
            return;
        }

        if (!Refactor.typesAreInstalled()) {
            logger.fatal('To begin refactoring install required types in the platform plugin');
            process.exit();
            return;
        }

        // create base config files
        Refactor.createBaseConfigFiles();

        // first refactor platform
        if (isPlatformRefactored) {
            this.platformProject = new Project(new LSHost(platformTsPath));
        } else {
            this.platformProject = new RefactorPlugin(PLATFORM_PLUGIN).refactor();
        }

        for (let i = 0; i < config.plugins.length; i++) {
            new RefactorPlugin(config.plugins[i], this.platformProject).refactor();
        }
    }

    /**
     * We create two base configs
     * 1. tsconfig.settings.json - contains configuration that are common to all
     * 2. tsconfig.base.json - inherits from tsconfig.settings.json and contains configuration that applies to only plugins that depend on platform and/or others
     *
     */
    private static createBaseConfigFiles() {
        // for tsconfig.settings.json
        let settingsConfig = {
            compilerOptions: {
                experimentalDecorators: true,
                target: 'es5',
                outDir: '../generated_js',
                strict: true,
                // null and undefined are not assignable to concrete types
                strictNullChecks: false,
                // any type has to be declared it cannot be inferred
                noImplicitAny: false,
                // https://github.com/Microsoft/TypeScript/issues/19661
                strictFunctionTypes: false,
                composite: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true
            }
        };

        // for tsconfig.base.json
        const baseConfig = {
            extends: './tsconfig.settings.json',
            compilerOptions: {
                paths: {
                    '*': ['../../../cf.cplace.platform/assets/node_modules/@types/*'],
                    '@platform/*': ['../../../cf.cplace.platform/assets/ts/*']
                }
            },
            references: [{
                path: '../../../cf.cplace.platform/assets/ts'
            }]
        };

        const settingsConfigFile = path.join(config.mainRepoPath, 'tsconfig.settings.json');
        saveFile(settingsConfigFile, JSON.stringify(settingsConfig, null, 4));

        const baseConfigFile = path.join(config.mainRepoPath, 'tsconfig.base.json');
        saveFile(baseConfigFile, JSON.stringify(baseConfig, null, 4));
    }
}