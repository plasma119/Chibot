
import { Terminal, TerminalProcess } from "..";
import { User, UserLevel } from '../modules/User';
import { TerminalSocket, SocketInfo } from "../TerminalSocket";
import WebSocket from 'ws';

export class RemoteTerminal extends Terminal {
    ws: WebSocket;
    socket: TerminalSocket;

    constructor(process: RemoteTerminalProcess, ws: WebSocket, secret: string) {
        super(new User('RemoteUser', UserLevel.REMOTE), process);
        this.ws = ws;
        this.socket = new TerminalSocket(ws, this, secret);
        this.socket.pipeTo(this); // from socket(client) to server
        this.pipeTo(this.socket); // from server to socket(client)
        this.socket.on('handshake', (info: SocketInfo) => {
            this.user.name = info.userName;
            this.process.output(`Handshake done with client [${info.userName}].`);
            this.update();
        });
        this.socket.on('handshakeFailed', () => {
            this.process.output(`Handshake failed with client.`);
        });
        this.socket.on('disconnected', (reason: string) => {
            if (reason == 'bySocket') reason = 'by Client';
            this.process.output(`Client [${this.socket.targetInfo?.userName}] disconnected. Reason: ${reason}`);
            process.removeTerminal(this);
        });
    }

    update() {
        this.socket.send('promptString', `@${this.process.name}${this.promptString}`);
        this.socket.send('completions', JSON.stringify(this.process.program.completions));
    }
}

export class RemoteTerminalProcess extends TerminalProcess {
    wss?: WebSocket.Server;
    port?: number;
    remoteTerminals: RemoteTerminal[] = [];

    setupProgram() {
        super.setupProgram();
        const p = this.program;
        p.command('/disconnect')
            .description('disconnect from server')
            .action(() => {
                // todo: kick user
            });
        p.command('/users')
            .description('display current users on the server')
            .action(() => {
                this.output(this.remoteTerminals.map((t) => `[${t.socket.targetInfo?.userName}]`).join(' '));
            });
    }

    startServer(secret: string, port: number = 8080) {
        this.port = port;
        this.output(`Starting server [${this.name}] on port:${this.port}...`);
        try {
            this.wss = new WebSocket.Server({
                port: this.port
            });
            this.wss.on('error', (e) => {this.output(e.message)});
        } catch (e) {
            this.output(`Error: failed to start server.`);
            return;
        }
        this.output(`Now running.`);
        this.wss.on('connection', (ws: WebSocket) => {
            this.remoteTerminals.push(new RemoteTerminal(this, ws, secret));
        });
    }

    removeTerminal(terminal: RemoteTerminal) {
        terminal.destroy();
        this.remoteTerminals = this.remoteTerminals.filter((t) => {t != terminal});
    }

}
