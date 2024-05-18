import { CSSClasses, getStyledSpan } from "../utilities/text-enhance";
import { getUserFriendlyType } from "../utilities/util";
import { Construct, Expression, /*FunctionCallExpr,*/ Modifier } from "./ast";

/**
 *
 */
export enum ScopeType {
    Global = "global",
    LocalParent = "localParent",
    LocalChild = "localChild",
}

export enum CodeConstructType { 
    UniConstruct = "UniConstruct",
    CompoundConstruct = "CompoundConstruct" 
}


/**
 * The type of insertion that is possible:
 * * Valid: insertion can be made
 * * Invalid: insertion cannot be made
 * * DraftMode: insertion will trigger draft mode
 */
export enum InsertionType {
    Valid, //insertion can be made
    Invalid, //insertion cannot be made
    DraftMode, //insertion will trigger draft mode
}

/**
 * All datatypes that are supported by the editor.
 * Contains both primitive types and composite datatypes (primarily lists)
 *
 * This enum also includes types that are not (yet) supported by the editor.
 */
export enum DataType {
    Number = "Number",
    Boolean = "Boolean",
    String = "String",
    FormattedString = "FormattedString",
    Fractional = "Float",
    Iterator = "Iterator",
    AnyList = "ListAny",
    Set = "Set",
    Dict = "Dict",
    Class = "Class",
    Void = "Void",
    Any = "Any",

    //TODO: If there is ever time then DataType needs to be changed to a class to support nested types like these.
    //There are cases where we want to know what is inside the list such as for for-loop counter vars. They need to know
    //what they are iterating over otherwise no type can be assigned to them
    NumberList = "ListInt",
    BooleanList = "ListBool",
    StringList = "ListStr",
}

export const ListTypes = [DataType.AnyList, DataType.NumberList, DataType.BooleanList, DataType.StringList];
export const IndexableTypes = [...ListTypes, DataType.String];

/**
 * All binary operators in the Python language, not all are supported by the editor.
 */
export enum BinaryOperator {
    Add = "+",
    Subtract = "-",
    Multiply = "*",
    Divide = "/",
    Mod = "%",
    Pow = "**",
    LeftShift = "<<",
    RightShift = ">>",
    BitOr = "|",
    BitXor = "^",
    BitAnd = "&",
    FloorDiv = "//",

    And = "and",
    Or = "or",

    Equal = "==",
    NotEqual = "!=",
    LessThan = "<",
    LessThanEqual = "<=",
    GreaterThan = ">",
    GreaterThanEqual = ">=",
    Is = "is",
    IsNot = "is not",
    In = "in",
    NotIn = "not in",
}

/**
 * All unary operators in the Python language, not all are supported by the editor.
 */
export enum UnaryOperator {
    Invert = "~",
    Not = "not",
    UAdd = "+",
    USub = "-",
}

/**
 * All keywords in the Python language, not all are supported by the editor.
 */
export enum PythonKeywords {
    and = "and",
    as = "as",
    assert = "assert",
    break = "break",
    class = "class",
    continue = "continue",
    def = "def",
    del = "del",
    elif = "elif",
    else = "else",
    except = "except",
    False = "False",
    finally = "finally",
    for = "for",
    from = "from",
    global = "global",
    if = "if",
    import = "import",
    in = "in",
    is = "is",
    lambda = "lambda",
    None = "none",
    nonlocal = "nonlocal",
    not = "not",
    or = "or",
    pass = "pass",
    raise = "raise",
    return = "return",
    True = "True",
    try = "try",
    while = "while",
    with = "with",
    yield = "yield",
}

/**
 * Built-in functions in the Python language, not all are supported by the editor.
 */
