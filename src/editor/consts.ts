// import * as AddDocs from "../docs/add.json";
// import * as AndDocs from "../docs/and.json";
// import * as AssignAddDocs from "../docs/assign-add.json";
// import * as AssignDivDocs from "../docs/assign-div.json";
// import * as AssignMultDocs from "../docs/assign-mult.json";
// import * as AssignSubDocs from "../docs/assign-sub.json";
// import * as AssignDocs from "../docs/assign.json";
// import * as RandChoiceDocs from "../docs/choice.json";
// import * as CompEqDocs from "../docs/comp-eq.json";
// import * as CompGtDocs from "../docs/comp-gt.json";
// import * as CompGteDocs from "../docs/comp-gte.json";
// import * as CompLtDocs from "../docs/comp-lt.json";
// import * as CompLteDocs from "../docs/comp-lte.json";
// import * as CompNeDocs from "../docs/comp-ne.json";
// import * as DivDocs from "../docs/div.json";
// import * as ElifDocs from "../docs/elif.json";
// import * as ElseDocs from "../docs/else.json";
// import * as FStringItemDocs from "../docs/f-str-item.json";
// import * as FStringDocs from "../docs/f-str.json";
// import * as FalseDocs from "../docs/false.json";
// import * as FindDocs from "../docs/find.json";
// import * as FloorDivDocs from "../docs/floor-div.json";
// import * as IfDocs from "../docs/if.json";
// import * as ImportDocs from "../docs/import.json";
// import * as InDocs from "../docs/in.json";
// import * as InputDocs from "../docs/input.json";
// import * as JoinDocs from "../docs/join.json";
// import * as LenDocs from "../docs/len.json";
// import * as ListAppendDocs from "../docs/list-append.json";
// import * as ListIndexDocs from "../docs/list-index.json";
// import * as ListItemDocs from "../docs/list-item.json";
// import * as ListLiteralDocs from "../docs/list-literal.json";
// import * as ModDocs from "../docs/mod.json";
// import * as MultDocs from "../docs/mult.json";
// import * as NotInDocs from "../docs/not-in.json";
// import * as NotDocs from "../docs/not.json";
// import * as NumDocs from "../docs/num.json";
// import * as OrDocs from "../docs/or.json";
// import * as PrintDocs from "../docs/print.json";
// import * as RandintDocs from "../docs/randint.json";
// import * as RangeDocs from "../docs/range.json";
// import * as ReplaceDocs from "../docs/replace.json";
// import * as SplitDocs from "../docs/split.json";
// import * as SubDocs from "../docs/sub.json";
// import * as CastToIntDocs from "../docs/to-int.json";
// import * as CastToStrDocs from "../docs/to-str.json";
// import * as TrueDocs from "../docs/true.json";
// import * as WhileDocs from "../docs/while.json";
import { addEditCodeActionsToCategories, Loader } from "../language-definition/parser";
import {
    // Argument,
    // AssignmentModifier,
    // AugmentedAssignmentModifier,
    // BinaryOperatorExpr,
    // ElseStatement,
    // ForStatement,
    // FormattedStringCurlyBracketsExpr,
    // FormattedStringExpr,
    // FunctionCallExpr,
    // FunctionCallStmt,
    // IfStatement,
    // ImportStatement,
    // KeywordStmt,
    // ListAccessModifier,
    // ListComma,
    // ListLiteralExpression,
    // LiteralValExpr,
    // MethodCallModifier,
    // OperatorTkn,
    Statement,
} from "../syntax-tree/ast";
import { DataType } from "../syntax-tree/consts";
import { EditCodeAction } from "./action-filter";

/**
 * Define all special keypresses
 */
export enum KeyPress {
    // navigation:
    ArrowLeft = "ArrowLeft",
    ArrowRight = "ArrowRight",
    ArrowUp = "ArrowUp",
    ArrowDown = "ArrowDown",

    Home = "Home",
    End = "End",

    Tab = "Tab",

    // delete:
    Delete = "Delete",
    Backspace = "Backspace",

    // enter:
    Enter = "Enter",

    // for mods:
    V = "v",
    C = "c",
    Z = "z",
    Y = "y",

    //Typing sys
    OpenBracket = "[",
    OpenCurlyBraces = "{",
    Comma = ",",
    Plus = "+",
    ForwardSlash = "/",
    Star = "*",
    Minus = "-",
    GreaterThan = ">",
    LessThan = "<",
    Equals = "=",

    Escape = "Escape",
    Space = " ",

    //TODO: Remove later
    P = "p",

    DoubleQuote = '"',
}

/**
 * Enumeration of all possible edit actions that can be made (copy, move left,
 * delete to end, delete previous token, indent backwards, open suggestion menu,
 * insert formatted string …)
 */
export enum EditActionType {
    DeleteStmt, // Self added
    DeleteRootOfToken, // Self added

    InsertUniConstruct,
    InsertGeneralExpr,

    Copy, // TODO: NYI: could use default or navigator.clipboard.writeText()
    Paste, // TODO: NYI: check navigator.clipboard.readText()

    Undo,
    Redo,

    MoveCursorLeft,
    MoveCursorRight,
    MoveCursorStart, // TODO: NYI
    MoveCursorEnd, // TODO: NYI

    DeleteNextChar,
    DeletePrevChar,
    DeleteListItem,
    DeleteRootNode,
    ReplaceExpressionWithItem,
    DeleteStringLiteral,

    DeleteToEnd,
    DeleteToStart,

    SelectLeft,
    SelectRight,
    SelectToStart, // TODO: NYI
    SelectToEnd, // TODO: NYI

    SelectNextToken,
    SelectPrevToken,
    SelectClosestTokenAbove,
    SelectClosestTokenBelow,

