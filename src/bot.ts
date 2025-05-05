import fs from 'fs';

import * as Util from './utils.js';

export class Bot {
    cmdList: Map<string, Command>;
    assetList: Map<string, Asset>;
    wordList: Map<string, Keyword>;
    logList: Log[];
    prefix: string;
    default: string;
    invalid?: Function;
    debug: boolean;
    logFileName: string;
    logFileFolder: string;
    logFile?: fs.WriteStream;
    data: Map<string, any>;
    stdout: Function;

    constructor() {
        this.cmdList = new Map();
        this.assetList = new Map();
        this.wordList = new Map();
        this.logList = [];
        this.prefix = '';
        this.default = '';
        this.debug = false;
        this.logFileName = 'log';
        this.logFileFolder = '.';
        this.data = new Map();
        this.stdout = console.log;
    }

    init() {
        this.logFileName = `${this.logFileFolder}/${this.logFileName}_${Util.getFormattedDate(new Date(), '_')}.txt`;
        this.logFile = fs.createWriteStream(this.logFileName, { flags: 'a' });
        this.assetList.forEach((a) => a.init());
    }

    setPrefix(string: string) {
        this.prefix = string;
    }

    setDefault(cmdName: string) {
        this.default = cmdName;
    }

    setInvalid(callback: Function) {
        this.invalid = callback;
    }

    setLogFile(name: string) {
        this.logFileName = name;
    }

    setLogFolder(name: string) {
        this.logFileFolder = name;
    }

    setStdout(f: Function) {
        this.stdout = f;
    }

    addCmd(cmd: Command) {
        this.cmdList.set(cmd.name, cmd);
    }

    addAsset(asset: Asset) {
        this.assetList.set(asset.name, asset);
    }

    addKeyword(keyword: Keyword) {
        this.wordList.set(keyword.name, keyword);
    }

    getCmd(cmdName: string) {
        return this.cmdList.get(cmdName);
    }

    getAsset(assetName: string) {
        return this.assetList.get(assetName);
    }

    async execute(string: string, data: any, suppressError: boolean = false) {
        if (typeof string != 'string') return false;
        let str = string.trim();
        if (string.length == 0) return false;

        // prefix check
        if (this.prefix) {
            const p = str.slice(0, this.prefix.length);
            if (p.toLowerCase() != this.prefix.toLowerCase()) return false;
            str = str.slice(this.prefix.length).trim();
        }

        const args = str.split(' ');
        // no command, try calling default command
        if (args.length == 0) args.unshift(this.default);

        let cmdName = Util.nextArg(args);
        let cmd = this.getCmd(cmdName);

        if (!cmd) {
            // invalid command name
            if (!suppressError) this.executeInvalid(args, data, cmdName);
            return false;
        }

        if (cmd._args && args.length == 0) {
            // not enough arguments
            if (this.default && !suppressError) {
                // try calling default command
                args.unshift(cmdName);
                cmdName = this.default;
                let c = this.getCmd(cmdName);
                if (c) cmd = c;
            } else {
                if (!suppressError) this.executeInvalid(args, data, cmdName);
                return false;
            }
        }

        // execute command
        try {
            this.log(`execute command: [${cmd.name}]`);
            await cmd.execute(args, data);
            return true;
        } catch (e: any) {
            this.log(`command failed: [${cmd.name}]`, e);
        }
        return false;
    }

    executeInvalid(args: string[], data: any, cmdName: string) {
        if (this.invalid) {
            args.unshift(cmdName);
            this.invalid(args, data);
        }
    }

    async executeKeyword(string: string, data: any) {
        try {
            this.wordList.forEach((w) => {
                if (w.execute(string, data)) this.log(`keyword execute: [${w.name}]`);
            });
        } catch (error: any) {
            this.log('keyword execute failed.', error);
        }
    }

    log(string: string, error?: Error) {
        if (error) {
            this.stdout(string);
            this.stdout(error);
        } else if (this.debug) {
            this.stdout(string);
        }
        const log = new Log(string, error);
        this.logList.push(log);
        if (this.logFile) {
            this.logFile.write((log.error ? '[ERROR]' : '[LOG]') + log.toString().replace(`\n`, '| '));
        }
    }
}

