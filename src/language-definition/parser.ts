import { EditCodeAction } from "../editor/action-filter";
import { Actions, InsertActionType } from "../editor/consts";
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
    codestructMap.set(codestruct.name, codestruct);
}

/* EVERYTHING RELATED TO ACTIONS AND EDITCODEACTIONS */

/**
 * Create EditCodeActions in the Action class {@link Actions}
 */
function getAllCodeActions(): EditCodeAction[] {
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
                    InsertActionType.InsertPrintFunctionStmt,
                    {},
                    implementation.toolbox,
                    ["("], // Add these to the end to promote typing
                    implementation.name, // Match when typing
                    null
                );
                // Add the action to the list
                editCodeActions.push(action);
            }
        }
        // const action = new EditCodeAction()
        // editCodeActions.push(action)
    }
    return editCodeActions;
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