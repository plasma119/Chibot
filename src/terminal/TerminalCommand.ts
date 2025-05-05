import * as Command from 'commander';

import { version } from '.';

export class TerminalCommand extends Command.Command {
    completions: string[];

    constructor(name?: string) {
        super(name);
        this.version(version);
        this.exitOverride();
        this.configureOutput({
            writeOut: () => {},
            writeErr: () => {},
        });
        this.configureHelp({
            commandUsage: function (cmd: Command.Command) {
                return cmd.name() + ' ' + cmd.usage();
            },
        });
        this.addHelpCommand('/help [cmd]', 'display help for [cmd]');
        this.completions = ['/help'];
    }

    createCommand(name: string) {
        if (name != '/help') this.completions.push(name);
        return super.createCommand(name);
    }

    createHelp() {
        return Object.assign(new TerminalCommandHelp(), this.configureHelp());
    }

    parse(argv: string[], parseOptions: Command.ParseOptions) {
        if (argv[0] == '/help' && argv[1]) {
            if (argv[1].charAt(0) != '/') argv[1] = '/' + argv[1];
        }
        return super.parse(argv, parseOptions);
    }
}

class TerminalCommandHelp extends Command.Help {
    formatHelp(cmd: Command.Command, helper: Command.Help) {
        const termWidth = helper.padWidth(cmd, helper);
        const helpWidth = helper.helpWidth || 80;
        const itemIndentWidth = 2;
        const itemSeparatorWidth = 2; // between term and description
        function formatItem(term: string, description: string) {
            if (description) {
                const fullText = `${term.padEnd(termWidth + itemSeparatorWidth)}${description}`;
                return helper.wrap(fullText, helpWidth - itemIndentWidth, termWidth + itemSeparatorWidth);
            }
            return term;
        }
        function formatList(textArray: string[]) {
            return textArray.join('\n').replace(/^/gm, ' '.repeat(itemIndentWidth));
        }

        let output: string[] = [];

        // Description
        const commandDescription = helper.commandDescription(cmd);
        if (commandDescription.length > 0) {
            output = output.concat([commandDescription, '']);
        }

        // Commands
        const commandList = helper.visibleCommands(cmd).map((cmd) => {
            return formatItem(helper.subcommandTerm(cmd), helper.subcommandDescription(cmd));
        });
        if (commandList.length > 0) {
            output = output.concat(['Commands:', formatList(commandList), '']);
        }

        return output.join('\n');
    }
}