    InsertEmptyLine,
    InsertEmptyList,
    InsertEmptyListItem,

    DeleteNextToken,
    DeletePrevToken,
    DeletePrevLine,
    DeleteBackMultiLines,
    DeleteEmptyLine,
    DeleteStatement,
    DeleteSelectedModifier,
    DeleteMultiLineStatement, // REPLACED BY DeleteStmt

    IndentBackwards,
    IndentBackwardsIfStmt,
    IndentForwards,
    IndentForwardsIfStmt,

    InsertChar,

    None,

    //typing actions
    InsertBinaryOperator,
    InsertUnaryOperator,
    InsertLiteral,

    //displaying suggestion menu
    DisplayGreaterThanSuggestion,
    DisplayLessThanSuggestion,
    DisplayEqualsSuggestion,

    //suggestion management
    SelectMenuSuggestionBelow,
    SelectMenuSuggestionAbove,
    SelectMenuSuggestion,
    CloseValidInsertMenu,
    OpenValidInsertMenu,
    OpenSubMenu,
    // CloseSubMenu,

    //TODO: Remove later (for the continuous menu with categories)
    // OpenValidInsertMenuSingleLevel,

    CloseDraftMode,

    InsertStatement,
    InsertExpression,
    WrapExpressionWithItem,
    ConvertAutocompleteToString,

    InsertVarAssignStatement,
    InsertVariableRef,
    InsertElseStatement,

    InsertModifier,
    InsertAssignmentModifier,

    OpenAutocomplete,
    InsertImportFromDraftMode,

    InsertTypeCast,
    InsertComparisonConversion,
    InsertFunctionConversion,
    InsertMemberCallConversion,
    InsertMemberAccessConversion,

    InsertFormattedStringItem,
    DeleteFStringCurlyBrackets,

    InsertOperatorTkn,

    DeleteUnconvertibleOperandWarning,
}

export enum ConstructName {
    VarAssignment = "VarAssignmentStmt",
    Default = "Default",
}

/**
 *Type enumeration of (groups of) code structs that can be inserted into the editor.
 * Some code blocks are grouped under one option if they are similar enough e.g.
 * If and While are grouped under “InsertStatement”
 */
export enum InsertActionType {
    InsertGeneralStmt,
    InsertGeneralExpr,

    InsertNewVariableStmt,

    InsertStatement,
    InsertExpression,
    InsertElifStmt,
    InsertElseStmt,

    InsertFormattedStringItem,
    InsertPrintFunctionStmt,
    InsertRangeExpr,
    InsertLenExpr,
    InsertCastStrExpr,
    InsertInputExpr,

    InsertListLiteral,
    InsertListItem,
    InsertLiteral,

    InsertUnaryExpr,
    InsertBinaryExpr,

    InsertListAppendMethod,
    InsertListIndexAccessor,
    InsertListIndexAssignment,

    InsertStringSplitMethod,
    InsertStringJoinMethod,
    InsertStringReplaceMethod,
    InsertStringFindMethod,

    InsertAssignmentModifier,
    InsertAugmentedAssignmentModifier,

    InsertVarOperationStmt,
    InsertValOperationExpr,

    InsertOperatorTkn,
}

export class Actions {
    private static inst: Actions;
    actionsList: Array<EditCodeAction>;
    actionsMap: Map<string, EditCodeAction>;
    /**
     * Map from datatype to a list of actions that can be performed on that datatype.
     * Actions that can be performed on a datatype are things like adding,
     * multiplying, dividing, using a method on it (e.g. .append()), etc.
     */
    varActionsMap: Map<DataType, Array<VarAction>> = new Map();
    toolboxCategories: Array<ToolboxCategory> = [];

    private constructor() {
        const loadedCodeActions = Loader.instance.getAllCodeActions();
        // this.actionsList.push(...loadedCodeActions); // Add loaded actions
        this.actionsList = loadedCodeActions; // Add loaded actions

        this.actionsMap = new Map<string, EditCodeAction>(this.actionsList.map((action) => [action.cssId, action])); // Automatically done

        // Add all EditCodeActions to the categories that are loaded from the configuration file
        addEditCodeActionsToCategories(this.toolboxCategories, loadedCodeActions);
        // In the future when all EditCodeActions are loaded from the configuration file,
        // the loadedCodeActions could be replaced with this.actionsList
        // Best also to make the this.toolboxCategories [] and return toolboxCategories from the function
        // to make it clear what is happening
    }

    static instance(): Actions {
        if (!Actions.inst) Actions.inst = new Actions();

        return Actions.inst;
    }

    /**
     * Replaces the old singleton with a newly created singleton, refreshing all encapsulated data. 
     */
    static reset() {
        Actions.inst = new Actions();
    
    }
}

/**
 * The current status of the code in the editor, options are
 * * ContainsEmptyHoles
 * * ContainsAutocompleteTokens
 * * ContainsDraftMode
 * * Empty
 * * Runnable
 */
export enum CodeStatus {
    ContainsEmptyHoles,
    ContainsAutocompleteTokens,
    ContainsDraftMode,
    Empty,
    Runnable,
}

export class ToolboxCategory {
    displayName: string;
    id: string;
    items: Array<EditCodeAction> = [];

    constructor(displayName: string, id: string, items: Array<EditCodeAction>) {
        this.displayName = displayName;
        this.id = id;
        this.items = items;
    }

    addEditCodeAction(action: EditCodeAction) {
        this.items.push(action);
    }
}

export class VarAction {
    // Can remove export?
    description: string;
    group: string;
    action: () => Statement;

    constructor(action: () => Statement, description: string, group: string) {
        this.action = action;
        this.description = description;
        this.group = group;
    }
}
