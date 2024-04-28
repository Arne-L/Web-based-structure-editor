import { Position, Range } from "monaco-editor";
import { InsertionResult } from "../editor/action-filter";
import { Context } from "../editor/focus";
import { isImportable } from "../utilities/util";
import {
    CompoundConstruct,
    Construct,
    // Expression,
    GeneralStatement,
    // EmptyOperatorTkn,
    Statement,
    TemporaryStmt,
    Token,
    TypedEmptyExpr,
} from "./ast";
import { replaceInBody } from "./body";
import { CallbackType } from "./callback";
import { InsertionType } from "./consts";
import { Module } from "./module";

export namespace ASTManupilation {
    export function insertConstruct(context: Context, construct: Construct) {
        const module = Module.instance;
        if (construct instanceof Token) {
            // If on empty line, replace the empty line
            if (module.validator.onEmptyLine(context)) {
                replaceEmptyStatement(context.lineStatement, new TemporaryStmt(construct));
            }
            // If at empty expression hole, insert the token
            else if (module.validator.atEmptyHole(context)) {
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
            else if (module.validator.atEmptyHole(context)) {
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
            if (context.codeconstruct != null) {
                // Get the parent of the expression
                const root = context.codeconstruct.rootNode as Statement; // Statement or any of its derived classes
                // Replace in the parent the expression with the given token
                root.replace(code, context.codeconstruct.indexInRoot);
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

    function insertExpression(context: Context, code: Construct) {
        const module = Module.instance;
        // We can only insert expressions in holes / TypedEmptyExpr
        if (!(context.token instanceof TypedEmptyExpr)) return;

        // Remove message if there is one
        if (context.token.message && context.selected) {
            //TODO: This should only be closed if the current insertion would fix the current draft mode. Currently we don't know if that is the case.
            module.messageController.removeMessageFromConstruct(context.token);
        }

        // Replaces expression with the newly inserted expression
        module.replaceFocusedExpression(code);

        // Current range
        const range = new Range(
            context.token.left.lineNumber,
            context.token.leftCol,
            context.token.right.lineNumber,
            context.token.rightCol
        );

        // Update the text in the Monaco editor
        module.editor.executeEdits(range, code);

        //TODO: This should probably run only if the insert above was successful, we cannot assume that it was
        if (!context.token.message) {
            module.focus.updateContext(code.getInitialFocus());
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
    export function rebuild(
        construct: Construct,
        leftPos: Position,
        options: { rebuildConstruct: boolean } = { rebuildConstruct: true }
    ) {
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

            // Update the right position of root node
            construct.rootNode.right = leftPos;

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
