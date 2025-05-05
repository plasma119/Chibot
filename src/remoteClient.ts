import { RemoteTerminalClientProcess, TerminalPrompt, User, UserLevel, onProgramExit } from './terminal';
import config from './config.js';

const user = new User('RemoteClient', UserLevel.LOCAL);
const process = new RemoteTerminalClientProcess();
const terminal = process.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

terminal.connect(`${config.terminalHost}:${config.terminalPort}`, config.terminalKey);

onProgramExit(() => {
    terminal.socket?.disconnect();
});
