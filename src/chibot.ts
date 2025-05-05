import os from 'os';
import { inspect } from 'util';

import Discord from 'discord.js';
import { getStatus } from 'mc-server-status';

import config from './config.js';
import * as Bot from './bot.js';
import * as Util from './utils.js';
// import { RemoteTerminalClientProcess, User, UserLevel } from './terminal/index.js';

const assetList = [
    ['gif', ['.gif'], true],
    ['img', ['.jpg', '.png', '.webp'], true],
    ['text', ['.txt'], true],
];

const wordList = [
    [
        'ping',
        /\bping\b/i,
        function (_string: string[], msg: Discord.Message) {
            msg.channel.send('Pong');
        },
        500,
    ],
    [
        'imposter',
        /\bimposter|impostor\b/i,
        function (_string: string[], msg: Discord.Message) {
            msg.channel.send("I'm not the imposter.");
        },
        60 * 1000,
    ],
    [
        'among us',
        /\bamong us\b/i,
        function (_string: string[], msg: Discord.Message) {
            msg.react('🔪');
        },
        500,
    ],
];

export const chibot = new Bot.Bot();
chibot.setPrefix('!chibot');
chibot.setDefault('help');
chibot.setInvalid(chibotInvalid);
chibot.setLogFolder('log');

// setup commands
chibot.addCmd(new Bot.Command('help', chibotHelp).description('display help').usage('[command name]'));

chibot.addCmd(new Bot.Command('gif', chibotGif).description('display gif').usage('<gif name> [id]').needArgument(true));

chibot.addCmd(new Bot.Command('img', chibotImg).description('display image').usage('<image name> [id]').needArgument(true));

chibot.addCmd(new Bot.Command('text', chibotText).description('display text file').usage('<text file name>').needArgument(true).hidden(true));

chibot.addCmd(new Bot.Command('random', chibotRandom).description('display random gif/img').usage('[gif/img]'));

chibot.addCmd(new Bot.Command('status', chibotStatus).description('display chibot status').usage('[log]').hidden(true));

chibot.addCmd(new Bot.Command('reload', chibotReload).description('reload chibot assets').hidden(true));

chibot.addCmd(new Bot.Command('mc', chibotMCStatus).description('minecraft server command').usage('<command>'));

// setup keywords
wordList.forEach((w: any) => {
    chibot.addKeyword(new Bot.Keyword(w[0], w[1], w[2], w[3]));
});

// load assets
assetList.forEach((a: any) => {
    chibot.addAsset(new Bot.Asset(a[0], a[1], a[2]));
});

// Minecraft server status stuff
chibot.data.set('MC_ip', config.MC_ip);
chibot.data.set('MC_port', config.MC_port);

// mc_bot connection
// const mc_bot_process = new RemoteTerminalClientProcess();
// const mc_bot_terminal = mc_bot_process.newTerminal(new User('Chibot', UserLevel.REMOTE));
// mc_bot_terminal.setOutput((data: any) => chibot.log(data));
/*
TODO: need to fix handshake crashing when reconnecting to unstable network
mc_bot_terminal.connect(`${config.MC_ip}:${config.MC_port}`, config.MC_key, {
    history: false
});

setTimeout(() => {
    setInterval(() => {
        if (!mc_bot_terminal.socket) mc_bot_terminal.reconnect(); // auto re-connect
    }, 60 * 1000);
}, 60 * 1000);
*/

function chibotInvalid(_args: string[], msg: Discord.Message) {
    msg.channel.send('Invalid command!');
}

// all !chibot commands

