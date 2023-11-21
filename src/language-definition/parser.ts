import { EditCodeAction } from "../editor/action-filter";
import { Actions, InsertActionType, ToolboxCategory } from "../editor/consts";
import { Argument, FunctionCallStmt, GeneralStatement, KeywordStmt, Statement } from "../syntax-tree/ast";
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

// const codestructMap = new Map<string, any>();

// for (const codestruct of codestructs) {
//     console.log(codestruct);
//     codestructMap.set(codestruct.name, codestruct);
// }

/* EVERYTHING RELATED TO ACTIONS AND EDITCODEACTIONS */

/**
 * Create EditCodeActions in the Action class {@link Actions}
 */
export function getAllCodeActions(): EditCodeAction[] {
    // All code actions
    const editCodeActions: EditCodeAction[] = [];
    // Variable to create unique ids even when the name is the same
    let toolboxId = 0;

    // Go through all codestructs
    for (const construct of codestructs) {
        // If there are implementations, then create an EditCodeAction
        // for each implementation
        if (construct.implementations) {
            // Go through all implementations
            for (const implementation of construct.implementations) {
                // Create an EditCodeAction
                const action = new EditCodeAction(
                    implementation.editorName,
                    `add-${implementation.name}-btn-${toolboxId++}`,
                    // NEXT LINE NEEDS TO BE CLEANED UP!
                    getCodeFunction({...implementation, ...construct}),
                    InsertActionType.InsertStatement, // EXTRACT; maybe removable?
                    // InsertActionType.InsertPrintStmt is superfluous
                    {}, // EXTRACT; context info; maybe extractable from format?
                    implementation.toolbox,
                    construct.triggerInsertion, // EXTRACT: character which triggers the insertion in the editor
                    // Automating? Maybe take last character before a hole or end of statement?
                    implementation.name, // Match when typing
                    null // EXTRACT: match regex => Currently only used for VarAssignStmt to
                    // identify what a valid identifier is => Combine in some form with name
                );
                // Add the action to the list
                editCodeActions.push(action);
            }
        } else {
            const action = new EditCodeAction(
                construct.editorName,
                `add-${construct.name}-btn-${toolboxId++}`,
                getCodeFunction(construct),
                InsertActionType.InsertStatement, // EXTRACT; maybe removable?
                // InsertActionType.InsertPrintStmt is superfluous
                {}, // EXTRACT; context info; maybe extractable from format?
                construct.toolbox,
                construct.triggerInsertion, // EXTRACT: character which triggers the insertion in the editor
                // Automating? Maybe take last character before a hole or end of statement?
                construct.match, // Match when typing
                null // EXTRACT: match regex => Currently only used for VarAssignStmt to
                // identify what a valid identifier is => Combine in some form with name
            );
            // Add the action to the list
            editCodeActions.push(action);
        }
        /**
         * Ideally for cleaner code we would write this as a single statement without
         * repetition => To look at latet!
         */

        // If no implementations, create an EditCodeAction for the general codestruct

        // const action = new EditCodeAction()
        // editCodeActions.push(action)
    }
    return editCodeActions;
}

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
                currentCategory.toLocaleLowerCase() + "-ops-toolbox-group",
                [action]
            );
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
function getCodeFunction(construct): () => Statement {
    console.log(construct);
    return () => new GeneralStatement(construct);
    // if (name === "break")
    //     return () =>
    //         new KeywordStmt(
    //             name,
    //             null,
    //             null,
    //             (c) => true
    //         ); /* last argument is mandatory even though it is marked as optional */
    // const args: Argument[] = [];
    // for (const arg of str_args) {
    //     args.push(new Argument([DataType.Any /* should be changed! */], arg.name, arg.optional));
    // }
    // return () => new FunctionCallStmt(name, args);
}

/* EVERYTHING RELATED TO ... */

/* Not implemented, but IMPORTANT */
/**
 * HOW KeywordStmt should be implemented:
 * 
 * () =>
                new KeywordStmt("break", null, null, (context: Context) => {
                    let parent = context.lineStatement.rootNode as Statement | Module;

                    while (
                        !(parent instanceof WhileStatement) &&
                        !(parent instanceof ForStatement) &&
                        !(parent instanceof Module)
                    ) {
                        parent = parent.rootNode;
                    }

                    if (parent instanceof Module) return false;
                    else return true;
                }),
 */

/**
 * Notes:
 * * In EditCodeAction, the third argument, being a function to a statement or expression
 * is heavily dependent on the specific language feature and is used through all files
 */
