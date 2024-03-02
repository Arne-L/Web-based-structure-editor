import { Position, Range } from "monaco-editor";
import { ActionExecutor } from "../editor/action-executor";
import { ActionFilter } from "../editor/action-filter";
import { CodeStatus, EditActionType } from "../editor/consts";
import { EditAction } from "../editor/data-types";
import { DraftRecord } from "../editor/draft";
import { Editor } from "../editor/editor";
import { EventRouter } from "../editor/event-router";
import { EventStack } from "../editor/event-stack";
import { Context, Focus } from "../editor/focus";
import { Hole } from "../editor/hole";
import { ToolboxController } from "../editor/toolbox";
import { Validator } from "../editor/validator";
import { MessageController } from "../messages/message-controller";
import { ConstructHighlight } from "../messages/messages";
import { NotificationManager } from "../messages/notifications";
import { MenuController } from "../suggestions/suggestions-controller";
import { Util } from "../utilities/util";
import {
    AutocompleteTkn,
    CodeConstruct,
    EmptyLineStmt,
    Expression,
    FormattedStringCurlyBracketsExpr,
    GeneralStatement,
    // ForStatement,
    Importable,
    ImportStatement,
    ListLiteralExpression,
    Statement,
    Token,
    TypedEmptyExpr,
    // VarAssignmentStmt,
    VariableReferenceExpr,
} from "./ast";
import { rebuildBody } from "./body";
import { CallbackType } from "./callback";
import { DataType, MISSING_IMPORT_DRAFT_MODE_STR, TAB_SPACES } from "./consts";
import { Reference, Scope } from "./scope";
import { TypeChecker } from "./type-checker";
import { VariableController } from "./variable-controller";

const ERROR_HIGHLIGHT_COLOUR: [number, number, number, number] = [255, 153, 153, 0.5];

/**
 * The main body of the code which includes an array of statements.
 */
export class Module {
    body = new Array<Statement>();
    focus: Focus;
    validator: Validator;
    executer: ActionExecutor;
    eventRouter: EventRouter;
    eventStack: EventStack;
    editor: Editor;
    variableButtons: HTMLDivElement[] = [];
    messageController: MessageController;
    menuController: MenuController;
    typeSystem: TypeChecker;
    notificationManager: NotificationManager;
    toolboxController: ToolboxController;

    scope: Scope;
    draftExpressions: DraftRecord[];

    variableController: VariableController;
    actionFilter: ActionFilter;

    globals: { hoveringOverCascadedMenu: boolean; hoveringOverVarRefButton: boolean; lastPressedRunButtonId: string };

    constructor(editorId: string) {
        this.editor = new Editor(document.getElementById(editorId), this);
        this.focus = new Focus(this);
        this.validator = new Validator(this);
        this.executer = new ActionExecutor(this);
        this.typeSystem = new TypeChecker(this);
        this.variableController = new VariableController(this);
        this.actionFilter = new ActionFilter(this);
        this.notificationManager = new NotificationManager(this);
        this.toolboxController = new ToolboxController(this);

        this.globals = {
            hoveringOverCascadedMenu: false,
            hoveringOverVarRefButton: false,
            lastPressedRunButtonId: "",
        };

        this.draftExpressions = [];

        Hole.setModule(this);

        this.toolboxController.loadToolboxFromJson();
        this.toolboxController.addTooltips();

        this.focus.subscribeOnNavChangeCallback((c: Context) => {
            const statementAtLine = this.focus.getStatementAtLineNumber(this.editor.monaco.getPosition().lineNumber);
            const statementScope = statementAtLine.scope ?? (statementAtLine.rootNode as Statement | Module).scope;

            // Variable reference buttons are not currently part of the editor
            // this.variableController.updateToolboxVarsCallback(
            //     statementScope,
            //     this.editor.monaco.getPosition().lineNumber
            // );

            Hole.disableEditableHoleOutlines();
            Hole.disableVarHighlights();
            Hole.outlineTextEditableHole(c);
            Hole.highlightValidVarHoles(c);
        });

        this.focus.subscribeOnNavChangeCallback((c: Context) => {
            Hole.disableEditableHoleOutlines();
            Hole.disableVarHighlights();
            Hole.outlineTextEditableHole(c);
            Hole.highlightValidVarHoles(c);
        });

        this.toolboxController.updateButtonsOnContextChange();

        this.focus.subscribeOnNavChangeCallback((c: Context) => {
            const menuController = MenuController.getInstance();

            if (
                !(
                    c.token instanceof AutocompleteTkn ||
                    c.tokenToLeft instanceof AutocompleteTkn ||
                    c.tokenToRight instanceof AutocompleteTkn
                ) &&
                menuController.isMenuOpen()
            )
                menuController.removeMenus();
        });

        this.body.push(new EmptyLineStmt(this, 0));
        this.scope = new Scope();
        this.body[0].build(new Position(1, 1));

        this.focus.updateContext({ tokenToSelect: this.body[0] });
        this.editor.monaco.focus();

        this.eventRouter = new EventRouter(this);
        this.eventStack = new EventStack(this);

        this.messageController = new MessageController(this.editor, this);

        this.variableButtons = [];

        this.menuController = MenuController.getInstance();
        this.menuController.setInstance(this, this.editor);

        Util.getInstance(this);
    }

