/**
 * Create and init logger
 */

import * as simpleNodeLogger from 'simple-node-logger';

let logger;

function createAndInitLogger(): void {
    return simpleNodeLogger.createSimpleLogger();
}

export function getLogger() {
    if (!logger) {
        logger = createAndInitLogger();
    }

    return logger;
}
