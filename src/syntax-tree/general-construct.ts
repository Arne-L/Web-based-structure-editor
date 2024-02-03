import {
    Importable,
    CodeConstruct,
    Statement,
    EmptyLineStmt,
    ImportStatement,
    TypedEmptyExpr,
    NonEditableTkn,
    IdentifierTkn,
} from "./ast";
import { Module } from "./module";
import { Scope } from "./scope";
import { DataType, InsertionType } from "./consts";
import { Validator } from "../editor/validator";
import { Context } from "../editor/focus";

/**
 * Class encapsulating information about constructs that can optionally be contained in a construct.
 * The primary purpose is to be able to specify some constraints on these constructs.
 */
class OptionalConstruct {
    private keyword: string;
    private min_repeat: number;
    private max_repeat: number;

    /**
     * Class encapsulating information about constructs that can optionally be contained in a construct.
     * The primary purpose is to be able to specify some constraints on these constructs.
     *
     * @param keyword - The name of the construct
     * @param min_repeat - The minimum number of times the construct should appear
     * @param max_repeat - The maximum number of times the construct can appear. This should be atleast one.
     */
    constructor(keyword: string, min_repeat?: number, max_repeat?: number, min_level?: number, max_level?: number) {
        if (max_repeat && max_repeat < 1) throw Error("max_repeat should be at least one");
        if (max_repeat && min_repeat && min_repeat > max_repeat)
            throw Error("min_repeat should be smaller than max_repeat");
        this.keyword = keyword;
        this.min_repeat = min_repeat ?? 0;
        this.max_repeat = max_repeat ?? Infinity;
    }

    getConstructName(): string {
        return this.keyword;
    }

    getMinRepetition(): number {
        return this.min_repeat;
    }

    getMaxRepetition(): number {
        return this.max_repeat ?? Infinity;
    }

    isValidRepetition(repetition: number): boolean {
        return repetition >= this.min_repeat && repetition <= this.max_repeat;
    }
}

/**
 * Class encapsulating information about required ancestor constructs.
 * The primary purpose is to be able to specify some constraints on these constructs.
 */
class AncestorConstruct {
    private keyword: string;
    private min_level: number;
    private max_level: number;

    /**
     * Class encapsulating information about required ancestor constructs.
     * The primary purpose is to be able to specify some constraints on these constructs.
     *
     * @param keyword - The name of the construct
     * @param min_level - The minimum level the descendant construct should be at (relative to the
     * ancestor construct), starting with a direct child at level 0.
     * @param max_level - The maximum level the descendant construct can be at (relative to the ancestor
     * construct).
     */
    constructor(keyword: string, min_level?: number, max_level?: number) {
        if (min_level && min_level < 0) throw Error("min_level should be larger than or equal to zero");
        if (max_level && min_level && min_level > max_level) throw Error("min_level should be smaller than max_level");
        this.keyword = keyword;
        this.min_level = min_level ?? 0;
        this.max_level = max_level ?? Infinity;
    }

    getConstructName(): string {
        return this.keyword;
    }

    getMinLevel(): number {
        return this.min_level;
    }

    getMaxLevel(): number {
        return this.max_level;
    }

    /**
     * Checks if the given level is valid, i.e. between min_level and max_level (inclusive)
     *
     * @param level - The level of the descendant construct relative to the ancestor construct
     * @returns - Whether the given level is valid, i.e. between min_level and max_level (inclusive)
     */
    isValidLevel(level: number): boolean {
        return level >= this.min_level && level <= this.max_level;
    }
}

/**
 * Statement class containing functionality for all statements that can be used in the language. It removes the necessity to create a new class for each statement.
 *
 * Data necessary for the statement is loaded from the configuration file and given to the class in the construct argument of the constructor.
 */
export class GeneralStatement extends Statement implements Importable {
    /* THESE SHOULD BE GENERALISED!!! */
    // private argumentsIndices = new Array<number>();
    keyword: string = "";
    requiredModule: string;
    /**
     * Constructs which depend on this construct. For example, the "elif" construct depends on the "if" construct.
     * If this list is empty, constructs can still depend on this, but their order and frequency is not fixed. (E.g.
     * the depending/requiring construct can be inserted anywhere in the body of this construct and as many times as it wants)
     *
     * Currently, all depending constructs are indented by 1 tab. This is not always the case, so this should be
     * generalised in the future.
     */
    private requiringConstructs: OptionalConstruct[] = [];
    /**
     * Constructs which this construct depends on (/ are required by this construct). For example, the "elif" construct depends on the
     * "if" construct, so the "if" is required by the "elif". As a construct can depend on multiple constructs, this list
     * can contain multiple names. (e.g. "else" can appear after "if", but also after "while")
     *
     * IMPORTANT NOTE (TODO): This does introduce redudancy from the user's side as they now have to indicate both for the parent
     * as for the child if they depend on each other. If this is always the case, we might have to write some mapping structure
     * keeping tracking of the requiring constructs and filling in the required constructs automatically.
     * However, currently this is not possible because we assume that requiringConstructs can be empty even though there are
     * constructs depending on it (in this specific case, we specified that the order was not fixed) However, it in the future
     * it follows that this (edge) case does not occur (or has a different solution), we can implement the above optimisation.
     */
    private requiredConstructs: string[] = [];
    private requiredAncestorConstructs: AncestorConstruct[] = [];
    /**
     * Map of all possible constructs. The key is the name of the construct, the value is the construct itself.
     */
    private static constructs: Map<string, CodeConstruct>;

