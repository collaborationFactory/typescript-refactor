import * as path from "path";
import {availableModules, config} from './config';
import {ImlParser} from './iml-parser';
import * as fs from "fs";

export default class CplaceIJModule {
    public readonly tsConfigPath: string;
    public readonly assetsPath: string;
    public readonly moduleName: string;
    private refactored: boolean;
    private readonly dependencies: string[] = [];

    constructor(moduleName: string) {
        this.moduleName = moduleName;
        this.assetsPath = path.join(config.mainRepoPath, this.moduleName, 'assets');
        this.tsConfigPath = path.join(this.assetsPath, 'tsconfig.json');
        this.refactored = this.checkTsconfig();
        this.dependencies = this.findDependenciesWithTs();
    }

    allDependenciesAlreadyRefactored() {
        for(let i = 0; i < this.dependencies.length; i++) {
            const dependency = availableModules.get(this.dependencies[i]);
            if(!dependency.isRefactored()) {
                return false;
            }
        }

        return true;
    }

    getDependencies() {
        return this.dependencies;
    }

    isRefactored() {
        return this.refactored;
    }

    setRefactored() {
        this.refactored = true;
    }

    private findDependenciesWithTs() {
        let imlPath = path.join(config.mainRepoPath, this.moduleName, `${this.moduleName}.iml`);
        let referencedModules = new ImlParser(imlPath).getReferencedModules();
        return referencedModules.filter((module) => config.plugins.indexOf(module) > -1);
    }

    /**
     * we assume a plugin to be refactored is tsconfig.json is present in assets folder
     */
    private checkTsconfig() {
        return fs.existsSync(this.tsConfigPath);
    }
}