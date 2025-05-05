
import { RequestData, Terminal, TerminalProcess, version } from "..";
import { User } from '../modules/User';
import { TerminalSocket, SocketInfo } from "../TerminalSocket";
import WebSocket from 'ws';

export class RemoteTerminalClient extends Terminal {
    url?: string;
    private _secret?: string;
    request?: RequestData;
    ws?: WebSocket;
    socket?: TerminalSocket;

    connect(url: string, secret: string, request: RequestData = {
        history: true
    }) {
        this.url = url;
        this._secret = secret;
        this.request = request;
        this.output(`Connecting to server: ${url}...`);
        try {
            this.ws = new WebSocket(`ws://${url}`);
            this.ws.on('open', () => {
                if (!this.ws) {
                    this.output(`Failed to connect to server.`);
                    return;
                }
                this.output(`WebSocket Connected. Now checking secret key...`);
                const socket = new TerminalSocket(this.ws, this, secret);
                this.socket = socket;
                this.unPipeTo(this.process, 'input', this.process.input); // block input to local process
                socket.pipeFrom(this, 'input', socket.input); // reroute IO to socket
                socket.pipeTo(this, 'output', this.output);
                socket.on('handshake', (info: SocketInfo) => {
                    this.output(`Handshake done with server [${info.name}].`);
                    this.output(`Client Terminal version: ${version}.`);
                    this.output(`Server Terminal version: ${info.version}.`);
                    this.output(`===================================================`);
                    socket.request(request);
                });
                socket.on('handshakeFailed', () => {
                    this.output(`Handshake failed.`);
                });
                socket.on('disconnected', (reason: string) => {
                    if (reason == 'bySocket') reason = 'by Server';
                    this.output(`Disconnected from server. Reason: ${reason}`);
                    this._deleteSocket();
                });
                socket.handshake();
            });
            this.ws.on('error', (e) => {this.output(e.message)});
        } catch (e) {
            this.output(`Failed to connect to server.`);
            this._deleteSocket();
            return;
        }
    }

    reconnect() {
        if (this.url && this._secret) this.connect(this.url, this._secret, this.request);
    }

    _deleteSocket() {
        this.socket?.unPipeAll();
        this.socket = undefined;
        this.pipeTo(this.process, 'input', this.process.input);
        if (this.prompt) {
            this.setPromptString(this.process.promptString);
        }
    }
}

export class RemoteTerminalClientProcess extends TerminalProcess {
    terminal?: RemoteTerminalClient

    constructor() {
        super('RemoteClient');
    }

    newTerminal(user: User, output?: (data: any) => void): RemoteTerminalClient {
        const t = new RemoteTerminalClient(user, this, output);
        this.terminal = t;
        return t;
    }

    setupProgram() {
        super.setupProgram();
        const p = this.program;
        p.command('/disconnect')
            .description('Disconnect from server')
            .action(() => {
                if (this.terminal?.socket) {
                    this.terminal?.socket.disconnect('by user');
                } else {
                    this.output(`There is no server to disconnect from.`);
                }
            });

        p.command('/reconnect')
            .description('Reconnect to server')
            .action(() => {
                if (this.terminal?.socket) {
                    this.terminal?.socket.disconnect('by user');
                }
                this.terminal?.reconnect();
            });

        p.command('/testpassword')
            .description('test')
            .action(() => {
                if (this.terminal?.prompt) this.terminal.prompt.askPassword('test');
            });
    }

}
