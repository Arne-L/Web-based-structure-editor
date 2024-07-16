///<reference path="../index.ts" />

import { EditCodeAction } from "../editor/action-filter";
import { InsertActionType, ToolboxCategory } from "../editor/consts";
import { dynamicImport } from "../editor/utils";
import { GeneralExpression, GeneralStatement, Statement } from "../syntax-tree/ast";
import config from "./config.json";
import {
    ConstructDefinition,
    FormatDefType,
    LanguageDefinition,
    RecursiveDefinition,
    ReferenceFormatDefinition,
} from "./definitions";

console.log("Parser");

// console.log(currLanguage)

/**
 * Transform json into usable objects and information
 */
export class Loader {
    private static _instance: Loader;

    private _initialConstructDef: FormatDefType;
    private _globalFormats: Map<string, RecursiveDefinition>;
    private _indent: string;
    private _currLanguage: string;

    // File contents
    private _languageConfig: LanguageDefinition;
    private _constructs: ConstructDefinition[];

    get initialConstructDef() {
        if (!this._initialConstructDef) throw new Error("Language not set yet");
        return this._initialConstructDef;
    }

    get globalFormats() {
        if (!this._globalFormats) throw new Error("Language not set yet");
        return this._globalFormats;
    }

    get indent() {
        if (!this._indent) throw new Error("Language not set yet");
        return this._indent;
    }

    get currLanguage() {
        if (!this._currLanguage) throw new Error("Language not set yet");
        return this._currLanguage;
    }

    static get instance() {
        if (!Loader._instance) Loader._instance = new Loader();
        return Loader._instance;
    }

    private constructor() {}

    initLanguage() {
        return {
            language: this._languageConfig.name,
            reservedWords: new Map<string, Set<string>>(
                (this._languageConfig.reservedWords ?? []).map((reservedCategory) => [
                    reservedCategory.reason,
                    new Set(reservedCategory.words),
                ])
            ),
        };
    }

    async updateLanguage(language?: string) {
        // Update the current language
        this._currLanguage = language ?? config.language;

        // Load the different config files
        this._languageConfig = await dynamicImport(`${this._currLanguage}.json`);
        this._constructs = await dynamicImport(`${this._languageConfig.constructFile}`);
        const recursiveFormats = await dynamicImport(`${this._languageConfig.callableFile}`);

        // Load the initial starting structure for the editor
        this._initialConstructDef = this._languageConfig.initialConstruct;
        // Load the JSON-definitions for the global - function like - constructs
        this._globalFormats = new Map(
            recursiveFormats.map((format) => {
                const { name, ...formatData } = format;
                return [format.name, formatData];
            })
        );
        // Load the indent-string from the language configuration file
        this._indent = this._languageConfig.indent;
    }

