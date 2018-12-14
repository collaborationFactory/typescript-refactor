/**
 * Creates a global config object
 */

import * as fs from 'fs';
import * as path from 'path';
import {Logger} from './logger';

export const PLATFORM_PLUGIN = 'cf.cplace.platform';

export interface IConfig {
    isSubRepo?: boolean;
    mainRepoPath?: string;
    platformPath?: string;
    plugins: string[];

    verbose: boolean;
    addImports: boolean;
    addExports: boolean;
    createModuleFiles: boolean;
}

export function detectAndGenerateConfig(commandLineOptions: IConfig): IConfig {
    const config: IConfig = {...commandLineOptions};

    const currentDir = process.cwd();
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
        Logger.fatal('Could not determine path to main repository. Make sure the script is running from either root of "main" repo or from the root of subrepo');
        process.exit();
        return;
    }

    if (commandLineOptions.plugins && commandLineOptions.plugins.length) {
        config.plugins = commandLineOptions.plugins;
    } else {
        config.plugins = getPluginsInRepo(currentDir);
    }

    return config;
}

function getPluginsInRepo(repoPath: string): string[] {
    const plugins = [];
    const files = fs.readdirSync(repoPath);
    files.forEach(file => {
        const filePath = path.join(repoPath, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            const potentialPluginName = path.basename(file);
            if (fs.existsSync(path.join(filePath, `${potentialPluginName}.iml`)) && fs.existsSync(path.join(filePath, 'assets', 'ts'))) {
                plugins.push(potentialPluginName);
            }
        }
    });

    return plugins;
}