export enum BuiltInFunctions {
    abs = "abs",
    delattr = "delattr",
    hash = "hash",
    memoryview = "memoryview",
    set = "set",
    all = "all",
    dict = "dict",
    help = "help",
    min = "min",
    setattr = "setattr",
    any = "any",
    dir = "dir",
    hex = "hex",
    next = "next",
    slice = "slice",
    ascii = "ascii",
    divmod = "divmod",
    id = "id",
    object = "object",
    sorted = "sorted",
    bin = "bin",
    enumerate = "enumerate",
    input = "input",
    oct = "oct",
    staticmethod = "staticmethod",
    bool = "bool",
    eval = "eval",
    int = "int",
    open = "open",
    str = "str",
    breakpoint = "breakpoint",
    exec = "exec",
    isinstance = "isinstance",
    ord = "ord",
    sum = "sum",
    bytearray = "bytearray",
    filter = "filter",
    issubclass = "issubclass",
    pow = "pow",
    super = "super",
    bytes = "bytes",
    float = "float",
    iter = "iter",
    print = "print",
    tuple = "tuple",
    callable = "callable",
    format = "format",
    len = "len",
    property = "property",
    type = "type",
    chr = "chr",
    frozenset = "frozenset",
    list = "list",
    range = "range",
    vars = "vars",
    classmethod = "classmethod",
    getattr = "getattr",
    locals = "locals",
    repr = "repr",
    zip = "zip",
    compile = "compile",
    globals = "globals",
    map = "map",
    reversed = "reversed",
    __import__ = "__import__",
    complex = "complex",
    hasattr = "hasattr",
    max = "max",
    round = "round",
}

/**
 * Enumerations over the possible positions the autocomplete menu can be shown in.
 */
export enum AutoCompleteType {
    StartOfLine,
    LeftOfExpression,
    RightOfExpression,
    AtExpressionHole,
    AtEmptyOperatorHole,
}

export const IdentifierRegex = RegExp("^[^\\d\\W]\\w*$");
export const NumberRegex = RegExp("^(([+-][0-9]+)|(([+-][0-9]*)\\.([0-9]+))|([0-9]*)|(([0-9]*)\\.([0-9]*)))$");
export const StringRegex = RegExp('^([^\\r\\n\\"]*)$');

/**
 * Reason for why a certain insertion is invalid. The text will show up in the toolbox tooltip
 * with a red background on the disabled elements.
 */
export enum Tooltip {
    None = "",
    InvalidInsertElse = "Can only be inserted directly below an if or elif statement.",
    InvalidInsertElif = "Can only be inserted directly below an if statement.",
    InvalidInsertListElementAccess = "Can only be inserted after a variable that is a list.",
    InvalidInsertListComma = "Can only be inserted after or before the elements inside a list",
    InvalidInsertBreak = "Can only be inserted on an empty line within a loop.",
    InvalidInsertCurlyBraceWithinFString = "Can only be inserted within an f'' string expression.",
    InvalidInsertStatement = "Can only be inserted on an empty line.",
    InvalidInsertModifier = "Can only be inserted after a variable reference or a literal value of the appropriate type.",
    InvalidInsertExpression = "Can only be inserted inside a hole (<hole1 class='errorTooltipHole'></hole1>) of matching type.",
    InvalidAugmentedAssignment = "Can only be inserted after a variable reference on an empty line.",
    TypeMismatch = "Inserting this will cause a type mismatch and will require you to convert the inserted expression to the correct type",
    IgnoreWarning = "Ignore this warning",
    Delete = "Delete",
}

//-------------------
export function MISSING_IMPORT_DRAFT_MODE_STR(requiredItem, requiredModule) {
    return (
        getStyledSpan(requiredItem, CSSClasses.identifier) +
        " does not exist in this program. It is part of the " +
        getStyledSpan(requiredModule, CSSClasses.emphasize) +
        " module. " +
        getStyledSpan(requiredModule, CSSClasses.emphasize) +
        " has to be imported before " +
        getStyledSpan(requiredItem, CSSClasses.identifier) +
        " can be used."
    );
}

export function addClassToDraftModeResolutionButton(button: HTMLDivElement, codeToReplace: Construct) {
    if (!(codeToReplace instanceof Expression) && !(codeToReplace instanceof Modifier)) {
        button.classList.add("statement-button");
    } else if (codeToReplace instanceof Modifier) {
        button.classList.add("modifier-button");
    } else if (codeToReplace instanceof Expression) {
        button.classList.add("expression-button");
    }
}
