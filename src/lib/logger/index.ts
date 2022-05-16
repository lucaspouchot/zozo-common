import { WinstonModule } from "nest-winston";
import * as winston from "winston";
import 'winston-daily-rotate-file';
import safeStringify from "fast-safe-stringify";
import { inspect } from "util";
import chalk from "chalk";
import { ensureString } from "../utils";

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
};
let verboseLevel = ensureString(process.env.VERBOSE_LVL).toLowerCase();
if (!levels.hasOwnProperty(verboseLevel)) {
    verboseLevel = 'verbose';
}

const nestLikeColorScheme: Record<string, chalk.Chalk> = {
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.greenBright,
    verbose: chalk.cyanBright,
    debug: chalk.magentaBright,
};

export const logger = (name: string, option: { console: boolean; rotateFile?: { path: string; nbDay: number; }; }) => {
    const transports: winston.transport[] = [];
    if (option.console) {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                winston.format.printf(({ context, level, timestamp, message, ms, jwt, body: _, ...meta }) => {
                    if ('undefined' !== typeof timestamp) {
                        // Only format the timestamp to a locale representation if it's ISO 8601 format. Any format
                        // that is not a valid date string will throw, just ignore it (it will be printed as-is).
                        try {
                            if (timestamp === new Date(timestamp).toISOString()) {
                                timestamp = new Date(timestamp).toLocaleString();
                            }
                        } catch (error) {
                            // eslint-disable-next-line no-empty
                        }
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    const color = nestLikeColorScheme[level] || ((text: string): string => text);

                    if (jwt && jwt.login) {
                        meta.user = jwt.login;
                    }

                    const stringifiedMeta = safeStringify(meta);
                    const formattedMeta = inspect(JSON.parse(stringifiedMeta), { colors: true, depth: null, breakLength: Infinity });

                    return (
                        `${color(`[${name}]`)} ` +
                        `${chalk.yellow(level.charAt(0).toUpperCase() + level.slice(1))}\t` +
                        ('undefined' !== typeof timestamp ? `${timestamp} ` : '') +
                        ('undefined' !== typeof context
                            ? `${chalk.yellow('[' + context + ']')} `
                            : '') +
                        `${color(message)} - ` +
                        `${formattedMeta}` +
                        ('undefined' !== typeof ms ? ` ${chalk.yellow(ms)}` : '')
                    );
                })
            ),
        }));
    }
    if (option.rotateFile) {
        transports.push(new winston.transports.DailyRotateFile({
            json: true,
            maxFiles: `${option.rotateFile.nbDay}d`,
            dirname: option.rotateFile.path,
            datePattern: 'YYYY-MM-DD',
            filename: `%DATE%.${name}.jsonl`,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.ms(),
                winston.format.printf(info => {
                    const { context, level, timestamp, message, ms, ...meta } = info;
                    let formattedMeta = safeStringify(meta);
                    try {
                        formattedMeta = JSON.parse(formattedMeta);
                    }
                    catch(e) {}
                    return JSON.stringify({
                        timestamp: new Date(timestamp).getTime(),
                        level: level,
                        date: new Date(timestamp).toISOString(),
                        context: context,
                        delay: ms,
                        message: message,
                        data: formattedMeta,
                    });
                }),
            ),
        }));
    }

    return WinstonModule.createLogger({
        levels: levels,
        level: verboseLevel,
        transports: transports,
    });
}