export class Command {
    name: string;
    execute: Function;
    _description: string;
    _usage: string;
    _hidden: boolean;
    _args: boolean;

    constructor(name: string, callback: Function) {
        this.name = name;
        this._description = '';
        this._usage = '';
        this._hidden = false;
        this._args = false;
        this.execute = callback;
    }

    getUsageString() {
        return `Usage: !chibot ${this.name} ${this._usage}`;
    }

    getDescriptionString() {
        return this._description;
    }

    description(str: string) {
        this._description = str;
        return this;
    }

    usage(str: string) {
        this._usage = str;
        return this;
    }

    hidden(bool: boolean) {
        this._hidden = bool;
        return this;
    }

    needArgument(bool: boolean) {
        this._args = bool;
        return this;
    }
}

export class Asset {
    name: string;
    extList: string[];
    autoGroup: boolean;
    fileSetList: Map<any, any>;
    path: string;

    constructor(name: string, extList: string | string[], autoGroup: boolean = false) {
        this.name = name;
        this.extList = typeof extList === 'string' ? [extList] : extList;
        this.autoGroup = autoGroup;
        this.fileSetList = new Map();
        this.path = `./asset/${this.name}/`;
    }

    init() {
        const regex = /\d+$/;
        const list = fs.readdirSync(`./asset/${this.name}`).filter((fileName: string) => {
            for (const ext of this.extList) {
                if (fileName.endsWith(ext)) return true;
            }
            return false;
        });
        const nameList = list.map((fileName: string) => {
            const arr = fileName.split('.');
            arr.pop();
            let str = arr.join('.');
            if (this.autoGroup) str = str.replace(regex, '');
            return str;
        });
        for (let i = 0; i < list.length; i++) {
            const file = list[i];
            const name = nameList[i];
            this.addFile(name, file);
        }
    }

    reload() {
        this.fileSetList = new Map();
        this.init();
    }

    getFileSet(name: string): FileSet {
        return this.fileSetList.get(name.toLowerCase());
    }

    addFile(name: string, file: string) {
        const fileSet = this.getFileSet(name);
        if (fileSet) {
            fileSet.addFile(file);
        } else {
            this.fileSetList.set(name.toLowerCase(), new FileSet(name, this.path, file));
        }
    }
}

export class FileSet {
    name: string;
    path: string;
    fileList: string[];

    constructor(name: string, path: string, fileList: string | string[]) {
        this.name = name;
        this.path = path;
        this.fileList = typeof fileList === 'string' ? [fileList] : fileList;
    }

    async getFile(i: number) {
        const k = isNaN(i) ? Util.randInt(this.getSize()) : i;
        const fileName = this.getFileName(k);
        if (!fileName) return null;
        const file = await fs.promises.readFile(`${this.path}/${fileName}`);
        return file;
    }

    getFileName(i: number) {
        if (i < 0 || i >= this.getSize()) return '';
        return this.fileList[i];
    }

    getSize() {
        return this.fileList.length;
    }

    addFile(fileName: string) {
        this.fileList.push(fileName);
    }
}

export class Keyword {
    name: string;
    regex: RegExp;
    interval: number;
    respond: Function;
    lastTimestamp: number;

    constructor(name: string, regex: RegExp, respond: Function, interval: number = 0) {
        this.name = name;
        this.regex = regex;
        this.interval = interval;
        this.respond = respond;
        this.lastTimestamp = 0;
    }

    execute(string: string, data: any): boolean {
        const timestamp = Date.now();
        if (timestamp - this.lastTimestamp < this.interval) return false;
        if (!string.match(this.regex)) return false;

        this.lastTimestamp = timestamp;
        this.respond(string, data);
        return true;
    }
}

export class Log {
    error?: Error;
    timestamp: number;
    string: string;

    constructor(string: string, error?: Error) {
        this.timestamp = Date.now();
        this.string = string;
        this.error = error;
    }

    toString() {
        let str = `[${new Date(this.timestamp).toLocaleString()}]\n${this.string}\n`;
        if (this.error) str += this.error;
        return str;
    }
}
