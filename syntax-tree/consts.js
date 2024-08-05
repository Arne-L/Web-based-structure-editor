import { CSSClasses, getStyledSpan } from "../utilities/text-enhance";
import { Expression, /*FunctionCallExpr,*/ Modifier } from "./ast";
/**
 *
 */
export var ScopeType;
(function (ScopeType) {
    ScopeType["Global"] = "global";
    ScopeType["LocalParent"] = "localParent";
    ScopeType["LocalChild"] = "localChild";
})(ScopeType || (ScopeType = {}));
export var CodeConstructType;
(function (CodeConstructType) {
    CodeConstructType["UniConstruct"] = "UniConstruct";
    CodeConstructType["CompoundConstruct"] = "CompoundConstruct";
})(CodeConstructType || (CodeConstructType = {}));
/**
 * The type of insertion that is possible:
 * * Valid: insertion can be made
 * * Invalid: insertion cannot be made
 * * DraftMode: insertion will trigger draft mode
 */
export var InsertionType;
(function (InsertionType) {
    InsertionType[InsertionType["Valid"] = 0] = "Valid";
    InsertionType[InsertionType["Invalid"] = 1] = "Invalid";
    InsertionType[InsertionType["DraftMode"] = 2] = "DraftMode";
})(InsertionType || (InsertionType = {}));
/**
 * All datatypes that are supported by the editor.
 * Contains both primitive types and composite datatypes (primarily lists)
 *
 * This enum also includes types that are not (yet) supported by the editor.
 */
export var DataType;
(function (DataType) {
    DataType["Number"] = "Number";
    DataType["Boolean"] = "Boolean";
    DataType["String"] = "String";
    DataType["FormattedString"] = "FormattedString";
    DataType["Fractional"] = "Float";
    DataType["Iterator"] = "Iterator";
    DataType["AnyList"] = "ListAny";
    DataType["Set"] = "Set";
    DataType["Dict"] = "Dict";
    DataType["Class"] = "Class";
    DataType["Void"] = "Void";
    DataType["Any"] = "Any";
    //TODO: If there is ever time then DataType needs to be changed to a class to support nested types like these.
    //There are cases where we want to know what is inside the list such as for for-loop counter vars. They need to know
    //what they are iterating over otherwise no type can be assigned to them
    DataType["NumberList"] = "ListInt";
    DataType["BooleanList"] = "ListBool";
    DataType["StringList"] = "ListStr";
})(DataType || (DataType = {}));
export const ListTypes = [DataType.AnyList, DataType.NumberList, DataType.BooleanList, DataType.StringList];
export const IndexableTypes = [...ListTypes, DataType.String];
/**
 * All binary operators in the Python language, not all are supported by the editor.
 */
export var BinaryOperator;
(function (BinaryOperator) {
    BinaryOperator["Add"] = "+";
    BinaryOperator["Subtract"] = "-";
    BinaryOperator["Multiply"] = "*";
    BinaryOperator["Divide"] = "/";
    BinaryOperator["Mod"] = "%";
    BinaryOperator["Pow"] = "**";
    BinaryOperator["LeftShift"] = "<<";
    BinaryOperator["RightShift"] = ">>";
    BinaryOperator["BitOr"] = "|";
    BinaryOperator["BitXor"] = "^";
    BinaryOperator["BitAnd"] = "&";
    BinaryOperator["FloorDiv"] = "//";
    BinaryOperator["And"] = "and";
    BinaryOperator["Or"] = "or";
    BinaryOperator["Equal"] = "==";
    BinaryOperator["NotEqual"] = "!=";
    BinaryOperator["LessThan"] = "<";
    BinaryOperator["LessThanEqual"] = "<=";
    BinaryOperator["GreaterThan"] = ">";
    BinaryOperator["GreaterThanEqual"] = ">=";
    BinaryOperator["Is"] = "is";
    BinaryOperator["IsNot"] = "is not";
    BinaryOperator["In"] = "in";
    BinaryOperator["NotIn"] = "not in";
})(BinaryOperator || (BinaryOperator = {}));
/**
 * All unary operators in the Python language, not all are supported by the editor.
 */
export var UnaryOperator;
(function (UnaryOperator) {
    UnaryOperator["Invert"] = "~";
    UnaryOperator["Not"] = "not";
    UnaryOperator["UAdd"] = "+";
    UnaryOperator["USub"] = "-";
})(UnaryOperator || (UnaryOperator = {}));
/**
 * All keywords in the Python language, not all are supported by the editor.
 */