    /**
     * Send a notification with the given type to the given construct and all of its children
     * 
     * @param code - The code to be notified
     * @param callbackType - The type of the notification
     */
    recursiveNotify(code: CodeConstruct, callbackType: CallbackType) {
        // Notify the current CodeConstruct
        code.notify(callbackType);

        // If the current CodeConstruct is a Statement or an Expression, notify all of its tokens
        if (code instanceof Expression || code instanceof Statement) {
            const codeStack = new Array<CodeConstruct>();
            // Get all of the tokens of the construct
            codeStack.unshift(...code.tokens);

            // Add all body statements to the stack if it is a statement
            if (code instanceof Statement && code.hasBody()) codeStack.unshift(...code.body);

            // Keep notifying until the stack is empty
            while (codeStack.length > 0) {
                const curCode = codeStack.pop();
                curCode.notify(callbackType);

                // Add tokens and body recursively to the stack
                if (curCode instanceof Statement || curCode instanceof Expression) codeStack.unshift(...curCode.tokens);
                if (curCode instanceof Statement && curCode.hasBody()) codeStack.unshift(...curCode.body);
            }
        // If the current CodeConstruct is a Token, send a notification
        } else if (code instanceof Token) code.notify(callbackType);
    }

    /**
     * Perform the AST rebuilding to reflect the changes after a backwards indent
     * 
     * @param stmt - The statement to be indented back / to the left
     */
    indentBackStatement(stmt: Statement) {
        // The parent statement
        const root = stmt.rootNode;

        // If root instance of statement, then we can indent back
        // Otherwise we are at the top level and cannot indent back
        if (root instanceof Statement) {
            // Remove the current statement from the body of the root
            const removedItem = root.body.splice(stmt.indexInRoot, 1);

            // The parent statement of the parent
            let outerRoot = root.rootNode;

            // Set the parent to the parent of the parent (= outerRoot)
            removedItem[0].rootNode = root.rootNode;
            // Set the index to the index of the parent + 1 (it will become the next sibling
            // after the original parent)
            removedItem[0].indexInRoot = root.indexInRoot + 1;
            // Rebuild the statement's placement in the AST
            removedItem[0].build(new Position(stmt.lineNumber, stmt.left - TAB_SPACES));

            if (!stmt.hasBody()) {
                // Might be better to change the condition in the future
                // The current statement does not have a body

                // Add the statement to the body of the parent of the parent
                outerRoot.body.splice(root.indexInRoot + 1, 0, ...removedItem);

                // Update the positions of the statements recursively
                rebuildBody(this, 0, 1);

                // if (stmt instanceof VarAssignmentStmt) {
                //     root.scope.references = root.scope.references.filter((ref) => {
                //         ref.statement !== stmt;
                //     });
                // }

                // outerRoot.scope.references.push(new Reference(stmt, outerRoot.scope));

                // If the statement contains assignments, push them to their parent scope
                if (stmt instanceof GeneralStatement && stmt.containsAssignments()) root.scope.pushToScope(outerRoot.scope, stmt.getAssignments());
            } else {
                // The current statement has a body

                // All statements contained in the body of the current statement need to be indented
                // as well
                const stmtStack = new Array<Statement>();
                stmtStack.unshift(...removedItem[0].body);

                while (stmtStack.length > 0) {
                    const curStmt = stmtStack.pop();
                    // Shift to the left
                    curStmt.build(new Position(curStmt.lineNumber, curStmt.left - TAB_SPACES));

                    // Keep doing it recusiveley
                    if (curStmt.hasBody()) stmtStack.unshift(...curStmt.body);
                }

                // Set the parent scope of the current statement to the parent of the parent
                removedItem[0].scope.parentScope = outerRoot.scope;

                // Add the statement to the body of the parent of the parent
                outerRoot.body.splice(root.indexInRoot + 1, 0, ...removedItem);
                // Update the positions of the statements recursively
                rebuildBody(this, 0, 1);
            }
        }
    }

