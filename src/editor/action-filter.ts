import {
    Expression,
    GeneralExpression,
    // ForStatement,
    GeneralStatement,
    // ListComma,
    Modifier,
    Statement,
    // TypedEmptyExpr,
    // ValueOperationExpr,
    // VarAssignmentStmt,
    // VariableReferenceExpr,
    // VarOperationStmt,
} from "../syntax-tree/ast";
import { DataType, InsertionType/*, TypeConversionRecord*/ } from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { Reference } from "../syntax-tree/scope";
import { createFinalConstruct, getHoleValues, getUserFriendlyType } from "../utilities/util";
import { ActionExecutor } from "./action-executor";
import { Actions, EditActionType, InsertActionType } from "./consts";
import { EditAction } from "./data-types";
import { EventRouter } from "./event-router";
import { Context } from "./focus";
import { Validator } from "./validator";

export class ActionFilter {
    module: Module;

    constructor(module: Module) {
        this.module = module;
    }

    /**
     * For each of the predefined actions, create a new EditCodeAction based on the current
     * location (check context and type validation) and add it to the valid map. The EditCodeActions
     * can still be invalid, but they are added to the map regardless.
     *
     * @returns Map of Construct name to corresponding EditCodeAction
     */
    validateInsertions(): Map<string, EditCodeAction> {
        // Get the current context
        const context = this.module.focus.getContext();
        // Initialize the map from string to EditCodeAction
        const validOptionMap: Map<string, EditCodeAction> = new Map<string, EditCodeAction>();
        //need to know InsertionType in case we want to make any visual changes to those options in the suggestion menu

        // loop over all code-constructs and call their validateContext() + typeValidation() => insertionType
        // we are assuming that the action executor will calculate the insertionType again in the execute() function

        // For each of the predefined actions, create a new EditCodeAction (based
        // on the current location) and add it to the valid map
        for (const action of Actions.instance().actionsList) {
            if (action.containsReference) {
                const nearestStmt = context.lineStatement;
                const scope = context.lineStatement.getNearestScope();
                const references = scope.getValidReferences(nearestStmt.getLineNumber());
                for (const reference of references) {

                    // Update the match string and regex if the action contains a reference
                    let matchTxt = action.matchString;
                    let regexTxt = action.matchRegex;
                    if (action.matchString) matchTxt = matchTxt.replace("--", reference.getAssignment().getRenderText());
                    if (action.matchRegex) {
                        const tmpRegexTxt = String(regexTxt).replace("--", reference.getAssignment().getRenderText());
                        new RegExp(tmpRegexTxt.substring(1, tmpRegexTxt.length - 1));
                    }

                    // if (!action.matchRegex) console.error("Match regex is not defined for action: ", action.optionName);


                    validOptionMap.set(
                        Math.random().toString(36).substring(8), // Key is useless, thus should simply be unique
                        EditCodeAction.createDynamicEditCodeAction(
                            action.optionName, // Does this need to be changed? When is this used?
                            action.cssId,
                            () => action.getCodeFunction({ reference: reference.getAssignment().getRenderText() }),
                            action.insertActionType,
                            action.insertData,
                            action.validateAction(this.module.validator, context),
                            action.terminatingChars,
                            matchTxt,
                            regexTxt,
                            action.insertableTerminatingCharRegex
                        )
                    );
                }
            } else {
                validOptionMap.set(
                    action.optionName,
                    EditCodeAction.createDynamicEditCodeAction(
                        action.optionName,
                        action.cssId,
                        action.getCodeFunction,
                        action.insertActionType,
                        action.insertData,
                        action.validateAction(this.module.validator, context),
                        action.terminatingChars,
                        action.matchString,
                        action.matchRegex,
                        action.insertableTerminatingCharRegex
                    )
                );
            }
        }

        return validOptionMap;
    }

    /**
     * Create an empty map - NOT IMPLEMENTED
     *
     * @returns Empty map fron string to EditCodeAction
     */
    validateEdits(): Map<string, EditCodeAction> {
        // console.warn("validateEdits() is not implemented.");

        return new Map<string, EditCodeAction>();
    }

