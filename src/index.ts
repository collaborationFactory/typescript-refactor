/**
 *  Module entry point
 */

import Refactor from './Refactor';
import {detectAndGenerateConfig} from './config';
import {logger} from './logger';

(() => {
    const argv = process.argv;
    const configJSON = {
        verbose: false,
        plugins: [],
        createModuleFiles: true,
        addImports: true,
        addExports: true
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
                logger.warn('Unrecognised configuration flag ', argv[i], ' ...skipping');
        }
    }

    if (configJSON.verbose) {
        logger.setLevel('all');
    }

    configJSON.plugins = ['cf.cplace.cp4p.planning'];
    configJSON.addExports = true;
    configJSON.addImports = true;

    const config = detectAndGenerateConfig(configJSON);
    logger.info('Running with configuration ', JSON.stringify(config, null, 4));

    new Refactor().start();

})();
