import { EditCodeAction } from "../editor/action-filter";
import { InsertActionType, ToolboxCategory } from "../editor/consts";
import { GeneralStatement, Statement } from "../syntax-tree/ast";
import * as constructs from "./python.json";

/***
 * TODO: Remove any's and comments between code when API is stable!
 */

/**
 * Typing definition to which the language configuration files should conform.
 */
interface JsonCodeStruct {
    name: string;
}

/* EVERYTHING RELATED TO ACTIONS AND EDITCODEACTIONS AND AST */

/**
 * Create EditCodeActions based on the language configuration file.
 */
export function getAllCodeActions(): EditCodeAction[] {
    // All code actions
    const editCodeActions: EditCodeAction[] = [];
    // Variable to create unique ids even when the name is the same
    let toolboxId = 0;

    // First we make sure that all nested codestructs are flattened, i.e.
    // that all nested implementations are brought to the top level
    const flattenedConstructs: any[] = []; // TODO: Replace the any type

    // Go through all codestructs
    for (const construct of constructs) {
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
            `add-${construct.name}-btn-${toolboxId++}`,
            getCodeFunction(construct),
            InsertActionType.InsertStatement, // EXTRACT; maybe removable?
            // InsertActionType.InsertPrintStmt is superfluous
            {}, // EXTRACT; context info; maybe extractable from format?
            construct.toolbox,
            construct.triggerInsertion, // EXTRACT: character which triggers the insertion in the editor
            // Automating? Maybe take last character before a hole or end of statement?
            construct.match ?? null, // Match when typing
            construct.matchRegex !== undefined ? RegExp(construct.matchRegex) : null // EXTRACT: match regex => Currently only used for VarAssignStmt to
            // identify what a valid identifier is
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
    return editCodeActions;
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
        console.log(action);
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
function getCodeFunction(construct): () => Statement {
    return () => new GeneralStatement(construct);
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
