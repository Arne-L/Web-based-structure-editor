export class DraftRecord {
    code;
    warning;
    module; //no point in instantiating the editor itself because it will require an instance of Module anyway
    constructor(code, module, txt) {
        this.code = code;
        this.module = module;
        this.warning = this.module.messageController.addHoverMessage(code, {}, txt ?? "");
        this.code.message = this.warning;
    }
    removeMessage() {
        this.module.messageController.removeMessageFromConstruct(this.code);
    }
}
//# sourceMappingURL=draft.js.map