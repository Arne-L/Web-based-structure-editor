export interface ConfigDefinition {
    /**
     * The path to the language config file, relative to the language-definition folder
     */
    languageFile: string;
}
export interface LanguageDefinition {
    /**
     * The name of the language.
     */
    name: string;
    /**
     * The path to the language file containing each of the constructs.
     * This should be relative to the language-definition folder
     */
    constructFile: string;
    /**
     * The path to the file containing the recursive format definitions.
     */
    recursiveFile: string;
    /**
     * A list of (key)words that can / should not be used as identifier names,
     * nested within the reason for which they are reserved. This allows for the
     * creation of multiple categories with a different reason. The reason is
     * shown in the editor as an error when one of the accompanying words is detected.
     */
    reservedWords: { reason: string; words: string[] }[];
}
/**
 * Structure of a single construct definition
 */
export interface ConstructDefinition {
    /**
     * Name identifying the construct to the designer. This name is not used in the editor
     * and can thus be changed to anything reconisable.
     *
     * Optional.
     */
    internalName?: string;
    /**
     * Used internally to identify and link the construct. It is not visible to the user.
     *
     * Required.
     */
    keyword: string;
    /**
     * The name used in the toolbox and autocomplete menu to represent the construct.
     *
     * Options:
     * * '--' represents an identifier hole
     * * '---' represents a general hole
     *
     * Required.
     */
    editorName: string;
    /**
     * TEMPORARY
     */
    constructType: "expression" | "statement";
    /**
     * The sequence of substructures and tokens that make up the construct. This field
     * determines the structure of the construct and the editor's behaviour.
     * Each of the elements are concatenated in orde to form the eventual construct.
     *
     * Different types of formattings can be used:
     * * token: Literal string that should be displayed in the editor for the token.
     * * hole: A hole that can be filled with any construct.
     * *
     *
     * See the different formatting descriptions for more information.
     *
     * Required. Empty constructs are not allowed.
     */
    format: FormatDefType[];
    /**
     * A list of lists in which each element represents a hole in the construct. The inner list
     * represents all the holes for one single formatting hole. The outer list maps the holes in
     * the format field in order to the inner lists in this holes field.
     *
     * See the {@link HoleDefinition} for more information.
     *
     * Optional, but has to match the number of holes in the format field. If the holes and nesting
     * does not match, an error will be thrown on startup.
     */
    holes?: HoleDefinition[][];
    /**
     * String against which the user's input is matched when typing. Valid / matching options
     * are shown in the autocompletion menu.
     *
     * Mutually exclusive with matchRegex, but one of the two has to be defined. Defining both
     * will result in the matchRegex being skipped.
     */
    match?: string;
    /**
     * Regex against which the user's input is matched when typing. Valid / matching options
     * are shown in the autocompletion menu.
     *
     * Capturing groups can be used to identify parts of the regex that need to be used to fill
     * different editable / assignment tokens. Most often this will only be one, in which case
     * no capturing group is required. When there is the need to fill multiple tokens, each
     * capturing group will be used in order, e.g.
     * "{capturing group 1 regex} IN {capturing group 2 regex} FOR SOME SYNTAX". If the user thus types
     * until the second capturing group, its input will be used in the final insertion so that no
     * user input is lost.
     *
     * Mutually exclusive with matchRegex, but one of the two has to be defined. Defining both
     * will result in the matchRegex being skipped.
     */
    matchRegex?: string;
    /**
     * List of strings that trigger the insertion of the construct in the editor. When this / one of
     * these character(s) is typed, while the construct is valid according to the match, the construct
     * is inserted in the editor. As these characters are supposed to be the first character after
     * the matchRegex or matchString, there are often also referred to as terminating characters.
     *
     * Optional. When left empty, the construct can only be inserted by selecting it in the toolbox,
     * from the autocomplete menu or by force closing the autocompletion menu.
     */
    triggerInsertion?: string[];
    /**
     * Syntactic sugar to add similar constructs to the editor. Overlapping fields can be added
     * at the top level, such as the formatField, internalName and triggerInsertion. Other fields
     * can then be nested within the implementations field, fields with differening values for
     * each *implementation*.
     *
     * The value of this field needs to be a list of construct definitions, in which the fields already
     * defined at the top level can be skipped. Internally, each implementation will be mapped to
     * a construct definition by merging the top level with each element of the implementations list.
     *
     * Fields defined at the top level have priority over the fields defined in the implementation.
     *
     * Optional. This is only meant as syntactic sugar to make it easier to add constructs with
     * overlapping fields.
     */
    implementations?: ConstructDefinition[];
    /**
     * All hover information that should be displayed when hovering over the construct in the editor's
     * toolbox. This includes a title, description, examples etc.
     *
     * See the {@link ToolboxDefinition} for more information.
     *
     * Required.
     */
    toolbox: ToolboxDefinition;
}
export interface RecursiveDefinition {
    /**
     * The name of the format definition. This name is used call / inject the format definition
     *
     * Required.
     */
    name: string;
    /**
     * Indicates whether the encapsulation represents a scope or not.
     *
     * Optional, defaults to false.
     */
    scope?: boolean;
    /**
     * The token that should be inserted before each iteration of the recursion.
     * This allows for example easy definitions of indented body structures like
     * in Python.
     *
     * Optional, defaults to null.
     *
     * TODO: Maybe add an insertAfter as well?
     * TODO: Maybe a list of tokens?
     */
    insertBefore?: TokenFormatDefinition;
    /**
     * Definition of the format that should be repeated in the recursion.
     *
     * Required.
     */
    format: FormatDefType[];
}
export interface RecursiveRedefinedDefinition {
    /**
     * Indicates whether the encapsulation represents a scope or not.
     *
     * Optional, defaults to false.
     */
    scope?: boolean;
    /**
     * The token that should be inserted before each iteration of the recursion.
     * This allows for example easy definitions of indented body structures like
     * in Python.
     *
     * Optional, defaults to null.
     *
     * TODO: Maybe add an insertAfter as well?
     * TODO: Maybe a list of tokens?
     */
    insertBefore?: TokenFormatDefinition;
    /**
     * Definition of the format that should be repeated in the recursion.
     *
     * Required.
     */
    format: FormatDefType[];
}

