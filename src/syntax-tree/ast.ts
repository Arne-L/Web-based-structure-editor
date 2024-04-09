import { Position, Range, Selection } from "monaco-editor";
import { EditCodeAction, InsertionResult } from "../editor/action-filter";
import { DraftRecord } from "../editor/draft";
import { Context, UpdatableContext } from "../editor/focus";
import { Validator } from "../editor/validator";
import { ConstructDefinition } from "../language-definition/definitions";
import { CodeBackground, ConstructHighlight, HoverMessage, InlineMessage } from "../messages/messages";
import { Callback, CallbackType } from "./callback";
import { AutoCompleteType, DataType, InsertionType, Tooltip } from "./consts";
import { TAB_SPACES } from "../language-definition/settings";
import { Module } from "./module";
import { Scope } from "./scope";
import { EMPTYIDENTIFIER } from "../language-definition/settings";
import { Editor } from "../editor/editor";

export abstract class Construct {
    /**
     * The parent/root node for this code-construct. Statements are the only code construct that could have the Module as their root node.
     */
    rootNode: Construct | Module;

    /**
     * The index this item has inside its root's body, or its tokens array.
     */
    indexInRoot: number;

    /**
     * The left column position of this code-construct.
     */
    leftCol: number;

    /**
     * The right column position of this code-construct.
     */
    rightCol: number;

    /**
     * A warning or error message for this code construct. (null if there are no messages)
     */
    message: InlineMessage;

    /**
     * Whether this code construct is in draft mode or not. Always false for Tokens
     */
    draftModeEnabled: boolean;

    draftRecord: DraftRecord;

    // codeConstructName: ConstructName;

    callbacksToBeDeleted: Map<CallbackType, string>;

    simpleDraftTooltip: Tooltip;
    simpleInvalidTooltip: Tooltip;

    /**
     * Get the range of the entire construct, including potential body statements
     *
     * @param code - The construct to get the boundaries in the Monaco editor of
     * @param param1 - { selectIndex: boolean }: If the indent should be included in the selection range
     * @returns The range of the construct
     */
    abstract getBoundaries({ selectIndent }?: { selectIndent: boolean }): Range;

    /**
     * Get the nearest scope if there is one.
     * The nearest scope is either the scope of the current statement or the scope of the
     * nearest parent statement with a scope.
     *
     * @returns the nearest scope if there is one, otherwise null
     */
    abstract getNearestScope(): Scope;

    /**
     * Builds the left and right positions of this node and all of its children nodes recursively.
     *
     * Implicitly sets the left and right positions and the line number of the construct and all of its tokens.
     *
     * @param pos - The left position to start building the nodes from
     * @returns The final right position of the whole node (calculated after building all of the children nodes)
     */
    abstract build(pos: Position): Position;

    /**
     * Finds and returns the next empty hole (name or value) in this code construct
     * @returns The found empty token or null (if nothing it didn't include any empty tokens)
     */
    abstract getInitialFocus(): UpdatableContext;

    /**
     * Returns the textual value of the code construct (joining internal tokens for expressions and statements)
     */
    abstract getRenderText(): string;

    /**
     * Returns the line number of this code-construct in the rendered text.
     */
    abstract getLineNumber(): number;

    /**
     * Returns the left-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    abstract getLeftPosition(): Position;

    /**
     * Returns the right-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    abstract getRightPosition(): Position;

    /**
     * Returns a `Selection` object for this particular code-construct when it is selected
     */
    abstract getSelection(): Selection;

    /**
     * Returns the parent statement of this code-construct (an element of the Module.body array).
     */
    abstract getParentConstruct(): Statement;

    /**
     * Subscribes a callback to be fired when the this code-construct is changed (could be a change in its children tokens or the body)
     */
    abstract subscribe(type: CallbackType, callback: Callback);

    /**
     * Removes all subscribes of the given type for this code construct
     */
    abstract unsubscribe(type: CallbackType, callerId: string);

    /**
     * Calls callback of the given type if this construct is subscribed to it.
     */
    abstract notify(type: CallbackType);

    /**
     * Returns the keyword for a statement, identifier for a variable and contents for a literal
     */
    abstract getKeyword(): string;

    // FFD together with all its children (it is never called)
    /**
     * Actions that need to run after the construct has been validated for insertion, but before it is inserted into the AST.
     *
     * @param insertInto code to insert into
     * @param insertCode code being inserted
     */
    abstract performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression): void;

    abstract onFocusOff(arg: any): void;

    // FFD together with all its children (it is never called)
    abstract performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression): void;

    abstract markCallbackForDeletion(callbackType: CallbackType, callbackId: string): void;

    //TODO: This functionality needs to be merged with what Issue #526
    //This should be completely unnecessary once this is integrated with our validation inside of action-filter.ts and validaiton methods such as validateContext
    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct cannot be inserted. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    abstract getSimpleInvalidTooltip(): Tooltip;

    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct would trigger draft mode. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    abstract getSimpleDraftTooltip(): Tooltip;

    abstract onDelete(): void;

    // getTypes(): DataType[];

    /**
     * Highlight the given construct with the given colour
     *
     * @param construct - The construct to highlight
     * @param rgbColour - The colour to highlight the construct with
     */
    abstract addHighlight(rgbColour: [number, number, number, number], editor: Editor): void;
}

/**
 * A complete code statement such as: variable assignment, function call, conditional, loop, function definition, and other statements.
 */
export abstract class Statement implements Construct {
    lineNumber: number;
    leftCol: number;
    rightCol: number;
    rootNode: Statement | Module = null;
    indexInRoot: number;
    body = new Array<Statement>();
    scope: Scope = null;
    tokens = new Array<Construct>();
    hasEmptyToken: boolean;
    callbacks = new Map<string, Array<Callback>>();
    background: CodeBackground = null;
    message: HoverMessage = null;
    keywordIndex = -1;
    typeOfHoles = new Map<number, Array<DataType>>();
    draftModeEnabled = false;
    draftRecord: DraftRecord = null;
    callbacksToBeDeleted = new Map<CallbackType, string>();
    simpleDraftTooltip = Tooltip.None;
    simpleInvalidTooltip = Tooltip.InvalidInsertStatement;

