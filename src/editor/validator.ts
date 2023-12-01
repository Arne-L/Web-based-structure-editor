import Fuse from "fuse.js";
import {
    AssignmentModifier,
    AugmentedAssignmentModifier,
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
    IdentifierTkn,
    IfStatement,
    ImportStatement,
    ListLiteralExpression,
    LiteralValExpr,
    Modifier,
    NonEditableTkn,
    OperatorTkn,
    Statement,
    TypedEmptyExpr,
    ValueOperationExpr,
    VarAssignmentStmt,
    VariableReferenceExpr,
} from "../syntax-tree/ast";
import { Module } from "../syntax-tree/module";
import { Reference } from "../syntax-tree/scope";
import { VariableController } from "../syntax-tree/variable-controller";
import { isImportable } from "../utilities/util";
import {
    BinaryOperator,
    DataType,
    InsertionType,
    NumberRegex,
    OperatorCategory,
    UnaryOperator,
    arithmeticOps,
    boolOps,
    comparisonOps,
} from "./../syntax-tree/consts";
import { EditCodeAction } from "./action-filter";
import { Context } from "./focus";

/**
 * Class aggregating methods that determine if a certain action is allowed
 */
export class Validator {
    module: Module;

    constructor(module: Module) {
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
    canInsertOp(operator: BinaryOperator | UnaryOperator, providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const operatorExpr = context.token?.rootNode;

        // All the following code is to check typing compatibility
        if (operatorExpr instanceof BinaryOperatorExpr) {
            const leftOperand = operatorExpr.getLeftOperand();
            const rightOperand = operatorExpr.getRightOperand();

            const leftOperandCurType = leftOperand instanceof Expression ? leftOperand.returns : null;
            const rightOperandCurType = rightOperand instanceof Expression ? rightOperand.returns : null;

            if (operatorExpr.operatorCategory === OperatorCategory.Arithmetic) {
                if (leftOperandCurType === DataType.String || rightOperandCurType === DataType.String) {
                    return operator === BinaryOperator.Add;
                } else return arithmeticOps.indexOf(operator) !== -1;
            } else if (operatorExpr.operatorCategory === OperatorCategory.Comparison) {
                return comparisonOps.indexOf(operator) !== -1;
            } else if (operatorExpr.operatorCategory === OperatorCategory.Boolean) {
                return boolOps.indexOf(operator) !== -1;
            }
        }

        return true;
    }

    /**
     * Determines if the left operand can open an autocomplete menu / switch to autocomplete
     *
     * @param pressedKey - The key that was pressed as an additional character to the left operand
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if left can be switched to autocomplete, false otherwise
     */
    canSwitchLeftNumToAutocomplete(pressedKey: string, providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.expressionToLeft instanceof LiteralValExpr &&
            !(context.tokenToRight instanceof AutocompleteTkn) &&
            !NumberRegex.test(context.expressionToLeft.getValue() + pressedKey)
        );
    }

