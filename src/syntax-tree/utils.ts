import { Range } from "monaco-editor";
import { Context } from "../editor/focus";
import { Token, EmptyOperatorTkn, Statement, TypedEmptyExpr, TemporaryStmt, GeneralStatement, CodeConstruct, Expression, BinaryOperatorExpr } from "./ast";
import { replaceInBody } from "./body";
import { CallbackType } from "./callback";
import { Module } from "./module";
import { InsertionType } from "./consts";
import { isImportable } from "../utilities/util";

export namespace ASTManupilation {
    export function insertConstruct(context: Context, construct: CodeConstruct) {
        const module = Module.instance;
        if (construct instanceof Token) {
            // If on empty line, replace the empty line
            if (module.validator.onEmptyLine(context)) {
                replaceEmptyStatement(context.lineStatement, new TemporaryStmt(construct));
            }
            // If at empty expression hole, insert the token
            else if (module.validator.atEmptyExpressionHole(context)) {
                insertToken(context, construct);
            }
            // Generalise to anything that can be to the left of a token; MAYBE just say switch to autocomplete or something
            else if (
                /*module.validator.canSwitchLeftNumToAutocomplete(context) || */ module.validator.atRightOfExpression(
                context
            )
            ) {
                insertToken(context, construct, { toLeft: true });
            } else if (
                /*module.validator.canSwitchRightNumToAutocomplete(context) || */ module.validator.atLeftOfExpression(
                context
            )
            ) {
                insertToken(context, construct, { toRight: true });
            } else {
                console.error(`insertConstruct(${context}, ${construct}): When inserting a token in the AST, the context was not valid for insertion`);
            }
        } else if (construct instanceof GeneralStatement) {
            // Currently for expressions and statements

            // If on empty line, replace the empty line
            if (module.validator.onEmptyLine(context)) {
                replaceEmptyStatement(context.lineStatement, construct);
            }
            // If at empty expression hole, insert the token
            else if (module.validator.atEmptyExpressionHole(context)) {
            }
            // Generalise to anything that can be to the left of a token; MAYBE just say switch to autocomplete or something
            else if (
                /*module.validator.canSwitchLeftNumToAutocomplete(context) || */ module.validator.atRightOfExpression(
                    context
                )
            ) {
                // insertToken(context, construct, { toLeft: true });
            } else if (
                /*module.validator.canSwitchRightNumToAutocomplete(context) || */ module.validator.atLeftOfExpression(
                    context
                )
            ) {
            } else {
                console.error(
                    `insertConstruct(${context}, ${construct}): When inserting a token in the AST, the context was not valid for insertion`
                );
            }
        }
    }

    function replaceEmptyStatement(emptyLine: Statement, statement: Statement) {
        const module = Module.instance;

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
        if (emptyLine.message) module.messageController.removeMessageFromConstruct(emptyLine);

        // Update the Monaco editor with the new statement
        module.editor.executeEdits(range, statement);
        module.focus.updateContext(statement.getInitialFocus());
    }

    function insertToken(context: Context, code: Token, { toLeft = false, toRight = false } = {}) {
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

    function insertExpression(context: Context, code: Expression) {
        const module = Module.instance;
        // type checks -- different handling based on type of code construct
        // focusedNode.returns != code.returns would work, but we need more context to get the right error message
        // context.token is the focused hole in which you want to insert
        // We can only insert expressions in holes / TypedEmptyExpr
        if (context.token instanceof TypedEmptyExpr) {
            // The root of the hole (either an expression or a statement)
            const root = context.token.rootNode;
            // Determine whether the expression "code" can be inserted into the hole
            let insertionResult = root.typeValidateInsertionIntoHole(code, context.token); // REMOVE

            if (insertionResult.insertionType != InsertionType.Invalid) { // IF VALID OR DRAFT MODE
                // For all valid or draft mode insertions
                // This seems to only update the types?
                if (root instanceof Statement) {
                    root.onInsertInto(code);
                }

                // Remove message if there is one
                if (context.token.message && context.selected) {
                    //TODO: This should only be closed if the current insertion would fix the current draft mode. Currently we don't know if that is the case.
                    module.messageController.removeMessageFromConstruct(context.token);
                }

                // Replaces expression with the newly inserted expression
                const expr = code as Expression;
                module.replaceFocusedExpression(expr);

                // Current range
                const range = new Range(
                    context.position.lineNumber,
                    context.token.left,
                    context.position.lineNumber,
                    context.token.right
                );

                // Update the text in the Monaco editor
                module.editor.executeEdits(range, expr);

                //TODO: This should probably run only if the insert above was successful, we cannot assume that it was
                if (!context.token.message) {
                    const newContext = code.getInitialFocus();
                    module.focus.updateContext(newContext);
                }
            }

            if (root instanceof BinaryOperatorExpr) {
                // Type check binary expression
                // root.validateTypes(module);
            } else if (insertionResult.insertionType == InsertionType.DraftMode) {
                module.openDraftMode(code, insertionResult.message, [
                    ...insertionResult.conversionRecords.map((conversionRecord) => {
                        return conversionRecord.getConversionButton(code.getKeyword(), module, code);
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
}
