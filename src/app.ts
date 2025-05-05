import { inspect } from 'util';

import * as Discord from 'discord.js';

import config from './config.js';
import { chibot } from './chibot.js';
import { RemoteTerminalProcess, TerminalPrompt, User, UserLevel } from './terminal';
import * as Util from './utils.js';

// discord client
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MEMBERS],
});

// guild/channel setup
client.on('ready', () => {
    chibot.log(`Logged in as ${client.user?.tag}!`);
    try {
        const ClubGuild = client.guilds.cache.get(config.ClubGuild);
        if (!ClubGuild) return;
        chibot.data.set('AnimeClubGuild', ClubGuild);

        const welcomeChannel = ClubGuild.channels.cache.get(config.ClubWelcomeChannel);
        chibot.data.set('AnimeClubWelcomeChannel', welcomeChannel);
        chibot.data.set('AnimeClubMember', ClubGuild.memberCount);
        chibot.log(`Now listening to Anime club: member count [${ClubGuild.memberCount}]`);
        chibot.log(`Set welcome channel to [${ClubGuild.name}]->[${welcomeChannel?.name}]`);

        const MCChannel = ClubGuild.channels.cache.get(config.ClubMCChannel);
        if (MCChannel) {
            chibot.log(`Set minecraft status channel to [${ClubGuild.name}]->[${MCChannel.name}]`);
        }
        /*
        setInterval(() => {
            const count = guild.memberCount;
            if (count > chibot.data.get("AnimeClubMember")) {
                // listener failed
                chibot.data.set("AnimeClubMember", guild.memberCount);
                chibot.execute('!chibot text welcome', {channel: channel});
            } else if (count < chibot.data.get("AnimeClubMember")) {
                // someone left
                chibot.data.set("AnimeClubMember", guild.memberCount);
            }
        }, 2000);
        */
    } catch (e: any) {
        chibot.log('Failed to hook to anime club.', e);
    }
    setInterval(() => {
        // Set the client user's activity
        client.user?.setActivity('Human', { type: 'WATCHING' });
    }, 5 * 60 * 1000);
});

let last_bonk: number = 0;
// message reaction
client.on('messageCreate', (msg) => {
    // ping command
    if (msg.content === '!chibot ping') {
        last_bonk = msg.createdTimestamp;
        msg.channel.send(`!chibot pong: ${Date.now() - msg.createdTimestamp}`);
        return;
    } else if (msg.content.slice(0, 12) === '!chibot pong') {
        msg.channel.send(`!chibot bonk: ${msg.createdTimestamp - last_bonk}`);
        return;
    }

    // self message
    if (msg.author.tag == client.user?.tag) return;

    // log file
    if (chibot.logFile) {
        chibot.logFile.write(
            `[${new Date(Date.now()).toLocaleString()}] ${msg.guild?.name}->${msg.guild?.channels.cache.get(msg.channelId)?.name}> [${
                msg.author.tag
            }]: ${msg.content}\n`
        );
    }

    // Mudae extension
    if (msg.author.tag == 'Mudae#0807') {
        try {
            msg.embeds.forEach((e) => {
                if (e.description && e.description.match(/\bReact with any emoji to claim\b/i)) {
                    const delay = Date.now() - msg.createdTimestamp;
                    if (msg.webhookId) {
                        //chibot.log('Sending Mudae slash claim reaction');
                        msg.react(mudaeHeartReactionList[Util.randInt(mudaeHeartReactionList.length)]);
                        Util.wait(85000 - delay).then(() => {
                            msg.react('5️⃣');
                            Util.wait(5000).then(() => {
                                msg.react('0️⃣');
                            });
                        });
                    } else {
                        //chibot.log('Sending Mudae claim reaction');
                        msg.react(mudaeHeartReactionList[Util.randInt(mudaeHeartReactionList.length)]);
                        Util.wait(40000 - delay).then(() => {
                            msg.react('5️⃣');
                            Util.wait(5000).then(() => {
                                msg.react('0️⃣');
                            });
                        });
                    }
                }
            });
        } catch (e: any) {
            chibot.log('Mudae claim reaction failed.', e);
        }
        return;
    }

    // test command
    if (msg.content === '!chibot fakejoin') {
        if (msg.member) client.emit('guildMemberAdd', msg.member);
        return;
    }

    // keyword execution
    chibot.executeKeyword(msg.content, msg);

    // command execution
    chibot.execute(msg.content, msg);
});

client.on('messageReactionAdd', (messageReaction, user) => {
    const { message, emoji } = messageReaction;
    // Mudae extension
    if (user.tag == 'Mudae#0807') {
        if (mudaeHeartReaction.has(emoji.toString())) {
            Util.wait(40000).then(() => {
                message.react('5️⃣');
                Util.wait(5000).then(() => {
                    message.react('0️⃣');
                });
            });
        }
    }
});

client.on('guildMemberAdd', (member) => {
    chibot.log(`${member.user.tag} joined server ${member.guild.name}`);
    if (member.guild.id === config.ClubGuild) {
        chibot.data.set('AnimeClubMember', chibot.data.get('AnimeClubGuild').memberCount);
        chibot.log(`new member ${member.user.tag} joined the anime club`);
        const channel = member.guild.channels.cache.get(config.ClubWelcomeChannel);
        if (!channel) return;
        if (member.user.bot) {
            chibot.log(`It's a BOT!`);
            chibot.execute('!chibot text welcomeBot', { channel: channel });
        } else {
            chibot.log(`sending welcome text to channel ${channel.name}`);
            chibot.execute('!chibot text welcome', { channel: channel });
        }
    }
});