    indentForwardStatement(stmt: Statement) {
        // The parent statement
        const root = stmt.rootNode;

        if (root instanceof Statement || root instanceof Module) {
            // The statement above the current statement
            const aboveMultilineStmt = root.body[stmt.indexInRoot - 1];
            // Remove the current statement from the body of the root
            const removedItem = root.body.splice(stmt.indexInRoot, 1);

            // Set the statement before the current statement as the parent of the current statement
            removedItem[0].rootNode = aboveMultilineStmt;
            removedItem[0].indexInRoot = aboveMultilineStmt.body.length;
            // Indent the statement to the right
            removedItem[0].build(new Position(stmt.lineNumber, stmt.left + TAB_SPACES));

            if (!stmt.hasBody()) {
                // If the current statement does not have a body

                // Add current statement to the body of the statement above
                aboveMultilineStmt.body.push(removedItem[0]);
                // Update the positions of the statements recursively
                rebuildBody(this, 0, 1);

                // if (stmt instanceof VarAssignmentStmt) {
                //     root.scope.references = root.scope.references.filter((ref) => {
                //         ref.statement !== stmt;
                //     });
                // }
                // aboveMultilineStmt.scope.references.push(new Reference(stmt, aboveMultilineStmt.scope));

                // If the statement contains assignments, push them to their new parent scope
                if (stmt instanceof GeneralStatement && stmt.containsAssignments()) root.scope.pushToScope(aboveMultilineStmt.scope, stmt.getAssignments());
            } else {
                // If the current statement has a body

                // All statements contained in the body of the current statement need to be indented
                // as well
                const stmtStack = new Array<Statement>();
                stmtStack.unshift(...removedItem[0].body);

                while (stmtStack.length > 0) {
                    const curStmt = stmtStack.pop();
                    // Shift to the right
                    curStmt.build(new Position(curStmt.lineNumber, curStmt.left + TAB_SPACES));

                    // Keep doing it recusiveley
                    if (curStmt.hasBody()) stmtStack.unshift(...curStmt.body);
                }

                // Add current statement to the body of the statement above
                aboveMultilineStmt.body.push(removedItem[0]);
                rebuildBody(this, 0, 1);

                // Set the parent scope of the current statement to the scope of the original 
                // previous statement
                stmt.scope.parentScope = aboveMultilineStmt.scope;
            }
        }
    }

    /**
     * Indents all constructs in the body of the current line statement
     * 
     * @param providedContext - The context of the current line statement
     * @param backwards - Whether to indent backwards or forwards
     */
    indentBodyConstructs(providedContext: Context, backwards: boolean) {
        if (!providedContext.lineStatement.hasBody()) return

        while (providedContext.lineStatement.body.length > 0) {
            // Performs the indentation of the last statement in the body
            this.editor.indentRecursively(
                providedContext.lineStatement.body[providedContext.lineStatement.body.length - 1],
                { backward: backwards }
            );
            // Restructures the AST to following the new indentation
            // This action results in the current last statement being removed from the body
            // of the current line statement
            if (backwards) {
                this.indentBackStatement(
                    providedContext.lineStatement.body[providedContext.lineStatement.body.length - 1]
                );
            } else {
                this.indentForwardStatement(
                    providedContext.lineStatement.body[providedContext.lineStatement.body.length - 1]
                );
            }
        }
    }