    constructor(construct: any, root?: Statement | Module, indexInRoot?: number) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.keyword = construct.keyword; // Rethink this one; will this really always be the name/keyword? MIGHT BE FIXED

        // Keep track of the current hole
        let holeIndex = 0;

        // If an empty construct is given, we can't do anything with it
        if (!construct || !construct.format) return;

        // Set an invalid tooltip message if available
        this.simpleInvalidTooltip = construct.toolbox.invalidTooptip || ""; // TODO: MAKE MORE CONCRETE

        // Check if the construct requires a different construct, and if so add the requirement
        if (construct.requiresConstruct) {
            if (construct.requiresConstruct instanceof Array) {
                this.requiredConstructs = construct.requiresConstruct;
            } else {
                this.requiredConstructs.push(construct.requiresConstruct);
            }
        }

        // Check if the construct needs to be a descendant of a certain construct, and if so add the requirement
        // Allowed styles: "ancestor", {ref: "ancestor", min_level: 0, max_level: 1}; either as a single element
        // or as an array of elements
        if (construct.requiresAncestor) {
            if (construct.requiresAncestor instanceof Array) {
                this.requiredAncestorConstructs = construct.requiresAncestor.map(
                    (ancestor) =>
                        new AncestorConstruct(ancestor.ref ?? ancestor, ancestor.min_level, ancestor.max_level)
                );
            } else {
                this.requiredAncestorConstructs.push(
                    new AncestorConstruct(
                        construct.requiresAncestor.ref ?? construct.requiresAncestor,
                        construct.requiresAncestor.min_level,
                        construct.requiresAncestor.max_level
                    )
                );
            }
        }

