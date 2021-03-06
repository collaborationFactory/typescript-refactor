import * as path from "path";
import {ImlParser} from './iml-parser';
import * as fs from "fs";

export default class CplaceIJModule {
    public readonly repo: string;
    public readonly isInSubRepo: boolean;
    public readonly assetsPath: string;
    private readonly dependencies: string[];

    private refactored: boolean | null = null;

    constructor(public readonly pluginName: string,
                public readonly pluginPath: string) {
        this.repo = path.basename(path.dirname(pluginPath));
        this.isInSubRepo = this.repo !== 'main';
        this.assetsPath = path.join(this.pluginPath, 'assets');
        this.dependencies = this.findDependencies();
    }

    hasTsAssets(): boolean {
        return fs.existsSync(path.join(this.assetsPath, 'ts'));
    }

    getDependencies() {
        return this.dependencies;
    }

    isRefactored() {
        if (this.refactored === null) {
            this.refactored = this.checkTsConfig();
        }
        return this.refactored;
    }

    setRefactored() {
        this.refactored = true;
    }

    private findDependencies() {
        let imlPath = path.join(this.pluginPath, `${this.pluginName}.iml`);
        return new ImlParser(imlPath).getReferencedModules();
    }

    /**
     * we assume a plugin to be refactored is tsconfig.json is present in assets folder
     */
    private checkTsConfig() {
        return fs.existsSync(path.resolve(this.assetsPath, 'ts', 'tsconfig.json'));
    }
}
