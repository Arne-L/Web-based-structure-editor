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
import { initialConstructDef } from "../language-definition/parser";
import { ERROR_HIGHLIGHT_COLOUR, TAB_SPACES } from "../language-definition/settings";
import { MessageController } from "../messages/message-controller";
import { NotificationManager } from "../messages/notifications";
import { MenuController } from "../suggestions/suggestions-controller";
import { Util } from "../utilities/util";
import {
    AutocompleteTkn,
    CodeConstruct,
    Construct,
    EmptyLineStmt,
    Expression,
    // FormattedStringCurlyBracketsExpr,
    GeneralStatement,
    ImportStatement,
    // ForStatement,
    Importable,
    // ListLiteralExpression,
    Statement,
    Token,
    TypedEmptyExpr,
} from "./ast";
import { rebuildBody } from "./body";
import { CallbackType } from "./callback";
import { SyntaxConstructor } from "./constructor";
import { DataType, MISSING_IMPORT_DRAFT_MODE_STR } from "./consts";
import { Language } from "./language";
import { Scope } from "./scope";
import { ASTManupilation } from "./utils";
import { VariableController } from "./variable-controller";

/**
 * The main body of the code which includes an array of statements.
 */
export class Module {
    body = new Array<Statement>();
    compoundConstruct: Construct;
    focus: Focus;
    validator: Validator;
    executer: ActionExecutor;
    eventRouter: EventRouter;
    eventStack: EventStack;
    editor: Editor;
    // variableButtons: HTMLDivElement[] = [];
    messageController: MessageController;
    menuController: MenuController;
    // typeSystem: TypeChecker;
    notificationManager: NotificationManager;
    toolboxController: ToolboxController;
    /**
     * Object representing all language specific information
     */
    language: Language;

    /**
     *
     */
    static instance: Module;

    /**
     * The global scope connected to the module
     */
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
        // this.typeSystem = new TypeChecker(this);
        this.variableController = new VariableController(this);
        this.actionFilter = new ActionFilter(this);
        this.notificationManager = new NotificationManager(this);
        this.toolboxController = new ToolboxController(this);
        this.language = new Language(this);

        this.globals = {
            hoveringOverCascadedMenu: false,
            hoveringOverVarRefButton: false,
            lastPressedRunButtonId: "",
        };

        this.draftExpressions = [];

        Hole.setModule(this);

        // Load the constructs and settings from JSON files
        this.toolboxController.loadToolboxFromJson();
        // Initialise the editors starting construct
        // The starting construct needs to be a CodeConstruct (needs to contain tokens)
        this.compoundConstruct = SyntaxConstructor.constructTokensFromJSON([initialConstructDef], null, 0)[0];
        this.compoundConstruct.build(new Position(1, 1));
        const range = new Range(
            this.compoundConstruct.left.lineNumber,
            this.compoundConstruct.leftCol,
            this.compoundConstruct.right.lineNumber,
            this.compoundConstruct.rightCol
        );
        this.editor.executeEdits(range, this.compoundConstruct);
        this.focus.updateContext(this.compoundConstruct.getInitialFocus());

        // Add the tooltips to each of the toolbox buttons
        this.toolboxController.addTooltips();

        this.focus.subscribeOnNavChangeCallback((c: Context) => {
            // const statementAtLine = this.focus.getStatementAtLineNumber(this.editor.monaco.getPosition().lineNumber);
            // const statementScope = statementAtLine.scope ?? (statementAtLine.rootNode as Statement | Module).scope;

            // Variable reference buttons are not currently part of the editor
            // this.variableController.updateToolboxVarsCallback(
            //     statementScope,
            //     this.editor.monaco.getPosition().lineNumber
            // );

            Hole.disableEditableHoleOutlines();
            Hole.disableVarHighlights();
            Hole.outlineTextEditableHole(c);
            // Hole.highlightValidVarHoles(c); // TODO: TEMPORARILY DISABLED
        });

        // this.focus.subscribeOnNavChangeCallback((c: Context) => {
        //     Hole.disableEditableHoleOutlines();
        //     Hole.disableVarHighlights();
        //     Hole.outlineTextEditableHole(c);
        //     Hole.highlightValidVarHoles(c);
        // });

        // Update the toolbox buttons whenever the context changes
        this.toolboxController.updateButtonsOnContextChange();

        // Remove autocomplete suggestions when the context changes
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

        // Add the starting empty line to the body
        // this.body.push(new EmptyLineStmt(this, 0));
        // this.scope = new Scope();
        // this.body[0].build(new Position(1, 1));

