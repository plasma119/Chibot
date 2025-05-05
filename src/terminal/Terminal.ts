import { inspect } from 'util';

import stringArgv from 'string-argv';
import * as ReadLine from 'readline';
import MuteStream from 'mute-stream';

import { version } from '.';
import { BasicComponent, DataInfo } from './modules/BasicComponent';
import { User, UserLevel } from './modules/User';
import { TerminalCommand } from './TerminalCommand';

export class Terminal extends BasicComponent {
    user: User;
    process: TerminalProcess;

    prompt?: TerminalPrompt;
    promptString: string;

    constructor(user: User, process: TerminalProcess, output?: (data: any) => void) {
        super();
        this.user = user;
        this.process = process;
        if (output) this.setOutput(output);
        this.promptString = process.promptString;
        this.pipeFrom(process, 'input', this.echoInput);
        this.pipeFrom(process, 'output', this.output); // leaking!!
        this.pipeTo(process, 'input', process.input);
        this.pipeFrom(process, 'promptString', this.setPromptString);
    }

    echoInput(data: string, info: DataInfo) {
        if (info.user == this.user) return;
        this.output(`${info.user.getPrompt()}>${data}`, { user: info.user });
    }

    setPromptString(str: string) {
        this.promptString = str;
        this.update();
    }

    usePrompt(prompt: TerminalPrompt) {
        if (this.prompt) {
            this.prompt.unPipeAll();
        }
        this.prompt = prompt;
        this.pipeFrom(prompt, 'input', this.input);
        this.pipeTo(prompt, 'output', prompt.output);
        this.update();
    }

    update() {
        if (this.prompt) {
            this.prompt.setPrompt(`${this.user.getPrompt()}${this.promptString}`);
            this.prompt.setCompleter(this.process.program);
        }
    }

    input(data: any, info: DataInfo = { user: this.user }) {
        if (info.options?.fromPrompt) info.user = this.user;
        super.input(data, info);
    }

    output(data: any, info: DataInfo = { user: this.user }) {
        super.output(data, info);
    }

    hideOutput() {
        // todo: check is there need for this function
        this._pipeToTargets.forEach((r) => {
            if (r.event == 'output') this.unPipeTo(r.target);
        });
    }

    clearScreen() {
        // todo: fix this
        if (this.output == console.log) {
            console.clear();
        }
    }

    redraw() {
        // todo: process screen should also record user
        const s = this.process.getScreen();
        this.clearScreen();
        for (let i = 0; i < s.length; i++) {
            this.output(s[i], { user: this.user });
        }
    }

    destroy() {
        this.pipeDestroy();
    }
}

export class TerminalProcess extends BasicComponent {
    name: string;
    screen: string[];
    program: TerminalCommand;
    user: User;
    currentInput: string;
    currentUser: User;
    lineLimit: number;
    promptString: string;

    constructor(name: string) {
        super();
        this.name = name;
        this.screen = [];
        this.user = new User(`Process[${name}]`, UserLevel.SYSTEM);
        this.currentInput = '';
        this.currentUser = new User('unknown', UserLevel.NONE);
        this.lineLimit = 1000;
        this.program = new TerminalCommand();
        this.program.configureOutput({
            writeOut: (str: string) => {
                this.output(str, { user: this.currentUser });
            },
            writeErr: (str: string) => {
                this.output(str, { user: this.currentUser });
            },
        });
        this.setupProgram();
        this.promptString = '>';
    }

    setupProgram() {
        const p = this.program;
        p.command('/version')
            .description('display current terminal version')
            .action(() => {
                this.output(`Terminal version: ${version}`, { user: this.currentUser });
            });
        p.command('/localversion')
            .description('display local terminal version')
            .action(() => {
                this.output(`Local Terminal version: ${version}`, { user: this.currentUser });
            });
        p.command('/pipeDebug')
            .description('pipe debug')
            .action(() => {
                this.pipeDebug();
            });
        /*
        p.command('/test')
            .description('testing stuff')
            //.option('-s, --stuff <item>', 'default')
            .action((args) => {
                const {stuff} = args;
                this.output(stuff);
            });
        */
    }

    setPromptString(str: string) {
        this.promptString = str;
        this.emit('promptString', str);
    }

    newTerminal(user: User, output?: (data: any) => void) {
        return new Terminal(user, this, output);
    }

    _input(data: any, info: DataInfo) {
        const { user } = info;
        this.currentInput = data;
        this.currentUser = user;

        this._output(`${user.getPrompt()}>${data}\n`); // write to internal only

        try {
            //console.log(`DEBUG: parse(${str})`);
            if (data.charAt(0) != '/') return; // not command
            this.program.parse(stringArgv(data), { from: 'user' });
            //console.log(`DEBUG: parse done`);
        } catch (e: any) {
            if (e.code == 'commander.help') return;
            if (e.code == 'commander.helpDisplayed') return;
            if (e.code == 'commander.unknownCommand') return;
            if (e.code == 'commander.version') return;
            this.output(`Internal Error: Terminal failed to parse command.`, { user: this.user });
            this.output(e, { user: this.user });
        }
    }

