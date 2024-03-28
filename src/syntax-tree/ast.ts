import { Position, Range, Selection } from "monaco-editor";
import { EditCodeAction, InsertionResult } from "../editor/action-filter";
import { ConstructName, EditActionType } from "../editor/consts";
import { EditAction } from "../editor/data-types";
import { DraftRecord } from "../editor/draft";
import { Context, UpdatableContext } from "../editor/focus";
import { Validator } from "../editor/validator";
import { ConstructDefinition } from "../language-definition/definitions";
import { CodeBackground, ConstructHighlight, HoverMessage, InlineMessage } from "../messages/messages";
import { Util, createWarningButton, hasMatch } from "../utilities/util";
import { Callback, CallbackType } from "./callback";
import {
    AugmentedAssignmentOperator,
    AutoCompleteType,
    BinaryOperator,
    DataType,
    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_CONVERT_MSG,
    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_DELETE_MSG,
    GET_BINARY_OPERATION_OPERATOR_NOT_DEFINED_BETWEEN_TYPES,
    GET_LIST_INDEX_TYPE_MISMATCH_CONVERSION_MSG,
    GET_TYPE_CANNOT_BE_CONVERTED_MSG,
    IgnoreConversionRecord,
    InsertionType,
    ListTypes,
    NumberRegex,
    OperatorCategory,
    StringRegex,
    TAB_SPACES,
    TYPE_MISMATCH_ANY,
    TYPE_MISMATCH_EXPR_DRAFT_MODE_STR,
    TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR,
    Tooltip,
    UnaryOperator,
    getOperatorCategory,
    typeToConversionRecord,
} from "./consts";
import { Module } from "./module";
import { Scope } from "./scope";
import { EMPTYIDENTIFIER } from "./settings";
import { TypeChecker } from "./type-checker";
import { VariableController } from "./variable-controller";
import { Editor } from "../editor/editor";

export interface CodeConstruct {
    /**
     * The parent/root node for this code-construct. Statements are the only code construct that could have the Module as their root node.
     */
    rootNode: CodeConstruct | Module;

    /**
     * The index this item has inside its root's body (if root is the Module), or its tokens array.
     */
    indexInRoot: number;

    /**
     * The left column position of this code-construct.
     */
    left: number;

    /**
     * The right column position of this code-construct.
     */
    right: number;

    /**
     * A warning or error message for this code construct. (null if there are no messages)
     */
    message: InlineMessage;

    /**
     * Whether this code construct is in draft mode or not. Always false for Tokens
     */
    draftModeEnabled: boolean;

    draftRecord: DraftRecord;

    codeConstructName: ConstructName;

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
    getBoundaries({ selectIndent }?: { selectIndent: boolean }): Range;

    /**
     * Builds the left and right positions of this node and all of its children nodes recursively.
     * 
     * Implicitly sets the left and right positions and the line number of the construct and all of its tokens.
     * 
     * @param pos - The left position to start building the nodes from
     * @returns The final right position of the whole node (calculated after building all of the children nodes)
     */
    build(pos: Position): Position;

    /**
     * Finds and returns the next empty hole (name or value) in this code construct
     * @returns The found empty token or null (if nothing it didn't include any empty tokens)
     */
    getInitialFocus(): UpdatableContext;

    /**
     * Returns the textual value of the code construct (joining internal tokens for expressions and statements)
     */
    getRenderText(): string;

    /**
     * Returns the line number of this code-construct in the rendered text.
     */
    getLineNumber(): number;

    /**
     * Returns the left-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    getLeftPosition(): Position;

    /**
     * Returns the right-position `(lineNumber, column)` of this code-construct in the rendered text.
     */
    getRightPosition(): Position;

    /**
     * Returns a `Selection` object for this particular code-construct when it is selected
     */
    getSelection(): Selection;

    /**
     * Returns the parent statement of this code-construct (an element of the Module.body array).
     */
    getParentStatement(): Statement;

    /**
     * Subscribes a callback to be fired when the this code-construct is changed (could be a change in its children tokens or the body)
     */
    subscribe(type: CallbackType, callback: Callback);

    /**
     * Removes all subscribes of the given type for this code construct
     */
    unsubscribe(type: CallbackType, callerId: string);

    /**
     * Calls callback of the given type if this construct is subscribed to it.
     */
    notify(type: CallbackType);

    /**
     * Returns the keyword for a statement, identifier for a variable and contents for a literal
     */
    getKeyword(): string;

    //TODO: #526 already returns an insertion result so could also immediately populate it with a context-based message (which it probably does, needs to be checked InsertionResult does have a message field)
    /**
     * Determine whether insertCode can be inserted into a hole belonging to the expression/statement this call was made from.
     *
     * NOTE: The reason why you have to call it on the future parent of insertCode instead of insertCode itself is because before insertCode is inserted into the AST
     * we cannot access the parent's holes through insertCode.rootNode and get their types that way.
     *
     * NOTE: The reason why insertInto is a parameter is because some constructs have multiple holes and we need to know the one we are inserting into.
     *
     * @param insertCode     code being inserted
     * @param insertInto     hole being inserted into
     *
     * @returns Valid if insertCode's type is accepted by insertInto according to what the parent of insertInto is. Draft if insertCode's type an be converted to a type that is accepted by insertInto. Invalid otherwise.
     */
    typeValidateInsertionIntoHole(insertCode: Expression, insertInto?: TypedEmptyExpr): InsertionResult;

    // FFD together with all its children (it is never called)
    /**
     * Actions that need to run after the construct has been validated for insertion, but before it is inserted into the AST.
     *
     * @param insertInto code to insert into
     * @param insertCode code being inserted
     */
    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression): void;

    onFocusOff(arg: any): void;

    // FFD together with all its children (it is never called)
    performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression): void;

    markCallbackForDeletion(callbackType: CallbackType, callbackId: string): void;

    //TODO: This functionality needs to be merged with what Issue #526
    //This should be completely unnecessary once this is integrated with our validation inside of action-filter.ts and validaiton methods such as validateContext
    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct cannot be inserted. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    getSimpleInvalidTooltip(): Tooltip;

    /**
     * Return a tooltip for the toolbox giving a general reason for why this construct would trigger draft mode. This tooltip WILL NOT
     * have detailed, context-based information.
     */
    getSimpleDraftTooltip(): Tooltip;

    onDelete(): void;

    getTypes(): DataType[];

    /**
     * Highlight the given construct with the given colour
     * 
     * @param construct - The construct to highlight
     * @param rgbColour - The colour to highlight the construct with
     */
    addHighlight(rgbColour: [number, number, number, number], editor: Editor) : void;
}

/**
 * A complete code statement such as: variable assignment, function call, conditional, loop, function definition, and other statements.
 */
export abstract class Statement implements CodeConstruct {
    lineNumber: number;
    left: number;
    right: number;
    rootNode: Statement | Module = null;
    indexInRoot: number;
    body = new Array<Statement>();
    scope: Scope = null;
    tokens = new Array<CodeConstruct>();
    hasEmptyToken: boolean;
    callbacks = new Map<string, Array<Callback>>();
    background: CodeBackground = null;
    message: HoverMessage = null;
    keywordIndex = -1;
    hole = null;
    typeOfHoles = new Map<number, Array<DataType>>();
    draftModeEnabled = false;
    draftRecord: DraftRecord = null;
    codeConstructName = ConstructName.Default;
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