        // Select the empty line as the current focus
        // this.focus.updateContext({ tokenToSelect: this.body[0] });
        // this.editor.monaco.focus();

        // Bunch of class instances being created
        this.eventRouter = new EventRouter(this);
        this.eventStack = new EventStack(this);

        this.messageController = new MessageController(this.editor, this);

        // this.variableButtons = [];

        this.menuController = MenuController.getInstance();
        this.menuController.setInstance(this, this.editor);

        Util.getInstance(this);

        Module.instance = this;
    }

    /**
     * Send a notification with the given type to the given construct and all of its children
     *
     * @param code - The code to be notified
     * @param callbackType - The type of the notification
     */
    recursiveNotify(code: Construct, callbackType: CallbackType) {
        // Notify the current CodeConstruct
        code.notify(callbackType);

        // If the current CodeConstruct is a Statement or an Expression, notify all of its tokens
        if (code instanceof Expression || code instanceof Statement) {
            const codeStack = new Array<Construct>();
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
    indentBackStatement(stmt: CodeConstruct) {
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
            removedItem[0].build(new Position(stmt.lineNumber, stmt.leftCol - TAB_SPACES));

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
                // if (stmt instanceof GeneralStatement && stmt.containsAssignments())
                //     root.scope.pushToScope(outerRoot.scope, stmt.getAssignments());
            } else {
                // The current statement has a body

                // All statements contained in the body of the current statement need to be indented
                // as well
                const stmtStack = new Array<Statement>();
                stmtStack.unshift(...removedItem[0].body);

                while (stmtStack.length > 0) {
                    const curStmt = stmtStack.pop();
                    // Shift to the left
                    curStmt.build(new Position(curStmt.lineNumber, curStmt.leftCol - TAB_SPACES));

                    // Keep doing it recusiveley
                    if (curStmt.hasBody()) stmtStack.unshift(...curStmt.body);
                }

                // Set the parent scope of the current statement to the parent of the parent
                // removedItem[0].scope.parentScope = outerRoot.scope;

                // Add the statement to the body of the parent of the parent
                outerRoot.body.splice(root.indexInRoot + 1, 0, ...removedItem);
                // Update the positions of the statements recursively
                rebuildBody(this, 0, 1);
            }
        }
    }

    indentForwardStatement(stmt: CodeConstruct) {
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
            removedItem[0].build(new Position(stmt.lineNumber, stmt.leftCol + TAB_SPACES));

            if (!stmt.hasBody()) {
                // If the current statement does not have a body

                // Add current statement to the body of the statement above
                // aboveMultilineStmt.body.push(removedItem[0]);
                // Update the positions of the statements recursively
                rebuildBody(this, 0, 1);

                // if (stmt instanceof VarAssignmentStmt) {
                //     root.scope.references = root.scope.references.filter((ref) => {
                //         ref.statement !== stmt;
                //     });
                // }
                // aboveMultilineStmt.scope.references.push(new Reference(stmt, aboveMultilineStmt.scope));

                // If the statement contains assignments, push them to their new parent scope
                if (stmt instanceof GeneralStatement && stmt.containsAssignments())
                    root.scope.pushToScope(aboveMultilineStmt.scope, stmt.getAssignments());
            } else {
                // If the current statement has a body

                // All statements contained in the body of the current statement need to be indented
                // as well
                const stmtStack = new Array<Statement>();
                // stmtStack.unshift(...removedItem[0].body);

                while (stmtStack.length > 0) {
                    const curStmt = stmtStack.pop();
                    // Shift to the right
                    curStmt.build(new Position(curStmt.lineNumber, curStmt.leftCol + TAB_SPACES));

                    // Keep doing it recusiveley
                    if (curStmt.hasBody()) stmtStack.unshift(...curStmt.body);
                }

                // Add current statement to the body of the statement above
                // aboveMultilineStmt.body.push(removedItem[0]);
                rebuildBody(this, 0, 1);

                // Set the parent scope of the current statement to the scope of the original
                // previous statement
                // TODO: FIX LATER
                // stmt.scope.parentScope = aboveMultilineStmt.scope;
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
        // The parent statement
        const parent = providedContext.codeConstruct;

        if (!parent.hasBody()) return;

        while (parent.body.length > 0) {
            // Indent the last statement in the body
            this.indentConstruct(parent.body[parent.body.length - 1], backwards);
        }
    }

    /**
     * Indent the given statement backwards or forwards
     *
     * @param statement - The statement to be indented
     * @param backwards - Whether to indent backwards or forwards
     */
    indentConstruct(statement: CodeConstruct, backwards: boolean) {
        // Performs the indentation of the last statement in the body
        this.editor.indentRecursively(statement, { backward: backwards });
        // Restructures the AST to following the new indentation
        // This action results in the current last statement being removed from the body
        // of the current line statement
        if (backwards) {
            this.indentBackStatement(statement);
        } else {
            this.indentForwardStatement(statement);
        }
    }

    // /**
    //  * CURRENTLY NOT USED => MIGHT BE USEFULL FOR LISTS OF ITEMS IN THE FUTURE
    //  *
    //  * @param code
    //  * @param start
    //  * @param count
    //  * @returns
    //  */
    // removeItems(code: Construct, start: number, count: number): Array<Construct> {
    //     if (code instanceof Statement) {
    //         const removedItems = code.tokens.splice(start, count);

    //         for (const item of removedItems) {
    //             this.recursiveNotify(item, CallbackType.delete);
    //         }

    //         code.rebuild(code.getLeftPosition(), 0);

    //         return removedItems;
    //     }

    //     return [];
    // }

    /**
     * Remove the given construct from the editor
     *
     * @param construct - The construct to be removed
     * @param options - Options for the removal
     * * executeEdit - Whether to execute the edit in the monaco editor or not.
     * Also creates a hole in the place of the removed construct and updates the focus.
     * @returns - The construct that replaces the removed construct
     */
    deleteConstruct(construct: Construct, options: { executeEdit: boolean } = { executeEdit: true }): Construct {
        const root = construct.rootNode;

        // In the absence of a root construct, return
        if (!root) return;

        // Create the hole to replace the removed construct
        const replacement = new TypedEmptyExpr(
            [DataType.Any],
            root,
            construct.indexInRoot,
            root.holeTypes.get(construct.indexInRoot)
        );

        // Remove the construct from the AST
        root.tokens.splice(construct.indexInRoot, 1, replacement);

        // Rebuild everything following the removed construct
        ASTManupilation.rebuild(replacement, construct.getLeftPosition());

        // If the monaco editor should be updated, replace the construct in the monaco
        // editor and update focus
        if (options.executeEdit) {
            this.editor.executeEdits(construct.getBoundaries(), replacement);
            this.focus.updateContext({ tokenToSelect: replacement });
        }

        // Notify all (sub)constructs that have been deleted
        construct.notify(CallbackType.delete);

        return replacement;
    }

    // /**
    //  * Remove the statement and replace it with an empty line
    //  *
    //  * @param line - The statement to be removed
    //  * @returns - The empty line that replaces the removed statement
    //  */
    // private removeStatement(line: GeneralStatement): Construct {
    //     // Get the root of the construct
    //     const root = line.rootNode;

    //     if (root instanceof Module || root instanceof GeneralStatement) {
    //         // Create empty line replacement
    //         const replacement = new EmptyLineStmt(root, line.indexInRoot);
    //         // Notify the construct that has been deleted
    //         this.recursiveNotify(line, CallbackType.delete);
    //         // Replace in the root the removed construct with the empty line
    //         root.body.splice(line.indexInRoot, 1, replacement);
    //         // Build the left and right positions and linenumber of the new construct
    //         replacement.build(line.getLeftPosition());

    //         // Rebuilds all linenumbers for the entire editor
    //         // rebuildBody(this, 0, 1); // <--- THIS IS THE PROBLEM
    //         ASTManupilation.rebuild(replacement, line.getLeftPosition());

    //         return replacement;
    //     }

    //     return null;
    // }

    /**
     * Remove a statement without replacing
     * Same as removeStatement but without replacing the construct with an empty line
     *
     * @param line - The line to be removed without replacing it with an empty line
     */
    deleteLine(line: Construct) {
        const root = line.rootNode;

        if (root instanceof Module || root instanceof GeneralStatement) {
            this.recursiveNotify(line, CallbackType.delete);
            root.body.splice(line.indexInRoot, 1);
            rebuildBody(this, 0, 1);
        }
    }

    // /**
    //  * MAYBE PLACE THIS IN THE AST ASWELL?
    //  *
    //  * Remove the given Construct from the editor and update the focus context
    //  * It also replaces the construct with the correct "placeholder" construct
    //  *
    //  * @param code
    //  * @param param1
    //  */
    // deleteCode(code: Construct, { statement = false, replaceType = null } = {}) {
    //     // Get range of the construct to delete
    //     const replacementRange = code.getBoundaries();
    //     // The construct to replace the deleted code with
    //     let replacement: Construct;

    //     // If the construct to delete is a statement
    //     if (statement) replacement = this.removeStatement(code as GeneralStatement);
    //     // If the construct to delete is a expression
    //     else replacement = this.replaceItemWTypedEmptyExpr(code, replaceType);

    //     // Replace all characters in the Monaco editor with the replacement construct
    //     this.editor.executeEdits(replacementRange, replacement);
    //     // Update the focus context
    //     this.focus.updateContext({ tokenToSelect: replacement });
    // }

    // /**
    //  * Rebuild the root and all of its children after a child construct has
    //  * been deleted. Includes updating the left and right positions and the
    //  * linenumbers
    //  *
    //  * @param item - The construct that has been deleted
    //  * @param root - The root of the construct
    //  */
    // private rebuildOnConstructDeletion(item: Construct, root: CodeConstruct) {
    //     // Notify the construct that has been deleted
    //     this.recursiveNotify(item, CallbackType.delete);

    //     // Update indices and root nodes of all tokens of the root
    //     for (let i = 0; i < root.tokens.length; i++) {
    //         root.tokens[i].indexInRoot = i;
    //         root.tokens[i].rootNode = root;
    //     }

    //     // Update left and right positions of the root
    //     // root.rebuild(root.getLeftPosition(), 0);
    //     ASTManupilation.rebuild(root, root.getLeftPosition());
    // }

    // replaceItemWTypedEmptyExpr(item: Construct, replaceType: DataType): Construct {
    //     const root = item.rootNode as CodeConstruct; // TODO: Not okay

    //     // if (!(root instanceof GeneralStatement)) return null; // TODO: Can this be deleted?

    //     // if (root instanceof ListLiteralExpression || root instanceof FormattedStringCurlyBracketsExpr)
    //     //     replaceType = DataType.Any;

    //     let replacedItem = null;
    //     const allowedTypes = DataType.Any; //root.getCurrentAllowedTypesOfHole(item.indexInRoot, true);

    //     replacedItem = new TypedEmptyExpr(
    //         replaceType !== null ? [replaceType] : [DataType.Any],
    //         root,
    //         item.indexInRoot,
    //         root.holeTypes.get(item.indexInRoot)
    //     );

    //     if (allowedTypes.length > 0) replacedItem.type = allowedTypes;

    //     // root.onReplaceToken({ indexInRoot: item.indexInRoot, replaceWithEmptyExpr: true });
    //     root.tokens.splice(item.indexInRoot, 1, replacedItem);
    //     this.rebuildOnConstructDeletion(item, root);

    //     return replacedItem;
    // }

    // removeItem(item: CodeConstruct): void {
    //     const root = item.rootNode;
    //     if (root instanceof GeneralStatement) {
    //         root.onDeleteFrom({ indexInRoot: item.indexInRoot }); // Remove
    //         root.tokens.splice(item.indexInRoot, 1);
    //         this.rebuildOnConstructDeletion(item, root);
    //     }
    // }

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
     *
     * @param code the statement to be added
     * @param index the index to add the `code` statement
     * @param line the line number that will be given to the newly added statement
     */
    addStatementToBody(bodyContainer: GeneralStatement | Module, code: Statement, index: number, line: number) {
        // Add code to the body of the container
        bodyContainer.body.splice(index, 0, code);
        // Increase the index of all statements in the container after the newly added statement
        for (let i = index + 1; i < bodyContainer.body.length; i++) bodyContainer.body[i].indexInRoot++;

        // Rebuild all statements following the newly added statement in the container
        rebuildBody(bodyContainer, index + 1, line + code.getHeight());
        // Set the parentscope to be the scope of the container
        if (code.hasScope()) code.scope.parentScope = bodyContainer.scope;

        // Container has been changed, so call the notify method
        if (bodyContainer instanceof GeneralStatement) {
            bodyContainer.notify(CallbackType.change);
        }
    }

    // /**
    //  * Add the assignment to the current working scope.
    //  *
    //  * @param statement - The assignment statement adding the variable
    //  * @param workingScope - The direct scope in which the action is performed
    //  */
    // processNewVariable(statement: Statement, workingScope: Scope) {
    //     if (statement instanceof VarAssignmentStmt) {
    //         workingScope.references.push(new Reference(statement, workingScope));
    //     }

    //     if (statement instanceof ForStatement) {
    //         statement.scope.references.push(new Reference(statement.loopVar, workingScope));
    //     }
    // }
    // SUPERSEDED BY A METHOD ON THE SCOPE CLASS

    // /**
    //  *
    //  *
    //  * @returns
    //  */
    // insertEmptyLine(): EmptyLineStmt {
    //     // Current cursor position
    //     const curPos = this.editor.monaco.getPosition();
    //     // The statement in / at which the cursor is currently located
    //     const curStmt = this.focus.getFocusedStatement();
    //     // Parent of the current statement
    //     const curRoot = curStmt.rootNode;

    //     // Column positions in the editor start at one
    //     let leftPosToCheck = 1;
    //     // Does the root statement have a body?
    //     let parentStmtHasBody = false;
    //     // String to add by default to start on the next line in the
    //     // monaco editor
    //     const textToAdd = "\n";
    //     // Keeps track of the number of spaces to add
    //     let spaces = "";
    //     let atCompoundStmt = false;

    //     // TODO: How to rewrite?
    //     // If the current statement is inside the body of its root
    //     if (curRoot instanceof GeneralStatement && curRoot.hasBody()) {
    //         // The left editor position of the current statement
    //         leftPosToCheck = curRoot.leftCol + TAB_SPACES;
    //         // The parent statement has a body
    //         parentStmtHasBody = true;

    //         // Add the required number of spaces to give a statement
    //         // the required indentation
    //         spaces += " ".repeat(leftPosToCheck - 1);
    //     }

    //     // If the current statement has a body and the cursor is not at the start of the statement
    //     // PROBABLY: if the cursor is not at the start of the statement, it is at the end
    //     // meaning that the empty line should be inserted after the current statement in
    //     // its body
    //     if (curStmt instanceof GeneralStatement && curStmt.hasBody() && curPos.column != curStmt.leftCol) {
    //         // is at the header / first body statement of a statement with body
    //         // The left editor position of a body statement
    //         leftPosToCheck = curStmt.leftCol + TAB_SPACES;
    //         // The current statement has a body
    //         parentStmtHasBody = true;
    //         atCompoundStmt = true;

    //         // Add the required number of spaces to give a statement
    //         // the required indentation
    //         spaces += " ".repeat(leftPosToCheck - 1);
    //     }

    //     // VERDER KIJKEN HOE DIT WERKT!
    //     // VOORAL: hoe dat de eerste if + tweede if spaces samen nog steeds valid zijn

    //     if (curPos.column == leftPosToCheck) {
    //         // insert emptyStatement at this line, move other statements down
    //         // const emptyLine = new EmptyLineStmt(parentStmtHasBody ? curRoot : this, curStmt.indexInRoot);
    //         const emptyLine = new EmptyLineStmt(curRoot, curStmt.indexInRoot);

    //         emptyLine.build(curStmt.getLeftPosition());

    //         if (parentStmtHasBody) {
    //             this.addStatementToBody(
    //                 curRoot as GeneralStatement,
    //                 emptyLine,
    //                 curStmt.indexInRoot,
    //                 curStmt.lineNumber
    //             );
    //         } else this.addStatementToBody(this, emptyLine, curStmt.indexInRoot, curStmt.lineNumber);

    //         const range = new Range(curStmt.lineNumber - 1, 1, curStmt.lineNumber - 1, 1);
    //         this.editor.executeEdits(range, null, spaces + textToAdd);

    //         // for (const stmt of this.body) console.log(stmt.getRenderText(), stmt.getRenderText().length);
    //         return emptyLine;
    //     } else {
    //         // insert emptyStatement on next line, move other statements down
    //         // const emptyLine = new EmptyLineStmt(parentStmtHasBody ? curRoot : this, curStmt.indexInRoot + 1);
    //         const emptyLine = new EmptyLineStmt(curRoot, curStmt.indexInRoot + 1);
    //         emptyLine.build(new Position(curStmt.right.lineNumber + 1, leftPosToCheck));

    //         if (parentStmtHasBody && atCompoundStmt) {
    //             emptyLine.indexInRoot = 0;
    //             emptyLine.rootNode = curStmt;
    //             this.addStatementToBody(curStmt as GeneralStatement, emptyLine, 0, curStmt.lineNumber + 1);
    //         } else if (parentStmtHasBody) {
    //             this.addStatementToBody(
    //                 curRoot as GeneralStatement,
    //                 emptyLine,
    //                 curStmt.indexInRoot + 1,
    //                 curStmt.lineNumber + 1
    //             );
    //         } else this.addStatementToBody(this, emptyLine, curStmt.indexInRoot + 1, curStmt.right.lineNumber + 1);

    //         const range = new Range(
    //             curStmt.right.lineNumber,
    //             curStmt.rightCol,
    //             curStmt.right.lineNumber,
    //             curStmt.rightCol
    //         );
    //         this.editor.executeEdits(range, null, textToAdd + spaces);
    //         this.focus.updateContext({ tokenToSelect: emptyLine });

    //         return emptyLine;
    //     }
    // }

    /**
     * Replace the focussed expression with the given expression
     *
     * CURRENTLY ONLY EXPRESSIONS CAN BE REPLACED!!! SHOULD BE GENERALISED!!!
     *
     * @param expr - The expression to replace the focussed expression with
     */
    replaceFocusedExpression(construct: Construct) {
        // Current context
        const context = this.focus.getContext();

        // The construct to replace the focussed construct with
        // Try first to replace the focussed construct, then the focused token
        let codeToReplace: Construct = /*context.codeconstruct ??*/ context.token; // Always deleting a EmptyTypedExpr token

        const root = codeToReplace.rootNode as CodeConstruct;
        root.replace(construct, codeToReplace.indexInRoot);
    }

    closeConstructDraftRecord(code: Construct) {
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

    /**
     * Retrieve the current status of the code, i.e. if it is runnable or not,
     * and highlight constructs violating the status if required.
     *
     * WILL NEED SOME REWRITES!!!
     *
     * @param highlightConstructs - Whether to highlight constructs violating the status
     * @returns The status of the code
     */
    getCodeStatus(highlightConstructs: boolean = false) {
        let status = null;

        if (this.body.length === 0 || (this.body.length === 1 && this.body[0] instanceof EmptyLineStmt)) {
            return CodeStatus.Empty;
        }

        const stack: Construct[] = [];
        stack.push(...this.body);

        while (stack.length > 0) {
            let cur: Construct = stack.pop();
            const hasDraftMode = cur.draftModeEnabled;

            if (cur instanceof TypedEmptyExpr /*&& !cur.isListElement()*/) {
                status = status ?? CodeStatus.ContainsEmptyHoles;

                if (highlightConstructs && !hasDraftMode) cur.addHighlight(ERROR_HIGHLIGHT_COLOUR, this.editor);
            } else if (cur instanceof AutocompleteTkn) {
                status = status ?? CodeStatus.ContainsAutocompleteTokens;

                if (highlightConstructs && !hasDraftMode) cur.addHighlight(ERROR_HIGHLIGHT_COLOUR, this.editor);
            } else if (cur.draftModeEnabled) {
                status = status ?? CodeStatus.ContainsDraftMode;

                if (highlightConstructs && !hasDraftMode) cur.addHighlight(ERROR_HIGHLIGHT_COLOUR, this.editor);
            } else if (cur instanceof Expression && cur.tokens.length > 0) {
                const addHighlight = false; //cur instanceof ListLiteralExpression && !cur.isHolePlacementValid();
                status = addHighlight ? CodeStatus.ContainsEmptyHoles : status;

                for (let i = 0; i < cur.tokens.length; i++) {
                    if (
                        cur.tokens[i] instanceof TypedEmptyExpr &&
                        addHighlight &&
                        i < cur.tokens.length - 2 &&
                        !hasDraftMode
                    ) {
                        cur.tokens[i].addHighlight(ERROR_HIGHLIGHT_COLOUR, this.editor);
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
    performActionOnBFS(duringAction: (code: Construct) => void) {
        // List with all CodeConstructs
        const Q: Construct[] = [];
        // Push all statements of the body of the module to the list
        Q.push(...this.body);

        // As long as there exists some construct in the list
        while (Q.length > 0) {
            // Delete the first element of the list
            let curr: Construct = Q.splice(0, 1)[0];

            // If the current construct has tokens and possibly a body
            if (curr instanceof GeneralStatement) {
                // Push all of its tokens to the list
                Q.push(...curr.tokens);

                if (curr.hasBody()) Q.push(...curr.body);
            }

            // Perform the given action on the current construct
            duringAction(curr);
        }
    }

    getAllImportStmts(): ImportStatement[] {
        const stmts: ImportStatement[] = [];

        this.performActionOnBFS((code: Construct) => {
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
