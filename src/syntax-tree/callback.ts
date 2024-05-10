import { Construct } from "./ast";

export class Callback {
    static counter: number = 0;
    callback: (code: Construct) => void;
    callerId: string;

    constructor(callback: (code: Construct) => void) {
        this.callback = callback;
        this.callerId = "caller-id-" + Callback.counter;
        Callback.counter++;
    }
}

/**
 * Enumeration of all callback types available.
 */
export enum CallbackType {
    change,
    replace,
    delete,
    fail,
    focusEditableHole,
    showAvailableVars,
    onFocusOff,
}