    // /**
    //  * Get all valid EditCodeActions for a given variable reference / that can be used on a variable reference
    //  *
    //  * TAKE A NEW LOOK AT THIS FUNCTION IN THE FUTURE
    //  *
    //  * @param ref - Variable reference to check against
    //  * @returns - Map of EditCodeActions that are valid for the given variable reference
    //  */
    // validateVariableOperations(ref: VariableReferenceExpr): Map<string, EditCodeAction> {
    //     // TEMPORARY DISABLED DUE TO ERRORS: TAKE A LOOK AT THIS FUNCTION IN THE FUTURE
    //     return new Map<string, EditCodeAction>();

        // // Get current context
        // const context = this.module.focus.getContext();
        // // Datatype of the variable reference
        // const dataType = ref.returns;
        // // Get the modifiers that are available for the given datatype
        // const availableModifiers = Actions.instance().varActionsMap.get(dataType);
        // // Initialize the map from string to EditCodeAction
        // const validOptionMap: Map<string, EditCodeAction> = new Map<string, EditCodeAction>();

        // // If there are modifiers available for the given datatype
        // if (availableModifiers) {
        //     // For each of the modifiers
        //     for (const varOperation of availableModifiers) {
        //         // Get the statement / expression associated with the operation
        //         const code = varOperation.action() as Expression;

        //         if (code instanceof GeneralStatement && code.containsAssignments()) {
        //             // Handles both the old VarAssignmentStmt and the ForStatement
        //             code.setAssignmentIdentifier(ref.identifier, 0);
        //         } else if (code instanceof ValueOperationExpr) {
        //             code.setVariable(ref);
        //             code.updateReturnType();
        //         } else if (code instanceof VarOperationStmt) {
        //             code.setVariable(ref);
        //             code.updateModifierTypes();
        //         }

        //         let optionName = code.getRenderText();

        //         if (code instanceof GeneralStatement && code.containsAssignments()) {
        //             //if (code instanceof ForStatement) {
        //             // optionName is in editor text which is empty, so we need to change it
        //             // (back) to the dashed version
        //             optionName = optionName.replace(/   /g, " --");
        //         } else optionName = optionName.replace(/   /g, " ---");

        //         const codeAction = new EditCodeAction(
        //             optionName,
        //             "",
        //             () => {
        //                 const code = varOperation.action() as Expression;

        //                 if (code instanceof GeneralStatement && code.containsAssignments()) {
        //                     // Handles both the old VarAssignmentStmt and the ForStatement
        //                     code.setAssignmentIdentifier(ref.identifier, 0);
        //                 } else if (code instanceof ValueOperationExpr) {
        //                     code.setVariable(ref);
        //                     code.updateReturnType();
        //                 } else if (code instanceof VarOperationStmt) {
        //                     code.setVariable(ref);
        //                     code.updateModifierTypes();
        //                 }

        //                 return code;
        //             },
        //             code instanceof Statement && !(code instanceof Expression)
        //                 ? InsertActionType.InsertVarOperationStmt
        //                 : InsertActionType.InsertValOperationExpr,
        //             {},
        //             null,
        //             [""],
        //             "",
        //             null
        //         );
        //         // Validate the possible insertion in the current context and type validation
        //         codeAction.insertionResult = codeAction.validateAction(this.module.validator, context);
        //         // Add a short description to the EditCodeAction
        //         codeAction.shortDescription = varOperation.description;
        //         // Add to the map of valid options
        //         validOptionMap.set(codeAction.optionName, codeAction);
        //     }
        // }

        // return validOptionMap;
    // }

    /**
     * Combined list of all insertions at the current location as EditCodeActions. These elements
     * can still be invalid or in draft mode, so they are not necessarily valid insertions.
     * This includes predefined constructs, variable references, variable operations and edits.
     *
     * @returns Combined list of all insertions at the current location
     */
    getProcessedInsertionsList(): EditCodeAction[] {
        const inserts: EditCodeAction[] = [];
        inserts.push(...this.getProcessedConstructInsertions());
        inserts.push(...this.getProcessedEditInsertions());
        // inserts.push(...this.getProcessedVariableInsertions());
        // inserts.push(...this.getProcessedVariableOperations());

        return inserts;
    }

    // /**
    //  * Get an array of all valid variable references at the current location,
    //  * encapsulated in EditCodeActions
    //  *
    //  * @returns
    //  */
    // getProcessedVariableInsertions(): EditCodeAction[] {
    //     // Get all valid variable reference insertions at the current location and
    //     // return them to a list of EditCodeActions
    //     return this.convertInsertionMapToList(this.validateVariableInsertions());
    // }

