import Refactor from './refactor';
import * as fs from 'fs';
import {detectAndGenerateConfig} from './config';

export const log = require('simple-node-logger').createSimpleLogger();

(function () {
    // TODO: remove src from config path
    let argv = process.argv,
        configFile = process.cwd() + '/src/refactor.config',
        configJSON: any = {};


    if (argv[2] === '--help' || argv[2] === '?') {
        console.log('RefactorCplaceTS script for cplace typescript files\n');
        console.log('Available options:');
        console.log('   -verbose', '     Verbose logging');
        console.log('   -config /path/to/refactor.config', '     Absolute or relative path of config file. If absent, config file will be searched for in current directory.');
        console.log('   -noModuleFiles ', '     Creates a file that defines angular module and all related functions(directives, controllers, ...)');
        console.log('   -noImports', '     Do not try to resolve reference error and add import statements if possible');
        console.log('   -noExports', '     Do not add export keyword to all top level functions, classes and interfaces of a refactored file');
        console.log('   -plugins cf.cplace.cp4p.planning,cf.cplace.training.extended', '     List of plugins to refactor');

        return;
    }

    try {
        configJSON = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        log.info('Reading configuration from ', configFile);
    } catch(err) {
        if(err.code === 'ENOENT') {
            log.info('No config file found in path', process.cwd())
        } else {
            log.error('Error reading configuration from file ', configFile);
        }
        log.info('Using defaults');
        configJSON = {
            verbose: false,
            plugins: [],
            createModuleFiles: true,
            addImports: true,
            addExports: true
        };
    }

    for (let i = 2; i < argv.length; i++) {
        switch (argv[i]) {
            case '-verbose':
                configJSON.verbose = true;
                break;
            case '-plugins':
                let plugins = argv[i+1].split(',');
                configJSON.plugins = plugins;
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
                log.warn('Unrecognised configuration flag ', argv[i], ' ...skipping');
        }
    }

    log.info('Running with configuration ', JSON.stringify(configJSON, null, 4));

    if(configJSON.verbose) {
        log.setLevel('all');
    }

    // TODO: enable this
    // let currentDir =  process.cwd().split('/').pop();
    // if(currentDir === 'main') {
    //     if(!configJSON.plugins.length) {
    //         log.info('Scanning for all plugins');
    //         configJSON.plugins = [];
    //         // TODO: get all plugins using assets-compiler script.
    //         log.info('Found ', configJSON.plugins.length, ' plugins');
    //         log.debug(configJSON.plugins);
    //     }
    // } else {
    //     log.info('Executing from a plugin directory. Ignoring provided -plugins config');
    //     configJSON.plugins = [currentDir];
    // }

    configJSON.plugins = ['cf.cplace.cp4p.planning'];
    configJSON.addExports = true;
    configJSON.addImports = true;

    detectAndGenerateConfig(configJSON);

    new Refactor();

})();


