import { RemoteTerminalClientProcess, TerminalPrompt, User, UserLevel, onProgramExit } from './terminal';
import config from './config.js';

const user = new User('LocalRabbit', UserLevel.LOCAL);
const process = new RemoteTerminalClientProcess();
const terminal = process.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

terminal.connect(`127.0.0.1:${config.terminalPort}`, config.terminalKey, {
    history: true,
});

onProgramExit(() => {
    terminal.socket?.disconnect();
});