    /**
     * Currently just returns an empty list
     *
     * @returns Empty list
     */
    getProcessedEditInsertions(): EditCodeAction[] {
        return this.convertInsertionMapToList(this.validateEdits());
    }

    /**
     * Get all predefined constructs, adapted to the current location, as EditCodeActions
     *
     * @returns Adapted predefined constructs as EditCodeActions
     */
    getProcessedConstructInsertions(): EditCodeAction[] {
        return this.convertInsertionMapToList(this.validateInsertions());
    }

    // /**
    //  *
    //  *
    //  * @returns
    //  */
    // getProcessedVariableOperations(): EditCodeAction[] {
    //     // Get the current context
    //     const context = this.module.focus.getContext();
    //     // Get all variable references at the current location that are either valid or in draft mode
    //     const availableRefs: [Reference, InsertionType][] = Validator.getValidVariableReferences(
    //         context.selected ? context.token : context.lineStatement,
    //         this.module.variableController
    //     );

    //     // Map of all actions that are valid on the current variable references
    //     const validActionsForVar: Map<string, EditCodeAction>[] = [];

    //     // For each of the available references
    //     for (const refRecord of availableRefs) {
    //         // Get the assignment to which it refers
    //         const assignment = refRecord[0].getAssignment();
    //         // const dataType = this.module.variableController.getVariableTypeNearLine(
    //         //     context.lineStatement.hasScope() ? context.lineStatement.scope : context.lineStatement.rootNode.scope,
    //         //     context.lineStatement.lineNumber,
    //         //     assignment.getRenderText()
    //         // );
    //         // Create a new VariableReferenceExpr
    //         const varRef = new VariableReferenceExpr(
    //             assignment.getRenderText(),
    //             DataType.Any,
    //             "RANDOM_CSS_ID" // SOMETHING RANDOM AS THIS IS NOT USED ANYMORE
    //         );

    //         // Get all valid operations on the variable reference
    //         validActionsForVar.push(this.validateVariableOperations(varRef));
    //     }

    //     // Transform the map of actions to a list
    //     const actionsList: EditCodeAction[] = [];
    //     for (const map of validActionsForVar) {
    //         actionsList.push(...this.convertInsertionMapToList(map));
    //     }

    //     return actionsList;
    // }

    // getValidInsertsFromSet(optionNames: string[]): EditCodeAction[] {
    //     const constructMap = this.validateInsertions();
    //     const varMap = this.validateVariableInsertions();
    //     const editsMap = this.validateEdits();

    //     const inserts: EditCodeAction[] = [];

    //     for (const option of optionNames) {
    //         if (
    //             constructMap.get(option) &&
    //             constructMap.get(option).insertionResult.insertionType !== InsertionType.Invalid
    //         ) {
    //             inserts.push(constructMap.get(option));
    //         } else if (
    //             varMap.get(option) &&
    //             varMap.get(option).insertionResult.insertionType !== InsertionType.Invalid
    //         ) {
    //             inserts.push(varMap.get(option));
    //         } else if (
    //             editsMap.get(option) &&
    //             editsMap.get(option).insertionResult.insertionType !== InsertionType.Invalid
    //         ) {
    //             inserts.push(editsMap.get(option));
    //         }
    //     }

    //     return inserts;
    // }

    /**
     * Get all values of the map in a list
     *
     * @param insertionMap - Map of string to EditCodeAction
     * @returns A list containing all the EditCodeActions from the map in the same order
     */
    private convertInsertionMapToList(insertionMap: Map<string, EditCodeAction>): EditCodeAction[] {
        // const inserts = [];
        // for (const [key, value] of insertionMap.entries()) {
        //     inserts.push(value);
        // }

        // return inserts;
        return Array.from(insertionMap.values());
    }
}

export class UserAction {
    // Can remove export
    optionName: string;
    cssId: string;

    constructor(optionName: string, cssId: string) {
        this.optionName = optionName;
        this.cssId = cssId;
    }

    validateAction(validator: Validator, context: Context): InsertionResult {
        return new InsertionResult(InsertionType.Invalid, "", []);
    }

    performAction(executor: ActionExecutor, eventRouter: EventRouter, context: Context, source: {}) {}
}

