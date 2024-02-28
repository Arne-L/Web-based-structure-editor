import { Position, Range } from "monaco-editor";
import { ErrorMessage } from "../messages/error-msg-generator";
import { ConstructHighlight, ScopeHighlight } from "../messages/messages";
import {
    AssignmentModifier,
    AutocompleteTkn,
    BinaryOperatorExpr,
    CodeConstruct,
    EditableTextTkn,
    ElseStatement,
    EmptyLineStmt,
    EmptyOperatorTkn,
    Expression,
    FormattedStringCurlyBracketsExpr,
    FormattedStringExpr,
    GeneralStatement,
    IdentifierTkn,
    IfStatement,
    Importable,
    ImportStatement,
    ListAccessModifier,
    ListLiteralExpression,
    LiteralValExpr,
    MethodCallModifier,
    Modifier,
    NonEditableTkn,
    OperatorTkn,
    Statement,
    TemporaryStmt,
    Token,
    TypedEmptyExpr,
    UnaryOperatorExpr,
    ValueOperationExpr,
    // VarAssignmentStmt,
    VariableReferenceExpr,
    VarOperationStmt,
} from "../syntax-tree/ast";
import { rebuildBody, replaceInBody } from "../syntax-tree/body";
import { Callback, CallbackType } from "../syntax-tree/callback";
import {
    addClassToDraftModeResolutionButton,
    AutoCompleteType,
    BuiltInFunctions,
    getOperatorCategory,
    IgnoreConversionRecord,
    PythonKeywords,
    StringRegex,
    TAB_SPACES,
    Tooltip,
    TYPE_MISMATCH_ANY,
    TYPE_MISMATCH_ON_FUNC_ARG_DRAFT_MODE_STR,
    TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR,
} from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { Reference } from "../syntax-tree/scope";
import { TypeChecker } from "../syntax-tree/type-checker";
import { getUserFriendlyType, isImportable } from "../utilities/util";
import { LogEvent, Logger, LogType } from "./../logger/analytics";
import { BinaryOperator, DataType, InsertionType } from "./../syntax-tree/consts";
import { EditCodeAction } from "./action-filter";
import { Actions, EditActionType, InsertActionType } from "./consts";
import { EditAction } from "./data-types";
import { Context, UpdatableContext } from "./focus";

/**
 * General logic class responsible for executing the given action. 
 */
export class ActionExecutor {
    /**
     * The current module
     */
    module: Module;

    constructor(module: Module) {
        this.module = module;
    }

