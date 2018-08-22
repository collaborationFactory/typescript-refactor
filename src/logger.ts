/**
 * A simple logging service
 */

// const STACK_FRAME_RE = new RegExp("\\s*at ((\\S+)\\s)?\\((.*)\\)");
// using negative look ahead
const STACK_FRAME_RE = new RegExp('\\s*at ((?:(?!\\().)*)?\\((.*)\\)');

export class Logger {
    private static VERBOSE_LOGGING = false;

    public static setVerboseLogging(enable: boolean) {
        this.VERBOSE_LOGGING = enable;
    }


    private static getCaller() {
        const err = new Error();
        // Throw away the first three lines of trace and get fourth line
        // 0 - Error
        // 1 - this function
        // 2 - log function that called this
        // 3 - code calling logger
        const frame = err.stack.split('\n')[3];
        const callerInfo = STACK_FRAME_RE.exec(frame);

        // Find the first line in the stack that doesn't name this module.
        // for (var i = 0; i < frames.length; i++) {
        // if (frames[i].indexOf("LoggerService") === -1) {
        //   callerInfo = STACK_FRAME_RE.exec(frames[i]);
        //   break;
        // }
        // }

        if (callerInfo) {
            callerInfo[2] = callerInfo[2].split('/').slice(-1).pop();
            return {
                func: callerInfo[1] || 'aNoN',
                fileInfo: callerInfo[2] || null,
            };
        }
        return {
            func: '-',
            fileInfo: '-'
        };
    }

    private static getTimestamp() {
        const now = new Date();
        const dateStr = ((now.getDate() < 10) ? '0' : '') + now.getDate() + '.' + (((now.getMonth() + 1) < 10) ? '0' : '') + (now.getMonth() + 1) + '.' + now.getFullYear();
        const timeStr = ((now.getHours() < 10) ? '0' : '') + now.getHours() + ':' + ((now.getMinutes() < 10) ? '0' : '') + now.getMinutes() + ':' + ((now.getSeconds() < 10) ? '0' : '') + now.getSeconds();
        return dateStr + ' ' + timeStr;
    }

    /**
     * Will always log the message to console.
     */
    public static log(...args: any[]) {
        const caller = this.getCaller();
        const a: any = [this.getTimestamp(), ' INFO ', caller.fileInfo, '\x1b[34m', ...args, '\x1b[0m'];
        console.log.apply(console, a);
    }

    public static warn(...args: any[]) {
        const caller = this.getCaller();
        const a: any = [this.getTimestamp(), ' INFO ', caller.fileInfo, '\x1b[33m', ...args, '\x1b[0m'];
        console.log.apply(console, a);
    }

    public static error(...args: any[]) {
        const caller = this.getCaller();
        const a: any = [this.getTimestamp(), ' ERROR ', caller.fileInfo, '\x1b[31m', ...args, '\x1b[0m'];
        console.log.apply(console, a);
    }

    public static fatal(...args: any[]) {
        const caller = this.getCaller();
        const a: any = [this.getTimestamp(), ' FATAL ', caller.fileInfo, '\x1b[37m', '\x1b[41m', ...args, '\x1b[0m'];
        console.log.apply(console, a);
    }

    /**
     * will only log if VERBOSE is enabled
     */
    public static debug(...args: any[]) {
        if (this.VERBOSE_LOGGING) {
            const caller = this.getCaller();
            const a: any = [this.getTimestamp(), ' DEBUG ', caller.fileInfo, '\x1b[34m', ...args, '\x1b[0m'];
            console.log.apply(console, a);
        }
    }
}