    /**
     * CURRENTLY NOT USED => MIGHT BE USEFULL FOR LISTS OF ITEMS IN THE FUTURE
     * 
     * @param code 
     * @param start 
     * @param count 
     * @returns 
     */
    removeItems(code: CodeConstruct, start: number, count: number): Array<CodeConstruct> {
        if (code instanceof Statement) {
            const removedItems = code.tokens.splice(start, count);

            for (const item of removedItems) {
                this.recursiveNotify(item, CallbackType.delete);
            }

            code.rebuild(code.getLeftPosition(), 0);

            return removedItems;
        }

        return [];
    }

    private removeStatement(line: Statement): CodeConstruct {
        const root = line.rootNode;

        if (root instanceof Module || root instanceof Statement) {
            const replacement = new EmptyLineStmt(root, line.indexInRoot);
            this.recursiveNotify(line, CallbackType.delete);
            root.body.splice(line.indexInRoot, 1, replacement);
            replacement.build(line.getLeftPosition());
            rebuildBody(this, 0, 1);

            return replacement;
        }

        return null;
    }

    /**
     * Remove a statement without replacing
     * 
     * @param line - The line to be removed without replacing it with an empty line
     */
    deleteLine(line: Statement) {
        const root = line.rootNode;

        if (root instanceof Module || root instanceof Statement) {
            this.recursiveNotify(line, CallbackType.delete);
            root.body.splice(line.indexInRoot, 1);
            rebuildBody(this, 0, 1);
        }
    }

    /**
     * MAYBE PLACE THIS IN THE AST ASWELL?
     * 
     * Remove the given Construct from the editor and update the focus context
     * It also replaces the construct with the correct "placeholder" construct
     *
     * @param code
     * @param param1
     */
    deleteCode(code: CodeConstruct, { statement = false, replaceType = null } = {}) {
        // Get range of the construct to delete
        const replacementRange =code.getBoundaries();
        // The construct to replace the deleted code with
        let replacement: CodeConstruct;

        // If the construct to delete is a statement
        if (statement) replacement = this.removeStatement(code as Statement);
        // If the construct to delete is a expression
        else replacement = this.replaceItemWTypedEmptyExpr(code, replaceType);

        // Replace all characters in the Monaco editor with the replacement construct
        this.editor.executeEdits(replacementRange, replacement);
        // Update the focus context
        this.focus.updateContext({ tokenToSelect: replacement });
    }

    private rebuildOnConstructDeletion(item: CodeConstruct, root: Statement) {
        this.recursiveNotify(item, CallbackType.delete);

        for (let i = 0; i < root.tokens.length; i++) {
            root.tokens[i].indexInRoot = i;
            root.tokens[i].rootNode = root;
        }

        root.rebuild(root.getLeftPosition(), 0);
    }

    replaceItemWTypedEmptyExpr(item: CodeConstruct, replaceType: DataType): CodeConstruct {
        const root = item.rootNode;

        if (root instanceof Statement) {
            if (root instanceof ListLiteralExpression || root instanceof FormattedStringCurlyBracketsExpr)
                replaceType = DataType.Any;

            let replacedItem = null;
            const allowedTypes = root.getCurrentAllowedTypesOfHole(item.indexInRoot, true);

            replacedItem = new TypedEmptyExpr(
                replaceType !== null ? [replaceType] : root.typeOfHoles[item.indexInRoot]
            );

            if (allowedTypes.length > 0) replacedItem.type = allowedTypes;

            root.onReplaceToken({ indexInRoot: item.indexInRoot, replaceWithEmptyExpr: true });
            root.tokens.splice(item.indexInRoot, 1, replacedItem);
            this.rebuildOnConstructDeletion(item, root);

            return replacedItem;
        }

        return null;
    }