export class EditCodeAction extends UserAction {
    insertActionType: InsertActionType;
    insertData: any = {};
    getCodeFunction: (data?: { reference: string }) => Statement | Expression;
    terminatingChars: string[];
    insertionResult: InsertionResult;
    matchString: string;
    matchRegex: RegExp;
    insertableTerminatingCharRegex: RegExp[];
    trimSpacesBeforeTermChar: boolean;
    documentation: any;
    shortDescription?: string;
    containsReference: boolean = false;

    /**
     * Handles the code action from the toolbox / suggestion menu to the eventual insertion in the editor
     *
     * @param optionName - The name of the code that will be displayed in the toolbox, e.g. "print(---)"
     * @param cssId - The id of the button associated with this code in the toolbox
     * @param getCodeFunction - A function that when called will return the corresponding statement / expression
     * @param insertActionType - A {@link InsertActionType} that determines which insert action the code action
     * represents. E.g. InsertPrintFunctionStmt, InsertStatement, InsertExpression, etc.
     * @param insertData - Context information about the action
     * @param documentation - Documentation about the statemene / expression
     * @param terminatingChars - Used to determine when to insert the code when the user
     * is typing. It works in conjuction with the matchString. If the string matches completely with
     * matchString and one of the terminintingChars is typed, the code is inserted in the editor.
     * This is often the last character of the codestruct before typing a new statement / expression / operation / ...
     * @param matchString - The string to match on for code completion when typing.
     * @param matchRegex -
     * @param insertableTerminatingCharRegex - Similar to terminatingChars, but now a regex can be given
     * @param trimSpacesBeforeTermChar
     */
    constructor(
        optionName: string,
        cssId: string,
        getCodeFunction: (data?: { reference: string }) => Statement | Expression,
        insertActionType: InsertActionType,
        insertData: any = {},
        documentation: any,
        terminatingChars: string[],
        matchString: string,
        matchRegex: RegExp,
        insertableTerminatingCharRegex?: RegExp[],
        trimSpacesBeforeTermChar: boolean = false
    ) {
        super(optionName, cssId);

        this.getCodeFunction = getCodeFunction;
        this.insertActionType = insertActionType;
        this.insertData = insertData;
        this.documentation = documentation;
        this.terminatingChars = terminatingChars;
        this.matchString = matchString;
        this.matchRegex = matchRegex;
        this.insertableTerminatingCharRegex = insertableTerminatingCharRegex;
        this.trimSpacesBeforeTermChar = trimSpacesBeforeTermChar;
    }

    static createDynamicEditCodeAction(
        optionName: string,
        cssId: string,
        getCodeFunction: () => Statement | Expression,
        insertActionType: InsertActionType,
        insertData: any = {},
        insertionResult: InsertionResult, // Determines if the EditCodeAction is valid or not, aka disabled in the toolbox or not
        terminatingChars: string[],
        matchString: string,
        matchRegex: RegExp,
        insertableTerminatingCharRegex?: RegExp[]
    ) {
        const action = new EditCodeAction(
            optionName,
            cssId,
            getCodeFunction,
            insertActionType,
            insertData,
            null,
            terminatingChars,
            matchString,
            matchRegex,
            insertableTerminatingCharRegex
        );

        action.insertionResult = insertionResult;

        return action;
    }

    // getUserFriendlyReturnType(): string {
    //     const code = this.getCode();

    //     if (code instanceof Expression && !(code instanceof Modifier) && !(code instanceof ListComma))
    //         return getUserFriendlyType(code.returns);
    //     else return "";
    // }

    getCode() {
        return this.getCodeFunction();
    }

    /**
     * Get the final text string of the given editCodeAction, augmented with possible
     * user input
     *
     * @param action - The editCodeAction to get the full rendered text of. This includes the
     * base text as well as all possible completions through the input text of the user
     * @returns Final construct that would be put in the editor
     */
    getConstruct(userInput: string): GeneralStatement {
        // Create an EditAction that contains all information to create the final construct
        // The EditActionType is not used in the createFinalConstruct function and can thus
        // be anythin
        const editaction = new EditAction(EditActionType.InsertGeneralStmt, {
            construct: this.getCode(),
            autocompleteData: { values: getHoleValues(userInput, this.matchRegex) },
        });
        // Get the final code construct
        return createFinalConstruct(editaction);
    }

    /**
     * Get the final text string of the given editCodeAction, augmented with possible
     * user input
     *
     * @param action - The editCodeAction to get the full rendered text of. This includes the
     * base text as well as all possible completions through the input text of the user
     * @returns Final string that would be put in a text editor
     */
    getConstructText(userInput: string): string {
        // Get the final code snippet as a string
        return this.getConstruct(userInput).getRenderText();
    }

