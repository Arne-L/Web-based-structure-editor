import { Position, Range, Selection } from "monaco-editor";
import { EMPTYIDENTIFIER, TAB_SPACES } from "../language-definition/settings";
import { ConstructHighlight } from "../messages/messages";
import { Callback, CallbackType } from "./callback";
import { SyntaxConstructor } from "./constructor";
import { CodeConstructType, InsertionType, ScopeType, Tooltip } from "./consts";
import { scopeHeuristic } from "./heuristics";
import { Module } from "./module";
import { Scope } from "./scope";
import { ASTManupilation } from "./utils";
import { ValidatorNameSpace } from "./validator";
export class Construct {
    /**
     * The parent/root node for this code-construct. Statements are the only code construct that could have the Module as their root node.
     */
    root;
    /**
     * The index this item has inside its root's body, or its tokens array.
     */
    indexInRoot;
    /**
     * The left column position of this code-construct.
     */
    left;
    /**
     * The right column position of this code-construct.
     */
    right;
    /**
     * A warning or error message for this code construct. (null if there are no messages)
     */
    message;
    /**
     * Whether this code construct is in draft mode or not. Always false for Tokens
     */
    draftModeEnabled = false;
    draftRecord = null;
    // codeConstructName: ConstructName;
    callbacks = new Map();
    callbacksToBeDeleted = new Map();
    simpleDraftTooltip = Tooltip.None;
    simpleInvalidTooltip = Tooltip.None;
    constructor() {
        // Initialise the callbacks
        for (const type in CallbackType)
            this.callbacks[type] = new Array();
    }
    /**
     * The column number of the left position of this construct.
     */
    get leftCol() {
        return this.left?.column;
    }
    /**
     * The column number of the right position of this construct.
     */
    get rightCol() {
        return this.right?.column;
    }
    /**
     * The line number of the construct.
     */
    get lineNumber() {
        return this.left.lineNumber;
    }
    get hasEmptyToken() {
        return false;
    }
    get rootNode() {
        return this.root;
    }
    set rootNode(root) {
        this.root = root;
    }
    /**
     * Get the entire range of the construct, including potential child constructs.
     *
     * @param param0 - { selectIndent: boolean }: If the initial indent should be included in the selection range
     * @returns The range of the construct including all children
     */
    getBoundaries() {
        return new Range(this.left.lineNumber, this.leftCol, this.right.lineNumber, this.rightCol);
    }
    /**
     * Returns the left-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    getLeftPosition() {
        return this.left;
    }
    /**
     * Returns the right-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    getRightPosition() {
        return this.right;
    }
    getHeight() {
        return this.right.lineNumber - this.left.lineNumber + 1;
    }
    /**
     * Returns a `Selection` object for this particular code-construct when it is selected
     */
    getSelection() {
        return new Selection(this.left.lineNumber, this.leftCol, this.right.lineNumber, this.rightCol);
    }
    /**
     * Subscribes a callback to be fired when the this code-construct is changed (could be a change in its children tokens or the body)
     */
    subscribe(type, callback) {
        this.callbacks[type].push(callback);
    }
    /**
     * Removes all subscribes of the given type for this code construct
     */
    unsubscribe(type, callerId) {
        let index = -1;
        for (let i = 0; i < this.callbacks[type].length; i++) {
            if (this.callbacks[type][i].callerId == callerId) {
                index = i;
                break;
            }
        }
        if (index >= 0)
            this.callbacks[type].splice(index, 1);
    }
    /**
     * Method that needs to run when focus is moved off the construct
     *
     * @param arg - JavaScript object containing information about the focus event
     */
    onFocusOff(arg) {
        return;
    }
    /**
     * Puts a callback on the stack to be deleted
     *
     * @param callbackType - The type of the callback to be marked for deletion
     * @param callbackId - The id of the callback to be marked for deletion
     */
    markCallbackForDeletion(callbackType, callbackId) {
        this.callbacksToBeDeleted.set(callbackType, callbackId);
    }
    //TODO: This functionality needs to be merged with what Issue #526
    //This should be completely unnecessary once this is integrated with our validation inside of action-filter.ts and validaiton methods such as validateContext
    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct cannot be inserted. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    getSimpleInvalidTooltip() {
        return this.simpleInvalidTooltip;
    }
    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct would trigger draft mode. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    getSimpleDraftTooltip() {
        return this.simpleDraftTooltip;
    }
    /**
     * Method to be run when the construct is deleted
     */
    onDelete() {
        return;
    }
    /**
     * Highlight the given construct with the given colour
     *
     * @param construct - The construct to highlight
     * @param rgbColour - The colour to highlight the construct with
     */
    addHighlight(rgbColour, editor) {
        new ConstructHighlight(editor, this, rgbColour);
    }
}
export class CodeConstruct extends Construct {
    // Maybe Tokens instead of Construct, but tokens should then encapsulate constructs
    tokens = new Array();
    /**
     * Keep track of the allowed types of the holes
     */
    holeTypes = new Map();
    /**
     * List of all assignments within the statement.
     */
    assignmentIndices = [];
    // TODO: TEMP - REMOVE IN THE FUTURE
    body = new Array();
    // TODO: TEMP
    hasBody() {
        return false;
    }
    /**
     * Check if the construct is changeable or has changeable parts
     */
    get hasSubValues() {
        return this.tokens.some((val) => val.hasSubValues);
    }
    /**
     * Whether the construct has changeable parts.
     *
     * @returns True if subparts of the construct can be changed, such as subexpressions
     * or changeable tokens, otherwise false
     */
    isAtomic() {
        return !this.hasSubValues;
    }
    /**
     * Get all AssignmentTokens within the statement which contain all identifier information.
     *
     * @returns All AssignmentTokens within the statement
     */
    getAssignments() {
        return this.assignmentIndices.map((index) => {
            if (this.tokens[index] instanceof AssignmentTkn)
                return this.tokens[index];
            else
                console.error(`Token at index ${index} within ${this} is not an assignment token`);
        });
    }
    addAssignmentIndex(index) {
        this.assignmentIndices.push(index);
    }
    /**
     * Set the identifier of the assignment token at the given index to the given identifier
     */
    setAssignmentIdentifier(identifier, index) {
        if (this.tokens[index] instanceof AssignmentTkn) {
            this.tokens[index].setIdentifierText(identifier); // Should maybe be setEditedText
        }
        else
            console.error(`Token at index ${index} within ${this} is not an assignment token`);
    }
    /**
     * Whether the statement contains any assignments
     *
     * @returns true if the statement contains any assignments, false otherwise
     */
    containsAssignments() {
        return this.assignmentIndices.length > 0;
    }
    /**
     * Replaces this node in its root, and then rebuilds the parent (recursively)
     * @param code the new code-construct to replace
     * @param index the index to replace at
     */
    replace(code, index) {
        // Notify the token being replaced
        const toReplace = this.tokens[index];
        if (toReplace)
            toReplace.notify(CallbackType.delete);
        // prepare the new Node
        code.rootNode = this;
        code.indexInRoot = index;
        // prepare to rebuild siblings and root (recursively)
        const rebuildPos = this.tokens[index].left;
        // replace
        //TODO: Update focus here? It is good up until now. But once the new construct is inserted, it is not being focused.
        //The focus goes to the end of line
        this.tokens[index] = code;
        // if (rebuildColumn) this.rebuild(new Position(this.lineNumber, rebuildColumn), index);
        if (rebuildPos)
            ASTManupilation.rebuild(code, rebuildPos);
        // this.updateHasEmptyToken(code);
        this.notify(CallbackType.replace);
    }
    build(pos) {
        this.left = pos;
        let curPos = pos;
        // The left position of the first token is the left position of the expression
        for (const token of this.tokens)
            curPos = token.build(curPos);
        // After going through all tokens, the right position is the right position of the last token
        this.right = curPos;
        // Notify all (child)construct of the change
        this.notify(CallbackType.change);
        // Return the right position of the construct
        return curPos;
    }
    /**
     * Rebuilds the left and right positions of this node recursively. Optimized to not rebuild untouched nodes.
     *
     * TODO: Rewrite / make more efficient (e.g. if only changing the current line, no need
     * to all following constructs on the next lines)
     *
     * @param pos - The left position to start building the nodes from
     * @param fromIndex - The index of the node that was edited.
     */
    rebuild(pos, fromIndex) {
        // TODO: Check if this is correct and / or can be simplified and / or generalised
        let curPos = pos;
        // rebuild siblings:
        for (let i = fromIndex; i < this.tokens.length; i++) {
            this.tokens[i].indexInRoot = i;
            curPos = this.tokens[i].build(curPos);
        }
        // The right position of the last token is the right position of the construct
        this.right = curPos;
        // If the construct has a root node, rebuild all constructs following this construct in the root node
        if (this.rootNode != undefined && this.indexInRoot != undefined) {
            ASTManupilation.rebuild(this, curPos, { rebuildConstruct: false });
        }
        else
            console.warn("node did not have rootNode or indexInRoot: ", this.tokens);
        this.notify(CallbackType.change);
    }
    onReplaceToken(args) {
        return;
    }
    toString() {
        let text = "";
        for (const token of this.tokens)
            text += token.getRenderText();
        return text;
    }
    getModule() {
        return Module.instance;
    }
}
/**
 * A complete code statement such as: variable assignment, function call, conditional, loop, function definition, and other statements.
 */