    removeItem(item: CodeConstruct): void {
        const root = item.rootNode;
        if (root instanceof Statement) {
            root.onDeleteFrom({ indexInRoot: item.indexInRoot });
            root.tokens.splice(item.indexInRoot, 1);
            this.rebuildOnConstructDeletion(item, root);
        }
    }

    // DEAD CODE?
    // reset() {
    //     this.body = new Array<Statement>();

    //     this.body.push(new EmptyLineStmt(this, 0));
    //     this.scope = new Scope();

    //     this.body[0].build(new Position(1, 1));
    //     this.focus.updateContext({ tokenToSelect: this.body[0] });

    //     this.editor.reset();
    //     this.editor.monaco.focus();

    //     this.variableButtons.forEach((button) => button.remove());
    //     this.variableButtons = [];

    //     this.messageController.clearAllMessages();
    // }

    // DEAD CODE?
    // getVarRefHandler(ref: VarAssignmentStmt) {
    //     return function () {
    //         this.insert(new VariableReferenceExpr(ref.getIdentifier(), ref.dataType, ref.buttonId));
    //     };
    // }

    /**
     * Adds `code` to the body at the given index
     * @param code the statement to be added
     * @param index the index to add the `code` statement
     * @param line the line number that will be given to the newly added statement
     */
    addStatementToBody(bodyContainer: Statement | Module, code: Statement, index: number, line: number) {
        bodyContainer.body.splice(index, 0, code);
        for (let i = index + 1; i < bodyContainer.body.length; i++) bodyContainer.body[i].indexInRoot++;

        rebuildBody(bodyContainer, index + 1, line + code.getHeight());
        if (code.hasScope()) code.scope.parentScope = bodyContainer.scope;

        if (bodyContainer instanceof Statement) {
            bodyContainer.notify(CallbackType.change);
        }
    }

    /**
     * Add the assignment to the current working scope.
     *
     * @param statement - The assignment statement adding the variable
     * @param workingScope - The direct scope in which the action is performed
     */
    // processNewVariable(statement: Statement, workingScope: Scope) {
    //     if (statement instanceof VarAssignmentStmt) {
    //         workingScope.references.push(new Reference(statement, workingScope));
    //     }

    //     if (statement instanceof ForStatement) {
    //         statement.scope.references.push(new Reference(statement.loopVar, workingScope));
    //     }
    // }
    // SUPERSEDED BY A METHOD ON THE SCOPE CLASS