    /**
     * Text to display in user facing locations for the current action
     * while staying aware of the current user input
     *
     * @param userInput - The current user input
     * @returns Text to display in context aware locations such as the
     * autocomplete menu
     */
    getDisplayText(userInput: string): string {
        // Get the predefined option name
        let displayText = this.optionName;

        // If the matchString is a string, no holes need to be filled thus we
        // can simply return the optionName
        if (this.matchString) return displayText;

        // Get a list of strings to put in order in each of the holes
        const values = getHoleValues(userInput, this.matchRegex);

        // For each of the substrings extracted from the user input
        for (const value of values) {
            // If the value is null or undefined, the user did not yet reach
            // that part of the regex and we can thus safely break the loop
            if (value === null || value === undefined) break;

            // Determine the index of a text slot and a hole
            const textIndex = displayText.indexOf("--"),
                holeIndex = displayText.indexOf("---");

            // If neither a text slot nor a hole is found, there are no
            // more slots to fill and we can break the loop
            if (textIndex === -1 && holeIndex === -1) break;

            // If the text slot comes before the hole, replace the text slot
            // Else replace the hole
            // Additional condition parts are to make sure that if no text or hole
            // is found, the correct branch is still executed
            if ((textIndex < holeIndex && textIndex !== -1) || holeIndex === -1) {
                displayText = displayText.replace("--", value);
            } else {
                displayText = displayText.replace("---", value);
            }
        }

        return displayText;
    }

    //TODO: #526 this might need some updates when that is implemented
    /**
     * Perform both the validation and the type validation of the action:
     * It checks if the construct associated with the action can be inserted
     * at the current location and if the types match.
     *
     * TYPING SHOULD LATER BE REMOVED!
     *
     * @param validator - The validator to use
     * @param context - The current context
     * @returns
     */
    validateAction(validator: Validator, context: Context): InsertionResult {
        // Get the statement / expression associated with this action
        const code = this.getCode();
        // Check if the given code can be inserted at the current location
        // Either valid, draft or invalid
        const astInsertionType = code.validateContext(validator, context);

        if (!(code instanceof GeneralExpression)) {
            // Code is not an expression; however, this method requires it to be an expression
            return new InsertionResult(astInsertionType, "We should never be seeing this message.", []);
        } else if (astInsertionType !== InsertionType.Invalid && code instanceof GeneralExpression) {
            // Either draft or valid AND the code is an expression
            if (context.selected) {
                // Check if the types of the hole and the inserted expression match
                return new InsertionResult(InsertionType.Valid, "", []); //context.token.rootNode.typeValidateInsertionIntoHole(code, context.token as TypedEmptyExpr); //NOTE: The only expression that can be inserted outside of an empty hole is a variable reference and that will be changed in the future with the introduction of a separate code construct for that
            } else if (!context.selected) {
                // Should always be a hole and thus there is always a selection
                return new InsertionResult(astInsertionType, "We should never be seeing this message.", []);
            } else {
                // This should logically be inachievable (as previous if statemetents are mutual recursive)
                return new InsertionResult(InsertionType.Invalid, "", []);
            }
        } else {
            // We should never see an expression that is invalid in this method
            return new InsertionResult(astInsertionType, "We should never be seeing this message.", []);
        }
    }

    performAction(
        executor: ActionExecutor,
        eventRouter: EventRouter,
        providedContext: Context,
        source: {},
        autocompleteData?: {}
    ) {
        // Current context
        let context = providedContext;

        if (autocompleteData) context = executor.deleteAutocompleteOnMatch(providedContext);

        const editAction = eventRouter.routeToolboxEvents(this, context, source);

        if (editAction.data) editAction.data.autocompleteData = autocompleteData;
        else editAction.data = { autocompleteData };

        executor.execute(editAction, context);
    }
}

//TODO: #526, if we decide to go with message codes, should include the code that would map to the message.
export class InsertionResult {
    insertionType: InsertionType;
    message: string;
    // conversionRecords: TypeConversionRecord[];

    constructor(insertionType: InsertionType, msg: string, typeConversionRecord: /*TypeConversionRecord*/[]) {
        this.insertionType = insertionType;
        this.message = msg;
        // this.conversionRecords = typeConversionRecord;
    }
}
