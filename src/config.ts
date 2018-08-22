/**
 * Creates a global config object
 */

import * as fs from 'fs';
import * as path from 'path';
import {getLogger} from './logger';

export interface IConfig {
    isSubRepo: boolean;
    mainRepoPath: string;
    platformPath: string;
    plugins: string[];

    verbose: boolean;
    addImports: true;
    addExports: true;
    createModuleFiles: true;
}

export const PLATFORM_PLUGIN = 'cf.cplace.platform';

/**
 * This config will be used throughout the script
 */
export let config: IConfig = {} as IConfig;

export function detectAndGenerateConfig(commandLineOptions: any): IConfig {
    const currentDir = process.cwd();

    config.verbose = commandLineOptions.verbose;
    config.addExports = commandLineOptions.addExports;
    config.addImports = commandLineOptions.addImports;
    config.createModuleFiles = commandLineOptions.createModuleFiles;

    let error = false;
    let potentialPlatformDirectory = path.join(currentDir, PLATFORM_PLUGIN);
    if (path.basename(currentDir) === 'main' && fs.lstatSync(potentialPlatformDirectory).isDirectory()) {
        config.isSubRepo = false;
        config.mainRepoPath = currentDir;
        config.platformPath = potentialPlatformDirectory;
    } else if (fs.existsSync(path.join(currentDir, '/parent-repos.json'))) {
        config.isSubRepo = true;
        const potentialMainDirectory = path.join(currentDir, '..', 'main');
        potentialPlatformDirectory = path.join(potentialMainDirectory, PLATFORM_PLUGIN);
        if (fs.lstatSync(potentialPlatformDirectory).isDirectory()) {
            config.mainRepoPath = potentialMainDirectory;
            config.platformPath = potentialPlatformDirectory;
        } else {
            error = true;
        }
    } else {
        error = true;
    }
    if (error) {
        getLogger().fatal('Could not determine path to main repository. Make sure the script is running from either root of "main" repo or from the root of subrepo');
    }

    if (commandLineOptions.plugins && commandLineOptions.plugins.length) {
        config.plugins = commandLineOptions.plugins;
    } else {
        config.plugins = getPluginInRepo(currentDir);
    }

    return config;
}

function getPluginInRepo(repoPath: string): string[] {
    const plugins = [];
    const files = fs.readdirSync(repoPath);
    files.forEach(file => {
        const filePath = path.join(repoPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            const potentialPluginName = path.basename(file);
            if (potentialPluginName !== PLATFORM_PLUGIN && fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`))) {
                plugins.push(potentialPluginName);
            }
        }
    });

    return plugins;
}