/**
 * Create and init logger
 */

import * as simpleNodeLogger from 'simple-node-logger';

export let logger;

export function createAndInitLogger(): void {
    logger = simpleNodeLogger.createSimpleLogger();
}