    constructor() {
        for (const type in CallbackType) this.callbacks[type] = new Array<Callback>();

        this.subscribe(
            CallbackType.delete,
            new Callback(() => {
                this.onDelete();
            })
        );
    }

    /**
     * The lineNumbers from the beginning to the end of this statement.
     */
    getHeight(): number {
        if (this.body.length == 0) return 1;
        else {
            let height = 1;

            for (const line of this.body) height += line.getHeight();

            return height;
        }
    }

    /**
     * This should be true for every statement that has a body.
     */
    hasScope(): boolean {
        return this.scope != null;
    }

    /**
     * Get the nearest scope if there is one.
     * The nearest scope is either the scope of the current statement or the scope of the
     * nearest parent statement with a scope.
     *
     * @returns the nearest scope if there is one, otherwise null
     */
    getNearestScope(): Scope {
        if (this.hasScope()) return this.scope;
        return this.rootNode.getNearestScope();
    }

    hasBody(): boolean {
        return this.body.length > 0;
    }

    getBoundaries({ selectIndent = false } = {}): Range {
        // Linenumber of the given construct
        const lineNumber = this.getLineNumber();

        // If the given construct has a body
        if (this.hasBody()) {
            const stmtStack = new Array<Statement>();
            // Add all the body statements to the stack
            stmtStack.unshift(...this.body);
            // Initialize the end line number and column
            let endLineNumber = 0;
            let endColumn = 0;

            while (stmtStack.length > 0) {
                // Pop an element from the stack
                const curStmt = stmtStack.pop();

                // Add all its sub-statements to the stack
                if (curStmt instanceof Statement && curStmt.hasBody()) stmtStack.unshift(...curStmt.body);

                // Update the line number and column if necessary
                if (endLineNumber < curStmt.lineNumber) {
                    endLineNumber = curStmt.lineNumber;
                    endColumn = curStmt.rightCol;
                }
            }

            // Return the range of the construct
            return new Range(lineNumber, this.leftCol, endLineNumber, endColumn);
            // } else if (this instanceof Statement || this instanceof Token) {
        } else {
            // If the indent (one indent) has to be included in the selection range
            if (selectIndent) {
                return new Range(lineNumber, this.leftCol - TAB_SPACES, lineNumber, this.rightCol);
            } else return new Range(lineNumber, this.leftCol, lineNumber, this.rightCol);
        }
    }

    toString(): string {
        let text = "";

        for (const token of this.tokens) text += token.getRenderText();

        return text;
    }

    setLineNumber(lineNumber: number) {
        this.lineNumber = lineNumber;

        this.notify(CallbackType.change);

        for (const token of this.tokens) {
            if (token instanceof Expression) token.setLineNumber(lineNumber);
            (token as Token).notify(CallbackType.change);
        }
    }

    subscribe(type: CallbackType, callback: Callback) {
        this.callbacks[type].push(callback);
    }

    unsubscribe(type: CallbackType, callerId: string) {
        let index = -1;

        for (let i = 0; i < this.callbacks[type].length; i++) {
            if (this.callbacks[type][i].callerId == callerId) {
                index = i;
                break;
            }
        }

        if (index >= 0) this.callbacks[type].splice(index, 1);
    }

