import { RemoteTerminalProcess, TerminalPrompt, User, UserLevel, onProgramExit } from './terminal';
import config from './config.js';

const user = new User('Admin', UserLevel.ADMIN);
const server = new RemoteTerminalProcess('Local test server');
const terminal = server.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

server.startServer(config.terminalKey, config.terminalPort);

onProgramExit(() => {
    server.remoteTerminals.forEach((t) => {
        t.socket.disconnect('shutting down');
    });
});
