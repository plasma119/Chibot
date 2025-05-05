import { TerminalPrompt, User, UserLevel } from '..';
import { RemoteTerminalProcess } from '..';
import { onProgramExit } from '..';

const user = new User('serverAdmin', UserLevel.ADMIN);
const server = new RemoteTerminalProcess('Server');
const terminal = server.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

server.startServer('key', 8080);

onProgramExit(() => {
    server.remoteTerminals.forEach((t) => {
        t.socket.disconnect('shutting down');
    });
});
