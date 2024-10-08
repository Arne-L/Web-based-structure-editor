import { Position, Range } from "monaco-editor";
import { Context } from "../editor/focus";
import {
    CodeConstruct,
    Construct,
    UniConstruct,
    TemporaryConstruct,
    Token,
    HoleTkn,
} from "./ast";
// import { replaceInBody } from "./body";
import { CallbackType } from "./callback";
import { Module } from "./module";

export namespace ASTManupilation {
    export function insertConstruct(context: Context, construct: Construct) {
        const module = Module.instance;
        if (construct instanceof Token) {
            // If on empty line, replace the empty line
            if (module.validator.onEmptyLine(context)) {
                // replaceEmptyStatement(context.lineStatement, new TemporaryStmt(construct));
                replaceWith(context.codeConstruct, new TemporaryConstruct(construct));
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
                insertToken(context, construct, { toRight: true });
            } else if (
                /*module.validator.canSwitchRightNumToAutocomplete(context) || */ module.validator.atLeftOfExpression(
                    context
                )
            ) {
                insertToken(context, construct, { toLeft: true });
            } else {
                console.error(
                    `insertConstruct(${context}, ${construct}): When inserting a token in the AST, the context was not valid for insertion`
                );
            }
        // } else if (construct instanceof GeneralExpression) {
        //     if (module.validator.onEmptyLine(context)) {
        //         replaceWith(context.codeConstruct, construct);
        //     } else if (module.validator.atEmptyHole(context)) {
        //         replaceWith(context.token, construct);
        //     }
        } else if (construct instanceof UniConstruct) {
            // Currently for expressions and statements

            // If on empty line, replace the empty line
            if (module.validator.onEmptyLine(context)) {
                replaceWith(context.codeConstruct, construct);
            }
            // If at empty expression hole, insert the token
            else if (module.validator.atEmptyHole(context)) {
                replaceWith(context.token, construct);
            }
            // Generalise to anything that can be to the left of a token; MAYBE just say switch to autocomplete or something
            else if (
                /*module.validator.canSwitchLeftNumToAutocomplete(context) || */ module.validator.atRightOfExpression(
                    context
                )
            ) {
                replaceWith(context.codeConstructToLeft, construct, true);
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

    // function replaceEmptyStatement(emptyLine: Statement, statement: Statement) {
    //     const module = Module.instance;

    //     // Get the root of the empty line
    //     const root = emptyLine.rootNode as Statement | Module;

    //     // Replace the empty line with the given statement
    //     replaceInBody(root, emptyLine.indexInRoot, statement);

    //     // Notify the root that a replacement has taken place
    //     if (root instanceof Statement) root.notify(CallbackType.replace);

    //     // Get the range of the statement line
    //     // console.log("Statement: ", statement.lineNumber, "emptyLine: ", emptyLine.lineNumber);
    //     const range = new Range(statement.lineNumber, statement.leftCol, statement.lineNumber, statement.rightCol);

    //     // Remove messages from the empty line statement
    //     if (emptyLine.message) module.messageController.removeMessageFromConstruct(emptyLine);

    //     // Update the Monaco editor with the new statement
    //     module.editor.executeEdits(range, statement);
    //     module.focus.updateContext(statement.getInitialFocus());
    // }

    function insertToken(context: Context, code: Token, { toLeft = false, toRight = false } = {}) {
        const module = Module.instance;

        // console.log("InsertToken", context.token, context)

        // Token is either a TypedEmptyExpr or an EmptyOperatorTkn (= a hole)
        if (context.token instanceof HoleTkn /*|| context.token instanceof EmptyOperatorTkn*/) {
            // If there is a focused expression
            let focusedConstruct = context.construct ?? context.token; // Will it not always be context.token? As we are replacing the TypedEmptyExpr tkn?

            if (focusedConstruct) {
                const root = focusedConstruct.rootNode;
                root.replace(code, focusedConstruct.indexInRoot);
            }

            // Get the range of the focused token
            const range = new Range(
                focusedConstruct.left.lineNumber,
                focusedConstruct.leftCol,
                focusedConstruct.right.lineNumber,
                focusedConstruct.rightCol
            );

            // Update the Monaco editor with the given token
            module.editor.executeEdits(range, code);
            // Insert the given token to the right of an expression on the left
        } else if (toRight && context.codeConstructToLeft != null) {
            // Get the parent of the expression to the left
            const root = context.codeConstructToLeft.rootNode;
            // Set the parent of the given token to the parent of the expression to the left
            code.rootNode = root;
            // Add the given token directly after the expression to the left
            // without removing anything
            root.tokens.splice(context.codeConstructToLeft.indexInRoot + 1, 0, code);
            // Rebuild
            root.rebuild(root.getLeftPosition(), 0);
            // Add code construct to Monaco editor
            module.editor.insertAtCurPos([code]);
            // Insert the given token to the left of an expression on the right
        } else if (toLeft && context.codeConstructToRight != null) {
            // Get the parent of the expression to the right
            const root = context.codeConstructToRight.rootNode;
            // Set the parent of the given token to the parent of the expression to the right
            code.rootNode = root;
            // Add token directly before the expression to the right
            root.tokens.splice(context.codeConstructToRight.indexInRoot, 0, code);
            // Rebuild
            root.rebuild(root.getLeftPosition(), 0);
            // Add code construct to Monaco editor
            module.editor.insertAtCurPos([code]);
        }
    }

    /**
     * Replace the given construct with a new construct in the AST.
     * 
     * @param constructToReplace - Construct to be replaced in the AST
     * @param newConstruct - Construct to replace the given construct with
     * @param keep - Whether the constructToReplace should be added as a child of the newConstruct. 
     * If this option is set, the constructToReplace will be placed in the first token slot of the 
     * newConstruct if the first token is a hole and the type matches with the hole 
     */
    export function replaceWith(constructToReplace: Construct, newConstruct: Construct, keep = false) {
        const module = Module.instance;

        // Removing draft mode message if there is one
        // TODO: Will this still be the case in the future?
        if (constructToReplace.message) {
            // Original TODO: This should only be closed if the current insertion would fix the current draft mode. Currently we don't know if that is the case.
            module.messageController.removeMessageFromConstruct(constructToReplace);
        }

        // Optional
        // if (!(context.token instanceof TypedEmptyExpr)) return;

        const root = constructToReplace.rootNode;

        // Set the same root node and indexInRoot as the construct that is being replaced
        newConstruct.rootNode = root;
        newConstruct.indexInRoot = constructToReplace.indexInRoot;
        // Replace construct
        root.tokens[constructToReplace.indexInRoot] = newConstruct;

        // Place the constructToReplace as a child of the new construct (only if the first token
        // is a hole and the type matches)
        if (
            keep &&
            newConstruct instanceof UniConstruct &&
            constructToReplace instanceof UniConstruct &&
            newConstruct.tokens[0] instanceof HoleTkn &&
            constructToReplace.constructType.includes(newConstruct.tokens[0].allowedType)
        ) {
            constructToReplace.rootNode = newConstruct;
            constructToReplace.indexInRoot = 0;
            newConstruct.tokens[0] = constructToReplace;
        }

        // TODO: Scoping (should be fixed)
        // if (newConstruct.hasScope()) newConstruct.scope.parentScope = bodyContainer.scope;

        // Rebuild everything that comes after the statement that is being replaced
        const rebuildPos = constructToReplace.left;
        if (rebuildPos) ASTManupilation.rebuild(newConstruct, rebuildPos);

        // Notify the root that a replacement has taken place
        root.notify(CallbackType.replace);
        // Notify the old construct that it has been deleted
        constructToReplace.notify(CallbackType.delete);

        // Current range
        const range = new Range(
            constructToReplace.left.lineNumber,
            constructToReplace.leftCol,
            constructToReplace.right.lineNumber,
            constructToReplace.rightCol
        );

        // Update the Monaco editor with the new statement
        module.editor.executeEdits(range, newConstruct);
        module.focus.updateContext(newConstruct.getInitialFocus());
    }

    function insertExpression(context: Context, code: Construct) {
        const module = Module.instance;
        // We can only insert expressions in holes / TypedEmptyExpr
        if (!(context.token instanceof HoleTkn)) return;

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
        if (construct.rootNode) {
            // Get all tokens
            const rootTokens = construct.rootNode.tokens;
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
        }
        // else {
        //     const rootTokens = construct.rootNode.body;
        //     for (let i = construct.indexInRoot + 1; i < rootTokens.length; i++) {
        //         rootTokens[i].indexInRoot = i;
        //         leftPos = rootTokens[i].build(leftPos);
        //         rootTokens[i].notify(CallbackType.change);
        //     }
        // }

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

    export function getPrevSiblingOfRoot(construct: Construct): Construct {
        if (construct.indexInRoot === 0) return null;
        // Go to the previous sibling of the current construct
        return construct.rootNode.tokens[construct.indexInRoot - 1];
    }

    export function getNextSiblingOfRoot(construct: Construct): Construct {
        if (!construct.rootNode || construct.indexInRoot === construct.rootNode.tokens.length - 1) return null;
        // Go to the previous sibling of the current construct
        return construct.rootNode.tokens[construct.indexInRoot + 1];
    }

    export function getPrevSibling(construct: Construct): Construct {
        // Keep track of how many levels up the current construct is
        let depth = 0;
        // If the construct is the first in the root, go to the root
        // Keep going up until the construct is not the first in the root
        while (construct.indexInRoot === 0) {
            construct = construct.rootNode;
            if (!construct) return null;
            depth++;
        }
        // Go to the previous sibling of the current construct
        construct = construct.rootNode.tokens[construct.indexInRoot - 1];
        // Try to go back to the original depth by going down the tree again
        while (depth > 0 && construct instanceof CodeConstruct) {
            if (construct.tokens.at(-1)) construct = construct.tokens.at(-1);
            else break;
            depth--;
        }
        // Return the previous sibling
        return construct;
    }

    export function getNextSibling(construct: Construct): Construct {
        // Keep track of how many levels up the current construct is
        let depth = 0;
        // If the construct is the first in the root, go to the root
        // Keep going up until the construct is not the first in the root
        while (construct.indexInRoot === construct.rootNode.tokens.length - 1) {
            construct = construct.rootNode;
            if (!construct) return null;
            depth++;
        }
        // Go to the previous sibling of the current construct
        construct = construct.rootNode.tokens[construct.indexInRoot + 1];
        // Try to go back to the original depth by going down the tree again
        while (depth > 0 && construct instanceof CodeConstruct) {
            if (construct.tokens.at(1)) construct = construct.tokens.at(1);
            else break;
            depth--;
        }
        // Return the previous sibling
        return construct;
    }
}

export namespace Utils {
    /**
     * Ensures that the given argument is a list. If not, the argument is wrapped in a list.
     * 
     * @param arg - The argument to ensure is a list
     * @returns A list, either the argument if it is a list, or a list with the argument as the only element
     */
    export function ensureList<T>(arg: T | T[]): T[] {
        return Array.isArray(arg) ? arg : [arg];
    }
}

export namespace DebugUtils {
    /**
     * Used to print special characters in a string to the console
     *
     * @param str - The string to print
     * @returns The string with special characters printed
     */
    export function escape(str) {
        return str.replace(/[\b\f\n\r\t\v\0\'\"\\]/g, (match) => {
            return {
                "\b": "\\b",
                "\f": "\\f",
                "\n": "\\n",
                "\r": "\\r",
                "\t": "\\t",
                "\v": "\\v",
                "\0": "\\0",
                "'": "\\'",
                '"': '\\"',
                "\\": "\\\\",
            }[match];
        });
    }
}