export class Statement extends CodeConstruct {
    body = new Array();
    scope = null;
    background = null;
    message = null;
    keywordIndex = -1;
    simpleInvalidTooltip = Tooltip.InvalidInsertStatement;
    constructor() {
        super();
        this.subscribe(CallbackType.delete, new Callback(() => {
            this.onDelete();
        }));
    }
    /**
     * The lineNumbers from the beginning to the end of this construct, including child constructs.
     */
    getHeight() {
        if (this.body.length == 0)
            return 1;
        else {
            let height = 1;
            for (const line of this.body)
                height += line.getHeight();
            return height;
        }
    }
    /**
     * This should be true for every statement that has a body.
     */
    hasScope() {
        return this.scope != null;
    }
    /**
     * Get the nearest scope if there is one.
     * The nearest scope is either the scope of the current statement or the scope of the
     * nearest parent statement with a scope.
     *
     * @returns the nearest scope if there is one, otherwise null
     */
    getNearestScope() {
        return this.scope ?? this.rootNode?.getNearestScope();
    }
    hasBody() {
        return this.body.length > 0;
    }
    getBoundaries() {
        return new Range(this.left.lineNumber, this.leftCol, this.right.lineNumber, this.rightCol);
    }
    // DO WE STILL WANT THIS FUNCTION OR DO WE WANT TO INTEGRATE IT WITH THE POSITION?
    setLineNumber(lineNumber) {
        // TEMPORARY FIX FOR THE LINE NUMBER
        // this.lineNumber = lineNumber;
        const lineDiff = this.right.lineNumber - this.left.lineNumber;
        this.left = new Position(lineNumber, this.leftCol);
        this.right = new Position(lineNumber + lineDiff, this.rightCol);
        this.notify(CallbackType.change);
        for (const token of this.tokens) {
            if (token instanceof Expression)
                token.setLineNumber(lineNumber);
            token.notify(CallbackType.change);
        }
    }
    /**
     * Call all callbacks of the given type on this statement and on all of its tokens.
     *
     * @param type - The type of the callback to be notified
     */
    notify(type) {
        for (const callback of this.callbacks[type])
            callback.callback(this);
        // We call callbacks on all token of a statement as well
        for (const token of this.tokens) {
            token.notify(type);
        }
        if (this.callbacksToBeDeleted.size > 0) {
            for (const entry of this.callbacksToBeDeleted) {
                this.unsubscribe(entry[0], entry[1]);
            }
            this.callbacksToBeDeleted.clear();
        }
    }
    /**
     * Recursively build the construct and all its children / body constructs.
     *
     * As a side effect, this function sets the left and right positions and linenumber
     * of the construct and all its children.
     *
     * @param pos - Left position to start building the nodes from
     */
    init(pos) {
        // Build the current statement
        // This also sets the left and right positions and the linenumber of the sconstruct
        this.build(pos);
        // Guard clause
        if (!this.hasBody())
            return;
        // Do the same for its children
        for (let i = 0; i < this.body.length; i++)
            // The left position(s) for the children
            this.body[i].build(new Position(pos.lineNumber + i + 1, pos.column + TAB_SPACES));
    }
    getInitialFocus() {
        for (let token of this.tokens) {
            if (token instanceof Token && token.isEmpty)
                return { tokenToSelect: token };
            else {
                let expr = token;
                if (expr.hasEmptyToken)
                    return expr.getInitialFocus();
            }
        }
        return { positionToMove: this.right /*new Position(this.getLineNumber(), this.rightCol)*/ };
    }
    // /**
    //  * This function should be called after replacing a token within this statement. it checks if the newly added token `isEmpty` or not, and if yes, it will set `hasEmptyToken = true`
    //  * @param code the newly added node within the replace function
    //  */
    // updateHasEmptyToken(code: Construct) {
    //     // TODO: Check if code is always a TypedEmptyExpression or not
    //     // if (code instanceof Token) {
    //     //     if (code.isEmpty) this.hasEmptyToken = true;
    //     //     else this.hasEmptyToken = false;
    //     // }
    // }
    /**
     * TODO: Needs to become the same as the tostring function
     * @returns
     */
    getRenderText() {
        let leftPosToCheck = 1;
        let txt = "";
        let textToAdd = "\n";
        for (const token of this.tokens)
            txt += token.getRenderText();
        // FFD
        if (this.hasBody()) {
            leftPosToCheck = this.leftCol + TAB_SPACES - 1;
            if (leftPosToCheck != 1)
                for (let i = 0; i < leftPosToCheck; i++)
                    textToAdd += " ";
        }
        for (const stmt of this.body)
            txt += textToAdd + stmt.getRenderText();
        return txt;
    }
    /**
     * Returns the textual value of the statement's particular line
     *
     * TODO: should only work until a newline character (\n) is encountered
     */
    getLineText() {
        let txt = "";
        for (const token of this.tokens)
            txt += token.getRenderText();
        return txt;
    }
    getFirstLineNumber() {
        return this.lineNumber;
    }
    getNearestCodeConstruct(type) {
        if (!type || type === CodeConstructType.UniConstruct)
            return this;
        return this.rootNode?.getNearestCodeConstruct(type);
    }
    updateScope() {
        for (const tkn of this.tokens)
            tkn.updateScope();
    }
    /**
     * Returns the Module
     *
     * @returns the module of the whole system
     */
    getModule() {
        return Module.instance;
    }
    // getRootBody(): Array<Statement> {
    //     if (this.rootNode instanceof Module) this.rootNode.body;
    //     else if (this.rootNode instanceof Statement && this.rootNode.hasBody()) return this.rootNode.body;
    //     throw Error("Statement must have a root body.");
    // }
    /**
     * Return this statement's keyword if it has one. Otherwise return an empty string.
     *
     * @returns text representation of statement's keyword or an empty string if it has none
     */
    getKeyword() {
        if (this.keywordIndex > -1)
            return this.tokens[this.keywordIndex].text;
        return "";
    }
}
/**
 * Class encapsulating information about constructs that can optionally be contained in a construct.
 * The primary purpose is to be able to specify some constraints on these constructs.
 */
