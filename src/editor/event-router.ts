import { editor, IKeyboardEvent, IScrollEvent, Position } from "monaco-editor";

import * as ast from "../syntax-tree/ast";
import { Module } from "../syntax-tree/module";
import { AutoCompleteType, IdentifierRegex, InsertionType } from "./../syntax-tree/consts";
import { EditCodeAction } from "./action-filter";
import { Actions, EditActionType, InsertActionType, KeyPress } from "./consts";
import { EditAction } from "./data-types";
import { Context } from "./focus";

/**
 * Handle incoming events and route them to the corresponding action.
 */
export class EventRouter {
    module: Module;
    curPosition: Position;
    buttonClicksCount = new Map<string, number>();

    constructor(module: Module) {
        this.module = module;
        this.curPosition = module.editor.monaco.getPosition();
    }

    /**
     * Given a keyboard event, returns the corresponding action that should be executed.
     */
    getKeyAction(e: KeyboardEvent, providedContext?: Context): EditAction {
        /**
         * Get the current context
         */
        const context = providedContext ? providedContext : this.module.focus.getContext();
        /**
         * Can edits be made in the current context?
         */
        const inTextEditMode = this.module.focus.isTextEditable(context);
        /**
         * Get the current autocomplete token, if any
         */
        const contextAutocompleteTkn = context.getAutocompleteToken();
        /**
         * Checks if the cursor is currently in an autocomplete token
         */
        const inAutocompleteToken = contextAutocompleteTkn != null;

        switch (e.key) {
            // Language independent
            case KeyPress.ArrowUp: {
                // If menu is open, move up in the menu
                if (this.module.menuController.isMenuOpen()) {
                    return new EditAction(EditActionType.SelectMenuSuggestionAbove);
                    // Else select the closest token above
                } else {
                    this.executeMatchOnNavigation(contextAutocompleteTkn);

                    return new EditAction(EditActionType.SelectClosestTokenAbove);
                }
            }

            // Language independent
            case KeyPress.ArrowDown: {
                // If menu is open, move down in the menu
                if (this.module.menuController.isMenuOpen()) {
                    return new EditAction(EditActionType.SelectMenuSuggestionBelow);
                    // Else select the closest token below
                } else {
                    this.executeMatchOnNavigation(contextAutocompleteTkn);

                    return new EditAction(EditActionType.SelectClosestTokenBelow);
                }
            }

            // Simplify if the nested if does not work
            // Language independent
            case KeyPress.ArrowLeft: {
                // if (!inTextEditMode && !inAutocompleteToken && this.module.menuController.isMenuOpen()) {
                //     // Not useful anymore as there are no submenus anymore
                //     return new EditAction(EditActionType.CloseSubMenu);
                // } else
                if (inTextEditMode) {
                    // Move to the token before the current text editable token
                    if (this.module.validator.canMoveToPrevTokenAtTextEditable(context)) {
                        return new EditAction(EditActionType.SelectPrevToken);
                    }

                    // IS THIS EVEN WORKING? (for all cases...)
                    if (e.shiftKey && e.ctrlKey) return new EditAction(EditActionType.SelectToStart);
                    else if (e.shiftKey) return new EditAction(EditActionType.SelectLeft);
                    else if (e.ctrlKey) return new EditAction(EditActionType.MoveCursorStart);
                    else {
                        this.executeMatchOnNavigation(context.tokenToRight);

                        return new EditAction(EditActionType.MoveCursorLeft);
                    }
                    // Not in text edit mode -> simply select the previous token
                } else return new EditAction(EditActionType.SelectPrevToken);
            }

            // Simplify if the nested if does not work
            // Language independent
            case KeyPress.ArrowRight: {
                // if (!inTextEditMode && !inAutocompleteToken && this.module.menuController.isMenuOpen()) {
                //     // Not useful anymore as there are no submenus anymore
                //     return new EditAction(EditActionType.OpenSubMenu);
                // } else
                if (inTextEditMode) {
                    // Move to the token after the current text editable token
                    if (this.module.validator.canMoveToNextTokenAtTextEditable(context)) {
                        return new EditAction(EditActionType.SelectNextToken);
                    }

                    // IS THIS EVEN WORKING? (for all cases...)
                    if (e.shiftKey && e.ctrlKey) return new EditAction(EditActionType.SelectToEnd);
                    else if (e.shiftKey) return new EditAction(EditActionType.SelectRight);
                    else if (e.ctrlKey) return new EditAction(EditActionType.MoveCursorEnd);
                    else {
                        this.executeMatchOnNavigation(context.tokenToLeft);

                        return new EditAction(EditActionType.MoveCursorRight);
                    }
                    // Not in text edit mode -> simply select the next token
                } else return new EditAction(EditActionType.SelectNextToken);
            }

            // Language independent
            case KeyPress.Home: {
                if (inTextEditMode) {
                    // Move cursor to the start of the current line
                    // But this should do nothing ... how can this be ...?
                    if (e.shiftKey) return new EditAction(EditActionType.SelectToStart);
                    // NYI
                    else return new EditAction(EditActionType.MoveCursorStart);
                }

                break;
            }

            // Language independent
            case KeyPress.End: {
                if (inTextEditMode) {
                    // Idem
                    if (e.shiftKey) return new EditAction(EditActionType.SelectToEnd);
                    else return new EditAction(EditActionType.MoveCursorEnd);
                }

                break;
            }

            // language independent
            /**
             * Bug:
             * * When the cursor is on an empty next line after a print and the backspace is pressed,
             * the ')' of the print statement is removed while the cursor should simply jump to the end
             * of the previous line.
             */
            case KeyPress.Delete: {
                /**
                 * Handle the indentation of constructs, including the editor and the AST
                 *
                 * @param backwards - True if the indentation should be performed backwards,
                 * false if forwards
                 */
                // const backwards = e.key === KeyPress.Backspace;

                /**
                 * Step by step description of how deletion is handled:
                 * * If the current construct is an empty line contained in a body consisting of more than
                 *   one line and it is not the last line, then we can remove the current line.
                 * * If the current line is not empty and the cursor is at the beginning of the line, then
                 *   remove the statement at the current line.
                 *      Extra considerations:
                 *       - If the current focus is in an editable text, then the statement is only removed
                 *         if the editable text is empty
                 *       - Otherwise the line can be removed directly
                 * * If the token to the right of the current position is non-editable, then remove the entire
                 *   construct containing the token.
                 * * if the current focus is in an editable text and there is no token to the right of the current
                 *   (aka there is editable text to the right), then the next character is removed.
                 * * If there is an expression to the right of the current position, then remove the expression.
                 * * If the current token is empty, then ... (TODO)
                 */

                // console.log("DELETE");
                // console.log("Token to left", context.tokenToLeft);
                // console.log("Token to right", context.tokenToRight);
                // console.log("Current token", context.token);
                // console.log("Expression to left", context.expressionToLeft);
                // console.log("Expression to right", context.expressionToRight);
                // console.log("Current expression", context.expression);

                if (this.module.validator.canDeleteEmptyLine(context, { backwards: false })) {
                    return new EditAction(EditActionType.DeleteEmptyLine);
                } else if (this.module.validator.canDeleteNextStmt(context)) {
                    return new EditAction(EditActionType.DeleteStmt);
                } else if (this.module.validator.canDeleteNextTkn(context)) {
                    // Token to the right of the current position is non-editable
                    return new EditAction(EditActionType.DeleteRootOfToken, { backwards: false });
                } else if (this.module.validator.canDeleteAdjacentChar(context, { backwards: false })) {
                    // Free text edit mode with editable text to the right
                    if (e.ctrlKey) {
                        return new EditAction(EditActionType.DeleteToEnd); // Not implemented?
                    } else {
                        return new EditAction(EditActionType.DeleteNextChar);
                    }
                } else if (this.module.validator.isTknEmpty(context)) {
                    // Not the same as "atEmptyExpressionHole"; the second one does not work for e.g. "print(...)"
                    // SHOULD BE MERGED INTO ONE IN THE FUTURE
                    if (context.token.rootNode instanceof ast.GeneralExpression) {
                        if (this.module.validator.canDeleteExpression(context)) {
                            return new EditAction(EditActionType.DeleteRootNode);
                        }
                        return new EditAction(EditActionType.ReplaceExpressionWithItem);
                    }
                    if (context.token.rootNode instanceof ast.GeneralStatement) {
                        if (this.module.validator.canDeleteStatement(context)) {
                            return new EditAction(EditActionType.DeleteStatement);
                        }
                    }
                }

                break;
                // if (
                //     false
                //     // inTextEditMode &&
                //     // !(context.tokenToRight instanceof ast.NonEditableTkn) &&
                //     // !context.tokenToRight?.isEmpty
                // ) {
                //     console.log("In text edit mode", context.tokenToRight, context.tokenToRight?.isEmpty);
                //     // Currently left as this is sort of a shortcut and thus general
                //     if (e.ctrlKey) return new EditAction(EditActionType.DeleteToEnd); // Not implemented?
                //     else return new EditAction(EditActionType.DeleteNextChar);
                //     // } else if (this.module.validator.canDeleteNextFStringCurlyBrackets(context)) {
                //     //     return new EditAction(EditActionType.DeleteFStringCurlyBrackets, {
                //     //         item: context.expressionToRight,
                //     //     });
                //     // } else if (this.module.validator.canDeleteSelectedFStringCurlyBrackets(context)) {
                //     //     return new EditAction(EditActionType.DeleteFStringCurlyBrackets, {
                //     //         item: context.token.rootNode,
                //     //     });
                //     // See first if case
                //     // } else if (this.module.validator.canDeleteStringLiteral(context)) {
                //     //     console.log("CASES: string literal");
                //     //     return new EditAction(EditActionType.DeleteStringLiteral);
                // } else if (this.module.validator.canDeleteNextStatement(context)) {
                //     return new EditAction(EditActionType.DeleteStatement);
                // } else if (this.module.validator.canDeleteNextMultilineStatement(context)) {
                //     return new EditAction(EditActionType.DeleteMultiLineStatement);
                // } else if (this.module.validator.canDeleteCurLine(context)) {
                //     console.log("Is it me?");
                //     return new EditAction(EditActionType.DeleteEmptyLine);
                //     // Temporary disabled; check later!
                // } else if (this.module.validator.canDeleteNextToken(context)) {
                //     return new EditAction(EditActionType.DeleteNextToken);
                // } else if (this.module.validator.canDeleteListItemToLeft(context)) {
                //     console.log("It can not possibly be me?");
                //     return new EditAction(EditActionType.DeleteListItem, {
                //         toLeft: true,
                //     });
                //     // } else if (this.module.validator.canDeleteListItemToRight(context)) {
                //     //     return new EditAction(EditActionType.DeleteListItem, {
                //     //         toRight: true,
                //     //     });
                // } else if (this.module.validator.isTknEmpty(context)) {
                //     if (this.module.validator.isAugmentedAssignmentModifierStatement(context)) {
                //         return new EditAction(EditActionType.DeleteStatement);
                //     }
                //     if (context.token.rootNode instanceof ast.Expression) {
                //         if (this.module.validator.canDeleteExpression(context)) {
                //             return new EditAction(EditActionType.DeleteRootNode);
                //         }
                //         return new EditAction(EditActionType.ReplaceExpressionWithItem);
                //     }
                //     if (context.token.rootNode instanceof ast.Statement) {
                //         if (this.module.validator.canDeleteStatement(context)) {
                //             console.log("It certainly is this one");
                //             return new EditAction(EditActionType.DeleteStatement);
                //         }
                //     }
                // }

                break;
            }

            // NOT language independent
            case KeyPress.Backspace: {
                if (this.module.validator.canDeleteAdjacentChar(context, { backwards: true })) {
                    // Delete char in front of the cursor in a text editable area
                    if (e.ctrlKey) return new EditAction(EditActionType.DeleteToStart);
                    else return new EditAction(EditActionType.DeletePrevChar);
                } else if (this.module.validator.canMoveLeftOnEmptyMultilineStatement(context)) {
                    // When on the first line of the body, move to the previous token
                    // if it is empty
                    console.log("CASES: empty multiline statement");
                    return new EditAction(EditActionType.SelectPrevToken);
                } else if (this.module.validator.canDeletePrevStmt(context)) {
                    // Delete the statement right before the current position, if any
                    console.log("CASES: prev statement");
                    return new EditAction(EditActionType.DeleteStmt);
                } else if (this.module.validator.canDeleteBackMultiEmptyLines(context)) {
                    // When the cursor is on an empty line and all lines behind it are empty without
                    // a depending construct thereafter, delete all empty lines
                    console.log("CASES: back multi empty lines");
                    return new EditAction(EditActionType.DeleteBackMultiLines);
                } else if (this.module.validator.canDeletePrevLine(context)) {
                    // When the line above is an empty line construct, it can be deleted
                    console.log("CASES: prev line");
                    return new EditAction(EditActionType.DeletePrevLine);
                } else if (this.module.validator.canIndentBack(context)) {
                    // When the cursor is at the beginning of a line and there is something
                    // on the line before, indent the current line back
                    console.log("CASES: indent back");
                    return new EditAction(EditActionType.IndentBackwards);
                    // } else if (this.module.validator.canDeletePrevToken(context)) {
                } else if (this.module.validator.canDeletePrevTkn(context)) {
                    console.log("CASES: prev token");
                    // return new EditAction(EditActionType.DeletePrevToken);
                    return new EditAction(EditActionType.DeleteRootOfToken, { backwards: true });
                } else if (this.module.validator.canDeleteEmptyLine(context, { backwards: true })) {
                    // } else if (this.module.validator.canBackspaceCurEmptyLine(context)) {
                    console.log("CASES: cur empty line");
                    return new EditAction(EditActionType.DeleteEmptyLine, {
                        pressedBackspace: true,
                    });
                    // } else if (this.module.validator.canDeleteListItemToLeft(context)) {
                    //     return new EditAction(EditActionType.DeleteListItem, {
                    //         toLeft: true,
                    //     });
                    // } else if (this.module.validator.canDeleteListItemToRight(context)) {
                    //     return new EditAction(EditActionType.DeleteListItem, {
                    //         toRight: true,
                    //     });
                } else if (this.module.validator.isTknEmpty(context)) {
                    console.log("CASES: token is empty");
                    // if (this.module.validator.isAugmentedAssignmentModifierStatement(context)) {
                    //     return new EditAction(EditActionType.DeleteStatement);
                    // }
                    if (context.token.rootNode instanceof ast.GeneralExpression) {
                        if (this.module.validator.canDeleteExpression(context)) {
                            return new EditAction(EditActionType.DeleteRootNode);
                        }
                        return new EditAction(EditActionType.ReplaceExpressionWithItem);
                    }
                    if (context.token.rootNode instanceof ast.Statement) {
                        if (this.module.validator.canDeleteStatement(context)) {
                            return new EditAction(EditActionType.DeleteStatement);
                        }
                    }
                    // Maybe useful later?
                    // } else if (this.module.validator.shouldDeleteVarAssignmentOnHole(context)) {
                    //     console.log("CASES: var assignment on hole");
                    //     return new EditAction(EditActionType.DeleteStatement);
                    // Maybe useful later?
                    // } else if (this.module.validator.shouldDeleteHole(context)) {
                    //     console.log("CASES: hole");
                    //     return new EditAction(EditActionType.DeleteSelectedModifier);
                }

                break;
            }

            // Language independent
            case KeyPress.Tab: {
                if (this.module.validator.canIndentForward(context)) {
                    return new EditAction(EditActionType.IndentForwards);
                }
                // else if (this.module.validator.canIndentForwardIfStatement(context)) {
                //     return new EditAction(EditActionType.IndentForwardsIfStmt);
                // }

                break;
            }

            // Language independent
            case KeyPress.Enter: {
                // If the menu is open, select the current suggestion
                if (this.module.menuController.isMenuOpen()) return new EditAction(EditActionType.SelectMenuSuggestion);
                // If an empty line can be inserted, insert an empty line
                else if (this.module.validator.canInsertEmptyLine()) {
                    return new EditAction(EditActionType.InsertEmptyLine);
                }

                break;
            }

            // Language independent
            case KeyPress.Escape: {
                // If the menu is open
                if (this.module.menuController.isMenuOpen()) {
                    // Check if one of the options is an exact match
                    // If so, perform the corresponding action
                    this.executeMatchOnNavigation(contextAutocompleteTkn);

                    // Close the menu
                    return new EditAction(EditActionType.CloseValidInsertMenu);
                } else {
                    // Check for any draft mode nodes
                    const draftModeNode = this.module.focus.getContainingDraftNode(context);

                    if (draftModeNode) {
                        // If any draft mode nodes are found, close the draft mode
                        return new EditAction(EditActionType.CloseDraftMode, {
                            codeNode: draftModeNode,
                        });
                    }
                }

                break;
            }

            // Language independent
            case KeyPress.Space: {
                // If not in text edit mode, open the autocomplete menu / options menu
                if (e.ctrlKey && e.key.length == 1) {
                    if (context.tokenToLeft instanceof ast.AutocompleteTkn) {
                        return new EditAction(EditActionType.OpenValidInsertMenu, {
                            autoCompleteTkn: context.tokenToLeft
                        });
                    } else {
                        return new EditAction(EditActionType.OpenValidInsertMenu);
                    }
                }
                console.log("We should not be able to get here");
                // If in text edit mode, insert a space
                if (inTextEditMode) return new EditAction(EditActionType.InsertChar);

                break;
            }

            // NOT language independent
            default: {
                // Should be the printable characters (excluding things like arrow keys etc)
                if (e.key.length == 1) {
                    if (inTextEditMode) {
                        // Handle flow control keys (Not currently implemented)
                        switch (e.key) {
                            // Are any of these implemented?
                            case KeyPress.C:
                                if (e.ctrlKey) return new EditAction(EditActionType.Copy);

                                break;

                            case KeyPress.V:
                                if (e.ctrlKey) return new EditAction(EditActionType.Paste);

                                break;

                            case KeyPress.Z:
                                if (e.ctrlKey) return new EditAction(EditActionType.Undo);

                                break;

                            case KeyPress.Y:
                                if (e.ctrlKey) return new EditAction(EditActionType.Redo);

                                break;
                        }

                        // Check if a sequence of sequence of characters, e.g. abc, can be converted to a string
                        // At least, I think ...
                        if (this.module.validator.canConvertAutocompleteToString(context)) {
                            // String literals
                            return new EditAction(EditActionType.ConvertAutocompleteToString, {
                                token: context.tokenToRight,
                            });
                        }

                        // If a key is being pressed right after a number literal, check if
                        // the new literal is not part of the literal (e.g. 12+) and if so
                        // open the autocomplete menu
                        // if (this.module.validator.canSwitchLeftNumToAutocomplete(e.key)) {
                        //     return new EditAction(EditActionType.OpenAutocomplete, {
                        //         autocompleteType: AutoCompleteType.RightOfExpression,
                        //         firstChar: e.key,
                        //         validMatches: this.module.actionFilter
                        //             .getProcessedInsertionsList()
                        //             .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        //     });
                        //     // Idem but now for (+12)
                        // } else if (this.module.validator.canSwitchRightNumToAutocomplete(e.key)) {
                        //     return new EditAction(EditActionType.OpenAutocomplete, {
                        //         autocompleteType: AutoCompleteType.LeftOfExpression,
                        //         firstChar: e.key,
                        //         validMatches: this.module.actionFilter
                        //             .getProcessedInsertionsList()
                        //             .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        //     });
                        //     // Else just simply insert the character
                        // } else 
                        // PREVIOUS DISABLED BECAUSE IT USED A CHECK SPECIFICALLY FOR LITERALVALEXPR WHICH DOES NOT EXIST
                        // ANYMORE; CHECK LATER IF THIS CAN BE DELETED
                        return new EditAction(EditActionType.InsertChar);
                        // If at a slot where an operator token is expected, e.g. 1 ... 15
                    } else if (this.module.validator.atEmptyOperatorTkn(context)) {
                        // Return the autocomplete menu for the operator token
                        return new EditAction(EditActionType.OpenAutocomplete, {
                            autocompleteType: AutoCompleteType.AtEmptyOperatorHole,
                            firstChar: e.key,
                            validMatches: this.module.actionFilter
                                .getProcessedInsertionsList()
                                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        });
                        // If at an expression hole, the "---" in the editor
                    } else if (this.module.validator.atEmptyExpressionHole(context)) {
                        // HEU IS THIS NECESSARY?
                        // [...Actions.instance().actionsMap.values()].filter(
                        //     (action) => !(action.getCode() as ast.GeneralStatement).hasSubValues
                        // );
                        // If the pressed character is a number
                        // if (["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].indexOf(e.key) > -1) {
                        //     // Insert the number literal
                        //     return new EditAction(EditActionType.InsertLiteral, {
                        //         literalType: DataType.Number,
                        //         initialValue: e.key,
                        //     });
                        //     // If the pressed character is a double quote
                        // } else if (['"'].indexOf(e.key) > -1) {
                        //     // Insert the string literal
                        //     return new EditAction(EditActionType.InsertLiteral, {
                        //         literalType: DataType.String,
                        //     });
                        // } else {
                        // Else open the autocomplete menu
                        return new EditAction(EditActionType.OpenAutocomplete, {
                            autocompleteType: AutoCompleteType.AtExpressionHole,
                            firstChar: e.key,
                            validMatches: this.module.actionFilter
                                .getProcessedInsertionsList()
                                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        });
                        // }
                        // If on an empty line and the identifier regex matches the pressed character
                    } else if (this.module.validator.onEmptyLine(context) && IdentifierRegex.test(e.key)) {
                        // Open the autocomplete menu
                        return new EditAction(EditActionType.OpenAutocomplete, {
                            autocompleteType: AutoCompleteType.StartOfLine,
                            firstChar: e.key,
                            validatorRegex: IdentifierRegex,
                            validMatches: this.module.actionFilter
                                .getProcessedInsertionsList()
                                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        });
                        // If at the right of an expresssion and a single character key is pressed
                    } else if (this.module.validator.atRightOfExpression(context)) {
                        // Open the autocomplete menu starting from all possible matches
                        return new EditAction(EditActionType.OpenAutocomplete, {
                            autocompleteType: AutoCompleteType.RightOfExpression,
                            firstChar: e.key,
                            validMatches: this.module.actionFilter
                                .getProcessedInsertionsList()
                                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        });
                        // Idem but now the cursor is at the left of an expression
                    } else if (this.module.validator.atLeftOfExpression(context)) {
                        return new EditAction(EditActionType.OpenAutocomplete, {
                            autocompleteType: AutoCompleteType.LeftOfExpression,
                            firstChar: e.key,
                            validMatches: this.module.actionFilter
                                .getProcessedInsertionsList()
                                .filter((item) => item.insertionResult.insertionType != InsertionType.Invalid),
                        });
                    }
                }
            }
        }

        // No edit action could be matched
        return new EditAction(EditActionType.None);
    }

