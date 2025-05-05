import { TerminalPrompt, User, UserLevel } from '..';
import { RemoteTerminalClientProcess } from '..';
import { onProgramExit } from '..';

const user = new User('Client', UserLevel.LOCAL);
const process = new RemoteTerminalClientProcess();
const terminal = process.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

terminal.connect('127.0.0.1:8080', 'key');

onProgramExit(() => {
    terminal.socket?.disconnect();
});