function chibotHelp(args: string[], msg: Discord.Message) {
    const cmdName = Util.nextArg(args);
    const embed = new Discord.MessageEmbed();
    let title = `Chi Bot Help`;
    if (cmdName) title += ` - ${cmdName}`;
    let str = '';
    let asset;
    let i = 0;
    let n;
    let str_arr: string[] = [];
    let str2 = '';
    let cmd;
    switch (cmdName) {
        case 'gif':
            str += `Usage: !chibot gif <gif name> [id]\n\nAvaliable gifs:`;
            asset = chibot.getAsset('gif');
            if (!asset) break;
            n = Math.ceil(asset.fileSetList.size / 3);
            asset.fileSetList.forEach((s: Bot.FileSet) => {
                str_arr.push(`${s.name} ${s.getSize() > 1 ? `[${s.getSize()}]` : ''}\n`);
            });
            for (i = 0; i < str_arr.length; i++) {
                str2 += str_arr[i];
                if ((i + 1) % n == 0) {
                    embed.addField('\u200B', str2, true);
                    str2 = '';
                }
            }
            if (str2) embed.addField('\u200B', str2, true);
            break;

        case 'img':
            str += `Usage: !chibot img <image name> [id]\n\nAvaliable images:`;
            asset = chibot.getAsset('img');
            if (!asset) break;
            n = Math.ceil(asset.fileSetList.size / 3);
            asset.fileSetList.forEach((s: Bot.FileSet) => {
                str_arr.push(`${s.name} ${s.getSize() > 1 ? `[${s.getSize()}]` : ''}\n`);
            });
            for (i = 0; i < str_arr.length; i++) {
                str2 += str_arr[i];
                if ((i + 1) % n == 0) {
                    embed.addField('\u200B', str2, true);
                    str2 = '';
                }
            }
            if (str2) embed.addField('\u200B', str2, true);
            break;

        case 'mc':
            //str += `Minecraft server service is down for now\n\n` // fix this later
            //break;
            str += `Usage: !chibot mc <command>\n\nAvaliable commands:\n`;
            str += `\nstatus [update]\nDisplay Minecraft Server Status\n`;
            str += `\nstopUpdate\nStop Auto Updating Minecraft Server Status\n`;
            str += `\nset\nSet Minecraft Server ip:port\n`;
            // str += `\nstart\nStart Minecraft Server\n`;
            // str += `\nstop\nShut down Minecraft Server\n`;
            // str += `\nsay <message>\nSend message to minecraft server\n`;
            // str += `\nop <player name>\nSet op for player\n`;
            break;

        case 'help':
            cmd = chibot.cmdList.get(cmdName);
            if (cmd) {
                embed.addField('\u200B', `${cmd.getUsageString()}\n${cmd.getDescriptionString()}\n`, true);
            }
            break;

        default:
            cmd = chibot.cmdList.get(cmdName);
            if (cmd) {
                embed.addField('\u200B', `${cmd.getUsageString()}\n${cmd.getDescriptionString()}\n`, true);
            } else {
                str += `Usage: !chibot <command>\n!chibot help <command>\n\nAvaliable commands:`;
                chibot.cmdList.forEach((l: Bot.Command) => {
                    if (!l._hidden) str_arr.push(`${l.getUsageString()}\n${l.getDescriptionString()}`);
                });
                embed.addField('\u200B', str_arr.join('\n\n'), true);
            }
    }
    embed.setTitle(title).setColor(0xdddddd).setDescription(str);
    msg.channel.send({ embeds: [embed] });
}

async function chibotAsset(args: string[], msg: Discord.Message, assetTarget: string) {
    const name = Util.nextArg(args);
    const asset = chibot.getAsset(assetTarget);
    if (!asset) {
        msg.channel.send(`Error: Invalid assetTarget [${assetTarget}].`);
        return;
    }
    const file = asset.getFileSet(name);
    const i = Util.nextArg(args);
    const id = i ? parseInt(i, 10) : NaN;

    chibot.log(`[chibotAsset: ${assetTarget}] ${assetTarget} requested : ${name} [${id}]`);

    if (!file) {
        msg.channel.send(`Invalid ${assetTarget} name.`);
        return;
    }

    if (i) {
        if (isNaN(id) || id < 0 || id >= file.getSize()) {
            msg.channel.send(`Invalid ${assetTarget} file index.`);
            return;
        }
    }

    const data = await file.getFile(id);
    if (!data) {
        msg.channel.send(`Error: Failed to load ${assetTarget}.`);
        chibot.log(`[chibotAsset: ${assetTarget}] load file failed.`);
        return;
    }
    if (asset.name == 'text') {
        const text = data.toString();
        msg.channel.send(text);
    } else {
        const att = new Discord.MessageAttachment(data, file.getFileName(0));
        msg.channel.send({ files: [att] });
    }
}

function chibotGif(args: string[], msg: Discord.Message) {
    chibotAsset(args, msg, 'gif');
}

function chibotImg(args: string[], msg: Discord.Message) {
    chibotAsset(args, msg, 'img');
}

function chibotText(args: string[], msg: Discord.Message) {
    chibotAsset(args, msg, 'text');
}

function chibotRandom(args: string[], msg: Discord.Message) {
    let type = Util.nextArg(args);
    chibot.log(`[random] random gif/img requested: [${type}]`);
    if (!type) type = Math.random() > 0.5 ? 'gif' : 'img';
    if (type != 'gif' && type != 'img') {
        msg.channel.send('Invalid random type.');
        return;
    }

    const asset = chibot.getAsset(type);
    if (!asset) return;

    let list = Array.from(asset.fileSetList.keys());
    if (list.length == 0) {
        msg.channel.send(`Empty Asset list: [${type}]`);
        return;
    }
    let n = Math.floor(Math.random() * list.length);
    chibotAsset([list[n]], msg, type);
}