    /**
     * Given the event, finds the corresponding action and executes this action. Can also prevent the default
     * event from being triggered depending on the return value of the action execution.
     *
     * @param e - The keyboard event
     */
    onKeyDown(e: IKeyboardEvent) {
        // Current context
        const context = this.module.focus.getContext();
        // Get the EditAction corresponding to the event
        const action = this.getKeyAction(e.browserEvent, context);

        // If there is data, set its source to "keyboard"
        if (action?.data) action.data.source = { type: "keyboard" };

        // Execute the action and prevent the default event from being triggered if necessary
        const preventDefaultEvent = this.module.executer.execute(action, context, e.browserEvent);

        if (preventDefaultEvent) {
            // Prevents the keystroke from performing its normal functionality (e.g. commands)
            e.preventDefault();
            e.stopPropagation();
        }
    }

    /**
     * Actions that should be performed when the cursor position has changed.
     * This includes inserting all exact matching and open autocompletes and
     * updating the current position.
     *
     * @param e - An event describing how the cursor position has changed
     */
    onCursorPosChange(e: editor.ICursorPositionChangedEvent) {
        // If the event originates from a mouse click
        if (e.source === "mouse") {
            // Get the context at the old position
            const context = this.module.focus.getContext(this.curPosition);
            // Return the current / adjacent autocomplete token, if any
            const contextAutocompleteTkn = context.getAutocompleteToken();

            // If an exact match is found, perform the corresponding action
            // Thus if you were completing something like "print", then it
            // will try to insert it when moving away
            this.executeMatchOnNavigation(contextAutocompleteTkn, context);

            // Update the position to the new position
            this.module.focus.navigatePos(e.position);
        }

        // this.module.focus.updateCurPosition(e.position);
        // Update the current position
        this.curPosition = e.position;
    }