    //TODO: See if this needs any changes for #526
    checkInsertionAtHole(index: number, givenType: DataType): InsertionResult {
        if (Object.keys(this.typeOfHoles).length > 0) {
            let holeType = this.typeOfHoles[index];
            let allowedTypes = this.getCurrentAllowedTypesOfHole(index);

            if (allowedTypes.length > 0) {
                holeType = allowedTypes;
            }

            let canConvertToParentType = hasMatch(Util.getInstance().typeConversionMap.get(givenType), holeType);

            if (canConvertToParentType && !hasMatch(holeType, [givenType])) {
                const conversionRecords = typeToConversionRecord.has(givenType)
                    ? typeToConversionRecord.get(givenType).filter((record) => holeType.indexOf(record.convertTo) > -1)
                    : [];

                return new InsertionResult(InsertionType.DraftMode, "", conversionRecords); //NOTE: message is populated by calling code as it has enough context info
            } else if (holeType.some((t) => t == DataType.Any) || hasMatch(holeType, [givenType])) {
                return new InsertionResult(InsertionType.Valid, "", []);
            }
        }

        return new InsertionResult(InsertionType.Invalid, "", []);
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
                    endColumn = curStmt.right;
                }
            }

            // Return the range of the construct
            return new Range(lineNumber, this.left, endLineNumber, endColumn);
            // } else if (this instanceof Statement || this instanceof Token) {
        } else {
            // If the indent (one indent) has to be included in the selection range
            if (selectIndent) {
                return new Range(lineNumber, this.left - TAB_SPACES, lineNumber, this.right);
            } else return new Range(lineNumber, this.left, lineNumber, this.right);
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
        if (!this.hasBody()) return
        
        // Do the same for its children
        for (let i = 0; i < this.body.length; i++)
            // The left position(s) for the children
            this.body[i].build(new Position(pos.lineNumber + i + 1, pos.column + TAB_SPACES));
    }

    build(pos: Position): Position {
        // Set the linenumber and left position
        this.lineNumber = pos.lineNumber;
        this.left = pos.column;

        let curPos = pos;

        // The left position of the first token is the left position of the expression
        for (const token of this.tokens) curPos = token.build(curPos);

        // After going through all tokens, the right position is the right position of the last token
        this.right = curPos.column;

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
        this.right = curPos.column;

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

        return { positionToMove: new Position(this.getLineNumber(), this.right) };
    }

    /**
     * This function should be called after replacing a token within this statement. it checks if the newly added token `isEmpty` or not, and if yes, it will set `hasEmptyToken = true`
     * @param code the newly added node within the replace function
     */
    updateHasEmptyToken(code: CodeConstruct) {
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
    replace(code: CodeConstruct, index: number) {
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

        if (this.tokens[index] instanceof Token) rebuildColumn = this.tokens[index].left;
        else rebuildColumn = (this.tokens[index] as Expression).left;

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
            leftPosToCheck = this.left + TAB_SPACES - 1;

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
        return new Position(this.getLineNumber(), this.left);
    }

    getRightPosition(): Position {
        return new Position(this.getLineNumber(), this.right);
    }

    getSelection(): Selection {
        return new Selection(this.lineNumber, this.right, this.lineNumber, this.left);
    }

    getParentStatement(): Statement {
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

    typeValidateInsertionIntoHole(insertCode: Expression, insertInto?: TypedEmptyExpr): InsertionResult {
        if (
            (insertInto?.type?.indexOf(insertCode.returns) > -1 ||
                insertInto?.type?.indexOf(DataType.Any) > -1 ||
                (hasMatch(insertInto.type, ListTypes) && insertCode.returns === DataType.AnyList)) &&
            insertCode.returns !== DataType.Void
        ) {
            return new InsertionResult(InsertionType.Valid, "", []);
        } //types match or one of them is Any

        //need to check if the type being inserted can be converted into any of the types that the hole accepts
        return insertInto?.canReplaceWithConstruct(insertCode);
    }

    performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    /**
     * Actions performed when a code construct is inserted within a hole of this code construct.
     *
     * @param insertCode code being inserted
     */
    onInsertInto(insertCode: CodeConstruct, args?: {}) {}

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

    // FFD
    onDeleteFrom(args: Object): void {
        return;
    }

    onReplaceToken(args: Object): void {
        return;
    }

    getCurrentAllowedTypesOfHole(index: number, beingDeleted: boolean = false): DataType[] {
        return [];
    }

    getTypes(): DataType[] {
        return [];
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
                    this.tokens.push(new NonEditableTkn(data?.reference ?? "", this, this.tokens.length));
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

    constructor(construct: ConstructDefinition, root?: GeneralStatement | Module, indexInRoot?: number, data?: {"reference": string}) {
        super(construct, root, indexInRoot, data);
    }

    getLineNumber(): number {
        return this.lineNumber ?? this.rootNode.getLineNumber();
    }

    getSelection(): Selection {
        const line = this.getLineNumber();

        return new Selection(line, this.right, line, this.left);
    }

    /**
     * Get the parent statement of the current expression
     *
     * @returns The parent statement of the current expression
     */
    getParentStatement(): Statement {
        // Change to GeneralStatement in the future
        if (this.rootNode instanceof Module) console.warn("Expressions can not be used at the top level");
        else {
            return this.rootNode.getParentStatement();
        }
    }

    canReplaceWithConstruct(newExpr: Expression): InsertionResult {
        // Currently simply return Valid, change if this poses problems
        return new InsertionResult(InsertionType.Valid, "", []);
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.atEmptyExpressionHole(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    // getInitialFocus(): UpdatableContext {
    //     /**
    //      * REWRITE TO:
    //      * Focus next empty hole if there is one, else place cursor after expression
    //      * Currently cursor always moves behind the structure, not in one of the holes if one is available
    //      */
    //     let newContext = new Context();

    //     return { positionToMove: new Position(this.lineNumber, this.right) };
    //     switch (this.tokens.length) {
    //         case 3:
    //         case 1:
    //             return { positionToMove: new Position(this.lineNumber, this.left + 1) };

    //         case 0:
    //             return { positionToMove: new Position(this.lineNumber, this.right) };
    //     }
    // }
}

/**
 * A statement that returns a value such as: binary operators, unary operators, function calls that return a value, literal values, and variables.
 */
export abstract class Expression extends Statement implements CodeConstruct {
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

        return new Selection(line, this.right, line, this.left);
        /**
         * Again, linenumber seems to always work ... and we can just replace "line" with
         * "this.getLineNumber()" which works both in statement and expression
         */
    }

    getParentStatement(): Statement {
        return this.rootNode.getParentStatement();
        /**
         * Generalisatie:
         * if (this.returns) return this.rootNode.getParentStatement(); // If expression
         * else return this; // If statement
         */
    }

    /**
     * Update types of holes within the expression as well as the expression's return
     * type when insertCode is inserted into it.
     *
     * @param insertCode code being inserted.
     */
    performTypeUpdatesOnInsertInto(insertCode: Expression) {}
    /**
     * Type specific function, might be obselete if we don't use types
     */

    /**
     * Update types of holes within the expression as well as the expression's return
     * type to "type" when this expression is inserted into the AST.
     *
     * @param type new return/expression hole type
     */
    performTypeUpdatesOnInsertion(type: DataType) {}
    /**
     * Idem
     */

    //TODO: see if this needs any changes for #526
    /**
     * Return whether this construct can be replaced with newExpr based on their respective types.
     * Can replace a bin expression in only two cases
     *   1: newExpr has the same return type
     *   2: newExpr can be cast/modified to become the same type as the bin op being replaced
     */
    canReplaceWithConstruct(newExpr: Expression): InsertionResult {
        //when we are replacing at the top level (meaning the item above is a Statement),
        //we need to check types against the type of hole that used to be there and not the expression
        //that is currently there

        //Might need the same fix for MemberCallStmt in the future, but it does not work right now so cannot check

        // If the rootnode is an valid expression
        if (this.rootNode instanceof Expression && !this.draftModeEnabled) {
            //when replacing within expression we need to check if the replacement can be cast into or already has the same type as the one being replaced
            if (newExpr.returns === this.returns || this.returns === DataType.Any) {
                // If datatype of newExpr is the same as the datatype of the expression being replaced
                // or the datatype of the expression being replaced is Any
                return new InsertionResult(InsertionType.Valid, "", []);
            } else if (
                newExpr.returns !== this.returns &&
                hasMatch(Util.getInstance().typeConversionMap.get(newExpr.returns), [this.returns]) &&
                !(this.rootNode instanceof BinaryOperatorExpr)
            ) {
                // Types don't match but can be converted
                const conversionRecords = typeToConversionRecord.has(newExpr.returns)
                    ? typeToConversionRecord.get(newExpr.returns).filter((record) => record.convertTo == this.returns)
                    : [];

                return new InsertionResult(
                    InsertionType.DraftMode,
                    TYPE_MISMATCH_EXPR_DRAFT_MODE_STR(this.getKeyword(), [this.returns], newExpr.returns),
                    conversionRecords
                );
            } else if (this.rootNode instanceof BinaryOperatorExpr) {
                const typeOfHoles = this.rootNode.typeOfHoles[this.indexInRoot];
                if (
                    hasMatch(typeOfHoles, [newExpr.returns]) ||
                    hasMatch(Util.getInstance().typeConversionMap.get(newExpr.returns), typeOfHoles)
                ) {
                    return new InsertionResult(InsertionType.DraftMode, "", []);
                }
            } else {
                return new InsertionResult(InsertionType.Invalid, "", []);
            }
        } else if (!(this.rootNode instanceof Module)) {
            // rootNode is either a statement or an expression in draft mode
            const rootTypeOfHoles = (this.rootNode as Statement).typeOfHoles;

            if (Object.keys(rootTypeOfHoles).length > 0) {
                const typesOfParentHole = rootTypeOfHoles[this.indexInRoot];

                let canConvertToParentType = hasMatch(
                    Util.getInstance().typeConversionMap.get(newExpr.returns),
                    typesOfParentHole
                );

                if (canConvertToParentType && !hasMatch(typesOfParentHole, [newExpr.returns])) {
                    const conversionRecords = typeToConversionRecord.has(newExpr.returns)
                        ? typeToConversionRecord
                              .get(newExpr.returns)
                              .filter((record) => typesOfParentHole.indexOf(record.convertTo) > -1)
                        : [];

                    return new InsertionResult(
                        InsertionType.DraftMode,
                        TYPE_MISMATCH_EXPR_DRAFT_MODE_STR(
                            this.rootNode.getKeyword(),
                            typesOfParentHole,
                            newExpr.returns
                        ),
                        conversionRecords
                    );
                } else if (
                    typesOfParentHole?.some((t) => t == DataType.Any) ||
                    hasMatch(typesOfParentHole, [newExpr.returns])
                ) {
                    return new InsertionResult(InsertionType.Valid, "", []);
                }
            }
        }
        return new InsertionResult(InsertionType.Invalid, "", []);
    }

    // updateVariableType(dataType: DataType) {
    //     //TODO: This probably needs to be recursive since this won't catch nested expression type updates
    //     if (this.rootNode instanceof VarAssignmentStmt) {
    //         this.rootNode.dataType = dataType;
    //     } else if (this.rootNode instanceof ForStatement) {
    //         this.rootNode.loopVar.dataType = TypeChecker.getElementTypeFromListType(dataType);
    //     }
    // }

    onDelete(): void {
        return;
        /**
         * Already in Statement class
         */
    }

    // DEAD CODE?
    // getReplacementTypse(): DataType[] {
    //     return [this.returns];
    // }

    getTypes(): DataType[] {
        return [this.returns];
        /**
         * Change to:
         * return this.returns ? [this.returns] : [];
         */
    }

    //TODO: Probably needs to be filled. At least in every construct, but there should be general logic that applies to all expressions as well,
    //Currently only implemented for BinOps due to time constraints
    validateTypes(module: Module) {
        return;
        /**
         * Might be obselete if we don't use types
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
export abstract class Token implements CodeConstruct {
    isTextEditable = false;
    rootNode: CodeConstruct = null;
    indexInRoot: number;
    left: number;
    right: number;
    text: string;
    isEmpty: boolean = false;
    callbacks = new Map<string, Array<Callback>>();
    message = null;
    draftModeEnabled = false;
    draftRecord = null;
    codeConstructName = ConstructName.Default;
    callbacksToBeDeleted = new Map<CallbackType, string>();
    simpleDraftTooltip = Tooltip.None;
    simpleInvalidTooltip = Tooltip.None;

    constructor(text: string, root?: CodeConstruct) {
        for (const type in CallbackType) this.callbacks[type] = new Array<Callback>();

        this.rootNode = root;
        this.text = text;
    }

    getBoundaries({ selectIndent = false } = {}): Range {
        // Linenumber of the given construct
        const lineNumber = this.getLineNumber();

        // If the indent (one indent) has to be included in the selection range
        if (selectIndent) {
            return new Range(lineNumber, this.left - TAB_SPACES, lineNumber, this.right);
        } else return new Range(lineNumber, this.left, lineNumber, this.right);
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
        this.left = pos.column;

        if (this.text.length == 0) {
            console.warn(
                "do not use any Tokens with no textual length (i.e. all tokens should take some space in the editor)."
            );
            this.right = pos.column;
        } else this.right = pos.column + this.text.length;

        this.notify(CallbackType.change);

        if (this.text.length == 0) return new Position(pos.lineNumber, this.right);
        else return new Position(pos.lineNumber, this.right);
    }

    /**
     * Finds and returns the next empty hole (name or value) in this code construct
     * @returns The found empty token or null (if nothing it didn't include any empty tokens)
     */
    getInitialFocus(): UpdatableContext {
        if (this.isEmpty) return { tokenToSelect: this };

        return { positionToMove: new Position(this.getLineNumber(), this.right) };
    }

    getRenderText(): string {
        return this.text;
    }

    getLineNumber(): number {
        if (this.rootNode instanceof Statement) return this.rootNode.getLineNumber();
        else return (this.rootNode as Expression).getLineNumber();
    }

    getLeftPosition(): Position {
        return new Position(this.getLineNumber(), this.left);
    }

    getRightPosition(): Position {
        return new Position(this.getLineNumber(), this.right);
    }

    getSelection(): Selection {
        const line = this.getLineNumber();

        return new Selection(line, this.right, line, this.left);
    }

    getParentStatement(): Statement {
        return this.rootNode.getParentStatement();
    }

    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    onFocusOff(arg: any): void {
        return;
    }

    performPostInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {}

    typeValidateInsertionIntoHole(insertCode: Expression, insertInto: TypedEmptyExpr): InsertionResult {
        return new InsertionResult(InsertionType.Valid, "", []);
    }

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

    getTypes(): DataType[] {
        return [];
    }

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

export interface VariableContainer {
    assignId();

    assignVariable(varController: VariableController, currentIdentifierAssignments: Statement[]);

    assignNewVariable(varController: VariableController);

    assignExistingVariable(currentIdentifierAssignments: Statement[]);

    reassignVar(
        oldVarId: string,
        varController: VariableController,
        currentIdentifierAssignments: Statement[],
        oldIdentifierAssignments: Statement[]
    );
}

export class Argument {
    type: DataType[];
    name: string;
    isOptional: boolean;

    constructor(type: DataType[], name: string, isOptional: boolean) {
        this.type = type;
        this.name = name;
        this.isOptional = isOptional;
    }
}

// REPLACED
/**
 * While construct
 */
export class WhileStatement extends Statement {
    declare scope: Scope;
    private conditionIndex: number;

    constructor(root?: CodeConstruct | Module, indexInRoot?: number) {
        super();

        this.tokens.push(new NonEditableTkn("while ", this, this.tokens.length));
        this.conditionIndex = this.tokens.length;
        this.tokens.push(new TypedEmptyExpr([DataType.Boolean], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Boolean];
        this.tokens.push(new NonEditableTkn(" :", this, this.tokens.length));

        this.body.push(new EmptyLineStmt(this, 0));
        this.scope = new Scope();

        this.hasEmptyToken = true;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}

// REPLACED
/**
 * If statement with a body
 */
export class IfStatement extends Statement {
    private conditionIndex: number;

    constructor(root?: CodeConstruct | Module, indexInRoot?: number) {
        super();

        this.tokens.push(new NonEditableTkn("if ", this, this.tokens.length));
        this.conditionIndex = this.tokens.length;
        this.tokens.push(new TypedEmptyExpr([DataType.Boolean], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Boolean];
        this.tokens.push(new NonEditableTkn(" :", this, this.tokens.length));

        this.body.push(new EmptyLineStmt(this, 0));
        this.scope = new Scope();

        this.hasEmptyToken = true;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}

// REPLACED
/**
 * Else and elif statement (depending on whether or not they have a condition). They are part of the body of an if statement (and
 * can only be in the body of an if statement).
 */
export class ElseStatement extends Statement {
    private conditionIndex: number;
    hasCondition: boolean = false;

    constructor(hasCondition: boolean, root?: IfStatement, indexInRoot?: number) {
        super();
        this.hasCondition = hasCondition;

        if (hasCondition) {
            this.tokens.push(new NonEditableTkn("elif ", this, this.tokens.length));
            this.conditionIndex = this.tokens.length;
            this.tokens.push(new TypedEmptyExpr([DataType.Boolean], this, this.tokens.length));
            this.typeOfHoles[this.tokens.length - 1] = [DataType.Boolean];
            this.tokens.push(new NonEditableTkn(" :", this, this.tokens.length));
        } else this.tokens.push(new NonEditableTkn("else:", this, this.tokens.length));

        this.scope = new Scope();

        if (this.hasCondition) {
            this.hasEmptyToken = true;
            this.simpleInvalidTooltip = Tooltip.InvalidInsertElif;
        } else {
            this.simpleInvalidTooltip = Tooltip.InvalidInsertElse;
        }
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) &&
            (this.hasCondition
                ? validator.canInsertElifStmtAtCurIndent(providedContext) ||
                  validator.canInsertElifStmtAtPrevIndent(providedContext)
                : validator.canInsertElseStmtAtCurIndent(providedContext) ||
                  validator.canInsertElseStmtAtPrevIndent(providedContext))
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
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
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
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
 * For statement construct
 */
// export class ForStatement extends Statement implements VariableContainer {
//     buttonId: string;
//     private identifierIndex: number;
//     private iteratorIndex: number;

//     loopVar: VarAssignmentStmt = null;

//     //TODO: Statements should not have a data type?
//     dataType = DataType.Any;

//     constructor(root?: CodeConstruct | Module, indexInRoot?: number) {
//         super();

//         this.buttonId = "";

//         // Can be gotten from the configuration file
//         this.tokens.push(new NonEditableTkn("for ", this, this.tokens.length));
//         this.identifierIndex = this.tokens.length;
//         this.tokens.push(new IdentifierTkn(undefined, this, this.tokens.length));
//         this.tokens.push(new NonEditableTkn(" in ", this, this.tokens.length));
//         this.iteratorIndex = this.tokens.length;
//         // Next two lines can be removed (no typing for now)
//         this.tokens.push(
//             new TypedEmptyExpr(
//                 [DataType.AnyList, DataType.StringList, DataType.NumberList, DataType.BooleanList, DataType.String],
//                 this,
//                 this.tokens.length
//             )
//         );
//         this.typeOfHoles[this.tokens.length - 1] = [
//             DataType.AnyList,
//             DataType.StringList,
//             DataType.NumberList,
//             DataType.BooleanList,
//             DataType.String,
//         ];
//         this.tokens.push(new NonEditableTkn(" :", this, this.tokens.length));

//         this.body.push(new EmptyLineStmt(this, 0));

//         this.scope = new Scope();

//         this.hasEmptyToken = true;

//         this.loopVar = new VarAssignmentStmt();
//         this.loopVar.rootNode = this;

//         this.subscribe(
//             CallbackType.onFocusOff,
//             new Callback(() => {
//                 this.onFocusOff();
//             })
//         );

//         this.subscribe(
//             CallbackType.delete,
//             new Callback(() => {
//                 this.onDelete();
//             })
//         );
//     }

//     setIterator(iterator: Expression, runningValidation: boolean = false) {
//         this.tokens[this.iteratorIndex] = iterator;
//         this.updateLoopVarType(iterator);
//     }

//     validateContext(validator: Validator, providedContext: Context): InsertionType {
//         return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
//             ? InsertionType.Valid
//             : InsertionType.Invalid;
//     }

//     // Usefulness?
//     // rebuild(pos: Position, fromIndex: number) {
//     //     super.rebuild(pos, fromIndex);
//     // }

//     getIdentifier(): string {
//         return this.tokens[this.identifierIndex].getRenderText();
//     }

//     onFocusOff(): void {
//         if (!this.loopVar.lineNumber) {
//             this.loopVar.lineNumber = this.lineNumber;
//         }

//         const currentIdentifier = this.getIdentifier();
//         const oldIdentifier = this.loopVar.getOldIdentifier();
//         const varController = this.getModule().variableController;

//         if (currentIdentifier !== oldIdentifier) {
//             if (currentIdentifier === "  " && oldIdentifier !== "") {
//                 if (
//                     Scope.getAllScopesOfStmt(this).filter(
//                         (scope) =>
//                             scope.references.filter(
//                                 (ref) =>
//                                     ref.statement instanceof VarAssignmentStmt &&
//                                     ref.statement.buttonId === this.buttonId
//                             ).length > 0
//                     ).length === 0
//                 ) {
//                     //only delete anything related to the for loop var if no assignment to the same variable exists in a  parent scope.
//                     varController.removeVariableRefButton(this.buttonId);
//                     varController.addWarningToVarRefs(
//                         this.buttonId,
//                         this.getIdentifier(),
//                         this.getModule(),
//                         this.loopVar
//                     );
//                 }

//                 this.scope.references = this.scope.references.filter((ref) => ref.statement !== this.loopVar);

//                 this.loopVar.updateIdentifier("  ", "  ", false);
//                 this.buttonId = "";
//             } else {
//                 const currentIdentifierAssignments = this.scope.getAllVarAssignmentsToNewVar(
//                     currentIdentifier,
//                     this.getModule(),
//                     this.lineNumber,
//                     this.loopVar
//                 );

//                 const oldIdentifierAssignments = (
//                     this.rootNode as Statement | Module
//                 ).scope.getAllVarAssignmentsToNewVar(oldIdentifier, this.getModule(), this.lineNumber, this.loopVar);

//                 if (this.buttonId === "") {
//                     //when we are changing a new var assignment statement
//                     this.assignVariable(varController, currentIdentifierAssignments);
//                 } else {
//                     //when we are changing an existing var assignment statement
//                     this.reassignVar(
//                         this.buttonId,
//                         varController,
//                         currentIdentifierAssignments,
//                         oldIdentifierAssignments
//                     );
//                 }

//                 varController.updateVarButtonWithType(
//                     this.loopVar.buttonId,
//                     this.scope,
//                     this.lineNumber,
//                     this.getIdentifier()
//                 );
//             }
//         }
//     }

//     assignId() {
//         if (this.buttonId === "") {
//             this.buttonId = "add-var-ref-" + VarAssignmentStmt.uniqueId;
//             this.loopVar.buttonId = this.buttonId;
//             VarAssignmentStmt.uniqueId++;
//         }
//     }

//     assignVariable(varController: VariableController, currentIdentifierAssignments: Statement[]) {
//         if (currentIdentifierAssignments.length === 0) {
//             this.assignNewVariable(varController);
//         } else if (currentIdentifierAssignments.length > 0) {
//             this.assignExistingVariable(currentIdentifierAssignments);
//         }
//         varController.updateExistingRefsOnReinitialization(this.loopVar);
//     }

//     assignNewVariable(varController: VariableController) {
//         this.assignId();
//         this.loopVar.updateIdentifier(this.getIdentifier(), this.getIdentifier(), false);
//         varController.addVariableRefButton(this.loopVar);
//         this.getModule().processNewVariable(
//             this,
//             this.rootNode instanceof Module || this.rootNode instanceof Statement ? this.rootNode.scope : null
//         );

//         this.getModule().variableController.updateVarButtonWithType(
//             this.buttonId,
//             this.scope ?? (this.rootNode as Module | Statement).scope, //NOTE: You just need the closest parent scope, but I think in all cases it will be the scope of the root node since we are either inside of the Module's body or another statement's
//             this.lineNumber,
//             this.getIdentifier()
//         );
//     }

//     assignExistingVariable(currentIdentifierAssignments: Statement[]) {
//         const statement =
//             currentIdentifierAssignments[0] instanceof VarAssignmentStmt
//                 ? currentIdentifierAssignments[0]
//                 : (currentIdentifierAssignments[0] as ForStatement).loopVar;

//         this.buttonId = statement.buttonId;
//         this.loopVar.buttonId = statement.buttonId;

//         this.loopVar.updateIdentifier(this.getIdentifier(), this.getIdentifier());

//         if (this.scope.references.filter((ref) => ref.statement === this.loopVar).length === 0)
//             this.scope.references.push(new Reference(this.loopVar, this.scope));
//     }

//     reassignVar(
//         oldVarId: string,
//         varController: VariableController,
//         currentIdentifierAssignments: Statement[],
//         oldIdentifierAssignments: Statement[]
//     ) {
//         //just removed last assignment to the old var
//         if (oldIdentifierAssignments.length === 0) {
//             varController.removeVariableRefButton(oldVarId);
//         }

//         if (currentIdentifierAssignments.length === 0) {
//             //variable being reassigned to is a new variable
//             this.buttonId = "";
//             this.assignNewVariable(varController);
//         } else if (currentIdentifierAssignments.length > 0) {
//             //variable being reassigned to already exists
//             this.assignExistingVariable(currentIdentifierAssignments);
//         }
//     }

//     private updateLoopVarType(insertCode?: Expression, type?: DataType) {
//         if (type) {
//             this.loopVar.dataType = type;
//         } else {
//             if (insertCode instanceof ListLiteralExpression || ListTypes.indexOf(insertCode.returns) > -1) {
//                 this.loopVar.dataType = TypeChecker.getElementTypeFromListType(insertCode.returns);
//             } else {
//                 this.loopVar.dataType = insertCode.returns;
//             }
//         }
//     }

//     onInsertInto(insertCode: Expression) {
//         this.updateLoopVarType(insertCode);
//         this.getModule().variableController.updateReturnTypeOfRefs(this.loopVar.buttonId);
//     }

//     onDelete() {
//         const varController = this.getModule().variableController;
//         const assignments = (this.rootNode as Statement | Module).scope.getAllAssignmentsToVariableWithinScope(
//             this.getIdentifier(),
//             this
//         );

//         if (assignments.length === 0) {
//             varController.removeVariableRefButton(this.buttonId);
//             varController.addWarningToVarRefs(this.buttonId, this.getIdentifier(), this.getModule(), this.loopVar);
//         }
//     }

//     onReplaceToken(args: { indexInRoot: number; replaceWithEmptyExpr: boolean }): void {
//         if (args.replaceWithEmptyExpr) this.updateLoopVarType(null, DataType.Any);

//         if (args.indexInRoot === this.iteratorIndex) {
//             this.getModule().variableController.updateReturnTypeOfRefs(this.loopVar.buttonId);
//         }
//     }
// }

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
        this.left = this.right = pos.column;

        return new Position(this.lineNumber, this.right);
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
 * The default assignment statement to assign a value to a variable.
 * This statement also manages the variable's scope and references as well as the variable's button in the toolbox and the variable updates in the AST
 */
// export class VarAssignmentStmt extends Statement implements VariableContainer {
//     /**
//      * Counter for the unique id keeping track across all instances of VarAssignmentStmt
//      */
//     static uniqueId: number = 0;
//     /**
//      * The DOM id of the reference button in the toolbox AND the unique id of the variable itself
//      */
//     buttonId: string = "";
//     /**
//      * The index of the identifier token (e.g. 'x') in the tokens array
//      */
//     private identifierIndex: number;
//     private valueIndex: number;
//     /**
//      * The data type of the variable; by default it is set to Any
//      */
//     dataType = DataType.Any;
//     /**
//      * PURPOSE? TRY TO DELETE?
//      */
//     codeConstructName = ConstructName.VarAssignment;
//     /**
//      * Keep track of what the variable's name was before it was changed, if it was changed
//      */
//     private oldIdentifier: string;

//     /**
//      * Create a new assignment statement
//      *
//      * @param buttonId - The DOM id of the reference button in the toolbox AND the unique id of the variable itself
//      * @param id - The name of the variable, its identifier, e.g. "x" in "x = 5"
//      * @param root - The root construct that this statement is a part of, i.e. its parent
//      * @param indexInRoot - The index of this statement in the root construct
//      */
//     constructor(buttonId?: string, id?: string, root?: Statement | Module, indexInRoot?: number) {
//         super();

//         this.rootNode = root;
//         this.indexInRoot = indexInRoot;

//         this.identifierIndex = this.tokens.length;
//         this.tokens.push(new IdentifierTkn(id, this, this.tokens.length));

//         if (id) {
//             // Set the id if there is one
//             this.buttonId = buttonId;
//             this.updateIdentifier(id, id); //TODO: This is a crude hack. Should get the name from the scope or something else that is connected to the AST.
//         } else {
//             // Set the old identifier to the current identifier token which is probably empty
//             this.oldIdentifier = this.getIdentifier();
//         }

//         this.tokens.push(new NonEditableTkn(" = ", this, this.tokens.length));
//         this.valueIndex = this.tokens.length;
//         this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
//         this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];

//         // An empty hole
//         this.hasEmptyToken = true;

//         this.subscribe(
//             CallbackType.onFocusOff,
//             new Callback(() => {
//                 this.onFocusOff();
//             })
//         );

//         this.subscribe(
//             CallbackType.delete,
//             new Callback(() => {
//                 this.onDelete();
//             })
//         );
//     }

//     validateContext(validator: Validator, providedContext: Context): InsertionType {
//         return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
//             ? InsertionType.Valid
//             : InsertionType.Invalid;
//     }

//     // Just calls superclass; can be removed?
//     // rebuild(pos: Position, fromIndex: number) {
//     //     super.rebuild(pos, fromIndex);
//     // }

//     /**
//      * The textual representation of the identifier token e.g. "x" in "x = 5"
//      */
//     getIdentifier(): string {
//         return this.tokens[this.identifierIndex].getRenderText();
//     }

//     /**
//      * Get the old identifier of the variable before
//      *
//      * @returns The old identifier of the variable
//      */
//     getOldIdentifier(): string {
//         return this.oldIdentifier;
//     }

//     /**
//      * Update the identifier of the variable button
//      */
//     updateButton(): void {
//         document.getElementById(this.buttonId).innerHTML = this.getIdentifier();
//     }

//     /**
//      * Set the old and new identifier of the variable and update the button's identifier if required
//      *
//      * @param identifier - The new identifier to set the variable to
//      * @param oldIdentifier - The old identifier of the variable
//      * @param updateButton - Whether or not to update the button's identifier
//      */
//     updateIdentifier(identifier: string, oldIdentifier?: string, updateButton: boolean = true) {
//         // Get the old identifier if it is not provided by getting the current identifier
//         this.oldIdentifier = oldIdentifier ?? this.getIdentifier();

//         // Set the identifier text of the identifier token to the new identifier
//         (this.tokens[this.identifierIndex] as IdentifierTkn).setIdentifierText(identifier);

//         // If there is a valid button id and we want to update the button, update the button's identifier
//         if (this.buttonId && this.buttonId !== "" && updateButton) {
//             this.updateButton();
//         }
//     }

//     /**
//      * Update the identifier of assignment statement
//      *
//      * @param identifier - The new identifier to set the variable to
//      */
//     setIdentifier(identifier: string) {
//         // this is only for user-defined variables (coming from the action-filter)
//         (this.tokens[this.identifierIndex] as IdentifierTkn).setIdentifierText(identifier);
//     }

//     /**
//      * When moving off the assignment statement, update the scopes and references based on the changes or additions
//      * in the current assignment statement
//      */
//     onFocusOff(): void {
//         // Get the current identifier
//         const currentIdentifier = this.getIdentifier();
//         const varController = this.getModule().variableController;

//         // If the current identifier differs from the old identifier, or the button id is empty (i.e. it is a new variable)
//         if (currentIdentifier !== this.oldIdentifier || this.buttonId === "") {
//             // If the identifier is (left) empty (i.e. it is a new variable or the identifier was removed)
//             if (currentIdentifier === "  ") {
//                 // Remove the current assignment statement from the parent's scope
//                 this.removeAssignment();
//                 // If there are no assignments to the old identifier in the parent's scope AND there are no assignments
//                 // with the button id in the entire program
//                 if (
//                     this.rootNode.scope.references.filter(
//                         (ref) => (ref.statement as VarAssignmentStmt).getIdentifier() === this.oldIdentifier
//                     ).length === 0 &&
//                     varController.getAllAssignmentsToVar(this.buttonId, this.getModule()).length === 0
//                 ) {
//                     // Remove the variable reference button
//                     varController.removeVariableRefButton(this.buttonId);
//                 }

//                 // Reset the assignment completely
//                 // Reset the button id
//                 this.buttonId = "";
//                 // Reset the old identifier
//                 this.oldIdentifier = "  ";
//             } else {
//                 // Get all assignments with the current identifier accessable from the current line
//                 const currentIdentifierAssignments = this.rootNode.scope.getAllVarAssignmentsToNewVar(
//                     currentIdentifier,
//                     this.getModule(),
//                     this.lineNumber,
//                     this
//                 );

//                 // Get all assignments with the old identifier accessable from the current line
//                 const oldIdentifierAssignments = this.rootNode.scope.getAllVarAssignmentsToNewVar(
//                     this.oldIdentifier,
//                     this.getModule(),
//                     this.lineNumber,
//                     this
//                 );

//                 // If the button id is empty and there are no other assignments to the current identifier, assign the variable
//                 // This is the case when the assignment statement is new or has been reset and were are changing it
//                 if (this.buttonId === "" && currentIdentifierAssignments.length === 0) {
//                     // Assign a new or existing variable
//                     this.assignVariable(varController, currentIdentifierAssignments);
//                 } else {
//                     // The identifier to which we are assigning after changing it, already exists (i.e. we are reassigning its value)
//                     this.reassignVar(
//                         this.buttonId,
//                         varController,
//                         currentIdentifierAssignments,
//                         oldIdentifierAssignments
//                     );
//                 }

//                 // Set the old identifier to be the current identifier for future changes
//                 this.oldIdentifier = currentIdentifier;

//                 //There are two types of callbacks in focus.ts OnNavChangeCallbacks and OnNavOffCallbacks. They also run in this order.
//                 //The variable is created by the latter and the former runs validation checks. When a variable is first created we therefore
//                 //have to manually run variable-related validations here.
//                 varController.updateVarButtonWithType(
//                     this.buttonId,
//                     this.rootNode.scope,
//                     this.lineNumber,
//                     this.getIdentifier()
//                 );
//                 const insertions = this.getModule().actionFilter.getProcessedVariableInsertions();
//                 // Set toolbox reference buttons to enabled and disabled based on the current insertion possibilities
//                 ToolboxController.updateButtonsVisualMode(insertions);
//             }
//         } else if (currentIdentifier === this.oldIdentifier) {
//             // The identifier itself did not change, but its value and thus type might have
//             varController.updateReturnTypeOfRefs(this.buttonId);
//         }
//     }

//     /**
//      * If the button id is not yet assigned, assign it.
//      * Otherwise the method does nothing.
//      */
//     assignId() {
//         if (this.buttonId === "") {
//             this.buttonId = "add-var-ref-" + VarAssignmentStmt.uniqueId;
//             VarAssignmentStmt.uniqueId++;
//         }
//     }

//     /**
//      * Handles the assignment of a variable: either handling the creation of a new variable or the
//      * assignment of an existing variable
//      *
//      * @param varController
//      * @param currentIdentifierAssignments
//      */
//     assignVariable(varController: VariableController, currentIdentifierAssignments: Statement[]) {
//         // If there are not yet any assignments to the identifier
//         if (currentIdentifierAssignments.length === 0) {
//             this.assignNewVariable(varController);
//             // If there are already assignments to the identifier
//         } else if (currentIdentifierAssignments.length > 0) {
//             this.assignExistingVariable(currentIdentifierAssignments);
//         }
//     }

//     /**
//      * Handle the assignment of a new variable:
//      * * Assign the button id
//      * * Create the variable reference button
//      * * Add the variable to the scope of the parent
//      * * Update the type of the assignment variable
//      * * Update the references as they might now be covered by the assignment where they weren't before
//      *
//      * @param varController - The variable controller
//      */
//     assignNewVariable(varController: VariableController) {
//         // Assign the button id
//         this.assignId();
//         // Create the variable reference button
//         varController.addVariableRefButton(this);
//         // Add the variable to the scope of the parent
//         this.getModule().processNewVariable(
//             this,
//             this.rootNode.scope
//             // this.rootNode instanceof Module || this.rootNode instanceof Statement ? this.rootNode.scope : null // Always true?
//         );

//         // Update the type of the assignment variable
//         this.getModule().variableController.updateVarButtonWithType(
//             this.buttonId,
//             this.scope ?? this.rootNode.scope, //NOTE: You just need the closest parent scope, but I think in all cases it will be the scope of the root node since we are either inside of the Module's body or another statement's
//             this.lineNumber,
//             this.getIdentifier()
//         );
//         // Update the references as they might now be covered by the assignment where they weren't before
//         varController.updateExistingRefsOnReinitialization(this);
//     }

//     /**
//      * Add the variable to the scope of the parent and update existing assignments to the variable
//      *
//      * @param currentIdentifierAssignments - All assignments to the existing identifier
//      */
//     assignExistingVariable(currentIdentifierAssignments: Statement[]) {
//         // Get the first assignment statement
//         const statement =
//             currentIdentifierAssignments[0] instanceof VarAssignmentStmt
//                 ? currentIdentifierAssignments[0]
//                 : (currentIdentifierAssignments[0] as ForStatement).loopVar;

//         // Use the same button id
//         this.buttonId = statement.buttonId;

//         // Any for loops that are using this variable need to be connected to it so that
//         // we don't get duplicate variables. This includes for loops nested inside of other blocks as well
//         const module = this.getModule();
//         const forLoopsWithThisVar = [];
//         // Add all for-loops using the same variable but with a different button id
//         module.performActionOnBFS((code) => {
//             if (
//                 code instanceof ForStatement &&
//                 code.loopVar.buttonId !== this.buttonId &&
//                 code.loopVar.getIdentifier() === this.getIdentifier() &&
//                 code.lineNumber > this.lineNumber
//             ) {
//                 forLoopsWithThisVar.push(code);
//             }
//         });

//         // For each of the for loops, remove the old button and set the new one
//         for (const loop of forLoopsWithThisVar) {
//             module.variableController.removeVariableRefButton(loop.loopVar.buttonId);
//             loop.loopVar.buttonId = this.buttonId;
//         }

//         // If we reassign above current line number, then we might have changed scopes
//         if (this.lineNumber < statement.lineNumber && statement.rootNode !== this.rootNode) {
//             statement.rootNode.scope.references.splice(
//                 statement.rootNode.scope.references.map((ref) => ref.statement).indexOf(statement),
//                 1
//             );
//         }

//         // Add the assignment to the scope of the parent
//         module.processNewVariable(
//             this,
//             this.rootNode instanceof Module || this.rootNode instanceof Statement ? this.rootNode.scope : null
//         );

//         module.variableController.updateExistingRefsOnReinitialization(this);
//     }

//     /**
//      * Handle the reassignment of a variable. The old identifier is checked for any other assignments and correspondingly handled.
//      * The new assignment is either for a new variable or an existing variable.
//      *
//      * @param oldVarId - The old variable button id
//      * @param varController - The variable controller
//      * @param currentIdentifierAssignments - All assignments to the new identifier
//      * @param oldIdentifierAssignments - All assignments to the old identifier
//      */
//     reassignVar(
//         oldVarId: string,
//         varController: VariableController,
//         currentIdentifierAssignments: Statement[],
//         oldIdentifierAssignments: Statement[]
//     ) {
//         // Just removed the last assignment to the old variable identifier
//         if (oldIdentifierAssignments.length === 0) {
//             // Remove the corresponding button
//             varController.removeVariableRefButton(oldVarId);
//             // Add warnings to the remaining references
//             varController.addWarningToVarRefs(this.buttonId, this.oldIdentifier, this.getModule(), this);
//         }

//         // If the variable is being reassigned to a new variable (no other assignments existed before)
//         if (currentIdentifierAssignments.length === 0) {
//             // Add warnings to the variable references to the old identifier if necessary
//             varController.addWarningToVarRefs(this.buttonId, this.oldIdentifier, this.getModule(), this);
//             // New variable, so reset the button id
//             this.buttonId = "";
//             this.assignNewVariable(varController);
//         } else {
//             // Variable being reassigned to already exists
//             this.assignExistingVariable(currentIdentifierAssignments);
//         }

//         varController.updateExistingRefsOnReinitialization(this);
//     }

//     /**
//      * Add the return type of the expression to the variable and update the variable references
//      *
//      * @param insertCode - Expression to insert into the assignment statement
//      */
//     onInsertInto(insertCode: Expression) {
//         // Get the return type of the expression and set it as the data type of the variable
//         this.dataType = insertCode.returns; //#344
//         // Update and validate the return type of the variable references
//         this.getModule().variableController.updateReturnTypeOfRefs(this.buttonId);
//     }

//     /**
//      * Remove the current assignment statement from the parent's scope
//      */
//     removeAssignment() {
//         // // Get all assignment statements in the scope of the root node
//         // const varAssignmentsInScope = this.rootNode.scope.references.map((ref) => ref.statement);

//         // // Remove this assignment statement from the list of assignment statements in the scope if it is there
//         // if (varAssignmentsInScope.indexOf(this) > -1) {
//         //     varAssignmentsInScope.splice(
//         //         (this.rootNode as Module | Statement).scope.references.map((ref) => ref.statement).indexOf(this),
//         //         1
//         //     );
//         // }
//         // Possibly more efficient?
//         const assignmentScope = this.rootNode.scope;
//         assignmentScope.references = assignmentScope.references.filter((ref) => ref.statement !== this);
//     }

//     /**
//      * On deletion of the assignment statement, check for other assignments to the variable and update the variable references
//      */
//     onDelete() {
//         const varController = this.getModule().variableController;

//         // const assignmentScope = this.rootNode.scope;
//         // assignmentScope.references = assignmentScope.references.filter((ref) => ref.statement !== this);
//         // Equivalent?
//         this.removeAssignment();

//         // Get all assignments to the old identifier within the scope of the root node
//         // We need to do this for the old identifier, as the new identifier is possibly empty or changed
//         const assignments = this.rootNode.scope.getAllAssignmentsToVariableWithinScope(this.oldIdentifier, this);

//         // If there are no other assignments to the variable, remove the variable reference button and add warnings to the variable references
//         if (assignments.length === 0) {
//             // Try to get a non empty identifier
//             const identifier = this.getIdentifier() === "  " ? this.oldIdentifier : this.getIdentifier();
//             // Remove the reference button
//             varController.removeVariableRefButton(this.buttonId);
//             // Add warnings to the variable references
//             varController.addWarningToVarRefs(this.buttonId, identifier, this.getModule(), this);
//         } else {
//             // If there are still other assignments to the variable, we need to update the variable references' types
//             varController.updateReturnTypeOfRefs(this.buttonId);
//         }
//     }
// }

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
 * Expression encapsulating an entire value expression, be it a variable or a value that is wrapped.
 * Modifications here are "+", "and" ...
 * => Correct? Might be only for values, not variables ... but there is a isVarSet field...?
 * ===> IS THIS EVEN USED?
 */
export class ValueOperationExpr extends Expression {
    isVarSet = false;

    constructor(value: Expression, modifiers?: Array<Modifier>, root?: Statement, indexInRoot?: number) {
        super(value != null ? value.returns : DataType.Void);

        if (value != null) {
            value.indexInRoot = this.tokens.length;
            value.rootNode = this;

            this.isVarSet = true;
        }

        this.tokens.push(value);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        if (modifiers) for (const mod of modifiers) this.appendModifier(mod);
    }

    setVariable(ref: VariableReferenceExpr) {
        ref.indexInRoot = this.tokens.length;
        ref.rootNode = this;
        this.tokens[0] = ref;
        this.isVarSet = true;
    }

    updateReturnType() {
        for (const mod of this.tokens) {
            if (mod instanceof ListAccessModifier) this.returns = TypeChecker.getElementTypeFromListType(this.returns);
            else if (mod instanceof Expression) this.returns = mod.returns;
        }
    }

    appendModifier(mod: Modifier) {
        mod.indexInRoot = this.tokens.length;
        mod.rootNode = this;

        this.tokens.push(mod);

        // always take the last modifier's return value for the whole expression:
        this.returns = mod.returns;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.atEmptyExpressionHole(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    getKeyword(): string {
        return (this.tokens[this.tokens.length - 1] as Modifier).getModifierText();
    }

    getVarRef(): Expression {
        return this.tokens[0] as Expression;
    }
}

/**
 * ONLY USED TO INSERT A VARIABLE REFERENCE ON AN EMPTY LINE ==> DELETE?
 *
 * Statement encapsulating a variable assignment operation.
 * Can be a variable reference but also operations on the reference or
 * modifiers on the reference.
 *
 * Seems to be null in most cases (at least when created) and only becomes equal to
 * a reference when an existing variable is referenced, when it is inserted and of all those
 * calls, the last one is non-null.
 * => Correct?
 */
export class VarOperationStmt extends Statement {
    isVarSet = false;

    constructor(ref: VariableReferenceExpr, modifiers?: Array<Modifier>, root?: Statement, indexInRoot?: number) {
        super();

        if (ref != null) {
            ref.indexInRoot = this.tokens.length;
            ref.rootNode = this;
            this.isVarSet = true;
        }

        this.tokens.push(ref);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        if (modifiers)
            for (const mod of modifiers) {
                mod.indexInRoot = this.tokens.length;
                mod.rootNode = this;

                this.tokens.push(mod);
            }
        // console.log("Variable reference expression" + ref + ";" + new Date().getSeconds());
    }

    setVariable(ref: VariableReferenceExpr) {
        ref.indexInRoot = this.tokens.length;
        ref.rootNode = this;
        this.tokens[0] = ref;
        this.isVarSet = true;
    }

    updateModifierTypes() {
        for (let i = 1; i < this.tokens.length; i++) {
            const mod = this.tokens[i];

            if (mod instanceof AugmentedAssignmentModifier) {
                const rightMostReturnsType = (this.tokens[i - 1] as Expression).returns;
                (mod.tokens[1] as TypedEmptyExpr).type = [rightMostReturnsType];
                mod.typeOfHoles[1] = [rightMostReturnsType];
            }
        }
    }

    /**
     * Expand a variable reference with a modifier like "+="
     * Seems to be only called when it is an augmented assignment modifier
     *
     * @param mod - Augmented(?) assignment(?) modifier
     */
    appendModifier(mod: Modifier) {
        if (mod instanceof AugmentedAssignmentModifier) {
            const rightMostReturnsType = (this.tokens[this.tokens.length - 1] as Expression).returns;
            (mod.tokens[1] as TypedEmptyExpr).type = [rightMostReturnsType];
            mod.typeOfHoles[1] = [rightMostReturnsType];
        }

        mod.indexInRoot = this.tokens.length;
        mod.rootNode = this;

        this.tokens.push(mod);
        // console.log("Append modifier" + mod + ";" + new Date().getSeconds());
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    getVarRef(): VariableReferenceExpr {
        return this.tokens[0] as VariableReferenceExpr;
    }
}

/**
 * Modifier to access a given list index.
 * E.g. [1,2,3]*[0]* => 1
 */
export class ListAccessModifier extends Modifier {
    leftExprTypes = [DataType.AnyList];
    private indexOfIndexTkn: number;

    constructor(root?: ValueOperationExpr | VarOperationStmt, indexInRoot?: number) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(new NonEditableTkn(`[`, this, this.tokens.length));
        this.tokens.push(new TypedEmptyExpr([DataType.Number], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Number];
        this.indexOfIndexTkn = this.tokens.length - 1;
        this.tokens.push(new NonEditableTkn(`]`, this, this.tokens.length));

        this.simpleInvalidTooltip = Tooltip.InvalidInsertListElementAccess;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        // return IndexableTypes.indexOf(providedContext?.expressionToLeft?.returns) > -1 &&
        return !validator.insideFormattedString(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    getModifierText(): string {
        return "[---]";
    }

    validateTypes(module: Module): void {
        const indxTkn = this.tokens[this.indexOfIndexTkn];
        if (indxTkn instanceof Expression && indxTkn.returns !== DataType.Number) {
            if (indxTkn.returns === DataType.Any) {
                module.openDraftMode(
                    indxTkn,
                    TYPE_MISMATCH_ANY(this.typeOfHoles[this.indexOfIndexTkn], indxTkn.returns),
                    [
                        new IgnoreConversionRecord("", null, null, "", null, Tooltip.IgnoreWarning).getConversionButton(
                            indxTkn.getKeyword(),
                            module,
                            indxTkn
                        ),
                    ]
                );
            } else {
                const conversionRecords = TypeChecker.getTypeConversionRecords(indxTkn.returns, DataType.Number);
                const actions = [
                    ...conversionRecords.map((rec) => rec.getConversionButton(indxTkn.getKeyword(), module, indxTkn)),
                ];

                if (conversionRecords.length === 0) {
                    module.openDraftMode(indxTkn, GET_TYPE_CANNOT_BE_CONVERTED_MSG(indxTkn.returns), [
                        createWarningButton(
                            Tooltip.Delete,
                            indxTkn,
                            (() => {
                                this.deleteUnconvertibleTypeWarning(this, indxTkn, module);
                            }).bind(this)
                        ),
                    ]);
                } else {
                    module.openDraftMode(
                        indxTkn,
                        GET_LIST_INDEX_TYPE_MISMATCH_CONVERSION_MSG(indxTkn.returns),
                        actions
                    );
                }
            }
        }
    }

    private deleteUnconvertibleTypeWarning(
        rootExpression: Modifier,
        codeToDelete: CodeConstruct,
        module: Module
    ): void {
        const action = new EditAction(EditActionType.DeleteUnconvertibleOperandWarning, {
            rootExpression: rootExpression,
            codeToDelete: codeToDelete,
        });

        module.executer.execute(action);
    }
}

/**
 * Probably to access the property of an object.(?)
 * ===> NOT USED?
 */
export class PropertyAccessorModifier extends Modifier {
    private propertyName: string;

    constructor(
        propertyName: string,
        exprType: DataType,
        root?: ValueOperationExpr | VarOperationStmt,
        indexInRoot?: number
    ) {
        super();

        this.leftExprTypes = [exprType];
        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(new NonEditableTkn(`.${propertyName}`, this, this.tokens.length));

        this.propertyName = propertyName;
        // console.log("Property constructed", this.propertyName);
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return InsertionType.Valid;
    }

    getModifierText(): string {
        return `.${this.propertyName}`;
    }
}

/**
 * Method's call on a variable or value with a return value. E.g. "hello".split("e")
 */
export class MethodCallModifier extends Modifier {
    functionName: string = "";
    args: Array<Argument>;
    declare returns: DataType;

    constructor(
        functionName: string,
        args: Array<Argument>,
        returns: DataType,
        exprType: DataType,
        root?: ValueOperationExpr | VarOperationStmt,
        indexInRoot?: number
    ) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.functionName = functionName;
        this.args = args;
        this.returns = returns;
        this.leftExprTypes = [exprType];

        if (args.length > 0) {
            this.tokens.push(new NonEditableTkn("." + functionName + "(", this, this.tokens.length));

            for (let i = 0; i < args.length; i++) {
                let arg = args[i];

                this.tokens.push(new TypedEmptyExpr([...arg.type], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [...arg.type];

                if (i + 1 < args.length) this.tokens.push(new NonEditableTkn(", ", this, this.tokens.length));
            }

            this.tokens.push(new NonEditableTkn(")", this, this.tokens.length));

            this.hasEmptyToken = true;
        } else this.tokens.push(new NonEditableTkn(functionName + "()", this, this.tokens.length));
        // When would we enter the else fase? There is a point missing at the start?
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        // let doTypesMatch = this.leftExprTypes.some((type) =>
        //     areEqualTypes(providedContext?.expressionToLeft?.returns, type)
        // );
        let doTypesMatch = true;

        //#514
        if (
            providedContext?.expressionToLeft?.rootNode.rootNode instanceof VarOperationStmt &&
            this.returns === DataType.Void
        ) {
            return InsertionType.Invalid;
        }

        //#260/#341
        if (
            this.returns === DataType.Void &&
            providedContext?.lineStatement instanceof VarOperationStmt &&
            ListTypes.indexOf(providedContext?.lineStatement.getVarRef().returns) > -1
        ) {
            doTypesMatch = true;
        } else if (this.returns === DataType.Void) {
            doTypesMatch = false;
        }

        return validator.atRightOfExpression(providedContext) && doTypesMatch
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    getModifierText(): string {
        let str = `.${this.functionName}(`;

        for (let i = 0; i < this.args.length; i++) {
            str += "---";

            if (i !== this.args.length - 1) {
                str += ", ";
            }
        }

        str += ")";

        return str;
    }
}

/**
 * Assign a value to a variable. E.g. "x = 5"
 * The assignmentModifier itself is "= ---" without the variable and with a hole
 *
 * Requirements:
 * * Left expression needs to be an assignable (like a variable reference, list access ...)
 * * RootNode needs to be a VarOperationStmt
 */
export class AssignmentModifier extends Modifier {
    declare rootNode: VarOperationStmt;
    simpleInvalidTooltip = Tooltip.InvalidAugmentedAssignment;

    constructor(root?: VarOperationStmt, indexInRoot?: number) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(new NonEditableTkn(" = ", this, this.tokens.length));
        this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        // must be after a variable reference that is not been assigned
        // in a statement (not an expression)
        return (providedContext.expressionToLeft instanceof VariableReferenceExpr ||
            providedContext.expressionToLeft instanceof ListAccessModifier ||
            providedContext.expressionToLeft instanceof PropertyAccessorModifier) &&
            providedContext.expressionToLeft.rootNode instanceof VarOperationStmt
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    getModifierText(): string {
        return " = ---";
    }
}

/**
 * Modify a value to a variable. E.g. "x += 5"
 * The assignmentModifier itself is "+= ---" without the variable and with a hole
 * Other options include -=, *=, /=, %=, **=
 *
 * Requirements:
 * * Left expression needs to be an assignable (like a variable reference, list access ...)
 * * RootNode needs to be a VarOperationStmt
 *
 * Similar to {@link AssignmentModifier}
 */
export class AugmentedAssignmentModifier extends Modifier {
    declare rootNode: VarOperationStmt;
    private operation: AugmentedAssignmentOperator;
    simpleInvalidTooltip = Tooltip.InvalidAugmentedAssignment;

    constructor(operation: AugmentedAssignmentOperator, root?: VarOperationStmt, indexInRoot?: number) {
        super();

        this.operation = operation;

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(new NonEditableTkn(` ${operation} `, this, this.tokens.length));
        this.leftExprTypes = [DataType.Number];

        if (operation == AugmentedAssignmentOperator.Add) this.leftExprTypes.push(DataType.String);

        this.tokens.push(new TypedEmptyExpr(this.leftExprTypes, this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [...this.leftExprTypes];

        this.operation = operation;
        this.hasEmptyToken = true;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return (providedContext.expressionToLeft instanceof VariableReferenceExpr ||
            providedContext.expressionToLeft instanceof ListAccessModifier ||
            providedContext.expressionToLeft instanceof PropertyAccessorModifier) &&
            providedContext.expressionToLeft.rootNode instanceof VarOperationStmt
            ? // &&
              // this.leftExprTypes.some((type) => type == providedContext.expressionToLeft.returns)
              InsertionType.Valid
            : InsertionType.Invalid;
    }

    getModifierText(): string {
        return ` ${this.operation} ---`;
    }
}

/**
 * Call functions or methods with a return value. E.g. len("hello")
 * Currently, these are all standard methods
 *
 * Similar to {@link FunctionCallStmt} but for expressions (and thus with return values)
 */
export class FunctionCallExpr extends Expression implements Importable {
    /**
     * function calls such as `print()` are single-line statements, while `randint()` are expressions and could be used inside a more complex expression, this should be specified when instantiating the `FunctionCallStmt` class.
     */
    private argumentsIndices = new Array<number>();
    functionName: string = "";
    args: Array<Argument>;
    requiredModule: string;

    constructor(
        functionName: string,
        args: Array<Argument>,
        returns: DataType,
        root?: Statement,
        indexInRoot?: number,
        requiredModule: string = ""
    ) {
        super(returns);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.functionName = functionName;
        this.args = args;
        this.requiredModule = requiredModule;

        if (args.length > 0) {
            this.tokens.push(new NonEditableTkn(functionName + "(", this, this.tokens.length));

            // TODO: handle parenthesis in a better way (to be able to highlight the other when selecting one)

            for (let i = 0; i < args.length; i++) {
                let arg = args[i];

                this.argumentsIndices.push(this.tokens.length);
                this.tokens.push(new TypedEmptyExpr([...arg.type], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [...arg.type];

                if (i + 1 < args.length) this.tokens.push(new NonEditableTkn(", ", this, this.tokens.length));
            }

            this.tokens.push(new NonEditableTkn(")", this, this.tokens.length));

            this.hasEmptyToken = true;
        } else this.tokens.push(new NonEditableTkn(functionName + "()", this, this.tokens.length));
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        /**
         * Two cases:
         * * Either we are at the left of an expression and the function we want to insert has exactly one element,
         * then we check if the expression to the right has a type that matches the type of the argument of the function
         * we want to insert AND if the function can be inserted at the current hole. (first case however seems bugged)
         * * Otherwise we simply check whether or not we are at an empty expression hole
         */
        // TEMPORARY DISABLED FOR EASY BUG FIXING => SHOULD BE REPLACED BY GENERALISATION
        // if (validator.atLeftOfExpression(providedContext) && this.args.length == 1) {
        //     // check if we can add to next
        //     // has only one arg

        //     const argType = this.args[0].type;
        //     const canInsertExprIntoThisFunction =
        //         argType.some((x) => x == DataType.Any) ||
        //         hasMatch(argType, [providedContext.expressionToRight.returns]);

        //     if (providedContext.expressionToRight.returns) {
        //         const map = Util.getInstance().typeConversionMap.get(providedContext.expressionToRight.returns);

        //         const willItBeDraftMode = hasMatch(map, argType);
        //         const canFunctionBeInsertedAtCurrentHole =
        //             providedContext.expressionToRight.canReplaceWithConstruct(this);

        //         if (
        //             canInsertExprIntoThisFunction &&
        //             canFunctionBeInsertedAtCurrentHole.insertionType == InsertionType.Valid
        //         ) {
        //             return InsertionType.Valid;
        //         } else {
        //             const states = [willItBeDraftMode, canFunctionBeInsertedAtCurrentHole.insertionType];

        //             if (states.some((s) => s == InsertionType.Invalid)) return InsertionType.Invalid;
        //             else if (states.every((s) => s == InsertionType.Valid)) return InsertionType.Valid;
        //             else if (states.some((s) => s == InsertionType.DraftMode)) return InsertionType.DraftMode;
        //         }
        //     } else return InsertionType.Invalid;
        // }

        return validator.atEmptyExpressionHole(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    // DEAD CODE
    // replaceArgument(index: number, to: CodeConstruct) {
    //     this.replace(to, this.argumentsIndices[index]);
    // }

    getFunctionName(): string {
        return this.functionName;
    }

    getKeyword(): string {
        return this.functionName;
    }

    getFullConstructText(): string {
        let text = this.getFunctionName();
        text += "(";

        for (let i = 0; i < this.tokens.length; i++) {
            const tkn = this.tokens[i];

            if (tkn instanceof Expression || tkn instanceof TypedEmptyExpr) {
                text += tkn.getKeyword().replace(/   /g, "---");

                if (i < this.tokens.length - 1 && this.args.length > 1) {
                    text += ",";
                }
            }
        }

        text += ")";

        return text;
    }

    // DEAD CODE
    // validateImport(importedModule: string, importedItem: string): boolean {
    //     return this.requiredModule === importedModule && this.getFunctionName() === importedItem;
    // }

    validateImportOnInsertion(module: Module, currentInsertionType: InsertionType) {
        let insertionType = currentInsertionType;
        let importsOfThisConstruct: ImportStatement[] = [];
        const checker = (construct: CodeConstruct, stmts: ImportStatement[]) => {
            if (
                construct instanceof ImportStatement &&
                this.getLineNumber() > construct.getLineNumber() &&
                this.requiredModule === construct.getImportModuleName()
            ) {
                stmts.push(construct);
            }
        };

        module.performActionOnBFS((code) => checker(code, importsOfThisConstruct));

        if (importsOfThisConstruct.length === 0 && this.requiresImport()) {
            //imports of required module don't exist and this item requires an import
            insertionType = InsertionType.DraftMode;
        } else if (importsOfThisConstruct.length > 0 && this.requiresImport()) {
            //imports of required module exist and this item requires an import
            insertionType =
                importsOfThisConstruct.filter((stmt) => stmt.getImportItemName() === this.getFunctionName()).length > 0
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

        return relevantImports.filter((stmt) => stmt.getImportItemName() === this.getFunctionName()).length > 0
            ? true
            : false;
    }

    requiresImport(): boolean {
        return this.requiredModule !== "";
    }
}

/**
 * {@link CodeConstruct}s implementing this interface need to be imported
 */
export interface Importable {
    requiredModule: string;

    // DEAD CODE
    // validateImport(importedModule: string, importedItem: string): boolean;
    validateImportOnInsertion(module: Module, currentInsertionType: InsertionType): InsertionType;
    validateImportFromImportList(imports: ImportStatement[]): boolean;
    requiresImport(): boolean;
}

// REPLACEABLE
/**
 * Call functions or methods without a return value. E.g. print("hello")
 * Currently these are all standard functions
 *
 * Similar to {@link FunctionCallExpr} but for statements (and thus without return values)
 */
export class FunctionCallStmt extends Statement implements Importable {
    /**
     * function calls such as `print()` are single-line statements, while `randint()` are expressions and could be used inside a more complex expression, this should be specified when instantiating the `FunctionCallStmt` class.
     */
    private argumentsIndices = new Array<number>();
    functionName: string = "";
    requiredModule: string;

    constructor(
        functionName: string,
        args: Array<Argument>,
        root?: Statement | Module,
        indexInRoot?: number,
        requiredModule: string = ""
    ) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.functionName = functionName;
        this.requiredModule = requiredModule;

        if (args.length > 0) {
            this.tokens.push(new NonEditableTkn(functionName + "(", this, this.tokens.length));

            // TODO: handle parenthesis in a better way (to be able to highlight the other when selecting one)

            for (let i = 0; i < args.length; i++) {
                let arg = args[i];

                this.argumentsIndices.push(this.tokens.length);
                this.tokens.push(new TypedEmptyExpr([...arg.type], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [...arg.type];

                if (i + 1 < args.length) this.tokens.push(new NonEditableTkn(", ", this, this.tokens.length));
            }

            this.tokens.push(new NonEditableTkn(")", this, this.tokens.length));

            this.hasEmptyToken = true;
        } else this.tokens.push(new NonEditableTkn(functionName + "()", this, this.tokens.length));
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    // DEAD CODE
    // replaceArgument(index: number, to: CodeConstruct) {
    //     this.replace(to, this.argumentsIndices[index]);
    // }

    getFunctionName(): string {
        return this.functionName;
    }

    getKeyword(): string {
        return this.functionName;
    }

    // DEAD CODE
    // validateImport(importedModule: string, importedItem: string): boolean {
    //     return this.requiredModule === importedModule && this.getFunctionName() === importedItem;
    // }

    validateImportOnInsertion(module: Module, currentInsertionType: InsertionType) {
        let insertionType = currentInsertionType;
        let importsOfThisConstruct: ImportStatement[] = [];
        const checker = (construct: CodeConstruct, stmts: ImportStatement[]) => {
            if (
                construct instanceof ImportStatement &&
                this.getLineNumber() > construct.getLineNumber() &&
                this.requiredModule === construct.getImportModuleName()
            ) {
                stmts.push(construct);
            }
        };

        module.performActionOnBFS((code) => checker(code, importsOfThisConstruct));

        if (importsOfThisConstruct.length === 0 && this.requiresImport()) {
            //imports of required module don't exist and this item requires an import
            insertionType = InsertionType.DraftMode;
        } else if (importsOfThisConstruct.length > 0 && this.requiresImport()) {
            //imports of required module exist and this item requires an import
            insertionType =
                importsOfThisConstruct.filter((stmt) => stmt.getImportItemName() === this.getFunctionName()).length > 0
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

        return relevantImports.filter((stmt) => stmt.getImportItemName() === this.getFunctionName()).length > 0
            ? true
            : false;
    }

    requiresImport(): boolean {
        return this.requiredModule !== "";
    }
}

// DEAD CODE?!? FFD
/**
 * Represents an assignment to an list item at a given index. E.g. "x[0] = 5", with
 * representation ---[---] = ---
 *
 * Seems to be only created in case InsertActionType.InsertListIndexAssignment is set.
 * However, it does seem like this value is never assigned, resulting in this probably being
 * dead code.
 */
export class ListElementAssignment extends Statement {
    constructor(root?: Expression, indexInRoot?: number) {
        super();

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(
            new TypedEmptyExpr(
                [DataType.AnyList, DataType.NumberList, DataType.StringList, DataType.BooleanList],
                this,
                this.tokens.length
            )
        );
        this.typeOfHoles[this.tokens.length - 1] = [
            DataType.AnyList,
            DataType.NumberList,
            DataType.StringList,
            DataType.BooleanList,
        ];
        this.tokens.push(new NonEditableTkn("[", this, this.tokens.length));
        this.tokens.push(new TypedEmptyExpr([DataType.Number], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Number];
        this.tokens.push(new NonEditableTkn("] = ", this, this.tokens.length));
        //TODO: Python lists allow elements of different types to be added to the same list. Should we keep that functionality?
        this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
        // console.log("List element assignment constructed");
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.onEmptyLine(providedContext) && !validator.isAboveElseStatement(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}

// REPLACED
/**
 * Statement consisting of a single keyword like "break", "continue", "pass" ...
 */
// export class KeywordStmt extends Statement {
//     validator: (context: Context) => boolean;

//     constructor(
//         keyword,
//         root?: Statement | Expression,
//         indexInRoot?: number,
//         validator?: (context: Context) => boolean
//     ) {
//         super();

//         this.rootNode = root;
//         this.indexInRoot = indexInRoot;
//         this.validator = validator;

//         this.tokens.push(new NonEditableTkn(keyword, this, this.tokens.length));

//         if (keyword === "break") {
//             this.simpleInvalidTooltip = Tooltip.InvalidInsertBreak;
//         }
//     }

//     validateContext(validator: Validator, providedContext: Context): InsertionType {
//         return validator.onEmptyLine(providedContext) &&
//             !validator.isAboveElseStatement(providedContext) &&
//             this.validator(providedContext)
//             ? InsertionType.Valid
//             : InsertionType.Invalid;
//     }
// }

/**
 * DEAD CODE?!?
 */
// export class MemberCallStmt extends Expression {
//     operator: BinaryOperator;

//     constructor(returns: DataType, root?: Statement | Expression, indexInRoot?: number) {
//         super(returns);

//         this.rootNode = root;
//         this.indexInRoot = indexInRoot;

//         this.tokens.push(
//             new TypedEmptyExpr(
//                 [DataType.AnyList, DataType.NumberList, DataType.StringList, DataType.BooleanList],
//                 this,
//                 this.tokens.length
//             )
//         );
//         this.typeOfHoles[this.tokens.length - 1] = [
//             DataType.AnyList,
//             DataType.NumberList,
//             DataType.StringList,
//             DataType.BooleanList,
//         ];
//         this.tokens.push(new NonEditableTkn("[", this, this.tokens.length));
//         this.tokens.push(new TypedEmptyExpr([DataType.Number], this, this.tokens.length));
//         this.typeOfHoles[this.tokens.length - 1] = [DataType.Number];
//         this.tokens.push(new NonEditableTkn("]", this, this.tokens.length));

//         this.hasEmptyToken = true;
//     }

//     validateContext(validator: Validator, providedContext: Context): InsertionType {
//         return validator.atEmptyExpressionHole(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
//     }
// }

/**
 * Expression for a binary operator like +, -, *, /, %, **, //, ==, !=, <, >,
 * <=, >=, in, not in, and, or ...
 */
export class BinaryOperatorExpr extends Expression {
    operator: BinaryOperator;
    operatorCategory: OperatorCategory;
    private leftOperandIndex: number;
    private rightOperandIndex: number;
    private originalReturnType: DataType;

    static originalTypeOfHolesAdd = new Map<string, Array<DataType>>([
        ["left", [DataType.Number, DataType.String, ...ListTypes]],
        ["right", [DataType.Number, DataType.String, ...ListTypes]],
    ]);
    static originalTypeOfHolesArithmetic = new Map<string, Array<DataType>>([
        ["left", [DataType.Number]],
        ["right", [DataType.Number]],
    ]);
    static originalTypeOfHolesBool = new Map<string, Array<DataType>>([
        ["left", [DataType.Boolean]],
        ["right", [DataType.Boolean]],
    ]);
    static originalTypeOfHolesEquality = new Map<string, Array<DataType>>([
        ["left", [DataType.Any]],
        ["right", [DataType.Any]],
    ]);
    static originalTypeOfHolesIn = new Map<string, Array<DataType>>([
        ["left", [DataType.String, DataType.AnyList, DataType.NumberList, DataType.StringList, DataType.BooleanList]],
        ["right", [DataType.String, DataType.AnyList, DataType.NumberList, DataType.StringList, DataType.BooleanList]],
    ]);
    static originalTypeOfHolesInequality = new Map<string, Array<DataType>>([
        ["left", [DataType.Number, DataType.String]],
        ["right", [DataType.Number, DataType.String]],
    ]);
    static originalReturnTypeBool = DataType.Boolean;
    static originReturnTypeComp = DataType.Boolean;
    static originalReturnTypeAdd = DataType.Any;
    static originalReturnTypeArithmetic = DataType.Number;

    constructor(operator: BinaryOperator, returns: DataType, root?: Statement | Expression, indexInRoot?: number) {
        super(returns);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.operator = operator;
        this.operatorCategory = getOperatorCategory(operator);

        this.tokens.push(new NonEditableTkn("(", this, this.tokens.length));

        this.leftOperandIndex = this.tokens.length;

        this.originalReturnType = returns;

        if (this.operatorCategory === OperatorCategory.Arithmetic && operator == BinaryOperator.Add) {
            if (returns !== DataType.String && returns !== DataType.Number) {
                this.tokens.push(
                    new TypedEmptyExpr([DataType.Number, DataType.String, ...ListTypes], this, this.tokens.length)
                );
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String, ...ListTypes];
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.keywordIndex = this.tokens.length;
                this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.rightOperandIndex = this.tokens.length;
                this.tokens.push(
                    new TypedEmptyExpr([DataType.Number, DataType.String, ...ListTypes], this, this.tokens.length)
                );
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String, ...ListTypes];

                this.returns = DataType.Any;
                this.originalReturnType = DataType.Any;
            } else {
                this.tokens.push(new TypedEmptyExpr([returns], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String, ...ListTypes];
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.keywordIndex = this.tokens.length;
                this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.rightOperandIndex = this.tokens.length;
                this.tokens.push(new TypedEmptyExpr([returns], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String, ...ListTypes];
            }
        } else if (this.operatorCategory === OperatorCategory.Arithmetic) {
            this.tokens.push(new TypedEmptyExpr([DataType.Number], this, this.tokens.length));
            this.typeOfHoles[this.tokens.length - 1] = [DataType.Number];
            this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
            this.keywordIndex = this.tokens.length;
            this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
            this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
            this.rightOperandIndex = this.tokens.length;
            this.tokens.push(new TypedEmptyExpr([DataType.Number], this, this.tokens.length));
            this.typeOfHoles[this.tokens.length - 1] = [DataType.Number];

            this.returns = DataType.Number;
            this.originalReturnType = DataType.Number;
        } else if (this.operatorCategory === OperatorCategory.Boolean) {
            this.tokens.push(new TypedEmptyExpr([DataType.Boolean], this, this.tokens.length));
            this.typeOfHoles[this.tokens.length - 1] = [DataType.Boolean];
            this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
            this.keywordIndex = this.tokens.length;
            this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
            this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
            this.rightOperandIndex = this.tokens.length;
            this.tokens.push(new TypedEmptyExpr([DataType.Boolean], this, this.tokens.length));
            this.typeOfHoles[this.tokens.length - 1] = [DataType.Boolean];

            this.returns = DataType.Boolean;
            this.originalReturnType = DataType.Boolean;
        } else if (this.operatorCategory == OperatorCategory.Comparison) {
            if (this.operator === BinaryOperator.Equal || this.operator === BinaryOperator.NotEqual) {
                this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.keywordIndex = this.tokens.length;
                this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.rightOperandIndex = this.tokens.length;
                this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
            } else if (this.operator === BinaryOperator.In || this.operator === BinaryOperator.NotIn) {
                this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.keywordIndex = this.tokens.length;
                this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.rightOperandIndex = this.tokens.length;
                this.tokens.push(
                    new TypedEmptyExpr(
                        [
                            DataType.String,
                            DataType.AnyList,
                            DataType.NumberList,
                            DataType.StringList,
                            DataType.BooleanList,
                        ],
                        this,
                        this.tokens.length
                    )
                );
                this.typeOfHoles[this.tokens.length - 1] = [
                    DataType.String,
                    DataType.AnyList,
                    DataType.NumberList,
                    DataType.StringList,
                    DataType.BooleanList,
                ];
            } else {
                this.tokens.push(new TypedEmptyExpr([DataType.Number, DataType.String], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String];
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.keywordIndex = this.tokens.length;
                this.tokens.push(new OperatorTkn(operator, this, this.tokens.length));
                this.tokens.push(new NonEditableTkn(" ", this, this.tokens.length));
                this.rightOperandIndex = this.tokens.length;
                this.tokens.push(new TypedEmptyExpr([DataType.Number, DataType.String], this, this.tokens.length));
                this.typeOfHoles[this.tokens.length - 1] = [DataType.Number, DataType.String];
            }

            this.returns = DataType.Boolean;
            this.originalReturnType = DataType.Boolean;
        }

        this.tokens.push(new NonEditableTkn(")", this, this.tokens.length));
        this.hasEmptyToken = true;
    }

    static getRootExpr(expr: BinaryOperatorExpr): BinaryOperatorExpr {
        if (expr.rootNode instanceof BinaryOperatorExpr) return BinaryOperatorExpr.getRootExpr(expr.rootNode);
        else return expr;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        /**
         * Three cases:
         * * We are at an empty expression hole
         * * Either we are at the left of an expression and the current expression to the left has a type compatible
         * with the current binary operator (for example + with numbers and strings, - with numbers etc)
         * * Or we are at the right of an expression and the current expression to the right has a type compatible
         * with the current binary operator (for example + with numbers and strings, - with numbers etc)
         */
        return validator.atEmptyExpressionHole(providedContext) || // type validation will happen later
            (validator.atLeftOfExpression(providedContext) &&
                !(providedContext.expressionToRight.rootNode instanceof VarOperationStmt)) /*&&
                TypeChecker.getAllowedBinaryOperatorsForType(providedContext?.expressionToRight?.returns).some(
                    (x) => x === this.operator
                )*/ ||
            (validator.atRightOfExpression(providedContext) &&
                !(providedContext.expressionToLeft.rootNode instanceof VarOperationStmt)) /*&&
                TypeChecker.getAllowedBinaryOperatorsForType(providedContext?.expressionToLeft?.returns).some(
                    (x) => x === this.operator
                )*/
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    replaceLeftOperand(code: Expression) {
        this.onInsertInto(code);
        this.replace(code, this.leftOperandIndex);
    }

    replaceRightOperand(code: Expression) {
        this.onInsertInto(code);
        this.replace(code, this.rightOperandIndex);
    }

    getLeftOperand(): CodeConstruct {
        return this.tokens[this.leftOperandIndex];
    }

    getRightOperand(): CodeConstruct {
        return this.tokens[this.rightOperandIndex];
    }

    isBoolean(): boolean {
        return this.operatorCategory === OperatorCategory.Boolean;
    }

    isArithmetic(): boolean {
        return this.operatorCategory === OperatorCategory.Arithmetic;
    }

    isComparison(): boolean {
        return this.operatorCategory === OperatorCategory.Comparison;
    }

    /**
     * Update types of empty holes when inserting into the binary operator expression.
     *
     * @param type new return/operand type
     */
    performTypeUpdatesOnInsertion(type: DataType) {
        if (this.operatorCategory !== OperatorCategory.Boolean) {
            //in this case the type arrays will always only contain a single type unless it is the + operator
            const leftOperandTypes = (this.tokens[this.leftOperandIndex] as TypedEmptyExpr).type;
            const rightOperandTypes = (this.tokens[this.rightOperandIndex] as TypedEmptyExpr).type;

            if (leftOperandTypes.indexOf(type) == -1) {
                leftOperandTypes.push(type);
            }

            if (rightOperandTypes.indexOf(type) == -1) {
                rightOperandTypes.push(type);
            }

            this.returns = type;
        }
    }

    /**
     * Removes "type" from the type array of the operands of this expression.
     *
     * @param type type to remove
     */
    removeTypeFromOperands(type: DataType) {
        if (!this.isBoolean()) {
            //in this case the type arrays will always only contain a single type unless it is the + operator
            const leftOperandTypes = (this.tokens[this.leftOperandIndex] as TypedEmptyExpr).type;
            const rightOperandTypes = (this.tokens[this.rightOperandIndex] as TypedEmptyExpr).type;

            if (leftOperandTypes.indexOf(type) > -1) {
                leftOperandTypes.splice(leftOperandTypes.indexOf(type), 1);
            }

            if (rightOperandTypes.indexOf(type) > -1) {
                rightOperandTypes.splice(rightOperandTypes.indexOf(type), 1);
            }
        }
    }

    performPreInsertionUpdates(insertInto?: TypedEmptyExpr, insertCode?: Expression) {
        // Special case. + supports String and number and needs to be updated when it is inserted into a hole of one of those types
        if (
            this.operator === BinaryOperator.Add &&
            (insertInto.type.indexOf(DataType.String) > -1 || insertInto.type.indexOf(DataType.Number) > -1)
        ) {
            this.returns = insertInto.type[0]; // it is safe to assume insertInto.type will have a single type because a hole cannot accept both Number and String
            this.performTypeUpdatesOnInsertion(insertInto.type[0]);

            if (insertInto.type.indexOf(DataType.String) > -1) {
                this.removeTypeFromOperands(DataType.Number);
            } else this.removeTypeFromOperands(DataType.String);
        }
    }

    private performReturnTypeUpdatesForAdditionOnInsertInto(rootExpr: BinaryOperatorExpr) {
        const leftOperand = rootExpr.getLeftOperand();
        const rightOperand = rootExpr.getRightOperand();

        if (leftOperand instanceof BinaryOperatorExpr) {
            rootExpr.performReturnTypeUpdatesForAdditionOnInsertInto(leftOperand);
        }

        if (rightOperand instanceof BinaryOperatorExpr) {
            rootExpr.performReturnTypeUpdatesForAdditionOnInsertInto(rightOperand);
        }

        if (
            leftOperand &&
            rightOperand &&
            leftOperand instanceof TypedEmptyExpr &&
            rightOperand instanceof TypedEmptyExpr
        ) {
            return;
        } else if (rootExpr.operator === BinaryOperator.Add) {
            if (
                leftOperand &&
                rightOperand &&
                leftOperand instanceof Expression &&
                rightOperand instanceof Expression
            ) {
                if (
                    leftOperand.returns === rightOperand.returns &&
                    TypeChecker.getAllowedBinaryOperatorsForType(leftOperand.returns).indexOf(rootExpr.operator) > -1
                ) {
                    rootExpr.returns = leftOperand.returns;
                } else {
                    rootExpr.returns = DataType.Any;
                }
            } else if (
                leftOperand &&
                leftOperand instanceof Expression &&
                (rootExpr.originalReturnType === leftOperand.returns || rootExpr.originalReturnType === DataType.Any)
            ) {
                rootExpr.returns = leftOperand.returns;
            } else if (
                rightOperand &&
                rightOperand instanceof Expression &&
                (rootExpr.originalReturnType === rightOperand.returns || rootExpr.originalReturnType === DataType.Any)
            ) {
                rootExpr.returns = rightOperand.returns;
            } else if (
                leftOperand &&
                leftOperand instanceof TypedEmptyExpr &&
                rightOperand &&
                rightOperand instanceof Expression &&
                (rootExpr.originalReturnType === rightOperand.returns || rootExpr.originalReturnType === DataType.Any)
            ) {
                rootExpr.returns = rightOperand.returns;
            } else if (
                rightOperand &&
                rightOperand instanceof TypedEmptyExpr &&
                leftOperand &&
                leftOperand instanceof Expression &&
                (rootExpr.originalReturnType === leftOperand.returns || rootExpr.originalReturnType === DataType.Any)
            ) {
                rootExpr.returns = leftOperand.returns;
            }
        } else if (rootExpr.isArithmetic()) {
            if (
                leftOperand &&
                rightOperand &&
                leftOperand instanceof Expression &&
                rightOperand instanceof Expression
            ) {
                if (
                    leftOperand.returns === rightOperand.returns &&
                    TypeChecker.getAllowedBinaryOperatorsForType(leftOperand.returns).indexOf(rootExpr.operator) > -1
                ) {
                    rootExpr.returns = leftOperand.returns;
                } else {
                    rootExpr.returns = DataType.Any;
                }
            } else {
                rootExpr.returns = DataType.Any;
            }
        }
    }

    /**
     * Update the return type of an expression and its operands when inserting into the expression.
     *
     * @param insertCode - The code to insert
     */
    performTypeUpdatesOnInsertInto(insertCode: Expression) {
        //return type update
        if (this.isArithmetic() && this.operator === BinaryOperator.Add) {
            const nonEmptyOperand = !this.isOperandEmpty(this.leftOperandIndex)
                ? this.getLeftOperand()
                : !this.isOperandEmpty(this.rightOperandIndex)
                ? this.getRightOperand()
                : null;

            if (nonEmptyOperand) {
                if (nonEmptyOperand instanceof Expression && nonEmptyOperand.returns === insertCode.returns) {
                    if (TypeChecker.isBinOpAllowed(this.operator, nonEmptyOperand.returns, nonEmptyOperand.returns)) {
                        this.returns = nonEmptyOperand.returns;
                    } else {
                        this.returns = DataType.Any;
                    }
                } else if (nonEmptyOperand instanceof Expression && nonEmptyOperand.returns !== insertCode.returns) {
                    this.returns = DataType.Any;
                }
            } else {
                this.returns = insertCode.returns;
            }
        }

        //operand type updates
        if (!this.isBoolean()) {
            //Check if one of the holes is not empty and get its type
            let existingLiteralType = this.getFilledHoleType();

            //if existingLiteralType is null then both operands are still empty holes and since we are inserting
            //into one of them, the types need to be updated
            if (!existingLiteralType && (this.returns === DataType.Any || this.isComparison())) {
                if (
                    this.isOperandEmpty(this.leftOperandIndex) &&
                    TypeChecker.getAllowedBinaryOperatorsForType(insertCode.returns)?.indexOf(this.operator) > -1
                ) {
                    if (ListTypes.indexOf(insertCode.returns) > -1) {
                        (this.tokens[this.leftOperandIndex] as TypedEmptyExpr).type = [...ListTypes];
                    } else {
                        (this.tokens[this.leftOperandIndex] as TypedEmptyExpr).type = [insertCode.returns];
                    }
                }
                if (
                    this.isOperandEmpty(this.rightOperandIndex) &&
                    TypeChecker.getAllowedBinaryOperatorsForType(insertCode.returns)?.indexOf(this.operator) > -1
                ) {
                    if (ListTypes.indexOf(insertCode.returns) > -1) {
                        (this.tokens[this.rightOperandIndex] as TypedEmptyExpr).type = [...ListTypes];
                    } else {
                        (this.tokens[this.rightOperandIndex] as TypedEmptyExpr).type = [insertCode.returns];
                    }
                }
            }

            if (
                insertCode.returns === this.getFilledHoleType() &&
                TypeChecker.getAllowedBinaryOperatorsForType(insertCode.returns)?.indexOf(this.operator) > -1 &&
                this.tokens[this.getIndexOfFilledOperand()].draftModeEnabled
            ) {
                this.getModule().closeConstructDraftRecord(this.tokens[this.getIndexOfFilledOperand()]);
            }
        }

        //find root
        let curr = this as BinaryOperatorExpr;
        while (curr.rootNode !== null && curr.rootNode instanceof BinaryOperatorExpr) {
            curr = curr.rootNode;
        }

        //update return types in root
        if (curr && this.isArithmetic()) this.performReturnTypeUpdatesForAdditionOnInsertInto(curr);
    }

    //should only be used on nested binary ops
    checkAllHolesAreEmpty() {
        let result = [];

        if (
            (!(this.tokens[this.leftOperandIndex] instanceof TypedEmptyExpr) &&
                !(this.tokens[this.leftOperandIndex] instanceof BinaryOperatorExpr)) ||
            (!(this.tokens[this.rightOperandIndex] instanceof TypedEmptyExpr) &&
                !(this.tokens[this.rightOperandIndex] instanceof BinaryOperatorExpr))
        ) {
            result.push(false);
        }

        for (const tkn of this.tokens) {
            if (tkn instanceof BinaryOperatorExpr) {
                result.push(...tkn.checkAllHolesAreEmpty());
            }
        }

        return result;
    }

    //use this for comparators and arithmetic ops to get their top level expression parent in case they are inside of a nested epxression
    getTopLevelBinExpression(): BinaryOperatorExpr {
        let currParentExpression = this.rootNode instanceof BinaryOperatorExpr ? this.rootNode : this;
        let nextParentExpression = this.rootNode instanceof Module ? null : this.rootNode?.rootNode;
        while (nextParentExpression && nextParentExpression instanceof BinaryOperatorExpr) {
            currParentExpression = nextParentExpression;
            nextParentExpression = nextParentExpression.rootNode;
        }

        return currParentExpression as BinaryOperatorExpr;
    }

    /**
     * Return whether all holes of a nested expression are still empty when used on a nested binary operator expression.
     *
     * @returns true if all holes are TypedEmptyExpr. false otherwise.
     */
    areAllHolesEmpty() {
        const topLevelExpression = this.getTopLevelBinExpression();

        return topLevelExpression.checkAllHolesAreEmpty().every((element) => {
            element;
        });
    }

    //this is for finding out if the holes of just this epxression are empty (does not check nestings)
    areOperandsEmpty(): boolean {
        return (
            this.tokens[this.rightOperandIndex] instanceof TypedEmptyExpr &&
            this.tokens[this.leftOperandIndex] instanceof TypedEmptyExpr
        );
    }

    onInsertInto(insertCode: Expression) {
        this.performTypeUpdatesOnInsertInto(insertCode);
    }

    onReplaceToken(args: { indexInRoot: number }): void {
        this.updateReturnTypeOnDeletion(args.indexInRoot);
        const otherOperand = this.getIndexOfOtherOperand(args.indexInRoot);

        if (
            otherOperand > -1 &&
            this.tokens[otherOperand].draftModeEnabled &&
            TypeChecker.getAllowedBinaryOperatorsForType((this.tokens[otherOperand] as Expression).returns).indexOf(
                this.operator
            ) > -1
        ) {
            this.getModule().closeConstructDraftRecord(this.tokens[otherOperand]);
        }

        // this.updateVariableType(this.returns);
    }

    getCurrentAllowedTypesOfHole(index: number, beingDeleted: boolean = false): DataType[] {
        return this.getCurrentAllowedTypesOfOperand(index, beingDeleted);
    }

    validateTypes(module: Module) {
        let curr = this.rootNode;
        while (curr && curr.rootNode instanceof BinaryOperatorExpr) {
            curr = curr.rootNode;
        }
        this.validateBinExprTypes(curr instanceof BinaryOperatorExpr ? curr : this, module);
    }

    getKeyword(): string {
        return `${this.getLeftOperand().getKeyword()} ${this.operator} ${this.getRightOperand().getKeyword()}`;
    }

    /**
     * Only call this when you are sure that the operand is a TypedEmptyExpr
     * @param operand
     */
    updateTypeOfEmptyOperandOnOperatorChange(operand: string) {
        const operandToUpdate = (operand === "left" ? this.getLeftOperand() : this.getRightOperand()) as TypedEmptyExpr;

        switch (this.operatorCategory) {
            case OperatorCategory.Boolean:
                operandToUpdate.type = BinaryOperatorExpr.originalTypeOfHolesBool.get(operand);
                break;
            case OperatorCategory.Comparison:
                if (this.operator === BinaryOperator.Equal || this.operator === BinaryOperator.NotEqual) {
                    operandToUpdate.type = BinaryOperatorExpr.originalTypeOfHolesEquality.get(operand);
                } else {
                    operandToUpdate.type = BinaryOperatorExpr.originalTypeOfHolesInequality.get(operand);
                }
                break;
            case OperatorCategory.Arithmetic:
                if (this.operator === BinaryOperator.Add) {
                    operandToUpdate.type = BinaryOperatorExpr.originalTypeOfHolesAdd.get(operand);
                } else {
                    operandToUpdate.type = BinaryOperatorExpr.originalTypeOfHolesArithmetic.get(operand);
                }
                break;
        }
    }

    //TODO: Passing module recursively is bad for memory
    //TODO: Function is way too large. Can definitely be split into smaller ones.
    /**
     * Check the current binary expression for type mismatches and open draft mode if necessary. Do this
     * recursively for all nested binary expressions.
     *
     * @param expr - Binary expression
     * @param module - Current module
     * @returns Whether the binary expression is valid
     */
    private validateBinExprTypes(expr: BinaryOperatorExpr, module: Module): boolean {
        const leftOperand = expr.getLeftOperand();
        const rightOperand = expr.getRightOperand();
        let leftOpened = false,
            rightOpened = false;

        if (leftOperand instanceof BinaryOperatorExpr) {
            leftOpened = this.validateBinExprTypes(leftOperand, module);
        }

        if (rightOperand instanceof BinaryOperatorExpr) {
            rightOpened = this.validateBinExprTypes(rightOperand, module);
        }

        if (leftOpened || rightOpened) return true;

        //get all conversions
        const leftExprTypes = leftOperand.getTypes();
        const rightExprTypes = rightOperand.getTypes();

        const conversionActionsForLeft = [];
        const conversionActionsForRight = [];

        //if types can be added, there is no need to get conversion records
        let operationDefinedBetweenTypes = false;
        if (leftOperand instanceof Expression && rightOperand instanceof Expression) {
            operationDefinedBetweenTypes = TypeChecker.isBinOpAllowed(
                this.operator,
                leftOperand.returns,
                rightOperand.returns
            );
        }

        if (!operationDefinedBetweenTypes) {
            //get all possible ways of converting all types of left to types of right and vice versa
            for (const leftType of leftExprTypes) {
                for (const rightType of rightExprTypes) {
                    const conversionRecordsLeftToRight = TypeChecker.getTypeConversionRecords(leftType, rightType);
                    const conversionRecordsRightToLeft = TypeChecker.getTypeConversionRecords(rightType, leftType);

                    for (const leftRecord of conversionRecordsLeftToRight) {
                        if (
                            TypeChecker.getAllowedBinaryOperatorsForType(leftRecord.convertTo).indexOf(expr.operator) >
                            -1
                        ) {
                            conversionActionsForLeft.push(
                                leftRecord.getConversionButton(leftOperand.getKeyword(), module, leftOperand)
                            );
                        }
                    }

                    for (const rightRecord of conversionRecordsRightToLeft) {
                        if (
                            TypeChecker.getAllowedBinaryOperatorsForType(rightRecord.convertTo).indexOf(expr.operator) >
                            -1
                        ) {
                            conversionActionsForRight.push(
                                rightRecord.getConversionButton(rightOperand.getKeyword(), module, rightOperand)
                            );
                        }
                    }
                }
            }
        }

        //note that if one of them or both are a TypedEmptyExpr, then any insertions are validated elsewhere
        //so at this point if something is inserted into the left or right operand then that insertion at the very least
        //was NOT invalid
        if (leftOperand instanceof Expression && rightOperand instanceof Expression) {
            if (leftOperand.returns === rightOperand.returns && operationDefinedBetweenTypes) {
                if (leftOperand.draftModeEnabled) module.closeConstructDraftRecord(leftOperand);
                if (rightOperand.draftModeEnabled) module.closeConstructDraftRecord(rightOperand);
                return false;
            }

            //TODO: These if blocks are identical. Should be a function
            if (leftOperand.returns === DataType.Any) {
                module.openDraftMode(
                    leftOperand,
                    TYPE_MISMATCH_ANY(this.typeOfHoles[this.leftOperandIndex], leftOperand.returns),
                    [
                        new IgnoreConversionRecord("", null, null, "", null, Tooltip.IgnoreWarning).getConversionButton(
                            "",
                            module,
                            leftOperand
                        ),
                    ]
                );
            } else if (!operationDefinedBetweenTypes) {
                if (conversionActionsForLeft.length > 0) {
                    module.openDraftMode(
                        leftOperand,
                        TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR([rightOperand.returns], leftOperand.returns),
                        conversionActionsForLeft
                    );
                } else if (
                    conversionActionsForLeft.length === 0 &&
                    !TypeChecker.isBinOpAllowed(expr.operator, leftOperand.returns, rightOperand.returns)
                ) {
                    module.openDraftMode(
                        leftOperand,
                        GET_BINARY_OPERATION_OPERATOR_NOT_DEFINED_BETWEEN_TYPES(
                            expr.operator,
                            leftOperand.returns,
                            rightOperand.returns
                        ),
                        [
                            createWarningButton(
                                Tooltip.Delete,
                                leftOperand,
                                (() => {
                                    this.deleteUnconvertibleOperandWarning(expr, leftOperand, module);
                                }).bind(this)
                            ),
                        ]
                    );
                }
            } else if (leftOperand.draftModeEnabled) {
                module.closeConstructDraftRecord(leftOperand);
            }

            if (rightOperand.returns === DataType.Any) {
                module.openDraftMode(
                    rightOperand,
                    TYPE_MISMATCH_ANY(this.typeOfHoles[this.leftOperandIndex], rightOperand.returns),
                    [
                        new IgnoreConversionRecord("", null, null, "", null, Tooltip.IgnoreWarning).getConversionButton(
                            "",
                            module,
                            rightOperand
                        ),
                    ]
                );
            } else if (!operationDefinedBetweenTypes) {
                if (conversionActionsForRight.length > 0) {
                    module.openDraftMode(
                        rightOperand,
                        TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR([leftOperand.returns], rightOperand.returns),
                        conversionActionsForRight
                    );
                } else if (
                    conversionActionsForRight.length === 0 &&
                    !TypeChecker.isBinOpAllowed(expr.operator, leftOperand.returns, rightOperand.returns)
                ) {
                    module.openDraftMode(
                        rightOperand,
                        GET_BINARY_OPERATION_OPERATOR_NOT_DEFINED_BETWEEN_TYPES(
                            expr.operator,
                            leftOperand.returns,
                            rightOperand.returns
                        ),
                        [
                            createWarningButton(
                                Tooltip.Delete,
                                rightOperand,
                                (() => {
                                    this.deleteUnconvertibleOperandWarning(expr, rightOperand, module);
                                }).bind(this)
                            ),
                        ]
                    );
                }
            } else if (rightOperand.draftModeEnabled) {
                module.closeConstructDraftRecord(rightOperand);
            }

            rightOpened = true;
            leftOpened = true;
        } else if (
            leftOperand instanceof Expression &&
            rightOperand instanceof TypedEmptyExpr &&
            TypeChecker.getAllowedBinaryOperatorsForType(leftOperand.returns).indexOf(expr.operator) === -1
        ) {
            if (conversionActionsForLeft.length > 0) {
                module.openDraftMode(
                    leftOperand,
                    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_CONVERT_MSG(leftOperand.returns, expr.operator),
                    conversionActionsForLeft
                );
            } else {
                module.openDraftMode(
                    leftOperand,
                    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_DELETE_MSG(leftOperand.returns, expr.operator),
                    [
                        createWarningButton(
                            Tooltip.Delete,
                            leftOperand,
                            (() => {
                                this.deleteUnconvertibleOperandWarning(expr, leftOperand, module);
                            }).bind(this)
                        ),
                    ]
                );
            }

            leftOpened = true;
        } else if (
            leftOperand instanceof TypedEmptyExpr &&
            rightOperand instanceof Expression &&
            TypeChecker.getAllowedBinaryOperatorsForType(rightOperand.returns).indexOf(expr.operator) === -1
        ) {
            if (conversionActionsForLeft.length > 0) {
                module.openDraftMode(
                    rightOperand,
                    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_CONVERT_MSG(rightOperand.returns, expr.operator),
                    conversionActionsForRight
                );
            } else {
                module.openDraftMode(
                    rightOperand,
                    GET_BINARY_OPERATION_NOT_DEFINED_FOR_TYPE_DELETE_MSG(rightOperand.returns, expr.operator),
                    [
                        createWarningButton(
                            Tooltip.Delete,
                            rightOperand,
                            (() => {
                                this.deleteUnconvertibleOperandWarning(expr, rightOperand, module);
                            }).bind(this)
                        ),
                    ]
                );
            }

            rightOpened = true;
        }

        return leftOpened || rightOpened;
    }

    //TODO: Duplicated in ListElementAccessModifier
    private deleteUnconvertibleOperandWarning(
        rootExpression: BinaryOperatorExpr,
        codeToDelete: CodeConstruct,
        module: Module
    ): void {
        const action = new EditAction(EditActionType.DeleteUnconvertibleOperandWarning, {
            rootExpression: rootExpression,
            codeToDelete: codeToDelete,
        });

        module.executer.execute(action);
    }

    private getCurrentAllowedTypesOfOperand(index: number, beingDeleted: boolean = false): DataType[] {
        if (this.isBoolean()) {
            return [DataType.Boolean];
        }
        return this.typeOfHoles[index];
    }

    private isOperandEmpty(index: number): boolean {
        return this.tokens[index] instanceof TypedEmptyExpr;
    }

    private updateReturnTypeOnDeletion(operandBeingDeletedIndex: number): void {
        const operandBeingKept = this.tokens[this.getIndexOfOtherOperand(operandBeingDeletedIndex)];

        if (this.isArithmetic() && this.operator === BinaryOperator.Add) {
            if (operandBeingKept instanceof TypedEmptyExpr) {
                this.returns = DataType.Any;
            } else if (operandBeingKept instanceof Expression) {
                this.returns = operandBeingKept.returns;
            }
        } else {
            this.returns = this.originalReturnType;
        }
    }

    private areBothOperandsFilled(): boolean {
        return !this.isOperandEmpty(this.leftOperandIndex) && !this.isOperandEmpty(this.rightOperandIndex);
    }

    private getIndexOfOtherOperand(index: number): number {
        if (this.leftOperandIndex === index) {
            return this.rightOperandIndex;
        } else if (this.rightOperandIndex === index) {
            return this.leftOperandIndex;
        }

        return -1;
    }

    private getFilledHoleType(): DataType {
        if (this.areOperandsEmpty() || this.areBothOperandsFilled()) return null;
        let existingLiteralType = null;
        if (this.tokens[this.leftOperandIndex] instanceof Expression) {
            existingLiteralType = (this.tokens[this.leftOperandIndex] as Expression).returns;
        } else if (this.tokens[this.rightOperandIndex] instanceof Expression) {
            existingLiteralType = (this.tokens[this.rightOperandIndex] as Expression).returns;
        }

        return existingLiteralType;
    }

    private getIndexOfEmptyOperand(): number {
        if (this.areOperandsEmpty() || this.areBothOperandsFilled()) return -1;
        else if (this.getLeftOperand() instanceof TypedEmptyExpr && !(this.getRightOperand() instanceof TypedEmptyExpr))
            return this.leftOperandIndex;
        else if (this.getRightOperand() instanceof TypedEmptyExpr && !(this.getLeftOperand() instanceof TypedEmptyExpr))
            return this.rightOperandIndex;
    }

    private getIndexOfFilledOperand(): number {
        if (this.areOperandsEmpty() || this.areBothOperandsFilled()) return -1;
        else if (this.getLeftOperand() instanceof TypedEmptyExpr && !(this.getRightOperand() instanceof TypedEmptyExpr))
            return this.rightOperandIndex;
        else if (this.getRightOperand() instanceof TypedEmptyExpr && !(this.getLeftOperand() instanceof TypedEmptyExpr))
            return this.leftOperandIndex;
    }
}

/**
 * Expression for operators with only one operand
 */
export class UnaryOperatorExpr extends Expression {
    operator: UnaryOperator;
    private operandIndex: number;

    constructor(
        operator: UnaryOperator,
        returns: DataType,
        operatesOn: DataType = DataType.Any,
        root?: Statement | Expression,
        indexInRoot?: number
    ) {
        super(returns);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.operator = operator;

        if (operator === UnaryOperator.Not) operatesOn = DataType.Boolean;

        this.tokens.push(new NonEditableTkn("(" + operator + " ", this, this.tokens.length));
        this.operandIndex = this.tokens.length;
        this.tokens.push(new TypedEmptyExpr([operatesOn], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [operatesOn];
        this.tokens.push(new NonEditableTkn(")", this, this.tokens.length));

        this.hasEmptyToken = true;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        /**
         * Three cases:
         * * We are at an empty expression hole
         * * We are at the left of an expression and the current expression to the right is a boolean
         * (e.g. True when you want to insert "and")
         * * We are at the left of an expression and the current expression to the right is any
         */
        return validator.atEmptyExpressionHole(providedContext) || validator.atLeftOfExpression(providedContext)
            ? // &&
              //     providedContext?.expressionToRight?.returns == DataType.Boolean) ||
              // providedContext?.expressionToRight?.returns == DataType.Any
              InsertionType.Valid
            : InsertionType.Invalid;
    }

    setOperand(code: CodeConstruct) {
        this.tokens[this.operandIndex] = code;
        code.indexInRoot = this.operandIndex;
        code.rootNode = this;
    }

    getKeyword(): string {
        return this.operator;
    }
}

/**
 * Text token that can be edited by the user
 * In other words, the token does not form one static keyword but can be changed by the user
 */
export class EditableTextTkn extends Token implements TextEditable {
    isTextEditable = true;
    validatorRegex: RegExp;

    constructor(text: string, regex: RegExp, root?: CodeConstruct, indexInRoot?: number) {
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
        this.left = pos.column;

        if (this.text.length == 0) {
            console.warn("Do not use any Tokens with 0 textual length.");
            this.right = pos.column;
        } else this.right = pos.column + this.text.length;

        this.notify(CallbackType.change);

        return new Position(pos.lineNumber, this.right);
    }
}

/**
 * Token used on the spot where there should be an operator token, but there is none
 * This is for example the case the operator in a binary operator expression is deleted
 */
export class EmptyOperatorTkn extends Token {
    isEmpty = true;

    constructor(text: string, root?: CodeConstruct, indexInRoot?: number) {
        super(text);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    canReplaceWithConstruct(replaceWith: CodeConstruct): InsertionResult {
        if (replaceWith instanceof OperatorTkn) {
            return new InsertionResult(InsertionType.Valid, "", []);
        } else return new InsertionResult(InsertionType.Invalid, "", []);
    }
}

/**
 * Token for the unary or binary operator itself. Think "+", "-", "and", "or" etc.
 * ==> Why is this an expression? (subclass of modifier, which is a subclass of expression)
 */
export class OperatorTkn extends Modifier {
    operator: UnaryOperator | BinaryOperator;
    operatorCategory: OperatorCategory;

    constructor(operator: UnaryOperator | BinaryOperator, root?: Statement | Expression, indexInRoot?: number) {
        super();

        this.tokens.push(new NonEditableTkn(operator, this, this.tokens.length));

        this.operator = operator;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.atEmptyOperatorTkn(providedContext) && validator.canInsertOp(this.operator, providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }
}

/**
 * Express values: string, number and boolean
 * E.g. 5, "Hello", True
 */
export class LiteralValExpr extends Expression {
    valueTokenIndex: number = 0;

    constructor(returns: DataType, value?: string, root?: Statement | Expression, indexInRoot?: number) {
        super(returns);

        switch (returns) {
            case DataType.String: {
                this.tokens.push(new NonEditableTkn('"', this, this.tokens.length));
                this.tokens.push(
                    new EditableTextTkn(value == undefined ? "" : value, StringRegex, this, this.tokens.length)
                );
                this.tokens.push(new NonEditableTkn('"', this, this.tokens.length));

                this.valueTokenIndex = 1;

                break;
            }

            case DataType.Number: {
                this.tokens.push(
                    new EditableTextTkn(value == undefined ? "" : value, NumberRegex, this, this.tokens.length)
                );
                this.valueTokenIndex = 0;

                break;
            }

            case DataType.Boolean: {
                this.tokens.push(new NonEditableTkn(value, this, this.tokens.length));
                this.valueTokenIndex = 0;

                break;
            }
        }

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    getValue(): string {
        return (this.tokens[this.valueTokenIndex] as Token).text;
    }

    getKeyword(): string {
        return this.returns == DataType.String ? '"' + this.getValue() + '"' : this.getValue();
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.atEmptyExpressionHole(providedContext) ||
            (this.returns == DataType.String && validator.canConvertAutocompleteToString(providedContext))
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    getInitialFocus(): UpdatableContext {
        let newContext = new Context();

        switch (this.returns) {
            case DataType.String:
            case DataType.Number:
                return { positionToMove: new Position(this.lineNumber, this.left + 1) };

            case DataType.Boolean:
                return { positionToMove: new Position(this.lineNumber, this.right) };
        }
    }
}

/**
 * Expression for f-string: f'...'
 */
export class FormattedStringExpr extends Expression {
    valueTokenIndex: number = 0;

    constructor(value?: string, root?: Statement | Expression, indexInRoot?: number) {
        super(DataType.String);

        this.tokens.push(new NonEditableTkn("f", this, this.tokens.length));
        this.tokens.push(new NonEditableTkn("'", this, this.tokens.length));
        this.tokens.push(new EditableTextTkn(value == undefined ? "" : value, StringRegex, this, this.tokens.length));
        this.tokens.push(new NonEditableTkn("'", this, this.tokens.length));

        this.valueTokenIndex = 1;
        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    getValue(): string {
        return (this.tokens[this.valueTokenIndex] as Token).text;
    }

    getKeyword(): string {
        return this.returns == DataType.String ? '"' + this.getValue() + '"' : this.getValue();
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.canInsertFormattedString(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    getInitialFocus(): UpdatableContext {
        return { positionToMove: new Position(this.lineNumber, this.left + 2) };
    }
}

/**
 * Currly brackets inside an f-string expression in which an expression can be placed
 * E.g. f'...{...}...'
 *
 * Requirements:
 * * Should be contained in an {@link FormattedStringExpr}
 */
export class FormattedStringCurlyBracketsExpr extends Expression {
    valueTokenIndex: number = 0;

    constructor(root?: Statement | Expression, indexInRoot?: number) {
        super(DataType.String);

        this.tokens.push(new NonEditableTkn("{", this, this.tokens.length));
        this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
        this.tokens.push(new NonEditableTkn("}", this, this.tokens.length));

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.simpleInvalidTooltip = Tooltip.InvalidInsertCurlyBraceWithinFString;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.insideFormattedString(providedContext) ? InsertionType.Valid : InsertionType.Invalid;
    }

    getInitialFocus(): UpdatableContext {
        return { positionToMove: new Position(this.lineNumber, this.left + 1) };
    }
}

/**
 * Expression to construct an empty list, or if to the left of an expression, to insert an element into a list
 */
export class ListLiteralExpression extends Expression {
    constructor(root?: Statement | Expression, indexInRoot?: number) {
        super(DataType.AnyList);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;

        this.tokens.push(new NonEditableTkn("[", this, this.tokens.length));
        this.tokens.push(new TypedEmptyExpr([DataType.Any], this, this.tokens.length));
        this.typeOfHoles[this.tokens.length - 1] = [DataType.Any];
        this.tokens.push(new NonEditableTkn("]", this, this.tokens.length));

        this.hasEmptyToken = true;
    }

    validateContext(validator: Validator, providedContext: Context): InsertionType {
        /**
         * Two cases:
         * * We are at an empty expression hole
         * * We are at the left of an expression and we will place the element inside the list on insertion
         */
        return validator.atEmptyExpressionHole(providedContext) || validator.atLeftOfExpression(providedContext)
            ? InsertionType.Valid
            : InsertionType.Invalid;
    }

    performTypeUpdatesOnInsertInto(insertCode: Expression) {
        let dataType = this.returns;

        if (this.areAllHolesEmpty()) {
            dataType = TypeChecker.getListTypeFromElementType(insertCode.returns);
        } else if (this.getFilledHolesType() !== insertCode.returns) {
            dataType = DataType.AnyList;
        }

        this.returns = dataType;
        // this.updateVariableType(dataType);

        if (this.rootNode instanceof Expression) this.rootNode.validateTypes(this.getModule());
    }

    //return whether all elements of this list are of type TypedEmptyExpr
    areAllHolesEmpty() {
        const elements = this.tokens.filter((tkn) => !(tkn instanceof NonEditableTkn));
        const numberOfElements = elements.length;
        const numberOfEmptyHoles = elements.filter((element) => element instanceof TypedEmptyExpr).length;

        return numberOfEmptyHoles === numberOfElements;
    }

    onInsertInto(insertCode: Expression) {
        this.performTypeUpdatesOnInsertInto(insertCode);
    }

    isHolePlacementValid(): boolean {
        const emptyHolePlacements = this.getEmptyHolesWIndex();
        return emptyHolePlacements.length === 0
            ? true
            : emptyHolePlacements.length === 1 && emptyHolePlacements[0][1] === this.tokens.length - 2;
    }

    onDeleteFrom(args: Object): void {
        const holes = this.tokens.filter((tkn) => !(tkn instanceof NonEditableTkn));
        if (
            (holes.length === 1 && holes[0] instanceof TypedEmptyExpr) ||
            holes.every((hole) => hole instanceof TypedEmptyExpr)
        ) {
            this.returns = DataType.AnyList;
            // this.updateVariableType(this.returns);
        }

        if (this.rootNode instanceof Expression) this.rootNode.validateTypes(this.getModule());
    }

    onReplaceToken(args: { indexInRoot: number; replaceWithEmptyExpr: boolean }): void {
        const elements = this.tokens.filter(
            (tkn) => tkn instanceof Expression && this.tokens.indexOf(tkn) !== args.indexInRoot
        );

        if (elements.length > 0 && elements.every((tkn) => (tkn as Expression).returns)) {
            this.returns = TypeChecker.getListTypeFromElementType((elements[0] as Expression).returns);
            // this.updateVariableType(this.returns);
        } else {
            this.returns = DataType.AnyList;
            // this.updateVariableType(this.returns);
        }

        if (this.rootNode instanceof Expression) this.rootNode.validateTypes(this.getModule());
    }

    private getEmptyHolesWIndex(): [TypedEmptyExpr, number][] {
        const holes = [];

        for (let i = 0; i < this.tokens.length; i++) {
            if (this.tokens[i] instanceof TypedEmptyExpr) {
                holes.push([this.tokens[i], this.tokens[i].indexInRoot]);
            }
        }

        return holes;
    }

    private getFilledHolesType(): DataType {
        const elements = this.tokens.filter(
            (tkn) => !(tkn instanceof TypedEmptyExpr) && !(tkn instanceof NonEditableTkn)
        );
        const types: DataType[] = [];

        for (const expr of elements) if (expr instanceof Expression) types.push(expr.returns);

        if (types.length > 0) {
            const initialType = types[0];

            if (types.every((type) => type === initialType)) return initialType;
        }

        return DataType.Any;
    }
}

/**
 * Represents an item in the list: , ---
 * ==> Why does this not consist of any tokens?
 */
export class ListComma extends Expression {
    constructor() {
        super(DataType.Void);

        this.simpleInvalidTooltip = Tooltip.InvalidInsertListComma;
    }

    // this is the only reason why we have this ListCommaDummy expression :)
    validateContext(validator: Validator, providedContext: Context): InsertionType {
        return validator.canAddListItemToLeft() || validator.canAddListItemToRight()
            ? InsertionType.Valid
            : InsertionType.Invalid;
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
        root?: CodeConstruct,
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

        if (this.text != "  ") this.isEmpty = false;
    }

    isEmptyIdentifier(): boolean {
        return this.text == "  ";
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
    }

    onFocusOff(): void {
        // Get the current identifier
        const currentIdentifier = this.getRenderText();
        // Get the parent statement
        const parentStmt = this.getParentStatement();
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
        const varRefs: VariableReferenceExpr[] = [];
        // Get the statement containing the token
        const parentStmt = this.getParentStatement();
        // Current identifier
        const currentIdentifier = identifierName ?? this.getRenderText();

        // Go through all constructs and add the construct if it is a variable reference to the given assignment token
        // and is in draft mode
        parentStmt.getModule().performActionOnBFS((code) => {
            if (
                code instanceof VariableReferenceExpr &&
                code.identifier === currentIdentifier &&
                code.draftModeEnabled
            ) {
                varRefs.push(code);
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
        const parentStmt = this.getParentStatement();
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
 * Seems to be created when at the start of an empty line so that it can be replaced with a(n other)
 * statement
 */
export class TemporaryStmt extends Statement {
    constructor(token: CodeConstruct) {
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
        root?: CodeConstruct,
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

    constructor(type: DataType[], root?: CodeConstruct, indexInRoot?: number) {
        super("    ");

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
        this.type = type;
    }

    canReplaceWithConstruct(replaceWith: Expression): InsertionResult {
        //check if the type of replaceWith can be converted into any of the hole's types
        if (hasMatch(Util.getInstance().typeConversionMap.get(replaceWith.returns), this.type)) {
            const conversionRecords = typeToConversionRecord.has(replaceWith.returns)
                ? typeToConversionRecord
                      .get(replaceWith.returns)
                      .filter((record) => this.type.indexOf(record.convertTo) > -1)
                : [];

            return new InsertionResult(
                InsertionType.DraftMode,
                TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR(this.type, replaceWith.returns),
                conversionRecords
            );
        } else if (replaceWith.returns === DataType.Any) {
            return new InsertionResult(InsertionType.DraftMode, TYPE_MISMATCH_ANY(this.type, replaceWith.returns), [
                new IgnoreConversionRecord("", null, null, "", null, Tooltip.IgnoreWarning),
            ]);
        }

        return new InsertionResult(InsertionType.Invalid, "", []);
    }

    isListElement(): boolean {
        return this.rootNode && this.rootNode instanceof ListLiteralExpression;
    }

    getTypes(): DataType[] {
        return this.type;
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
    constructor(text: string, root?: CodeConstruct, indexInRoot?: number) {
        super(text);

        this.rootNode = root;
        this.indexInRoot = indexInRoot;
    }

    getSelection(): Selection {
        return this.rootNode.getSelection();
    }
}
