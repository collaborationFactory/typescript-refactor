import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import {log} from './index';
import {config} from './config';
import RefactorPlugin from './RefactorPlugin';
import {Project} from './ts/Project';
import {LSHost} from './ts/LSHost';

export default class RefactorCplaceTS {
    static PLATFORM_PLUGIN = 'cf.cplace.platform';
    private platformProject: Project;
    currentDir: string;

    constructor() {
        this.currentDir = process.cwd();
        this.start();
    }

    start() {
        const platformTsPath = path.join(config.platformPath, 'assets', 'ts');
        const isPlatformRefactored = fs.existsSync(path.join(platformTsPath, 'tsconfig.json'));
        if (config.isSubRepo && !isPlatformRefactored) {
            log.fatal('Before refactoring sub-repos make sure that at least platform plugin in main repo is already refactored');
            process.exit();
            return;
        }

        if (!this.typesAreInstalled()) {
            log.fatal('To begin refactoring install required types in the platform plugin');
            process.exit();
            return;
        }

        // first refactor platform
        if (isPlatformRefactored) {
            this.platformProject = new Project(new LSHost(platformTsPath));
        } else {
            this.platformProject = new RefactorPlugin(RefactorCplaceTS.PLATFORM_PLUGIN).refactor();
        }

        for (let i = 0; i < config.plugins.length; i++) {
            new RefactorPlugin(config.plugins[i], this.platformProject).refactor();
        }
    }

    /**
     * We consider a plugin to be refactored if there is tsconfig.json present in assets/ts folder
     */
    typesAreInstalled(): boolean {
        // we can add more checks to be 100% sure
        return fs.existsSync(path.join(config.platformPath, 'assets', 'node_modules', '@types', 'angular', 'index.d.ts'));
    }
}