    /**
     * Handle a scroll event accordingly
     *
     * @param e - An event describing how the editor has been scrolled
     */
    onDidScrollChange(e: IScrollEvent) {
        // Change the scroll in the editor
        this.module.editor.scrollOffsetTop = e.scrollTop;
        // Update the position of the open menu
        this.module.menuController.updateFocusedMenuScroll(e.scrollTop);
    }

    /**
     * When a toolbox button is clicked, perform the corresponding action
     *
     * @param id - The id of the button that was clicked
     */
    onButtonDown(id: string) {
        // Get current context
        const context = this.module.focus.getContext();

        // If the button is disabled, do nothing
        if ((document.getElementById(id) as HTMLButtonElement).disabled) return;

        // If the button is a variable reference button, insert the corresponding variable reference
        // if (this.module.variableController.isVariableReferenceButton(id)) {
        //     this.module.executer.insertVariableReference(id, { type: "defined-variables" }, context);
        //     this.incrementButtonClicks("insert-var");
        // } else {

        // Get the EditCodeAction corresponding to the button
        const action = Actions.instance().actionsMap.get(id);

        // If an action is found
        if (action) {
            // Execute the action
            this.module.executer.execute(this.routeToolboxEvents(action, context, { type: "toolbox" }), context);

            // Increment the number of button clicks
            this.incrementButtonClicks(id);
        }
        // }

        // Reset the search box in the toolbox
        (document.getElementById("toolbox-search-box") as HTMLInputElement).value = "";

        // Update the toolbox
        this.module.toolboxController.updateToolbox();
    }

