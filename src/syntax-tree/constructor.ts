import { CompoundFormatDefinition, ConstructDefinition, FormatDefType } from "../language-definition/definitions";
import { globalFormats } from "../language-definition/parser";
import {
    AssignmentToken,
    CompoundConstruct,
    Construct,
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
    export function constructTokensFromJSON(
        jsonConstruct: ConstructDefinition,
        rootConstruct: GeneralStatement,
        data?: any
    ): Construct[] {
        const constructs: Construct[] = [];
        let holeIndex = 0;
        for (const token of jsonConstruct.format) {
            switch (token.type) {
                case "implementation":
                    // Do we still want this?
                    constructs.push(new NonEditableTkn(jsonConstruct[token.anchor], rootConstruct, constructs.length));
                    break;
                case "token":
                    constructs.push(new NonEditableTkn(token.value, rootConstruct, constructs.length));
                    break;
                case "hole":
                    // DO we still want this or do we want it to be generalised?
                    const holeParts = jsonConstruct.holes[holeIndex];
                    for (let i = 0; i < holeParts.length; i++) {
                        // THIS DOES INCLUDE ARGUMENT TYPES, WHICH CURRENTLY IS NOT IMPLEMENTED
                        constructs.push(new TypedEmptyExpr([DataType.Any], rootConstruct, constructs.length));

                        if (i + 1 < holeParts.length)
                            constructs.push(new NonEditableTkn(token.delimiter, rootConstruct, constructs.length));
                    }
                    // Try to remove these field accessors in the future
                    if (holeParts.length > 0) rootConstruct.hasEmptyToken = true;
                    holeIndex++;
                    rootConstruct.hasSubValues = true;
                    break;
                case "body":
                    // FFD
                    rootConstruct.body.push(new EmptyLineStmt(rootConstruct, rootConstruct.body.length));
                    rootConstruct.scope = new Scope();
                    rootConstruct.hasSubValues = true;
                    /**
                     * We still need to add scope for constructs without a body like else and elif
                     */
                    break;
                case "identifier":
                    // constructs.push(new EditableTextTkn("", RegExp(token.regex), codeconstruct, constructs.length))
                    constructs.push(
                        new AssignmentToken(undefined, rootConstruct, constructs.length, RegExp(token.regex))
                    );
                    break;
                case "reference":
                    constructs.push(new ReferenceTkn(data?.reference ?? "", rootConstruct, constructs.length));
                    break;
                case "editable":
                    constructs.push(
                        new EditableTextTkn(token.value ?? "", RegExp(token.regex), rootConstruct, constructs.length)
                    );
                    break;
                case "recursive":
                    // constructs.push(new CompositeConstruct(token.recursiveName));
                    break;
                case "compound":
                    constructs.push(new CompoundConstruct(token, rootConstruct, constructs.length));
                    break;
                default:
                    // Invalid type => What to do about it?
                    console.warn("Invalid type for the given token: " + token);

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
        return constructs;
    }

    /**
     * TEMPORARY: should be merged with the function above
     *
     * @param jsonConstruct
     * @param rootConstruct
     * @param data
     * @returns
     */
    export function constructTokensFromJSONCompound(
        jsonConstruct: CompoundFormatDefinition,
        rootConstruct: CompoundConstruct,
        data?: any,
        startingConstructs?: Construct[],
        startingIndex?: number
    ): Construct[] {
        const constructs: Construct[] = startingConstructs ?? [];

        let i = startingIndex ?? 0;
        // Stopconditions?
        // 1) Coming across a token with "waitOnUser" set to some input
        // 2) When reaching or exceeding a limit ==> Currently NOT implemented
        // Wait actually: calls are recursive ... so ... we don't need the loop to keep on going,
        // we only call when we need to
        do {
            if (i === 0 && jsonConstruct.insertBefore)
                // Do we want to allow any token here? Or only non-editable tokens?
                constructs.push(new NonEditableTkn(jsonConstruct.insertBefore, rootConstruct, constructs.length));

            addConstructToken(constructs, jsonConstruct.format[i], rootConstruct, data);

            i = (i + 1) % jsonConstruct.format.length;
        } while (!stopCondition(jsonConstruct.format[i])) // Does not work if the first construct has a waitOnUser

        rootConstruct.setElementToInsertNextIndex(i);

        return constructs;
    }

    function stopCondition(token: FormatDefType): boolean {
        if ("waitOnUser" in token && token.waitOnUser) return true;
        return false;
    }

    function hopefullytemp(jsonConstruct: FormatDefType[], rootConstruct: Construct, data?: any) {
        // Maybe replace it entirely with a reduce?
        const constructs: Construct[] = [];

        for (const token of jsonConstruct) {
            addConstructToken(constructs, token, rootConstruct, data);
        }
        return constructs;
    }

    function addConstructToken(constructs: Construct[], token: FormatDefType, rootConstruct: Construct, data: any) {
        switch (token.type) {
            case "token":
                constructs.push(new NonEditableTkn(token.value, rootConstruct, constructs.length));
                break;
            case "identifier":
                constructs.push(new AssignmentToken(undefined, rootConstruct, constructs.length, RegExp(token.regex)));
                break;
            case "reference":
                constructs.push(new ReferenceTkn(data?.reference ?? "", rootConstruct, constructs.length));
                break;
            case "editable":
                constructs.push(
                    new EditableTextTkn(token.value ?? "", RegExp(token.regex), rootConstruct, constructs.length)
                );
                break;
            case "recursive":
                const compositeContent = globalFormats.get(token.recursiveName);
                const tokens = hopefullytemp(compositeContent.format, rootConstruct, data);
                constructs.push(...tokens);
                // constructs.push(new CompositeConstruct(token.recursiveName));
                break;
            case "compound":
                constructs.push(new CompoundConstruct(token, rootConstruct, constructs.length));
                break;
            default:
                // Invalid type => What to do about it?
                console.warn("Invalid type for the given token: " + token);
        }
    }
}
