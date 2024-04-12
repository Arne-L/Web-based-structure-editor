import { Position, Selection } from "monaco-editor";
import {
    AutocompleteTkn,
    Construct,
    EditableTextTkn,
    EmptyLineStmt,
    GeneralExpression,
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
        const focusedNode = context.token && context.selected ? context.token : context.lineStatement;

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
        const curLine = this.getStatementAtLineNumber(curPosition.lineNumber);
        let context: Context;

        if (curSelection.startColumn != curSelection.endColumn) {
            context = this.getContextFromSelection(curLine, curSelection.startColumn, curSelection.endColumn);
        } else context = this.getContextFromPosition(curLine, curPosition.column);

        context.position = curPosition;

        return context;
    }

    /**
     * Searches and returns the focused statement (line) in the editor.
     *
     * @returns The focused statement (line) in the editor.
     */
    getFocusedStatement(): Statement {
        return this.getStatementAtLineNumber(this.module.editor.monaco.getPosition().lineNumber);
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
                newContext.tokenToSelect.getLineNumber(),
                newContext.tokenToSelect.rightCol,
                newContext.tokenToSelect.getLineNumber(),
                newContext.tokenToSelect.leftCol
            );
            this.module.editor.monaco.setSelection(selection);
            this.module.editor.cursor.setSelection(newContext.tokenToSelect);
        } else if (newContext.positionToMove != undefined) {
            this.module.editor.monaco.setPosition(newContext.positionToMove);
            this.module.editor.cursor.setSelection(null);
        }

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
        const focusedLineStatement = this.getStatementAtLineNumber(pos.lineNumber);

        // clicked at an empty statement => just update focusedStatement
        if (focusedLineStatement instanceof EmptyLineStmt) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedLineStatement.leftCol));
            this.module.editor.cursor.setSelection(null);
        }

        // clicked before a statement => navigate to the beginning of the statement
        else if (pos.column <= focusedLineStatement.leftCol) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedLineStatement.leftCol));
            this.module.editor.cursor.setSelection(null);
        }

        // clicked before a statement => navigate to the end of the line
        else if (pos.column >= focusedLineStatement.rightCol) {
            this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedLineStatement.rightCol));
            this.module.editor.cursor.setSelection(null);
        } else {
            // look into the tokens of the statement:
            const focusedToken = this.getTokenAtStatementColumn(focusedLineStatement, pos.column);

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
                    if (focusedToken.leftCol - 1 > focusedLineStatement.leftCol) {
                        const tokenBefore = this.getTokenAtStatementColumn(
                            focusedLineStatement,
                            focusedToken.leftCol - 1
                        );

                        if (tokenBefore instanceof Token && tokenBefore.isEmpty) {
                            this.selectCode(tokenBefore);
                        }
                    }

                    this.module.editor.monaco.setPosition(new Position(pos.lineNumber, focusedToken.leftCol));
                    this.module.editor.cursor.setSelection(null);
                } else {
                    // navigate to the end (or the empty token right after this token)
                    const tokenAfter = this.getTokenAtStatementColumn(focusedLineStatement, focusedToken.rightCol + 1);

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

        if (runNavOffCallbacks && this.prevPosition != null && this.prevPosition.lineNumber != curPos.lineNumber) {
            this.fireOnNavOffCallbacks(
                this.getStatementAtLineNumber(this.prevPosition.lineNumber),
                this.getStatementAtLineNumber(curPos.lineNumber)
            );
        }

        this.prevPosition = curPos;

        this.fireOnNavChangeCallbacks();
    }

    /**
     * Moves the cursor one line up if possible
     */
    navigateUp() {
        const curPosition = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getStatementAtLineNumber(curPosition.lineNumber);
        const lineAbove = this.getStatementAtLineNumber(curPosition.lineNumber - 1);

        this.fireOnNavOffCallbacks(focusedLineStatement, lineAbove);

        if (curPosition.lineNumber > 1)
            this.navigatePos(new Position(curPosition.lineNumber - 1, curPosition.column), false);
        else {
            this.module.editor.monaco.setPosition(new Position(curPosition.lineNumber, 1));
            this.module.editor.cursor.setSelection(null);

            this.fireOnNavChangeCallbacks();
        }
    }

    /**
     * Moves the cursor one line down if possible
     */
    navigateDown() {
        const curPosition = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getStatementAtLineNumber(curPosition.lineNumber);
        const lineBelow = this.getStatementAtLineNumber(curPosition.lineNumber + 1);

        this.fireOnNavOffCallbacks(focusedLineStatement, lineBelow);

        if (lineBelow != null) {
            this.navigatePos(new Position(curPosition.lineNumber + 1, curPosition.column), false);
        } else {
            // navigate to the end of current line
            const curLine = this.getStatementAtLineNumber(curPosition.lineNumber);
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
        const focusedLineStatement = this.getStatementAtLineNumber(curPos.lineNumber);

        if (this.onEndOfLine()) {
            const lineBelow = this.getStatementAtLineNumber(curPos.lineNumber + 1);

            if (lineBelow != null) {
                this.module.editor.monaco.setPosition(new Position(lineBelow.lineNumber, lineBelow.leftCol));
                this.module.editor.cursor.setSelection(null);
            }
        } else {
            const curSelection = this.module.editor.monaco.getSelection();
            const focusedLineStatement = this.getStatementAtLineNumber(curPos.lineNumber); // Superfluous?
            let nextColumn = curPos.column;

            if (curSelection.endColumn != curSelection.startColumn) nextColumn = curSelection.endColumn;

            if (
                curSelection.startColumn != curSelection.endColumn &&
                curSelection.endColumn == focusedLineStatement.rightCol
            ) {
                // if selected a thing that is at the beginning of a line (usually an identifier) => nav to the beginning of the line
                this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, focusedLineStatement.rightCol));
                this.module.editor.cursor.setSelection(null);
            } else {
                const tokenAfter = this.getTokenAtStatementColumn(focusedLineStatement, nextColumn);

                if (tokenAfter instanceof NonEditableTkn /*|| tokenAfter instanceof OperatorTkn*/) {
                    // should skip this NonEditableTkn, and move to the next thing after it.

                    // getTokenAtStatementColumn for a token.right will return the next token (as left is inclusive)
                    const tokenAfterAfter = this.getTokenAtStatementColumn(focusedLineStatement, tokenAfter.rightCol);

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
            this.getStatementAtLineNumber(this.module.editor.monaco.getPosition().lineNumber)
        );
        this.fireOnNavChangeCallbacks();
    }

    /**
     * Moves the cursor to the next possible left position
     */
    navigateLeft() {
        const curPos = this.module.editor.monaco.getPosition();
        const focusedLineStatement = this.getStatementAtLineNumber(curPos.lineNumber);

        if (this.onBeginningOfLine()) {
            if (curPos.lineNumber > 1) {
                const lineBelow = this.getStatementAtLineNumber(curPos.lineNumber - 1);

                if (lineBelow != null) {
                    this.module.editor.monaco.setPosition(new Position(lineBelow.lineNumber, lineBelow.rightCol));
                    this.module.editor.cursor.setSelection(null);
                }
            }
        } else {
            const curSelection = this.module.editor.monaco.getSelection();
            const focusedLineStatement = this.getStatementAtLineNumber(curPos.lineNumber);
            let prevColumn = this.module.editor.monaco.getPosition().column - 1;

            if (curSelection.endColumn != curSelection.startColumn) prevColumn = curSelection.startColumn - 1;

            if (curSelection.startColumn != curSelection.endColumn && curPos.column == focusedLineStatement.leftCol) {
                // if selected a thing that is at the beginning of a line (usually an identifier) => nav to the beginning of the line
                this.module.editor.monaco.setPosition(new Position(curPos.lineNumber, focusedLineStatement.leftCol));
                this.module.editor.cursor.setSelection(null);
            } else {
                const tokenBefore = this.getTokenAtStatementColumn(focusedLineStatement, prevColumn);

                if (tokenBefore instanceof NonEditableTkn /*|| tokenBefore instanceof OperatorTkn*/) {
                    // if char[col - 1] is N => just go to the beginning of N

                    const tokenBeforeBefore = this.getTokenAtStatementColumn(
                        focusedLineStatement,
                        tokenBefore.leftCol - 1
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
            this.getStatementAtLineNumber(this.module.editor.monaco.getPosition().lineNumber)
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
            const focusedLineStatement = this.getStatementAtLineNumber(curPosition.lineNumber);

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
            const focusedLineStatement = this.getStatementAtLineNumber(curPosition.lineNumber);

            if (focusedLineStatement != null && curPosition.column == focusedLineStatement.leftCol) return true;
        }

        return false;
    }

    /**
     * Returns true if focused within a line that is inside the body of another statement.
     */
    inTabbedLine(providedContext?: Context): boolean {
        const curLine = providedContext ? providedContext.lineStatement : this.getFocusedStatement();

        return curLine.getLeftPosition().column > 1;
    }

    /**
     * Returns true if a line exists below the focused line, otherwise, returns false.
     */
    existsLineBelow(): boolean {
        const curPos = this.module.editor.monaco.getPosition();

        return this.getStatementAtLineNumber(curPos.lineNumber + 1) != null;
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
    private getTokenAtStatementColumn(statement: Statement, column: number): Construct {
        const tokensStack = new Array<Construct>();

        tokensStack.unshift(...statement.tokens);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (column >= curToken.leftCol && column < curToken.rightCol && curToken instanceof Token) return curToken;

            if (curToken instanceof GeneralExpression)
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
    fireOnNavOffCallbacks(oldStatement: Statement, newStatement: Statement) {
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
    getStatementAtLineNumber(line: number): Statement {
        const bodyStack = new Array<Statement>();

        bodyStack.unshift(...this.module.body);

        while (bodyStack.length > 0) {
            const curStmt = bodyStack.pop();

            if (line == curStmt.lineNumber) return curStmt;
            else if (curStmt.hasBody()) bodyStack.unshift(...curStmt.body);
        }

        return null;
    }

    /**
     * Selects the given code construct.
     * @param code the editor will set its selection to the left and right of this given code.
     */
    private selectCode(code: Construct) {
        if (code != null) {
            const selection = new Selection(code.getLineNumber(), code.rightCol, code.getLineNumber(), code.leftCol);

            this.module.editor.monaco.setSelection(selection);
            this.module.editor.cursor.setSelection(code);
        }
    }

    /**
     * Given a statement and a selection, this function will return the context of the selection.
     *
     * @param statement - The statement to search in.
     * @param left  - The left position of the selection.
     * @param right - The right position of the selection.
     * @returns - The context of the selection.
     */
    private getContextFromSelection(statement: Statement, left: number, right: number): Context {
        const context = new Context();
        context.lineStatement = statement;
        const tokensStack = new Array<Construct>();

        // initialize tokensStack
        tokensStack.unshift(...statement.tokens);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken.leftCol == left && curToken.rightCol == right) {
                context.selected = true;

                if (curToken instanceof Token) context.token = curToken;
                else if (curToken instanceof GeneralExpression) context.expression = curToken; // (1)

                return context;
            } else if (curToken instanceof GeneralExpression) {
                if (left == curToken.leftCol && right == curToken.rightCol) {
                    // Literally the same as (1) above
                    context.expression = curToken;
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
     * @param column - Column to search for
     * @returns - The non-textual hole at the given column, or null if not found.
     */
    private findNonTextualHole(statement: Statement, column: number): Token {
        const tokensStack = new Array<Construct>();

        for (const token of statement.tokens) tokensStack.unshift(token); // One liner: tokensStack.unshift(...statement.tokens);?

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (
                column == curToken.leftCol &&
                column == curToken.rightCol &&
                (curToken instanceof EditableTextTkn ||
                    // curToken instanceof LiteralValExpr ||
                    curToken instanceof IdentifierTkn)
            ) {
                // if (curToken instanceof LiteralValExpr && curToken.returns == DataType.Number)
                //     return curToken.tokens[0] as Token;
                // else
                if (curToken instanceof EditableTextTkn) return curToken;
                else if (curToken instanceof IdentifierTkn) return curToken;
            }

            if (curToken instanceof GeneralExpression)
                if (curToken.tokens.length > 0) for (let token of curToken.tokens) tokensStack.unshift(token);
        }

        return null;
    }

    /**
     * Finds the context of the given column in the given statement.
     *
     * @param statement - The statement to search in.
     * @param column - The column to search for.
     * @returns - The context of the given column in the given statements.
     */
    private getContextFromPosition(statement: Statement, column: number): Context {
        const context = new Context();
        context.lineStatement = statement;
        const tokensStack = new Array<Construct>();

        // initialize tokensStack
        for (const token of statement?.tokens) tokensStack.unshift(token);

        while (tokensStack.length > 0) {
            const curToken = tokensStack.pop();

            if (curToken instanceof Token) {
                // this code assumes that there is no token with an empty text

                if (column == curToken.leftCol) {
                    context.token = this.findNonTextualHole(statement, column);
                    context.tokenToRight = curToken;
                    context.tokenToLeft = this.searchNonEmptyTokenWithCheck(
                        statement,
                        (token) => token.rightCol == column
                    );

                    if (context.tokenToRight != null) {
                        context.expressionToRight = this.getExpression(
                            context.tokenToRight,
                            context.tokenToRight.rootNode.leftCol == column
                        );
                    }
                    if (context.tokenToLeft) {
                        context.expressionToLeft = this.getExpression(
                            context.tokenToLeft,
                            context.tokenToLeft.rootNode.rightCol == column
                        );
                    }

                    context.lineStatement = context.tokenToRight.getNearestStatement();

                    break;
                } else if (column == curToken.rightCol) {
                    context.token = this.findNonTextualHole(statement, column);
                    context.tokenToLeft = curToken;
                    context.tokenToRight = this.searchNonEmptyTokenWithCheck(
                        statement,
                        (token) => token.leftCol == column
                    );

                    if (context.tokenToRight != null) {
                        context.expressionToRight = this.getExpression(
                            context.tokenToRight,
                            context.tokenToRight.rootNode.leftCol == column
                        );
                    }
                    if (context.tokenToLeft) {
                        context.expressionToLeft = this.getExpression(
                            context.tokenToLeft,
                            context.tokenToLeft.rootNode.rightCol == column
                        );
                    }
                    context.lineStatement = context.tokenToLeft.getNearestStatement();

                    break;
                } else if (column > curToken.leftCol && column < curToken.rightCol) {
                    context.token = curToken;
                    // context.parentExpression = context.token.rootNode as Expression;
                    context.lineStatement = context.token.getNearestStatement();

                    break;
                }
            } else if (curToken instanceof GeneralExpression) {
                if (curToken.tokens.length > 0) tokensStack.unshift(...curToken.tokens);
                else {
                    console.warn(
                        `getContextFromPosition(statement: ${statement}, column: ${column}) -> found expression with no child tokens.`
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

            if (curToken instanceof Token && curToken.leftCol != curToken.rightCol && check(curToken)) return curToken;

            if (curToken instanceof GeneralExpression) {
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
    expression?: GeneralExpression = null;
    expressionToLeft?: GeneralExpression = null;
    expressionToRight?: GeneralExpression = null;

    lineStatement: Statement;

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
