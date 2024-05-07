import { Position, Selection } from "monaco-editor";
import {
    AutocompleteTkn,
    CodeConstruct,
    CompoundConstruct,
    Construct,
    EditableTextTkn,
    EmptyLineStmt,
    GeneralExpression,
    GeneralStatement,
    IdentifierTkn,
    // LiteralValExpr,
    NonEditableTkn,
    // OperatorTkn,
    Statement,
    TextEditable,
    Token,
} from "../syntax-tree/ast";
import { CallbackType } from "../syntax-tree/callback";
import { Module } from "../syntax-tree/module";
import { doesConstructContainPos } from "../utilities/util";
import { ConstructName } from "./consts";

export class Focus {
    module: Module;

    // List of callback functions
    onNavChangeCallbacks = new Array<(c: Context) => void>();
    onNavOffCallbacks = new Map<ConstructName, Array<(c: Context) => void>>();

    prevPosition: Position = null;

    constructor(module: Module) {
        this.module = module;

        // Register a function: whenever the position of the cursor changes, call the function
        this.module.editor.monaco.onDidChangeCursorPosition((e) => this.fireOnNavChangeCallbacks());
    }

    /**
     * Register a new function to be called whenever the cursor position changes.
     *
     * @param callback - Function to be called when the cursor position changes
     */
    subscribeOnNavChangeCallback(callback: (c: Context) => void) {
        this.onNavChangeCallbacks.push(callback);
    }

    /**
     * DEAD CODE?!?
     * Register a new function to be called whenever the focus moves off of a construct.
     *
     * @param constructName - The name of the construct to subscribe to
     * @param callback - Function to be called when the focus moves off of the construct
     */
    // subscribeOnNavOffCallbacks(constructName: ConstructName, callback: (c: Context) => void) {
    //     if (this.onNavOffCallbacks.get(constructName)) {
    //         const callbackArr = this.onNavOffCallbacks.get(constructName);
    //         callbackArr.push(callback);
    //         this.onNavOffCallbacks.set(constructName, callbackArr);
    //     } else {
    //         this.onNavOffCallbacks.set(constructName, [callback]);
    //     }
    // }

    /**
     * Searches for the left, right or parent expression of the focused token and checks if it is
     * in draft node and returns it.
     *
     * @param providedContext - The context to search in. If not provided, the current context will be used.
     * @returns - The containing draft node, or null if not found.
     */
    getContainingDraftNode(providedContext?: Context): Construct {
        const context = providedContext ? providedContext : this.getContext();
        const focusedNode = context.token && context.selected ? context.token : context.codeConstruct;

        let node = null;

        if (context.expressionToLeft?.draftModeEnabled) {
            node = context.expressionToLeft;
        } else if (context.expressionToRight?.draftModeEnabled) {
            node = context.expressionToRight;
        } else if (
            focusedNode instanceof Token &&
            !(focusedNode.rootNode instanceof Module) &&
            focusedNode.rootNode.draftModeEnabled
        ) {
            node = focusedNode.rootNode;
        }

        return node;
    }

    /**
     * Check if, in order, the current, left or right token is text editable and return it.
     * Editable tokens are IdentifierTkn, EditableTextTkn and AutocompleteTkn.
     *
     * @param providedContext - The context to search in. If not provided, the current context will be used.
     * @returns - The text editable item, or null if not found.
     */
    getTextEditableItem(providedContext?: Context): TextEditable {
        const context = providedContext ? providedContext : this.getContext();

        if (
            context.token instanceof IdentifierTkn ||
            context.token instanceof EditableTextTkn ||
            context.token instanceof AutocompleteTkn
        ) {
            return context.token;
        } else if (
            context.tokenToLeft instanceof IdentifierTkn ||
            context.tokenToLeft instanceof EditableTextTkn ||
            context.tokenToLeft instanceof AutocompleteTkn
        ) {
            return context.tokenToLeft;
        } else if (
            context.tokenToRight instanceof IdentifierTkn ||
            context.tokenToRight instanceof EditableTextTkn ||
            context.tokenToRight instanceof AutocompleteTkn
        ) {
            return context.tokenToRight;
        }
    }