const mudaeHeartReaction: Map<string, number> = new Map();
const mudaeHeartReactionList = ['❤️', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️'];
mudaeHeartReactionList.forEach((a) => mudaeHeartReaction.set(a, 1));

process.on('unhandledRejection', (e: any) => {
    chibot.log('unhandledRejection', e);
});

// prepare terminal
const user = new User('serverAdmin', UserLevel.ADMIN);
const server = new RemoteTerminalProcess('Chibot Terminal');
const terminal = server.newTerminal(user);

const prompt = new TerminalPrompt();
terminal.usePrompt(prompt);

server.startServer(config.terminalKey, config.terminalPort);

// start chibot
chibot.debug = true;
chibot.setStdout(server.output.bind(server));
chibot.init();

// top secret token
client.login(config.token);

// setup terminal program
{
    let guild: Discord.Guild | null = null;
    let channel: Discord.TextChannel | null = null;

    const buildPrompt = () => {
        let str = '';
        if (guild) str += guild.name;
        if (channel) str += `->${channel.name}`;
        return str + '>';
    };

    const getChannel = (n: number): Discord.Channel | null => {
        let i = 1;
        let r = null;
        if (!guild) return null;
        guild.channels.cache.forEach((c) => {
            if (i++ == n) r = c;
        });
        return r;
    };

    const p = server.program;
    p.command('/guild')
        .option('-d, --detail [detail]', 'display details', false)
        .option('-si, --switchTo <index>', 'switch guild', '-1')
        .action((args) => {
            let { detail, switchTo } = args;
            if (detail) {
                server.output(inspect(client.guilds.cache, false, 2, true));
                return;
            } else if (switchTo > 0) {
                let i = 1;
                client.guilds.cache.forEach((g) => {
                    if (i++ == switchTo) {
                        guild = g;
                        channel = null;
                        server.output(`switched to guild [${g.name}]!`);
                        server.setPromptString(buildPrompt());
                    }
                });
            } else {
                let i = 1;
                client.guilds.cache.forEach((g) => {
                    server.output(`[${i++}] [${g.id}] guild [${g.name}]`);
                });
            }
            args['detail'] = false;
            args['switchTo'] = -1;
        });

    p.command('/channel')
        .option('-d, --detail [index]', 'display details', '-1')
        .option('-si, --switchTo <index>', 'switch channel', '-1')
        .action((args) => {
            if (!guild) {
                server.output(`please select a guild first.`);
                return;
            }
            const { detail, switchTo } = args;
            if (detail >= 0) {
                let c = getChannel(detail);
                if (c) {
                    server.output(inspect(c, false, 2, true));
                } else {
                    server.output(inspect(guild.channels.cache, false, 2, true));
                }
            } else if (switchTo > 0) {
                let c = getChannel(switchTo);
                if (!c) {
                    server.output(`invalid index.`);
                    return;
                } else if (!(c instanceof Discord.TextChannel)) {
                    server.output(`can only switch to text channel.`);
                    return;
                } else {
                    channel = c;
                    server.output(`switched to channel [${c.name}]!`);
                    server.setPromptString(buildPrompt());
                }
            } else {
                let i = 1;
                guild.channels.cache.forEach((c) => {
                    server.output(`[${i++}] [${c.type}] [${c.id}] channel [${c.name}]`);
                });
            }
            args['detail'] = -1;
            args['switchTo'] = -1;
        });

    p.command('/chat')
        .option('-d, --detail [detail]', 'display details', false)
        .option('-dm, --detailMessage [detailMessage]', 'display message details', false)
        .action((args) => {
            if (!channel) {
                server.output(`please select a channel first.`);
                return;
            }
            const { detail, detailMessage } = args;
            if (detail) {
                args['detail'] = false;
                server.output(inspect(channel, false, 2, true));
                return;
            } else if (detailMessage) {
                args['detailMessage'] = false;
                server.output(inspect(channel.messages, false, 2, true));
                return;
            } else {
                channel.messages
                    .fetch({ limit: 10 })
                    .then((res) => {
                        let i = 0;
                        res.forEach((m) => {
                            i++;
                            server.output(`[${i}][${new Date(m.createdTimestamp).toLocaleTimeString()}][${m.author.tag}]: ${m.content}`);
                            m.attachments.forEach((a) => server.output(a.attachment.toString()));
                        });
                    })
                    .catch(server.output);
            }
        });

    p.command('/say')
        .argument('<text>')
        .action((arg) => {
            if (!channel) {
                server.output(`please select a channel first.`);
                return;
            }

            // send msg
            let str = arg;
            channel.send(str);
            server.output(`sent message [${str}].`);
        });

    p.command('/embed')
        .argument('<text>')
        .action((arg) => {
            if (!channel) {
                server.output(`please select a channel first.`);
                return;
            }

            // send msg
            let embed = new Discord.MessageEmbed();
            let str = arg;
            str = str.replace(/\\n/gi, '\n');
            str = str.replace(/\\u200B/gi, '\u200B');
            embed.setTitle('Chibot:').setColor(0xdddddd).setDescription(str);
            channel.send({ embeds: [embed] });
            server.output(`sent message [${str}].`);
        });

    p.command('/execute')
        .argument('<command>')
        .action((arg) => {
            if (!channel) {
                server.output(`please select a channel first.`);
                return;
            }

            // execute
            let str = arg;
            let msg = { channel: channel, guild: guild }; // fake msg data
            chibot.execute(str, msg, true);
        });

    p.command('/where')
        .description('display current target guild and channel')
        .action(() => {
            server.output(`${guild}->${channel?.name}`);
        });

    p.command('/debug').action(() => {
        chibot.debug = !chibot.debug;
        server.output(`DEBUG: ${chibot.debug}`);
    });

    p.command('/stop').action(() => {
        client.destroy();
        server.output('The Imposter has quit the game.');
        process.exit();
    });
}
