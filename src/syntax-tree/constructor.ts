import {
    AssignmentToken,
    EditableTextTkn,
    EmptyLineStmt,
    GeneralStatement,
    NonEditableTkn,
    ReferenceTkn,
    TypedEmptyExpr,
} from "./ast";
import { DataType } from "./consts";
import { Scope } from "./scope";

export namespace SyntaxConstructor {
    export function constructTokensFromJSON(jsonConstruct: any, codeconstruct: GeneralStatement, data: any) {
        let holeIndex = 0;
        for (const token of jsonConstruct.format) {
            switch (token.type) {
                case "implementation":
                    codeconstruct.tokens.push(
                        new NonEditableTkn(jsonConstruct[token.anchor], codeconstruct, codeconstruct.tokens.length)
                    );
                    break;
                case "token":
                    codeconstruct.tokens.push(
                        new NonEditableTkn(token.value, codeconstruct, codeconstruct.tokens.length)
                    );
                    break;
                case "hole":
                    const holeParts = jsonConstruct.holes[holeIndex];
                    for (let i = 0; i < holeParts.length; i++) {
                        // THIS DOES INCLUDE ARGUMENT TYPES, WHICH CURRENTLY IS NOT IMPLEMENTED
                        codeconstruct.tokens.push(
                            new TypedEmptyExpr([DataType.Any], codeconstruct, codeconstruct.tokens.length)
                        );

                        if (i + 1 < holeParts.length)
                            codeconstruct.tokens.push(
                                new NonEditableTkn(token.delimiter, codeconstruct, codeconstruct.tokens.length)
                            );
                    }
                    if (holeParts.length > 0) codeconstruct.hasEmptyToken = true;
                    holeIndex++;
                    codeconstruct.hasSubValues = true;
                    break;
                case "body":
                    codeconstruct.body.push(new EmptyLineStmt(codeconstruct, codeconstruct.body.length));
                    codeconstruct.scope = new Scope();
                    codeconstruct.hasSubValues = true;
                    /**
                     * We still need to add scope for constructs without a body like else and elif
                     */
                    break;
                case "identifier":
                    // codeconstruct.tokens.push(new EditableTextTkn("", RegExp(token.regex), codeconstruct, codeconstruct.tokens.length))
                    codeconstruct.tokens.push(
                        new AssignmentToken(undefined, codeconstruct, codeconstruct.tokens.length, RegExp(token.regex))
                    );
                    codeconstruct.addAssignmentIndex(codeconstruct.tokens.length - 1); // Maybe add codeconstruct in the token itself
                    break;
                case "reference":
                    codeconstruct.tokens.push(
                        new ReferenceTkn(data?.reference ?? "", codeconstruct, codeconstruct.tokens.length)
                    );
                    break;
                case "collection":
                    break;
                case "editable":
                    codeconstruct.tokens.push(
                        new EditableTextTkn(
                            token.value ?? "",
                            RegExp(token.regex),
                            codeconstruct,
                            codeconstruct.tokens.length
                        )
                    );
                    break;
                default:
                    // Invalid type => What to do about it?
                    console.warn("Invalid type: " + token.type);

                /**
                 * 1) How will we handle new lines / empty lines? What will the configuration file require?
                 * 2) Handle scope: how do we know when a statement has a scope or not? Can we determine
                 * this whithout having to make it an explicit option?
                 *
                 * Possibilities:
                 * 2) If the concept of statements exist, check if the construct contains a
                 * statement. If so, it has a scope. If not, it doesn't.
                 * 1) If the concept of statements exists, we can check if a hole is a statement. If
                 * so, then we can see it as a EmptyLineStmt
                 * => Problem: User error possible and even likely
                 * 1) We can look at holes before and after which there is a new line character "\n",
                 * signifying that the hole is the only thing on the line. In this case, we can assume
                 * that it is a empty line statement.
                 *
                 *
                 * What about expressions that can be placed on empty lines? Like methods call e.g. print()
                 *
                 *
                 * How to handle "validateContext"?
                 * Maybe we can have slots in which only certain statements / expressions can be inserted?
                 *
                 * How to handle scope for "elif" and "else"? Currently this is done by checking
                 * if a statement has body, but that is not possible for "elif" and "else"
                 *
                 * All variable functionality in the for-loop is currently dropped
                 * What is the best way to add this in the future?
                 */
            }
        }
    }
}
