import { ErrorMessageGenerator } from "./error-msg-generator";
import { HoverMessage, PopUpMessage } from "./messages";
const popUpMessageTime = 3000; //ms
const defaultHighlightColour = [255, 191, 94, 0.3];
/**
 * Class representing the main entry point of the code into the MessageController.
 * Top-level class for handling workflow; message system logic is in MessageController.
 */
export class MessageController {
    editor;
    messages;
    msgGenerator;
    module; //TODO: Find some other way to get this. Probably should not be passing this around, maybe make it a method argument for methods that need it, instead of each instance holding a reference
    constructor(editor, module) {
        this.editor = editor;
        this.messages = [];
        this.msgGenerator = new ErrorMessageGenerator();
        this.module = module;
    }
    /**
     * Add a hover message to a code construct.
     *
     * @param code       code construct being added to (hole, empty line, etc... Not the code being added)
     * @param args       context for constructing appropriate message. See error-msg-generator.ts for more info
     * @param errMsgType type of error message that should be displayed when hovered over
     */
    addHoverMessage(codeToHighlight, args, warningText, errMsgType, highlightColour = defaultHighlightColour) {
        if (!codeToHighlight.message) {
            const message = new HoverMessage(this.editor, codeToHighlight, errMsgType ? this.msgGenerator.generateMsg(errMsgType, args) : warningText ?? "Placeholder Text", highlightColour, this.messages.length);
            this.messages.push(message);
            codeToHighlight.message = message;
            return message;
        }
        else {
            this.removeMessageFromConstruct(codeToHighlight);
            return this.addHoverMessage(codeToHighlight, args, warningText, errMsgType, highlightColour);
        }
    }
    /**
     * Add a pop-up message to the editor at the specified position.
     *
     * If args and errMsgType are specified, there is no need to specify text as it will be auto-generated.
     */
    addPopUpMessage(code, args, errMsgType, text) {
        if (text) {
            this.messages.push(new PopUpMessage(this.editor, code, this.msgGenerator.generateMsg(errMsgType, args) ?? text, this.messages.length));
        }
        else {
            this.messages.push(new PopUpMessage(this.editor, code, this.msgGenerator.generateMsg(errMsgType, args) ?? text, this.messages.length));
        }
        const message = this.messages[this.messages.length - 1];
        setTimeout(() => {
            message.removeFromDOM();
            this.messages.splice(message.systemIndex);
        }, popUpMessageTime);
    }
    /**
     * Remove message from given code construct if it exists.
     *
     * @param code code construct to remove message from
     */
    removeMessageFromConstruct(code) {
        if (code?.message) {
            const indexOfMessage = this.messages.indexOf(code.message);
            this.messages[code.message.systemIndex].removeFromDOM();
            this.messages.splice(code.message.systemIndex, 1);
            code.message = null;
            for (let i = indexOfMessage; i < this.messages.length; i++) {
                this.messages[i].systemIndex--;
            }
        }
        else {
            console.warn("Could not remove message from construct: " + code);
        }
    }
    /**
     * Remove all currently open messages from the editor.
     */
    clearAllMessages() {
        this.messages.forEach((message) => {
            message.removeFromDOM();
        });
        this.messages = [];
    }
}
//# sourceMappingURL=message-controller.js.map