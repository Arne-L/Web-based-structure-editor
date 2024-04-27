import { CompoundFormatDefinition, ConstructDefinition, FormatDefType } from "../language-definition/definitions";
import { globalFormats } from "../language-definition/parser";
import {
    AssignmentToken,
    CodeConstruct,
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
    /**
     * Construct an array of constructs from the given JSON specification.
     *
     * @param formatTokens - The JSON specification of the constructs
     * @param rootConstruct - The parent construct of the new constructs
     * @param data - Additional data that might be needed for the construct.
     * @returns An array of constructs that represent the JSON specification
     */
    export function constructTokensFromJSON(
        formatTokens: FormatDefType[],
        rootConstruct: CodeConstruct,
        data?: any
    ): Construct[] {
        const constructs: Construct[] = [];
        for (const token of formatTokens) {
            addConstructToken(constructs, token, rootConstruct, data);
        }
        return constructs;
    }

    /**
     * Construct an array of constructs from the given JSON specification.
     * The construction is specific for compound constructs, as it needs 
     * to be able to handle various additional conditions.
     * 
     * @param formatTokens - The JSON specification of the constructs
     * @param rootConstruct - The parent construct of the new constructs
     * @param data - Additional data that might be needed for the construct.
     * @param startingConstructs - The constructs that have already been constructed
     * @param startingIndex - The index at which the construction should start
     * @param initialConstruction - Whether this is the first time the compound's tokens 
     * have been constructed
     * @returns The extended array of constructs that represent the JSON specification
     */
    export function constructTokensFromJSONCompound(
        jsonConstruct: CompoundFormatDefinition,
        rootConstruct: CompoundConstruct,
        data?: any,
        startingConstructs?: Construct[],
        startingIndex?: number,
        initialConstruction = false
    ): Construct[] {
        const constructs: Construct[] = startingConstructs ?? [];

        let i = startingIndex ?? 0;

        // Stopconditions?
        // 1) Coming across a token with "waitOnUser" set to some input
        // 2) When reaching or exceeding a limit ==> Currently NOT implemented
        // Wait actually: calls are recursive ... so ... we don't need the loop to keep on going,
        // we only call when we need to

        // When constructing the compound for the first time, and the first token has waitOnUser set,
        // return the (empty) constructs array
        // Otherwise the loop will always run at least once (as the continue method on the compound
        // only gets called after the waitOnUser key has been pressed)
        if (initialConstruction && stopCondition(jsonConstruct.format[i])) return constructs;

        do {
            if (i === 0 && jsonConstruct.insertBefore)
                // Do we want to allow any token here? Or only non-editable tokens?
                constructs.push(new NonEditableTkn(jsonConstruct.insertBefore, rootConstruct, constructs.length));

            addConstructToken(constructs, jsonConstruct.format[i], rootConstruct, data);

            i = (i + 1) % jsonConstruct.format.length;
        } while (!stopCondition(jsonConstruct.format[i])); // TODO: Does not work if the first construct has a waitOnUser

        // rootConstruct.setElementToInsertNextIndex(i);

        return constructs;
    }

    /**
     * Given a token specification, check if the stop condition is met.
     * 
     * @param token - The token to check for the stop condition
     * @returns True if the token has a stop condition, false otherwise
     */
    function stopCondition(token: FormatDefType): boolean {
        if ("waitOnUser" in token && token.waitOnUser) return true;
        return false;
    }

    /**
     * Given the token specification, add the runtime construct to the constructs array
     *
     * @param constructs - The array of constructs to which the new construct should be added.
     * Often this is the array of constructs of the parent construct.
     * @param token - The token specification from the language definition
     * @param rootConstruct - The parent construct of the new construct
     * @param data - Additional data that might be needed for the construct. Currently, this
     * is only used for the reference token to keep track of the precise variable to which it referes.
     */
    function addConstructToken(constructs: Construct[], token: FormatDefType, rootConstruct: CodeConstruct, data: any) {
        switch (token.type) {
            case "token":
                constructs.push(new NonEditableTkn(token.value, rootConstruct, constructs.length));
                break;
            case "hole":
                // DO we still want this or do we want it to be generalised?
                for (let i = 0; i < token.elements.length; i++) {
                    // THIS DOES INCLUDE ARGUMENT TYPES, WHICH CURRENTLY IS NOT IMPLEMENTED
                    constructs.push(new TypedEmptyExpr([DataType.Any], rootConstruct, constructs.length, token.type));

                    if (i + 1 < token.elements.length)
                        constructs.push(new NonEditableTkn(token.delimiter, rootConstruct, constructs.length));
                }
                break;
            case "body":
                let root = rootConstruct as GeneralStatement;
                // FFD
                root.body.push(new EmptyLineStmt(root, root.body.length));
                root.scope = new Scope();
                // rootConstruct.hasSubValues = true;
                /**
                 * We still need to add scope for constructs without a body like else and elif
                 */
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
                const tokens = constructTokensFromJSON(compositeContent.format, rootConstruct, data);
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