    /**
     * Determines if the right operand can open an autocomplete menu / switch to autocomplete
     *
     * @param pressedKey - The key that was pressed as an additional character to the right operand
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if right can be switched to autocomplete, false otherwise
     */
    canSwitchRightNumToAutocomplete(pressedKey: string, providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.expressionToRight instanceof LiteralValExpr &&
            !(context.tokenToLeft instanceof AutocompleteTkn) &&
            !NumberRegex.test(context.expressionToRight.getValue() + pressedKey)
        );
    }

    /**
     * Determines if the cursor is at the beginning of a value operation (e.g. "var = |", "| + |", "var += |")
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the cursor is at the beginning of a value operation, false otherwise
     */
    atBeginningOfValOperation(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        const isCorrectExprType =
            context.expressionToRight instanceof VariableReferenceExpr ||
            context.expressionToRight instanceof LiteralValExpr;

        const hasCorrectRootType =
            context.expressionToRight.rootNode instanceof Modifier ||
            context.expressionToRight.rootNode instanceof VarAssignmentStmt ||
            context.expressionToRight.rootNode instanceof ValueOperationExpr;

        return isCorrectExprType && hasCorrectRootType;
    }

    /**
     * Checks if the current position is above an else statement
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current position is above an else statement, false otherwise
     */
    isAboveElseStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return this.getNextSibling(context) instanceof ElseStatement;
    }

    /**
     * Checks if the current position is at the start of a linestatement
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current position is at the start of a line, false otherwise
     */
    onBeginningOfLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return context.position.column == context.lineStatement.left;
    }

    /**
     * logic: if next statement is either else or elif => false
     * if prev is either if or elif => return true
     */
    /**
     * Determines if an else statement can be inserted at the current indent by checking if the previous statement is either and if or elif and checking that the next statement is not an else/elif statement
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if an else statement can be inserted at the current indent, false otherwise
     */
    canInsertElseStmtAtCurIndent(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        const prevStmt = this.getPrevSibling(context);
        const nextStmt = this.getNextSibling(context);

        if (nextStmt instanceof ElseStatement) return false; // either else or elif

        if (prevStmt instanceof IfStatement || (prevStmt instanceof ElseStatement && prevStmt.hasCondition))
            return true;

        return false;
    }

    /**
     * logic: if next statement is either else => false
     * if prev is either if or elif => return true
     */
    /**
     * Determines if an elif statement can be inserted at the current indent by checking if the previous statement is either and if or elif
     *
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if an elif statement can be inserted at the current indent, false otherwise
     */
    canInsertElifStmtAtCurIndent(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const prevStmt = this.getPrevSibling(context);

        // Previous statement can not be a normal else statement => DOES FOLLOW AUTOMATICALLY FROM NEXT STATEMENT
        if (prevStmt instanceof ElseStatement && !prevStmt.hasCondition) return false;

        // Previous statement needs to be an if or elif statement
        if (prevStmt instanceof IfStatement || (prevStmt instanceof ElseStatement && prevStmt.hasCondition))
            return true;

        return false;
    }

    /**
     * This function expects that we've tried inserting the else at the current indent
     * before calling this function.
     *
     * logic: returns false if inside else, or the item's root has a sibling before it which was an else,
     * or the item's root has a sibling after it which is either an if or an elif.
     * returns true => within if AND the current body does not have a else/elif sibling afterwards
     * returns true => within elif AND the current body does not have an else sibling afterwards
     */
    canInsertElseStmtAtPrevIndent(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        const prevStmtOfRoot = this.getPrevSiblingOfRoot(context);
        const nextStmtOfRoot = this.getNextSiblingOfRoot(context);
        const curStmtRoot = context.lineStatement.rootNode as Statement | Module;

        if (
            (curStmtRoot instanceof ElseStatement && !curStmtRoot.hasCondition) ||
            nextStmtOfRoot instanceof ElseStatement ||
            (prevStmtOfRoot instanceof ElseStatement && !prevStmtOfRoot.hasCondition) ||
            context.lineStatement.indexInRoot == 0
        ) {
            // if inside else statement
            // if this item's root has a sibling afterward which is either an else or an elif
            // if this item's root has a sibling before it which was a normal else
            return false;
        }

        // If current item's root is an if and the next item of the root is not an else/elif
        if (curStmtRoot instanceof IfStatement && !(nextStmtOfRoot instanceof ElseStatement)) return true;
        if (
            curStmtRoot instanceof ElseStatement &&
            curStmtRoot.hasCondition &&
            !(nextStmtOfRoot instanceof ElseStatement && !nextStmtOfRoot.hasCondition)
        )
            // If current item's root is an elif and the next item of the root is not a normal else
            return true;

        return false;
    }

    /**
     * This function expects that we've tried inserting the elif at the current indent
     * before calling this function.
     *
     * logic: returns false if inside else, or the item's root has a sibling before it which was an else.
     * returns true if current item's root is either an if or an elif.
     */
    canInsertElifStmtAtPrevIndent(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        const prevStmtOfRoot = this.getPrevSiblingOfRoot(context);
        const curStmtRoot = context.lineStatement.rootNode as Statement | Module;

        if (
            (curStmtRoot instanceof ElseStatement && !curStmtRoot.hasCondition) ||
            (prevStmtOfRoot instanceof ElseStatement && !prevStmtOfRoot.hasCondition) ||
            context.lineStatement.indexInRoot == 0
        ) {
            // if inside else statement
            // if this item's root has a sibling before it which was an else
            return false;
        }

        if (curStmtRoot instanceof IfStatement || (curStmtRoot instanceof ElseStatement && curStmtRoot.hasCondition)) {
            return true;
        }

        return false;
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
    onEmptyLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return context.lineStatement instanceof EmptyLineStmt;
    }

    /**
     * logic: checks if at the end of an editable text
     * OR selected an empty editable text / identifier
     * OR right before an editable item and need to select it
     */
    canMoveToNextTokenAtTextEditable(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            ((context.tokenToRight instanceof IdentifierTkn || context.tokenToRight instanceof EditableTextTkn) &&
                context.tokenToRight.isEmpty) ||
            context.tokenToLeft instanceof EditableTextTkn || // Why is it to the left?
            context.tokenToLeft instanceof IdentifierTkn ||
            (context.token?.isEmpty && context.selected)
        );
    }

    /**
     * logic: checks if at the beginning of an editable text
     * OR selected an empty editable text / identifier
     */
    canMoveToPrevTokenAtTextEditable(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            (context.tokenToLeft instanceof IdentifierTkn && context.tokenToRight.isEmpty) || // Left and right?
            context.tokenToRight instanceof EditableTextTkn || // Again?
            context.tokenToRight instanceof IdentifierTkn ||
            (context.token?.isEmpty && context.selected)
        );
    }

    /**
     * Determines if an empty line can be inserted at the current position.
     * For this function to return true, the position should be at the start or end of a line and 
     * nothing should be selected.
     * 
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if at the current position, you can insert an empty line, false otherwise
     */
    canInsertEmptyLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curPosition = this.module.editor.monaco.getPosition();

        return (
            !context.selected &&
            (curPosition.column == context.lineStatement.left || curPosition.column == context.lineStatement.right)
        );
    }

    /**
     * logic: checks if currently at an empty line.
     * AND is not the only line of the body of a compound statement or Module.
     * AND is not the last line (in the Module or in a compound statement)
     */
    canDeleteCurLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.lineStatement instanceof EmptyLineStmt) {
            return (
                (context.lineStatement.rootNode instanceof Statement ||
                    context.lineStatement.rootNode instanceof Module) &&
                context.lineStatement.rootNode.body.length != 1 && // So rootNode.body.length > 1
                context.lineStatement.indexInRoot != context.lineStatement.rootNode.body.length - 1 // Can not be the last line
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
    canBackspaceCurEmptyLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.lineStatement instanceof EmptyLineStmt) {
            return (
                (context.lineStatement.rootNode instanceof Statement ||
                    context.lineStatement.rootNode instanceof Module) &&
                context.lineStatement.rootNode.body.length != 1 &&
                context.lineStatement.lineNumber != 1
            );
        }

        return false;
    }

    /**
     * logic: checks if the above line is an empty line.
     * AND should be at the beginning of the line.
     */
    canDeletePrevLine(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curPosition = this.module.editor.monaco.getPosition();

        return curPosition.column == context.lineStatement.left && this.getLineAbove() instanceof EmptyLineStmt;
    }

    /**
     * logic: checks if at the beginning of a statement, and not text editable.
     * the statement must NOT have a body
     */
    canDeleteNextStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            !(context.lineStatement instanceof EmptyLineStmt) &&
            this.module.focus.onBeginningOfLine() &&
            !context.lineStatement.hasBody()
        ) {
            if (this.module.focus.isTextEditable(providedContext)) {
                if (context.tokenToRight.isEmpty) return true;
                else return false;
            } else return true;
        }

        return false;
    }

    /**
     * logic: checks if at the beginning of a statement, and not text editable.
     * the statement must HAVE a body
     */
    canDeleteNextMultilineStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            !(context.lineStatement instanceof EmptyLineStmt) &&
            this.module.focus.onBeginningOfLine() &&
            context.lineStatement.hasBody()
        ) {
            if (this.module.focus.isTextEditable(providedContext)) {
                if (context.tokenToRight.isEmpty) return true;
                else return false;
            } else return true;
        }

        return false;
    }

    /**
     * logic: checks if at the beginning of a multiline statement
     */
    canMoveLeftOnEmptyMultilineStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.lineStatement instanceof EmptyLineStmt &&
            context.lineStatement.indexInRoot == 0 &&
            context.lineStatement.rootNode instanceof Statement
        );
    }

    /**
     * logic: checks if token is not null AND atEmptyExpressionHole
     */
    isTknEmpty(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.token === null) return false;
        if (!this.atEmptyExpressionHole) return false;

        return true;
    }

    /**
     * logic: checks if rootNode is instanceof AugmentedAssignmentModifier
     */
    isAugmentedAssignmentModifierStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const rootNode = context.token.rootNode;

        if (rootNode instanceof AugmentedAssignmentModifier) {
            return true;
        }

        return false;
    }

    /**
     * logic: checks if Statement body is empty and if all tokens of Statement are empty
     */
    canDeleteStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const rootNode = context.token.rootNode as Statement;

        for (let i = 0; i < rootNode.tokens.length; i++) {
            if (
                !(rootNode.tokens[i] instanceof TypedEmptyExpr) &&
                !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                !(rootNode.tokens[i] instanceof IdentifierTkn)
            )
                // rootNode.tokens[i] is not a TypedExptyExpr, NonEditableTkn or IdentifierTkn
                return false;
            // If it is, do nothing
        }

        if (rootNode.hasBody()) {
            for (let i = 0; i < rootNode.body.length; i++) {
                // Everything need to be an empty line
                if (!(rootNode.body[i] instanceof EmptyLineStmt)) return false;
            }
        }

        return true;
    }

    /**
     * logic: checks if all tokens of Expression are empty
     */
    canDeleteExpression(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const rootNode = context.token.rootNode as Expression;

        for (let i = 0; i < rootNode.tokens.length; i++) {
            if (
                !(rootNode.tokens[i] instanceof TypedEmptyExpr) &&
                !(rootNode.tokens[i] instanceof NonEditableTkn) &&
                !(rootNode.tokens[i] instanceof OperatorTkn)
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
    canDeletePrevStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            !(context.lineStatement instanceof EmptyLineStmt) &&
            !context.lineStatement?.hasBody() &&
            this.module.focus.onEndOfLine() &&
            !this.module.focus.isTextEditable(providedContext)
        ) {
            if (context.expressionToLeft != null) return false;

            return true;
        }

        return false;
    }

    /**
     * logic: checks if at the end of a statement, and not text editable.
     * AND prev item is not an expression that could be deleted by it self.
     */
    canDeletePrevMultiLineStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            !(context.lineStatement instanceof EmptyLineStmt) &&
            this.module.focus.onEndOfLine() &&
            !this.module.focus.isTextEditable(providedContext)
        ) {
            if (context.expressionToLeft != null) return false;

            return true;
        }

        return false;
    }

    /**
     * Checks whether there are currly brackets to the left of the current position
     * 
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current position is at the end of a line, false otherwise
     */
    canDeletePrevFStringCurlyBrackets(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        // "print(f'{}|')"
        return context.expressionToLeft instanceof FormattedStringCurlyBracketsExpr;
    }

    /**
     * Checks whether there are currly brackets to the right of the current position
     * 
     * @param providedContext - The context to use for the validation. If not provided, the current context will be used
     * @returns - true if the current position is at the end of a line, false otherwise
     */
    canDeleteNextFStringCurlyBrackets(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        // "print(f'|{}')"
        return context.expressionToRight instanceof FormattedStringCurlyBracketsExpr;
    }

    canDeleteSelectedFStringCurlyBrackets(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.token instanceof TypedEmptyExpr &&
            context.token.rootNode instanceof FormattedStringCurlyBracketsExpr
        );
    }

    canDeleteStringLiteral(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            (context.tokenToLeft?.text == '"' || context.tokenToLeft?.text == "'") &&
            (context.tokenToRight?.text == '"' || context.tokenToRight?.text == "'")
        );
    }

    /**
     * logic: checks if at the beginning of an expression, and not at the beginning of a line (statement)
     */
    canDeleteNextToken(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            !this.module.focus.onBeginningOfLine() &&
            context.expressionToRight != null &&
            !this.module.focus.isTextEditable(providedContext)
        );
    }

    /**
     * logic: checks if at the end of an expression
     */
    canDeletePrevToken(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return context.expressionToLeft != null && !this.module.focus.isTextEditable(providedContext);
    }

    shouldDeleteVarAssignmentOnHole(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.token instanceof TypedEmptyExpr && context.selected) {
            const root = context.token.rootNode;

            if (root instanceof VarAssignmentStmt) {
                return true; // this.module.variableController.isVarStmtReassignment(root, this.module);
            }
        }

        return false;
    }

    shouldDeleteHole(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.token instanceof TypedEmptyExpr && context.selected) {
            const root = context.token.rootNode;

            if (root instanceof AugmentedAssignmentModifier || root instanceof AssignmentModifier) return true;
        }

        return false;
    }

    canIndentBackIfStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            this.module.focus.onBeginningOfLine() &&
            context.lineStatement.rootNode instanceof Statement &&
            context.lineStatement.rootNode.hasBody() &&
            context.lineStatement instanceof IfStatement &&
            !(this.getNextSiblingOfRoot() instanceof ElseStatement) &&
            !this.canDeletePrevLine(context)
        ) {
            const rootsBody = context.lineStatement.rootNode.body;

            if (rootsBody.length != 1) {
                for (let i = context.lineStatement.indexInRoot + 1; i < rootsBody.length; i++) {
                    if (!(rootsBody[i] instanceof ElseStatement)) return false;
                }
            }

            return true;
        }

        return false;
    }

    isAboveLineIndentedForward(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.lineStatement.lineNumber > 2) {
            const lineAbove = this.module.focus.getStatementAtLineNumber(context.lineStatement.lineNumber - 1);

            return context.lineStatement.left < lineAbove.left;
        }
    }

    canIndentForwardIfStatement(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            this.module.focus.onBeginningOfLine() &&
            this.isAboveLineIndentedForward() &&
            context.lineStatement instanceof IfStatement
        );
    }

    /**
     * logic:
     * checks if at the beginning of a line
     * AND if it is inside the body of another statement
     * AND if it is the last line of that body
     * AND if the above line is not an empty line
     * AND if it is not the only line of that body
     */
    canIndentBack(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            this.module.focus.onBeginningOfLine() &&
            context.lineStatement.rootNode instanceof Statement &&
            !(context.lineStatement instanceof ElseStatement) &&
            !(context.lineStatement instanceof IfStatement) &&
            !(this.getNextSiblingOfRoot(context) instanceof ElseStatement) &&
            context.lineStatement.rootNode.hasBody()
        ) {
            const rootsBody = context.lineStatement.rootNode.body;

            return (
                !this.canDeletePrevLine(context) &&
                rootsBody.length != 1 &&
                context.lineStatement.indexInRoot == rootsBody.length - 1
            );
        }

        return false;
    }

    /**
     * logic:
     * checks if at the beginning of an empty line
     * AND if it is inside the body of another statement
     * AND if every other line after this line is an empty line
     * AND if the above line is not an empty line
     * AND if it is not the only line of that body
     */
    canDeleteBackMultiEmptyLines(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            context.lineStatement instanceof EmptyLineStmt &&
            context.lineStatement.rootNode instanceof Statement &&
            context.lineStatement.rootNode.hasBody() &&
            !(this.getNextSiblingOfRoot(context) instanceof ElseStatement)
        ) {
            const rootsBody = context.lineStatement.rootNode.body;
            let onlyEmptyLines = true;

            for (let i = context.lineStatement.indexInRoot + 1; i < rootsBody.length; i++) {
                if (!(rootsBody[i] instanceof EmptyLineStmt)) {
                    onlyEmptyLines = false;

                    break;
                }
            }

            return onlyEmptyLines && context.lineStatement.indexInRoot != 0;
        }

        return false;
    }

    /**
     * logic:
     * checks if at the beginning of a line
     * AND if the above line is an indented line.
     */
    canIndentForward(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            this.module.focus.onBeginningOfLine() &&
            !(context.lineStatement instanceof ElseStatement) &&
            !(context.lineStatement instanceof IfStatement) &&
            this.isAboveLineIndentedForward()
        );
    }

    canInsertEmptyList(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.token instanceof TypedEmptyExpr &&
            context.token.isEmpty &&
            (context.token.type.indexOf(DataType.Any) >= 0 || context.token.type.indexOf(DataType.AnyList) >= 0)
        );
    }

    canDeleteListItemToLeft(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (context.selected && context.token != null && context.token.rootNode instanceof ListLiteralExpression) {
            const itemBefore = context.token.rootNode.tokens[context.token.indexInRoot - 1];

            // [---, |---|] [---, "123", |---|] [---, |---|, 123]
            if (itemBefore instanceof NonEditableTkn && itemBefore.text == ", ") return true;
        }

        return false;
    }

    canDeleteListItemToRight(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        if (
            context.selected &&
            context.token != null &&
            context.token.rootNode instanceof ListLiteralExpression &&
            context.token.rootNode.tokens.length != 3
        ) {
            const itemBefore = context.token.rootNode.tokens[context.token.indexInRoot - 1];

            // [|---|, ---] [|---|, "123"] [|---|, ---, 123]
            if (itemBefore instanceof NonEditableTkn && itemBefore.text == "[") return true;
        }

        return false;
    }

    canAddListItemToRight(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        // [asd|] [asd, fgh|] [asd|, fgh] => , ---
        return (
            context?.tokenToRight instanceof NonEditableTkn &&
            context?.tokenToRight?.rootNode instanceof ListLiteralExpression &&
            (context?.tokenToRight?.text == "]" || context?.tokenToRight?.text == ", ")
        );
    }

    canAddListItemToLeft(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        // [|asd] [|asd, fgh] [asd, |fgh] => ---,

        return (
            context?.tokenToLeft instanceof NonEditableTkn &&
            context?.tokenToLeft?.rootNode instanceof ListLiteralExpression &&
            (context?.tokenToLeft?.text == "[" || context?.tokenToLeft?.text == ", ")
        );
    }

    atRightOfExpression(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            !this.insideFormattedString(context) &&
            context?.expressionToLeft != null &&
            context?.expressionToLeft?.returns != null &&
            context?.expressionToLeft?.returns != DataType.Void
        );
    }

    atLeftOfExpression(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            !this.insideFormattedString(context) &&
            context?.expressionToRight != null &&
            context?.expressionToRight?.returns != null &&
            context?.expressionToRight?.returns != DataType.Void
        );
    }

    atEmptyExpressionHole(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return context.selected && context?.token?.isEmpty && context.token instanceof TypedEmptyExpr;
    }

    atEmptyOperatorTkn(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return context.selected && context?.token?.isEmpty && context.token instanceof EmptyOperatorTkn;
    }

    insideFormattedString(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.token?.rootNode instanceof FormattedStringExpr ||
            context.tokenToLeft?.rootNode instanceof FormattedStringExpr ||
            context.tokenToRight?.rootNode instanceof FormattedStringExpr
        );
    }

    canInsertFormattedString(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.selected &&
            context?.token?.isEmpty &&
            context.token instanceof TypedEmptyExpr &&
            !(context.token.rootNode instanceof FormattedStringCurlyBracketsExpr)
        );
    }

    canConvertAutocompleteToString(providedContext?: Context): boolean {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return (
            context.tokenToRight instanceof AutocompleteTkn && context.tokenToRight.left != context.lineStatement.left
        );
    }

    private getPrevSibling(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return this.getStatementInBody(
            context?.lineStatement?.rootNode as Statement | Module,
            context?.lineStatement?.indexInRoot - 1
        );
    }

    private getNextSibling(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return this.getStatementInBody(
            context?.lineStatement?.rootNode as Statement | Module,
            context?.lineStatement?.indexInRoot + 1
        );
    }

    private getNextSiblingOfRoot(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curRoot = context?.lineStatement?.rootNode;

        if (curRoot instanceof Statement) {
            return this.getStatementInBody(curRoot.rootNode as Statement | Module, curRoot.indexInRoot + 1);
        }

        return null;
    }

    private getPrevSiblingOfRoot(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();
        const curRoot = context?.lineStatement?.rootNode;

        if (curRoot instanceof Statement) {
            return this.getStatementInBody(curRoot.rootNode as Statement | Module, curRoot.indexInRoot - 1);
        }

        return null;
    }

    private getStatementInBody(bodyContainer: Statement | Module, index: number): Statement {
        if (index >= 0 && index < bodyContainer.body.length) {
            return bodyContainer.body[index];
        }

        return null;
    }

    private getLineBelow(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        return this.module.focus.getStatementAtLineNumber(context?.lineStatement?.lineNumber + 1);
    }

    private getLineAbove(providedContext?: Context): Statement {
        const context = providedContext ? providedContext : this.module.focus.getContext();

        const curLineNumber = context?.lineStatement?.lineNumber;

        if (curLineNumber > 1) return this.module.focus.getStatementAtLineNumber(curLineNumber - 1);

        return null;
    }

    //returns a nested list [[Reference, InsertionType], ...]
    /**
     * Gets the valid variable references for the given code construct
     * 
     * @param code - The code construct to get the valid variable references for
     * @param variableController - The variable controller to use for the validation
     * @returns - A list of valid variable references for the given code construct
     */
    static getValidVariableReferences(
        code: CodeConstruct,
        variableController: VariableController
    ): [Reference, InsertionType][] {
        const refs: Reference[] = [];
        const mappedRefs: [Reference, InsertionType][] = []; //no point of making this a map since we don't have access to the refs whereever this method is used. Otherwise would have to use buttonId or uniqueId as keys into the map.

        try {
            if (code instanceof TypedEmptyExpr || code instanceof EmptyLineStmt) {
                let scope =
                    code instanceof TypedEmptyExpr ? code.getParentStatement()?.scope : (code.rootNode as Module).scope; //line that contains "code"
                let currRootNode = code.rootNode;

                while (!scope) {
                    if (!(currRootNode instanceof Module)) {
                        if (currRootNode.getParentStatement()?.hasScope()) {
                            scope = currRootNode.getParentStatement().scope;
                        } else if (currRootNode.rootNode instanceof Statement) {
                            currRootNode = currRootNode.rootNode;
                        } else if (currRootNode.rootNode instanceof Module) {
                            scope = currRootNode.rootNode.scope;
                        }
                    } else {
                        break;
                    }
                }

                refs.push(...scope.getValidReferences(code.getSelection().startLineNumber));

                for (const ref of refs) {
                    if (ref.statement instanceof VarAssignmentStmt) {
                        if (code instanceof TypedEmptyExpr) {
                            if (
                                code.type.indexOf(
                                    variableController.getVariableTypeNearLine(
                                        scope,
                                        code.getLineNumber(),
                                        ref.statement.getIdentifier()
                                    )
                                ) > -1 ||
                                code.type.indexOf(DataType.Any) > -1
                            ) {
                                mappedRefs.push([ref, InsertionType.Valid]);
                            } else {
                                mappedRefs.push([ref, InsertionType.DraftMode]);
                            }
                        } else if (code instanceof EmptyLineStmt) {
                            //all variables can become var = --- so allow all of them to trigger draft mode
                            mappedRefs.push([ref, InsertionType.DraftMode]);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Unable to get valid variable references for " + code + "\n\n" + e);
        } finally {
            return mappedRefs;
        }
    }

    /**
     * Gets the EditCodeActions for the given search string
     * 
     * @param searchString - The string to search for
     * @param possibilities - The list of possibilities to search through (EditCodeAction[])
     * @param searchKeys - The keys to search through (strings)
     * @returns - A list of results that match the search string
     */
    static matchEditCodeAction(
        searchString: string,
        possibilities: EditCodeAction[],
        searchKeys: string[]
    ): Fuse.FuseResult<EditCodeAction>[] {
        const options = {
            includeScore: true,
            includeMatches: true,
            shouldSort: true,
            findAllMatches: true,
            threshold: 0.5,
            keys: searchKeys,
        };
        const fuse = new Fuse(possibilities, options);

        return fuse.search(searchString);
    }

    /**
     * Mark a codestruct requiring an import as draft mode, or unmark if import is okay
     * 
     * @param stmts - The list of import statements to validate. If not provided, all import statements in the module will be validated
     */
    validateImports(stmts?: ImportStatement[]) {
        if (!stmts) {
            stmts = this.module.getAllImportStmts();
        }
        this.module.performActionOnBFS((code: CodeConstruct) => { // BFS = Breadth First Search?
            if (isImportable(code) && code.requiresImport()) {
                const importStatus = code.validateImportFromImportList(stmts);

                //This check is required otherwise it won't compile. In practice, it will always be a Statement becuase tokens are not importables
                if (code instanceof Statement) {
                    if (importStatus && code.draftModeEnabled) {
                        this.module.closeConstructDraftRecord(code);
                    } else if (!importStatus && !code.draftModeEnabled) {
                        this.module.openImportDraftMode(code);
                    }
                }
            }
        });
    }
}
