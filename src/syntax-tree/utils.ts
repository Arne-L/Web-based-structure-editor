import { Position, Range } from "monaco-editor";
import { Context } from "../editor/focus";
import {
    Token,
    // EmptyOperatorTkn,
    Statement,
    TypedEmptyExpr,
    TemporaryStmt,
    GeneralStatement,
    Construct,
    Expression,
    CompoundConstruct,
    // BinaryOperatorExpr,
} from "./ast";
import { replaceInBody } from "./body";
import { CallbackType } from "./callback";
import { Module } from "./module";
import { InsertionType } from "./consts";
import { isImportable } from "../utilities/util";
import { InsertionResult } from "../editor/action-filter";

export namespace ASTManupilation {
    export function insertConstruct(context: Context, construct: Construct) {
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
                console.error(
                    `insertConstruct(${context}, ${construct}): When inserting a token in the AST, the context was not valid for insertion`
                );
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
        const range = new Range(statement.lineNumber, statement.leftCol, statement.lineNumber, statement.rightCol);

        // Remove messages from the empty line statement
        if (emptyLine.message) module.messageController.removeMessageFromConstruct(emptyLine);

        // Update the Monaco editor with the new statement
        module.editor.executeEdits(range, statement);
        module.focus.updateContext(statement.getInitialFocus());
    }

    function insertToken(context: Context, code: Token, { toLeft = false, toRight = false } = {}) {
        const module = Module.instance;

        // Token is either a TypedEmptyExpr or an EmptyOperatorTkn (= a hole)
        if (context.token instanceof TypedEmptyExpr /*|| context.token instanceof EmptyOperatorTkn*/) {
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
                context.token.leftCol,
                context.position.lineNumber,
                context.token.rightCol
            );

            // Update the Monaco editor with the given token
            module.editor.executeEdits(range, code);
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
            module.editor.insertAtCurPos([code]);
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
            module.editor.insertAtCurPos([code]);
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
            let insertionResult = new InsertionResult(InsertionType.Valid, "", []); // root.typeValidateInsertionIntoHole(code, context.token); // REMOVE

            if (insertionResult.insertionType != InsertionType.Invalid) {
                // IF VALID OR DRAFT MODE
                // For all valid or draft mode insertions
                // This seems to only update the types?
                // if (root instanceof Statement) {
                //     root.onInsertInto(code);
                // }

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
                    context.token.leftCol,
                    context.position.lineNumber,
                    context.token.rightCol
                );

                // Update the text in the Monaco editor
                module.editor.executeEdits(range, expr);

                //TODO: This should probably run only if the insert above was successful, we cannot assume that it was
                if (!context.token.message) {
                    const newContext = code.getInitialFocus();
                    module.focus.updateContext(newContext);
                }
            }

            // if (root instanceof BinaryOperatorExpr) {
            //     // Type check binary expression
            //     // root.validateTypes(module);
            // } else
            // !!!!!!!!!!!!!!!!!!!!! MIGHT BE IMPORTANT TO GET DRAFT MODE TO WORK
            // if (insertionResult.insertionType == InsertionType.DraftMode) {
            //     module.openDraftMode(code, insertionResult.message, [
            //         ...insertionResult.conversionRecords.map((conversionRecord) => {
            //             return conversionRecord.getConversionButton(code.getKeyword(), module, code);
            //         }),
            //     ]);
            // } else
            // !!!!!!!!!!!!!!!!!!!!!
            if (isImportable(code)) {
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
     * Rebuild all constructs following (and including) the given construct. This function
     * should be used when a constructs boundaries have changed;
     * 
     * TODO: Function currently assumes that the module uses a body, but this will not keep to be
     * te case in the future! Remove this in the future
     * 
     * @param construct - The construct to start rebuilding from
     * @param leftPos - The left position to start rebuilding from
     * @param options - Determines whether the given construct should be rebuilt or if only the
     * constructs following the given construct should be rebuilt
     * @returns The final right position of the last construct built
     */
    export function rebuild(construct: Construct, leftPos: Position, options: { rebuildConstruct: boolean } = { rebuildConstruct: true }) {
        // TEMPORARY SOLUTION: REBUILD EVERYTING that follows

        // Build the given construct if the option is set
        if (options.rebuildConstruct) leftPos = construct.build(leftPos);

        // If the parent is not a module, rebuild all constructs following the given construct
        if (!(construct.rootNode instanceof Module)) {
            // Get all tokens
            const rootTokens = (construct.rootNode as GeneralStatement | CompoundConstruct).tokens;
            // For each of the following constructs, rebuild them
            for (let i = construct.indexInRoot + 1; i < rootTokens.length; i++) {
                rootTokens[i].indexInRoot = i;
                leftPos = rootTokens[i].build(leftPos);
                rootTokens[i].notify(CallbackType.change);
            }

            leftPos = rebuild(construct.rootNode, leftPos, { rebuildConstruct: false });
            // If the parent is a module, rebuild all constructs following the given construct
            // But now looking in the body instead of the tokens, as this is currently programmed like that
        } else {
            const rootTokens = construct.rootNode.body;
            for (let i = construct.indexInRoot + 1; i < rootTokens.length; i++) {
                rootTokens[i].indexInRoot = i;
                leftPos = rootTokens[i].build(leftPos);
                rootTokens[i].notify(CallbackType.change);
            }
        }

        // Return the final right position of the last construct built
        return leftPos;



        // LONG TERM SOLUTION: Call build on all constructs that are on the same line,
        // and only reset the linenumbers of all the following constructs
        // -> Does this actually make a performance difference?

        // if (construct instanceof Token) return construct.build(leftPos);

        // if (!(construct instanceof GeneralStatement) && !(construct instanceof CompoundConstruct)) return;
        
        // const rootTokens = construct.rootNode.tokens;
        // for (let i = construct.indexInRoot; i < construct.tokens.length; i++) {
        //     construct.indexInRoot = i;
        //     if (construct.body[i].hasBody()) rebuild(construct.body[i], leftPos);
        //     else construct.body[i].init(leftPos);
        //     leftPos.lineNumber += construct.body[i].getHeight();
        // }
    }
}