    getAllCodeActions(): EditCodeAction[] {
        // All code actions
        const editCodeActions: EditCodeAction[] = [];
        // Variable to create unique ids even when the name is the same
        let toolboxId = 0;

        // First we make sure that all nested codestructs are flattened, i.e.
        // that all nested implementations are brought to the top level
        const flattenedConstructs: ConstructDefinition[] = []; // TODO: Replace the any type

        // Go through all codestructs
        for (const construct of this._constructs) {
            // If there are implementations, bring them to the top level
            if (construct.implementations) {
                // Go through all implementations
                for (const implementation of construct.implementations) {
                    // Add the implementation to the list of constructs
                    flattenedConstructs.push({ ...implementation, ...construct });
                }
            } else {
                // If no implementations, add the construct to the list of constructs
                flattenedConstructs.push(construct);
            }
        }

        // Now we have a list of all given constructs, including the implementations

        // Go through all constructs
        for (const construct of flattenedConstructs) {
            const action = new EditCodeAction(
                construct.editorName,
                `add-${construct.keyword}-btn-${toolboxId++}`,
                getCodeFunction(construct),
                construct.constructType === "expression"
                    ? InsertActionType.InsertGeneralExpr
                    : InsertActionType.InsertGeneralStmt, // EXTRACT; maybe removable?
                // InsertActionType.InsertPrintStmt is superfluous
                {}, // EXTRACT; context info; maybe extractable from format?
                construct.toolbox,
                construct.triggerInsertion ?? [], // EXTRACT: character which triggers the insertion in the editor
                // Automating? Maybe take last character before a hole or end of statement?
                construct.match ?? null, // Match when typing
                construct.matchRegex !== undefined && construct.matchRegex !== null
                    ? RegExp(construct.matchRegex)
                    : null // EXTRACT: match regex => Currently only used for VarAssignStmt to
                // identify what a valid identifier is
            );

            // MAYBE MAKE THIS CLEANER IN THE FUTURE? IDEALLY REMOVE THIS SETTING ALTOGETHER
            action.referenceType = (
                construct.format.find((struct) => struct.type === "reference") as ReferenceFormatDefinition
            )?.to;

            // Add the action to the list

            editCodeActions.push(action);
        }

        // Add all corresponding constructs to the AST class field "this.constructs".
        // This field contains all constructs available to the editor, with the keys being
        // the heywords of the constructs and the values being the constructs themselves.
        GeneralStatement.addAllConstructs(editCodeActions.map((action) => action.getCode() as GeneralStatement));

        /**
         * Ideally for cleaner code we would write this as a single statement without
         * repetition => To look at latet!
         */

        // If no implementations, create an EditCodeAction for the general codestruct

        // const action = new EditCodeAction()
        // editCodeActions.push(action)
        return editCodeActions;
    }
}

// export let INITIALCONSTRUCTDEF;
// export let globalFormats;
// export let INDENT;

// let languageConfig: LanguageDefinition;
// let constructs: ConstructDefinition[];

// export async function loadLanguageFiles(language?: string) {
//     // Dynamically import the correct language and constructs
//     if (config.languageFile)
//         languageConfig = (await import(`../language-definition/${language ? language + ".json" : config.languageFile}`))
//             .default;
//     else throw new Error("The language-file field is not correctly specified in the configuration file");

//     if (languageConfig.constructFile)
//         constructs = (await import(`../language-definition/${languageConfig.constructFile}`)).default;
//     else throw new Error("No construct file specified in the language configuration file");

//     let recursiveFormats: RecursiveDefinition[];
//     if (languageConfig.callableFile)
//         recursiveFormats = (await import(`../language-definition/${languageConfig.callableFile}`)).default;
//     else throw new Error("No recursive file specified in the language configuration file");

//     languageConfig.initialConstruct;
//     globalFormats = new Map(
//         recursiveFormats.map((format) => {
//             const { name, ...formatData } = format;
//             return [format.name, formatData];
//         })
//     );
//     INDENT = languageConfig.indent;
// }

// /* EVERYTHING RELATED TO ACTIONS AND EDITCODEACTIONS AND AST */

// /**
//  * Create EditCodeActions based on the language configuration file.
//  */
// export function getAllCodeActions(): EditCodeAction[] {
//     // All code actions
//     const editCodeActions: EditCodeAction[] = [];
//     // Variable to create unique ids even when the name is the same
//     let toolboxId = 0;

//     // First we make sure that all nested codestructs are flattened, i.e.
//     // that all nested implementations are brought to the top level
//     const flattenedConstructs: ConstructDefinition[] = []; // TODO: Replace the any type

//     // Go through all codestructs
//     for (const construct of constructs) {
//         // If there are implementations, bring them to the top level
//         if (construct.implementations) {
//             // Go through all implementations
//             for (const implementation of construct.implementations) {
//                 // Add the implementation to the list of constructs
//                 flattenedConstructs.push({ ...implementation, ...construct });
//             }
//         } else {
//             // If no implementations, add the construct to the list of constructs
//             flattenedConstructs.push(construct);
//         }
//     }

