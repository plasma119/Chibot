import * as fs from 'fs';

type Config = {
    token: string; // discord token
    terminalHost: string;
    terminalPort: number;
    terminalKey: string;
    // Minecraft server system, deprecated
    MC_ip: string;
    MC_port: number;
    MC_key: string;
    ClubGuild: string;
    ClubWelcomeChannel: string;
    ClubMCChannel: string;
};

let config: Config = {
    token: '',
    terminalHost: '',
    terminalPort: 8080,
    terminalKey: '',
    MC_ip: '',
    MC_port: 25565,
    MC_key: '',
    ClubGuild: '',
    ClubWelcomeChannel: '',
    ClubMCChannel: '',
};
const configFilePath = 'config.json';

if (fs.existsSync(configFilePath)) {
    try {
        const configFileConfig: Config = JSON.parse(fs.readFileSync(configFilePath).toString());
        config = Object.assign(config, configFileConfig);
    } catch (e) {
        console.log(e);
    }
} else {
    console.log('Warning! config.json not found!');
}

export default config;
