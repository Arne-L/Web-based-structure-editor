import { AutocompleteTkn, CodeConstruct, EditableTextTkn, EmptyLineStmt, IdentifierTkn, NonEditableTkn, Statement, HoleTkn, } from "../syntax-tree/ast";
import { Module } from "../syntax-tree/module";
import { isImportable } from "../utilities/util";
/**
 * Class aggregating methods that determine if a certain action is allowed
 */
export class Validator {
    module;
    constructor(module) {
        this.module = module;
    }
    /**
     * determines if the given operator could be replaced with the selected emptyBinaryOperator
     * logic: based on previous op + newly inserted op + left/right operands
     * will not add/change draft modes
     */
    /**
     * Determines if the existing operator can be replaced with the given operator (e.g. "False [] True" -> "False and True")
     *
     * @param operator - the operator to replace the existing operator with
     * @param providedContext - the context to use for the validation. If not provided, the current context will be used
     * @returns - true if the operator can be replaced or if there is none, false otherwise
     */
    canInsertOp(operator, providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const operatorExpr = context.token?.rootNode;
        // All the following code is to check typing compatibility
        // if (operatorExpr instanceof BinaryOperatorExpr) {
        //     const leftOperand = operatorExpr.getLeftOperand();
        //     const rightOperand = operatorExpr.getRightOperand();
        //     const leftOperandCurType = leftOperand instanceof Expression ? leftOperand.returns : null;
        //     const rightOperandCurType = rightOperand instanceof Expression ? rightOperand.returns : null;
        //     if (operatorExpr.operatorCategory === OperatorCategory.Arithmetic) {
        //         if (leftOperandCurType === DataType.String || rightOperandCurType === DataType.String) {
        //             return operator === BinaryOperator.Add;
        //         } else return arithmeticOps.indexOf(operator) !== -1;
        //     } else if (operatorExpr.operatorCategory === OperatorCategory.Comparison) {
        //         return comparisonOps.indexOf(operator) !== -1;
        //     } else if (operatorExpr.operatorCategory === OperatorCategory.Boolean) {
        //         return boolOps.indexOf(operator) !== -1;
        //     }
        // }
        return true;
    }
    /**
     * Checks if the current position is at the start of a linestatement
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current position is at the start of a line, false otherwise
     */
    onBeginningOfLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return context.position.column == context.codeConstruct.leftCol;
    }
    /**
     * Checks if context.lineStatement is an empty line
     */
    /**
     * Checks if the current line is an empty line
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current line is an empty line, false otherwise
     */
    onEmptyLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return context.codeConstruct instanceof EmptyLineStmt;
    }
    /**
     * logic: checks if at the end of an editable text
     * OR selected an empty editable text / identifier
     * OR right before an editable item and need to select it
     */
    canMoveToNextTokenAtTextEditable(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (((context.tokenToRight instanceof IdentifierTkn || context.tokenToRight instanceof EditableTextTkn) &&
            context.tokenToRight.isEmpty) ||
            context.tokenToLeft instanceof EditableTextTkn || // Why is it to the left?
            context.tokenToLeft instanceof IdentifierTkn ||
            (context.token?.isEmpty && context.selected));
    }
    /**
     * logic: checks if at the beginning of an editable text
     * OR selected an empty editable text / identifier
     */
    canMoveToPrevTokenAtTextEditable(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return ((context.tokenToLeft instanceof IdentifierTkn && context.tokenToRight.isEmpty) || // Left and right?
            context.tokenToRight instanceof EditableTextTkn || // Again?
            context.tokenToRight instanceof IdentifierTkn ||
            (context.token?.isEmpty && context.selected));
    }
    /**
     * Determines if an empty line can be inserted at the current position.
     * For this function to return true, the position should be at the start or end of a line and
     * nothing should be selected.
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if at the current position, you can insert an empty line, false otherwise
     */
    canInsertEmptyLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curPosition = this.module.editor.monaco.getPosition();
        return (!context.selected &&
            (curPosition.column == context.codeConstruct.leftCol ||
                curPosition.column == context.codeConstruct.rightCol));
    }
    /**
     * logic: checks if currently at an empty line.
     * AND is not the only line of the body of a compound statement or Module.
     * AND is not the last line (in the Module or in a compound statement)
     */
    canDeleteCurLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        // If on an empty line
        if (context.codeConstruct instanceof EmptyLineStmt) {
            return ((context.codeConstruct.rootNode instanceof Statement ||
                context.codeConstruct.rootNode instanceof Module) &&
                context.codeConstruct.rootNode.body.length != 1 && // So rootNode.body.length > 1
                context.codeConstruct.indexInRoot != context.codeConstruct.rootNode.body.length - 1 // Can not be the last line
            );
        }
        return false;
    }
    /**
     * Closely related to {@link canDeleteCurLine}. Checks if the current line is an
     * empty line and if it is not the only line in the body of the compound statement / module.
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if backspace is allowed, false otherwise
     */
    canBackspaceCurEmptyLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (context.codeConstruct instanceof EmptyLineStmt) {
            return ((context.codeConstruct.rootNode instanceof Statement ||
                context.codeConstruct.rootNode instanceof Module) &&
                context.codeConstruct.rootNode.body.length != 1 &&
                context.codeConstruct.lineNumber != 1);
        }
        return false;
    }
    /**
     * Check if the previous line is an empty line construct that can be remvoed
     *
     * logic: checks if the above line is an empty line.
     * AND should be at the beginning of the line.
     */
    canDeletePrevLine(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curPosition = this.module.editor.monaco.getPosition();
        return curPosition.column == context.codeConstruct.leftCol && this.getLineAbove() instanceof EmptyLineStmt;
    }
    /**
     * logic: checks if at the beginning of a statement, and not text editable.
     * the statement must NOT have a body
     */
    canDeleteNextStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        // Cursor position should be at the beginning of a non-empty line without a body
        if (!(context.codeConstruct instanceof EmptyLineStmt) &&
            this.module.focus.onBeginningOfLine() &&
            !context.codeConstruct.hasBody()) {
            // If the statement is text editable (e.g. autocomplete)
            if (this.module.focus.isTextEditable(providedContext)) {
                // if the next token is empty, return true (otherwise there are characters that should be deleted first)
                if (context.tokenToRight.isEmpty)
                    return true;
                else
                    return false;
                // Else always true
            }
            else
                return true;
        }
        return false;
    }
    /**
     * logic: checks if at the beginning of a statement, and not text editable.
     * the statement must HAVE a body
     */
    canDeleteNextMultilineStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        // Idem to {@link canDeleteNextStatement} but with the third condition being that the statement has a body
        // instead of not having a condition
        if (!(context.codeConstruct instanceof EmptyLineStmt) &&
            this.module.focus.onBeginningOfLine() &&
            context.codeConstruct.hasBody()) {
            if (this.module.focus.isTextEditable(providedContext)) {
                if (context.tokenToRight.isEmpty)
                    return true;
                else
                    return false;
            }
            else
                return true;
        }
        return false;
    }
    /**
     * logic: checks if at the beginning of a multiline statement
     */
    canMoveLeftOnEmptyMultilineStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (context.codeConstruct instanceof EmptyLineStmt &&
            context.codeConstruct.indexInRoot == 0 &&
            context.codeConstruct.rootNode instanceof Statement);
    }
    /**
     * logic: checks if token is not null AND atEmptyExpressionHole
     */
    isTknEmpty(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (context.token === null)
            return false;
        if (!this.atEmptyHole)
            return false;
        return true;
    }
    // /**
    //  * logic: checks if rootNode is instanceof AugmentedAssignmentModifier
    //  */
    // isAugmentedAssignmentModifierStatement(providedContext?: Context): boolean {
    //     const context = providedContext ? providedContext : this.module.focus.getContext();
    //     const rootNode = context.token.rootNode;
    //     if (rootNode instanceof AugmentedAssignmentModifier) {
    //         return true;
    //     }
    //     return false;
    // }
    /**
     * logic: checks if Statement body is empty and if all tokens of Statement are empty
     */
    canDeleteStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const rootNode = context.token.rootNode;
        // Only deletable if all its tokens are either a hole, non-editable token or an identifier
        for (let i = 0; i < rootNode.tokens.length; i++) {
            if (!(rootNode.tokens[i] instanceof HoleTkn) &&
                !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                !(rootNode.tokens[i] instanceof IdentifierTkn))
                // rootNode.tokens[i] is not a TypedExptyExpr, NonEditableTkn or IdentifierTkn
                return false;
            // If it is, do nothing
        }
        if (rootNode.hasBody()) {
            for (let i = 0; i < rootNode.body.length; i++) {
                // Everything needs to be an empty line
                if (!(rootNode.body[i] instanceof EmptyLineStmt))
                    return false;
            }
        }
        return true;
    }
    /**
     * logic: checks if all tokens of Expression are empty
     */
    canDeleteExpression(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const rootNode = context.token.rootNode;
        // Only deletable if all its tokens are either a hole, non-editable token or an identifier
        for (let i = 0; i < rootNode.tokens.length; i++) {
            if (!(rootNode.tokens[i] instanceof HoleTkn) &&
                !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                !(rootNode.tokens[i] instanceof IdentifierTkn)
            // && !(rootNode.tokens[i] instanceof OperatorTkn)
            )
                return false;
        }
        return true;
    }
    /**
     *
     * logic: checks if at the end of a statement, and not text editable.
     * AND does not have a body.
     * AND prev item is not an expression that could be deleted by it self.
     */
    canDeletePrevStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (!(context.codeConstruct instanceof EmptyLineStmt) &&
            !context.codeConstruct?.hasBody() &&
            this.module.focus.onEndOfLine() &&
            !this.module.focus.isTextEditable(providedContext)) {
            if (context.codeConstructToLeft != null)
                return false;
            return true;
        }
        return false;
    }
    /**
     * logic: checks if at the end of a statement, and not text editable.
     * AND prev item is not an expression that could be deleted by it self.
     */
    canDeletePrevMultiLineStatement(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (!(context.codeConstruct instanceof EmptyLineStmt) &&
            this.module.focus.onEndOfLine() &&
            !this.module.focus.isTextEditable(providedContext)) {
            if (context.codeConstructToLeft != null)
                return false;
            return true;
        }
        return false;
    }
    canDeletePrevStmt(providedContext) {
        if (!(providedContext.codeConstruct instanceof EmptyLineStmt) &&
            this.module.focus.onEndOfLine() &&
            !this.module.focus.isTextEditable(providedContext)) {
            if (providedContext.codeConstructToLeft != null)
                return false;
            return true;
        }
        return false;
    }
    /**
     * Check if the currently focused line is an empty line and if it could be
     * deleted
     *
     * @param providedContext - The current context
     * @param param1 - The direction to check for
     * @returns true if the current line can be deleted, false otherwise
     */
    canDeleteEmptyLine(providedContext, { backwards }) {
        if (providedContext.codeConstruct instanceof EmptyLineStmt &&
            providedContext.codeConstruct.rootNode.body.length > 1) {
            // So rootNode.body.length > 1
            if (backwards) {
                // Can no be the first line
                return providedContext.codeConstruct.lineNumber != 1;
            }
            else {
                // Can not be the last line
                return (providedContext.codeConstruct.indexInRoot != providedContext.codeConstruct.rootNode.body.length - 1);
            }
        }
    }
    /**
     * Check if the following statement can be deleted
     *
     * Logic:
     * * The current line is not an empty line AND
     * * The cursor is at the beginning of the line AND
     * * The cursor is not in a text editable area OR is, but the area behind it is empty
     *
     * @param providedContext - The current context
     * @returns true if the following statement can be deleted, false otherwise
     */
    canDeleteNextStmt(providedContext) {
        return (!(providedContext.codeConstruct instanceof EmptyLineStmt) &&
            this.module.focus.onBeginningOfLine() &&
            (!this.module.focus.isTextEditable(providedContext) || providedContext.tokenToRight.isEmpty));
    }
    /**
     * Check if the following construct, containing a token to the right
     * of the current position, can be deleted
     *
     * Logic:
     * * If the token to the right is a non-editable token, then the
     *   construct containing the token should be deleted
     *
     * @param providedContext - The current context
     * @returns true if the following construct can be deleted, false otherwise
     */
    canDeleteNextTkn(providedContext) {
        return providedContext.tokenToRight instanceof NonEditableTkn;
    }
    canDeleteAdjacentChar(providedContext, { backwards }) {
        if (!this.module.focus.isTextEditable(providedContext))
            return false;
        if (backwards) {
            return (!(providedContext.tokenToLeft instanceof NonEditableTkn) &&
                !this.module.validator.onBeginningOfLine(providedContext));
        }
        else {
            return !(providedContext.tokenToRight instanceof NonEditableTkn) && !providedContext.tokenToRight?.isEmpty;
        }
    }
    /**
     * logic: checks if at the beginning of an expression, and not at the beginning of a line (statement)
     */
    canDeleteNextToken(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        // Not at the start of a line and not text editable, but there is an expression to the right
        return (!this.module.focus.onBeginningOfLine() &&
            context.codeConstructToRight != null &&
            !this.module.focus.isTextEditable(providedContext));
    }
    /**
     * logic: checks if at the end of an expression
     */
    canDeletePrevToken(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return context.codeConstructToLeft != null && !this.module.focus.isTextEditable(providedContext);
    }
    /**
     * Check if the following construct, containing a token to the right
     * of the current position, can be deleted
     *
     * Logic:
     * * If the token to the right is a non-editable token, then the
     *   construct containing the token should be deleted
     *
     * @param providedContext - The current context
     * @returns true if the following construct can be deleted, false otherwise
     */
    canDeletePrevTkn(providedContext) {
        return providedContext.tokenToLeft instanceof NonEditableTkn;
    }
    isAboveLineIndentedForward(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (context.codeConstruct.lineNumber > 2) {
            const lineAbove = this.module.focus.getCodeConstructAtLineNumber(context.codeConstruct.lineNumber - 1);
            return context.codeConstruct.leftCol < lineAbove.leftCol;
        }
    }
    /**
     * logic:
     * checks if at the beginning of a line
     * AND if it is inside the body of another statement
     * AND if it is the last line of that body
     * AND if the above line is not an empty line
     * AND if it is not the only line of that body
     */
    canIndentBack(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (this.module.focus.onBeginningOfLine() &&
            context.codeConstruct.rootNode instanceof Statement &&
            // !(context.lineStatement instanceof ElseStatement) &&
            // !(context.lineStatement instanceof IfStatement) &&
            // !(this.getNextSiblingOfRoot(context) instanceof ElseStatement) &&
            context.codeConstruct.rootNode.hasBody()) {
            const rootsBody = context.codeConstruct.rootNode.body;
            return (!this.canDeletePrevLine(context) &&
                // Can not be the only and direct child of the parent
                rootsBody.length != 1 &&
                // Needs to be the last construct in the body
                context.codeConstruct.indexInRoot == rootsBody.length - 1);
        }
        return false;
    }
    /**
     * When in the body of a statement with only empty lines after the current line,
     * remove the empty lines and the line itself
     *
     * ==> WOULD BE NICE TO KEEP, but then we need to check if a depending structure
     *
     * logic:
     * checks if at the beginning of an empty line
     * AND if it is inside the body of another statement
     * AND if every other line after this line is an empty line
     * AND if the above line is not an empty line
     * AND if it is not the only line of that body
     */
    canDeleteBackMultiEmptyLines(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        if (context.codeConstruct instanceof EmptyLineStmt &&
            context.codeConstruct.rootNode instanceof Statement &&
            context.codeConstruct.rootNode.hasBody() &&
            !context.codeConstruct.rootNode.hasDependent(this.getNextSiblingOfRoot(context)) // NOT OK: Clean up types later
        ) {
            const rootsBody = context.codeConstruct.rootNode.body;
            let onlyEmptyLines = true;
            for (let i = context.codeConstruct.indexInRoot + 1; i < rootsBody.length; i++) {
                if (!(rootsBody[i] instanceof EmptyLineStmt)) {
                    onlyEmptyLines = false;
                    break;
                }
            }
            return onlyEmptyLines && context.codeConstruct.indexInRoot != 0;
        }
        return false;
    }
    /**
     * logic:
     * checks if at the beginning of a line
     * AND if the above line is an indented line.
     */
    canIndentForward(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (this.module.focus.onBeginningOfLine() &&
            // !(context.lineStatement instanceof ElseStatement) &&
            // !(context.lineStatement instanceof IfStatement) &&
            this.isAboveLineIndentedForward());
    }
    atRightOfExpression(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (
        // !this.insideFormattedString(context) &&
        context?.codeConstructToLeft != null
        // &&
        // context?.expressionToLeft?.returns != null &&
        // context?.expressionToLeft?.returns != DataType.Void
        );
    }
    atLeftOfExpression(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (
        // !this.insideFormattedString(context) &&
        context?.codeConstructToRight != null
        // &&
        // context?.expressionToRight?.returns != null &&
        // context?.expressionToRight?.returns != DataType.Void
        );
    }
    atEmptyHole(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return context.selected && context?.token?.isEmpty && context.token instanceof HoleTkn;
    }
    atEmptyOperatorTkn(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return false; //context.selected && context?.token?.isEmpty && context.token instanceof EmptyOperatorTkn;
    }
    /**
     * Check if the current context is at a hole of the given type
     * This is an extension of {@link atEmptyHole} that also checks the type of the hole
     *
     * @param providedContext - The current context
     * @param type - The type of the construct to insert
     * @returns True if the current context is at a hole of the given type, false otherwise
     */
    atHoleWithType(providedContext, type) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return (context.selected &&
            context?.token?.isEmpty &&
            context.token instanceof HoleTkn &&
            context.token.allowedType === type);
    }
    canConvertAutocompleteToString(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        // Check if the token is an autocomplete token and if it is not at the start of a line? (not sure about this)
        return (context.tokenToRight instanceof AutocompleteTkn &&
            context.tokenToRight.leftCol != context.codeConstruct.leftCol);
    }
    getNextSiblingOfRoot(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curRoot = context?.codeConstruct?.rootNode;
        if (curRoot instanceof CodeConstruct) {
            return this.getStatementInBody(curRoot.rootNode, curRoot.indexInRoot + 1);
        }
        return null;
    }
    getPrevSiblingOfRoot(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curRoot = context?.codeConstruct?.rootNode;
        if (curRoot instanceof Statement) {
            return this.getStatementInBody(curRoot.rootNode, curRoot.indexInRoot - 1);
        }
        return null;
    }
    getStatementInBody(bodyContainer, index) {
        if (index >= 0 && index < bodyContainer.body.length) {
            return bodyContainer.body[index];
        }
        return null;
    }
    // FFD
    getLineBelow(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        return this.module.focus.getCodeConstructAtLineNumber(context?.codeConstruct?.lineNumber + 1);
    }
    getLineAbove(providedContext) {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curLineNumber = context?.codeConstruct?.lineNumber;
        if (curLineNumber > 1)
            return this.module.focus.getCodeConstructAtLineNumber(curLineNumber - 1);
        return null;
    }
    /**
     * Mark a codestruct requiring an import as draft mode, or unmark if import is okay
     *
     * @param stmts - The list of import statements to validate. If not provided, all import statements in the module will be validated
     */
    validateImports(stmts) {
        if (!stmts) {
            stmts = this.module.getAllImportStmts();
        }
        this.module.performActionOnBFS((code) => {
            // BFS = Breadth First Search?
            if (isImportable(code) && code.requiresImport()) {
                const importStatus = code.validateImportFromImportList(stmts);
                //This check is required otherwise it won't compile. In practice, it will always be a Statement becuase tokens are not importables
                if (code instanceof Statement) {
                    if (importStatus && code.draftModeEnabled) {
                        this.module.closeConstructDraftRecord(code);
                    }
                    else if (!importStatus && !code.draftModeEnabled) {
                        this.module.openImportDraftMode(code);
                    }
                }
            }
        });
    }
}
//# sourceMappingURL=validator.js.map