import { EditCodeAction } from "../editor/action-filter";
import { Actions, InsertActionType, ToolboxCategory } from "../editor/consts";
import { Argument, FunctionCallStmt } from "../syntax-tree/ast";
import { DataType } from "../syntax-tree/consts";
import * as codestructs from "./python.json";

/***
 * TODO: Remove any's and comments between code when API is stable! 
 */


/**
 * Typing definition to which the language configuration files should conform.
 */
interface JsonCodeStruct {
    name: string;
}

const codestructMap = new Map<string, any>();

for (const codestruct of codestructs) {
    console.log(codestruct)
    codestructMap.set(codestruct.name, codestruct);
}

/* EVERYTHING RELATED TO ACTIONS AND EDITCODEACTIONS */

/**
 * Create EditCodeActions in the Action class {@link Actions}
 */
export function getAllCodeActions(): EditCodeAction[] {
    // All code actions
    const editCodeActions: EditCodeAction[] = [];
    // Go through all codestructs
    for (const [key, value] of codestructMap.entries()) {
        // If there are implementations
        if (value.implementations) {
            // Go through all implementations
            for (const implementation of value.implementations) {
                // Create an EditCodeAction
                const action = new EditCodeAction(
                    implementation.editorName,
                    implementation.id,
                    getCodeFunction(implementation.name, implementation.arguments),
                    InsertActionType.InsertPrintFunctionStmt, // EXTRACT; maybe removable?
                    {}, // EXTRACT; context info; maybe extractable from format?
                    implementation.toolbox,
                    ["("], // EXTRACT: character which triggers the insertion in the editor
                    implementation.name, // Match when typing
                    null // EXTRACT: match regex => how does this work?
                );
                // Add the action to the list
                editCodeActions.push(action);
            }
        }

        // If no implementations, create an EditCodeAction for the general codestruct

        // const action = new EditCodeAction()
        // editCodeActions.push(action)
    }
    return editCodeActions;
}

export function addEditCodeActionsToCategories(toolboxCategories: ToolboxCategory[],editCodeActions: EditCodeAction[]): void {
    for (const action of editCodeActions) {
        const currentCategory: string = action.documentation.category
        if (toolboxCategories.some(category => currentCategory === category.displayName)) {
            toolboxCategories.find(category => currentCategory === category.displayName).addEditCodeAction(action);
        } else {
            const newCategory = new ToolboxCategory(currentCategory, currentCategory.toLocaleLowerCase() + "-ops-toolbox-group", [action]);
            toolboxCategories.push(newCategory);
        }
    }
}

/**
 * Builds the function to return a FunctionCallStmt from a list of arguments.
 * 
 * @param name - name of the codestruct e.g. "print"
 * @param str_args - arguments of the function call
 * @returns - a function that returns a FunctionCallStmt
 */
function getCodeFunction(name: string, str_args: any[]): () => FunctionCallStmt {
    const args: Argument[] = [];
    for (const arg of str_args) {
        args.push(new Argument([DataType.Any /* should be changed! */], arg.name, arg.optional));
    }
    return () => new FunctionCallStmt(name, args);
}


/* EVERYTHING RELATED TO ... */