/**
 * Abstract interface defining the overlapping fields of all format definitions.
 */
interface FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: string;
}
/**
 * Structure of a token format definition
 */
interface TokenFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "token";
    /**
     * The text that should be displayed in the editor for the token. The string is
     * literally copied, including any spaces or special characters.
     */
    value: string;
}
interface HoleFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "hole";
    /**
     * Seperator between the different holes in the nested list of the "holes" field.
     * When multiple holes are defined in a nested list, this key is obligatory. Otherwise
     * it is optional but highly recommended to avoid confusion and future errors.
     */
    delimiter?: string;
}
interface BodyFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "body";
}
interface ReferenceFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "reference";
    /**
     * The name of the structure to which it refers. WHAT NAME PRECISELY? KEYWORD? EDITNAME? etc
     */
    to: string;
}
interface ImplementationFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "implementation";
    /**
     * Links the implementation to an object / structure in the implementations
     * array with the given "method_name". All fields of the implementation will be added
     * to the construct definition.
     */
    anchor: string;
}
interface IdentifierFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "identifier";
    /**
     * The regex that should be used to validate the input of the user. The regex should be written
     * as a string, so that it can be parsed and used in the editor.
     */
    regex: string;
}
interface EditableFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "editable";
    /**
     * The default value that should be inserted in the editor when the construct is inserted.
     * 
     * Optional, defaults to an empty string.
     */
    value?: string;
    /**
     * The regex that should be used to validate the input of the user. The regex should be written
     * as a string, so that it can be parsed and used in the editor.
     */
    regex: string;
}
interface RecursiveFormatDefinition extends FormatDefinition {
    /**
     * The type of the token. This field determines which of the other fields can be used / are required.
     */
    type: "recursive";
    /**
     * The name of the recursive format definition to be used in the recursion.
     * These definitions are defined in a different file containing all recursive definitions.
     */
    recursiveName: string;
}

/**
 * Structure of a single hole definition
 */
interface HoleDefinition {
    /**
     * The name of the hole. Currently this does not have any effect and can thus be used freely (or
     * left empty)
     */
    name: string;
    /**
     * Indicates whether this hole has to be filled in order for the construct to be valid.
     */
    optional: boolean;
}

/**
 * Structure of the toolbox definition which is displayed when hovering over a construct in
 * the editor's toolbox.
 */
interface ToolboxDefinition {
    /**
     * The title of the category in which the construct should be displayed in the toolbox.
     */
    category: string;
    /**
     * The title of the pop-up, but this is not shown in the editor.
     */
    title: string;
    /**
     * The header of the pop-up, with the title and the description that is being shown.
     */
    tooltip: {
        title: string;
        body: string;
    };
    /**
     * The list of all tips to be shown in the toolbox.
     */
    tips: ToolboxTip[];
    /**
     * A list of strings against which the user's input is matched when typing in the
     * toolbox's search bar.
     */
    "search-queries": string[];
}
/**
 * Structure of a toolbox tip definition, which are the different subsections offering more
 * information within the given pop-up.
 */
interface ToolboxTipDefinition {
    /**
     * The type of the tip, which determines the structure of the tip.
     */
    type: "executable" | "quick" | "use-case";
    /**
     * The title of the tip shown as the header for the tip both when it is collapsed and expanded.
     */
    title: string;
}
/**
 * Structure of an executable tip, which is a tip-type in the toolbox that can be executed.
 */
interface ExecutableTip extends ToolboxTipDefinition {
    /**
     * Unique identifier for the tip.
     */
    id: string;
    /**
     * String representing valid code that can be executed within the given tooltip.
     */
    examples: string;
}
/**
 * Structure of a purely informative tip, which is a tip-type in the toolbox that is not interactable.
 */
interface QuickTip extends ToolboxTipDefinition {
    /**
     * The description of the tip.
     */
    text: string;
}
/**
 * Structure of a use-case tip, which is an interactable tip-type in the toolbox in which the
 * user can go through multiple steps to learn how to use a construct.
 */
interface UseCaseTip extends ToolboxTipDefinition {
    path: string;
    max: number;
    prefix: string;
    extension: string;
    id: string;
    explanations: {
        slide: number;
        text: string;
    };
}

/**
 * Type aggregating all possible format definitions.
 */
export type FormatDefType =
    | TokenFormatDefinition
    | HoleFormatDefinition
    | BodyFormatDefinition
    | ReferenceFormatDefinition
    | ImplementationFormatDefinition
    | IdentifierFormatDefinition
    | EditableFormatDefinition
    | RecursiveFormatDefinition;
/**
 * Type aggregating all possible toolbox tip definitions.
 */
type ToolboxTip = ExecutableTip | UseCaseTip | QuickTip;
