import * as path from "path";
import {ImlParser} from './iml-parser';
import * as fs from "fs";

export default class CplaceIJModule {
    public readonly assetsPath: string;
    private readonly dependencies: string[];

    private refactored: boolean;

    constructor(public readonly moduleName: string,
                public readonly isSubRepo: boolean,
                private readonly isLocalDependency: (moduleName: string) => boolean) {
        this.assetsPath = path.join(process.cwd(), this.moduleName, 'assets');
        this.refactored = this.checkTsconfig();
        this.dependencies = this.findDependenciesWithTs();
    }

    allDependenciesAlreadyRefactored(availableModules: Map<string, CplaceIJModule>) {
        for (let i = 0; i < this.dependencies.length; i++) {
            const dependency = availableModules.get(this.dependencies[i]);
            if (!dependency.isRefactored()) {
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
        let imlPath = path.join(process.cwd(), this.moduleName, `${this.moduleName}.iml`);
        let referencedModules = new ImlParser(imlPath).getReferencedModules();
        return referencedModules.filter((moduleName) => this.isLocalDependency(moduleName));
    }

    /**
     * we assume a plugin to be refactored is tsconfig.json is present in assets folder
     */
    private checkTsconfig() {
        return fs.existsSync(path.join(this.assetsPath, 'tsconfig.json'));
    }
}