    // TODO: when changing context (through navigation) and updating focusedToken => make sure to call .notify

    /**
     * Calculates and returns the current context based on the focused position, or selected code in the editor.
     */
    getContext(position?: Position): Context {
        const curPosition = position ? position : this.module.editor.monaco.getPosition();
        const curSelection = this.module.editor.monaco.getSelection();
        const curLine = this.getConstructAtPosition(curPosition) as Statement; //this.getStatementAtLineNumber(curPosition.lineNumber);
        let context: Context;

        if (!curSelection.getStartPosition().equals(curSelection.getEndPosition())) {
            context = this.getContextFromSelection(
                curLine,
                curSelection.getStartPosition(),
                curSelection.getEndPosition()
            );
        } else context = this.getContextFromPosition(curLine, curPosition);

        context.position = curPosition;

        console.log("Context", context)

        return context;
    }

    /**
     * Searches and returns the focused statement (line) in the editor.
     *
     * @returns The focused statement (line) in the editor.
     */
    getFocusedStatement(): Statement {
        return this.getConstructAtPosition(this.module.editor.monaco.getPosition()) as Statement; //this.getStatementAtLineNumber(this.module.editor.monaco.getPosition().lineNumber);
    }

    /**
     * This is mostly called from the AST, for example after a code has been inserted and the cursor should focus to
     * the first empty hole or after the inserted code.
     */
    updateContext(newContext: UpdatableContext) {
        // Update monaco selection and cursor position
        const focusedLineStatement = this.getFocusedStatement();

        if (newContext.tokenToSelect != undefined) {
            const selection = new Selection(
                newContext.tokenToSelect.right.lineNumber,
                newContext.tokenToSelect.rightCol,
                newContext.tokenToSelect.left.lineNumber,
                newContext.tokenToSelect.leftCol
            );
            this.module.editor.monaco.setSelection(selection);
            this.module.editor.cursor.setSelection(newContext.tokenToSelect);
        } else if (newContext.positionToMove != undefined) {
            this.module.editor.monaco.setPosition(newContext.positionToMove);
            this.module.editor.cursor.setSelection(null);
        }

        // TODO: Both arguments are the same?!
        this.fireOnNavOffCallbacks(focusedLineStatement, this.getFocusedStatement());
        this.fireOnNavChangeCallbacks();
    }