        for (const token of construct.format) {
            switch (token.type) {
                case "construct":
                    /**
                     * Ordered list, in order of appearance in the code, of constructs that require this construct
                     */
                    this.requiringConstructs.push(new OptionalConstruct(token.ref, token.min_repeat, token.max_repeat));

                    // TODO: Remove!
                    // Search in list of all constructs for a corresponding name and insert it ... kinda?
                    // this.tokens.push(new NonEditableTkn(construct.name, this, this.tokens.length)); // Maybe make this editable? See next line ...
                    // this.tokens.push(new EditableTextTkn(construct.name, new RegExp("^[a-zA-Z]*$"), this, this.tokens.length)) // First two arguments should be replaced with something language specific
                    break;
                case "implementation":
                    this.tokens.push(new NonEditableTkn(construct[token.anchor], this, this.tokens.length));
                    break;
                case "token":
                    this.tokens.push(new NonEditableTkn(token.value, this, this.tokens.length));
                    break;
                case "hole":
                    const holeParts = construct.holes[holeIndex];
                    for (let i = 0; i < holeParts.length; i++) {
                        // THIS DOES INCLUDE ARGUMENT TYPES, WHICH CURRENTLY IS NOT IMPLEMENTED
                        this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
                        this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];

                        if (i + 1 < holeParts.length)
                            this.tokens.push(new NonEditableTkn(token.delimiter, this, this.tokens.length));
                    }
                    if (holeParts.length > 0) this.hasEmptyToken = true;
                    holeIndex++;
                    break;
                case "body":
                    this.body.push(new EmptyLineStmt(this, this.body.length));
                    this.scope = new Scope();
                    /**
                     * We still need to add scope for constructs without a body like else and elif
                     */
                    break;
                case "identifier":
                    // this.tokens.push(new EditableTextTkn("", RegExp(token.regex), this, this.tokens.length))
                    this.tokens.push(new IdentifierTkn(undefined, this, this.tokens.length, RegExp(token.regex)));
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

    /**
     * TODO: Temporary solution
     *
     * @param constructs - The constructs to add to the map
     */
    static addAllConstructs(constructs: GeneralStatement[]) {
        console.log("Adding constructs", constructs);
        this.constructs = constructs.reduce((map, construct) => {
            map.set(construct.keyword, construct);
            return map;
        }, new Map());
    }

    getKeyword(): string {
        return this.keyword;
    }

    /**
     * Currently only implemented for statements (or is being implemented for statements ...)
     *
     * @param validator - An instance of the validator class with methods to check the current context
     * @param providedContext - The current context
     * @returns - The insertion type of the construct: valid, draft or invalid
     */
    validateContext(validator: Validator, providedContext: Context): InsertionType {
        const context = providedContext ? providedContext : validator.module.focus.getContext();

        /**
         * The current assumptions are:
         * * Requiring constructs are either an element of the body or a sibling of the required construct
         * * We assume that the requiring constructs are always after the required construct. If a construct
         * has elements before the main construct, the element before can be taken to be the main construct
         * * Currently does not support impeded depeding connstructs e.g. else -> elif -> else -> ...
         * However, simply defining a new construct in the config to encapsulate this repetition should suffice
         *
         * Checking if the required construct appears in front of the requiring construct will currently
         * be implemented through a rudementary algorithm. This can (and maybe should be if it proves to be too slow)
         * in the future by using a sort of sliding window algorithm.
         * A few places to look are:
         * * Take a look at String Matching algorithms in "Ontwerp van algoritmen" (lecture 8) e.g.
         *   Boyer-Moore
         *
         * Further future optimisations:
         * Simply keep track of what is allowed inside the current element instead of having to recheck for each
         * possible insertion you want to make
         */
        // If the element depends on other elements
        if (this.requiredConstructs.length > 0) {
            let canInsertConstruct = false;
            // For each of the constructs which are required by this construct, check if one of them
            // appears (correctly) in front of the current construct
            for (const requiredName of this.requiredConstructs) {
                // TODO: This is currently casted because expression does inherit from Statement and not GeneralStatement => CHANGE IN THE FUTURE
                const requiredConstruct = GeneralStatement.constructs.get(requiredName) as GeneralStatement; // NOT OKAY

                // TODO: Currently the function assumes that each construct will only appear once
                // This is however not always the case, so we should look for a way to generalise
                // this in the future. A possibility is to use a form of sliding window from the back and
                // try to match all construct you came acros in the editor with the constructs in the
                // dependingConstructs list. if there is no match, we can shift the window until it matches
                // again => look at the algorithm used in "Ontwerp van algoritmen" course for this

                // Information about each of the depending constructs in order
                const depConstructsInfo = requiredConstruct.requiringConstructs;

                // Find where the current construct appears in the list of depending constructs
                // TODO: See todo above
                let dependingIndex = depConstructsInfo.findIndex(
                    (construct) => construct.getConstructName() === this.getKeyword()
                );

                // Skip to next required construct; this case should never appear if required and requiring constructs
                // are correctly defined
                if (dependingIndex === -1) continue;

                // Keep track of how many times each depending construct has been visited / appeared, starting
                // from the current construct to the first requiring construct
                const dependingVisited = new Array(dependingIndex).fill(0);

                // The current construct we want to insert also needs to be counted
                // Because we assume that each requiring construct can appear at least once, we do not need to
                // check the constraints
                dependingVisited[dependingIndex] = 1;

                // Depending / requiring construct to start checking from
                let currentConstruct = validator.getPrevSiblingOf(context.lineStatement);
                let prevConstruct = this as Statement; // NOT OKAY

                // There is no construct in front of the current one, so the insertion is invalid
                if (!currentConstruct) break;

                // TODO: Not completely correct: what if there are multiple of the first requiring construct?
                while (dependingIndex >= 0) {
                    // Still the same construct
                    if (currentConstruct.getKeyword() === prevConstruct.getKeyword()) {
                        // Check if it is allowed to have many of the same construct
                        if (dependingVisited[dependingIndex] >= depConstructsInfo[dependingIndex].getMaxRepetition()) {
                            // We are at or over the limit of the current construct
                            // Start working on the next required construct, cause this one is not possible
                            break;
                        }
                        // Current construct has the name of the construct in front of the previous construct
                    } else {
                        // New construct: names are different
                        // First check if the previous construct occured enough times; if not, we need to move on and check the other required constructs
                        if (dependingVisited[dependingIndex] < depConstructsInfo[dependingIndex].getMinRepetition()) {
                            // We are under the limit of the current construct
                            // The insertion is invalid
                            break;
                        }
                        // Move on to the next requiring construct
                        while (
                            dependingIndex >= 0 &&
                            currentConstruct.getKeyword() !== depConstructsInfo[dependingIndex].getConstructName()
                        ) {
                            dependingIndex--;
                        }
                    }
                    // Increase the amount of times the current construct type has been visited
                    dependingVisited[dependingIndex]++;

                    // As long as the depending index is not smaller than zero, we need to look for requiring constructs
                    // Else the current construct is the required construct
                    if (dependingIndex >= 0) {
                        prevConstruct = currentConstruct;
                        currentConstruct = validator.getPrevSiblingOf(currentConstruct) as GeneralStatement; // NOT OKAY

                        // In case there are not yet any constructs in front of the current position
                        if (!currentConstruct) {
                            break;
                        }
                    }
                }

                // Now we are at required construct and we have handled all the depending constructs
                if (currentConstruct && currentConstruct.getKeyword() === requiredConstruct.getKeyword()) {
                    // We found the required construct
                    canInsertConstruct = true;
                }
            }

            if (!canInsertConstruct) return InsertionType.Invalid;
        }

        // If element needs to be a descendant of a certain construct
        if (this.requiredAncestorConstructs.length > 0) {
            let canInsertConstruct = false;

            // Go all the way to the top of the tree, even when we have already matched one construct.
            // We could also take the maximum level over all required ancestor constructs, but
            // in reality this would probably often be infinite.

            // If null, then we are at the top of the tree
            let currentParent = validator.getParentOf(context.lineStatement);
            let level = 0;
            while (currentParent) {
                const foundAncestor = this.requiredAncestorConstructs.find(
                    (ancestor) => ancestor.getConstructName() === currentParent.getKeyword()
                );
                if (foundAncestor && foundAncestor.isValidLevel(level)) {
                    // We found a required ancestor construct
                    canInsertConstruct = true;
                    break;
                }

                currentParent = validator.getParentOf(currentParent);

                level++;
            }

            if (!canInsertConstruct) return InsertionType.Invalid;
        }

        return context.lineStatement instanceof EmptyLineStmt ? InsertionType.Valid : InsertionType.Invalid;
    }

    // DEAD CODE
    // Maybe keep this, as (almost) all general purpose programming languages have something
    // with argument?
    // Maybe generalise this to the simple "replace" from the Statement class
    // replaceArgument(index: number, to: CodeConstruct) {
    //     this.replace(to, this.argumentsIndices[index]);
    // }

    // DEAD CODE
    // Every language has methods/functions/... requiring imports, so this can probably be kept
    // validateImport(importedModule: string, importedItem: string): boolean {
    //     return this.requiredModule === importedModule && this.getKeyword() === importedItem;//&& this.getFunctionName() === importedItem;
    // }

    // I think this is language independent ... HOWEVER, TAKE A LOOK AT IT LATER!!!
    /**
     * Checks if the current construct requires an import and if so checks if it is already included
     * or not in the module. If it is not included, the returned insertion type is DraftMode.
     *
     * @param module - The current Module
     * @param currentInsertionType - The current insertion type of the construct
     * @returns - The new insertion type of the construct
     */
    validateImportOnInsertion(module: Module, currentInsertionType: InsertionType) {
        let insertionType = currentInsertionType;
        let importsOfThisConstruct: ImportStatement[] = [];
        /**
         * Expands the given list with import statements for the same module as the current
         * construct (outer) that are above the current construct (outer).
         *
         * @param construct - Current construc to check if it is an import statement
         * @param stmts - Lists that will be expanded with the import statements which
         * fulfill the requirements
         */
        const checker = (construct: CodeConstruct, stmts: ImportStatement[]) => {
            if (
                construct instanceof ImportStatement &&
                this.getLineNumber() > construct.getLineNumber() && // Check if the import statement is above the current construct (outer)
                this.requiredModule === construct.getImportModuleName() // Check if the current construct (outer) requires the module
            ) {
                stmts.push(construct);
            }
        };

        // Perform "checker" on each of the constructs in the module (statements,
        // expressions, tokens ...)
        module.performActionOnBFS((code) => checker(code, importsOfThisConstruct));

        if (importsOfThisConstruct.length === 0 && this.requiresImport()) {
            //imports of required module don't exist and this item requires an import
            insertionType = InsertionType.DraftMode;
        } else if (importsOfThisConstruct.length > 0 && this.requiresImport()) {
            //imports of required module exist and this item requires an import
            insertionType =
                importsOfThisConstruct.filter((stmt) => stmt.getImportItemName() === this.getKeyword()).length > 0 // this.getFunctionName()
                    ? currentInsertionType
                    : InsertionType.DraftMode;
        }

        return insertionType;
    }

    validateImportFromImportList(imports: ImportStatement[]): boolean {
        const relevantImports = imports.filter(
            (stmt) => stmt.getImportModuleName() === this.requiredModule && this.getLineNumber() > stmt.getLineNumber()
        );

        if (relevantImports.length === 0) {
            return false;
        }

        return relevantImports.filter((stmt) => stmt.getImportItemName() === this.getKeyword()).length > 0
            ? true
            : false;
    }

    requiresImport(): boolean {
        return this.requiredModule !== "";
    }
}
