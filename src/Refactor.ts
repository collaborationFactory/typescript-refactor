import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import RefactorPlugin from './RefactorPlugin';
import {Logger} from './logger';
import CplaceIJModule from './CplaceIJModule';
import {IConfig} from './config';

export default class Refactor {
    private readonly availableModules = new Map<string, CplaceIJModule>();
    private readonly relativePathToMain: string;

    constructor(private readonly config: IConfig) {
        this.relativePathToMain = this.config.isSubRepo ? '../main' : '';
    }

    public start() {
        this.config.plugins.forEach(pluginName => {
            const module = new CplaceIJModule(
                pluginName, path.join(process.cwd(), pluginName)
            );
            this.availableModules.set(pluginName, module);
            this.resolveDependencies(module);
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

        for (const plugin of this.availableModules.values()) {
            if (plugin.repo === this.config.repo) {
                this.refactorPlugin(plugin);
            }
        }

    }

    private refactorPlugin(plugin: CplaceIJModule): void {
        if (!plugin.hasTsAssets()) {
            return;
        }
        plugin.getDependencies()
            .map(d => this.availableModules.get(d))
            .filter(dep => dep.hasTsAssets() && !dep.isRefactored())
            .forEach(dep => this.refactorPlugin(dep));

        if (!plugin.isRefactored()) {
            const pluginRefactor = new RefactorPlugin(
                plugin, this.relativePathToMain, this.availableModules,
                {
                    addImports: this.config.addImports,
                    addExports: this.config.addExports
                }
            );
            pluginRefactor.prepareFiles();
            pluginRefactor.refactor();
        }
    }

    private typesAreInstalled(): boolean {
        // we can add more checks to be 100% sure
        return fs.existsSync(path.join(this.config.mainRepoPath, 'node_modules', '@types', 'angular', 'index.d.ts'));
    }

    private resolveDependencies(module: CplaceIJModule): void {
        module.getDependencies().forEach(depName => {
            if (this.availableModules.has(depName)) {
                return;
            }

            const depPath = this.resolveModulePath(depName);
            const dep = new CplaceIJModule(depName, depPath);
            this.availableModules.set(depName, dep);
            this.resolveDependencies(dep);
        });
    }

    private resolveModulePath(moduleName: string): string {
        let modulePath = path.resolve(process.cwd(), moduleName);
        if (fs.existsSync(modulePath)) {
            return modulePath;
        }

        for (const repoDep of this.config.repoDependencies) {
            modulePath = path.resolve(process.cwd(), '..', repoDep, moduleName);
            if (fs.existsSync(modulePath)) {
                return modulePath;
            }
        }
        Logger.error('Could not resolve plugin', moduleName);
        process.exit(1);
    }
}