    /**
     * Will try to navigate the cursor to the nearest valid position to the given position.
     *
     * @param pos - The position you are trying to navigate to.
     * @param runNavOffCallbacks - If true, will run the onNavOff callbacks. Defaults to true.
     */
    navigatePos(pos: Position, runNavOffCallbacks: boolean = true) {
        // TODO: This should return the closest construct to the given position if none is at the position, instead of
        // just A construct at the given line
        const focusedConstruct = this.getCodeConstructAtLineNumber(pos.lineNumber); //this.getStatementAtLineNumber(pos.lineNumber);
        // clicked at an empty statement => just update focusedStatement
        if (focusedConstruct instanceof EmptyLineStmt) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedConstruct.leftCol));
            this.module.editor.cursor.setSelection(null);
        }

        // clicked before a statement => navigate to the beginning of the statement
        else if (pos.isBeforeOrEqual(focusedConstruct.left) /*pos.column <= focusedLineStatement.leftCol*/) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedConstruct.leftCol));
            this.module.editor.cursor.setSelection(null);
        }

        // clicked after a statement => navigate to the end of the line
        else if (focusedConstruct.right.isBeforeOrEqual(pos) /*pos.column >= focusedLineStatement.rightCol*/) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedConstruct.rightCol));
            this.module.editor.cursor.setSelection(null);
        } else {
            // look into the tokens of the statement:
            const focusedToken = this.getTokenAtCodeConstructPos(focusedConstruct, pos);

            if (focusedToken instanceof Token && focusedToken.isEmpty) {
                // if clicked on a hole => select the hole
                this.selectCode(focusedToken);
            } else if (focusedToken instanceof EditableTextTkn || focusedToken instanceof IdentifierTkn) {
                // if clicked on a text-editable code construct (identifier or a literal) => navigate to the clicked position (or select it if it's empty)

                if (focusedToken.text.length != 0) {
                    this.module.editor.monaco.setPosition(pos);
                    this.module.editor.cursor.setSelection(null);
                } else this.selectCode(focusedToken);
            } else {
                const hitDistance = pos.column - focusedToken.leftCol;
                const tokenLength = focusedToken.rightCol - focusedToken.leftCol + 1;

                if (hitDistance < tokenLength / 2) {
                    // go to the beginning (or the empty token before this)

                    // If there is still a token to the left of the current token
                    if (focusedConstruct.left.isBefore(focusedToken.left.delta(undefined, -1))) {
                        const tokenBefore = this.getTokenAtCodeConstructPos(
                            focusedConstruct,
                            focusedToken.left.delta(undefined, -1)
                        );

                        if (tokenBefore instanceof Token && tokenBefore.isEmpty) {
                            this.selectCode(tokenBefore);
                        }
                    }

                    this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedToken.leftCol));
                    this.module.editor.cursor.setSelection(null);
                } else {
                    // navigate to the end (or the empty token right after this token)
                    const tokenAfter = this.getTokenAtCodeConstructPos(
                        focusedConstruct,
                        focusedToken.right.delta(undefined, 1)
                    );
                    if (tokenAfter instanceof Token && tokenAfter.isEmpty) {
                        this.selectCode(tokenAfter);
                    } else {
                        this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedToken.rightCol));
                        this.module.editor.cursor.setSelection(null);
                    }
                }
            }
        }

        const curPos = this.module.editor.monaco.getPosition();
        if (runNavOffCallbacks && this.prevPosition != null) {
            const prevConstr = this.getConstructAtPosition(this.prevPosition),
                currConstr = this.getConstructAtPosition(curPos);

            if (prevConstr !== currConstr) this.fireOnNavOffCallbacks(prevConstr as Statement, currConstr as Statement);
        }
        // if (runNavOffCallbacks && this.prevPosition != null && this.prevPosition.lineNumber != curPos.lineNumber) {
        //     this.fireOnNavOffCallbacks(
        //         this.getStatementAtLineNumber(this.prevPosition.lineNumber),
        //         this.getStatementAtLineNumber(curPos.lineNumber)
        //     );
        // }

        this.prevPosition = curPos;

        this.fireOnNavChangeCallbacks();
    }

    /**
     * Moves the cursor one line up if possible
     */
    navigateUp() {
        const curPosition = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getConstructAtPosition(curPosition) as Statement; //this.getStatementAtLineNumber(curPosition.lineNumber);
        const lineAbove = this.getConstructAtPosition(curPosition.delta(-1)) as Statement; //this.getStatementAtLineNumber(curPosition.lineNumber - 1);

        if (focusedLineStatement !== lineAbove) this.fireOnNavOffCallbacks(focusedLineStatement, lineAbove);

        if (curPosition.lineNumber > 1) this.navigatePos(curPosition.delta(-1), false);
        else {
            this.module.editor.monaco.setPosition(curPosition.with(undefined, 1));
            this.module.editor.cursor.setSelection(null);

            this.fireOnNavChangeCallbacks();
        }
    }

    /**
     * Moves the cursor one line down if possible
     */
    navigateDown() {
        const curPosition = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getConstructAtPosition(curPosition);
        const lineBelow = this.getCodeConstructAtLineNumber(curPosition.lineNumber + 1);

        if (focusedLineStatement !== lineBelow) this.fireOnNavOffCallbacks(focusedLineStatement, lineBelow);

        if (lineBelow) this.navigatePos(curPosition.delta(1), false);
        else {
            // navigate to the end of current line
            const curLine = this.getConstructAtPosition(curPosition);
            this.module.editor.monaco.setPosition(new Position(curPosition.lineNumber, curLine.rightCol));
            this.module.editor.cursor.setSelection(null);

            this.fireOnNavChangeCallbacks();
        }
    }

    /**
     * Moves the cursor to the next possible right position
     */
    navigateRight() {
        const curPos = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getConstructAtPosition(curPos);

        if (this.onEndOfLine()) {
            const lineBelow = this.getCodeConstructAtLineNumber(curPos.lineNumber + 1);

            if (lineBelow != null) {
                this.module.editor.monaco.setPosition(lineBelow.left);
                this.module.editor.cursor.setSelection(null);
            }
        } else {
            const curSelection = this.module.editor.monaco.getSelection();
            const focusedLineStatement = this.getConstructAtPosition(curPos); // Superfluous?
            let nextPos = curPos;

            if (!curSelection.getEndPosition().equals(curSelection.getStartPosition()))
                nextPos = curSelection.getEndPosition();

            if (
                !curSelection.getEndPosition().equals(curSelection.getStartPosition()) &&
                curSelection.getEndPosition().equals(focusedLineStatement.right)
            ) {
                // if selected a thing that is at the beginning of a line (usually an identifier) => nav to the beginning of the line
                this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, focusedLineStatement.rightCol));
                this.module.editor.cursor.setSelection(null);
            } else {
                const tokenAfter = this.getTokenAtCodeConstructPos(focusedLineStatement, nextPos);

                if (tokenAfter instanceof NonEditableTkn /*|| tokenAfter instanceof OperatorTkn*/) {
                    // should skip this NonEditableTkn, and move to the next thing after it.

                    // getTokenAtStatementColumn for a token.right will return the next token (as left is inclusive)
                    const tokenAfterAfter = this.getTokenAtCodeConstructPos(focusedLineStatement, tokenAfter.right);

                    if (tokenAfterAfter instanceof Token && tokenAfterAfter.isEmpty) {
                        this.selectCode(tokenAfterAfter);
                    } else if (tokenAfterAfter instanceof EditableTextTkn || tokenAfterAfter instanceof IdentifierTkn) {
                        this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, tokenAfterAfter.leftCol));
                        this.module.editor.cursor.setSelection(null);
                    } else if (tokenAfterAfter != null) {
                        // probably its another expression, but should go to the beginning of it
                        this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, tokenAfterAfter.leftCol));
                        this.module.editor.cursor.setSelection(null);
                    } else {
                        this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, tokenAfter.rightCol));
                        this.module.editor.cursor.setSelection(null);
                    }
                } else if (tokenAfter instanceof Token && tokenAfter.isEmpty) {
                    // if char[col + 1] is H => just select H

                    this.selectCode(tokenAfter);
                } else if (tokenAfter instanceof EditableTextTkn || tokenAfter instanceof IdentifierTkn) {
                    // if char[col + 1] is a literal => go through it

                    this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, tokenAfter.leftCol));
                    this.module.editor.cursor.setSelection(null);
                }
            }
        }

        this.fireOnNavOffCallbacks(
            focusedLineStatement,
            this.getConstructAtPosition(this.module.editor.monaco.getPosition()) as Statement
        );
        this.fireOnNavChangeCallbacks();
    }

    /**
     * Moves the cursor to the next possible left position
     */
    navigateLeft() {
        const curPos = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getConstructAtPosition(curPos) as Statement;

        if (this.onBeginningOfLine()) {
            if (curPos.lineNumber > 1) {
                const lineBelow = this.getConstructAtPosition(curPos.delta(-1));

                if (lineBelow != null) {
                    this.module.editor.monaco.setPosition(lineBelow.right);
                    this.module.editor.cursor.setSelection(null);
                }
            }
        } else {
            const curSelection = this.module.editor.monaco.getSelection();
            const focusedLineStatement = this.getConstructAtPosition(curPos) as Statement;
            let prevPos = this.module.editor.monaco.getPosition().delta(undefined, -1);

            if (!curSelection.getEndPosition().equals(curSelection.getStartPosition()))
                prevPos = curSelection.getStartPosition().delta(undefined, -1); //curSelection.startColumn - 1;

            if (
                !curSelection.getEndPosition().equals(curSelection.getStartPosition()) &&
                curPos.equals(focusedLineStatement.left)
            ) {
                // if selected a thing that is at the beginning of a line (usually an identifier) => nav to the beginning of the line
                this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, focusedLineStatement.leftCol));
                this.module.editor.cursor.setSelection(null);
            } else {
                const tokenBefore = this.getTokenAtCodeConstructPos(focusedLineStatement, prevPos);

                if (tokenBefore instanceof NonEditableTkn /*|| tokenBefore instanceof OperatorTkn*/) {
                    // if char[col - 1] is N => just go to the beginning of N

                    const tokenBeforeBefore = this.getTokenAtCodeConstructPos(
                        focusedLineStatement,
                        tokenBefore.left.delta(undefined, -1)
                    );

                    if (tokenBeforeBefore instanceof Token && tokenBeforeBefore.isEmpty) {
                        this.selectCode(tokenBeforeBefore);
                    } else if (
                        tokenBeforeBefore instanceof Token &&
                        (tokenBeforeBefore instanceof EditableTextTkn || tokenBeforeBefore instanceof IdentifierTkn)
                    ) {
                        this.module.editor.monaco.setPosition(
                            new Position(curPos.lineNumber, tokenBeforeBefore.rightCol)
                        );
                        this.module.editor.cursor.setSelection(null);
                    } else {
                        this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, tokenBefore.leftCol));
                        this.module.editor.cursor.setSelection(null);
                    }
                } else if (tokenBefore instanceof Token && tokenBefore.isEmpty) {
                    // if char[col - 1] is H => just select H

                    this.selectCode(tokenBefore);
                } else if (tokenBefore instanceof EditableTextTkn) {
                    // if char[col - 1] is a literal => go through it
                }
            }
        }

        this.fireOnNavOffCallbacks(
            focusedLineStatement,
            this.getConstructAtPosition(this.module.editor.monaco.getPosition()) as Statement
        );
        this.fireOnNavChangeCallbacks();
    }

    /**
     * Returns true if the focus is within a text editable token, otherwise, returns false.
     */
    isTextEditable(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.getContext();

        return (
            (context.token != null && context.token.isTextEditable) ||
            (context.tokenToLeft != null && context.tokenToLeft.isTextEditable) ||
            (context.tokenToRight != null && context.tokenToRight.isTextEditable)
        );
    }

    /**
     * Returns true if the focus is on the end of a line, otherwise, returns false.
     */
    onEndOfLine(): boolean {
        const curSelection = this.module.editor.monaco.getSelection();

        if (curSelection.startColumn == curSelection.endColumn) {
            const curPosition = curSelection.getStartPosition();
            const focusedLineStatement = this.getConstructAtPosition(curPosition);

            if (focusedLineStatement != null && curPosition.column == focusedLineStatement.rightCol) return true;
        }

        return false;
    }

    /**
     * Returns true if the focus is on the beginning of a line, otherwise, returns false.
     */
    onBeginningOfLine(): boolean {
        const curSelection = this.module.editor.monaco.getSelection();

        if (curSelection.startColumn == curSelection.endColumn) {
            const curPosition = curSelection.getStartPosition();
            const focusedLineStatement = this.getConstructAtPosition(curPosition);

            if (focusedLineStatement != null && curPosition.column == focusedLineStatement.leftCol) return true;
        }

        return false;
    }

    /**
     * Returns true if focused within a line that is inside the body of another statement.
     */
    inTabbedLine(providedContext?: Context): boolean {
        const curLine = providedContext ? providedContext.codeConstruct : this.getFocusedStatement();

        return curLine.getLeftPosition().column > 1;
    }

    /**
     * Returns true if a line exists below the focused line, otherwise, returns false.
     */
    existsLineBelow(): boolean {
        const curPos = this.module.editor.monaco.getPosition();

        return this.getCodeConstructAtLineNumber(curPos.lineNumber + 1) != null;
    }

    /**
     * Returns true if the user is focused on an empty line, otherwise, returns false.
     */
    onEmptyLine(): boolean {
        const curLine = this.getFocusedStatement();

        return curLine instanceof EmptyLineStmt;
    }

    /**
     * Finds the closest Token to the given column inside the given statement.
     * Including left side of the token, excluding right side of the token.
     * @param statement the statement to search inside.
     * @param column the given column to search with (usually from current position)
     * @returns the found Token at the given column in which the following condition holds true: token.left <= column < token.right
     */
    private getTokenAtCodeConstructPos(statement: CodeConstruct, pos: Position): Construct {
        const tokensStack = new Array<Construct>();

        if (statement && statement instanceof CodeConstruct) tokensStack.unshift(...statement.tokens);
        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken instanceof Token && doesConstructContainPos(curToken, pos, { left: true, right: false }))
                return curToken;

            if (curToken instanceof CodeConstruct)
                if (curToken.tokens.length > 0) tokensStack.unshift(...curToken.tokens);
                else return curToken;
        }

        return null;
    }

    /**
     * This function will fire all of the subscribed nav-change callbacks.
     */
    fireOnNavChangeCallbacks() {
        const context = this.getContext();

        for (const callback of this.onNavChangeCallbacks) {
            callback(context);
        }
    }

    /**
     * This function will fire all of the subscribed before nav off variable assignment callbacks.
     * These will run for all statements that have a callback attached, not just for oldStatement.
     */
    fireOnNavOffCallbacks(oldStatement: Construct, newStatement: Construct) {
        const context = this.getContext();

        if (oldStatement && oldStatement !== newStatement) {
            oldStatement.notify(CallbackType.onFocusOff);

            //these will run for all statements that have a callback attached, not just for oldStatement
            //if you want to run a callback only on oldStatement, use CallbackType.onFocusOff
            //Think of this array as the global list of functions that gets called when we navigate off of a certain statement type
            //and of CallbackType.onFocusOff as the callback called on a specific instance of  a code construct
            const callbackArr =
                this.onNavOffCallbacks.get(ConstructName.Default /*oldStatement.codeConstructName*/) ?? [];
            for (const callback of callbackArr) {
                callback(context);
            }
        } else {
            oldStatement.notify(CallbackType.onFocusOff);
        }
    }

    /**
     * Recursively searches for all of the body and statements that have bodies and looks for the statement (line) with the given lineNumber.
     * @param line the given line number to search for.
     * @returns the Statement object of that line.
     */
    getCodeConstructAtLineNumber(line: number): CodeConstruct {
        const bodyStack = [this.module.compoundConstruct];

        // bodyStack.unshift(...this.module.body);
        // bodyStack.unshift(
        //     ...(this.module.compoundConstruct instanceof CodeConstruct ? this.module.compoundConstruct.tokens : [])
        // );

        while (bodyStack.length > 0) {
            const curStmt = bodyStack.pop();

            if (!(curStmt instanceof CodeConstruct)) continue;

            // TODO: Could be multiple constructs on the same line, how to fix this?
            if (curStmt.left.lineNumber <= line && line <= curStmt.right.lineNumber) return curStmt;
            else bodyStack.unshift(...curStmt.tokens);
            // else if (curStmt.hasBody()) bodyStack.unshift(...curStmt.body);
        }

        return null;
    }

    /**
     * Recursively searches through all code constructs and looks for the construct
     * at the given position
     *
     * If the position is on the border between two constructs, the construct on the
     * right side will be returned.
     *
     * @param position the given line number to search for.
     * @returns the Statement object of that line.
     */
    getConstructAtPosition(position: Position): CodeConstruct {
        const bodyStack = [this.module.compoundConstruct];

        while (bodyStack.length > 0) {
            // Take the next Construct from the stack
            const curStmt = bodyStack.pop();
            // console.log(curStmt, this.module.editor.monaco.getPosition());

            // If the current construct does not contain the given position, skip it
            if (!doesConstructContainPos(curStmt, position)) continue;

            // If the current construct is a CodeConstruct, push its tokens to the stack
            if (curStmt instanceof CodeConstruct) bodyStack.unshift(...curStmt.tokens);
            // For everything else, primarily tokens, there are no subtokens left so we
            // return the parent CodeConstruct
            else return curStmt.rootNode;
        }

        return null;
    }

    /**
     * Selects the given code construct.
     * @param code the editor will set its selection to the left and right of this given code.
     */
    private selectCode(code: Construct) {
        if (code === null) return;

        const selection = new Selection(code.right.lineNumber, code.rightCol, code.left.lineNumber, code.leftCol);

        this.module.editor.monaco.setSelection(selection);
        this.module.editor.cursor.setSelection(code);
    }

    /**
     * Given a statement and a selection, this function will return the context of the selection.
     *
     * @param statement - The statement to search in.
     * @param left  - The left position of the selection.
     * @param right - The right position of the selection.
     * @returns - The context of the selection.
     */
    private getContextFromSelection(statement: Statement, left: Position, right: Position): Context {
        const context = new Context();
        context.codeConstruct = statement;
        const tokensStack = new Array<Construct>();

        // initialize tokensStack
        if (statement instanceof CodeConstruct) tokensStack.unshift(...statement.tokens);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken.left.equals(left) && curToken.right.equals(right)) {
                context.selected = true;

                if (curToken instanceof Token) context.token = curToken;
                else if (curToken instanceof CodeConstruct) context.construct = curToken; // (1)

                return context;
            } else if (curToken instanceof CodeConstruct) {
                if (left.equals(curToken.left) && right.equals(curToken.right)) {
                    // Literally the same as (1) above
                    context.construct = curToken;
                    context.selected = true;

                    break;
                }

                if (curToken.tokens.length > 0) tokensStack.unshift(...curToken.tokens);
                else {
                    console.warn(
                        `getContextFromSelection(statement: ${statement}, left: ${left}, right: ${right}) -> found expression with no child tokens.`
                    );
                }
            }
        }

        return context;
    }

    /**
     * Finds the non-textual hole, read no string, at the given column in the given statement
     *
     * @param statement - Statement to search in
     * @param pos - Column to search for
     * @returns - The non-textual hole at the given column, or null if not found.
     */
    private findNonTextualHole(statement: Statement, pos: Position): Token {
        const tokensStack = new Array<Construct>();

        for (const token of statement.tokens) tokensStack.unshift(token); // One liner: tokensStack.unshift(...statement.tokens);?

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (
                pos == curToken.left &&
                pos == curToken.right &&
                (curToken instanceof EditableTextTkn ||
                    // curToken instanceof LiteralValExpr ||
                    curToken instanceof IdentifierTkn)
            ) {
                // if (curToken instanceof LiteralValExpr && curToken.returns == DataType.Number)
                //     return curToken.tokens[0] as Token;
                // else
                return curToken;
            }

            if (curToken instanceof GeneralExpression)
                if (curToken.tokens.length > 0) for (let token of curToken.tokens) tokensStack.unshift(token);
        }

        return null;
    }

    /**
     * Finds the context of the given position in the given statement.
     *
     * @param statement - The statement to search in.
     * @param pos - The position to search for.
     * @returns - The context of the given position in the given statements.
     */
    private getContextFromPosition(statement: Statement, pos: Position): Context {
        // PROBABLY REFORMAT IN THE FUTURE
        // NOW they search a lot of trees, while this could probably be minimised
        const context = new Context();
        context.codeConstruct = statement;
        const tokensStack = new Array<Construct>();

        if (!statement) console.log("No statement");

        // initialize tokensStack
        if (statement instanceof CodeConstruct) tokensStack.unshift(...statement.tokens);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken instanceof Token) {
                // this code assumes that there is no token with an empty text

                if (pos.equals(curToken.left)) {
                    context.token = this.findNonTextualHole(statement, pos);
                    context.tokenToRight = curToken;
                    context.tokenToLeft = this.searchNonEmptyTokenWithCheck(statement, (token) =>
                        token.right.equals(pos)
                    );

                    if (context.tokenToRight != null) {
                        context.expressionToRight = this.getExpression(
                            context.tokenToRight,
                            context.tokenToRight.rootNode.left.equals(pos)
                        );
                    }
                    if (context.tokenToLeft) {
                        context.expressionToLeft = this.getExpression(
                            context.tokenToLeft,
                            context.tokenToLeft.rootNode.right.equals(pos)
                        );
                    }

                    context.codeConstruct = context.tokenToRight.getNearestCodeConstruct();

                    break;
                } else if (pos.equals(curToken.right)) {
                    context.token = this.findNonTextualHole(statement, pos);
                    context.tokenToLeft = curToken;
                    context.tokenToRight = this.searchNonEmptyTokenWithCheck(statement, (token) =>
                        token.left.equals(pos)
                    );

                    if (context.tokenToRight != null) {
                        context.expressionToRight = this.getExpression(
                            context.tokenToRight,
                            context.tokenToRight.rootNode.left.equals(pos)
                        );
                    }
                    if (context.tokenToLeft) {
                        context.expressionToLeft = this.getExpression(
                            context.tokenToLeft,
                            context.tokenToLeft.rootNode.right.equals(pos)
                        );
                    }
                    context.codeConstruct = context.tokenToLeft.getNearestCodeConstruct();

                    break;
                } else if (doesConstructContainPos(curToken, pos, { left: false, right: false })) {
                    context.token = curToken;
                    // context.parentExpression = context.token.rootNode as Expression;
                    context.codeConstruct = context.token.getNearestCodeConstruct();

                    break;
                }
            } else if (curToken instanceof CodeConstruct) {
                if (curToken.tokens.length > 0) tokensStack.unshift(...curToken.tokens);
                else {
                    console.warn(
                        `getContextFromPosition(statement: ${statement}, column: ${pos}) -> found expression with no child tokens.`
                    );
                }
            }
        }

        return context;
    }

    /**
     * Finds the parent expression of a given token that meets the given 'check' condition.
     */
    private getExpression(token: Token, check: boolean): GeneralExpression {
        if (token.rootNode instanceof GeneralExpression && check) return token.rootNode;

        return null;
    }

    /**
     * Searches the tokens tree for a token that matches the passed check() condition.
     */
    private searchNonEmptyTokenWithCheck(statement: Statement, check: (token: Token) => boolean): Token {
        const tokensStack = new Array<Construct>();

        tokensStack.unshift(...statement.tokens);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken instanceof Token && !curToken.left.equals(curToken.right) && check(curToken)) return curToken;

            if (curToken instanceof GeneralStatement || curToken instanceof CompoundConstruct) {
                if (curToken.tokens.length > 0) tokensStack.unshift(...curToken.tokens);
            }
        }

        return null;
    }
}

export class Context {
    // hierarchical levels:

    token?: Token = null;
    tokenToLeft?: Token = null;
    tokenToRight?: Token = null;

    /**
     * Immediate items
     */
    // parentExpression?: Expression = null;
    construct?: Construct = null;
    expressionToLeft?: GeneralExpression = null;
    expressionToRight?: GeneralExpression = null;

    codeConstruct: CodeConstruct;

    selected?: boolean = false; //this should not be nullable
    position?: Position = null;

    getAutocompleteToken(): AutocompleteTkn {
        if (this.token instanceof AutocompleteTkn) return this.token;
        else if (this.tokenToLeft instanceof AutocompleteTkn) return this.tokenToLeft;
        else if (this.tokenToRight instanceof AutocompleteTkn) return this.tokenToRight;
        else return null;
    }
}

export class UpdatableContext {
    tokenToSelect?: Construct;
    positionToMove?: Position;

    constructor(tokenToSelect?: Token, positionToMove?: Position) {
        this.tokenToSelect = tokenToSelect;
        this.positionToMove = positionToMove;
    }
}
