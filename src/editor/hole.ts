import {
    Construct,
    EditableTextTkn,
    // EmptyOperatorTkn,
    // ForStatement,
    IdentifierTkn,
    // OperatorTkn,
    TypedEmptyExpr,
    // VarAssignmentStmt,
} from "../syntax-tree/ast";
import { Callback, CallbackType } from "../syntax-tree/callback";
import { InsertionType } from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { Reference } from "../syntax-tree/scope";
import { Editor } from "./editor";
import { Context } from "./focus";
import { Validator } from "./validator";

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
        // } else if (code instanceof TypedEmptyExpr) {
            // When focussing a hole with a TypedEmptyExpr, show the available variables
            // in the current location ... literally
            // This method will indicate visually all variable assignments that you can use
            // by giving them a green; idem for draft variables
            // WE CURRENTLY DISABLE THIS FUNCTIONALITY AS THIS CAUSES ERROR AND REQUIRES SOME
            // REWRITES WHILE NOT CONTRIBUTING TO THE MAIN FUNCTIONALITY
            // code.subscribe(
            //     CallbackType.showAvailableVars,
            //     new Callback(() => {
            //         // Get the current context
            //         const c = Hole.module.focus.getContext();
            //         // Get the token or line statement that is currently focused
            //         const focusedNode = c.token && c.selected ? c.token : c.lineStatement;
            //         // Get all valid or draft variable references in the current context
            //         const refInsertionTypes = Validator.getValidVariableReferences(
            //             focusedNode,
            //             Hole.module.variableController
            //         );
            //         // Get all valid variable references in the current context and map them to
            //         // their buttonId and line number
            //         const validIdentifierIds: [string, number][] = refInsertionTypes.map((ref) => [
            //             ((ref[0] as Reference).statement as VarAssignmentStmt).buttonId,
            //             (ref[0] as Reference).getLineNumber(),
            //         ]);
            //         // Initialize a map to map the buttonId to the insertionType and line number
            //         const refInsertionTypeMap = new Map<string, [InsertionType, number]>();
            //         // For each of the validIdentifierIds, add the buttonId as key and the
            //         // insertionType and line number as value
            //         for (let i = 0; i < validIdentifierIds.length; i++) {
            //             refInsertionTypeMap.set(validIdentifierIds[i][0] as string, [
            //                 refInsertionTypes[i][1],
            //                 validIdentifierIds[i][1],
            //             ]); // key = buttonId, value = [insertionType, line]
            //         }
            //         // For each of the holes in the entire program
            //         for (const hole of Hole.holes) {
            //             // If hole is part of an assignment statement AND the
            //             // code in the hole is an identifier token AND the buttonId refers
            //             // to an accessible valid or draft variable identifier
            //             if (
            //                 (hole.code.rootNode instanceof VarAssignmentStmt ||
            //                     hole.code.rootNode instanceof ForStatement) &&
            //                 hole.code instanceof IdentifierTkn &&
            //                 refInsertionTypeMap.has(hole.code.rootNode.buttonId)
            //             ) {
            //                 if (hole.code.getLineNumber() < this.editor.monaco.getPosition().lineNumber) {
            //                     // Mark holes before the current line as valid or draft?
            //                     if (refInsertionTypeMap.get(hole.code.rootNode.buttonId)[0] === InsertionType.Valid) {
            //                         hole.element.classList.add(Hole.validVarIdentifierHole);
            //                     } else if (
            //                         refInsertionTypeMap.get(hole.code.rootNode.buttonId)[0] === InsertionType.DraftMode
            //                     ) {
            //                         hole.element.classList.add(Hole.draftVarIdentifierHole);
            //                     }
            //                 }
            //             }
            //         }
            //     })
            // );
        }

        code.subscribe(
            CallbackType.delete,
            new Callback(() => {
                hole.setTransform(null);
                hole.remove();
            })
        );

        code.subscribe(
            CallbackType.replace,
            new Callback(() => {
                hole.setTransform(null);
                hole.remove();
            })
        );

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
