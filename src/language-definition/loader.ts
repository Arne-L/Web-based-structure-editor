///<reference path="../index.ts" />

import { EditCodeAction } from "../editor/action-filter";
import { InsertActionType, ToolboxCategory } from "../editor/consts";
import { dynamicImport } from "../editor/utils";
import { GeneralExpression, UniConstruct as UniConstruct, Statement } from "../syntax-tree/ast";
import config from "./config.json";
import {
    ConstructDefinition,
    FormatDefType,
    LanguageDefinition,
    RecursiveDefinition,
    ReferenceFormatDefinition,
} from "./definitions";

/**
 * Load the JSON from the language configuration files and make it available through an API.
 */
export class Loader {
    // Keep track of the singleton instance
    private static _instance: Loader;

    // Language specific data
    private _initialConstructDef: FormatDefType;
    private _globalFormats: Map<string, RecursiveDefinition>;
    private _indent: string;
    private _currLanguage: string;

    // JSON file contents
    private _languageConfig: LanguageDefinition;
    private _constructs: ConstructDefinition[];

    /**
     * Get the format definition for the construct with which the editor should be initialised.
     */
    get initialConstructDef(): FormatDefType {
        if (!this._initialConstructDef) throw new Error("Language not set yet");
        return this._initialConstructDef;
    }

    /**
     * Get all the global recursive format definitions for the current language. Each recursive
     * definition consists of a name and a format definition.
     */
    get globalFormats(): Map<string, RecursiveDefinition> {
        if (!this._globalFormats) throw new Error("Language not set yet");
        return this._globalFormats;
    }

    /**
     * Get the indentation string. This can be any string varying from four spaces to a sequence of
     * random characters
     */
    get indent(): string {
        if (!this._indent) throw new Error("Language not set yet");
        return this._indent;
    }

    /**
     * Get the internal name of the language. Most names follow these guidelines:
     * * language name in lowercase
     * * words are separated by an underscore
     * * variants are clearly identified by a suffix such that other variants can easily be added
     * in the future
     */
    get currLanguage(): string {
        if (!this._currLanguage) throw new Error("Language not set yet");
        return this._currLanguage;
    }

    /**
     * Get the user-friendly name of the language.
     */
    get languageName(): string {
        return this._languageConfig.name;
    }

    /**
     * Get the singleton instance of the Loader class.
     */
    static get instance() {
        if (!Loader._instance) Loader._instance = new Loader();
        return Loader._instance;
    }

    /**
     * Create a new instance of the Loader class. This is a singleton class and should not be
     * instantiated directly. Call the static getter `Loader.instance` instead.
     */
    private constructor() {}

    /**
     * Get the main settings for the language. This includes the language name and the reserved
     * words.
     *
     * @returns - An object containing the language name and the reserved words, based on the
     * current language configuration
     */
    mainSettings(): {
        language: string;
        reservedWords: Map<string, Set<string>>;
    } {
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

    /**
     * Update the singleton to contain the given language's settings and configurations.
     *
     * @param language - The language to update to. If not provided, the language will be updated to
     * the default language specified in the main configuration file.
     */
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

    /**
     * Get all the injectable constructs for the current language.
     *
     * @returns An array of all EditCodeActions that can be used in the editor.
     */
    getAllEditCodeActions(): EditCodeAction[] {
        // All code actions
        const editCodeActions: EditCodeAction[] = [];
        // Variable to create unique ids even when the name is the same
        let toolboxId = 0;

        // First we make sure that all nested codestructs are flattened, i.e.
        // that all nested implementations are brought to the top level
        const flattenedConstructs: ConstructDefinition[] = [];

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
                (data?) => new UniConstruct(construct, null, null, data),
                InsertActionType.InsertUniConstruct, // EXTRACT; maybe removable?
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
        UniConstruct.addAllConstructs(editCodeActions.map((action) => action.getCode() as UniConstruct));

        return editCodeActions;
    }
}

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