import { EventEmitter } from 'events';
import { inspect } from 'util';

import { User, UserLevel } from './User';

interface BasicComponentInterface {
    input(data: any, info: DataInfo): void;
    output(data: any, info: DataInfo): void;
}

export type DataInfo = {
    user: User;
    options?: { [key: string]: any };
    timestamp?: number;
    trace?: {
        at: BasicComponent;
        event: string;
    }[];
};

type DataPipe = ((data: any) => void) | ((data: any, info: DataInfo) => void);

type PipeType = {
    base: BasicComponent;
    target: BasicComponent;
    function: DataPipe;
    bind: DataPipe;
    event: string;
};

type PipeRecord = {
    record: PipeType;
    log: string;
    success: boolean;
};

const baseUser = new User('BasicComponent', UserLevel.SYSTEM);

export class BasicComponent extends EventEmitter implements BasicComponentInterface {
    _pipeFromTargets: PipeType[] = [];
    _pipeToTargets: PipeType[] = [];
    private _pipeRecords: PipeRecord[] = [];

    constructor() {
        super();
        this.setMaxListeners(0); // becareful of memory leaks!
    }

    input(data: any, info: DataInfo) {
        if (!info.trace) info.trace = [];
        info.trace.push({ at: this, event: 'input' });
        this.emit('input', data, info);
        this._input(data, info);
    }

    _input(_data: any, _info: DataInfo) {}

    setInput(input: DataPipe) {
        this._input = input;
    }

    output(data: any, info: DataInfo) {
        if (!info.trace) info.trace = [];
        info.trace.push({ at: this, event: 'output' });
        this.emit('output', data, info);
        this._output(data, info);
    }

    _output(_data: any, _info: DataInfo) {}

    setOutput(output: DataPipe) {
        this._output = output;
    }

    private _buildRecordPipeFrom(target: BasicComponent, event: string, to: DataPipe): PipeType {
        return {
            base: target,
            target: this,
            function: to,
            bind: to.bind(this),
            event: event,
        };
    }

    private _buildRecordPipeTo(target: BasicComponent, event: string, to: DataPipe): PipeType {
        return {
            base: this,
            target: target,
            function: to,
            bind: to.bind(target),
            event: event,
        };
    }

    private _pipeLog(record: PipeType, log: string, success: boolean) {
        this._pipeRecords.push({ record: record, log: log, success: success });
        return success;
    }

    pipeFrom(target: BasicComponent, event: string = 'output', to = this.input) {
        const record = this._buildRecordPipeFrom(target, event, to);
        if (findPipeTarget(this._pipeFromTargets, record) > -1) return this._pipeLog(record, 'pipeFrom', false);
        target.on(event, record.bind);
        this._pipeFromTargets.push(record);
        target._pipeToTargets.push(record);
        return this._pipeLog(record, 'pipeFrom', true);
    }

    pipeTo(target: BasicComponent, event: string = 'output', to = target.input) {
        const record = this._buildRecordPipeTo(target, event, to);
        if (findPipeTarget(this._pipeToTargets, record) > -1) return this._pipeLog(record, 'pipeTo', false);
        this.on(event, record.bind);
        this._pipeToTargets.push(record);
        target._pipeFromTargets.push(record);
        return this._pipeLog(record, 'pipeTo', true);
    }

    unPipeFrom(target: BasicComponent, event: string = 'output', to = this.input) {
        const record = this._buildRecordPipeFrom(target, event, to);
        const i = findPipeTarget(this._pipeFromTargets, record);
        if (i === -1) return this._pipeLog(record, 'unPipeFrom@find record', false);
        const c = target.listenerCount(event);
        target.off(event, this._pipeFromTargets[i].bind);
        if (c === target.listenerCount(event)) return this._pipeLog(record, 'unPipeFrom@remove event', false);
        this._pipeFromTargets.splice(i, 1);
        const j = findPipeTarget(target._pipeToTargets, record);
        if (j === -1) return this._pipeLog(record, 'unPipeFrom@remove target record', false);
        target._pipeToTargets.splice(j, 1);
        return this._pipeLog(record, 'unPipeFrom', true);
    }

    unPipeTo(target: BasicComponent, event: string = 'output', to = target.input) {
        const record = this._buildRecordPipeTo(target, event, to);
        const i = findPipeTarget(this._pipeToTargets, record);
        if (i === -1) return this._pipeLog(record, 'unPipeTo@find record', false);
        const c = this.listenerCount(event);
        this.off(event, this._pipeToTargets[i].bind);
        if (c === this.listenerCount(event)) return this._pipeLog(record, 'unPipeTo@remove event', false);
        this._pipeToTargets.splice(i, 1);
        const j = findPipeTarget(target._pipeFromTargets, record);
        if (j === -1) return this._pipeLog(record, 'unPipeTo@remove target record', false);
        target._pipeFromTargets.splice(j, 1);
        return this._pipeLog(record, 'unPipeTo', true);
    }

    unPipeAll() {
        let targets = this._pipeFromTargets.slice();
        targets.forEach((record) => {
            this.unPipeFrom(record.base, record.event, record.function);
        });
        targets = this._pipeToTargets.slice();
        targets.forEach((record) => {
            this.unPipeTo(record.target, record.event, record.function);
        });
    }

    hasPipeFrom(target: BasicComponent, event: string = 'output', to = this.input) {
        const record = this._buildRecordPipeFrom(target, event, to);
        return findPipeTarget(this._pipeFromTargets, record) > -1;
    }

    hasPipeTo(target: BasicComponent, event: string = 'output', to = target.input) {
        const record = this._buildRecordPipeTo(target, event, to);
        return findPipeTarget(this._pipeToTargets, record) > -1;
    }

    pipeDebug() {
        let str = '';
        str += `pipeFrom list: `;
        str += inspect(this._pipeFromTargets.map(formatRecord), false, 2);
        str += `\npipeTo list: `;
        str += inspect(this._pipeToTargets.map(formatRecord), false, 2);
        this.output(str, { user: baseUser });
    }

    pipeDebugShowLog(records: PipeRecord[] = this._pipeRecords) {
        this.output(
            records.map((r) => {
                return {
                    record: formatRecord(r.record),
                    log: r.log,
                    success: r.success,
                };
            }),
            { user: baseUser }
        );
    }

    pipeDestroy() {
        this.unPipeAll();
        const records = this._pipeRecords;
        this._pipeRecords = [];
        this._pipeFromTargets = [];
        this._pipeToTargets = [];
        this.removeAllListeners();
        return records;
    }
}

function findPipeTarget(arr: PipeType[], match: PipeType) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].function == match.function && arr[i].event == match.event) return i;
    }
    return -1;
}

function formatRecord(record: PipeType) {
    return {
        base: inspect([record.base], false, 0),
        target: inspect([record.target], false, 0),
        function: inspect(record.function, false, 0),
        event: record.event,
    };
}
