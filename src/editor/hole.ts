import {
    Construct,
    EditableTextTkn,
    // EmptyOperatorTkn,
    // ForStatement,
    IdentifierTkn,
    // OperatorTkn,
    TypedEmptyExpr,
} from "../syntax-tree/ast";
import { Callback, CallbackType } from "../syntax-tree/callback";
import { Module } from "../syntax-tree/module";
import { Editor } from "./editor";
import { Context } from "./focus";

export class Hole {
    /**
     * Class name for all holes that can be edited
     */
    static editableHoleClass = "editableHole";
    /**
     * Class name for all holes that are valid variable identifiers
     */
    static validVarIdentifierHole = "validVarIdentifierHole";
    /**
     * Class name for all holes that are draft variable identifiers
     */
    static draftVarIdentifierHole = "draftVarIdentifierHole";
    /**
     * All holes in the editor
     */
    static holes: Hole[] = [];
    static module: Module;

    element: HTMLDivElement;
    editor: Editor;
    code: Construct;
    container: HTMLElement;

    constructor(editor: Editor, code: Construct) {
        this.editor = editor;
        /**
         * The code construct that is represented in this hole
         */
        this.code = code;

        // DOM elements
        const element = document.createElement("div");
        element.classList.add("hole");

        // Monaco editor itself (without the line numbers)
        this.container = document.querySelector(".lines-content.monaco-editor-background");
        this.container.append(element);

        this.element = element;
        const hole = this;

        Hole.holes.push(hole);

        // if (code instanceof EmptyOperatorTkn) this.element.classList.add("empty-operator-hole");
        // else
        if (code instanceof IdentifierTkn) this.element.classList.add("identifier-hole");
        else if (code instanceof EditableTextTkn) {
            this.element.classList.add("text-editable-expr-hole");
        } else if (code instanceof TypedEmptyExpr) {
            this.element.classList.add("expression-hole");
        }

        if (code instanceof EditableTextTkn || code instanceof IdentifierTkn /*|| code instanceof OperatorTkn*/) {
            // When focussing this hole, add the editable class to the hole
            code.subscribe(
                CallbackType.focusEditableHole,
                new Callback(() => {
                    this.element.classList.add(Hole.editableHoleClass);
                })
            );
        }

        code.subscribe(
            CallbackType.delete,
            new Callback(() => {
                hole.setTransform(null);
                hole.remove();
            })
        );

        // TODO: Is it sufficient to only keep the CallbackType.delete?
        // code.subscribe(
        //     CallbackType.replace,
        //     new Callback(() => {
        //         hole.setTransform(null);
        //         hole.remove();
        //     })
        // );

        code.subscribe(
            CallbackType.fail,
            new Callback(() => {
                hole.element.style.background = `rgba(255, 0, 0, 0.06)`;

                setTimeout(() => {
                    hole.element.style.background = `rgba(255, 0, 0, 0)`;
                }, 1000);
            })
        );

        function loop() {
            hole.setTransform(code);
            requestAnimationFrame(loop);
        }

        loop();
    }

    setTransform(code: Construct) {
        let leftPadding = 0;
        let rightPadding = 0;
        let transform = { x: 0, y: 0, width: 0, height: 0 };

        if (code) {
            transform = this.editor.computeBoundingBox(code.getSelection());

            if (transform.width == 0) {
                transform.x -= 7;
                transform.width = 14;
            }
        }

        this.element.style.top = `${transform.y + 5}px`;
        this.element.style.left = `${transform.x - leftPadding}px`;

        this.element.style.width = `${transform.width + rightPadding}px`;
        this.element.style.height = `${transform.height - 5 * 2}px`;
    }

    remove() {
        this.element.remove();
        Hole.holes.splice(Hole.holes.indexOf(this), 1);
    }

    static setModule(module: Module) {
        this.module = module;
    }

    static disableEditableHoleOutlines() {
        Hole.holes.forEach((hole) => {
            hole.element.classList.remove(Hole.editableHoleClass);
        });
    }

    static disableVarHighlights() {
        Hole.holes.forEach((hole) => {
            hole.element.classList.remove(Hole.validVarIdentifierHole);
            hole.element.classList.remove(Hole.draftVarIdentifierHole);
        });
    }

    /**
     * Adds an outline to the current token if it is an editable (= IdentitierTkn or EditableTextTkn) hole
     *
     * @param context - The current context of the editor
     */
    static outlineTextEditableHole(context: Context) {
        if (context.token && (context.token instanceof IdentifierTkn || context.token instanceof EditableTextTkn)) {
            context.token.notify(CallbackType.focusEditableHole); // Adds editable class, see above
        } else if (
            context.tokenToRight &&
            (context.tokenToRight instanceof IdentifierTkn || context.tokenToRight instanceof EditableTextTkn)
        ) {
            context.tokenToRight.notify(CallbackType.focusEditableHole);
        } else if (
            context.tokenToLeft &&
            (context.tokenToLeft instanceof IdentifierTkn || context.tokenToLeft instanceof EditableTextTkn)
        ) {
            context.tokenToLeft.notify(CallbackType.focusEditableHole);
        }
    }

    // TODO: Fix in the future; temporarily disabled
    // /**
    //  * Highlights all valid variable holes before the current line
    //  *
    //  * @param context - The current context of the editor
    //  */
    // static highlightValidVarHoles(context: Context) {
    //     if (context.selected && context.token && context.token instanceof TypedEmptyExpr) {
    //         context.token.notify(CallbackType.showAvailableVars);
    //     }
    // }
}