//     // Now we have a list of all given constructs, including the implementations

//     // Go through all constructs
//     for (const construct of flattenedConstructs) {
//         const action = new EditCodeAction(
//             construct.editorName,
//             `add-${construct.keyword}-btn-${toolboxId++}`,
//             getCodeFunction(construct),
//             construct.constructType === "expression"
//                 ? InsertActionType.InsertGeneralExpr
//                 : InsertActionType.InsertGeneralStmt, // EXTRACT; maybe removable?
//             // InsertActionType.InsertPrintStmt is superfluous
//             {}, // EXTRACT; context info; maybe extractable from format?
//             construct.toolbox,
//             construct.triggerInsertion ?? [], // EXTRACT: character which triggers the insertion in the editor
//             // Automating? Maybe take last character before a hole or end of statement?
//             construct.match ?? null, // Match when typing
//             construct.matchRegex !== undefined && construct.matchRegex !== null ? RegExp(construct.matchRegex) : null // EXTRACT: match regex => Currently only used for VarAssignStmt to
//             // identify what a valid identifier is
//         );

//         // MAYBE MAKE THIS CLEANER IN THE FUTURE? IDEALLY REMOVE THIS SETTING ALTOGETHER
//         action.referenceType = (
//             construct.format.find((struct) => struct.type === "reference") as ReferenceFormatDefinition
//         )?.to;

//         // Add the action to the list

//         editCodeActions.push(action);
//     }

//     // Add all corresponding constructs to the AST class field "this.constructs".
//     // This field contains all constructs available to the editor, with the keys being
//     // the heywords of the constructs and the values being the constructs themselves.
//     GeneralStatement.addAllConstructs(editCodeActions.map((action) => action.getCode() as GeneralStatement));

//     /**
//      * Ideally for cleaner code we would write this as a single statement without
//      * repetition => To look at latet!
//      */

//     // If no implementations, create an EditCodeAction for the general codestruct

//     // const action = new EditCodeAction()
//     // editCodeActions.push(action)
//     return editCodeActions;
// }

/**
 * Expands the toolboxCategories with the given EditCodeActions. If one of the EditCodeActions
 * contains a new category, then a new ToolboxCategory is created and added to the list.
 *
 * @param toolboxCategories - List of existing toolbox categories. This list will be updated
 * in place
 * @param editCodeActions - List of the newly created EditCodeActions, so the ones that
 * are loaded dynamically, and thus do not yet have a category
 */
export function addEditCodeActionsToCategories(
    toolboxCategories: ToolboxCategory[],
    editCodeActions: EditCodeAction[]
): void {
    for (const action of editCodeActions) {
        const currentCategory: string = action.documentation.category;
        if (toolboxCategories.some((category) => currentCategory === category.displayName)) {
            toolboxCategories.find((category) => currentCategory === category.displayName).addEditCodeAction(action);
        } else {
            const newCategory = new ToolboxCategory(
                currentCategory,
                currentCategory.toLowerCase() + "-ops-toolbox-group",
                [action]
            );
            toolboxCategories.push(newCategory);
        }
    }
}

/**
 * Builds the function to return a FunctionCallStmt from a list of arguments.
 *
 * @param construct - An object containing the information to build the GeneralStatement
 * @returns - a function that returns a GeneralStatement
 */
function getCodeFunction(construct): (data?: { reference: string }) => Statement {
    // Currently handle expression and statement separately
    // Merge them into one in the future
    if (construct.constructType === "expression") return (data?) => new GeneralExpression(construct, null, null, data);
    else return (data?) => new GeneralStatement(construct, null, null, data);
}

// export function initLanguage() {
//     return {
//         language: languageConfig.name,
//         reservedWords: new Map<string, Set<string>>(
//             (languageConfig.reservedWords ?? []).map((reservedCategory) => [
//                 reservedCategory.reason,
//                 new Set(reservedCategory.words),
//             ])
//         ),
//     };
// }