export var PythonKeywords;
(function (PythonKeywords) {
    PythonKeywords["and"] = "and";
    PythonKeywords["as"] = "as";
    PythonKeywords["assert"] = "assert";
    PythonKeywords["break"] = "break";
    PythonKeywords["class"] = "class";
    PythonKeywords["continue"] = "continue";
    PythonKeywords["def"] = "def";
    PythonKeywords["del"] = "del";
    PythonKeywords["elif"] = "elif";
    PythonKeywords["else"] = "else";
    PythonKeywords["except"] = "except";
    PythonKeywords["False"] = "False";
    PythonKeywords["finally"] = "finally";
    PythonKeywords["for"] = "for";
    PythonKeywords["from"] = "from";
    PythonKeywords["global"] = "global";
    PythonKeywords["if"] = "if";
    PythonKeywords["import"] = "import";
    PythonKeywords["in"] = "in";
    PythonKeywords["is"] = "is";
    PythonKeywords["lambda"] = "lambda";
    PythonKeywords["None"] = "none";
    PythonKeywords["nonlocal"] = "nonlocal";
    PythonKeywords["not"] = "not";
    PythonKeywords["or"] = "or";
    PythonKeywords["pass"] = "pass";
    PythonKeywords["raise"] = "raise";
    PythonKeywords["return"] = "return";
    PythonKeywords["True"] = "True";
    PythonKeywords["try"] = "try";
    PythonKeywords["while"] = "while";
    PythonKeywords["with"] = "with";
    PythonKeywords["yield"] = "yield";
})(PythonKeywords || (PythonKeywords = {}));
/**
 * Built-in functions in the Python language, not all are supported by the editor.
 */
export var BuiltInFunctions;
(function (BuiltInFunctions) {
    BuiltInFunctions["abs"] = "abs";
    BuiltInFunctions["delattr"] = "delattr";
    BuiltInFunctions["hash"] = "hash";
    BuiltInFunctions["memoryview"] = "memoryview";
    BuiltInFunctions["set"] = "set";
    BuiltInFunctions["all"] = "all";
    BuiltInFunctions["dict"] = "dict";
    BuiltInFunctions["help"] = "help";
    BuiltInFunctions["min"] = "min";
    BuiltInFunctions["setattr"] = "setattr";
    BuiltInFunctions["any"] = "any";
    BuiltInFunctions["dir"] = "dir";
    BuiltInFunctions["hex"] = "hex";
    BuiltInFunctions["next"] = "next";
    BuiltInFunctions["slice"] = "slice";
    BuiltInFunctions["ascii"] = "ascii";
    BuiltInFunctions["divmod"] = "divmod";
    BuiltInFunctions["id"] = "id";
    BuiltInFunctions["object"] = "object";
    BuiltInFunctions["sorted"] = "sorted";
    BuiltInFunctions["bin"] = "bin";
    BuiltInFunctions["enumerate"] = "enumerate";
    BuiltInFunctions["input"] = "input";
    BuiltInFunctions["oct"] = "oct";
    BuiltInFunctions["staticmethod"] = "staticmethod";
    BuiltInFunctions["bool"] = "bool";
    BuiltInFunctions["eval"] = "eval";
    BuiltInFunctions["int"] = "int";
    BuiltInFunctions["open"] = "open";
    BuiltInFunctions["str"] = "str";
    BuiltInFunctions["breakpoint"] = "breakpoint";
    BuiltInFunctions["exec"] = "exec";
    BuiltInFunctions["isinstance"] = "isinstance";
    BuiltInFunctions["ord"] = "ord";
    BuiltInFunctions["sum"] = "sum";
    BuiltInFunctions["bytearray"] = "bytearray";
    BuiltInFunctions["filter"] = "filter";
    BuiltInFunctions["issubclass"] = "issubclass";
    BuiltInFunctions["pow"] = "pow";
    BuiltInFunctions["super"] = "super";
    BuiltInFunctions["bytes"] = "bytes";
    BuiltInFunctions["float"] = "float";
    BuiltInFunctions["iter"] = "iter";
    BuiltInFunctions["print"] = "print";
    BuiltInFunctions["tuple"] = "tuple";
    BuiltInFunctions["callable"] = "callable";
    BuiltInFunctions["format"] = "format";
    BuiltInFunctions["len"] = "len";
    BuiltInFunctions["property"] = "property";
    BuiltInFunctions["type"] = "type";
    BuiltInFunctions["chr"] = "chr";
    BuiltInFunctions["frozenset"] = "frozenset";
    BuiltInFunctions["list"] = "list";
    BuiltInFunctions["range"] = "range";
    BuiltInFunctions["vars"] = "vars";
    BuiltInFunctions["classmethod"] = "classmethod";
    BuiltInFunctions["getattr"] = "getattr";
    BuiltInFunctions["locals"] = "locals";
    BuiltInFunctions["repr"] = "repr";
    BuiltInFunctions["zip"] = "zip";
    BuiltInFunctions["compile"] = "compile";
    BuiltInFunctions["globals"] = "globals";
    BuiltInFunctions["map"] = "map";
    BuiltInFunctions["reversed"] = "reversed";
    BuiltInFunctions["__import__"] = "__import__";
    BuiltInFunctions["complex"] = "complex";
    BuiltInFunctions["hasattr"] = "hasattr";
    BuiltInFunctions["max"] = "max";
    BuiltInFunctions["round"] = "round";
})(BuiltInFunctions || (BuiltInFunctions = {}));
/**
 * Enumerations over the possible positions the autocomplete menu can be shown in.
 */