class OptionalConstruct {
    keyword;
    min_repeat;
    max_repeat;
    /**
     * Class encapsulating information about constructs that can optionally be contained in a construct.
     * The primary purpose is to be able to specify some constraints on these constructs.
     *
     * @param keyword - The name of the construct
     * @param min_repeat - The minimum number of times the construct should appear
     * @param max_repeat - The maximum number of times the construct can appear. This should be atleast one.
     */
    constructor(keyword, min_repeat, max_repeat) {
        if (max_repeat && max_repeat < 1)
            throw Error("max_repeat should be at least one");
        if (max_repeat && min_repeat && min_repeat > max_repeat)
            throw Error("min_repeat should be smaller than max_repeat");
        this.keyword = keyword;
        this.min_repeat = min_repeat ?? 0;
        this.max_repeat = max_repeat ?? Infinity;
    }
    getConstructName() {
        return this.keyword;
    }
    getMinRepetition() {
        return this.min_repeat;
    }
    getMaxRepetition() {
        return this.max_repeat ?? Infinity;
    }
    isValidRepetition(repetition) {
        return repetition >= this.min_repeat && repetition <= this.max_repeat;
    }
}
/**
 * Class encapsulating information about required ancestor constructs.
 * The primary purpose is to be able to specify some constraints on these constructs.
 */
class AncestorConstruct {
    keyword;
    min_level;
    max_level;
    /**
     * Class encapsulating information about required ancestor constructs.
     * The primary purpose is to be able to specify some constraints on these constructs.
     *
     * @param keyword - The name of the construct
     * @param min_level - The minimum level the ancestor construct should be at (relative to the
     * current construct), starting with a direct parent at level 0. If not specified, it defaults to 0.
     * @param max_level - The maximum level the ancestor construct can be at (relative to the current
     * construct). If not specified, it defaults to Infinity.
     */
    constructor(keyword, min_level, max_level) {
        if (min_level && min_level < 0)
            throw Error("min_level should be larger than or equal to zero");
        if (max_level && min_level && min_level > max_level)
            throw Error("min_level should be smaller than max_level");
        this.keyword = keyword;
        this.min_level = min_level ?? 0;
        this.max_level = max_level ?? Infinity;
    }
    getConstructName() {
        return this.keyword;
    }
    getMinLevel() {
        return this.min_level;
    }
    getMaxLevel() {
        return this.max_level;
    }
    /**
     * Checks if the given level is valid, i.e. between min_level and max_level (inclusive)
     *
     * @param level - The level of the descendant construct relative to the ancestor construct
     * @returns - Whether the given level is valid, i.e. between min_level and max_level (inclusive)
     */
    isValidLevel(level) {
        return level >= this.min_level && level <= this.max_level;
    }
}
/**
 * Statement class containing functionality for all statements that can be used in the language. It removes the necessity to create a new class for each statement.
 *
 * Data necessary for the statement is loaded from the configuration file and given to the class in the construct argument of the constructor.
 */
