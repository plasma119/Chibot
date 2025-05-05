export enum UserLevel {
    NONE = 1,
    REMOTE,
    LOCAL,
    ADMIN,
    SYSTEM,
    ROOT,
}

export class User {
    name: string;
    private _level: UserLevel;
    constructor(name: string, level: UserLevel) {
        this.name = name;
        this._level = level;
    }

    getLevel() {
        return this._level;
    }

    getLevelString() {
        return UserLevel[this._level];
    }

    getPrompt() {
        return `[${this.getLevelString()}]${this.name}`;
    }

    /** Upgrade user's priviledge */
    upgrade(toLevel: UserLevel, byUser: User) {
        if (!byUser.satisfy(toLevel)) return false;
        this._level = toLevel;
        return true;
    }

    /** Downgrade user's priviledge */
    downgrade(toLevel: UserLevel) {
        if (!this.satisfy(toLevel)) return false;
        this._level = toLevel;
        return true;
    }

    /** Check priviledge */
    satisfy(level: UserLevel) {
        return this._level >= level;
    }
}
