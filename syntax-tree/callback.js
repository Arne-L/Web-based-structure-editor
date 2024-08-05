export class Callback {
    static counter = 0;
    callback;
    callerId;
    constructor(callback) {
        this.callback = callback;
        this.callerId = "caller-id-" + Callback.counter;
        Callback.counter++;
    }
}
/**
 * Enumeration of all callback types available.
 */
export var CallbackType;
(function (CallbackType) {
    CallbackType[CallbackType["change"] = 0] = "change";
    CallbackType[CallbackType["replace"] = 1] = "replace";
    CallbackType[CallbackType["delete"] = 2] = "delete";
    CallbackType[CallbackType["fail"] = 3] = "fail";
    CallbackType[CallbackType["focusEditableHole"] = 4] = "focusEditableHole";
    CallbackType[CallbackType["showAvailableVars"] = 5] = "showAvailableVars";
    CallbackType[CallbackType["onFocusOff"] = 6] = "onFocusOff";
})(CallbackType || (CallbackType = {}));
//# sourceMappingURL=callback.js.map