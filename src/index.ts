#!/usr/bin/env node
/**
 *  Module entry point
 */

import Refactor from './Refactor';
import {detectAndGenerateConfig, IConfig} from './config';
import {Logger} from './logger';

(() => {
    const argv = process.argv;
    const configJSON: IConfig = {
        plugins: [],
        verbose: false,
        addImports: true,
        addExports: true,
        createModuleFiles: true
    };

    if (argv[2] === '--help' || argv[2] === '?') {
        console.log('Script for refactoring cplace typescript files\n');
        console.log('Available options:');
        console.log('   -verbose', '     Verbose logging');
        console.log('   -noModuleFiles ', '     Creates a file that defines angular module and all related functions(directives, controllers, ...)');
        console.log('   -noImports', '     Do not try to resolve reference error and add import statements if possible');
        console.log('   -noExports', '     Do not add export keyword to all top level functions, classes and interfaces of a refactored file');
        console.log('   -plugins cf.cplace.cp4p.planning,cf.cplace.training.extended', '     List of plugins to refactor');
        return;
    }

    for (let i = 2; i < argv.length; i++) {
        switch (argv[i]) {
            case '-verbose':
                configJSON.verbose = true;
                break;
            case '-plugins':
                const plugins = argv[i + 1].split(',');
                configJSON.plugins = plugins.map(value => value.trim());
                i++;
                break;
            case '-noModuleFiles':
                configJSON.createModuleFiles = false;
                break;
            case '-noImports':
                configJSON.addImports = false;
                break;
            case '-noExports':
                configJSON.addExports = false;
                break;
            default:
                Logger.warn('Unrecognised configuration flag ', argv[i], ' ...skipping');
        }
    }

    Logger.setVerboseLogging(configJSON.verbose);

    // configJSON.plugins = [new CplaceIJModule('cf.cplace.simpleBoard')];
    // configJSON.addExports = true;
    // configJSON.addImports = true;
    const config = detectAndGenerateConfig(configJSON);
    Logger.log('Running with configuration ', JSON.stringify(config, null, 4));

    new Refactor(config).start();

})();
