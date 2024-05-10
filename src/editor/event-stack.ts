import { editor, IKeyboardEvent, IScrollEvent } from "monaco-editor";
import { Module } from "../syntax-tree/module";
import { navigationKeys } from "../language-definition/settings";

/**
 * Enumeration of all the external editor events that can be triggered.
 */
export enum EventType {
    OnKeyDown,
    OnButtonDown,
    OnMouseMove,
    OnDidScrollChange,
    OnCursorPosChange,
}

/**
 * Class representing an event. Used to store events in the event stack with a given type and event
 * cause (e.g. the id of the button that caused the event).
 */
export class EventAction {
    type: EventType;
    event: any;

    constructor(type: EventType, event: any) {
        this.type = type;
        this.event = event;
    }
}

export class EventStack {
    stack = [];
    module: Module;

    constructor(module: Module) {
        this.module = module;

        this.attachOnKeyDownListener();
        this.attachOnButtonPress();
        this.attachOnMouseMoveListener();
        this.attachOnDidScrollChangeListener();
        this.attachOnCursorPosChange();
    }

    // undo() {
    //     // Undo the 'ctrl' press after 'ctrl + z'
    //     if (
    //         this.stack[this.stack.length - 1].type === EventType.OnKeyDown &&
    //         this.stack[this.stack.length - 1].event.ctrlKey
    //     ) {
    //         this.stack.pop();
    //     }

    //     // Undo the most recent action
    //     this.stack.pop();

    //     this.module.reset();

    //     // TODO: find why this needs a timeout, I think its because
    //     // monaco's selection doesn't update synchronously after this.module.reset()
    //     // If there is a callback on monaco like onUpdateComplete then subscribe to that
    //     // and execute this then
    //     setTimeout(() => {
    //         for (const action of this.stack) this.apply(action);
    //     });
    // }

    attachOnButtonPress() {
        const buttons: Array<HTMLElement> = Array(...(document.querySelectorAll("#editor-toolbox  .button") as any));

        for (const button of buttons) {
            button.addEventListener("click", () => {
                const action = new EventAction(EventType.OnButtonDown, button.id);
                this.stack.push(action);
                this.apply(action);
            });
        }
    }

    attachOnCursorPosChange() {
        const module = this.module;

        module.editor.monaco.onDidChangeCursorPosition((e: editor.ICursorPositionChangedEvent) => {
            const action = new EventAction(EventType.OnCursorPosChange, e);
            this.apply(action);
        });
    }

    attachOnKeyDownListener() {
        const module = this.module;

        module.editor.monaco.onKeyDown((e: IKeyboardEvent) => {
            if (e.ctrlKey && e.code == "KeyZ") {
                // TODO: Temporarily disable undo for now - refer to https://github.com/MajeedKazemi/nova-editor/issues/509
                // this.undo();

                return;
            }

            const action = new EventAction(EventType.OnKeyDown, e);

            //exclude navigation
            if (navigationKeys.indexOf(e.code) === -1) this.stack.push(action);

            this.apply(action);
        });
    }

    attachOnMouseMoveListener() {
        const module = this.module;

        //x,y pos of mouse within window
        document.onmousemove = function (e) {
            module.editor.mousePosWindow[0] = e.x;
            module.editor.mousePosWindow[1] = e.y;
        };
    }

    attachOnDidScrollChangeListener() {
        const module = this.module;

        module.editor.monaco.onDidScrollChange((e: IScrollEvent) => {
            const action = new EventAction(EventType.OnDidScrollChange, e);
            this.apply(action);
        });
    }

    /**
     * Applies the given action to the module through the EventRouter
     *
     * @param action - The action to apply
     */
    apply(action: EventAction) {
        switch (action.type) {
            case EventType.OnKeyDown:
                this.module.eventRouter.onKeyDown(action.event);

                break;

            case EventType.OnButtonDown:
                this.module.eventRouter.onButtonDown(action.event);

                break;

            case EventType.OnCursorPosChange:
                this.module.eventRouter.onCursorPosChange(action.event);

                break;

            case EventType.OnDidScrollChange:
                this.module.eventRouter.onDidScrollChange(action.event);

                break;

            default:
                break;
        }
    }
}
