import { inspect } from 'util';

import WebSocket from 'ws';

import { RemoteTerminal, RemoteTerminalClient, Terminal, version } from '.';
import { Encryption, parseCommand, arrayUnion } from '.';
import { BasicComponent, DataInfo } from './modules/BasicComponent';
import { User, UserLevel } from '.';

export type SocketInfo = {
    name: string;
    userName: string;
    version: string;
};

const DEFAULTSOCKETINFO: SocketInfo = {
    name: 'unknown',
    userName: 'unknown',
    version: 'unknwon',
};

export type RequestData = {
    history?: boolean;
};

export class TerminalSocket extends BasicComponent {
    socketUser: User;
    ws: WebSocket;
    terminal: Terminal;
    private _secret: string;
    private _key?: Buffer;
    handshakeDone: boolean;
    private _handshakeState: number;
    private _noise: string;
    private _salt: string;
    private _salt2: string;
    algorithm: string;
    info: SocketInfo;
    targetInfo?: SocketInfo;
    alive: boolean;
    timeoutTime: number;
    health: number;
    timer?: NodeJS.Timeout;

    constructor(ws: WebSocket, terminal: Terminal, secret: string) {
        super();
        this.socketUser = new User('Socket', UserLevel.SYSTEM);
        this.terminal = terminal;
        this._secret = Encryption.hash(secret).digest('base64');
        this.handshakeDone = false;
        this._handshakeState = 0;
        this._noise = '';
        this._salt = 'cake';
        this._salt2 = 'lie';
        this.algorithm = 'aes-256-ctr';
        this.info = {
            name: this.terminal.process.name,
            userName: this.terminal.user.name,
            version: version,
        };
        this.alive = true;
        this.timeoutTime = 60 * 1000;
        this.health = this.timeoutTime;
        this.ws = ws;
        this.ws.on('message', this.recieveHandler.bind(this));
        this._setTimeoutTimer();
    }

    _input(data: any) {
        this.sendText(data);
    }

    output(data: any, info: DataInfo = { user: this.socketUser }) {
        super.output(data, info);
    }

    send(header: string, data: string = '') {
        if (!this._key) return false;
        if (typeof data != 'string') {
            data = inspect(data, false, 2, true);
        }
        this.ws.send(this._encodeData(`${header} ${Encryption.base64Encode(data)}`));
        return true;
    }

    sendText(str: string) {
        if (this.terminal instanceof RemoteTerminalClient && typeof str == 'string' && str != '/help') {
            const cmds = this.terminal.process.program.completions; // capture local commands
            if (cmds.indexOf(str) >= 0) {
                this.terminal.process.input(str, { user: this.terminal.user });
                return;
            }
        }
        return this.send('text', str);
    }

    // todo: add type for possible requests
    request(data: RequestData) {
        this.send('request', JSON.stringify(data));
    }

    requestHandler(data: RequestData) {
        if (data.history) {
            this.send('history', this.terminal.process.getScreen().join(''));
            return;
        }
    }

    recieveHandler(data: WebSocket.Data) {
        if (!this.handshakeDone) {
            try {
                //if (this.terminal instanceof RemoteTerminal) this.terminal.process.output(`DEBUG: recieved: ${data}`);
                //if (this.terminal instanceof RemoteTerminalClient) this.terminal.output(`DEBUG: recieved: ${data}`);
                this.handshakeHandler(data);
            } catch (e) {
                this.output(`ERROR: handshake error.`);
                this.output(e);
            }
            return;
        }
        const decrypted = this._decodeData(data);
        //if (this.terminal instanceof RemoteTerminal) this.terminal.process.output(`DEBUG: recieved: ${decrypted}`);
        //if (this.terminal instanceof RemoteTerminalClient) this.terminal.output(`DEBUG: recieved: ${decrypted}`);
        if (decrypted.length == 0) return;
        this._parseDecryptedData(decrypted);
    }

    _parseDecryptedData(decrypted: string) {
        try {
            const [header, payload] = parseCommand(decrypted);
            const data = Encryption.base64Decode(payload);
            switch (header) {
                case 'text':
                case 'history':
                    this.output(data, { user: this.terminal.user });
                    break;

                case 'completions':
                    if (this.terminal.prompt) {
                        let arr = JSON.parse(data);
                        if (!Array.isArray(arr)) break;
                        if (typeof arr[0] != 'string') break;
                        if (this.terminal instanceof RemoteTerminalClient) {
                            // add local commands
                            arr = arrayUnion(arr, this.terminal.process.program.completions);
                        }
                        this.terminal.prompt.setCompleter(arr);
                    }
                    break;

                case 'promptString':
                    this.terminal.setPromptString(data);
                    break;

                case 'disconnect':
                    this._disconnect(data);
                    break;

                case 'ping':
                    this.health = this.timeoutTime;
                    this.send('pong', '');
                    break;

                case 'pong':
                    this.health = this.timeoutTime;
                    break;

                case 'request':
                    this.requestHandler(JSON.parse(data));
                    break;
            }
        } catch (e) {
            this.output(`ERROR: failed to parse data.`);
            this.output(e);
        }
    }