    insertEmptyLine(): Statement {
        const curPos = this.editor.monaco.getPosition();
        const curStatement = this.focus.getFocusedStatement();
        const curStatementRoot = curStatement.rootNode;

        let leftPosToCheck = 1;
        let parentStmtHasBody = false;
        let textToAdd = "\n";
        let spaces = "";
        let atCompoundStmt = false;

        if (curStatementRoot instanceof Statement && curStatementRoot.hasBody()) {
            // is inside the body of another statement
            leftPosToCheck = curStatementRoot.left + TAB_SPACES;
            parentStmtHasBody = true;

            if (leftPosToCheck != 1) {
                for (let i = 0; i < curStatementRoot.left + TAB_SPACES - 1; i++) spaces += " ";
            }
        }

        if (curStatement instanceof Statement && curStatement.hasBody() && curPos.column != curStatement.left) {
            // is at the header statement of a statement with body
            leftPosToCheck = curStatement.left + TAB_SPACES;
            parentStmtHasBody = true;
            atCompoundStmt = true;

            if (leftPosToCheck != 1) {
                for (let i = 0; i < curStatement.left + TAB_SPACES - 1; i++) spaces += " ";
            }
        }

        if (curPos.column == leftPosToCheck) {
            // insert emptyStatement at this line, move other statements down
            const emptyLine = new EmptyLineStmt(parentStmtHasBody ? curStatementRoot : this, curStatement.indexInRoot);

            emptyLine.build(curStatement.getLeftPosition());

            if (parentStmtHasBody) {
                this.addStatementToBody(
                    curStatementRoot as Statement,
                    emptyLine,
                    curStatement.indexInRoot,
                    curStatement.lineNumber
                );
            } else this.addStatementToBody(this, emptyLine, curStatement.indexInRoot, curStatement.lineNumber);

            const range = new Range(curStatement.lineNumber - 1, 1, curStatement.lineNumber - 1, 1);
            this.editor.executeEdits(range, null, spaces + textToAdd);

            return emptyLine;
        } else {
            // insert emptyStatement on next line, move other statements down
            const emptyLine = new EmptyLineStmt(
                parentStmtHasBody ? curStatementRoot : this,
                curStatement.indexInRoot + 1
            );
            emptyLine.build(new Position(curStatement.lineNumber + 1, leftPosToCheck));

            if (parentStmtHasBody && atCompoundStmt) {
                emptyLine.indexInRoot = 0;
                emptyLine.rootNode = curStatement;
                this.addStatementToBody(curStatement as Statement, emptyLine, 0, curStatement.lineNumber + 1);
            } else if (parentStmtHasBody) {
                this.addStatementToBody(
                    curStatementRoot as Statement,
                    emptyLine,
                    curStatement.indexInRoot + 1,
                    curStatement.lineNumber + 1
                );
            } else this.addStatementToBody(this, emptyLine, curStatement.indexInRoot + 1, curStatement.lineNumber + 1);

            const range = new Range(
                curStatement.lineNumber,
                curStatement.right,
                curStatement.lineNumber,
                curStatement.right
            );
            this.editor.executeEdits(range, null, textToAdd + spaces);
            this.focus.updateContext({ tokenToSelect: emptyLine });

            return emptyLine;
        }
    }

    /**
     * Replace the focussed expression with the given expression
     * 
     * @param expr - The expression to replace the focussed expression with
     */
    replaceFocusedExpression(expr: Expression) {
        // Current context
        const context = this.focus.getContext();

        if (context.expression != null) {
            // If we currently focussing an expression, replace it with the given expression
            const root = context.expression.rootNode as Statement;
            root.replace(expr, context.expression.indexInRoot);
        } else if (context.token != null) {
            // If we currently focussing a token, replace it with the given expression
            const root = context.token.rootNode as Statement;
            root.replace(expr, context.token.indexInRoot);
        }
    }

    closeConstructDraftRecord(code: CodeConstruct) {
        if (code.draftModeEnabled) {
            code.draftModeEnabled = false;
            const removedRecord = this.draftExpressions.splice(this.draftExpressions.indexOf(code.draftRecord), 1)[0];

            if (removedRecord.warning) removedRecord.removeMessage();

            code.draftRecord = null;
            code.message = null;
        } else {
            console.warn("Tried closing draft mode of construct that did not have one open.");
        }
    }

    openDraftMode(code: Statement, txt: string = "Draft Mode Placeholder Txt", actionButtons: HTMLDivElement[]) {
        code.draftModeEnabled = true;
        this.draftExpressions.push(new DraftRecord(code, this, txt));
        code.draftRecord = this.draftExpressions[this.draftExpressions.length - 1];

        for (const button of actionButtons) {
            code.message.attachButton(button);
        }
    }

    addHighlightToConstruct(construct: CodeConstruct, rgbColour: [number, number, number, number]) {
        const hl = new ConstructHighlight(this.editor, construct, rgbColour);
    }