export class GeneralStatement extends Statement {
    // private argumentsIndices = new Array<number>();
    keyword = "";
    /**
     * Constructs which depend on this construct. For example, the "elif" construct depends on the "if" construct.
     * If this list is empty, constructs can still depend on this, but their order and frequency is not fixed. (E.g.
     * the depending/requiring construct can be inserted anywhere in the body of this construct and as many times as it wants)
     *
     * Currently, all depending constructs are indented by 1 tab. This is not always the case, so this should be
     * generalised in the future.
     */
    requiringConstructs = [];
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
    requiredConstructs = [];
    requiredAncestorConstructs = [];
    /**
     * Map of all possible constructs. The key is the name of the construct, the value is the construct itself.
     */
    static constructs;
    /**
     * The type of the construct. Most frequent options are "statement" and "expression".
     */
    constructType;
    constructor(construct, root, indexInRoot, data) {
        super();
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.keyword = construct.keyword; // Rethink this one; will this really always be the name/keyword? MIGHT BE FIXED
        this.constructType = construct.constructType;
        // If an empty construct is given, we can't do anything with it
        if (!construct || !construct.format)
            return;
        // Set an invalid tooltip message if available
        this.simpleInvalidTooltip = construct.toolbox.invalidTooltip || ""; // TODO: MAKE MORE CONCRETE
        // Check if the construct requires a different construct, and if so add the requirement
        if (construct.requiresConstruct) {
            if (construct.requiresConstruct instanceof Array) {
                this.requiredConstructs = construct.requiresConstruct;
            }
            else {
                this.requiredConstructs.push(construct.requiresConstruct);
            }
        }
        // Check if the construct needs to be a descendant of a certain construct, and if so add the requirement
        // Allowed styles: "ancestor", {ref: "ancestor", min_level: 0, max_level: 1}; either as a single element
        // or as an array of elements
        if (construct.requiresAncestor) {
            if (construct.requiresAncestor instanceof Array) {
                this.requiredAncestorConstructs = construct.requiresAncestor.map((ancestor) => new AncestorConstruct(ancestor.ref, ancestor.min_level, ancestor.max_level));
            }
            else {
                this.requiredAncestorConstructs.push(new AncestorConstruct(construct.requiresAncestor.ref, construct.requiresAncestor.min_level, construct.requiresAncestor.max_level));
            }
        }
        // Handling assignments
        /**
         * Different variants in Python:
         * 1) Definition: a = 5
         *    Use: a
         * Augmented assignment should not require any special logic
         *
         * 2) Definition: def func(a, b)
         *    Use: func(a, b)
         * Need to be able to use a and b in the definition body
         *
         * 3) Definition: class A:
         *    Use: A(a, b)
         */
        // Add the requiring constructs
        if (construct.requiringConstructs)
            this.requiringConstructs = construct.requiringConstructs.map((req) => new OptionalConstruct(req.ref, req.min_repeat, req.max_repeat));
        // Add all the elements to the end, even though the original array should be empty
        // Maybe change to an assignment in the future if that is more efficient
        this.tokens.push(...SyntaxConstructor.constructTokensFromJSON(construct.format, this, this.tokens.length, data));
    }
    get hasEmptyToken() {
        return this.tokens.some((tkn) => tkn.hasEmptyToken);
    }
    /**
     * TODO: Temporary solution REMOVE LATER!!
     *
     * @param constructs - The constructs to add to the map
     */
    static addAllConstructs(constructs) {
        this.constructs = constructs.reduce((map, construct) => {
            map.set(construct.keyword, construct);
            return map;
        }, new Map());
    }
    get rootNode() {
        return this.root;
    }
    set rootNode(root) {
        this.root = root;
        // Update the child-parent relation for scopes as well
        this.updateScope();
    }
    /**
     * Check if the current construct is depending on / requires the given construct.
     * The given construct is required by the current construct.
     *
     * @param construct - The construct to check if the current construct is depending
     * on / requires it
     * @returns true if the current construct is depending on / requires the given construct,
     */
    isDependentOf(construct) {
        if (!construct)
            return false;
        return this.requiredConstructs.includes(construct.getKeyword());
    }
    /**
     * Check if the current construct has the given construct as a dependent / requiring construct
     *
     * @param construct - The construct to check if it is depending on / requires the current construct
     * @returns true if the current construct has the given construct as a dependent / requiring construct
     */
    hasDependent(construct) {
        if (!construct)
            return false;
        return this.requiringConstructs.some((dependent) => dependent.getConstructName() === construct.getKeyword());
    }
    getKeyword() {
        return this.keyword;
    }
    /**
     * Checks if the construct can be inserted into the current context.
     *
     * @param validator - An instance of the validator class with methods to check the current context
     * @param providedContext - The current context
     * @returns - The insertion type of the construct: valid, draft or invalid
     */
    validateContext(validator, providedContext) {
        const context = providedContext ? providedContext : validator.module.focus.getContext();
        return (context.codeConstruct instanceof EmptyLineStmt ||
            validator.atHoleWithType(context, this.constructType)) &&
            ValidatorNameSpace.validateRequiredConstructs(context, this) &&
            ValidatorNameSpace.validateAncestors(context, this)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}
export class GeneralExpression extends GeneralStatement {
    constructor(construct, root, indexInRoot, data) {
        super(construct, root, indexInRoot, data);
    }
    getFirstLineNumber() {
        return this.lineNumber ?? this.rootNode.getFirstLineNumber();
    }
    getSelection() {
        return new Selection(this.left.lineNumber, this.rightCol, this.right.lineNumber, this.leftCol);
    }
    // getNearestCodeConstruct(): CodeConstruct {
    //     // Change to GeneralStatement in the future
    //     if (this.rootNode instanceof Module) console.warn("Expressions can not be used at the top level");
    //     else {
    //         return this.rootNode.getNearestCodeConstruct();
    //     }
    // }
    validateContext(validator, providedContext) {
        return validator.atHoleWithType(providedContext, this.constructType)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}
/**
 * A statement that returns a value such as: binary operators, unary operators, function calls that return a value, literal values, and variables.
 *
 * FFD!!!
 */
export class Expression extends Statement {
    // ALLEEN TYPING IS ANDERS ... can misschien samen worden genomen als statement en expression
    // gefuseerd worden
    // TODO: can change this to an Array to enable type checking when returning multiple items
    returns; // ONLY FOR TYPING
    // OVERGEERFT VAN STATEMENT?
    simpleInvalidTooltip = Tooltip.InvalidInsertExpression; // NODIG KINDA
    constructor(returns) {
        super();
        this.returns = returns;
    }
    getFirstLineNumber() {
        return this.rootNode.getFirstLineNumber();
        /**
         * this.lineNumber seems to always work? Maybe we can simply remove this?
         */
        // ABSTRACT THIS? e.g. getLineNumber() { return this.lineNumber || this.rootNode.getLineNumber(); }
    }
    getSelection() {
        const line = this.lineNumber >= 0 ? this.lineNumber : this.getFirstLineNumber();
        return new Selection(line, this.rightCol, line, this.leftCol);
        /**
         * Again, linenumber seems to always work ... and we can just replace "line" with
         * "this.getLineNumber()" which works both in statement and expression
         */
    }
    // getNearestCodeConstruct(): CodeConstruct {
    //     return this.rootNode.getNearestCodeConstruct();
    //     /**
    //      * Generalisatie:
    //      * if (this.returns) return this.rootNode.getParentStatement(); // If expression
    //      * else return this; // If statement
    //      */
    // }
    onDelete() {
        return;
        /**
         * Already in Statement class
         */
    }
}
export class Modifier extends Expression {
    leftExprTypes;
    simpleInvalidTooltip = Tooltip.InvalidInsertModifier;
    constructor() {
        super(null);
    }
    getModifierText() {
        return "";
        /**
         * Only used in one call; can we remove this?
         */
    }
}
/**
 * The smallest code construct: identifiers, holes (for either identifiers or expressions), operators and characters etc.
 */
export class Token extends Construct {
    isTextEditable = false;
    text;
    isEmpty = false;
    message = null;
    originalText;
    constructor(text, root) {
        super();
        this.rootNode = root;
        this.text = text;
        this.originalText = text;
    }
    getBoundaries() {
        // If the indent (one indent) has to be included in the selection range
        return new Range(this.left.lineNumber, this.leftCol, this.right.lineNumber, this.rightCol);
    }
    getNearestScope() {
        return this.rootNode.getNearestScope();
    }
    subscribe(type, callback) {
        this.callbacks[type].push(callback);
    }
    unsubscribe(type, callerId) {
        let index = -1;
        for (let i = 0; i < this.callbacks[type].length; i++) {
            if (this.callbacks[type].callerId == callerId) {
                index = i;
                break;
            }
        }
        if (index > 0)
            this.callbacks[type].splice(index, 1);
    }
    notify(type) {
        for (const callback of this.callbacks[type])
            callback.callback(this);
        if (this.callbacksToBeDeleted.size > 0) {
            for (const entry of this.callbacksToBeDeleted) {
                this.unsubscribe(entry[0], entry[1]);
            }
            this.callbacksToBeDeleted.clear();
        }
    }
    /**
     * Builds the left and right positions of this token based on its text length.
     *
     * @param pos the left position to start building this node's right position.
     * @returns the final right position of this node: for tokens it equals to `this.left + this.text.length - 1`
     */
    build(pos) {
        this.left = pos;
        // Guard
        if (this.text.length == 0) {
            console.warn("do not use any Tokens with no textual length (i.e. all tokens should take some space in the editor).");
            this.right = pos;
            return pos;
        }
        // Split in the different lines
        const lines = this.originalText.split("\n");
        // Line difference = last line number - first line number
        const lineDiff = lines.length - 1;
        // TODO: The way indentation is currently handled is not ideal.
        // If multiple indentations happened before the current indentation,
        // they are simply bundled together. When deleting constructs, this could
        // make it impossible to get to the correct indentation level.
        if (lineDiff > 0) {
            // Determine the last column of the last line
            // If there are multiple lines, the last column is the length of the last line + its indentation
            const rootConstructIndent = this.getNearestCodeConstruct().leftCol;
            this.right = new Position(pos.lineNumber + lineDiff, rootConstructIndent + lines.at(-1).length);
            if (lines.at(-1).length + 1 !== this.rightCol) {
                console.log(lines.at(-1).length + 1, this.rightCol);
                // Indent all lines except the first one
                for (let i = 1; i < lines.length; i++) {
                    // Add the indentation to the line
                    // One is subtracted from the rootConstructIndent because the columns start at 1
                    lines[i] = " ".repeat(rootConstructIndent - 1) + lines[i];
                }
                // Update the token's text to reflect the indentation
                this.text = lines.join("\n");
            }
        }
        else {
            this.right = new Position(pos.lineNumber, pos.column + this.text.length);
        }
        this.notify(CallbackType.change);
        return this.right;
    }
    /**
     * Finds and returns the next empty hole (name or value) in this code construct
     * @returns The found empty token or null (if nothing it didn't include any empty tokens)
     */
    getInitialFocus() {
        if (this.isEmpty)
            return { tokenToSelect: this };
        return { positionToMove: new Position(this.getFirstLineNumber(), this.rightCol) };
    }
    getRenderText() {
        return this.text;
    }
    getFirstLineNumber() {
        return this.left.lineNumber;
    }
    getNearestCodeConstruct(type) {
        // This is weird TypeScript behaviour: it needs to now the exact type argument to be able to call the method
        if (type === CodeConstructType.CompoundConstruct)
            return this.rootNode?.getNearestCodeConstruct(type);
        return this.rootNode?.getNearestCodeConstruct(type);
    }
    updateScope() {
        return;
    }
    getKeyword() {
        return this.getRenderText();
    }
}
// REPLACED
/**
 * Import statement construct
 */
export class ImportStatement extends Statement {
    moduleNameIndex = -1;
    itemNameIndex = -1;
    constructor(moduleName = "", itemName = "") {
        super();
        this.tokens.push(new NonEditableTkn("from ", this, this.tokens.length));
        this.moduleNameIndex = this.tokens.length;
        this.tokens.push(new EditableTextTkn(moduleName, new RegExp("^[a-zA-Z]*$"), this, this.tokens.length));
        this.tokens.push(new NonEditableTkn(" import ", this, this.tokens.length));
        this.itemNameIndex = this.tokens.length;
        this.tokens.push(new EditableTextTkn(itemName, new RegExp("^[a-zA-Z]*$"), this, this.tokens.length));
        this.subscribe(CallbackType.onFocusOff, new Callback(() => {
            this.onFocusOff({ module: this.getModule() });
        }));
    }
    get hasSubValues() {
        return true;
    }
    validateContext(validator, providedContext) {
        return InsertionType.Valid; // Temporary fix
        // return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
        //     ? InsertionType.Valid
        //     : InsertionType.Invalid;
    }
    getImportModuleName() {
        return this.tokens[this.moduleNameIndex].getRenderText();
    }
    getImportItemName() {
        return this.tokens[this.itemNameIndex].getRenderText();
    }
    onFocusOff(args) {
        if (this.getImportModuleName() !== "" && this.getImportItemName() !== "") {
            //TODO: Not efficient, but the only way to improve this is to constantly maintain an updated "imported" status
            //on the construct requiring an import, which is tedious so I left it for now. If this ever becomes an issue, that is the solution.
            args.module.validator.validateImports();
        }
    }
    setImportModule(txt) {
        this.tokens[this.moduleNameIndex].setEditedText(txt);
    }
    setImportItem(txt) {
        this.tokens[this.itemNameIndex].setEditedText(txt);
    }
    onDelete() {
        const module = this.getModule();
        let stmts = module.getAllImportStmts();
        stmts = stmts.filter((stmt) => stmt !== this);
        module.validator.validateImports(stmts);
    }
}
/**
 * Empty line construct is created to show the user the body of the statement and allows
 * for easy navigation to the body of the statement. In the editor it is represented by an
 * empty intended light blue line. It is also used to represent a currently empty line.
 */
export class EmptyLineStmt extends Statement {
    constructor(root, indexInRoot) {
        super();
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }
    get hasSubValues() {
        return true;
    }
    validateContext(validator, providedContext) {
        return validator.canInsertEmptyLine(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }
    build(pos) {
        // this.lineNumber = pos.lineNumber;
        this.left = this.right = pos;
        return new Position(this.lineNumber, this.rightCol);
    }
    getInitialFocus() {
        return { positionToMove: this.getLeftPosition() };
    }
    getRenderText() {
        return "";
    }
    toString() {
        return "EmptyLine";
    }
}
/**
 * Text token that can be edited by the user
 * In other words, the token does not form one static keyword but can be changed by the user
 */
export class EditableTextTkn extends Token {
    isTextEditable = true;
    validatorRegex;
    constructor(text, regex, root, indexInRoot) {
        super(text);
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.validatorRegex = regex;
        if (text === "")
            this.isEmpty = true;
    }
    get hasSubValues() {
        return true;
    }
    getToken() {
        return this;
    }
    getSelection() {
        const leftPos = this.getLeftPosition();
        return new Selection(leftPos.lineNumber, leftPos.column + this.text.length, leftPos.lineNumber, leftPos.column);
    }
    getEditableText() {
        return this.text;
    }
    setEditedText(text) {
        if (this.validatorRegex.test(text)) {
            this.text = text;
            this.rootNode.rebuild(this.getLeftPosition(), this.indexInRoot);
            if (text === "")
                this.isEmpty = true;
            else
                this.isEmpty = false;
            return true;
        }
        else {
            this.notify(CallbackType.fail);
            return false;
        }
    }
    build(pos) {
        this.left = pos;
        if (this.text.length == 0) {
            console.warn("Do not use any Tokens with 0 textual length.");
            this.right = pos;
        }
        else
            this.right = new Position(pos.lineNumber, pos.column + this.text.length);
        this.notify(CallbackType.change);
        return new Position(pos.lineNumber, this.rightCol);
    }
}
/**
 * Editable token used to represent an identifier
 */
export class IdentifierTkn extends Token {
    isTextEditable = true;
    validatorRegex;
    constructor(identifier, root, indexInRoot, validatorRegex = RegExp("^[^\\d\\W]\\w*$")) {
        super(identifier == undefined ? "  " : identifier);
        if (identifier == undefined)
            this.isEmpty = true;
        else
            this.isEmpty = false;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.validatorRegex = validatorRegex;
    }
    get hasSubValues() {
        return true;
    }
    getToken() {
        return this;
    }
    getEditableText() {
        return this.text;
    }
    /**
     * Update the identifier text to the new text while performing validation and rebuilding the statement
     *
     * @param text - The new text to set the identifier to
     * @returns Whether the new text is valid
     */
    setEditedText(text) {
        if (this.validatorRegex.test(text)) {
            this.setIdentifierText(text);
            this.rootNode.rebuild(this.getLeftPosition(), this.indexInRoot);
            if (this.text.length > 0)
                this.isEmpty = false;
            if (this.text.length == 0)
                this.isEmpty = true;
            return true;
        }
        else {
            this.notify(CallbackType.fail);
            return false;
        }
    }
    /**
     * Update the identifier text to the new text without validation checks and without
     * rebuilding the statement
     *
     * @param text - The new text to set the identifier to
     */
    setIdentifierText(text) {
        this.text = text;
        if (this.text != EMPTYIDENTIFIER)
            this.isEmpty = false;
    }
    isEmptyIdentifier() {
        return this.text == EMPTYIDENTIFIER;
    }
}
/**
 * Handles the creation, (re)assignment and deletion of variables with regards to
 * the scope, AST and visual representation.
 */
export class AssignmentTkn extends IdentifierTkn {
    /**
     * The old identifier of the assignment token. This is used to keep track of the
     * identifier before it was changed, easily update the old references and detect
     * changes in the identifier.
     */
    oldIdentifier = EMPTYIDENTIFIER;
    /**
     * The type of the scope in which the variable is defined. The most frequent types
     * are "global" and "local". The scope type is used to determine to which scope the
     * variable belongs and what it's reach is.
     */
    scopeType;
    /**
     * Specification definied categories for the assignments.
     */
    referenceType;
    /**
     * getIdentifier = getRenderText
     *
     * What do you need to know about the identifiers?
     * * When typing, we need to know the potential in-scope identifiers
     * * When we change or remove, we need to potentially add warnings to references
     *
     * uniqueId is possibly not necessary; above methods thus possibly unnecessary
     */
    /**
     * Create an assignment token. This token encapsulates all functionality necessary to handle
     * the scoping of variables.
     *
     * @param identifier - The identifier text, or variable
     * @param root - The root of the assignment token
     * @param indexInRoot - The index of the assignment token in the root's tokens
     * @param regex - The regex used to validate the identifier text typed by the user
     * @param scopeType - The type of the scope in which the variable is defined. Defaults to
     * ScopeType.Global if not specified
     */
    constructor(identifier, root, indexInRoot, regex, scopeType, referenceType) {
        super(identifier, root, indexInRoot, regex);
        this.scopeType = scopeType ?? ScopeType.Global;
        this.referenceType = referenceType;
        root.addAssignmentIndex(indexInRoot);
        this.subscribe(CallbackType.onFocusOff, new Callback(() => {
            this.onFocusOff();
        }));
        this.subscribe(CallbackType.delete, new Callback(() => this.onDelete()));
    }
    onFocusOff() {
        // Get the current identifier
        const currentIdentifier = this.getRenderText();
        // // Get the parent statement
        // const parentStmt = this.getNearestCodeConstruct();
        // // Get the nearest scope
        // const stmtScope = parentStmt.getNearestScope();
        const currentScope = scopeHeuristic(this, this.scopeType);
        console.log("Scope", currentScope);
        if (currentIdentifier !== this.oldIdentifier) {
            // The identifier has changed
            if (currentIdentifier === EMPTYIDENTIFIER) {
                // The identifier has been emptied
                // Remove the variable from the nearest scope
                currentScope.removeAssignment(this);
            }
            else {
                // If it goes from empty to non-empty, add the variable to the nearest scope
                if (this.oldIdentifier === EMPTYIDENTIFIER && currentIdentifier !== EMPTYIDENTIFIER) {
                    currentScope.addAssignment(this);
                }
                // We now need to update all references to the new variable to remove fixed warnings
                // this.updateRefWarnings();
            }
            // // An empty identifier is not a valid identifier and has thus no references pointing to it
            // if (this.oldIdentifier !== EMPTYIDENTIFIER) {
            //     // We need to add warnings to all references to the old variable
            //     this.updateRefWarnings(this.oldIdentifier);
            // }
        }
        // Update the old identifier
        this.oldIdentifier = currentIdentifier;
    }
    // TODO: Temporary disabled as this does currently not work
    // /**
    //  * Update the warnings of all references to the current token, either with
    //  * the current identifier or with the given identifier. If an reference is
    //  * covered by an assignment statement, the warning is removed. If not, a
    //  * warning is added.
    //  *
    //  * @param identifierName - The identifier to which all references will be updated.
    //  * If left empty, the current identifier will be used.
    //  */
    // updateRefWarnings(identifierName?: string): void {
    //     // List of variable reference expressions refering to the current token
    //     const varRefs: GeneralStatement[] = [];
    //     // Get the statement containing the token
    //     const parentStmt = this.getNearestCodeConstruct();
    //     // Current identifier
    //     const currentIdentifier = identifierName ?? this.getRenderText();
    //     // Go through all constructs and add the construct if it is a variable reference to the given assignment token
    //     // and is in draft mode
    //     parentStmt.getModule().performActionOnBFS((code) => {
    //         // (code as GeneralStatement).tokens?.forEach((refTkn) => {
    //         //     if (refTkn instanceof ReferenceTkn) console.log(refTkn.text, currentIdentifier);
    //         // });
    //         if (
    //             code instanceof GeneralStatement &&
    //             code.tokens.some((refTkn) => {
    //                 return refTkn instanceof ReferenceTkn && refTkn.text === currentIdentifier;
    //             })
    //             // && code.draftModeEnabled
    //         ) {
    //             // varRefs.push(code); // TEMPORARY DISABLED BECAUSE THE MESSAGE FUNCTIONALITY RESULTS IN ERRORS
    //         }
    //     });
    //     // Go through all variable reference expressions in draft mode and remove the warning if the reference is
    //     // covered by an assignment statement
    //     for (const ref of varRefs) {
    //         // Scope of the reference expression
    //         const refScope = ref.getNearestScope();
    //         // If the assignment statement covers the reference expression, then update the reference expression
    //         if (refScope.covers(currentIdentifier, ref.getFirstLineNumber())) {
    //             // A valid assignment found, thus remove the warning
    //             parentStmt.getModule().closeConstructDraftRecord(ref);
    //         } else {
    //             // No valid assignment found, thus add the warning
    //             parentStmt
    //                 .getModule()
    //                 .openDraftMode(
    //                     ref,
    //                     "This variable has been removed and cannot be referenced anymore. Consider deleting this reference.",
    //                     []
    //                 );
    //         }
    //     }
    // }
    /**
     * On deletion of the assignment, update the scope, check for other
     * assignments to the variable and update the variable references
     */
    onDelete() {
        // const parentStmt = this.getNearestCodeConstruct();
        // const currentScope = parentStmt.getNearestScope();
        const currentScope = scopeHeuristic(this, this.scopeType);
        // Remove the assignment from the nearest scope
        currentScope.removeAssignment(this);
        //     // Check if a reference on the current location to the deleted assignment would
        //     // be invalid
        //     if (!currentScope.covers(this.getRenderText(), this.getFirstLineNumber())) {
        //         // References to the deleted variable after this point could be invalid
        //         // if there are no assignments between the deleted variable and the reference
        //         this.updateRefWarnings();
        //     }
    }
}
/**
 * Construct to be able to place non-statement (expressions and tokens) in a statement spot,
 * like the autocomplete Token
 */
export class TemporaryConstruct extends Statement {
    constructor(token) {
        super();
        token.indexInRoot = this.tokens.length;
        token.rootNode = this;
        this.tokens.push(token);
    }
    get hasSubValues() {
        return this.tokens.some((val) => val.hasSubValues);
    }
    validateContext(validator, providedContext) {
        return validator.onBeginningOfLine(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }
}
/**
 * Token being inserted when typing with an autocomplete menu open.
 * The token is first created when the first character is typed and an
 * autocomplete menu is opened. The token is then updated when the user types
 * subsequent characters. The token is probably replaced / removed / obsolete
 * when the terminating character is typed and the autocomplete menu is closed.
 */
export class AutocompleteTkn extends Token {
    isTextEditable = true;
    validatorRegex = null;
    autocompleteType;
    validMatches;
    constructor(firstChar, autocompleteCategory, validMatches, root, indexInRoot) {
        super(firstChar);
        this.validMatches = validMatches;
        this.autocompleteType = autocompleteCategory;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }
    get hasSubValues() {
        return true;
    }
    getToken() {
        return this;
    }
    getEditableText() {
        return this.text;
    }
    // Why use this function? This is less complete than checkMatch?
    /**
     * Get the exact matching EditCodeAction from the list of valid matches
     *
     * @returns - Matching EditCodeAction or null if no match
     */
    isMatch() {
        for (const match of this.validMatches)
            if (this.text == match.matchString)
                return match;
        return null;
    }
    // insertableTerminatingCharRegex: RegExp[] is the tenth parameter of EditCodeAction
    // which might never be used, I think? Is thus function ever used then? FFD
    isInsertableTerminatingMatch(newChar) {
        for (const match of this.validMatches) {
            if (match.insertableTerminatingCharRegex) {
                for (const matchReg of match.insertableTerminatingCharRegex) {
                    if (this.text == match.matchString && matchReg.test(newChar))
                        return match;
                }
            }
        }
        return null;
    }
    /**
     * Check if there is a precise match (and thus the CodeConstruct should be inserted) or not
     *
     * @returns - Matching EditCodeAction or null if no match
     */
    isTerminatingMatch() {
        const newChar = this.text[this.text.length - 1];
        const curText = this.text.substring(0, this.text.length - 1);
        return this.checkMatch(newChar, curText);
    }
    /**
     * Checks if from the list of all currently valid matches (in the autocomplete menu), there is
     * a match that matches the current text exactly, or matches the current text with a regex and
     * returns the corresponding EditCodeAction
     *
     * @param newChar - the new character that was typed
     * @param text - All text written before the latest character
     * @returns The EditCodeAction matching the matchString or matchRegex exactly, or null if no match
     */
    checkMatch(newChar, text) {
        let curText = text !== undefined ? text : this.text;
        // Check if the new character is a terminating character and whether the current text (text
        // before the current character) is a match
        for (const match of this.validMatches) {
            if (match.terminatingChars.indexOf(newChar) >= 0) {
                if (match.trimSpacesBeforeTermChar)
                    curText = curText.trim();
                if (curText == match.matchString)
                    return match;
                else if (match.matchRegex != null && match.matchRegex.test(curText))
                    return match;
            }
        }
        // No exact match when the new character is a terminating character or the new character was not a
        // terminating character
        return null;
    }
    /**
     * Once the token is created, update the text of the token when typing
     */
    setEditedText(text) {
        this.text = text;
        this.rootNode.rebuild(this.getLeftPosition(), this.indexInRoot);
        return true;
    }
}
/**
 * Represents the "holes" in the text that can be filled with expressions
 */
export class HoleTkn extends Token {
    isEmpty = true;
    allowedType;
    cssClasses = {
        selectionBackground: "border-15",
        hole: "expression-hole",
    };
    constructor(root, indexInRoot, allowedType) {
        super("    ");
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        if (allowedType)
            this.allowedType = allowedType;
    }
    get hasSubValues() {
        return true;
    }
    get hasEmptyToken() {
        return true;
    }
    getKeyword() {
        return "---";
    }
}
/**
 * Single non-editable token. Text is fixed and cannot be changed by the user.
 * Deletion results in the entire token being removed.
 */
export class NonEditableTkn extends Token {
    constructor(text, root, indexInRoot) {
        super(text);
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }
    get hasSubValues() {
        return false;
    }
    getSelection() {
        return this.rootNode.getSelection();
    }
}
export class ReferenceTkn extends NonEditableTkn {
}
// !!!!!!!! Additional structure classes
/**
 * An abstract construct representing a hole in the code that can be filled
 * with a construct.
 */
export class HoleStructure extends Construct {
    /**
     * Text representing the hole in the code.
     */
    text;
    /**
     * Whether the hole is selectable by the user.
     */
    selectable;
    /**
     * The self defined construct types in the specification that can be inserted
     * into this hole.
     */
    constructTypes;
    constructor(text, root, indexInRoot) {
        super();
        this.text = text ?? "";
        this.selectable = this.text.length > 0;
    }
    getNearestScope() {
        return this.rootNode.getNearestScope();
    }
    build(pos) {
        this.left = pos;
        this.right = pos.delta(undefined, this.text.length);
        return pos;
    }
    getInitialFocus() {
        if (this.selectable)
            return { tokenToSelect: this };
        return { positionToMove: this.getLeftPosition() };
    }
    getRenderText() {
        return this.text;
    }
    getNearestCodeConstruct(type) {
        // Weird TypeScript behaviour: it needs to now the exact type argument to be able to call the method
        if (type === CodeConstructType.CompoundConstruct)
            return this.rootNode?.getNearestCodeConstruct(type);
        return this.rootNode?.getNearestCodeConstruct(type);
    }
    /**
     * Call all callbacks of the given type on this statement and on all of its tokens.
     *
     * @param type - The type of the callback to be notified
     */
    notify(type) {
        for (const callback of this.callbacks[type])
            callback.callback(this);
        if (this.callbacksToBeDeleted.size > 0) {
            for (const entry of this.callbacksToBeDeleted) {
                this.unsubscribe(entry[0], entry[1]);
            }
            this.callbacksToBeDeleted.clear();
        }
    }
    getKeyword() {
        return this.constructor.name;
    }
    getFirstLineNumber() {
        return this.lineNumber;
    }
}
/**
 * A hole structure representing a standard empty line in a construct.
 *
 * TODO: Rename / merge in the future with EmptyLineStmt
 */
// class EmptyLineStructure extends HoleStructure {
//     constructor(root?: Construct, indexInRoot?: number) {
//         super("", root, indexInRoot);
//     }
// }
/**
 * A hole structure representing a construct that can be filled with a different
 * construct.
 *
 * TODO: Rename / merge in the future with TypedEmptyExpr
 */
// class ConstructHoleStructure extends HoleStructure {
//     constructor(root?: Construct, indexInRoot?: number) {
//         super(HOLETEXT, root, indexInRoot);
//     }
// }
export class CompoundConstruct extends CodeConstruct {
    recursiveName;
    // Hmmmm?
    scope;
    //
    compoundToken;
    waitOnIndices;
    // private nextFormatIndex: number;
    constructor(compoundToken, root, indexInRoot) {
        super();
        this.root = root;
        this.indexInRoot = indexInRoot;
        this.compoundToken = compoundToken;
        this.waitOnIndices = new Map(compoundToken.format.flatMap((tkn, idx) => "waitOnUser" in tkn ? [[idx, tkn.waitOnUser]] : [])
        // .filter((tkn) => "waitOnUser" in tkn)
        // // @ts-ignore
        // .map((tkn, idx) => [idx, tkn.waitOnUser] as [number, string])
        );
        // Could be split in two different constructors if we want to allow json as well
        // by using the factory method
        if (compoundToken.scope) {
            this.scope = new Scope();
        }
        this.tokens = SyntaxConstructor.constructTokensFromJSONCompound(compoundToken, this, null, null, null, 0, true);
        // How to construct? Build until a waitOnUser? The seperator token can maybe also have
        // a waitOnUser? So that we leave the option to the specification writing user.
    }
    get hasEmptyToken() {
        return this.tokens.some((tkn) => tkn.hasEmptyToken);
    }
    get nextFormatIndex() {
        return ((this.tokens.length % (this.compoundToken.format.length + (this.compoundToken.insertBefore ? 1 : 0))) -
            (this.compoundToken.insertBefore ? 1 : 0));
    }
    get rootNode() {
        return this.root;
    }
    set rootNode(root) {
        this.root = root;
        // Update parent-child relationship of the scopes
        this.updateScope();
    }
    /**
     * Get the length, in tokens, of a single expansion cycle
     */
    get cycleLength() {
        return this.compoundToken.format.length + (this.compoundToken.insertBefore ? 1 : 0);
    }
    // setElementToInsertNextIndex(idx: number) {
    //     this.nextFormatIndex = idx;
    // }
    // /**
    //  * Get the key to wait on to continue the expansion of the compound
    //  *
    //  * @returns The key to wait on for the next token to be inserted
    //  */
    // getWaitOnKey(): string {
    //     console.log("WaitOnToken", this.compoundToken.format[this.nextFormatIndex], this.nextFormatIndex);
    //     const token = this.compoundToken.format[this.nextFormatIndex];
    //     return "waitOnUser" in token ? (token.waitOnUser as string) : null;
    // }
    // /**
    //  * Checks if the cursor is at the right position within the compound to continue the expansion
    //  *
    //  * @param context - The current context
    //  * @returns Whether the cursor is at the right position within the compound
    //  * to continue the expansion of
    //  */
    // atRightPosition(highestSubCompoundConsturct: Construct): boolean {
    //     const formatLength = this.compoundToken.format.length;
    //     return (
    //         highestSubCompoundConsturct.indexInRoot % formatLength ===
    //         (this.nextFormatIndex - 1 + formatLength) % formatLength
    //     );
    // }
    getFormatIndex(leftConstruct, delta = 0) {
        const repetitionLength = this.cycleLength;
        // Get the index of the current token in the root, modulo the cycle length
        const repetitionIndex = leftConstruct.indexInRoot + (delta % repetitionLength);
        // Get the index of the current token in the compound specification
        return (repetitionIndex - (this.compoundToken.insertBefore ? 1 : 0) + this.cycleLength) % repetitionLength;
    }
    /**
     * Check if an expansion iteration can be executed
     *
     * @param leftConstruct - The construct to the left of the cursor and a direct child of
     * a compound construct
     * @param keyPressed - The key that was pressed by the user
     * @returns True if the expansion can continue on the given location with the given key
     */
    canContinueExpansion(leftConstruct, keyPressed) {
        // If the left construct is not a direct child of this compound,
        // the expansion can then only happen if the compound is directly adjacent
        // to the leftConstruct and the starting construct's waitOnUser key equals the
        // current key pressed
        if (leftConstruct.left.isBefore(this.left))
            return (leftConstruct.right.equals(this.left) &&
                this.waitOnIndices.get(0) === keyPressed &&
                !this.compoundToken.insertBefore);
        // Get the index of the leftConstruct in the format specification
        const formatIndex = this.getFormatIndex(leftConstruct, 1);
        // Get the key which needs to be pressed to continue the expansion on the given location
        const formatKey = this.waitOnIndices.get(formatIndex);
        console.log(leftConstruct, this.getFormatIndex(leftConstruct, 1), this.waitOnIndices);
        // True if
        return !!formatKey && formatKey === keyPressed;
    }
    continueExpansion(leftConstruct) {
        // Get the index of the leftConstruct in the format specification
        // If the leftConstruct is to the left of this compound, the index is -1
        let startingIndex;
        if (leftConstruct.left.isBefore(this.left))
            startingIndex = -1;
        else
            startingIndex = leftConstruct.indexInRoot;
        const initLength = this.tokens.length;
        this.tokens = SyntaxConstructor.constructTokensFromJSONCompound(this.compoundToken, this, null, this.tokens, this.nextFormatIndex, startingIndex + 1);
        // TODO: Maybe use rebuild starting from token this.tokens[startingIndex + 1]
        // TODO: MAybe integrate this into the Syntax constructor such that
        // no building, rebuilding and indexInRoot reconstruction needs to happen here
        let leftpos = this.tokens[startingIndex]?.right ?? this.right;
        for (const token of this.tokens.slice(startingIndex + 1)) {
            leftpos = token.build(leftpos);
        }
        this.right = leftpos;
        // Maybe some rebuilding that needs to be done?
        // this.build(this.left); // Or something different?
        // const range = new Range(statement.lineNumber, statement.leftCol, statement.lineNumber, statement.rightCol);
        // Module.instance.editor.executeEdits(range, statement);
        // this.module.focus.updateContext(statement.getInitialFocus());
        // let root = this.rootNode;
        // while (root instanceof Construct) root = root.rootNode;
        ASTManupilation.rebuild(this, this.right, { rebuildConstruct: false });
        // Execute edits in the monaco editor at the end, as the cursor position will be changed
        // and thus the constructs need to be (re)built first
        this.tokens.slice(startingIndex + 1, startingIndex + 1 + this.tokens.length - initLength).forEach((token) => {
            const range = new Range(token.left.lineNumber, token.leftCol, token.left.lineNumber, token.leftCol);
            Module.instance.editor.executeEdits(range, token);
        });
        Module.instance.focus.updateContext(this.getConstructsFocus(this.tokens.slice(startingIndex + 1)));
    }
    removeExpansion(leftConstruct) {
        const currentIdx = leftConstruct.indexInRoot;
        const cycleLength = this.cycleLength;
        const startIdx = Math.max(currentIdx - cycleLength + 1, 0);
        // All tokens can only be deleted if the first token can lead to an expansion
        // otherwise it can never be expanded again
        if (startIdx === 0 && !("waitOnUser" in this.compoundToken.format[0]))
            return false;
        const deletable = this.tokens
            .slice(startIdx, currentIdx + 1)
            .every((token) => token instanceof NonEditableTkn ||
            token instanceof HoleTkn ||
            (token instanceof Token && token.isEmpty));
        if (!deletable)
            return false;
        const leftpos = this.tokens[startIdx].left;
        const deleted = this.tokens.splice(startIdx, cycleLength);
        for (let i = deleted.length - 1; i >= 0; i--) {
            deleted[i].notify(CallbackType.delete);
            // TODO: Very ugly and does not work
        }
        if (deleted.length > 0) {
            // Remove from the monaco editor
            const range = new Range(deleted[0].left.lineNumber, deleted[0].leftCol, deleted.at(-1).right.lineNumber, deleted.at(-1).rightCol);
            Module.instance.editor.monaco.executeEdits("module", [{ range: range, text: null }]);
        }
        // Rebuild the tokens
        // If there are still tokens after the removed section, rebuild these and all following tokens
        if (this.tokens[startIdx])
            ASTManupilation.rebuild(this.tokens[startIdx], leftpos);
        // If there are no tokens after the removed section, but there are tokens before, start rebuilding all following tokens / constructs
        else if (startIdx > 0)
            ASTManupilation.rebuild(this.tokens[startIdx - 1], this.tokens[startIdx - 1].right, {
                rebuildConstruct: false,
            });
        // Otherwise the construct has a zero width (which should be impossible) and thus rebuild from there
        else
            ASTManupilation.rebuild(this, leftpos);
        // TODO: Also very ugly and also does not work that well
        Module.instance.focus.updateContext({ positionToMove: leftpos });
        // Here deletable is always true
        return deletable;
    }
    getBoundaries() {
        return new Range(this.left.lineNumber, this.leftCol, this.right.lineNumber, this.rightCol);
    }
    getNearestScope() {
        return this.scope ?? this.rootNode.getNearestScope();
    }
    updateScope() {
        if (this.scope)
            this.scope.parentScope = this.rootNode.getNearestScope();
        else
            for (const tkn of this.tokens)
                tkn.updateScope();
    }
    getInitialFocus() {
        // Maybe rewrite such that if you don't need to check for empty tokens explicitly, but
        // by using the output of the getInitialFocus of the tokens
        // for (let token of this.tokens) {
        //     if (token instanceof Token && token.isEmpty) return { tokenToSelect: token };
        //     if (token instanceof CodeConstruct && token.hasEmptyToken) return token.getInitialFocus();
        // }
        // return { positionToMove: this.right };
        return this.getConstructsFocus(this.tokens);
    }
    getConstructsFocus(constructs) {
        // Maybe generalise this to something in which you give a position and it
        // searches for the first valid focus position after the given position?
        for (let token of constructs) {
            if (token instanceof Token && token.isEmpty)
                return { tokenToSelect: token };
            if (token instanceof CodeConstruct && token.hasEmptyToken)
                return token.getInitialFocus();
        }
        return { positionToMove: this.right };
    }
    getRenderText() {
        return this.tokens.map((token) => token.getRenderText()).join("");
    }
    getFirstLineNumber() {
        return this.lineNumber;
    }
    getKeyword() {
        // Maybe make this more unique?
        return this.recursiveName;
    }
    getNearestCodeConstruct(type) {
        if (!type || type === CodeConstructType.CompoundConstruct)
            return this;
        return this.rootNode?.getNearestCodeConstruct(type);
    }
    notify(type) {
        for (const callback of this.callbacks[type])
            callback.callback(this);
        // We call callbacks on all token of a statement as well
        for (const token of this.tokens) {
            token.notify(type);
        }
        if (this.callbacksToBeDeleted.size > 0) {
            for (const [callbackType, callerId] of this.callbacksToBeDeleted) {
                this.unsubscribe(callbackType, callerId);
            }
            this.callbacksToBeDeleted.clear();
        }
    }
}
//# sourceMappingURL=ast.js.map