    disconnect(reason: string = 'by socket') {
        this.send('disconnect', reason);
        this._disconnect(reason);
    }

    private _disconnect(reason: string = 'unknown') {
        if (this.alive) this.ws.close();
        this.emit('disconnected', reason);
        this.alive = false;
        this._key = undefined;
    }

    private _encodeData(data: string) {
        if (!this._key) return '';
        const [iv, encrypted] = Encryption.encrypt(this.algorithm, this._key, data);
        const hmac = Encryption.hmac(iv, this._secret);
        hmac.update(encrypted);
        return `${iv} ${encrypted} ${hmac.digest().toString('base64')}`;
    }

    private _decodeData(data: WebSocket.Data) {
        if (!this._key) return '';
        const tokens = data.toString().split(' ');
        try {
            if (tokens.length != 3) {
                this.output(`ERROR: incorrect data format.`);
                return '';
            }
            const hmac = Encryption.hmac(tokens[0], this._secret);
            hmac.update(tokens[1]);
            if (hmac.digest().toString('base64') != tokens[2]) {
                this.output(`ERROR: data corrupted.`);
                return '';
            }
            const decrypted = Encryption.decrypt(this.algorithm, this._key, tokens[0], tokens[1]);
            return decrypted;
        } catch (e) {
            this.output(`ERROR: failed to decrypt data.`);
            this.output(e);
        }
        return '';
    }

    handshake() {
        this.ws.send(`ding`); // c1
        this._handshakeState = 100;
    }

    handshakeHandler(data: WebSocket.Data) {
        const [header, payload] = parseCommand(data.toString());
        const hash = Encryption.hash(this._salt);
        switch (header) {
            case 'ding': // s1
                if (this._handshakeState != 0) return;
                this._noise = Encryption.randomData().toString('base64');
                this.ws.send(`dong ${this._noise}`);
                break;

            case 'dong': // c2
                if (this._handshakeState != 100) return;
                this._noise = payload;
                hash.update(this._noise);
                hash.update(this._secret);
                this.ws.send(`salt ${hash.digest('base64')}`);
                break;

            case 'salt': // s2
                if (this._handshakeState != 1) return;
                hash.update(this._noise);
                hash.update(this._secret);
                if (payload != hash.copy().digest('base64')) {
                    this._handshakeState = 1000;
                    this.emit('handshakeFailed');
                    this.ws.send(`stop`);
                    return;
                }
                hash.update(this._salt2);
                hash.update(this._secret);
                this.ws.send(`sugar ${hash.digest('base64')}`);
                break;

            case 'sugar': // c3
                if (this._handshakeState != 101) return;
                hash.update(this._noise);
                hash.update(this._secret);
                hash.update(this._salt2);
                hash.update(this._secret);
                if (payload != hash.digest('base64')) {
                    this._handshakeState = 1000;
                    this.emit('handshakeFailed');
                    this.ws.send(`stop`);
                    return;
                }
                this._key = Encryption.genKey(this._secret, this._noise);
                this.ws.send(`hello ${this._encodeData(JSON.stringify(this.info))}`);
                break;

            case 'hello': // s3
                if (this._handshakeState != 2) return;
                this._key = Encryption.genKey(this._secret, this._noise);
                this._setTargetInfo(payload);
                this.ws.send(`world ${this._encodeData(JSON.stringify(this.info))}`);
                this._handShakeDone();
                break;

            case 'world': // c4
                if (this._handshakeState != 102) return;
                this._setTargetInfo(payload);
                this._handShakeDone();
                break;

            case 'stop': // handshake failed
                this._handshakeState = 1000;
                this.emit('handshakeFailed');
                break;
        }
        this._handshakeState++;
    }

    _handShakeDone() {
        this.handshakeDone = true;
        this.emit('handshake', this.targetInfo);
    }

    _setTimeoutTimer() {
        let interval = 10000;
        this.timer = setInterval(() => {
            if (this.terminal instanceof RemoteTerminal) this.send('ping');
            this.health -= interval;
            if (this.health < 0) {
                if (this.alive) {
                    this._disconnect('timeout');
                }
                if (this.timer) clearInterval(this.timer);
            }
        }, interval);
    }

    _setTargetInfo(targetInfo: SocketInfo | string) {
        try {
            if (typeof targetInfo == 'string') {
                targetInfo = JSON.parse(this._decodeData(targetInfo));
            }
            this.targetInfo = Object.assign({}, DEFAULTSOCKETINFO, targetInfo);
        } catch (e: any) {
            this.targetInfo = DEFAULTSOCKETINFO;
        }
    }
}
