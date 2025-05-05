import * as Crypto from 'crypto';

export class Encryption {
    static base64Encode(str: string, encoding: 'ascii' | 'utf8' | 'binary' = 'ascii') {
        const buff = Buffer.from(str, encoding);
        return buff.toString('base64');
    }

    static base64Decode(str: string, encoding: 'ascii' | 'utf8' | 'binary' = 'ascii') {
        const buff = Buffer.from(str, 'base64');
        return buff.toString(encoding);
    }

    static hash(str: string) {
        const hash = Crypto.createHash('sha256');
        hash.update(str);
        return hash;
    }

    static hmac(str: string, secret: string) {
        const hmac = Crypto.createHmac('sha256', secret);
        hmac.update(str);
        return hmac;
    }

    static randomData(size: number = 64) {
        return Crypto.randomBytes(size);
    }

    static genKey(secret: string, salt: string, size: number = 32) {
        return Crypto.scryptSync(secret, salt, size);
    }

    static encrypt(algorithm: string, key: Buffer, str: string) {
        const iv = Crypto.randomBytes(16);
        const cipher = Crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(str, 'utf-8', 'base64');
        encrypted += cipher.final('base64');
        return [iv.toString('base64'), encrypted];
    }

    static decrypt(algorithm: string, key: Buffer, iv: string, encrypted: string) {
        const decipher = Crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
        let decryped = decipher.update(encrypted, 'base64', 'utf-8');
        decryped += decipher.final('utf-8');
        return decryped;
    }
}

export function parseCommand(str: string) {
    const r = str.match(/([^ ]+) *(.*)/);
    if (!r) return ['', ''];
    const [, name, args] = r;
    return [name, args];
}

export function arrayUnion(array1: any[], array2: any[]) {
    return Array.from(new Set(array1.concat(array2)));
}

export function onProgramExit(handler: Function = () => {}) {
    function exitHandler(options: { cleanup?: boolean; exit?: boolean }, _exitCode: number) {
        //if (options.cleanup) console.log('clean');
        //if (exitCode || exitCode === 0) console.log(exitCode);
        handler();
        if (options.exit) process.exit();
    }

    //do something when app is closing
    process.on('exit', exitHandler.bind(null, { cleanup: true }));
    process.on('SIGTERM', exitHandler.bind(null, { exit: true }));
    process.on('SIGHUP', exitHandler.bind(null, { exit: true }));

    //catches ctrl+c event
    process.on('SIGINT', exitHandler.bind(null, { exit: true }));

    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
    process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

    //catches uncaught exceptions
    process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
}