    getCodeStatus(highlightConstructs: boolean = false) {
        let status = null;

        if (this.body.length === 0 || (this.body.length === 1 && this.body[0] instanceof EmptyLineStmt)) {
            return CodeStatus.Empty;
        }

        const stack: CodeConstruct[] = [];
        stack.push(...this.body);

        while (stack.length > 0) {
            let cur: CodeConstruct = stack.pop();
            const hasDraftMode = cur.draftModeEnabled;

            if (cur instanceof TypedEmptyExpr && !cur.isListElement()) {
                status = status ?? CodeStatus.ContainsEmptyHoles;

                if (highlightConstructs && !hasDraftMode) this.addHighlightToConstruct(cur, ERROR_HIGHLIGHT_COLOUR);
            } else if (cur instanceof AutocompleteTkn) {
                status = status ?? CodeStatus.ContainsAutocompleteTokens;

                if (highlightConstructs && !hasDraftMode) this.addHighlightToConstruct(cur, ERROR_HIGHLIGHT_COLOUR);
            } else if (cur.draftModeEnabled) {
                status = status ?? CodeStatus.ContainsDraftMode;

                if (highlightConstructs && !hasDraftMode) this.addHighlightToConstruct(cur, ERROR_HIGHLIGHT_COLOUR);
            } else if (cur instanceof Expression && cur.tokens.length > 0) {
                const addHighlight = cur instanceof ListLiteralExpression && !cur.isHolePlacementValid();
                status = addHighlight ? CodeStatus.ContainsEmptyHoles : status;

                for (let i = 0; i < cur.tokens.length; i++) {
                    if (
                        cur.tokens[i] instanceof TypedEmptyExpr &&
                        addHighlight &&
                        i < cur.tokens.length - 2 &&
                        !hasDraftMode
                    ) {
                        this.addHighlightToConstruct(cur.tokens[i], ERROR_HIGHLIGHT_COLOUR);
                    }

                    stack.push(cur.tokens[i]);
                }
            } else if (cur instanceof Statement) {
                for (const token of cur.tokens) {
                    stack.push(token);
                }

                if (cur.body.length > 0) stack.push(...cur.body);
            }
        }

        return status ?? CodeStatus.Runnable;
    }

    /**
     * Goes through the body of the module in a BFS manner and performs the given action
     * on each construct.
     *
     * @param duringAction - Function to be performed on each construct
     */
    performActionOnBFS(duringAction: (code: CodeConstruct) => void) {
        // List with all CodeConstructs
        const Q: CodeConstruct[] = [];
        // Push all statements of the body of the module to the list
        Q.push(...this.body);

        // As long as there exists some construct in the list
        while (Q.length > 0) {
            // Delete the first element of the list
            let curr: CodeConstruct = Q.splice(0, 1)[0];

            if (curr instanceof Expression && curr.tokens.length > 0) {
                // If the expression has tokens, push them to the list
                Q.push(...curr.tokens);
            } else if (curr instanceof Statement) {
                // If the statement has tokens, push them to the list
                for (const tkn of curr.tokens) {
                    Q.push(tkn);
                }
                if (curr.body.length > 0) {
                    // If the statement has a body, push it to the list
                    Q.push(...curr.body);
                }
            }

            // Perform the given action on the current construct
            duringAction(curr);
        }
    }

    getAllImportStmts(): ImportStatement[] {
        const stmts: ImportStatement[] = [];

        this.performActionOnBFS((code: CodeConstruct) => {
            if (code instanceof ImportStatement) {
                stmts.push(code);
            }
        });

        return stmts;
    }

    openImportDraftMode(code: Statement & Importable) {
        this.openDraftMode(code, MISSING_IMPORT_DRAFT_MODE_STR(code.getKeyword(), code.requiredModule), []);

        const button = code.message.createButton(`import ${code.requiredModule}`);
        button.addEventListener(
            "click",
            (() => {
                this.executer.execute(
                    new EditAction(EditActionType.InsertImportFromDraftMode, {
                        moduleName: code.requiredModule,
                        itemName: code.getKeyword(),
                        source: { type: "draft-mode" },
                    }),
                    this.focus.getContext()
                );

                this.validator.validateImports();

                // TEMPORARY COMMENTED TO FIX ERRORS: LOOK AT THIS LATER ON!
                // if (code.rootNode instanceof VarAssignmentStmt) {
                //     code.rootNode.onFocusOff();
                // }
            }).bind(this)
        );
    }

    /**
     * Get the nearest scope if there is one
     * The nearest scope is the scope of the module as there are no other parent scopes
     *
     * @returns the scope of the module
     */
    getNearestScope() {
        return this.scope;
    }
}