    output(data: any, info: DataInfo = { user: this.user }) {
        super.output(data, info);
    }

    _output(data: any) {
        //console.log(`DEBUG: emit: ${str}`);
        if (typeof data != 'string') {
            data = inspect(data, false, 2, true);
        }
        const c = data.charAt(data.length - 1);
        data = `${data}${c != '\n' && c != '\r' ? '\n' : ''}`;
        this.screen.push(data);
        if (this.screen.length > this.lineLimit) this.screen.pop();
    }

    getScreen() {
        return this.screen;
    }

    clearScreen() {
        this.screen = [];
    }
}

const promptUser = new User('Prompt', UserLevel.LOCAL);

export class TerminalPrompt extends BasicComponent {
    stdout: NodeJS.WriteStream = process.stdout;
    stdin: NodeJS.ReadStream = process.stdin;
    muteStream: MuteStream = new MuteStream({
        replace: '*',
    });

    _promptString: string;
    _basePromptString: string;
    interface: ReadLine.Interface;
    _completions: string[] = [];

    _passwordMode: boolean = false;
    _clearNextHistory: boolean = false;
    private _passwordIV: string = '';

    constructor(promptString: string = '>', basePromptString: string = '') {
        super();
        this._promptString = promptString;
        this._basePromptString = basePromptString;
        this.muteStream.pipe(this.stdout, { end: false });
        this.muteStream.unmute();
        this.interface = ReadLine.createInterface({
            input: this.stdin,
            output: this.muteStream,
            prompt: this._promptString,
            completer: this._completer.bind(this),
            history: [],
        });
        this.interface.on('history', (history) => {
            if (this._clearNextHistory) history[0] = '';
        });
        this.interface.on('line', (str: string) => {
            this.prompt();
            this.input(str);
        });
        this.prompt();
    }

    prompt() {
        this.stdout.write(this._promptString);
    }

    setPrompt(str: string) {
        this._outputWithFixedPrompt(() => {
            this._promptString = this._basePromptString + str;
            this.interface.setPrompt(str);
        });
    }

    setBasePrompt(str: string) {
        this._basePromptString = str;
    }

    _completer(line: string) {
        if (line.charAt(0) != '/') return ['', line];
        const hits = this._completions.filter((c) => c.startsWith(line));
        // Show all completions if none found
        return [hits.length ? hits : this._completions, line];
    }

    setCompleter(cmd: TerminalCommand | string[]) {
        if (cmd instanceof TerminalCommand) {
            this._completions = cmd.completions;
        } else {
            this._completions = cmd;
        }
    }

    askPassword(iv: string) {
        this._passwordMode = true;
        this._passwordIV = iv;
        this._clearNextHistory = true;
        this.muteStream.mute();
    }

    input(data: any, info: DataInfo = { user: promptUser, options: { fromPrompt: true } }) {
        if (this._passwordMode) {
            this.stdout.moveCursor(0, -1);
            ReadLine.clearLine(this.stdout, 0); // clear input
            // todo: hash password with iv
            info.options = {
                iv: this._passwordIV,
                password: data,
            };
            data = '';
            this._passwordIV = '';
            this._passwordMode = false;
            this.output(`data: ${data}`);
            this.output(`info: `);
            this.output(info);
            this.muteStream.unmute();
        }
        super.input(data, info);
    }

    output(data: any, info: DataInfo = { user: promptUser }) {
        super.output(data, info);
    }

    _output(data: any) {
        this._outputWithFixedPrompt(() => {
            if (typeof data == 'string') {
                const c = data.charAt(data.length - 1);
                this.stdout.write(`${data}${c != '\n' && c != '\r' ? '\n' : ''}`);
            } else {
                this.stdout.write(inspect(data, false, 2, true));
                const p = this.interface.getCursorPos();
                if (p.cols != 0) this.stdout.write('\n');
            }
        });
    }

    _outputWithFixedPrompt(f: Function) {
        const p = this.interface.getCursorPos();
        const l = this._promptString.length;
        const rows = Math.floor((l + this.interface.line.length) / this.stdout.columns); // end of input rows
        const cols = (l + this.interface.line.length) % this.stdout.columns; // end of input cols
        ReadLine.cursorTo(this.stdout, 0); // back to col 0
        // clear all input and back to input line row 0
        ReadLine.clearLine(this.stdout, 0);
        for (let i = 0; i < p.rows; i++) {
            this.stdout.moveCursor(0, -1);
            ReadLine.clearLine(this.stdout, 0);
        }
        f(); // output function
        this.prompt(); // print prompt
        this.stdout.write(this.interface.line);
        this.stdout.moveCursor(p.cols - cols, p.rows - rows); // return cursor to previous position
    }
}
