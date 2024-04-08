import { Position, Range } from "monaco-editor";
import { ErrorMessage } from "../messages/error-msg-generator";
import { ConstructHighlight, ScopeHighlight } from "../messages/messages";
import {
    // AssignmentModifier,
    AutocompleteTkn,
    BinaryOperatorExpr,
    CodeConstruct,
    // ElseStatement,
    EmptyOperatorTkn,
    Expression,
    GeneralExpression,
    GeneralStatement,
    IdentifierTkn,
    // IfStatement,
    Importable,
    // ListAccessModifier,
    Modifier,
    NonEditableTkn,
    OperatorTkn,
    Statement,
    TemporaryStmt,
    Token,
    TypedEmptyExpr,
    // ValueOperationExpr,
    // VarOperationStmt,
    // VarAssignmentStmt,
    VariableReferenceExpr,
} from "../syntax-tree/ast";
import { replaceInBody } from "../syntax-tree/body";
import { Callback, CallbackType } from "../syntax-tree/callback";
import {
    AutoCompleteType,
    BuiltInFunctions,
    PythonKeywords,
    TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR,
    getOperatorCategory,
} from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { createFinalConstruct, isImportable } from "../utilities/util";
import { BinaryOperator, DataType, InsertionType } from "./../syntax-tree/consts";
import { EditCodeAction, InsertionResult } from "./action-filter";
import { EditActionType } from "./consts";
import { EditAction } from "./data-types";
import { Context } from "./focus";
import { LIGHT_GRAY } from "../language-definition/settings";
import { ASTManupilation } from "../syntax-tree/utils";

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

        // Handle each of the different action types
        switch (action.type) {
            // KInda language independent
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
                const statement = createFinalConstruct(action);

                // Probably best to use this to get the final construct text to compare against
                // in the suggestion controller
                // statement.getRenderText()

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
            // Kinda language independent
            case EditActionType.InsertGeneralExpr:
                const expression = createFinalConstruct(action);

                // NOT OKAY!!!
                this.insertExpression(context, expression as unknown as Expression);

                if (flashGreen) this.flashGreen(expression);

                break;

            // NOT language independent
            case EditActionType.OpenAutocomplete: {
                this.openSuggestionMenu(context, action.data.firstChar, action.data.autocompleteType);
                break;
            }

            // NOT language independent
            case EditActionType.DeleteNextToken: {
                if (context.expressionToRight instanceof OperatorTkn) {
                    this.replaceCode(
                        context.expressionToRight,
                        new EmptyOperatorTkn(" ", context.expressionToRight, context.expressionToRight.indexInRoot)
                    );
                } else if (this.module.validator.atBeginningOfValOperation(context)) {
                    this.module.deleteCode(context.expressionToRight.rootNode);
                // } else if (context.expressionToRight instanceof Modifier) {
                //     this.deleteModifier(context.expressionToRight, { deleting: true });
                } else this.module.deleteCode(context.expressionToRight);

                break;
            }

            // NOT language independent
            case EditActionType.DeletePrevToken: {
                if (context.expressionToLeft instanceof OperatorTkn) {
                    this.replaceCode(
                        context.expressionToLeft,
                        new EmptyOperatorTkn(" ", context.expressionToLeft, context.expressionToLeft.indexInRoot)
                    );
                // } else if ( // TEMPORARY DISABLED TO FIX ERRORS
                //     context.expressionToLeft instanceof VariableReferenceExpr &&
                //     context.expressionToLeft.rootNode instanceof VarOperationStmt
                // ) {
                //     this.module.deleteCode(context.expressionToLeft.rootNode, { statement: true });
                }
                // else if (context.expressionToLeft instanceof Modifier) this.deleteModifier(context.expressionToLeft);
                else this.module.deleteCode(context.expressionToLeft);

                break;
            }

            case EditActionType.DeleteRootOfToken: {
                if (action.data?.backwards) {
                    const stmt =
                        context.tokenToLeft.rootNode instanceof GeneralStatement &&
                        !(context.tokenToLeft.rootNode instanceof GeneralExpression);
                    this.module.deleteCode(context.tokenToLeft.rootNode, { statement: stmt });
                } else {
                    const stmt =
                        context.tokenToRight.rootNode instanceof GeneralStatement &&
                        !(context.tokenToRight.rootNode instanceof GeneralExpression);
                    this.module.deleteCode(context.tokenToRight.rootNode, { statement: stmt });
                }

                break;
            }

            // NOT language independent => Try to remove as statements should not be hardcoded
            case EditActionType.DeleteStatement: {
                this.module.deleteCode(context.lineStatement, { statement: true });

                break;
            }

            case EditActionType.DeleteStmt: {
                // Remove the currently focused statement and update the body to
                // reflect the new correct indentation
                this.module.indentBodyConstructs(context, true);
                this.module.deleteCode(context.lineStatement, { statement: true });

                break;
            }

            // NOT language independent => Try to remove as statements should not be hardcoded
            // Also: try to merge all deletes into one single delete and write logic to determine
            // what to delete based on the context
            // case EditActionType.DeleteMultiLineStatement: {
            //     // Maybe delete everything inside this if, as this is just to show a message?
            //     if (
            //         context.lineStatement instanceof IfStatement ||
            //         (context.lineStatement instanceof ElseStatement && context.lineStatement.hasCondition)
            //     ) {
            //         const elseStatementsAfterIf = [];

            //         for (
            //             let i = context.lineStatement.indexInRoot + 1;
            //             i < context.lineStatement.rootNode.body.length;
            //             i++
            //         ) {
            //             const line = context.lineStatement.rootNode.body[i];

            //             if (line instanceof ElseStatement) elseStatementsAfterIf.push(line);
            //             else break;
            //         }

            //         for (const elseStmt of elseStatementsAfterIf) {
            //             this.module.messageController.addHoverMessage(
            //                 elseStmt,
            //                 null,
            //                 "add if before the first else, or delete this."
            //             );
            //         }
            //     }

            //     while (context.lineStatement.body.length > 0) {
            //         this.module.editor.indentRecursively(
            //             context.lineStatement.body[context.lineStatement.body.length - 1],
            //             { backward: true }
            //         );
            //         this.module.indentBackStatement(context.lineStatement.body[context.lineStatement.body.length - 1]);
            //     }

            //     this.module.deleteCode(context.lineStatement, { statement: true });

            //     break;
            // }
            // REPLACED BY DeleteStmt

            // NOT language independent
            // See before
            case EditActionType.DeleteEmptyLine: {
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

            // NOT language independent
            // Idem
            // case EditActionType.DeleteSelectedModifier: {
            //     this.deleteModifier(context.token.rootNode as Modifier, { deleting: true });

            //     break;
            // }

            // Partly language independent
            case EditActionType.DeletePrevLine: {
                const prevLine = this.module.focus.getStatementAtLineNumber(context.lineStatement.lineNumber - 1);

                if (prevLine.left != context.lineStatement.left) {
                    // Indent the current line
                    this.module.indentConstruct(context.lineStatement, false);
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

            // Mostly language independent: except for "indentBackStatement"
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

            // Mostly language independent: except for "indentBackStatement"
            case EditActionType.IndentBackwards: {
                this.module.indentConstruct(context.lineStatement, true);

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            // Mostly language independent: except for "indentForwardStatement"
            case EditActionType.IndentForwards: {
                this.module.editor.indentRecursively(context.lineStatement, { backward: false });
                this.module.indentForwardStatement(context.lineStatement);

                this.module.focus.fireOnNavChangeCallbacks();

                break;
            }

            // Language independent as we will likely keep the concept of an empty line
            case EditActionType.InsertEmptyLine: {
                const newEmptyLine = this.module.insertEmptyLine();
                this.module.focus.fireOnNavOffCallbacks(context.lineStatement, newEmptyLine);

                break;
            }

            // Language independent
            case EditActionType.SelectPrevToken: {
                this.module.focus.navigateLeft();

                break;
            }

            // Language independent
            case EditActionType.SelectNextToken: {
                this.module.focus.navigateRight();

                break;
            }

            //
            case EditActionType.InsertChar: {
                // Current caret position and current seelection
                const cursorPos = this.module.editor.monaco.getPosition();
                const selectedText = this.module.editor.monaco.getSelection();
                // Get the focused or adjacent editable
                const editableToken = this.module.focus.getTextEditableItem(context);
                // Get the editable text
                const editableText = editableToken.getEditableText();
                // Get the corresponding editable token
                const token = editableToken.getToken();
                let newText = "";

                // Handle the editing of an existing identifier
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

                // Add warnings if the given text is reserved
                this.validateIdentifier(context, newText);

                let editRange: Range;

                // If start and end column are different, we have a selection
                if (selectedText.startColumn != selectedText.endColumn) {
                    editRange = new Range(
                        cursorPos.lineNumber,
                        selectedText.startColumn,
                        cursorPos.lineNumber,
                        selectedText.endColumn
                    );
                    // If the token to the right is an identifier and empty
                } else if (
                    context.tokenToRight?.isTextEditable &&
                    context.tokenToRight instanceof IdentifierTkn &&
                    context.tokenToRight.isEmpty
                ) {
                    // Select the token for the given range
                    editRange = new Range(
                        cursorPos.lineNumber,
                        context.tokenToRight.left,
                        cursorPos.lineNumber,
                        context.tokenToRight.right
                    );
                } else {
                    // Otherwise make an empty range for the given cursor position
                    editRange = new Range(
                        cursorPos.lineNumber,
                        cursorPos.column,
                        cursorPos.lineNumber,
                        cursorPos.column
                    );
                }

                if (editableToken instanceof AutocompleteTkn) {
                    // If with the pressed key there is one remaining match, perform the match action
                    let match = editableToken.checkMatch(pressedKey);

                    if (match) {
                        this.performMatchAction(match, editableToken);

                        break;
                    }

                    // If there is an option with the current pressed key as terminating character
                    // perform that match action
                    match = editableToken.isInsertableTerminatingMatch(pressedKey);

                    if (match) {
                        this.performMatchAction(match, editableToken);

                        // CAN THIS BE REMOVED? This should also happen within "performMatchAction"
                        this.execute(this.module.eventRouter.getKeyAction(e));

                        break;
                    }
                }

                // Add the text to the token and if it could be rebuild (it is in the editor), execute the edit
                if (editableToken.setEditedText(newText)) this.module.editor.executeEdits(editRange, null, pressedKey);

                break;
            }

            case EditActionType.DeletePrevChar:
            case EditActionType.DeleteNextChar: {
                // Current caret position and current selection
                const cursorPos = this.module.editor.monaco.getPosition();
                const selectedText = this.module.editor.monaco.getSelection();
                // Get the focused or adjacent editable
                const editableToken = this.module.focus.getTextEditableItem(context);
                // Get the text editable token
                const token = editableToken.getToken();

                let newText = "";

                // The current token text
                const curText = editableToken.getEditableText().split("");
                // The number of items to delete
                const toDeleteItems =
                    selectedText.startColumn == selectedText.endColumn
                        ? 1
                        : Math.abs(selectedText.startColumn - selectedText.endColumn);

                // 0 if the action is "DeleteNextChar", 1 if the action is "DeletePrevChar"
                const toDeletePos = action.type == EditActionType.DeleteNextChar ? 0 : 1;

                curText.splice(
                    Math.min(
                        cursorPos.column - token.left - toDeletePos,
                        selectedText.startColumn - token.left - toDeletePos
                    ),
                    toDeleteItems
                );

                newText = curText.join("");

                // Check against reserved words
                this.validateIdentifier(context, newText);

                // Check if it needs to turn back into a hole:
                if (newText.length == 0) {
                    let removableExpr: CodeConstruct = null;

                    // If the current expression is atomic (has no subexpressions or editable token)
                    if (context.expression?.isAtomic() /*context.expression instanceof LiteralValExpr*/) {
                        removableExpr = context.expression;
                    } else if (context.token instanceof AutocompleteTkn) {
                        removableExpr = context.token;
                    } else if (context.expressionToLeft?.isAtomic() /*instanceof LiteralValExpr*/) {
                        removableExpr = context.expressionToLeft;
                    } else if (context.tokenToLeft instanceof AutocompleteTkn) {
                        removableExpr = context.tokenToLeft;
                    } else if (context.expressionToRight?.isAtomic() /*instanceof LiteralValExpr*/) {
                        removableExpr = context.expressionToRight;
                    } else if (context.tokenToRight instanceof AutocompleteTkn) {
                        removableExpr = context.tokenToRight;
                    }

                    // If the expression is removable, delete it
                    if (removableExpr != null) {
                        if (
                            removableExpr instanceof AutocompleteTkn &&
                            removableExpr.rootNode instanceof TemporaryStmt
                        ) {
                            // Remove the temporary statement encapsulating the autocomplete token
                            this.module.deleteCode(removableExpr.rootNode, { statement: true });
                        } else if (
                            removableExpr instanceof AutocompleteTkn &&
                            removableExpr.autocompleteType == AutoCompleteType.AtEmptyOperatorHole
                        ) {
                            // When at an operator, replace it with an empty operator
                            this.replaceCode(
                                removableExpr,
                                new EmptyOperatorTkn(" ", removableExpr.rootNode, removableExpr.indexInRoot)
                            );
                        } else if (
                            removableExpr instanceof AutocompleteTkn &&
                            (removableExpr.autocompleteType == AutoCompleteType.RightOfExpression ||
                                removableExpr.autocompleteType == AutoCompleteType.LeftOfExpression)
                        ) {
                            // Remove the autocomplete token
                            this.deleteAutocompleteToken(removableExpr);
                            // Else just remove the expression
                        } else this.module.deleteCode(removableExpr);

                        break;
                    }

                    let identifier: IdentifierTkn = null;
                    // Try to get the identifier token by looking to the left, right and at the current token
                    if (context.tokenToLeft instanceof IdentifierTkn) {
                        identifier = context.tokenToLeft;
                    } else if (context.tokenToRight instanceof IdentifierTkn) {
                        identifier = context.tokenToRight;
                    } else if (context.token instanceof IdentifierTkn) {
                        identifier = context.token;
                    }

                    // If the identifier is found, reset it
                    if (identifier != null) {
                        // reset identifier:
                        identifier.text = "  ";
                        identifier.isEmpty = true;

                        // Update the editor with the new value
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

                // If the editableToken is after rebuilding in the editor, execute the edit in the
                // Monaco editor
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

                    // DOES THIS LINE SOMETHIMES HAPPEN WHEN THE PREVIOUS "executeEdits" IS CALLED AS WELL?
                    this.module.editor.executeEdits(editRange, null, "");
                    preventDefaultEvent = false;
                }

                break;
            }

            // NOT language independent
            // case EditActionType.InsertAssignmentModifier: {
            //     // If the expression to the left is a variable reference on its own
            //     if (context.expressionToLeft.rootNode instanceof VarOperationStmt) {
            //         // Get the parent of the variable reference
            //         const varOpStmt = context.expressionToLeft.rootNode;

            //         // If the current insertion is an assignment modifier
            //         // and the expression to the left is a variable reference
            //         if (
            //             action.data.modifier instanceof AssignmentModifier &&
            //             context.expressionToLeft instanceof VariableReferenceExpr
            //         ) {
            //             // Close draft mode of the variable reference; it is now correctly contained
            //             // in an assignment statement
            //             if (context.expressionToLeft.rootNode.draftModeEnabled) {
            //                 this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
            //             }
            //             // Get the boundaries of the variable reference expression
            //             const initialBoundary = context.expressionToLeft.getBoundaries();

            //             // const varAssignStmt = new VarAssignmentStmt(
            //             //     "",
            //             //     context.expressionToLeft.identifier,
            //             //     varOpStmt.rootNode,
            //             //     varOpStmt.indexInRoot
            //             // );
            //             // Construct a new variable assignment statement, set the identifier,
            //             // the root node and the index in the root
            //             const varAssignStmt = structuredClone(GeneralStatement.constructs.get("varAss"));
            //             varAssignStmt.setAssignmentIdentifier(context.expressionToLeft.identifier, 0);
            //             varAssignStmt.rootNode = varOpStmt.rootNode;
            //             varAssignStmt.indexInRoot = varOpStmt.indexInRoot;

            //             // Generalise to a simple "replace" call
            //             replaceInBody(varOpStmt.rootNode, varOpStmt.indexInRoot, varAssignStmt);

            //             // Perform the edits in the Monaco editor and update the focus
            //             this.module.editor.executeEdits(initialBoundary, varAssignStmt);
            //             this.module.focus.updateContext(varAssignStmt.getInitialFocus());

            //             if (flashGreen) this.flashGreen(varAssignStmt);
            //             // Else: WHEN IS THIS CASE VALID?
            //         } else {
            //             if (
            //                 context.expressionToLeft instanceof VariableReferenceExpr &&
            //                 context.expressionToLeft.rootNode.draftModeEnabled
            //             ) {
            //                 this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
            //             }

            //             varOpStmt.appendModifier(action.data.modifier);
            //             varOpStmt.rebuild(varOpStmt.getLeftPosition(), 0);

            //             this.module.editor.insertAtCurPos([action.data.modifier]);
            //             this.module.focus.updateContext(action.data.modifier.getInitialFocus());

            //             if (flashGreen) this.flashGreen(action.data.modifier);
            //         }
            //     }

            //     // eventData.code = action.data.modifier.getRenderText();

            //     break;
            // }

            // TODO: Disabled as this should be handled generally => STILL TO DO
            // case EditActionType.InsertModifier: {
            //     const modifier = action.data.modifier as Modifier;

            //     if (context.expressionToLeft instanceof Modifier) {
            //         if (context.expressionToLeft.rootNode instanceof ValueOperationExpr) {
            //             const valOprExpr = context.expressionToLeft.rootNode;
            //             const valOprExprRoot = valOprExpr.rootNode as Statement;

            //             let replacementResult = valOprExpr.rootNode.checkInsertionAtHole(
            //                 valOprExpr.indexInRoot,
            //                 modifier.returns
            //             );

            //             const holeTypes = valOprExpr.rootNode.typeOfHoles[valOprExpr.indexInRoot];

            //             if (replacementResult.insertionType !== InsertionType.Invalid) {
            //                 valOprExpr.appendModifier(modifier);
            //                 valOprExprRoot.rebuild(valOprExprRoot.getLeftPosition(), 0);

            //                 this.module.editor.insertAtCurPos([modifier]);
            //                 this.module.focus.updateContext(modifier.getInitialFocus());

            //                 if (replacementResult.insertionType == InsertionType.DraftMode)
            //                     this.module.openDraftMode(
            //                         valOprExpr,
            //                         TYPE_MISMATCH_ON_FUNC_ARG_DRAFT_MODE_STR(
            //                             valOprExpr.getKeyword(),
            //                             holeTypes,
            //                             valOprExpr.returns
            //                         ),
            //                         [
            //                             ...replacementResult.conversionRecords.map((conversionRecord) => {
            //                                 return conversionRecord.getConversionButton(
            //                                     valOprExpr.getKeyword(),
            //                                     this.module,
            //                                     valOprExpr
            //                                 );
            //                             }),
            //                         ]
            //                     );
            //             }

            //             if (valOprExpr.rootNode instanceof Statement) valOprExpr.rootNode.onInsertInto(valOprExpr);
            //         }
            //     } else if (
            //         context.expressionToLeft instanceof VariableReferenceExpr &&
            //         context.expressionToLeft.rootNode instanceof VarOperationStmt
            //     ) {
            //         if (context.expressionToLeft.rootNode.draftModeEnabled) {
            //             this.module.closeConstructDraftRecord(context.expressionToLeft.rootNode);
            //         }
            //         const varOpStmt = context.expressionToLeft.rootNode;

            //         varOpStmt.appendModifier(modifier);
            //         varOpStmt.rebuild(varOpStmt.getLeftPosition(), 0);

            //         this.module.editor.insertAtCurPos([modifier]);
            //         this.module.focus.updateContext(modifier.getInitialFocus());

            //         if (modifier instanceof MethodCallModifier && modifier.returns !== DataType.Void) {
            //             //TODO: PropertyAccessModifier should also be included here once we have them
            //             this.module.openDraftMode(
            //                 varOpStmt,
            //                 "This statement has no effect since the value it returns is not stored anywhere.",
            //                 []
            //             ); //TODO: Offer fixes?
            //         }
            //     } else {
            //         const exprToLeftRoot = context.expressionToLeft.rootNode as Statement;
            //         const exprToLeftIndexInRoot = context.expressionToLeft.indexInRoot;

            //         // Data type related stuff
            //         if (modifier instanceof ListAccessModifier) {
            //             modifier.returns = TypeChecker.getElementTypeFromListType(context.expressionToLeft.returns);

            //             if (!modifier.returns) modifier.returns = DataType.Any;
            //         }

            //         const replacementResult = exprToLeftRoot.checkInsertionAtHole(
            //             context.expressionToLeft.indexInRoot,
            //             modifier.returns
            //         );
            //         const holeDataTypes = exprToLeftRoot.typeOfHoles[context.expressionToLeft.indexInRoot];

            //         const valOprExpr = new ValueOperationExpr(
            //             context.expressionToLeft,
            //             [modifier],
            //             context.expressionToLeft.rootNode,
            //             context.expressionToLeft.indexInRoot
            //         );

            //         if (valOprExpr.rootNode instanceof Statement) valOprExpr.rootNode.onInsertInto(valOprExpr);

            //         context.expressionToLeft.indexInRoot = 0;
            //         context.expressionToLeft.rootNode = valOprExpr;

            //         if (replacementResult.insertionType !== InsertionType.Invalid) {
            //             this.module.closeConstructDraftRecord(context.expressionToLeft);

            //             exprToLeftRoot.tokens[exprToLeftIndexInRoot] = valOprExpr;
            //             exprToLeftRoot.rebuild(exprToLeftRoot.getLeftPosition(), 0);

            //             this.module.editor.insertAtCurPos([modifier]);
            //             this.module.focus.updateContext(modifier.getInitialFocus());

            //             if (replacementResult.insertionType == InsertionType.DraftMode) {
            //                 if (valOprExpr.returns === DataType.Any) {
            //                     this.module.openDraftMode(
            //                         valOprExpr,
            //                         TYPE_MISMATCH_ANY(holeDataTypes, valOprExpr.returns),
            //                         [
            //                             new IgnoreConversionRecord(
            //                                 "",
            //                                 null,
            //                                 null,
            //                                 "",
            //                                 null,
            //                                 Tooltip.IgnoreWarning
            //                             ).getConversionButton("", this.module, valOprExpr),
            //                         ]
            //                     );
            //                 } else {
            //                     this.module.openDraftMode(
            //                         valOprExpr,
            //                         TYPE_MISMATCH_ON_FUNC_ARG_DRAFT_MODE_STR(
            //                             valOprExpr.getKeyword(),
            //                             holeDataTypes,
            //                             valOprExpr.returns
            //                         ),
            //                         [
            //                             ...replacementResult.conversionRecords.map((conversionRecord) => {
            //                                 return conversionRecord.getConversionButton(
            //                                     valOprExpr.getKeyword(),
            //                                     this.module,
            //                                     valOprExpr
            //                                 );
            //                             }),
            //                         ]
            //                     );
            //                 }
            //             }
            //         }
            //     }

            //     if (flashGreen) this.flashGreen(action.data.modifier);
            //     // eventData.code = action.data.modifier.getRenderText();

            //     break;
            // }

            // TODO: Disabled as this should be handled generally => IMPORTANT STILL TO DO!
            // case EditActionType.InsertBinaryOperator: {
            //     let binExpr: BinaryOperatorExpr;

            //     if (action.data.toRight) {
            //         binExpr = this.replaceWithBinaryOp(action.data.operator, context.expressionToLeft, {
            //             toLeft: true,
            //         });
            //     } else if (action.data.toLeft) {
            //         binExpr = this.replaceWithBinaryOp(action.data.operator, context.expressionToRight, {
            //             toRight: true,
            //         });
            //     } else if (action.data.replace) {
            //         binExpr = new BinaryOperatorExpr(action.data.operator, (context.token as TypedEmptyExpr).type[0]);
            //         this.insertExpression(context, binExpr);
            //     }

            //     if (flashGreen) this.flashGreen(binExpr);
            //     // eventData.code = action.data.operator;

            //     break;
            // }

            // TODO: Disabled as this should be handled generally => STILL TO DO
            // case EditActionType.WrapExpressionWithItem: {
            //     // both lists and str work on any, so the first step of validation is always OK.

            //     const initialBoundary = this.getBoundaries(context.expressionToRight);
            //     const expr = context.expressionToRight as Expression;
            //     const indexInRoot = expr.indexInRoot;
            //     const root = expr.rootNode as Statement;

            //     const newCode = action.data.expression as Expression;
            //     newCode.indexInRoot = expr.indexInRoot;
            //     newCode.rootNode = expr.rootNode;

            //     const isValidRootInsertion =
            //         newCode.returns == DataType.Any ||
            //         root.typeOfHoles[indexInRoot].indexOf(newCode.returns) >= 0 ||
            //         root.typeOfHoles[indexInRoot] == DataType.Any;

            //     let replaceIndex: number = 0;

            //     for (const [i, token] of newCode.tokens.entries()) {
            //         if (token instanceof TypedEmptyExpr) {
            //             replaceIndex = i;

            //             break;
            //         }
            //     }

            //     if (isValidRootInsertion) {
            //         this.module.closeConstructDraftRecord(root.tokens[indexInRoot]);
            //     }

            //     newCode.tokens[replaceIndex] = context.expressionToRight;
            //     context.expressionToRight.indexInRoot = replaceIndex;
            //     context.expressionToRight.rootNode = newCode;
            //     root.tokens[indexInRoot] = newCode;
            //     root.rebuild(root.getLeftPosition(), 0);
            //     this.module.editor.executeEdits(initialBoundary, newCode);
            //     this.module.focus.updateContext({
            //         positionToMove: new Position(newCode.lineNumber, newCode.right),
            //     });

            //     if (newCode.rootNode instanceof BinaryOperatorExpr) {
            //         newCode.rootNode.onInsertInto(newCode);
            //         newCode.rootNode.validateTypes(this.module);
            //     } else if (newCode.rootNode instanceof Statement) {
            //         newCode.rootNode.onInsertInto(newCode);
            //     }

            //     if (!isValidRootInsertion) {
            //         this.module.closeConstructDraftRecord(expr);
            //         this.module.openDraftMode(newCode, "DEBUG THIS", []);
            //     }

            //     if (flashGreen) this.flashGreen(newCode);
            //     // eventData.code = action.data.expression.getRenderText();
            //     // eventData.wrap = true;

            //     break;
            // }

            // Should be generalised
            // case EditActionType.ConvertAutocompleteToString: {
            //     const autocompleteToken = action.data.token as AutocompleteTkn;
            //     const literalValExpr = new LiteralValExpr(
            //         DataType.String,
            //         autocompleteToken.text,
            //         autocompleteToken.rootNode as Expression | Statement,
            //         autocompleteToken.indexInRoot
            //     );

            //     autocompleteToken.draftModeEnabled = false;
            //     this.deleteCode(autocompleteToken);
            //     this.insertExpression(this.module.focus.getContext(), literalValExpr);

            //     // eventData.code = "double-quote";
            //     // eventData.wrap = true;

            //     break;
            // }

            // case EditActionType.InsertEmptyList: {
            //     const newLiteral = new ListLiteralExpression();
            //     this.insertExpression(context, newLiteral);

            //     if (flashGreen) this.flashGreen(newLiteral);
            //     // eventData.code = "empty-list";

            //     break;
            // }

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

            // Generalise in one single delete function
            case EditActionType.DeleteRootNode: {
                this.module.deleteCode(context.token.rootNode);
                break;
            }

            // Mostly language independent
            // USE CASE?
            case EditActionType.ReplaceExpressionWithItem: {
                // Get the parent of the token
                const rootNode = context.token.rootNode as GeneralExpression;
                // The token which will replace the expression
                let replacementTkn: CodeConstruct;
                for (let i = 0; i < rootNode.tokens.length; i++) {
                    // Set the last occuring construct that is not a hole, non-editable or operator token
                    // to be the replacementTkn
                    if (
                        !(rootNode.tokens[i] instanceof TypedEmptyExpr) &&
                        !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                        !(rootNode.tokens[i] instanceof OperatorTkn)
                    ) {
                        replacementTkn = rootNode.tokens[i];
                    }
                }
                // Replace the expression with the replacement token
                this.replaceCode(rootNode, replacementTkn);
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

            // When using the keyboard combination "Ctrl + Space"
            case EditActionType.OpenValidInsertMenu:
                /**
                 * Central idea:
                 * There are two options: either the menu should be opened somewhere were there is
                 * not yet any autocomplete token or there is already an autocomplete token present.
                 * - First possibility: simply open the menu, maybe by creating a new autocomplete token
                 * - Second possibility: open the autocomplete menu for the existing token
                 *
                 * The second case should be pretty straight forward, however the first might require
                 * special logic if it should be created without creating an autocomplete token ...
                 */

                // An autocomplete token is present; use it to open an autocomplete menu
                this.openSuggestionMenu(
                    context,
                    action.data?.firstChar ?? "",
                    action.data?.autocompleteType ?? AutoCompleteType.StartOfLine
                );
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
                this.module.deleteCode(action.data.codeNode);

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

                break;
            }

            // case EditActionType.DeleteUnconvertibleOperandWarning: {
            //     if (action.data.codeToDelete.draftModeEnabled)
            //         this.module.closeConstructDraftRecord(action.data.codeToDelete);
            //     this.module.deleteCode(action.data.codeToDelete);

            //     //TODO: Eventually this if statement should go as all constructs will have this method
            //     if (
            //         action.data.rootExpression instanceof Expression ||
            //         action.data.rootExpression instanceof ListAccessModifier
            //     )
            //         action.data.rootExpression.validateTypes(this.module);

            //     break;
            // }
        }

        // if (eventData && eventType) Logger.Instance().queueEvent(new LogEvent(eventType, eventData));

        this.module.editor.monaco.focus();

        return preventDefaultEvent;
    }

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
                        this.module.deleteCode(token.rootNode, {
                            statement: true,
                        });
                        // Else just delete the token
                    } else {
                        this.module.deleteCode(token);
                    }

                    break;

                // If at an expression hole, remove the token
                case AutoCompleteType.AtExpressionHole:
                    this.module.deleteCode(token, {});

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
            (match.getCode() as GeneralStatement)?.containsAssignments() &&
            this.module.language.isReservedWord(token.text.trim())
        ) {
            // TODO: can insert an interesting warning
            // Can not match, thus simply return
            return;
        }

        // Length of the match token
        let length = 0;
        // Get the length of the text token if it is a variable
        if ((match.getCode() as GeneralStatement)?.containsAssignments()) length = token.text.length + 1;
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
            let insertionResult = new InsertionResult(InsertionType.Valid, "", []); //root.typeValidateInsertionIntoHole(code, context.token);

            if (insertionResult.insertionType != InsertionType.Invalid) {
                // For all valid or draft mode insertions
                // This seems to only update the types?
                // if (root instanceof Statement) {
                //     root.onInsertInto(code);
                // }

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
                    const newContext = code.getInitialFocus();
                    this.module.focus.updateContext(newContext);
                }
            }

            if (root instanceof BinaryOperatorExpr) {
                // Type check binary expression
                // root.validateTypes(this.module);
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

        // Get the range of the statement line
        // console.log("Statement: ", statement.lineNumber, "emptyLine: ", emptyLine.lineNumber);
        const range = new Range(statement.lineNumber, statement.left, statement.lineNumber, statement.right);

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

    // /**
    //  * Replace the given expression with a binary operator expression with the given
    //  * expressions as one of its operands
    //  *
    //  * @param op - The binary operator to create an expression with
    //  * @param expr - The expression to replace with the binary operator expression and be placed as
    //  * an operand
    //  * @param param2 - { toLeft: boolean, toRight: boolean }: Whether to place the given expression
    //  * to the left or right of the binary operator expression
    //  * @returns The new binary operator expression
    //  */
    // private replaceWithBinaryOp(
    //     op: BinaryOperator,
    //     expr: Expression,
    //     { toLeft = false, toRight = false }
    // ): BinaryOperatorExpr {
    //     if (expr instanceof Modifier) expr = expr.rootNode as Expression;

    //     // Get the range of the current expression
    //     const initialBoundary = expr.getBoundaries();
    //     // Parent node of the current expression
    //     const root = expr.rootNode as Statement;
    //     // Index of the current expression in the parent node
    //     const index = expr.indexInRoot;

    //     // Create the binary expression in which we need to insert the given expression
    //     const newCode = new BinaryOperatorExpr(
    //         op,
    //         expr.returns, // is not that important, will be replaced in the constructor based on the operator.
    //         root,
    //         expr.indexInRoot
    //     );

    //     // If toLeft is true, set curOperand to the left operand of the new binary expression, otherwise to the right operand
    //     const curOperand = toLeft ? newCode.getLeftOperand() : newCode.getRightOperand();
    //     // Determine the other operand: this is the operand that is not the current operand
    //     const otherOperand = toLeft ? newCode.getRightOperand() : newCode.getLeftOperand();
    //     // Get whether the given expression can be inserted inserted into the current operand (position)
    //     const insertionResult = newCode.typeValidateInsertionIntoHole(expr, curOperand as TypedEmptyExpr);

    //     /**
    //      * Special cases
    //      *
    //      * if (--- + (--- + ---)|): --> attempting to insert a comparator or binary boolean operation should fail
    //      */
    //     if (insertionResult.insertionType === InsertionType.Valid) {
    //         // Check whether the given expression can be replaced by the new binary expression
    //         const replacementResult = expr.canReplaceWithConstruct(newCode);

    //         // this can never go into draft mode
    //         // If the expression can be replaced with the binary expression
    //         if (replacementResult.insertionType !== InsertionType.Invalid) {
    //             // Close the draft mode if it is enabled
    //             if (root.tokens[index].draftModeEnabled) this.module.closeConstructDraftRecord(root.tokens[index]);

    //             // Set the left operand of the new binary expression to the given expression
    //             if (toLeft) newCode.replaceLeftOperand(expr);
    //             // Set the right operand of the new binary expression to the given expression
    //             else newCode.replaceRightOperand(expr);

    //             // Set the index of the given expression in the new binary expression
    //             // based on its operaond position
    //             expr.indexInRoot = curOperand.indexInRoot;
    //             // Set the rootnode of the given expression to the new binary expression
    //             expr.rootNode = newCode;

    //             // Set the token in the given expression's parent to the new binary expression
    //             root.tokens[index] = newCode;

    //             //TODO: Call onInsertInto() on this line
    //             root.rebuild(root.getLeftPosition(), 0);

    //             // Update the Monaco editor with the new binary expression
    //             this.module.editor.executeEdits(initialBoundary, newCode);
    //             this.module.focus.updateContext({
    //                 tokenToSelect: newCode.tokens[otherOperand.indexInRoot],
    //             });

    //             // If the insertion of the given expression is valid and the given expression is in draft mode
    //             if (replacementResult.insertionType !== InsertionType.DraftMode && expr.draftModeEnabled) {
    //                 // Close the draft mode
    //                 this.module.closeConstructDraftRecord(expr);
    //             } else if (root instanceof BinaryOperatorExpr) {
    //                 // Validate the types starting from the binary root expression
    //                 // root.validateTypes(this.module);
    //             } else if (replacementResult.insertionType === InsertionType.DraftMode) {
    //                 // Given expression is in draft mode, open the draft mode
    //                 this.module.openDraftMode(newCode, replacementResult.message, [
    //                     ...replacementResult.conversionRecords.map((conversionRecord) => {
    //                         return conversionRecord.getConversionButton(newCode.getRenderText(), this.module, newCode);
    //                     }),
    //                 ]);
    //             }

    //             // Insert newcode into the root
    //             if (newCode.rootNode instanceof Statement) newCode.rootNode.onInsertInto(newCode);

    //             return newCode;
    //         }
    //     }
    // }

    // /**
    //  * Get the range starting from the first construct and ending at the last construct
    //  * NOTE: In between elements are not (explicitly) checked and and all the constructs
    //  * are assumed to be on the same line
    //  *
    //  * @param codes
    //  * @returns
    //  */
    // private getCascadedBoundary(codes: Array<CodeConstruct>): Range {
    //     // Get the range of all the constructs, assuming they are ordered according to their appearance
    //     // in the text editor
    //     if (codes.length > 1) {
    //         // Starting line number (and ending line number, because only used for list elements)
    //         const lineNumber = codes[0].getLineNumber();

    //         // Return the range from the first to the last construct
    //         return new Range(lineNumber, codes[0].left, lineNumber, codes[codes.length - 1].right);
    //         // Simply return the range of the one construct
    //     } else return codes[0].getBoundaries();
    // }

    // /**
    //  * Get the range of the entire construct, including potential body statements
    //  *
    //  * @param code - The construct to get the boundaries in the Monaco editor of
    //  * @param param1 - { selectIndex: boolean }: If the indent should be included in the selection range
    //  * @returns The range of the construct
    //  */
    // private getBoundaries(code: CodeConstruct, { selectIndent = false } = {}): Range {
    //     // Linenumber of the given construct
    //     const lineNumber = code.getLineNumber();

    //     // If the given construct has a body
    //     if (code instanceof Statement && code.hasBody()) {
    //         const stmtStack = new Array<Statement>();
    //         // Add all the body statements to the stack
    //         stmtStack.unshift(...code.body);
    //         // Initialize the end line number and column
    //         let endLineNumber = 0;
    //         let endColumn = 0;

    //         while (stmtStack.length > 0) {
    //             // Pop an element from the stack
    //             const curStmt = stmtStack.pop();

    //             // Add all its sub-statements to the stack
    //             if (curStmt instanceof Statement && curStmt.hasBody()) stmtStack.unshift(...curStmt.body);

    //             // Update the line number and column if necessary
    //             if (endLineNumber < curStmt.lineNumber) {
    //                 endLineNumber = curStmt.lineNumber;
    //                 endColumn = curStmt.right;
    //             }
    //         }

    //         // Return the range of the construct
    //         return new Range(lineNumber, code.left, endLineNumber, endColumn);
    //     } else if (code instanceof Statement || code instanceof Token) {
    //         // If the indent (one indent) has to be included in the selection range
    //         if (selectIndent) {
    //             return new Range(lineNumber, code.left - TAB_SPACES, lineNumber, code.right);
    //         } else return new Range(lineNumber, code.left, lineNumber, code.right);
    //     }
    // }

    // /**
    //  * Delete the given modifier from the editor
    //  *
    //  * @param mod - The modifier to delete
    //  * @param param1
    //  */
    // private deleteModifier(mod: Modifier, { deleting = false } = {}) {
    //     // TODO: this will be a prototype version of the code. needs to be cleaned and iterated on ->
    //     // e.g. merge the operations for VarOperationStmt and ValueOperationExpr

    //     // TODO: if deleting, should not move cursor
    //     // Get the range of the modifier to delete
    //     const removeRange = mod.getBoundaries();
    //     // The parent construct of the modifier
    //     const rootOfExprToLeft = mod.rootNode;

    //     // Remove the modifier from the parent's tokens
    //     rootOfExprToLeft.tokens.splice(mod.indexInRoot, 1);
    //     // Notify the code construct, and all its children, that it has been deleted
    //     this.module.recursiveNotify(mod, CallbackType.delete);

    //     // Close the draft mode if it is enabled
    //     this.module.closeConstructDraftRecord(rootOfExprToLeft);

    //     let built = false;
    //     let positionToMove: Position;

    //     // If only one child token is remaining (the right-hand side value or left-hand
    //     // side variable reference)
    //     if (rootOfExprToLeft.tokens.length == 1) {
    //         // only a val or var-ref is remaining:
    //         if (rootOfExprToLeft instanceof ValueOperationExpr) {
    //             rootOfExprToLeft.updateReturnType();

    //             let replacementResult = new InsertionResult(InsertionType.Valid, "", []);
    //             //     rootOfExprToLeft.rootNode.checkInsertionAtHole(
    //             //     rootOfExprToLeft.indexInRoot,
    //             //     rootOfExprToLeft.returns
    //             // );

    //             if (replacementResult.insertionType == InsertionType.DraftMode) {
    //                 const ref = rootOfExprToLeft.getVarRef();
    //                 if (ref instanceof VariableReferenceExpr) {
    //                     // const line = this.module.focus.getContext().lineStatement;

    //                     // const varType = this.module.variableController.getVariableTypeNearLine(
    //                     //     line.rootNode instanceof Module ? this.module.scope : line.scope,
    //                     //     line.lineNumber,
    //                     //     ref.identifier,
    //                     //     false
    //                     // );
    //                     const varType = DataType.Any;

    //                     let expectedTypes = rootOfExprToLeft.rootNode.typeOfHoles[rootOfExprToLeft.indexInRoot];
    //                     const currentAllowedTypes = DataType.Any;
    //                     //     rootOfExprToLeft.rootNode.getCurrentAllowedTypesOfHole(
    //                     //     rootOfExprToLeft.indexInRoot,
    //                     //     false
    //                     // );

    //                     if (currentAllowedTypes.length > 0) {
    //                         expectedTypes = currentAllowedTypes;
    //                     }

    //                     this.module.openDraftMode(
    //                         rootOfExprToLeft,
    //                         TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR(ref.identifier, varType, expectedTypes),
    //                         [
    //                             ...replacementResult.conversionRecords.map((conversionRecord) => {
    //                                 return conversionRecord.getConversionButton(
    //                                     ref.identifier,
    //                                     this.module,
    //                                     rootOfExprToLeft
    //                                 );
    //                             }),
    //                         ]
    //                     );
    //                 } else {
    //                     let expectedTypes = rootOfExprToLeft.rootNode.typeOfHoles[rootOfExprToLeft.indexInRoot];

    //                     const currentAllowedTypes = DataType.Any;
    //                     //     rootOfExprToLeft.rootNode.getCurrentAllowedTypesOfHole(
    //                     //     rootOfExprToLeft.indexInRoot,
    //                     //     false
    //                     // );

    //                     if (currentAllowedTypes.length > 0) {
    //                         expectedTypes = currentAllowedTypes;
    //                     }

    //                     this.module.openDraftMode(
    //                         ref,
    //                         TYPE_MISMATCH_ON_MODIFIER_DELETION_DRAFT_MODE_STR(
    //                             ref.getKeyword(),
    //                             ref.returns,
    //                             expectedTypes
    //                         ),
    //                         [
    //                             ...replacementResult.conversionRecords.map((conversionRecord) => {
    //                                 return conversionRecord.getConversionButton(
    //                                     ref.getKeyword(),
    //                                     this.module,
    //                                     rootOfExprToLeft
    //                                 );
    //                             }),
    //                         ]
    //                     );
    //                 }
    //             }
    //             const value = rootOfExprToLeft.tokens[0];
    //             rootOfExprToLeft.rootNode.tokens[rootOfExprToLeft.indexInRoot] = value;
    //             value.rootNode = rootOfExprToLeft.rootNode;
    //             value.indexInRoot = rootOfExprToLeft.indexInRoot;

    //             rootOfExprToLeft.rootNode.rebuild(rootOfExprToLeft.rootNode.getLeftPosition(), 0);
    //             positionToMove = new Position(value.getLineNumber(), value.right);
    //             built = true;
    //         }
    //     }

    //     if (!built) {
    //         rootOfExprToLeft.rebuild(rootOfExprToLeft.getLeftPosition(), 0);
    //         positionToMove = new Position(rootOfExprToLeft.getLineNumber(), rootOfExprToLeft.right);
    //     }

    //     this.module.editor.executeEdits(removeRange, null, "");
    //     if (!deleting) {
    //         this.module.focus.updateContext({
    //             positionToMove,
    //         });
    //     }
    // }

    /**
     * Remove the given token from the editor and update the focus context
     *
     * @param token - The token to remove
     */
    private deleteAutocompleteToken(token: Token) {
        // Get the range of the token to delete
        const range = token.getBoundaries();
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
        const replacementRange = code.getBoundaries();
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

    // /**
    //  * Remove the given Construct from the editor and update the focus context
    //  * It also replaces the construct with the correct "placeholder" construct
    //  *
    //  * @param code
    //  * @param param1
    //  */
    // /*private */deleteCode(code: CodeConstruct, { statement = false, replaceType = null } = {}) {
    //     // The parent construct of the code to delete
    //     const root = code.rootNode;
    //     // Get range of the construct to delete
    //     const replacementRange = code.getBoundaries();
    //     // The construct to replace the deleted code with
    //     let replacement: CodeConstruct;

    //     // If the construct to delete is a statement
    //     if (statement) replacement = this.module.removeStatement(code as Statement);
    //     // If the construct to delete is a expression
    //     else replacement = this.module.replaceItemWTypedEmptyExpr(code, replaceType);

    //     // Replace all characters in the Monaco editor with the replacement construct
    //     this.module.editor.executeEdits(replacementRange, replacement);
    //     // Update the focus context
    //     this.module.focus.updateContext({ tokenToSelect: replacement });

    //     // If the parent is an expression, recheck the types
    //     // if (root instanceof Expression) root.validateTypes(this.module);
    // }

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
            console.log("validateIdentifier");
            // Everything above should be replaced with the line below ... but the first
            // if block can for some weird reason not be removed without breaking the code
            // in the strangest possible way!
            // this.module.language.validateReservedWord(identifierText, focusedNode);
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

    // /**
    //  * Give styling to the autocomplete menu and update its position
    //  *
    //  * @param pos - The position to place the autocomplete menu
    //  */
    // private styleAutocompleteMenu(pos: Position) {
    //     this.module.menuController.styleMenuOptions();
    //     this.module.menuController.updatePosition(this.module.menuController.getNewMenuPositionFromPosition(pos));
    // }

    /**
     * Opens an autocomplete menu / suggestion menu at the current position.
     *
     * @param context - The current focus context
     * @param text - The current user input in case there is not yet an autocomplete token
     * @param autocompleteType - The type of the autocomplete token; used to determine how
     * to replace the existing token / construct where the autcomplete token should be
     */
    openSuggestionMenu(context: Context, text: string, autocompleteType: AutoCompleteType) {
        /**
         * Central idea:
         * There are two options: either the menu should be opened somewhere were there is
         * not yet any autocomplete token or there is already an autocomplete token present.
         * - First possibility: simply open the menu, maybe by creating a new autocomplete token
         * - Second possibility: open the autocomplete menu for the existing token
         *
         * The second case should be pretty straight forward, however the first might require
         * special logic if it should be created without creating an autocomplete token ...
         */

        let autocompleteTkn: AutocompleteTkn;

        // Check if there is already an autocomplete token present
        const existingAutocompleteTkn = context.token ?? context.tokenToLeft ?? context.tokenToRight;
        if (existingAutocompleteTkn instanceof AutocompleteTkn) {
            autocompleteTkn = existingAutocompleteTkn;

            this.openAutocompleteMenu(autocompleteTkn.validMatches);
            this.updateAutocompleteMenu(autocompleteTkn);
            // do something
        } else {
            const validMatches = this.module.actionFilter
                .getProcessedInsertionsList()
                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid);

            // Create a new autocompleteTkn
            autocompleteTkn = new AutocompleteTkn(text, autocompleteType, validMatches);

            // MOVE TO AUTOCOMPLETETKN CONSTRUCTION?
            // Update the menu whenever the text changes
            autocompleteTkn.subscribe(
                CallbackType.change,
                new Callback(
                    (() => {
                        if (!this.module.menuController.isMenuOpen()) {
                            this.openAutocompleteMenu(validMatches);
                        }

                        this.updateAutocompleteMenu(autocompleteTkn);
                    }).bind(this)
                )
            );

            // Open the autocomplete menu
            this.openAutocompleteMenu(validMatches);

            // Choose how to replace the existing token / construct
            // SHOULD BE REMOVED IN THE FUTURE AND REPLACED BY A SINGLE FUNCTION HANDLING
            // THE ABSTRACTION
            // switch (autocompleteType) {
            //     case AutoCompleteType.StartOfLine:
            //         this.replaceEmptyStatement(context.lineStatement, new TemporaryStmt(autocompleteTkn));

            //         break;

            //     case AutoCompleteType.AtEmptyOperatorHole:
            //     case AutoCompleteType.AtExpressionHole:
            //         this.insertToken(context, autocompleteTkn);

            //         break;

            //     case AutoCompleteType.RightOfExpression:
            //         this.insertToken(context, autocompleteTkn, { toLeft: true });

            //         break;
            //     case AutoCompleteType.LeftOfExpression:
            //         this.insertToken(context, autocompleteTkn, { toRight: true });

            //         break;
            // }
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // CAN THIS REPLACE THE ABOVE SWITCH CASES?
            // ARE RightOfExpreession and LeftOfExpression correctly handled?
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            ASTManupilation.insertConstruct(context, autocompleteTkn);

            // Reset the selection
            this.module.editor.cursor.setSelection(null);
            // Check if there is an exact match
            const match = autocompleteTkn.isTerminatingMatch();

            // If the match is exact, insert the construct in the editor
            if (match) {
                this.performMatchAction(match, autocompleteTkn);
            } else {
                // Else mark background of the token with a light gray / blue color
                let highlight = new ConstructHighlight(this.module.editor, autocompleteTkn, LIGHT_GRAY);

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
        }

        // if (action.data?.autoCompleteTkn) {
        //     this.openAutocompleteMenu(tkn.validMatches);

        //     this.updateAutocompleteMenu(tkn);
        // } else {
        //     // No autocomplete token is present; create a menu from scratch
        //     const validActions = this.module.actionFilter
        //         .getProcessedInsertionsList()
        //         .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid);

        //     if (validActions.length === 0) console.error("No valid actions found");

        //     this.openAutocompleteMenu(validActions);
        //     this.styleAutocompleteMenu(context.position);
        //     this.module.menuController.updateMenuOptions("");
        // }
    }
}