    /**
     * Call all callbacks of the given type on this statement and on all of its tokens.
     *
     * @param type - The type of the callback to be notified
     */
    notify(type: CallbackType) {
        for (const callback of this.callbacks[type]) callback.callback(this);

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
    init(pos: Position) {
        // Build the current statement
        // This also sets the left and right positions and the linenumber of the sconstruct
        this.build(pos);

        // Guard clause
        if (!this.hasBody()) return;

        // Do the same for its children
        for (let i = 0; i < this.body.length; i++)
            // The left position(s) for the children
            this.body[i].build(new Position(pos.lineNumber + i + 1, pos.column + TAB_SPACES));
    }

    build(pos: Position): Position {
        // Set the linenumber and left position
        this.lineNumber = pos.lineNumber;
        this.leftCol = pos.column;

        let curPos = pos;

        // The left position of the first token is the left position of the expression
        for (const token of this.tokens) curPos = token.build(curPos);

        // After going through all tokens, the right position is the right position of the last token
        this.rightCol = curPos.column;

        // Notify all (child)construct of the change
        this.notify(CallbackType.change);

        // Return the right position of the construct
        return curPos;
    }

    /**
     * Rebuilds the left and right positions of this node recursively. Optimized to not rebuild untouched nodes.
     *
     * @param pos - The left position to start building the nodes from
     * @param fromIndex - The index of the node that was edited.
     */
    rebuild(pos: Position, fromIndex: number) {
        let curPos = pos;

        // rebuild siblings:
        for (let i = fromIndex; i < this.tokens.length; i++) {
            this.tokens[i].indexInRoot = i;
            if (this.tokens[i] instanceof Token) curPos = this.tokens[i].build(curPos);
            else curPos = (this.tokens[i] as Expression).build(curPos);
        }

        // The right position of the last token is the right position of the construct
        this.rightCol = curPos.column;

        // If the construct has a root node, rebuild all constructs following this construct in the root node
        if (this.rootNode != undefined && this.indexInRoot != undefined) {
            if (
                (this.rootNode instanceof Expression || this.rootNode instanceof Statement) &&
                this.rootNode.lineNumber == this.lineNumber
            ) {
                this.rootNode.rebuild(curPos, this.indexInRoot + 1);
            }
        } else console.warn("node did not have rootNode or indexInRoot: ", this.tokens);

        this.notify(CallbackType.change);
    }

    getInitialFocus(): UpdatableContext {
        for (let token of this.tokens) {
            if (token instanceof Token && token.isEmpty) return { tokenToSelect: token };
            else {
                let expr = token as Expression;

                if (expr.hasEmptyToken) return expr.getInitialFocus();
            }
        }

        return { positionToMove: new Position(this.getLineNumber(), this.rightCol) };
    }

    /**
     * This function should be called after replacing a token within this statement. it checks if the newly added token `isEmpty` or not, and if yes, it will set `hasEmptyToken = true`
     * @param code the newly added node within the replace function
     */
    updateHasEmptyToken(code: Construct) {
        if (code instanceof Token) {
            if (code.isEmpty) this.hasEmptyToken = true;
            else this.hasEmptyToken = false;
        }
    }

    /**
     * Replaces this node in its root, and then rebuilds the parent (recursively)
     * @param code the new code-construct to replace
     * @param index the index to replace at
     */
    replace(code: Construct, index: number) {
        // Notify the token being replaced
        const toReplace = this.tokens[index];

        if (toReplace) {
            toReplace.notify(CallbackType.delete);

            if (!(toReplace instanceof Token)) {
                (toReplace as Expression).tokens.forEach((token) => {
                    if (token instanceof Token) {
                        token.notify(CallbackType.delete);
                    }
                });
            }
        }

        // prepare the new Node
        code.rootNode = this;
        code.indexInRoot = index;

        // prepare to rebuild siblings and root (recursively)
        let rebuildColumn: number;

        if (this.tokens[index] instanceof Token) rebuildColumn = this.tokens[index].leftCol;
        else rebuildColumn = (this.tokens[index] as Expression).leftCol;

        // replace
        //TODO: Update focus here? It is good up until now. But once the new construct is inserted, it is not being focused.
        //The focus goes to the end of line
        this.tokens[index] = code;

        if (rebuildColumn) this.rebuild(new Position(this.lineNumber, rebuildColumn), index);

        this.updateHasEmptyToken(code);

        this.notify(CallbackType.replace);
    }

    getRenderText(): string {
        let leftPosToCheck = 1;
        let txt: string = "";
        let textToAdd = "\n";

        for (const token of this.tokens) txt += token.getRenderText();

        if (this.hasBody()) {
            leftPosToCheck = this.leftCol + TAB_SPACES - 1;

            if (leftPosToCheck != 1) for (let i = 0; i < leftPosToCheck; i++) textToAdd += " ";
        }

        for (const stmt of this.body) txt += textToAdd + stmt.getRenderText();

        return txt;
    }

    /**
     * Returns the textual value of the statement's particular line
     */
    getLineText(): string {
        let txt: string = "";

        for (const token of this.tokens) txt += token.getRenderText();

        return txt;
    }

    getLineNumber(): number {
        return this.lineNumber;
    }

    getLeftPosition(): Position {
        return new Position(this.getLineNumber(), this.leftCol);
    }

    getRightPosition(): Position {
        return new Position(this.getLineNumber(), this.rightCol);
    }

    getSelection(): Selection {
        return new Selection(this.lineNumber, this.rightCol, this.lineNumber, this.leftCol);
    }

    getParentConstruct(): Statement {
        return this;
    }

    /**
     * Returns the Module
     *
     * @returns the module of the whole system
     */
    getModule(): Module {
        if (this.rootNode instanceof Module) return this.rootNode;

        return (this.rootNode as Statement).getModule();
    }

    getRootBody(): Array<Statement> {
        if (this.rootNode instanceof Module) this.rootNode.body;
        else if (this.rootNode instanceof Statement && this.rootNode.hasBody()) return this.rootNode.body;

        throw Error("Statement must have a root body.");
    }

    /**
     * Return this statement's keyword if it has one. Otherwise return an empty string.
     *
     * @returns text representation of statement's keyword or an empty string if it has none
     */
    getKeyword(): string {
        if (this.keywordIndex > -1) return (this.tokens[this.keywordIndex] as Token).text;

        return "";
    }

    // FFD
    performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    // FFD
    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    // /**
    //  * Actions performed when a code construct is inserted within a hole of this code construct.
    //  *
    //  * @param insertCode code being inserted
    //  */
    // onInsertInto(insertCode: CodeConstruct, args?: {}) {}

    //TODO: #526 should be changed to return InsertionResult and populate that result with an appropriate message/code
    /**
     * Validates if the given code construct can be inserted into this context.
     *
     * @param validator - Singleton validator instance
     * @param providedContext - Current context
     */
    abstract validateContext(validator: Validator, providedContext: Context): InsertionType;

    //actions that need to occur when the focus is switched off of this statement
    onFocusOff(arg: any): void {
        return;
    }

    markCallbackForDeletion(callbackType: CallbackType, callbackId: string): void {
        this.callbacksToBeDeleted.set(callbackType, callbackId);
    }

    getSimpleDraftTooltip(): Tooltip {
        return this.simpleDraftTooltip;
    }

    getSimpleInvalidTooltip(): Tooltip {
        return this.simpleInvalidTooltip;
    }

    onDelete(): void {
        return;
    }

    onReplaceToken(args: Object): void {
        return;
    }

    addHighlight(rgbColour: [number, number, number, number], editor: Editor) {
        new ConstructHighlight(editor, this, rgbColour);
    }
}

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
    constructor(keyword: string, min_repeat?: number, max_repeat?: number) {
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
    // private argumentsIndices = new Array<number>();
    keyword: string = "";
    requiredModule: string;
    hasSubValues: boolean = false;
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
     * List of all assignments within the statement.
     */
    private assignmentIndices: number[] = [];

    /**
     * Map of all possible constructs. The key is the name of the construct, the value is the construct itself.
     */
    static constructs: Map<string, GeneralStatement>;

    constructor(construct: any, root?: Statement | Module, indexInRoot?: number, data?: { reference: string }) {
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
            this.requiringConstructs = construct.requiringConstructs.map(
                (req) => new OptionalConstruct(req.ref, req.min_repeat, req.max_repeat)
            );

        for (const token of construct.format) {
            switch (token.type) {
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
                    this.hasSubValues = true;
                    break;
                case "body":
                    this.body.push(new EmptyLineStmt(this, this.body.length));
                    this.scope = new Scope();
                    this.hasSubValues = true;
                    /**
                     * We still need to add scope for constructs without a body like else and elif
                     */
                    break;
                case "identifier":
                    // this.tokens.push(new EditableTextTkn("", RegExp(token.regex), this, this.tokens.length))
                    this.tokens.push(new AssignmentToken(undefined, this, this.tokens.length, RegExp(token.regex)));
                    this.addAssignment(this.tokens.length - 1); // Maybe add this in the token itself
                    break;
                case "reference":
                    this.tokens.push(new ReferenceTkn(data?.reference ?? "", this, this.tokens.length));
                    break;
                case "collection":
                    break;
                case "editable":
                    this.tokens.push(
                        new EditableTextTkn(token.value ?? "", RegExp(token.regex), this, this.tokens.length)
                    );
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
        this.constructs = constructs.reduce((map, construct) => {
            map.set(construct.keyword, construct);
            return map;
        }, new Map());
    }

    /**
     * Check if the current construct is depending on / requires the given construct.
     * The given construct is required by the current construct.
     *
     * @param construct - The construct to check if the current construct is depending
     * on / requires it
     * @returns true if the current construct is depending on / requires the given construct,
     */
    isDependentOf(construct: GeneralStatement): boolean {
        if (!construct) return false;
        return this.requiredConstructs.includes(construct.getKeyword());
    }

    /**
     * Check if the current construct has the given construct as a dependent / requiring construct
     *
     * @param construct - The construct to check if it is depending on / requires the current construct
     * @returns true if the current construct has the given construct as a dependent / requiring construct
     */
    hasDependent(construct: GeneralStatement): boolean {
        if (!construct) return false;
        return this.requiringConstructs.some((dependent) => dependent.getConstructName() === construct.getKeyword());
    }

    /**
     * Get all AssignmentTokens within the statement which contain all identifier information.
     *
     * @returns All AssignmentTokens within the statement
     */
    getAssignments(): AssignmentToken[] {
        return this.assignmentIndices.map((index) => {
            if (this.tokens[index] instanceof AssignmentToken) return this.tokens[index] as AssignmentToken;
            else console.error(`Token at index ${index} within ${this} is not an assignment token`);
        });
    }

    addAssignment(index: number) {
        this.assignmentIndices.push(index);
    }

    /**
     * Set the identifier of the assignment token at the given index to the given identifier
     */
    setAssignmentIdentifier(identifier: string, index: number) {
        if (this.tokens[index] instanceof AssignmentToken) {
            (this.tokens[index] as AssignmentToken).setIdentifierText(identifier); // Should maybe be setEditedText
        } else console.error(`Token at index ${index} within ${this} is not an assignment token`);
    }

    /**
     * Whether the statement contains any assignments
     *
     * @returns true if the statement contains any assignments, false otherwise
     */
    containsAssignments(): boolean {
        return this.assignmentIndices.length > 0;
    }

    getKeyword(): string {
        return this.keyword;
    }

    isAtomic(): boolean {
        return !this.hasSubValues;
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

                // Depending / requiring construct to start checking from
                let currentConstruct = context.lineStatement;

                // There is no construct in front of the current one, so the insertion is invalid
                if (!currentConstruct) break;

                // Get the next construct in the editor after this
                let nextConstruct = validator.getNextSiblingOf(currentConstruct);

                if (nextConstruct) {
                    // Check if it appears in the depending constructs list
                    let nextIndex = depConstructsInfo.findIndex(
                        (construct) => construct.getConstructName() === nextConstruct.getKeyword()
                    );

                    // If it appears in the depending constructs at the same place of after the last
                    // found depending construct, then we take that as the next construct
                    while (nextIndex >= dependingIndex) {
                        // Update the current with all the next construct information
                        dependingIndex = nextIndex;
                        currentConstruct = nextConstruct;

                        // Check if the following construct in the editor also appears
                        // in the depending constructs list
                        nextConstruct = validator.getNextSiblingOf(nextConstruct);

                        if (!nextConstruct) break;

                        nextIndex = depConstructsInfo.findIndex(
                            (construct) => construct.getConstructName() === nextConstruct.getKeyword()
                        );
                    }
                }

                // Keep track of how many times each depending construct has been visited / appeared, starting
                // from the current construct to the first requiring construct
                const dependingVisited = new Array(dependingIndex + 1).fill(0);

                // The current construct we want to insert also needs to be counted
                // Because we assume that each requiring construct can appear at least once, we do not need to
                // check the constraints
                // dependingVisited[dependingIndex] = 1;

                let prevConstruct = currentConstruct; // NOT OKAY

                // TODO: Not completely correct: what if there are multiple of the first requiring construct?
                while (dependingIndex >= 0) {
                    const currentEditorConstruct = currentConstruct;
                    if (currentConstruct === context.lineStatement) {
                        prevConstruct = prevConstruct === currentConstruct ? this : prevConstruct;
                        currentConstruct = this;
                    }

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
                        currentConstruct = validator.getPrevSiblingOf(currentEditorConstruct) as GeneralStatement; // NOT OKAY

                        // In case there are not yet any constructs in front of the current position
                        if (!currentConstruct) {
                            break;
                        }
                    }
                }

                // Now we are at required construct and we have handled all the depending constructs
                if (currentConstruct && currentConstruct.getKeyword() === requiredConstruct.getKeyword()) {
                    // We found the required construct
                    if (this.getKeyword() == "else") console.log("Check 6");
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
        const checker = (construct: Construct, stmts: ImportStatement[]) => {
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

/**
 * Wat de expression betreft:
 * Kunnen wrs expression & statement samennemen
 *  Vereist de toevoeging van "returns" field aan statement
 * Meeste methods van expression kunnen gedropt worden, zolang er geen nood is aan
 * types. Moet echter wel nagedacht worden hoe dan de autocomplete & disabling
 * zou gebeuren van de toolbox items!
 */

export class GeneralExpression extends GeneralStatement {
    // Overwrite types of the superclass
    rootNode: GeneralExpression | GeneralStatement = null;

    constructor(
        construct: ConstructDefinition,
        root?: GeneralStatement | Module,
        indexInRoot?: number,
        data?: { reference: string }
    ) {
        super(construct, root, indexInRoot, data);
    }

    getLineNumber(): number {
        return this.lineNumber ?? this.rootNode.getLineNumber();
    }

    getSelection(): Selection {
        const line = this.getLineNumber();

        return new Selection(line, this.rightCol, line, this.leftCol);
    }

    /**
     * Get the parent statement of the current expression
     *
     * @returns The parent statement of the current expression
     */
    getParentConstruct(): Statement {
        // Change to GeneralStatement in the future
        if (this.rootNode instanceof Module) console.warn("Expressions can not be used at the top level");
        else {
            return this.rootNode.getParentConstruct();
        }
    }

    canReplaceWithConstruct(newExpr: Expression): InsertionResult {
        // Currently simply return Valid, change if this poses problems
        return new InsertionResult(InsertionType.Valid, "", []);
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.atEmptyExpressionHole(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }
}

/**
 * A statement that returns a value such as: binary operators, unary operators, function calls that return a value, literal values, and variables.
 */
export abstract class Expression extends Statement implements Construct {
    rootNode: Expression | Statement = null; // OVERBODIG? OVERGEERFT VAN STATEMENT;
    // ALLEEN TYPING IS ANDERS ... can misschien samen worden genomen als statement en expression
    // gefuseerd worden

    // TODO: can change this to an Array to enable type checking when returning multiple items
    returns: DataType; // ONLY FOR TYPING
    // OVERGEERFT VAN STATEMENT?
    simpleInvalidTooltip = Tooltip.InvalidInsertExpression; // NODIG KINDA

    constructor(returns: DataType) {
        super();

        this.returns = returns;
    }

    getLineNumber(): number {
        return this.rootNode.getLineNumber();
        /**
         * this.lineNumber seems to always work? Maybe we can simply remove this?
         */
        // ABSTRACT THIS? e.g. getLineNumber() { return this.lineNumber || this.rootNode.getLineNumber(); }
    }

    getSelection(): Selection {
        const line = this.lineNumber >= 0 ? this.lineNumber : this.getLineNumber();

        return new Selection(line, this.rightCol, line, this.leftCol);
        /**
         * Again, linenumber seems to always work ... and we can just replace "line" with
         * "this.getLineNumber()" which works both in statement and expression
         */
    }

    getParentConstruct(): Statement {
        return this.rootNode.getParentConstruct();
        /**
         * Generalisatie:
         * if (this.returns) return this.rootNode.getParentStatement(); // If expression
         * else return this; // If statement
         */
    }

    onDelete(): void {
        return;
        /**
         * Already in Statement class
         */
    }
}

export abstract class Modifier extends Expression {
    declare rootNode: Expression | Statement; // Why? Already defined in Expression?
    leftExprTypes: Array<DataType>;
    simpleInvalidTooltip = Tooltip.InvalidInsertModifier;

    constructor() {
        super(null);
    }

    getModifierText(): string {
        return "";
        /**
         * Only used in one call; can we remove this?
         */
    }
}

/**
 * The smallest code construct: identifiers, holes (for either identifiers or expressions), operators and characters etc.
 */
export abstract class Token implements Construct {
    isTextEditable = false;
    rootNode: Construct = null;
    indexInRoot: number;
    leftCol: number;
    rightCol: number;
    text: string;
    isEmpty: boolean = false;
    callbacks = new Map<string, Array<Callback>>();
    message = null;
    draftModeEnabled = false;
    draftRecord = null;
    // codeConstructName = ConstructName.Default;
    callbacksToBeDeleted = new Map<CallbackType, string>();
    simpleDraftTooltip = Tooltip.None;
    simpleInvalidTooltip = Tooltip.None;

    constructor(text: string, root?: Construct) {
        for (const type in CallbackType) this.callbacks[type] = new Array<Callback>();

        this.rootNode = root;
        this.text = text;
    }

    getBoundaries({ selectIndent = false } = {}): Range {
        // Linenumber of the given construct
        const lineNumber = this.getLineNumber();

        // If the indent (one indent) has to be included in the selection range
        if (selectIndent) {
            return new Range(lineNumber, this.leftCol - TAB_SPACES, lineNumber, this.rightCol);
        } else return new Range(lineNumber, this.leftCol, lineNumber, this.rightCol);
    }

    getNearestScope(): Scope {
        return this.rootNode.getNearestScope();
    }

    subscribe(type: CallbackType, callback: Callback) {
        this.callbacks[type].push(callback);
    }

    unsubscribe(type: CallbackType, callerId: string) {
        let index = -1;

        for (let i = 0; i < this.callbacks[type].length; i++) {
            if (this.callbacks[type].callerId == callerId) {
                index = i;

                break;
            }
        }

        if (index > 0) this.callbacks[type].splice(index, 1);
    }

    notify(type: CallbackType) {
        for (const callback of this.callbacks[type]) callback.callback(this);

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
    build(pos: Position): Position {
        this.leftCol = pos.column;

        if (this.text.length == 0) {
            console.warn(
                "do not use any Tokens with no textual length (i.e. all tokens should take some space in the editor)."
            );
            this.rightCol = pos.column;
        } else this.rightCol = pos.column + this.text.length;

        this.notify(CallbackType.change);

        if (this.text.length == 0) return new Position(pos.lineNumber, this.rightCol);
        else return new Position(pos.lineNumber, this.rightCol);
    }

    /**
     * Finds and returns the next empty hole (name or value) in this code construct
     * @returns The found empty token or null (if nothing it didn't include any empty tokens)
     */
    getInitialFocus(): UpdatableContext {
        if (this.isEmpty) return { tokenToSelect: this };

        return { positionToMove: new Position(this.getLineNumber(), this.rightCol) };
    }

    getRenderText(): string {
        return this.text;
    }

    getLineNumber(): number {
        if (this.rootNode instanceof Statement) return this.rootNode.getLineNumber();
        else return (this.rootNode as Expression).getLineNumber();
    }

    getLeftPosition(): Position {
        return new Position(this.getLineNumber(), this.leftCol);
    }

    getRightPosition(): Position {
        return new Position(this.getLineNumber(), this.rightCol);
    }

    getSelection(): Selection {
        const line = this.getLineNumber();

        return new Selection(line, this.rightCol, line, this.leftCol);
    }

    getParentConstruct(): Statement {
        return this.rootNode.getParentConstruct();
    }

    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    onFocusOff(arg: any): void {
        return;
    }

    performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    // typeValidateInsertionIntoHole(insertCode: Expression, insertInto: TypedEmptyExpr): InsertionResult {
    //     return new InsertionResult(InsertionType.Valid, "", []);
    // }

    markCallbackForDeletion(callbackType: CallbackType, callbackId: string): void {
        this.callbacksToBeDeleted.set(callbackType, callbackId);
    }

    getKeyword(): string {
        return this.getRenderText();
    }

    getSimpleDraftTooltip(): Tooltip {
        return this.simpleDraftTooltip;
    }

    getSimpleInvalidTooltip(): Tooltip {
        return this.simpleInvalidTooltip;
    }

    onDelete() {
        return;
    }

    // getTypes(): DataType[] {
    //     return [];
    // }

    addHighlight(rgbColour: [number, number, number, number], editor: Editor) {
        new ConstructHighlight(editor, this, rgbColour);
    }
}

/**
 * Anything that implements these, can be edited with the keyboard
 */
export interface TextEditable {
    /**
     * The Regex used for validating this code-construct.
     */
    validatorRegex: RegExp;

    /**
     * Returns the editable portion of the element's text that could be edited later.
     */
    getEditableText(): string;

    /**
     * checks if the newly updated string could be set (using a Regex) and rebuilds the item if possible and returns `true`, o.w. returns `false`.
     * @param text the updated string to be set to this element.
     */
    setEditedText(text: string): boolean;

    /**
     * Returns the token that corresponds to this text-editable item.
     */
    getToken(): Token;
}

// REPLACED
/**
 * Import statement construct
 */
export class ImportStatement extends Statement {
    private moduleNameIndex: number = -1;
    private itemNameIndex: number = -1;
    constructor(moduleName: string = "", itemName: string = "") {
        super();

        this.tokens.push(new NonEditableTkn("from ", this, this.tokens.length));
        this.moduleNameIndex = this.tokens.length;
        this.tokens.push(new EditableTextTkn(moduleName, new RegExp("^[a-zA-Z]*$"), this, this.tokens.length));
        this.tokens.push(new NonEditableTkn(" import ", this, this.tokens.length));
        this.itemNameIndex = this.tokens.length;
        this.tokens.push(new EditableTextTkn(itemName, new RegExp("^[a-zA-Z]*$"), this, this.tokens.length));

        this.subscribe(
            CallbackType.onFocusOff,
            new Callback(() => {
                this.onFocusOff({ module: this.getModule() });
            })
        );
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return InsertionType.Valid; // Temporary fix
        // return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
        //     ? InsertionType.Valid
        //     : InsertionType.Invalid;
    }

    getImportModuleName(): string {
        return this.tokens[this.moduleNameIndex].getRenderText();
    }
    getImportItemName(): string {
        return this.tokens[this.itemNameIndex].getRenderText();
    }

    onFocusOff(args: any): void {
        if (this.getImportModuleName() !== "" && this.getImportItemName() !== "") {
            //TODO: Not efficient, but the only way to improve this is to constantly maintain an updated "imported" status
            //on the construct requiring an import, which is tedious so I left it for now. If this ever becomes an issue, that is the solution.
            args.module.validator.validateImports();
        }
    }

    setImportModule(txt: string) {
        (this.tokens[this.moduleNameIndex] as EditableTextTkn).setEditedText(txt);
    }

    setImportItem(txt: string) {
        (this.tokens[this.itemNameIndex] as EditableTextTkn).setEditedText(txt);
    }

    onDelete(): void {
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
    hasEmptyToken = false;

    constructor(root?: Statement | Module, indexInRoot?: number) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.canInsertEmptyLine(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    build(pos: Position): Position {
        this.lineNumber = pos.lineNumber;
        this.leftCol = this.rightCol = pos.column;

        return new Position(this.lineNumber, this.rightCol);
    }

    getInitialFocus(): UpdatableContext {
        return { positionToMove: this.getLeftPosition() };
    }

    getRenderText(): string {
        return "";
    }

    toString(): string {
        return "EmptyLine";
    }
}

/**
 * A reference expression to a variable "x". The value of the expression is equal to the value of the
 * variable referenced.
 */
export class VariableReferenceExpr extends Expression {
    isEmpty = false;
    identifier: string;
    uniqueId: string;

    constructor(id: string, returns: DataType, uniqueId: string, root?: Statement, indexInRoot?: number) {
        super(returns);

        const idToken = new NonEditableTkn(id, this, this.tokens.length);
        this.keywordIndex = this.tokens.length;
        this.tokens.push(idToken);

        this.uniqueId = uniqueId;
        this.identifier = id;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        if (validator.atEmptyExpressionHole(providedContext)) return InsertionType.Valid;
        else if (validator.onEmptyLine(providedContext)) return InsertionType.DraftMode;
        else return InsertionType.Invalid;
    }

    getKeyword(): string {
        return this.tokens[this.keywordIndex].getRenderText();
    }
}

/**
 * {@link Construct}s implementing this interface need to be imported
 */
export interface Importable {
    requiredModule: string;

    // DEAD CODE
    // validateImport(importedModule: string, importedItem: string): boolean;
    validateImportOnInsertion(module: Module, currentInsertionType: InsertionType): InsertionType;
    validateImportFromImportList(imports: ImportStatement[]): boolean;
    requiresImport(): boolean;
}

/**
 * Text token that can be edited by the user
 * In other words, the token does not form one static keyword but can be changed by the user
 */
export class EditableTextTkn extends Token implements TextEditable {
    isTextEditable = true;
    validatorRegex: RegExp;

    constructor(text: string, regex: RegExp, root?: Construct, indexInRoot?: number) {
        super(text);
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.validatorRegex = regex;

        if (text === "") this.isEmpty = true;
    }

    getToken(): Token {
        return this;
    }

    getSelection(): Selection {
        const leftPos = this.getLeftPosition();

        return new Selection(leftPos.lineNumber, leftPos.column + this.text.length, leftPos.lineNumber, leftPos.column);
    }

    getEditableText(): string {
        return this.text;
    }

    setEditedText(text: string): boolean {
        if (this.validatorRegex.test(text)) {
            this.text = text;
            (this.rootNode as Expression).rebuild(this.getLeftPosition(), this.indexInRoot);

            if (text === "") this.isEmpty = true;
            else this.isEmpty = false;

            return true;
        } else {
            this.notify(CallbackType.fail);
            return false;
        }
    }

    build(pos: Position): Position {
        this.leftCol = pos.column;

        if (this.text.length == 0) {
            console.warn("Do not use any Tokens with 0 textual length.");
            this.rightCol = pos.column;
        } else this.rightCol = pos.column + this.text.length;

        this.notify(CallbackType.change);

        return new Position(pos.lineNumber, this.rightCol);
    }
}

/**
 * Editable token used to represent an identifier
 */
export class IdentifierTkn extends Token implements TextEditable {
    isTextEditable = true;
    validatorRegex: RegExp;

    constructor(
        identifier?: string,
        root?: Construct,
        indexInRoot?: number,
        validatorRegex = RegExp("^[^\\d\\W]\\w*$")
    ) {
        super(identifier == undefined ? "  " : identifier);

        if (identifier == undefined) this.isEmpty = true;
        else this.isEmpty = false;

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.validatorRegex = validatorRegex;
    }

    getToken(): Token {
        return this;
    }

    getEditableText(): string {
        return this.text;
    }

    /**
     * Update the identifier text to the new text while performing validation and rebuilding the statement
     *
     * @param text - The new text to set the identifier to
     * @returns Whether the new text is valid
     */
    setEditedText(text: string): boolean {
        if (this.validatorRegex.test(text)) {
            this.setIdentifierText(text);
            (this.rootNode as Statement).rebuild(this.getLeftPosition(), this.indexInRoot);

            if (this.text.length > 0) this.isEmpty = false;
            if (this.text.length == 0) this.isEmpty = true;

            return true;
        } else {
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
    setIdentifierText(text: string) {
        this.text = text;

        if (this.text != EMPTYIDENTIFIER) this.isEmpty = false;
    }

    isEmptyIdentifier(): boolean {
        return this.text == EMPTYIDENTIFIER;
    }
}

/**
 * Handles the creation, (re)assignment and deletion of variables with regards to
 * the scope, AST and visual representation.
 */
export class AssignmentToken extends IdentifierTkn {
    /**
     * The old identifier of the assignment token. This is used to keep track of the
     * identifier before it was changed, easily update the old references and detect
     * changes in the identifier.
     */
    private oldIdentifier = EMPTYIDENTIFIER;

    /**
     * getIdentifier = getRenderText
     *
     * What do you need to know about the identifiers?
     * * When typing, we need to know the potential in-scope identifiers
     * * When we change or remove, we need to potentially add warnings to references
     *
     * uniqueId is possibly not necessary; above methods thus possibly unnecessary
     */

    constructor(identifier?: string, root?: Statement, indexInRoot?: number, regex?: RegExp) {
        super(identifier, root, indexInRoot, regex);

        this.subscribe(
            CallbackType.onFocusOff,
            new Callback(() => {
                this.onFocusOff();
            })
        );
        this.subscribe(CallbackType.delete, new Callback(() => this.onDelete()));
    }

    onFocusOff(): void {
        // Get the current identifier
        const currentIdentifier = this.getRenderText();
        // Get the parent statement
        const parentStmt = this.getParentConstruct();
        // Get the nearest scope
        const stmtScope = parentStmt.getNearestScope();

        if (currentIdentifier !== this.oldIdentifier) {
            // The identifier has changed
            if (currentIdentifier === EMPTYIDENTIFIER) {
                // The identifier has been emptied

                // Remove the variable from the nearest scope
                stmtScope.removeAssignment(this);
            } else {
                // If it goes from empty to non-empty, add the variable to the nearest scope
                if (this.oldIdentifier === EMPTYIDENTIFIER && currentIdentifier !== EMPTYIDENTIFIER) {
                    stmtScope.addAssignment(this);
                }

                // We now need to update all references to the new variable to remove fixed warnings
                this.updateRefWarnings();
            }

            // An empty identifier is not a valid identifier and has thus no references pointing to it
            if (this.oldIdentifier !== EMPTYIDENTIFIER) {
                // We need to add warnings to all references to the old variable
                this.updateRefWarnings(this.oldIdentifier);
            }
        }

        // Update the old identifier
        this.oldIdentifier = currentIdentifier;
    }

    /**
     * Update the warnings of all references to the current token, either with
     * the current identifier or with the given identifier. If an reference is
     * covered by an assignment statement, the warning is removed. If not, a
     * warning is added.
     *
     * @param identifierName - The identifier to which all references will be updated.
     * If left empty, the current identifier will be used.
     */
    updateRefWarnings(identifierName?: string): void {
        // List of variable reference expressions refering to the current token
        const varRefs: GeneralStatement[] = [];
        // Get the statement containing the token
        const parentStmt = this.getParentConstruct();
        // Current identifier
        const currentIdentifier = identifierName ?? this.getRenderText();

        // Go through all constructs and add the construct if it is a variable reference to the given assignment token
        // and is in draft mode
        parentStmt.getModule().performActionOnBFS((code) => {
            (code as GeneralStatement).tokens?.forEach((refTkn) => {
                if (refTkn instanceof ReferenceTkn) console.log(refTkn.text, currentIdentifier);
            });
            if (
                code instanceof GeneralStatement &&
                code.tokens.some((refTkn) => {
                    return refTkn instanceof ReferenceTkn && refTkn.text === currentIdentifier;
                })
                // && code.draftModeEnabled
            ) {
                // varRefs.push(code); // TEMPORARY DISABLED BECAUSE THE MESSAGE FUNCTIONALITY RESULTS IN ERRORS
            }
        });

        // Go through all variable reference expressions in draft mode and remove the warning if the reference is
        // covered by an assignment statement
        for (const ref of varRefs) {
            // Scope of the reference expression
            const refScope = ref.getNearestScope();

            // If the assignment statement covers the reference expression, then update the reference expression
            if (refScope.covers(currentIdentifier, ref.getLineNumber())) {
                // A valid assignment found, thus remove the warning
                parentStmt.getModule().closeConstructDraftRecord(ref);
            } else {
                // No valid assignment found, thus add the warning
                parentStmt
                    .getModule()
                    .openDraftMode(
                        ref,
                        "This variable has been removed and cannot be referenced anymore. Consider deleting this reference.",
                        []
                    );
            }
        }
    }

    /**
     * On deletion of the assignment, update the scope, check for other
     * assignments to the variable and update the variable references
     */
    onDelete(): void {
        const parentStmt = this.getParentConstruct();
        const currentScope = parentStmt.getNearestScope();

        // Remove the assignment from the nearest scope
        currentScope.removeAssignment(this);

        // Check if a reference on the current location to the deleted assignment would
        // be invalid
        if (!currentScope.covers(this.getRenderText(), this.getLineNumber())) {
            // References to the deleted variable after this point could be invalid
            // if there are no assignments between the deleted variable and the reference
            this.updateRefWarnings();
        }
    }
}

/**
 * Construct to be able to place non-statement (expressions and tokens) in a statement spot,
 * like the autocomplete Token
 */
export class TemporaryStmt extends Statement {
    constructor(token: Construct) {
        super();

        token.indexInRoot = this.tokens.length;
        token.rootNode = this;
        this.tokens.push(token);
        // console.log("TemporaryStmt: " + token.codeConstructName);
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
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
export class AutocompleteTkn extends Token implements TextEditable {
    isTextEditable = true;
    validatorRegex: RegExp = null;
    autocompleteType: AutoCompleteType;
    validMatches: EditCodeAction[];

    constructor(
        firstChar: string,
        autocompleteCategory: AutoCompleteType,
        validMatches: EditCodeAction[],
        root?: Construct,
        indexInRoot?: number
    ) {
        super(firstChar);

        this.validMatches = validMatches;
        this.autocompleteType = autocompleteCategory;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    getToken(): Token {
        return this;
    }

    getEditableText(): string {
        return this.text;
    }

    // Why use this function? This is less complete than checkMatch?
    /**
     * Get the exact matching EditCodeAction from the list of valid matches
     *
     * @returns - Matching EditCodeAction or null if no match
     */
    isMatch(): EditCodeAction {
        for (const match of this.validMatches) if (this.text == match.matchString) return match;

        return null;
    }

    // insertableTerminatingCharRegex: RegExp[] is the tenth parameter of EditCodeAction
    // which might never be used, I think? Is thus function ever used then? FFD
    isInsertableTerminatingMatch(newChar: string): EditCodeAction {
        for (const match of this.validMatches) {
            if (match.insertableTerminatingCharRegex) {
                for (const matchReg of match.insertableTerminatingCharRegex) {
                    if (this.text == match.matchString && matchReg.test(newChar)) return match;
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
    isTerminatingMatch(): EditCodeAction {
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
    checkMatch(newChar: string, text?: string): EditCodeAction {
        let curText = text !== undefined ? text : this.text;

        // console.log("Match checked: ", newChar, " ", curText);
        // Check if the new character is a terminating character and whether the current text (text
        // before the current character) is a match
        for (const match of this.validMatches) {
            if (match.terminatingChars.indexOf(newChar) >= 0) {
                if (match.trimSpacesBeforeTermChar) curText = curText.trim();

                if (curText == match.matchString) return match;
                else if (match.matchRegex != null && match.matchRegex.test(curText)) return match;
            }
        }
        // console.log("Not completely matched: ", newChar);
        // No exact match when the new character is a terminating character or the new character was not a
        // terminating character
        return null;
    }

    /**
     * Once the token is created, update the text of the token when typing
     */
    setEditedText(text: string): boolean {
        this.text = text;
        (this.rootNode as Expression).rebuild(this.getLeftPosition(), this.indexInRoot);
        // console.log("AutocompleteTkn edited: " + text);
        return true;
    }
}

/**
 * Represents the "holes" in the text that can be filled with expressions
 */
export class TypedEmptyExpr extends Token {
    isEmpty = true;
    type: DataType[];

    constructor(type: DataType[], root?: Construct, indexInRoot?: number) {
        super("    ");

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.type = type;
    }

    getKeyword(): string {
        return "---";
    }
}

/**
 * Single non-editable token. Text is fixed and cannot be changed by the user.
 * Deletion results in the entire token being removed.
 */
export class NonEditableTkn extends Token {
    constructor(text: string, root?: Construct, indexInRoot?: number) {
        super(text);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    getSelection(): Selection {
        return this.rootNode.getSelection();
    }
}

export class ReferenceTkn extends NonEditableTkn {}