    /**
     * Given an action, execute it.
     * Often this is performing an insertion, change or deletion of a construct in the editor.
     * 
     * @param action - The action to execute
     * @param providedContext - The current context
     * @param e - The keyboard event
     * @returns Whether the action was executed successfully
     */
    execute(action: EditAction, providedContext?: Context, e?: KeyboardEvent): boolean {
        // Determine the key that was pressed
        const pressedKey = e?.key;
        // Determine the current context
        let context = providedContext ? providedContext : this.module.focus.getContext();

        // General settings
        let preventDefaultEvent = true;
        let flashGreen = false;

        // If the action contains autocomplete data, flash green
        if (action?.data?.autocompleteData) flashGreen = true;

        // let { eventType, eventData } = this.getLogEventSource(action?.data?.source);

        // Handle each of the different action types
        switch (action.type) {
            case EditActionType.InsertGeneralStmt:
                /**
                 * Purpose is to try to
                 * 1) Include all statements under this type
                 * 2) Try to include also all expressions under this type (though this might be
                 * under a different case initially)
                 * 3) If all constructs are contained under this case, try to remove it as there is no longer a
                 * necessity for different cases
                 *
                 * It can be created in multiple ways, but it is only used he in this switch statement
                 */
                // Can maybe be made nicer, as in without requiring a action.data?.statement?
                // This seems currently to be the only thing needed
                const statement = action.data?.statement as Statement;
                // Will always be needed?
                this.replaceEmptyStatement(context.lineStatement, statement);

                // Green background on insertion
                if (flashGreen) this.flashGreen(action.data?.statement);

                // Light blue background
                if (statement.hasBody()) {
                    let scopeHighlight = new ScopeHighlight(this.module.editor, statement);
                }

                // Used for logging => Keeping track of which statements are used
                // eventData.code = action.data?.statement?.getRenderText();

                break;

            // TODO: Merge with InsertGeneralStmt
            case EditActionType.InsertGeneralExpr:
                this.insertExpression(context, action.data?.expression);

                if (flashGreen) this.flashGreen(action.data?.expression);

                break;

            case EditActionType.OpenAutocomplete: {
                console.log("OpenAutocomplete");
                const autocompleteTkn = new AutocompleteTkn(
                    action.data.firstChar,
                    action.data.autocompleteType,
                    action.data.validMatches
                );

                autocompleteTkn.subscribe(
                    CallbackType.change,
                    new Callback(
                        (() => {
                            if (!this.module.menuController.isMenuOpen()) {
                                this.openAutocompleteMenu(action.data.validMatches);
                            }

                            this.updateAutocompleteMenu(autocompleteTkn);

                            if (
                                this.module.menuController.hasNoSuggestions() &&
                                autocompleteTkn.left != autocompleteTkn.getParentStatement().left &&
                                !autocompleteTkn.message
                            ) {
                                const message = this.module.messageController.addHoverMessage(
                                    autocompleteTkn,
                                    {},
                                    `Did you want to create a text message? use double quotes before and after the text, like this: <span class="code">"</span>your desired text<span class="code">"</span>`
                                );

                                const button = message.createButton("convert to text");
                                button.addEventListener("click", () => {
                                    this.module.executer.execute(
                                        new EditAction(EditActionType.ConvertAutocompleteToString, {
                                            token: autocompleteTkn,
                                            source: { type: "draft-mode" },
                                        }),
                                        this.module.focus.getContext()
                                    );
                                });
                            }
                        }).bind(this)
                    )
                );

                this.openAutocompleteMenu(action.data.validMatches);

                switch (action.data.autocompleteType) {
                    case AutoCompleteType.StartOfLine:
                        this.replaceEmptyStatement(context.lineStatement, new TemporaryStmt(autocompleteTkn));

                        break;

                    case AutoCompleteType.AtEmptyOperatorHole:
                    case AutoCompleteType.AtExpressionHole:
                        this.insertToken(context, autocompleteTkn);

                        break;

                    case AutoCompleteType.RightOfExpression:
                        this.insertToken(context, autocompleteTkn, { toRight: true });

                        break;
                    case AutoCompleteType.LeftOfExpression:
                        this.insertToken(context, autocompleteTkn, { toLeft: true });

                        break;
                }

                this.module.editor.cursor.setSelection(null);
                const match = autocompleteTkn.isTerminatingMatch();

                if (match) {
                    this.performMatchAction(match, autocompleteTkn);
                } else {
                    let highlight = new ConstructHighlight(this.module.editor, autocompleteTkn, [230, 235, 255, 0.7]);

                    autocompleteTkn.subscribe(
                        CallbackType.delete,
                        new Callback(() => {
                            if (highlight) {
                                highlight.removeFromDOM();
                                highlight = null;
                            }
                        })
                    );
                }

                break;
            }

            // case EditActionType.InsertElseStatement: {
            //     const newStatement = new ElseStatement(action.data.hasCondition);

            //     if (action.data.outside) {
            //         // when the else is being inserted outside: The else is at the same level as the if
            //         const elseRoot = context.lineStatement.rootNode as Module | Statement;
            //         // Fit the new else(/elif) statement in the root of the current statement
            //         newStatement.rootNode = elseRoot;
            //         newStatement.indexInRoot = context.lineStatement.indexInRoot;
            //         newStatement.body.push(new EmptyLineStmt(newStatement, 0)); // Add a body to the else/elif

            //         replaceInBody(elseRoot, newStatement.indexInRoot, newStatement);
            //         rebuildBody(elseRoot, newStatement.indexInRoot, context.lineStatement.lineNumber);
            //         this.module.editor.executeEdits(this.getBoundaries(context.lineStatement), newStatement);
            //     } else {
            //         // when being inserted inside: The else is in the body of the if
            //         const curStmtRoot = context.lineStatement.rootNode as Statement; // Probably an if statement
            //         const elseRoot = curStmtRoot.rootNode as Module | Statement; // Probably root of if statement
            //         newStatement.rootNode = elseRoot; // Make the else a child of the if's root (so a sibling of the if)
            //         newStatement.indexInRoot = curStmtRoot.indexInRoot + 1; // You need to insert after the if
            //         // In the "outside" case, you take the "indexInRoot" of the current context, while here you take
            //         // the indexInRoot of the if statement (the parent of the context) and thus need to add one to it

            //         // indent back and place all of the code below it as its child
            //         const toMoveStatements = curStmtRoot.body.splice(
            //             // curStmtRoot is the if statement
            //             context.lineStatement.indexInRoot,
            //             curStmtRoot.body.length - context.lineStatement.indexInRoot
            //         ); // Place all items from the current (else) line to the end in the body of the else statement

            //         // remove the empty line statement: the current line contains an empty line statement because it was
            //         // initially a space to insert a new statement
            //         toMoveStatements.splice(0, 1)[0];

            //         if (toMoveStatements.length == 0) newStatement.body.push(new EmptyLineStmt(newStatement, 0));
            //         const providedLeftPos = new Position(
            //             context.lineStatement.lineNumber,
            //             context.lineStatement.left - TAB_SPACES
            //         );
            //         newStatement.build(providedLeftPos);

            //         this.module.editor.executeEdits(
            //             this.getBoundaries(context.lineStatement, { selectIndent: true }),
            //             newStatement
            //         );

            //         // Split the current references in the references for the if statement and
            //         // the references for the else statement
            //         const topReferences = new Array<Reference>();
            //         const bottomReferences = new Array<Reference>();

            //         for (const ref of curStmtRoot.scope.references) {
            //             if (ref.getAssignment().getParentStatement().indexInRoot > context.lineStatement.indexInRoot) {
            //                 bottomReferences.push(ref);
            //             } else topReferences.push(ref);
            //         }

            //         if (bottomReferences.length > 0) {
            //             curStmtRoot.scope.references = topReferences;
            //             newStatement.scope.references = bottomReferences;
            //         }

            //         // Add each of the moved statements to the body of the else statement
            //         for (const [i, stmt] of toMoveStatements.entries()) {
            //             stmt.rootNode = newStatement;
            //             stmt.indexInRoot = i;
            //             newStatement.body.push(stmt);
            //         }

            //         // Add the else statement itself to the body of its rootNode
            //         newStatement.init(providedLeftPos);
            //         newStatement.rootNode = elseRoot;
            //         newStatement.indexInRoot = newStatement.indexInRoot; // Heu ... Why?
            //         this.module.addStatementToBody(
            //             elseRoot,
            //             newStatement,
            //             newStatement.indexInRoot,
            //             providedLeftPos.lineNumber
            //         );
            //     }

            //     if (flashGreen) this.flashGreen(newStatement);

            //     let scopeHighlight = new ScopeHighlight(this.module.editor, newStatement);
            //     // eventData.code = "else-statement";

            //     break;
            // }

            case EditActionType.InsertExpression: {
                this.insertExpression(context, action.data?.expression);

                if (flashGreen) this.flashGreen(action.data?.expression);

                // eventData.code = action.data?.expression?.getRenderText();

                break;
            }

            case EditActionType.InsertStatement: {
                const statement = action.data?.statement as Statement;

                this.replaceEmptyStatement(context.lineStatement, statement);

                if (flashGreen) this.flashGreen(action.data?.statement);

                if (statement.hasBody()) {
                    let scopeHighlight = new ScopeHighlight(this.module.editor, statement);
                }

                // eventData.code = action.data?.statement?.getRenderText();

                break;
            }

            // case EditActionType.InsertVarAssignStatement: {
            //     //TODO: Might want to change back to use the case above if no new logic is added
            //     const stmt = action.data?.statement;

            //     const id = action.data?.autocompleteData?.identifier?.trim();

            //     if (stmt instanceof GeneralStatement && stmt.containsAssignments() && id) stmt.setAssignmentIdentifier(id, 0);

            //     this.replaceEmptyStatement(context.lineStatement, action.data?.statement as Statement);

            //     if (flashGreen) this.flashGreen(action.data?.statement);

            //     // eventData.code = "var-assignment";
            //     // eventData.id = id;

            //     break;
            // }

            case EditActionType.InsertUnaryOperator: {
                if (action.data?.replace) {
                    this.insertExpression(
                        context,
                        new UnaryOperatorExpr(action.data.operator, (context.token as TypedEmptyExpr).type[0])
                    );
                } else if (action.data?.wrap) {
                    const expr = context.expressionToRight as Expression;

                    const initialBoundary = this.getBoundaries(expr);
                    const root = expr.rootNode as Statement;

                    const newCode = new UnaryOperatorExpr(
                        action.data.operator,
                        expr.returns,
                        expr.returns,
                        expr.rootNode,
                        expr.indexInRoot
                    );

                    newCode.setOperand(expr);
                    root.tokens[newCode.indexInRoot] = newCode;
                    root.rebuild(root.getLeftPosition(), 0);

                    this.module.editor.executeEdits(initialBoundary, newCode);
                    this.module.focus.updateContext({
                        positionToMove: newCode.tokens[1].getLeftPosition(),
                    });
                }

                // eventData.code = action.data.operator;

                break;
            }

            case EditActionType.DeleteNextToken: {
                if (context.expressionToRight instanceof OperatorTkn) {
                    this.replaceCode(
                        context.expressionToRight,
                        new EmptyOperatorTkn(" ", context.expressionToRight, context.expressionToRight.indexInRoot)
                    );
                } else if (this.module.validator.atBeginningOfValOperation(context)) {
                    this.deleteCode(context.expressionToRight.rootNode);
                } else if (context.expressionToRight instanceof Modifier) {
                    this.deleteModifier(context.expressionToRight, { deleting: true });
                } else this.deleteCode(context.expressionToRight);

                break;
            }

            case EditActionType.DeletePrevToken: {
                if (context.expressionToLeft instanceof OperatorTkn) {
                    this.replaceCode(
                        context.expressionToLeft,
                        new EmptyOperatorTkn(" ", context.expressionToLeft, context.expressionToLeft.indexInRoot)
                    );
                } else if (
                    context.expressionToLeft instanceof VariableReferenceExpr &&
                    context.expressionToLeft.rootNode instanceof VarOperationStmt
                ) {
                    this.deleteCode(context.expressionToLeft.rootNode, { statement: true });
                } else if (context.expressionToLeft instanceof Modifier) this.deleteModifier(context.expressionToLeft);
                else this.deleteCode(context.expressionToLeft);

                break;
            }

            case EditActionType.DeleteStatement: {
                this.deleteCode(context.lineStatement, { statement: true });

                break;
            }

            case EditActionType.DeleteMultiLineStatement: {
                // Maybe delete everything inside this if, as this is just to show a message?
                if (
                    context.lineStatement instanceof IfStatement ||
                    (context.lineStatement instanceof ElseStatement && context.lineStatement.hasCondition)
                ) {
                    const elseStatementsAfterIf = [];

                    for (
                        let i = context.lineStatement.indexInRoot + 1;
                        i < context.lineStatement.rootNode.body.length;
                        i++
                    ) {
                        const line = context.lineStatement.rootNode.body[i];

                        if (line instanceof ElseStatement) elseStatementsAfterIf.push(line);
                        else break;
                    }

                    for (const elseStmt of elseStatementsAfterIf) {
                        this.module.messageController.addHoverMessage(
                            elseStmt,
                            null,
                            "add if before the first else, or delete this."
                        );
                    }
                }

                while (context.lineStatement.body.length > 0) {
                    this.module.editor.indentRecursively(
                        context.lineStatement.body[context.lineStatement.body.length - 1],
                        { backward: true }
                    );
                    this.module.indentBackStatement(context.lineStatement.body[context.lineStatement.body.length - 1]);
                }

                this.deleteCode(context.lineStatement, { statement: true });

                break;
            }

            case EditActionType.DeleteCurLine: {
                this.module.deleteLine(context.lineStatement);
                let range: Range;

                if (action.data?.pressedBackspace) {
                    const lineAbove = this.module.focus.getStatementAtLineNumber(context.lineStatement.lineNumber - 1);
                    this.module.focus.updateContext({
                        positionToMove: new Position(lineAbove.lineNumber, lineAbove.right),
                    });
                    range = new Range(
                        context.lineStatement.lineNumber,
                        context.lineStatement.left,
                        lineAbove.lineNumber,
                        lineAbove.right
                    );
                } else {
                    range = new Range(
                        context.lineStatement.lineNumber,
                        context.lineStatement.left,
                        context.lineStatement.lineNumber + 1,
                        context.lineStatement.left
                    );
                }

                this.module.editor.executeEdits(range, null, "");

                break;
            }

            case EditActionType.DeleteSelectedModifier: {
                this.deleteModifier(context.token.rootNode as Modifier, { deleting: true });

                break;
            }

            case EditActionType.DeletePrevLine: {
                const prevLine = this.module.focus.getStatementAtLineNumber(context.lineStatement.lineNumber - 1);

                if (prevLine.left != context.lineStatement.left) {
                    this.module.editor.indentRecursively(context.lineStatement, { backward: false });
                    this.module.indentForwardStatement(context.lineStatement);
                }

                const deleteRange = new Range(
                    prevLine.lineNumber,
                    prevLine.left,
                    prevLine.lineNumber + 1,
                    prevLine.left
                );
                this.module.deleteLine(prevLine);
                this.module.editor.executeEdits(deleteRange, null, "");

                break;
            }

            case EditActionType.IndentBackwardsIfStmt: {
                const root = context.lineStatement.rootNode as Statement | Module;

                const toIndentStatements = new Array<Statement>();

                for (let i = context.lineStatement.indexInRoot; i < root.body.length; i++) {
                    toIndentStatements.push(root.body[i]);
                }

                for (const stmt of toIndentStatements.reverse()) {
                    this.module.editor.indentRecursively(stmt, { backward: true });
                    this.module.indentBackStatement(stmt);
                }

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            case EditActionType.DeleteBackMultiLines: {
                for (
                    let i = context.lineStatement.rootNode.body.length - 1;
                    i >= context.lineStatement.indexInRoot;
                    i--
                ) {
                    this.module.editor.indentRecursively(context.lineStatement.rootNode.body[i], { backward: true });
                    this.module.indentBackStatement(context.lineStatement.rootNode.body[i]);
                }

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            case EditActionType.IndentBackwards: {
                this.module.editor.indentRecursively(context.lineStatement, { backward: true });
                this.module.indentBackStatement(context.lineStatement);

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            // case EditActionType.IndentForwardsIfStmt: {
            //     const root = context.lineStatement.rootNode as Statement | Module;

            //     const toIndentStatements = new Array<Statement>();

            //     for (let i = context.lineStatement.indexInRoot; i < root.body.length; i++) {
            //         toIndentStatements.push(root.body[i]);

            //         if (i + 1 < root.body.length && !(root.body[i + 1] instanceof ElseStatement)) break;
            //     }

            //     for (const stmt of toIndentStatements) {
            //         this.module.editor.indentRecursively(stmt, { backward: false });
            //         this.module.indentForwardStatement(stmt);
            //     }

            //     this.module.focus.fireOnNavChangeCallbacks();

            //     break;
            // }

            case EditActionType.IndentForwards: {
                this.module.editor.indentRecursively(context.lineStatement, { backward: false });
                this.module.indentForwardStatement(context.lineStatement);

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            case EditActionType.InsertEmptyLine: {
                const newEmptyLine = this.module.insertEmptyLine();
                this.module.focus.fireOnNavOffCallbacks(context.lineStatement, newEmptyLine);

                break;
            }

            case EditActionType.SelectPrevToken: {
                this.module.focus.navigateLeft();

                break;
            }

            case EditActionType.SelectNextToken: {
                this.module.focus.navigateRight();

                break;
            }

            // case EditActionType.InsertFormattedStringItem: {
            //     const cursorPos = this.module.editor.monaco.getPosition();
            //     const selectedText = this.module.editor.monaco.getSelection();
            //     const editableToken = this.module.focus.getTextEditableItem(context);
            //     const token = editableToken.getToken();
            //     const formattedStringExpr = token.rootNode as FormattedStringExpr;

            //     const leftText = token.text.substring(0, cursorPos.column - token.left);
            //     const rightText = token.text.substring(cursorPos.column - token.left, token.right);

            //     const leftToken = token;
            //     leftToken.text = leftText;
            //     const rightToken = new EditableTextTkn("", StringRegex, formattedStringExpr, token.indexInRoot + 1);
            //     rightToken.text = rightText;

            //     formattedStringExpr.tokens.splice(token.indexInRoot + 1, 0, ...[rightToken]);

            //     formattedStringExpr.rebuild(formattedStringExpr.getLeftPosition(), 0);

            //     let rightTokenRange = new Range(
            //         rightToken.getLineNumber(),
            //         rightToken.left,
            //         rightToken.getLineNumber(),
            //         rightToken.right
            //     );

            //     this.module.editor.executeEdits(rightTokenRange, rightToken);

            //     const fStringToken = new FormattedStringCurlyBracketsExpr(formattedStringExpr, token.indexInRoot + 1);

            //     formattedStringExpr.tokens.splice(token.indexInRoot + 1, 0, ...[fStringToken]);

            //     formattedStringExpr.rebuild(formattedStringExpr.getLeftPosition(), 0);

            //     let editRange: Range;

            //     if (selectedText.startColumn != selectedText.endColumn) {
            //         editRange = new Range(
            //             cursorPos.lineNumber,
            //             selectedText.startColumn,
            //             cursorPos.lineNumber,
            //             selectedText.endColumn
            //         );
            //     } else {
            //         editRange = new Range(
            //             cursorPos.lineNumber,
            //             cursorPos.column,
            //             cursorPos.lineNumber,
            //             cursorPos.column
            //         );
            //     }

            //     this.module.editor.executeEdits(editRange, fStringToken);
            //     this.module.focus.updateContext({ tokenToSelect: fStringToken.tokens[1] });
            //     // eventData.code = "f-string-item";

            //     break;
            // }

            // case EditActionType.DeleteFStringCurlyBrackets: {
            //     const fStringToRemove = action.data.item as FormattedStringCurlyBracketsExpr;

            //     const root = fStringToRemove.rootNode;

            //     const tokenBefore = root.tokens[fStringToRemove.indexInRoot - 1] as EditableTextTkn;
            //     const tokenAfter = root.tokens[fStringToRemove.indexInRoot + 1] as EditableTextTkn;

            //     const indexToReplace = tokenBefore.indexInRoot;

            //     const newToken = new EditableTextTkn(
            //         tokenBefore.text + tokenAfter.text,
            //         StringRegex,
            //         root,
            //         fStringToRemove.indexInRoot - 1
            //     );

            //     const focusPos = new Position(tokenBefore.getLineNumber(), tokenBefore.right);

            //     const replaceRange = new Range(
            //         tokenAfter.getLineNumber(),
            //         tokenAfter.right,
            //         tokenBefore.getLineNumber(),
            //         tokenBefore.left
            //     );

            //     this.module.removeItem(fStringToRemove);
            //     this.module.removeItem(tokenAfter);
            //     this.module.removeItem(tokenBefore);

            //     root.tokens.splice(indexToReplace, 0, newToken);

            //     root.rebuild(root.getLeftPosition(), 0);

            //     this.module.editor.executeEdits(replaceRange, newToken);
            //     this.module.focus.updateContext({ positionToMove: focusPos });

            //     break;
            // }

            case EditActionType.InsertChar: {
                const cursorPos = this.module.editor.monaco.getPosition();
                const selectedText = this.module.editor.monaco.getSelection();
                const editableToken = this.module.focus.getTextEditableItem(context);
                const editableText = editableToken.getEditableText();
                const token = editableToken.getToken();
                let newText = "";

                if ((pressedKey == "{" || pressedKey == "}") && token.rootNode instanceof FormattedStringExpr) {
                    this.execute(
                        new EditAction(EditActionType.InsertFormattedStringItem, { source: { type: "autocomplete" } })
                    );

                    break;
                }

                if (token instanceof IdentifierTkn && token.isEmptyIdentifier()) {
                    const curText = "";
                    newText = curText + pressedKey;
                } else {
                    const curText = editableText.split("");
                    curText.splice(
                        cursorPos.column - token.left,
                        Math.abs(selectedText.startColumn - selectedText.endColumn),
                        pressedKey
                    );

                    newText = curText.join("");
                }

                this.validateIdentifier(context, newText);

                let editRange: Range;

                if (selectedText.startColumn != selectedText.endColumn) {
                    editRange = new Range(
                        cursorPos.lineNumber,
                        selectedText.startColumn,
                        cursorPos.lineNumber,
                        selectedText.endColumn
                    );
                } else if (
                    context.tokenToRight?.isTextEditable &&
                    context.tokenToRight instanceof IdentifierTkn &&
                    context.tokenToRight.isEmpty
                ) {
                    editRange = new Range(
                        cursorPos.lineNumber,
                        context.tokenToRight.left,
                        cursorPos.lineNumber,
                        context.tokenToRight.right
                    );
                } else {
                    editRange = new Range(
                        cursorPos.lineNumber,
                        cursorPos.column,
                        cursorPos.lineNumber,
                        cursorPos.column
                    );
                }

                if (editableToken instanceof AutocompleteTkn) {
                    let match = editableToken.checkMatch(pressedKey);

                    if (match) {
                        this.performMatchAction(match, editableToken);

                        break;
                    }

                    match = editableToken.isInsertableTerminatingMatch(pressedKey);

                    if (match) {
                        this.performMatchAction(match, editableToken);

                        this.execute(this.module.eventRouter.getKeyAction(e));

                        break;
                    }
                }

                if (editableToken.setEditedText(newText)) this.module.editor.executeEdits(editRange, null, pressedKey);

                break;
            }

            case EditActionType.DeleteStringLiteral: {
                this.deleteCode(context.tokenToLeft.rootNode);

                break;
            }

            case EditActionType.DeletePrevChar:
            case EditActionType.DeleteNextChar: {
                console.log("We get here... so that is something")
                const cursorPos = this.module.editor.monaco.getPosition();
                const selectedText = this.module.editor.monaco.getSelection();
                const editableToken = this.module.focus.getTextEditableItem(context);
                const token = editableToken.getToken();

                let newText = "";

                const curText = editableToken.getEditableText().split("");
                const toDeleteItems =
                    selectedText.startColumn == selectedText.endColumn
                        ? 1
                        : Math.abs(selectedText.startColumn - selectedText.endColumn);

                const toDeletePos = action.type == EditActionType.DeleteNextChar ? 0 : 1;

                curText.splice(
                    Math.min(
                        cursorPos.column - token.left - toDeletePos,
                        selectedText.startColumn - token.left - toDeletePos
                    ),
                    toDeleteItems
                );

                newText = curText.join("");

                this.validateIdentifier(context, newText);

                // check if it needs to turn back into a hole:
                if (newText.length == 0) {
                    let removableExpr: CodeConstruct = null;

                    if (context.expression instanceof LiteralValExpr) {
                        removableExpr = context.expression;
                    } else if (context.token instanceof AutocompleteTkn) {
                        removableExpr = context.token;
                    } else if (context.expressionToLeft instanceof LiteralValExpr) {
                        removableExpr = context.expressionToLeft;
                    } else if (context.tokenToLeft instanceof AutocompleteTkn) {
                        removableExpr = context.tokenToLeft;
                    } else if (context.expressionToRight instanceof LiteralValExpr) {
                        removableExpr = context.expressionToRight;
                    } else if (context.tokenToRight instanceof AutocompleteTkn) {
                        removableExpr = context.tokenToRight;
                    }

                    if (removableExpr != null) {
                        if (
                            removableExpr instanceof AutocompleteTkn &&
                            removableExpr.rootNode instanceof TemporaryStmt
                        ) {
                            this.deleteCode(removableExpr.rootNode, { statement: true });
                        } else if (
                            removableExpr instanceof AutocompleteTkn &&
                            removableExpr.autocompleteType == AutoCompleteType.AtEmptyOperatorHole
                        ) {
                            this.replaceCode(
                                removableExpr,
                                new EmptyOperatorTkn(" ", removableExpr.rootNode, removableExpr.indexInRoot)
                            );
                        } else if (
                            removableExpr instanceof AutocompleteTkn &&
                            (removableExpr.autocompleteType == AutoCompleteType.RightOfExpression ||
                                removableExpr.autocompleteType == AutoCompleteType.LeftOfExpression)
                        ) {
                            this.deleteAutocompleteToken(removableExpr);
                        } else this.deleteCode(removableExpr);

                        break;
                    }

                    let identifier: IdentifierTkn = null;
                    if (context.tokenToLeft instanceof IdentifierTkn) {
                        identifier = context.tokenToLeft;
                    } else if (context.tokenToRight instanceof IdentifierTkn) {
                        identifier = context.tokenToRight;
                    } else if (context.token instanceof IdentifierTkn) {
                        identifier = context.token;
                    }

                    if (identifier != null) {
                        // reset identifier:
                        identifier.text = "  ";
                        identifier.isEmpty = true;

                        // change editor
                        this.module.editor.executeEdits(
                            new Range(cursorPos.lineNumber, identifier.left, cursorPos.lineNumber, identifier.right),
                            null,
                            "  "
                        );

                        // rebuild ast
                        context.lineStatement.build(context.lineStatement.getLeftPosition());
                        this.module.focus.updateContext({ tokenToSelect: identifier });

                        break;
                    }
                }

                if (editableToken.setEditedText(newText)) {
                    let editRange = new Range(
                        cursorPos.lineNumber,
                        cursorPos.column,
                        cursorPos.lineNumber,
                        cursorPos.column
                    );

                    if (selectedText.startColumn != selectedText.endColumn) {
                        editRange = new Range(
                            cursorPos.lineNumber,
                            selectedText.startColumn,
                            cursorPos.lineNumber,
                            selectedText.endColumn - 1
                        );
                    }

                    this.module.editor.executeEdits(editRange, null, "");
                    preventDefaultEvent = false;
                }

                break;
            }

            case EditActionType.InsertAssignmentModifier: {
                if (context.expressionToLeft.rootNode instanceof VarOperationStmt) {
                    const varOpStmt = context.expressionToLeft.rootNode;

                    if (
                        action.data.modifier instanceof AssignmentModifier &&
                        context.expressionToLeft instanceof VariableReferenceExpr
                    ) {
                        if (context.expressionToLeft.rootNode.draftModeEnabled) {
                            this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
                        }
                        const initialBoundary = this.getBoundaries(context.expressionToLeft);

                        // const varAssignStmt = new VarAssignmentStmt(
                        //     "",
                        //     context.expressionToLeft.identifier,
                        //     varOpStmt.rootNode,
                        //     varOpStmt.indexInRoot
                        // );
                        const varAssignStmt = structuredClone(GeneralStatement.constructs.get("varAss"));
                        varAssignStmt.setAssignmentIdentifier(context.expressionToLeft.identifier, 0);
                        varAssignStmt.rootNode = varOpStmt.rootNode;
                        varAssignStmt.indexInRoot = varOpStmt.indexInRoot;

                        replaceInBody(varOpStmt.rootNode, varOpStmt.indexInRoot, varAssignStmt);

                        this.module.editor.executeEdits(initialBoundary, varAssignStmt);
                        this.module.focus.updateContext(varAssignStmt.getInitialFocus());

                        if (flashGreen) this.flashGreen(varAssignStmt);
                    } else {
                        if (
                            context.expressionToLeft instanceof VariableReferenceExpr &&
                            context.expressionToLeft.rootNode.draftModeEnabled
                        ) {
                            this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
                        }

                        varOpStmt.appendModifier(action.data.modifier);
                        varOpStmt.rebuild(varOpStmt.getLeftPosition(), 0);

                        this.module.editor.insertAtCurPos([action.data.modifier]);
                        this.module.focus.updateContext(action.data.modifier.getInitialFocus());

                        if (flashGreen) this.flashGreen(action.data.modifier);
                    }
                }

                // eventData.code = action.data.modifier.getRenderText();

                break;
            }

            case EditActionType.InsertModifier: {
                const modifier = action.data.modifier as Modifier;

                if (context.expressionToLeft instanceof Modifier) {
                    if (context.expressionToLeft.rootNode instanceof ValueOperationExpr) {
                        const valOprExpr = context.expressionToLeft.rootNode;
                        const valOprExprRoot = valOprExpr.rootNode as Statement;

                        let replacementResult = valOprExpr.rootNode.checkInsertionAtHole(
                            valOprExpr.indexInRoot,
                            modifier.returns
                        );

                        const holeTypes = valOprExpr.rootNode.typeOfHoles[valOprExpr.indexInRoot];

                        if (replacementResult.insertionType !== InsertionType.Invalid) {
                            valOprExpr.appendModifier(modifier);
                            valOprExprRoot.rebuild(valOprExprRoot.getLeftPosition(), 0);

                            this.module.editor.insertAtCurPos([modifier]);
                            this.module.focus.updateContext(modifier.getInitialFocus());

                            if (replacementResult.insertionType == InsertionType.DraftMode)
                                this.module.openDraftMode(
                                    valOprExpr,
                                    TYPE_MISMATCH_ON_FUNC_ARG_DRAFT_MODE_STR(
                                        valOprExpr.getKeyword(),
                                        holeTypes,
                                        valOprExpr.returns
                                    ),
                                    [
                                        ...replacementResult.conversionRecords.map((conversionRecord) => {
                                            return conversionRecord.getConversionButton(
                                                valOprExpr.getKeyword(),
                                                this.module,
                                                valOprExpr
                                            );
                                        }),
                                    ]
                                );
                        }

                        if (valOprExpr.rootNode instanceof Statement) valOprExpr.rootNode.onInsertInto(valOprExpr);
                    }
                } else if (
                    context.expressionToLeft instanceof VariableReferenceExpr &&
                    context.expressionToLeft.rootNode instanceof VarOperationStmt
                ) {
                    if (context.expressionToLeft.rootNode.draftModeEnabled) {
                        this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
                    }
                    const varOpStmt = context.expressionToLeft.rootNode;

                    varOpStmt.appendModifier(modifier);
                    varOpStmt.rebuild(varOpStmt.getLeftPosition(), 0);

                    this.module.editor.insertAtCurPos([modifier]);
                    this.module.focus.updateContext(modifier.getInitialFocus());

                    if (modifier instanceof MethodCallModifier && modifier.returns !== DataType.Void) {
                        //TODO: PropertyAccessModifier should also be included here once we have them
                        this.module.openDraftMode(
                            varOpStmt,
                            "This statement has no effect since the value it returns is not stored anywhere.",
                            []
                        ); //TODO: Offer fixes?
                    }
                } else {
                    const exprToLeftRoot = context.expressionToLeft.rootNode as Statement;
                    const exprToLeftIndexInRoot = context.expressionToLeft.indexInRoot;

                    if (modifier instanceof ListAccessModifier) {
                        modifier.returns = TypeChecker.getElementTypeFromListType(context.expressionToLeft.returns);

                        if (!modifier.returns) modifier.returns = DataType.Any;
                    }

                    const replacementResult = exprToLeftRoot.checkInsertionAtHole(
                        context.expressionToLeft.indexInRoot,
                        modifier.returns
                    );
                    const holeDataTypes = exprToLeftRoot.typeOfHoles[context.expressionToLeft.indexInRoot];

                    const valOprExpr = new ValueOperationExpr(
                        context.expressionToLeft,
                        [modifier],
                        context.expressionToLeft.rootNode,
                        context.expressionToLeft.indexInRoot
                    );

                    if (valOprExpr.rootNode instanceof Statement) valOprExpr.rootNode.onInsertInto(valOprExpr);

                    context.expressionToLeft.indexInRoot = 0;
                    context.expressionToLeft.rootNode = valOprExpr;

                    if (replacementResult.insertionType !== InsertionType.Invalid) {
                        this.module.closeConstructDraftRecord(context.expressionToLeft);

                        exprToLeftRoot.tokens[exprToLeftIndexInRoot] = valOprExpr;
                        exprToLeftRoot.rebuild(exprToLeftRoot.getLeftPosition(), 0);

                        this.module.editor.insertAtCurPos([modifier]);
                        this.module.focus.updateContext(modifier.getInitialFocus());

                        if (replacementResult.insertionType == InsertionType.DraftMode) {
                            if (valOprExpr.returns === DataType.Any) {
                                this.module.openDraftMode(
                                    valOprExpr,
                                    TYPE_MISMATCH_ANY(holeDataTypes, valOprExpr.returns),
                                    [
                                        new IgnoreConversionRecord(
                                            "",
                                            null,
                                            null,
                                            "",
                                            null,
                                            Tooltip.IgnoreWarning
                                        ).getConversionButton("", this.module, valOprExpr),
                                    ]
                                );
                            } else {
                                this.module.openDraftMode(
                                    valOprExpr,
                                    TYPE_MISMATCH_ON_FUNC_ARG_DRAFT_MODE_STR(
                                        valOprExpr.getKeyword(),
                                        holeDataTypes,
                                        valOprExpr.returns
                                    ),
                                    [
                                        ...replacementResult.conversionRecords.map((conversionRecord) => {
                                            return conversionRecord.getConversionButton(
                                                valOprExpr.getKeyword(),
                                                this.module,
                                                valOprExpr
                                            );
                                        }),
                                    ]
                                );
                            }
                        }
                    }
                }

                if (flashGreen) this.flashGreen(action.data.modifier);
                // eventData.code = action.data.modifier.getRenderText();

                break;
            }

            case EditActionType.InsertBinaryOperator: {
                let binExpr: BinaryOperatorExpr;

                if (action.data.toRight) {
                    binExpr = this.replaceWithBinaryOp(action.data.operator, context.expressionToLeft, {
                        toLeft: true,
                    });
                } else if (action.data.toLeft) {
                    binExpr = this.replaceWithBinaryOp(action.data.operator, context.expressionToRight, {
                        toRight: true,
                    });
                } else if (action.data.replace) {
                    binExpr = new BinaryOperatorExpr(action.data.operator, (context.token as TypedEmptyExpr).type[0]);
                    this.insertExpression(context, binExpr);
                }

                if (flashGreen) this.flashGreen(binExpr);
                // eventData.code = action.data.operator;

                break;
            }

            case EditActionType.WrapExpressionWithItem: {
                // both lists and str work on any, so the first step of validation is always OK.

                const initialBoundary = this.getBoundaries(context.expressionToRight);
                const expr = context.expressionToRight as Expression;
                const indexInRoot = expr.indexInRoot;
                const root = expr.rootNode as Statement;

                const newCode = action.data.expression as Expression;
                newCode.indexInRoot = expr.indexInRoot;
                newCode.rootNode = expr.rootNode;

                const isValidRootInsertion =
                    newCode.returns == DataType.Any ||
                    root.typeOfHoles[indexInRoot].indexOf(newCode.returns) >= 0 ||
                    root.typeOfHoles[indexInRoot] == DataType.Any;

                let replaceIndex: number = 0;

                for (const [i, token] of newCode.tokens.entries()) {
                    if (token instanceof TypedEmptyExpr) {
                        replaceIndex = i;

                        break;
                    }
                }

                if (isValidRootInsertion) {
                    this.module.closeConstructDraftRecord(root.tokens[indexInRoot]);
                }

                newCode.tokens[replaceIndex] = context.expressionToRight;
                context.expressionToRight.indexInRoot = replaceIndex;
                context.expressionToRight.rootNode = newCode;
                root.tokens[indexInRoot] = newCode;
                root.rebuild(root.getLeftPosition(), 0);
                this.module.editor.executeEdits(initialBoundary, newCode);
                this.module.focus.updateContext({
                    positionToMove: new Position(newCode.lineNumber, newCode.right),
                });

                if (newCode.rootNode instanceof BinaryOperatorExpr) {
                    newCode.rootNode.onInsertInto(newCode);
                    newCode.rootNode.validateTypes(this.module);
                } else if (newCode.rootNode instanceof Statement) {
                    newCode.rootNode.onInsertInto(newCode);
                }

                if (!isValidRootInsertion) {
                    this.module.closeConstructDraftRecord(expr);
                    this.module.openDraftMode(newCode, "DEBUG THIS", []);
                }

                if (flashGreen) this.flashGreen(newCode);
                // eventData.code = action.data.expression.getRenderText();
                // eventData.wrap = true;

                break;
            }

            case EditActionType.ConvertAutocompleteToString: {
                const autocompleteToken = action.data.token as AutocompleteTkn;
                const literalValExpr = new LiteralValExpr(
                    DataType.String,
                    autocompleteToken.text,
                    autocompleteToken.rootNode as Expression | Statement,
                    autocompleteToken.indexInRoot
                );

                autocompleteToken.draftModeEnabled = false;
                this.deleteCode(autocompleteToken);
                this.insertExpression(this.module.focus.getContext(), literalValExpr);

                // eventData.code = "double-quote";
                // eventData.wrap = true;

                break;
            }

            case EditActionType.InsertEmptyList: {
                const newLiteral = new ListLiteralExpression();
                this.insertExpression(context, newLiteral);

                if (flashGreen) this.flashGreen(newLiteral);
                // eventData.code = "empty-list";

                break;
            }

            // case EditActionType.InsertEmptyListItem: {
            //     if (action.data.toRight) {
            //         const code = [new NonEditableTkn(", "), new TypedEmptyExpr([DataType.Any])];
            //         this.insertEmptyListItem(context.tokenToRight, context.tokenToRight.indexInRoot, code);
            //         this.module.editor.insertAtCurPos(code);
            //         this.module.focus.updateContext({ tokenToSelect: code[1] });

            //         if (flashGreen) this.flashGreen(code[1]);
            //     } else if (action.data.toLeft) {
            //         const code = [new TypedEmptyExpr([DataType.Any]), new NonEditableTkn(", ")];
            //         this.insertEmptyListItem(context.tokenToLeft, context.tokenToLeft.indexInRoot + 1, code);
            //         this.module.editor.insertAtCurPos(code);
            //         this.module.focus.updateContext({ tokenToSelect: code[0] });

            //         if (flashGreen) this.flashGreen(code[0]);
            //     }
            //     // eventData.code = "list-item-comma";

            //     break;
            // }

            // case EditActionType.DeleteListItem: {
            //     if (action.data.toRight) {
            //         const items = this.module.removeItems(context.token.rootNode, context.token.indexInRoot, 2);
            //         this.module.editor.executeEdits(this.getCascadedBoundary(items), null, "");
            //     } else if (action.data.toLeft) {
            //         const items = this.module.removeItems(context.token.rootNode, context.token.indexInRoot - 1, 2);
            //         this.module.editor.executeEdits(this.getCascadedBoundary(items), null, "");
            //     }

            //     break;
            // }

            case EditActionType.DeleteRootNode: {
                this.deleteCode(context.token.rootNode);
                break;
            }

            case EditActionType.ReplaceExpressionWithItem: {
                const rootNode = context.token.rootNode as Expression;
                let replacementTkn;
                for (let i = 0; i < rootNode.tokens.length; i++) {
                    if (
                        !(rootNode.tokens[i] instanceof TypedEmptyExpr) &&
                        !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                        !(rootNode.tokens[i] instanceof OperatorTkn)
                    ) {
                        replacementTkn = rootNode.tokens[i];
                    }
                }
                this.replaceCode(rootNode, replacementTkn);
                break;
            }

            case EditActionType.InsertImportFromDraftMode: {
                let currContext = context;
                this.module.editor.monaco.setPosition(new Position(1, 1));
                this.module.editor.cursor.setSelection(null);
                this.module.insertEmptyLine();
                this.module.editor.monaco.setPosition(new Position(1, 1));
                this.module.editor.cursor.setSelection(null);
                currContext = this.module.focus.getContext();

                const stmt = new ImportStatement(action.data?.moduleName, action.data?.itemName);
                const insertAction = new EditCodeAction(
                    "from --- import --- :",
                    "add-import-btn",
                    () => stmt,
                    InsertActionType.InsertStatement,
                    {},
                    null,
                    [" "],
                    "import",
                    null
                );

                insertAction.performAction(this, this.module.eventRouter, currContext, { type: "draft-mode" });
                // eventData.code = stmt.getRenderText();

                break;
            }
            case EditActionType.InsertMemberCallConversion:
            case EditActionType.InsertMemberAccessConversion: {
                const root = action.data.codeToReplace;
                this.module.focus.updateContext(
                    new UpdatableContext(null, action.data.codeToReplace.getRightPosition())
                );
                this.execute(
                    new EditAction(EditActionType.InsertModifier, {
                        source: action?.data?.source,
                        modifier: Actions.instance()
                            .actionsList.find((element) => element.cssId == action.data.conversionConstructId)
                            .getCodeFunction() as Modifier,
                    }),
                    this.module.focus.getContext()
                );

                this.flashGreen(action.data.codeToReplace.rootNode as CodeConstruct);

                if (root instanceof Expression) root.validateTypes(this.module);

                // eventData.code = action.data.codeToReplace.getRenderText();

                break;
            }
            case EditActionType.InsertFunctionConversion:
            case EditActionType.InsertTypeCast:
            case EditActionType.InsertComparisonConversion: {
                const root = action.data.codeToReplace;
                this.deleteCode(action.data.codeToReplace, {
                    statement: null,
                    replaceType: action.data.typeToConvertTo,
                });
                this.insertExpression(
                    this.module.focus.getContext(),
                    Actions.instance()
                        .actionsList.find((element) => element.cssId == action.data.conversionConstructId)
                        .getCodeFunction() as Expression
                );
                action.data.codeToReplace.draftModeEnabled = false;
                this.insertExpression(this.module.focus.getContext(), action.data.codeToReplace as Expression);
                this.flashGreen(action.data.codeToReplace.rootNode as CodeConstruct);

                if (root instanceof Expression) root.validateTypes(this.module);
                // eventData.code = action.data.codeToReplace.getRenderText();

                break;
            }

            case EditActionType.SelectClosestTokenAbove: {
                this.module.focus.navigateUp();

                break;
            }

            case EditActionType.SelectClosestTokenBelow: {
                this.module.focus.navigateDown();

                break;
            }

            case EditActionType.MoveCursorLeft:
                preventDefaultEvent = false;

                break;

            case EditActionType.MoveCursorRight:
                preventDefaultEvent = false;

                break;

            case EditActionType.SelectLeft:
                preventDefaultEvent = false;
                break;

            case EditActionType.SelectRight:
                preventDefaultEvent = false;
                break;

            case EditActionType.SelectToStart:
                preventDefaultEvent = false;
                break;

            case EditActionType.SelectToEnd:
                preventDefaultEvent = false;
                break;

            case EditActionType.Copy:
                preventDefaultEvent = false;
                break;

            case EditActionType.InsertLiteral: {
                const newLiteral = new LiteralValExpr(action.data?.literalType, action.data?.initialValue);
                this.insertExpression(context, newLiteral);

                if (flashGreen) this.flashGreen(newLiteral);

                if (action.data?.source?.type === "keyboard") {
                    // eventType = LogType.InsertCode;
                    // eventData.source = "keyboard";
                    // eventData.code = `literal-${getUserFriendlyType(newLiteral.returns)}`;
                }

                break;
            }

            case EditActionType.OpenValidInsertMenu:
                console.log("OpenValidInsertMenu")
                this.openAutocompleteMenu(
                    this.module.actionFilter
                        .getProcessedInsertionsList()
                        .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid)
                );
                this.styleAutocompleteMenu(context.position);

                break;

            //TODO: Remove later
            case EditActionType.OpenValidInsertMenuSingleLevel:
                if (!this.module.menuController.isMenuOpen()) {
                    //TODO: Make this work with ActionFilter
                    //const suggestions = this.module.getAllValidInsertsList(focusedNode);
                    //this.module.menuController.buildSingleLevelConstructCategoryMenu(suggestions);
                } else this.module.menuController.removeMenus();

                break;

            case EditActionType.SelectMenuSuggestionAbove:
                this.module.menuController.focusOptionAbove();

                break;

            case EditActionType.SelectMenuSuggestionBelow:
                this.module.menuController.focusOptionBelow();

                break;

            case EditActionType.SelectMenuSuggestion:
                this.module.menuController.selectFocusedOption();

                break;

            case EditActionType.CloseValidInsertMenu:
                this.module.menuController.removeMenus();

                break;

            case EditActionType.OpenSubMenu:
                this.module.menuController.openSubMenu();

                break;

            case EditActionType.CloseSubMenu:
                this.module.menuController.closeSubMenu();

                break;

            case EditActionType.CloseDraftMode:
                this.deleteCode(action.data.codeNode);

                break;

            case EditActionType.None: {
                preventDefaultEvent = true;

                break;
            }

            case EditActionType.InsertOperatorTkn: {
                this.replaceCode(context.tokenToLeft, action.data.operator);

                if (context.tokenToLeft.rootNode instanceof BinaryOperatorExpr) {
                    const root = context.tokenToLeft.rootNode;
                    root.operator = action.data.operator.operator;
                    root.operatorCategory = getOperatorCategory(root.operator);

                    if (root.getLeftOperand() instanceof TypedEmptyExpr) {
                        root.updateTypeOfEmptyOperandOnOperatorChange("left");
                    }

                    if (root.getRightOperand() instanceof TypedEmptyExpr) {
                        root.updateTypeOfEmptyOperandOnOperatorChange("right");
                    }
                }

                if (flashGreen) this.flashGreen(action.data.operator);
                // eventData.code = action.data.operator.getRenderText();

                break;
            }

            case EditActionType.DeleteUnconvertibleOperandWarning: {
                if (action.data.codeToDelete.draftModeEnabled)
                    this.module.closeConstructDraftRecord(action.data.codeToDelete);
                this.deleteCode(action.data.codeToDelete);

                //TODO: Eventually this if statement should go as all constructs will have this method
                if (
                    action.data.rootExpression instanceof Expression ||
                    action.data.rootExpression instanceof ListAccessModifier
                )
                    action.data.rootExpression.validateTypes(this.module);

                break;
            }
        }

        // if (eventData && eventType) Logger.Instance().queueEvent(new LogEvent(eventType, eventData));

        this.module.editor.monaco.focus();

        return preventDefaultEvent;
    }

    /**
     * Create a new VariabeReferenceExpr to the given identifier
     *
     * @param identifier - The identifier of the variable reference
     * @returns A new VariableReferenceExpr with the given identifier
     */
    createVarReference(identifier: string): VariableReferenceExpr {
        // const identifier = document.getElementById(buttonId).innerText;
        // No typing support
        // const dataType = this.module.variableController.getVariableTypeNearLine(
        //     this.module.focus.getFocusedStatement().scope ??
        //         (
        //             this.module.focus.getStatementAtLineNumber(this.module.editor.monaco.getPosition().lineNumber)
        //                 .rootNode as Statement | Module
        //         ).scope,
        //     this.module.editor.monaco.getPosition().lineNumber,
        //     identifier
        // );

        return new VariableReferenceExpr(identifier, DataType.Any, "RANDOM_CSS_ID");
    }

    /**
     * Insert a variable reference into the current context, handling cases on an empty line or
     * at an expression hole
     * 
     * @param identifier - The name of the variable to insert
     * @param source - Contains logging information
     * @param providedContext - The context to insert the variable reference into
     * @param autocompleteData - The data to use for autocompletion, if any
     */
    insertVariableReference(identifier: string, source: {}, providedContext?: Context, autocompleteData?: {}) {
        // Get the current context
        let context = providedContext ? providedContext : this.module.focus.getContext();

        // Some logging stuff
        // let { eventType, eventData } = this.getLogEventSource(source);

        if (this.module.validator.onBeginningOfLine(context)) {
            // If at the start of an line statement

            // Create a reference to the variable
            const varRef = this.createVarReference(identifier);
            // Create a new variable operation statement
            const stmt = new VarOperationStmt(varRef);
            // Insert the statement
            this.replaceEmptyStatement(context.lineStatement, stmt);

            // Get all possible EditCodeActions to make it into an assignment statement
            const availableActions = this.module.actionFilter
                .getProcessedInsertionsList()
                .filter(
                    (action) =>
                        action.insertionResult.insertionType !== InsertionType.Invalid &&
                        (action.insertActionType === InsertActionType.InsertAssignmentModifier ||
                            action.insertActionType === InsertActionType.InsertAugmentedAssignmentModifier)
                );

            // Set the editor in draft mode and provide the user with the possible actions
            this.module.openDraftMode(
                stmt,
                "Variable references should not be used on empty lines. Try converting it to an assignment statement instead!",
                (() => {
                    // Each button corresponds to an action
                    const buttons = [];

                    for (const action of availableActions) {
                        const button = document.createElement("div");
                        addClassToDraftModeResolutionButton(button, stmt);

                        const text = `${varRef.identifier}${action.optionName}`.replace(/---/g, "<hole1></hole1>");
                        button.innerHTML = text;

                        const modifier = action.getCode();
                        button.addEventListener("click", () => {
                            this.module.closeConstructDraftRecord(stmt);
                            this.module.executer.execute(
                                new EditAction(EditActionType.InsertAssignmentModifier, {
                                    codeToReplace: stmt,
                                    replacementConstructCssId: action.cssId,
                                    modifier: modifier,
                                    source: { type: "draft-mode" },
                                }),
                                this.module.focus.getContext()
                            );
                            this.flashGreen(modifier.rootNode as Statement);
                        });

                        buttons.push(button);
                    }

                    return buttons;
                })()
            );

            if (autocompleteData) {
                this.flashGreen(stmt);
            }

            // eventData.code = varRef.getRenderText();
        } else if (this.module.validator.atEmptyExpressionHole(context)) {
            // If variable reference inserted at an empty expression hole, like it should be

            // Create the reference
            const expr = this.createVarReference(identifier);
            // Insert the expression
            this.insertExpression(context, expr);

            if (autocompleteData) {
                this.flashGreen(expr);
            }

            // eventData.code = expr.getRenderText();
        }

        // Add to the logger
        // if (eventData && eventType) Logger.Instance().queueEvent(new LogEvent(eventType, eventData));
    }

    // /**
    //  * Given a source, returns the event type and event data to log
    //  * 
    //  * @param source - Logging information
    //  * @returns - The event type (always LogType.InsertCode) and event data to log
    //  */
    // getLogEventSource(source: any): { eventType: LogType; eventData: any } {
    //     let eventType: LogType;
    //     let eventData: any = null;

    //     if (source) {
    //         eventData = {};

    //         switch (source.type) {
    //             case "toolbox":
    //                 eventType = LogType.InsertCode;
    //                 eventData.source = "toolbox";

    //                 break;

    //             case "autocomplete":
    //                 eventType = LogType.InsertCode;
    //                 eventData.source = "autocomplete";

    //                 break;

    //             case "autocomplete-menu":
    //                 eventType = LogType.InsertCode;
    //                 eventData = {
    //                     source: "autocomplete-menu",
    //                     precision: source.precision,
    //                     length: source.length,
    //                 };

    //                 break;

    //             case "defined-variables":
    //                 eventType = LogType.InsertCode;
    //                 eventData.source = "defined-vars-toolbox";

    //                 break;

    //             case "draft-mode":
    //                 eventType = LogType.InsertCode;
    //                 eventData.source = "draft-mode";

    //                 break;
    //         }
    //     }

    //     return { eventType, eventData };
    // }

    /**
     * Delete the currently focused autocomplete token from the editor 
     * TODO: Why variants depending on the type of token? ==> Delete later?
     * 
     * @param context - The current focus context
     * @returns - The updated context
     */
    deleteAutocompleteOnMatch(context: Context): Context {
        // Get the current (autocomplete) token
        let token: AutocompleteTkn;

        // If the current focus is on or near an autocomplete token, set that token as the 
        // current token
        if (context.token instanceof AutocompleteTkn) token = context.token;
        if (context.tokenToLeft instanceof AutocompleteTkn) token = context.tokenToLeft;
        if (context.tokenToRight instanceof AutocompleteTkn) token = context.tokenToRight;

        // If an autocomplete token is found
        if (token) {
            switch (token.autocompleteType) {
                // Either to the right or left of an expression
                case AutoCompleteType.RightOfExpression:
                case AutoCompleteType.LeftOfExpression:
                    // Remove the token from the editor
                    this.deleteAutocompleteToken(token);

                    break;

                // At the start of a line
                case AutoCompleteType.StartOfLine:
                    // If the parent is a temporary statement, remove the entire statement
                    if (token.rootNode instanceof TemporaryStmt) {
                        this.deleteCode(token.rootNode, {
                            statement: true,
                        });
                    // Else just delete the token
                    } else {
                        this.deleteCode(token);
                    }

                    break;

                // If at an expression hole, remove the token
                case AutoCompleteType.AtExpressionHole:
                    this.deleteCode(token, {});

                    break;
            }
        }

        // Return the updated context
        return this.module.focus.getContext();
    }

    /**
     * Highlight the given construct for a short period of time in green
     * 
     * @param code - The construct to highlight
     */
    private flashGreen(code: CodeConstruct) {
        // If a construct is given
        if (code) {
            // Construct a construct highlighting object
            let highlight = new ConstructHighlight(this.module.editor, code, [109, 242, 162, 1]);

            // Change the highlight after a short delay
            setTimeout(() => {
                if (highlight) {
                    highlight.changeHighlightColour([255, 255, 255, 0]);

                    // Remove the highlight 
                    setTimeout(() => {
                        highlight.removeFromDOM();
                        highlight = null;
                    }, 500);
                }
            }, 1);
        }
    }

    /**
     * Insert the given list of constructs into the parent of the focused code construct 
     * at the given index
     * 
     * @param focusedCode - The focused code construct
     * @param index - The index to insert the constructs at in the parent of the focused code
     * @param items - The list of constructs to insert
     */
    private insertEmptyListItem(focusedCode: CodeConstruct, index: number, items: Array<CodeConstruct>) {
        // If the focused code is a token or an expression
        if (focusedCode instanceof Token || focusedCode instanceof Expression) {
            // Get the parent of the focused code
            const root = focusedCode.rootNode;

            // If parent is a statement which has tokens
            if (root instanceof Statement && root.tokens.length > 0) {
                // Add all the given constructs at the given index
                root.tokens.splice(index, 0, ...items);

                // Update all the indices of the child tokens in the root
                for (let i = 0; i < root.tokens.length; i++) {
                    root.tokens[i].indexInRoot = i;
                    root.tokens[i].rootNode = root;
                }

                // Rebuild the root
                root.rebuild(root.getLeftPosition(), 0);
            }
        }
    }

    /**
     * Perform the given match action ==> TODO: what does this mean?
     * 
     * @param match 
     * @param token 
     * @returns 
     */
    private performMatchAction(match: EditCodeAction, token: AutocompleteTkn) {
        // If you are matching a new variable statement and the token is a keyword 
        // or a built-in function
        if (
            match.insertActionType == InsertActionType.InsertNewVariableStmt &&
            (Object.keys(PythonKeywords).indexOf(token.text.trim()) >= 0 ||
                Object.keys(BuiltInFunctions).indexOf(token.text.trim()) >= 0)
        ) {
            // TODO: can insert an interesting warning
            // Can not match, thus simply return
            return;
        }

        // Length of the match token
        let length = 0;
        // Get the length of the text token if it is a variable
        if (match.insertActionType == InsertActionType.InsertNewVariableStmt) length = token.text.length + 1;
        // Otherwise, get the length of the match string
        else length = match.matchString.length + 1;

        match.performAction(
            this,
            this.module.eventRouter,
            this.module.focus.getContext(),
            { type: "autocomplete", precision: "1", length },
            {
                identifier: token.text,
            }
        );
    }

    /**
     * Insert the token in the current context, either by replacing the focused token / expression
     * or by inserting right before or after the focused expression if toLeft or toRight is true.
     * 
     * @param context - The current focus context
     * @param code - The token to insert
     * @param param2 - { toLeft, toRight }: Whether to insert to the left or right of the focused expression;
     * if both are false, then the focused token / expression will be replaced
     */
    private insertToken(context: Context, code: Token, { toLeft = false, toRight = false } = {}) {
        // Token is either a TypedEmptyExpr or an EmptyOperatorTkn (= a hole)
        if (context.token instanceof TypedEmptyExpr || context.token instanceof EmptyOperatorTkn) {
            // If there is a focused expression
            if (context.expression != null) {
                // Get the parent of the expression
                const root = context.expression.rootNode as Statement; // Statement or any of its derived classes
                // Replace in the parent the expression with the given token
                root.replace(code, context.expression.indexInRoot);
            // If there is not a focused expression but there is a focused token
            } else if (context.token != null) {
                // Get the parent of the token
                const root = context.token.rootNode as Statement;
                // Replace in the parent the token with the given token
                root.replace(code, context.token.indexInRoot);
            }

            // Get the range of the focused token
            const range = new Range(
                context.position.lineNumber,
                context.token.left,
                context.position.lineNumber,
                context.token.right
            );

            // Update the Monaco editor with the given token
            this.module.editor.executeEdits(range, code);
        // Insert the given token to the right of an expression on the left
        } else if (toRight && context.expressionToLeft != null) {
            // Get the parent of the expression to the left
            const root = context.expressionToLeft.rootNode;
            // Set the parent of the given token to the parent of the expression to the left
            code.rootNode = root;
            // Add the given token directly after the expression to the left
            // without removing anything
            root.tokens.splice(context.expressionToLeft.indexInRoot + 1, 0, code);
            // Rebuild
            root.rebuild(root.getLeftPosition(), 0);
            // Add code construct to Monaco editor
            this.module.editor.insertAtCurPos([code]);
        // Insert the given token to the left of an expression on the right
        } else if (toLeft && context.expressionToRight != null) {
            // Get the parent of the expression to the right
            const root = context.expressionToRight.rootNode;
            // Set the parent of the given token to the parent of the expression to the right
            code.rootNode = root;
            // Add token directly before the expression to the right
            root.tokens.splice(context.expressionToRight.indexInRoot, 0, code);
            // Rebuild
            root.rebuild(root.getLeftPosition(), 0);
            // Add code construct to Monaco editor
            this.module.editor.insertAtCurPos([code]);
        }
    }

    /**
     * Insert the given expression into the current context, checking types and updating the Monaco editor
     * in the process.
     * 
     * @param context - The current focus context
     * @param code - The expression to insert
     */
    private insertExpression(context: Context, code: Expression) {
        // type checks -- different handling based on type of code construct
        // focusedNode.returns != code.returns would work, but we need more context to get the right error message
        // context.token is the focused hole in which you want to insert
        // We can only insert expressions in holes / TypedEmptyExpr
        if (context.token instanceof TypedEmptyExpr) {
            // The root of the hole (either an expression or a statement)
            const root = context.token.rootNode;
            // Determine whether the expression "code" can be inserted into the hole
            let insertionResult = root.typeValidateInsertionIntoHole(code, context.token);

            if (insertionResult.insertionType != InsertionType.Invalid) {
                // For all valid or draft mode insertions
                // This seems to only update the types?
                if (root instanceof Statement) {
                    root.onInsertInto(code);
                }

                // Remove message if there is one
                if (context.token.message && context.selected) {
                    //TODO: This should only be closed if the current insertion would fix the current draft mode. Currently we don't know if that is the case.
                    this.module.messageController.removeMessageFromConstruct(context.token);
                }

                // Replaces expression with the newly inserted expression
                const expr = code as Expression;
                this.module.replaceFocusedExpression(expr);

                // Current range
                const range = new Range(
                    context.position.lineNumber,
                    context.token.left,
                    context.position.lineNumber,
                    context.token.right
                );

                // Update the text in the Monaco editor
                this.module.editor.executeEdits(range, expr);

                //TODO: This should probably run only if the insert above was successful, we cannot assume that it was
                if (!context.token.message) {
                    console.log("Focus update context", code.getInitialFocus());
                    const newContext = code.getInitialFocus();
                    this.module.focus.updateContext(newContext);
                }
            }

            if (root instanceof BinaryOperatorExpr) {
                // Type check binary expression
                root.validateTypes(this.module);
            } else if (insertionResult.insertionType == InsertionType.DraftMode) {
                this.module.openDraftMode(code, insertionResult.message, [
                    ...insertionResult.conversionRecords.map((conversionRecord) => {
                        return conversionRecord.getConversionButton(code.getKeyword(), this.module, code);
                    }),
                ]);
            } else if (isImportable(code)) {
                //TODO: This needs to run regardless of what happens above. But for that we need nested draft modes. It should not be a case within the same if block
                //The current problem is that a construct can only have a single draft mode on it. This is mostly ok since we often reinsert the construct when fixing a draft mode
                //and the reinsertion triggers another draft mode if necessary. But this does not happen for importables because they are not reinserted on a fix so we might lose some
                //draft modes this way.

                //A quick fix for now would be to just trigger reinsertion. Otherwise we need a mechanism for having multiple draft modes. I have a commit on a separate branch for that.
                //Converting them to a linked list seems to make the most sense.
                this.checkImports(code, insertionResult.insertionType);
            }
        }
    }

    /**
     * Check if all imports are satisfied and if not, open the draft mode for the given importable
     * 
     * @param insertedCode - The code to check for imports
     * @param currentInsertionType - The current insertion type of the insertedCode
     */
    private checkImports(insertedCode: Importable, currentInsertionType: InsertionType) {
        // If invalid, don't check for imports
        if (currentInsertionType === InsertionType.Invalid) return;

        // On insertion of the insertedCode, check if it is already imported (valid), not yet imported (draft mode),
        // or invalid
        const insertionType = insertedCode.validateImportOnInsertion(this.module, currentInsertionType);
        // If the insertedCode is a statement and is not yet imported, open the draft mode
        if (insertionType === InsertionType.DraftMode && insertedCode instanceof Statement) {
            this.module.openImportDraftMode(insertedCode);
        }
    }

    /**
     * Open an auto complete menu with the given insertions if the menu is not already open, otherwise
     * close all open ones
     * 
     * @param inserts - The EditCodeActions to display in the menu
     */
    private openAutocompleteMenu(inserts: EditCodeAction[]) {
        // If menu is not open
        if (!this.module.menuController.isMenuOpen()) {
            // Only keep valid or draft mode insertions
            inserts = inserts.filter((insert) => insert.insertionResult.insertionType !== InsertionType.Invalid);
            // Build the menu
            this.module.menuController.buildSingleLevelMenu(inserts);
        // Close all open menu's
        } else this.module.menuController.removeMenus();
    }

    /**
     * Replace the empty line statement with the given statement
     * 
     * @param emptyLine - The empty line statement to replace
     * @param statement - The statement to replace the empty line with
     */
    private replaceEmptyStatement(emptyLine: Statement, statement: Statement) {
        // Get the root of the empty line
        const root = emptyLine.rootNode as Statement | Module;

        // Replace the empty line with the given statement
        replaceInBody(root, emptyLine.indexInRoot, statement);

        // Notify the root that a replacement has taken place
        if (root instanceof Statement) root.notify(CallbackType.replace);

        // Get the range of the empty line
        var range = new Range(emptyLine.lineNumber, statement.left, emptyLine.lineNumber, statement.right);

        // Remove messages from the empty line statement
        if (emptyLine.message) this.module.messageController.removeMessageFromConstruct(emptyLine);

        // Check for imports for the given statement
        if (isImportable(statement)) {
            this.checkImports(statement, InsertionType.Valid);
        }

        // Update the Monaco editor with the new statement
        this.module.editor.executeEdits(range, statement);
        this.module.focus.updateContext(statement.getInitialFocus());
    }

    /**
     * Replace the given expression with a binary operator expression with the given 
     * expressions as one of its operands
     * 
     * @param op - The binary operator to create an expression with
     * @param expr - The expression to replace with the binary operator expression and be placed as
     * an operand
     * @param param2 - { toLeft: boolean, toRight: boolean }: Whether to place the given expression
     * to the left or right of the binary operator expression
     * @returns The new binary operator expression
     */
    private replaceWithBinaryOp(
        op: BinaryOperator,
        expr: Expression,
        { toLeft = false, toRight = false }
    ): BinaryOperatorExpr {
        if (expr instanceof Modifier) expr = expr.rootNode as Expression;

        // Get the range of the current expression
        const initialBoundary = this.getBoundaries(expr);
        // Parent node of the current expression
        const root = expr.rootNode as Statement;
        // Index of the current expression in the parent node
        const index = expr.indexInRoot;

        // Create the binary expression in which we need to insert the given expression
        const newCode = new BinaryOperatorExpr(
            op,
            expr.returns, // is not that important, will be replaced in the constructor based on the operator.
            root,
            expr.indexInRoot
        );

        // If toLeft is true, set curOperand to the left operand of the new binary expression, otherwise to the right operand
        const curOperand = toLeft ? newCode.getLeftOperand() : newCode.getRightOperand();
        // Determine the other operand: this is the operand that is not the current operand
        const otherOperand = toLeft ? newCode.getRightOperand() : newCode.getLeftOperand();
        // Get whether the given expression can be inserted inserted into the current operand (position)
        const insertionResult = newCode.typeValidateInsertionIntoHole(expr, curOperand as TypedEmptyExpr);

        /**
         * Special cases
         *
         * if (--- + (--- + ---)|): --> attempting to insert a comparator or binary boolean operation should fail
         */
        if (insertionResult.insertionType === InsertionType.Valid) {
            // Check whether the given expression can be replaced by the new binary expression
            const replacementResult = expr.canReplaceWithConstruct(newCode);

            // this can never go into draft mode
            // If the expression can be replaced with the binary expression
            if (replacementResult.insertionType !== InsertionType.Invalid) {
                // Close the draft mode if it is enabled
                if (root.tokens[index].draftModeEnabled) this.module.closeConstructDraftRecord(root.tokens[index]);

                // Set the left operand of the new binary expression to the given expression
                if (toLeft) newCode.replaceLeftOperand(expr);
                // Set the right operand of the new binary expression to the given expression
                else newCode.replaceRightOperand(expr);

                // Set the index of the given expression in the new binary expression
                // based on its operaond position
                expr.indexInRoot = curOperand.indexInRoot;
                // Set the rootnode of the given expression to the new binary expression
                expr.rootNode = newCode;

                // Set the token in the given expression's parent to the new binary expression
                root.tokens[index] = newCode;

                //TODO: Call onInsertInto() on this line
                root.rebuild(root.getLeftPosition(), 0);

                // Update the Monaco editor with the new binary expression
                this.module.editor.executeEdits(initialBoundary, newCode);
                this.module.focus.updateContext({
                    tokenToSelect: newCode.tokens[otherOperand.indexInRoot],
                });

                // If the insertion of the given expression is valid and the given expression is in draft mode
                if (replacementResult.insertionType !== InsertionType.DraftMode && expr.draftModeEnabled) {
                    // Close the draft mode
                    this.module.closeConstructDraftRecord(expr);
                } else if (root instanceof BinaryOperatorExpr) {
                    // Validate the types starting from the binary root expression
                    root.validateTypes(this.module);
                } else if (replacementResult.insertionType === InsertionType.DraftMode) {
                    // Given expression is in draft mode, open the draft mode
                    this.module.openDraftMode(newCode, replacementResult.message, [
                        ...replacementResult.conversionRecords.map((conversionRecord) => {
                            return conversionRecord.getConversionButton(newCode.getRenderText(), this.module, newCode);
                        }),
                    ]);
                }

                // Insert newcode into the root
                if (newCode.rootNode instanceof Statement) newCode.rootNode.onInsertInto(newCode);

                return newCode;
            }
        }
    }

    /**
     * Get the range starting from the first construct and ending at the last construct
     * NOTE: In between elements are not (explicitly) checked and and all the constructs
     * are assumed to be on the same line
     * 
     * @param codes 
     * @returns 
     */
    private getCascadedBoundary(codes: Array<CodeConstruct>): Range {
        // Get the range of all the constructs, assuming they are ordered according to their appearance 
        // in the text editor
        if (codes.length > 1) {
            // Starting line number (and ending line number, because only used for list elements)
            const lineNumber = codes[0].getLineNumber();

            // Return the range from the first to the last construct
            return new Range(lineNumber, codes[0].left, lineNumber, codes[codes.length - 1].right);
        // Simply return the range of the one construct
        } else return this.getBoundaries(codes[0]);
    }

    /**
     * Get the range of the entire construct, including potential body statements
     * 
     * @param code - The construct to get the boundaries in the Monaco editor of
     * @param param1 - { selectIndex: boolean }: If the indent should be included in the selection range
     * @returns THe range of the construct
     */
    private getBoundaries(code: CodeConstruct, { selectIndent = false } = {}): Range {
        // Linenumber of the given construct
        const lineNumber = code.getLineNumber();

        // If the given construct has a body
        if (code instanceof Statement && code.hasBody()) {
            const stmtStack = new Array<Statement>();
            // Add all the body statements to the stack
            stmtStack.unshift(...code.body);
            // Initialize the end line number and column
            let endLineNumber = 0;
            let endColumn = 0;

            while (stmtStack.length > 0) {
                // Pop an element from the stack
                const curStmt = stmtStack.pop();

                // Add all its sub-statements to the stack
                if (curStmt instanceof Statement && curStmt.hasBody()) stmtStack.unshift(...curStmt.body);

                // Update the line number and column if necessary
                if (endLineNumber < curStmt.lineNumber) {
                    endLineNumber = curStmt.lineNumber;
                    endColumn = curStmt.right;
                }
            }

            // Return the range of the construct
            return new Range(lineNumber, code.left, endLineNumber, endColumn);
        } else if (code instanceof Statement || code instanceof Token) {
            // If the indent (one indent) has to be included in the selection range
            if (selectIndent) {
                return new Range(lineNumber, code.left - TAB_SPACES, lineNumber, code.right);
            } else return new Range(lineNumber, code.left, lineNumber, code.right);
        }
    }

    /**
     * Delete the given modifier from the editor
     * 
     * @param mod - The modifier to delete
     * @param param1 
     */
    private deleteModifier(mod: Modifier, { deleting = false } = {}) {
        // TODO: this will be a prototype version of the code. needs to be cleaned and iterated on ->
        // e.g. merge the operations for VarOperationStmt and ValueOperationExpr

        // TODO: if deleting, should not move cursor
        // Get the range of the modifier to delete
        const removeRange = this.getBoundaries(mod);
        // The parent construct of the modifier
        const rootOfExprToLeft = mod.rootNode;

        // Remove the modifier from the parent's tokens
        rootOfExprToLeft.tokens.splice(mod.indexInRoot, 1);
        // Notify the code construct, and all its children, that it has been deleted
        this.module.recursiveNotify(mod, CallbackType.delete);

        // Close the draft mode if it is enabled
        this.module.closeConstructDraftRecord(rootOfExprToLeft);

        let built = false;
        let positionToMove: Position;

        // If only one child token is remaining (the right-hand side value or left-hand 
        // side variable reference)
        if (rootOfExprToLeft.tokens.length == 1) {
            // only a val or var-ref is remaining:
            if (rootOfExprToLeft instanceof ValueOperationExpr) {
                rootOfExprToLeft.updateReturnType();

                let replacementResult = rootOfExprToLeft.rootNode.checkInsertionAtHole(
                    rootOfExprToLeft.indexInRoot,
                    rootOfExprToLeft.returns
                );

                if (replacementResult.insertionType == InsertionType.DraftMode) {
                    const ref = rootOfExprToLeft.getVarRef();
                    if (ref instanceof VariableReferenceExpr) {
                        const line = this.module.focus.getContext().lineStatement;

                        const varType = this.module.variableController.getVariableTypeNearLine(
                            line.rootNode instanceof Module ? this.module.scope : line.scope,
                            line.lineNumber,
                            ref.identifier,
                            false
                        );

                        let expectedTypes = rootOfExprToLeft.rootNode.typeOfHoles[rootOfExprToLeft.indexInRoot];
                        const currentAllowedTypes = rootOfExprToLeft.rootNode.getCurrentAllowedTypesOfHole(
                            rootOfExprToLeft.indexInRoot,
                            false
                        );

                        if (currentAllowedTypes.length > 0) {
                            expectedTypes = currentAllowedTypes;
                        }

                        this.module.openDraftMode(
                            rootOfExprToLeft,
                            TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR(ref.identifier, varType, expectedTypes),
                            [
                                ...replacementResult.conversionRecords.map((conversionRecord) => {
                                    return conversionRecord.getConversionButton(
                                        ref.identifier,
                                        this.module,
                                        rootOfExprToLeft
                                    );
                                }),
                            ]
                        );
                    } else {
                        let expectedTypes = rootOfExprToLeft.rootNode.typeOfHoles[rootOfExprToLeft.indexInRoot];

                        const currentAllowedTypes = rootOfExprToLeft.rootNode.getCurrentAllowedTypesOfHole(
                            rootOfExprToLeft.indexInRoot,
                            false
                        );

                        if (currentAllowedTypes.length > 0) {
                            expectedTypes = currentAllowedTypes;
                        }

                        this.module.openDraftMode(
                            ref,
                            TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR(
                                ref.getKeyword(),
                                ref.returns,
                                expectedTypes
                            ),
                            [
                                ...replacementResult.conversionRecords.map((conversionRecord) => {
                                    return conversionRecord.getConversionButton(
                                        ref.getKeyword(),
                                        this.module,
                                        rootOfExprToLeft
                                    );
                                }),
                            ]
                        );
                    }
                }
                const value = rootOfExprToLeft.tokens[0];
                rootOfExprToLeft.rootNode.tokens[rootOfExprToLeft.indexInRoot] = value;
                value.rootNode = rootOfExprToLeft.rootNode;
                value.indexInRoot = rootOfExprToLeft.indexInRoot;

                rootOfExprToLeft.rootNode.rebuild(rootOfExprToLeft.rootNode.getLeftPosition(), 0);
                positionToMove = new Position(value.getLineNumber(), value.right);
                built = true;
            }
        }

        if (!built) {
            rootOfExprToLeft.rebuild(rootOfExprToLeft.getLeftPosition(), 0);
            positionToMove = new Position(rootOfExprToLeft.getLineNumber(), rootOfExprToLeft.right);
        }

        this.module.editor.executeEdits(removeRange, null, "");
        if (!deleting) {
            this.module.focus.updateContext({
                positionToMove,
            });
        }
    }

    /**
     * Remove the given token from the editor and update the focus context
     * 
     * @param token - The token to remove
     */
    private deleteAutocompleteToken(token: Token) {
        // Get the range of the token to delete
        const range = this.getBoundaries(token);
        // The parent construct of the token
        const root = token.rootNode as Statement;
        // Remove token from the parent's tokens
        root.tokens.splice(token.indexInRoot, 1);

        // Rebuild and notify
        root.rebuild(root.getLeftPosition(), 0);
        token.notify(CallbackType.delete);

        // Remove the token from the Monaco editor
        this.module.editor.executeEdits(range, null, "");
    }

    /**
     * Replace the given code with the given replacement, updating the Monaco 
     * editor and focus context
     * 
     * @param code - The construct to replace
     * @param replace - The construct to replace the given code with
     */
    private replaceCode(code: CodeConstruct, replace: CodeConstruct) {
        // Get the range of the construct to replace
        const replacementRange = this.getBoundaries(code);
        // Get the parent construct
        const root = code.rootNode;

        // If the construct to replace is a statement
        if (root instanceof Statement) {
            // Replace the statement with the given replacement in the parent's tokens
            root.tokens.splice(code.indexInRoot, 1, replace);

            // Notify the code construct, and all its children, that it has been deleted
            this.module.recursiveNotify(code, CallbackType.delete);

            // Update the index and parent of all the tokens in the parent
            for (let i = 0; i < root.tokens.length; i++) {
                // All tokens after the replaced token need to have their index in 
                // the parent updated
                root.tokens[i].indexInRoot = i;
                root.tokens[i].rootNode = root;
            }

            root.rebuild(root.getLeftPosition(), 0);

            // Replace all characters in the Monaco editor with the replacement construct
            this.module.editor.executeEdits(replacementRange, replace);

            // RELOOK TOMORROW
            if (replace instanceof Token && replace.isEmpty) {
                this.module.focus.updateContext({ tokenToSelect: replace });
            } else this.module.focus.updateContext({ positionToMove: replace.getRightPosition() });
        }
    }

    /**
     * Remove the given Construct from the editor and update the focus context
     * 
     * @param code 
     * @param param1 
     */
    private deleteCode(code: CodeConstruct, { statement = false, replaceType = null } = {}) {
        // The parent construct of the code to delete
        const root = code.rootNode;
        // Get range of the construct to delete
        const replacementRange = this.getBoundaries(code);
        // The construct to replace the deleted code with
        let replacement: CodeConstruct;

        // If the construct to delete is a statement
        if (statement) replacement = this.module.removeStatement(code as Statement);
        // If the construct to delete is a expression
        else replacement = this.module.replaceItemWTypedEmptyExpr(code, replaceType);

        // Replace all characters in the Monaco editor with the replacement construct
        this.module.editor.executeEdits(replacementRange, replacement);
        // Update the focus context
        this.module.focus.updateContext({ tokenToSelect: replacement });

        // If the parent is an expression, recheck the types
        if (root instanceof Expression) root.validateTypes(this.module);
    }

    // Maybe replace with a list of all words that can not occur as a variable name? 
    /**
     * Checks if the given identifier is not a keyword or built-in function, and 
     * adds a message if it is
     * 
     * @param context - The current focus context
     * @param identifierText - The name of the identifier to check
     */
    private validateIdentifier(context: Context, identifierText: string) {
        // The currently focused node
        let focusedNode = null;

        // If the current selected token is an identifier, it is the focused node
        if (context.token && context.selected && context.token instanceof IdentifierTkn) {
            focusedNode = context.token;
        // If the token to the left is an identifier (and the current token is not selected), 
        // it is the focused node
        } else if (context.tokenToLeft && context.tokenToLeft instanceof IdentifierTkn) {
            focusedNode = context.tokenToLeft;
        // If the token to the right is an identifier (and the current token is not selected),
        // it is the focused node
        } else if (context.tokenToRight && context.tokenToRight instanceof IdentifierTkn) {
            focusedNode = context.tokenToRight;
        }

        if (
            focusedNode instanceof IdentifierTkn
            // ||
            // context.tokenToLeft instanceof IdentifierTkn ||
            // context.tokenToRight instanceof IdentifierTkn
        ) {
            if (Object.keys(PythonKeywords).indexOf(identifierText) > -1) {
                this.module.messageController.addPopUpMessage(
                    focusedNode,
                    { identifier: identifierText },
                    ErrorMessage.identifierIsKeyword
                );
            } else if (Object.keys(BuiltInFunctions).indexOf(identifierText) > -1) {
                this.module.messageController.addPopUpMessage(
                    focusedNode,
                    { identifier: identifierText },
                    ErrorMessage.identifierIsBuiltInFunc
                );
            }
        }
    }

    /**
     * Update the autocomplete menu for the given AutocompleteTkn, by updating the options and position
     * 
     * @param autocompleteTkn - The token to update the autocomplete menu for
     */
    private updateAutocompleteMenu(autocompleteTkn: AutocompleteTkn) {
        this.module.menuController.updateMenuOptions(autocompleteTkn.getEditableText());
        this.module.menuController.updatePosition(
            this.module.menuController.getNewMenuPositionFromCode(autocompleteTkn)
        );
    }

    /**
     * Give styling to the autocomplete menu and update its position
     * 
     * @param pos - The position to place the autocomplete menu
     */
    private styleAutocompleteMenu(pos: Position) {
        this.module.menuController.styleMenuOptions();
        this.module.menuController.updatePosition(this.module.menuController.getNewMenuPositionFromPosition(pos));
    }
}
