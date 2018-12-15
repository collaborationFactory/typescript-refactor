/**
 * A simple logging service
 */
export class Logger {
    private static VERBOSE_LOGGING = false;

    public static setVerboseLogging(enable: boolean) {
        this.VERBOSE_LOGGING = enable;
    }

    public static log(...args: any[]) {
        console.log.apply(console, ['\x1b[34mINFO:', ...args, '\x1b[0m']);
    }

    public static success(...args: any[]) {
        console.log.apply(console, ['\x1b[32mSUCC:', ...args, '\x1b[0m']);
    }

    public static warn(...args: any[]) {
        console.log.apply(console, ['\x1b[33mWARN:', ...args, '\x1b[0m']);
    }

    public static error(...args: any[]) {
        console.log.apply(console, ['\x1b[31mERRO:', ...args, '\x1b[0m']);
    }

    public static fatal(...args: any[]) {
        console.log.apply(console, ['\x1b[37mFATL:', '\x1b[41m', ...args, '\x1b[0m']);
    }

    /**
     * will only log if VERBOSE is enabled
     */
    public static debug(...args: any[]) {
        if (this.VERBOSE_LOGGING) {
            console.log.apply(console, ['\x1b[34mDEBG:', ...args, '\x1b[0m']);
        }
    }
}