export var AutoCompleteType;
(function (AutoCompleteType) {
    AutoCompleteType[AutoCompleteType["StartOfLine"] = 0] = "StartOfLine";
    AutoCompleteType[AutoCompleteType["LeftOfExpression"] = 1] = "LeftOfExpression";
    AutoCompleteType[AutoCompleteType["RightOfExpression"] = 2] = "RightOfExpression";
    AutoCompleteType[AutoCompleteType["AtExpressionHole"] = 3] = "AtExpressionHole";
    AutoCompleteType[AutoCompleteType["AtEmptyOperatorHole"] = 4] = "AtEmptyOperatorHole";
})(AutoCompleteType || (AutoCompleteType = {}));
export const IdentifierRegex = RegExp("^[^\\d\\W]\\w*$");
export const NumberRegex = RegExp("^(([+-][0-9]+)|(([+-][0-9]*)\\.([0-9]+))|([0-9]*)|(([0-9]*)\\.([0-9]*)))$");
export const StringRegex = RegExp('^([^\\r\\n\\"]*)$');
/**
 * Reason for why a certain insertion is invalid. The text will show up in the toolbox tooltip
 * with a red background on the disabled elements.
 */
export var Tooltip;
(function (Tooltip) {
    Tooltip["None"] = "";
    Tooltip["InvalidInsertElse"] = "Can only be inserted directly below an if or elif statement.";
    Tooltip["InvalidInsertElif"] = "Can only be inserted directly below an if statement.";
    Tooltip["InvalidInsertListElementAccess"] = "Can only be inserted after a variable that is a list.";
    Tooltip["InvalidInsertListComma"] = "Can only be inserted after or before the elements inside a list";
    Tooltip["InvalidInsertBreak"] = "Can only be inserted on an empty line within a loop.";
    Tooltip["InvalidInsertCurlyBraceWithinFString"] = "Can only be inserted within an f'' string expression.";
    Tooltip["InvalidInsertStatement"] = "Can only be inserted on an empty line.";
    Tooltip["InvalidInsertModifier"] = "Can only be inserted after a variable reference or a literal value of the appropriate type.";
    Tooltip["InvalidInsertExpression"] = "Can only be inserted inside a hole (<hole1 class='errorTooltipHole'></hole1>) of matching type.";
    Tooltip["InvalidAugmentedAssignment"] = "Can only be inserted after a variable reference on an empty line.";
    Tooltip["TypeMismatch"] = "Inserting this will cause a type mismatch and will require you to convert the inserted expression to the correct type";
    Tooltip["IgnoreWarning"] = "Ignore this warning";
    Tooltip["Delete"] = "Delete";
})(Tooltip || (Tooltip = {}));
//-------------------
export function MISSING_IMPORT_DRAFT_MODE_STR(requiredItem, requiredModule) {
    return (getStyledSpan(requiredItem, CSSClasses.identifier) +
        " does not exist in this program. It is part of the " +
        getStyledSpan(requiredModule, CSSClasses.emphasize) +
        " module. " +
        getStyledSpan(requiredModule, CSSClasses.emphasize) +
        " has to be imported before " +
        getStyledSpan(requiredItem, CSSClasses.identifier) +
        " can be used.");
}
export function addClassToDraftModeResolutionButton(button, codeToReplace) {
    if (!(codeToReplace instanceof Expression) && !(codeToReplace instanceof Modifier)) {
        button.classList.add("statement-button");
    }
    else if (codeToReplace instanceof Modifier) {
        button.classList.add("modifier-button");
    }
    else if (codeToReplace instanceof Expression) {
        button.classList.add("expression-button");
    }
}
//# sourceMappingURL=consts.js.map