    /**
     * When clicked on a button, increment the number of clicks and show a typing message
     *
     * @param id - The id of the button that was clicked
     */
    incrementButtonClicks(id: string) {
        // If the button has a count, increment the number of clicks
        if (this.buttonClicksCount.has(id)) this.buttonClicksCount.set(id, this.buttonClicksCount.get(id) + 1);
        // Else set the number of clicks to 1
        else this.buttonClicksCount.set(id, 1);

        // If the button has been clicked twice, show a typing message
        // and reset the number of clicks
        if (this.buttonClicksCount.get(id) == 2) {
            this.buttonClicksCount.set(id, 0);

            //TODO: variables should be checked separately
            if (Actions.instance().actionsMap.has(id)) {
                const action = Actions.instance().actionsMap.get(id);
                this.module.notificationManager.showTypingMessage(action);
            }
        }
    }

    /**
     * Performed on a button click in the toolbox, routes the event to the corresponding action
     * while performing checks on the EditCodeAction
     *
     * @param e - An EditCodeAction to check for validity
     * @param context - The current context
     * @param source - The source of the EditCodeAction
     * @returns - The corresponding EditAction
     */
    routeToolboxEvents(e: EditCodeAction, context: Context, source: {}): EditAction {
        switch (e.insertActionType) {
            case InsertActionType.InsertGeneralStmt:
                /**
                 * Purpose is to try to
                 * 1) Include all statements under this type
                 * 2) Try to include also all expressions under this type (though this might be
                 * under a different case initially)
                 * 3) If all constructs are contained under this case, try to remove it as there is no longer a
                 * necessity for different cases
                 *
                 * It can be created in multiple ways, but is only used here in the switch statement
                 *
                 * TODO: Is the if statement really necessary? Do we need to check if the context is valid?
                 */
                const statement = e.getCode(); // Should be replaced with the construct object in the future
                if (statement.validateContext(this.module.validator, context) === InsertionType.Valid) {
                    return new EditAction(EditActionType.InsertGeneralStmt, {
                        construct: statement,
                        source,
                    });
                }
                break;

            case InsertActionType.InsertGeneralExpr:
                const expression = e.getCode();
                if (expression.validateContext(this.module.validator, context) !== InsertionType.Invalid) {
                    return new EditAction(EditActionType.InsertGeneralExpr, {
                        construct: expression,
                        source,
                    });
                }
                break;

            case InsertActionType.InsertBinaryExpr: {
                if (this.module.validator.atRightOfExpression(context)) {
                    return new EditAction(EditActionType.InsertBinaryOperator, {
                        toRight: true,
                        operator: e.insertData?.operator,
                        source,
                    });
                } else if (this.module.validator.atLeftOfExpression(context)) {
                    return new EditAction(EditActionType.InsertBinaryOperator, {
                        toLeft: true,
                        operator: e.insertData?.operator,
                        source,
                    });
                } else if (this.module.validator.atEmptyExpressionHole(context)) {
                    return new EditAction(EditActionType.InsertBinaryOperator, {
                        replace: true,
                        operator: e.insertData?.operator,
                        source,
                    });
                }

                break;
            }

            case InsertActionType.InsertUnaryExpr: {
                if (this.module.validator.atLeftOfExpression(context)) {
                    return new EditAction(EditActionType.InsertUnaryOperator, {
                        wrap: true,
                        operator: e.insertData?.operator,
                        source,
                    });
                } else if (this.module.validator.atEmptyExpressionHole(context)) {
                    return new EditAction(EditActionType.InsertUnaryOperator, {
                        replace: true,
                        operator: e.insertData?.operator,
                        source,
                    });
                }

                break;
            }

            // case InsertActionType.InsertListLiteral: {
            //     if (this.module.validator.atLeftOfExpression(context)) {
            //         return new EditAction(EditActionType.WrapExpressionWithItem, {
            //             expression: new ast.ListLiteralExpression(),
            //             source,
            //         });
            //     } else if (this.module.validator.atEmptyExpressionHole(context)) {
            //         return new EditAction(EditActionType.InsertEmptyList, { source });
            //     }

            //     break;
            // }

            case InsertActionType.InsertCastStrExpr: {
                if (this.module.validator.atLeftOfExpression(context)) {
                    return new EditAction(EditActionType.WrapExpressionWithItem, { expression: e.getCode(), source });
                } else if (this.module.validator.atEmptyExpressionHole(context)) {
                    return new EditAction(EditActionType.InsertExpression, {
                        expression: e.getCode(),
                        source,
                    });
                }

                break;
            }

            // case InsertActionType.InsertListItem: {
            //     if (this.module.validator.canAddListItemToRight(context)) {
            //         return new EditAction(EditActionType.InsertEmptyListItem, {
            //             toRight: true,
            //             source,
            //         });
            //     } else if (this.module.validator.canAddListItemToLeft(context)) {
            //         return new EditAction(EditActionType.InsertEmptyListItem, {
            //             toLeft: true,
            //             source,
            //         });
            //     }

            //     this.module.editor.monaco.focus();

            //     break;
            // }

            case InsertActionType.InsertVarOperationStmt: {
                return new EditAction(EditActionType.InsertStatement, {
                    statement: e.getCode(),
                    source,
                });
            }

            case InsertActionType.InsertValOperationExpr: {
                return new EditAction(EditActionType.InsertExpression, {
                    expression: e.getCode(),
                    source,
                });
            }

            case InsertActionType.InsertOperatorTkn: {
                return new EditAction(EditActionType.InsertOperatorTkn, {
                    operator: e.getCode(),
                    source,
                });
            }
        }

        return new EditAction(EditActionType.None);
    }

    /**
     * Check for an exact match for the current autocomplete text and perform the corresponding action
     * if a match is found. Otherwise, if the token is not an autocomplete token or there is no match,
     * do nothing.
     *
     * @param token - The current token
     * @param providedContext - The current context
     */
    private executeMatchOnNavigation(token: ast.Token, providedContext?: Context) {
        // Get the current context
        const context = providedContext ?? this.module.focus.getContext();

        // If the current token is an autocomplete token
        if (token && token instanceof ast.AutocompleteTkn) {
            // Get the exact matching EditCodeAction for the current text of the autocomplete token,
            // if any
            const match = token.isMatch();

            // If there is a(n exact) match, perform the corresponding action
            if (match) {
                match.performAction(
                    this.module.executer,
                    this.module.eventRouter,
                    context,
                    { type: "autocomplete", precision: "1", length: match.matchString.length + 1 },
                    {
                        identifier: token.text,
                    }
                );
            }
        }
    }
}