function chibotStatus(args: any, msg: Discord.Message) {
    let str = '';
    str += `OS current status:`;
    str += `\nOS: ${os.type()}`;
    str += `\nCPU: ${os.cpus()[0].model}`;
    str += `\nRAM: ${Math.round((os.totalmem() - os.freemem()) / (1024 * 1024))} MB / ${Math.round(os.totalmem() / (1024 * 1024))} MB`;
    str += `\nload: [${os
        .loadavg()
        .map((n) => Math.round(n * 10000) / 100)
        .join(', ')}]`;

    const log = chibot.logList;
    let errorCount = 0;
    log.forEach((l: Bot.Log) => {
        if (l.error) errorCount++;
    });
    let n = 0;

    if (errorCount > 0) {
        str += `\n\n${errorCount} errors total in log, displaying maximum of 10:`;
        log.forEach((l: Bot.Log) => {
            if (l.error && n < 10) {
                str += `\n${l.toString()}`;
                n++;
            }
        });
    } else {
        str += `\n\nThere is no error so far.`;
    }

    n = 0;
    if (Util.nextArg(args) === 'log') {
        if (log.length > 0) {
            str += `\n\n${log.length} entries total in log, displaying maximum of 25:`;
            log.forEach((l: { toString: () => any }) => {
                if (n < 25) {
                    str += `\n${l.toString()}`;
                    n++;
                }
            });
        } else {
            str += `\n\nThere is no log so far.`;
        }
    }

    const embed = new Discord.MessageEmbed().setTitle('Chi Bot Status').setColor(0xdddddd).setDescription(str);
    msg.channel.send({ embeds: [embed] });
}

function chibotReload(_args: string[], msg: Discord.Message) {
    assetList.forEach((a: any) => {
        const asset = chibot.getAsset(a[0]);
        if (asset) asset.reload();
    });
    msg.channel.send('Chibot assets reloaded.');
}

let MCStatusUpdateMessage: Discord.Message<boolean> | undefined;
setInterval(async () => {
    try {
        if (MCStatusUpdateMessage) {
            const embed = new Discord.MessageEmbed()
                .setTitle('Minecraft Server Status')
                .setColor(0xdddddd)
                .setDescription(await getMCStatusString(true));
            MCStatusUpdateMessage.edit({ embeds: [embed] });
        }
    } catch (error) {
        chibot.log(`MCStatusUpdateMessage`, error as Error);
        MCStatusUpdateMessage = undefined;
    }
}, 5 * 60 * 1000);

async function chibotMCStatus(args: string[], msg: Discord.Message) {
    let str = '';
    // let ip = chibot.data.get('MC_ip');
    switch (Util.nextArg(args)) {
        // case 'start':
        //     if (mc_bot_terminal.socket) {
        //         mc_bot_terminal.input(`/start`);
        //         msg.channel.send(`Minecraft server starting.`);
        //     } else {
        //         msg.channel.send(`Failed to start server.`);
        //     }
        // break;

        // case 'stop':
        //     if (mc_bot_terminal.socket) {
        //         mc_bot_terminal.input(`/stop`);
        //         msg.channel.send(`Minecraft server shutting down.`);
        //     } else {
        //         msg.channel.send(`Failed to shut down server.`);
        //     }
        // break;

        // case 'say':
        //     if (!mc_bot_terminal.socket) {
        //         msg.channel.send(`Failed to send message.`);
        //         return;
        //     }
        //     mc_bot_terminal.input(`/say discord: ${args.join(' ')}`);
        // break;

        // case 'op':
        //     if (!mc_bot_terminal.socket) {
        //         msg.channel.send(`Failed to send message.`);
        //         return;
        //     }
        //     mc_bot_terminal.input(`/op ${args.join(' ')}`);
        // break;

        case 'set':
            {
                const ip = Util.nextArg(args);
                const port = Util.nextArg(args);
                if (ip) chibot.data.set('MC_ip', ip);
                if (port) chibot.data.set('MC_port', port);
            }
            break;

        case 'stopUpdate':
            MCStatusUpdateMessage = undefined;
            msg.channel.send(`Stopping auto update.`);
            break;

        default:
        case 'status':
            let nextArg = Util.nextArg(args);
            let update = nextArg === 'update';
            str = await getMCStatusString(update);
            const embed = new Discord.MessageEmbed().setTitle('Minecraft Server Status').setColor(0xdddddd).setDescription(str);
            let msgSent = await msg.channel.send({ embeds: [embed] });
            if (update) {
                MCStatusUpdateMessage = msgSent;
            }
            break;
    }
}

async function getMCStatusString(update: boolean) {
    let str = '';
    let status = null;
    try {
        status = await getStatus(chibot.data.get('MC_ip'), chibot.data.get('MC_port'));
    } catch (e: any) {
        chibot.log('Failed to get Minecraft server status.', e);
        chibot.log(`Minecraft server IP: ${chibot.data.get('MC_ip')}:${chibot.data.get('MC_port')}`);
    }
    str = '';
    str += `Minecraft server IP: ${chibot.data.get('MC_ip')}:${chibot.data.get('MC_port')}\n`;
    if (update) {
        const unixTimestamp = Math.floor(Date.now() / 1000);
        str += `Last Update: <t:${unixTimestamp}:t>\n`;
    }
    // str += `Websocket ${mc_bot_terminal.socket? 'connected' : 'disconnected'}.\n`;
    if (status) {
        str += `Server is up and running.\n`;
        str += `Description: ${inspect(status.description)}\n`; // definitely not string but idk what is the format
        str += `Version: ${status.version.name}\n`;
        str += `Players: ${status.players.online}/${status.players.max}\n`;
        str += `Ping: ${status.ping} ms\n`;
    } else {
        str += `Server is not responding.\n`;
    }
    return str;
}
