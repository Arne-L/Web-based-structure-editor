import { ScopeType } from "../syntax-tree/consts";

export interface ConfigDefinition {
    /**
     * The path to the language config file, relative to the language-definition folder
     *
     * Required.
     */
    languageFile: string;
}
export interface LanguageDefinition {
    /**
     * The name of the language.
     *
     * Required.
     */
    name: string;
    /**
     * The path to the language file containing each of the constructs.
     * This should be relative to the language-definition folder
     *
     * The constructs file contains an array of all construct specifications in the editor.
     * Only the recusive or named construct definitions are not included in this file.
     *
     * Required.
     */
    constructFile: string;
    /**
     * The path to the file containing the recursive format definitions. This is
     * useful for constructs, or concepts, that are used in multiple other constructs,
     * e.g. the body concept.
     *
     * WARNING: These definitions could call themselves recursively, but without a proper
     * way of stopping the recursion, this will result in an infinite loop. Currently
     * it is only possible to break the loop by using the "waitOnUser" field on a token
     * contained within a compound construct. Use recursion with caution!
     *
     * Required.
     */
    callableFile: string;
    /**
     * The indentation to use when inserting tabs in the editor. It is also frequently used
     * to indent body constructs.
     *
     * It is used to identify indentations when pressing the backspace key on an indented line.
     * To make the indentation work, the compound construct representing the body should have
     * a field "insertBefore" with an identical value.
     *
     * Required.
     */
    indent: string;
    /**
     * The construct that will be inserted in the editor to start of from.
     * Usually this is some form of body or multi-hole construct.
     *
     * Required.
     */
    initialConstruct: FormatDefType;
    /**
     * A list of (key)words that can / should not be used as identifier names,
     * accompanied by the reason why they are reserved. Multiple "categories"
     * can be created, each having their own reason and list of (key)word. The reason is
     * shown in the editor as an error when one of the accompanying words is detected.
     *
     * Optional.
     */
    reservedWords?: { reason: string; words: string[] }[];
}
/**
 * Structure of a single construct definition
 */
export interface ConstructDefinition {
    /**
     * Name identifying the construct to the designer. This name is not used in the editor
     * and can thus be changed to anything recognisable.
     *
     * Optional.
     */
    internalName?: string;
    /**
     * Used internally to identify and link the construct. It is not visible to the user, but
     * should be unique for each construct.
     *
     * Required.
     */
    keyword: string;
    /**
     * The name used in the toolbox and autocomplete menu to represent the construct.
     *
     * Options:
     * * '--' represents an identifier / text hole
     * * '---' represents a general hole
     *
     * Required.
     */
    editorName: string;
    /**
     * The type of the construct. It is used to determine in which holes the construct can be inserted.
     * Most common values are "expression" and "statement".
     *
     * Required.
     */
    constructType: string;
    /**
     * The sequence of substructures and tokens that make up the construct. This field
     * determines the structure of the construct and the editor's behaviour.
     * Each of the elements are concatenated in order to form the eventual construct.
     *
     * Different types of formattings can be used, of which the most common are:
     * * token: Literal string that should be displayed in the editor for the token.
     * * hole: A hole that can be filled with any construct of the matching constructType.
     * See the {@link FormatDefType} for all possible format definitions.
     *
     * Required. Empty constructs are not allowed.
     */
    format: FormatDefType[];
    /**
     * Constructs that require this construct to be valid.
     *
     * Fields:
     * * ref: The keyword of the construct that requires this construct
     * * min_repeat: The minimum number of times the construct has to be repeated. Defaults to 0, making
     * the construct optional.
     * * max_repeat: The maximum number of times the construct can be repeated. Defaults to infinity.
     *
     * Optional.
     */
    requiringConstructs?: {
        ref: "string";
        min_repeat?: number;
        max_repeat?: number;
    }[];
    /**
     * The construct that has to appear before this construct in the editor. If multiple
     * are given, at least one of them has to be present.
     *
     * NOTE: Will be removed in the future, as all necessary information is already available through
     * the {@link requiringConstructs} field. HOWEVER, currently this field still needs to be in sync with
     * the {@link requiringConstructs} field.
     *
     * Optional.
     */
    requiresConstruct?: string | string[];
    /**
     * The ancestor that has to appear before this construct in the editor.
     *
     * Fields:
     * * ref: The keyword of the construct that has to be the ancestor
     * * min_level: The minimum level of the ancestor. Defaults to 0.
     * * max_level: The maximum level of the ancestor. Defaults to infinity.
     *
     * Levels indicate the depth of the ancestor relative to the construct. Level 0
     * indicates that the ancestor is the direct parent of the construct, level 1
     * the grandparent, etc.
     *
     * Keep in mind that all CodeConstructs count as a level, even if they are not visible.
     * This is especially the case for Compound constructs, which group multiple constructs.
     */
    requiresAncestor:
        | {
              ref: string;
              min_level: number;
              max_level: number;
          }[]
        | {
              ref: string;
              min_level: number;
              max_level: number;
          };
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
     * WARNING: While substrings of the match-field are always a match, substrings of a valid string
     * according to the regex are only valid if they match the regex. 
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
/**
 * Callable format definition that can be injected in other format definitions.
 * Tokens defined by the type "recursive" will be replaced by the (list of) format definitions
 * of the recursive definition with the given name. This allows for easy reuse of lists of format
 * definitions.
 */
export interface RecursiveDefinition {
    /**
     * The name of the format definition. This name is used to call / inject the format definition
     *
     * Required.
     */
    name: string;
    /**
     * Format definitions that should be injected in the format array at the location
     * of a recursive format definition with the given name.
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
    type: "token";
    /**
     * The text that should be displayed in the editor for the token. The string is
     * literally copied, including any spaces or special characters.
     */
    value: string;
}
/**
 * Format definition representing a hole.
 */
interface HoleFormatDefinition extends FormatDefinition {
    type: "hole";
    /**
     * Seperator between the different holes in the nested list of the "holes" field.
     * When multiple holes are defined in a nested list, this key is obligatory. Otherwise
     * it is optional but highly recommended to avoid confusion and future errors.
     *
     * Optional if only one hole is defined in the nested list, otherwise required.
     */
    delimiter?: string;
    /**
     * Array defining each of the individual elements that can be represented as a hole
     * Each element has the following fields:
     * * type: The type of the expected element in the hole, most often "expression" or "statement".
     * Matches with the constructType of the {@link ConstructDefinition}.
     * * optional: Whether the element is optional or not.
     */
    elements: { type: string; optional: boolean }[];
}
/**
 * Format definition representing a reference. These can be split into categories similar to
 * the {@link IdentifierFormatDefinition} to suggest only the most relevant references to the user.
 */
export interface ReferenceFormatDefinition extends FormatDefinition {
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
/**
 * Format definition representing an assignment. Most commonly, these are variables, function names, class
 * names etc.
 */
interface IdentifierFormatDefinition extends FormatDefinition {
    type: "identifier";
    /**
     * The regex that should be used to validate the input of the user. The regex should be written
     * as a string, so that it can be parsed and used in the editor.
     *
     * Required.
     */
    regex: string;
    /**
     * The type indicates to which scope the identifier should be added. It selects the heuristic that is
     * most relevant.
     *
     * Required.
     */
    scopeType: ScopeType;
    /**
     * The categorisation of the assignment. Used to divide the possible assignment and
     * suggest only the most relevant ones to the user. The {@link ReferenceFormatDefinition} uses
     * the same categorisation to filter the assignments.
     *
     * Required.
     */
    reference: string;
}
interface EditableFormatDefinition extends FormatDefinition {
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
     *
     * Required.
     */
    regex: string;
}
interface RecursiveFormatDefinition extends FormatDefinition {
    type: "recursive";
    /**
     * The name of the recursive format definition to be used in the recursion.
     * These definitions are defined in a different file containing all recursive definitions.
     *
     * Required.
     */
    recursiveName: string;
}
export interface CompoundFormatDefinition extends FormatDefinition {
    type: "compound";
    /**
     * Indicates whether the encapsulation represents a scope or not.
     */
    scope: boolean;
    /**
     * Insert this token before each iteration of the compound.
     *
     * Note that insertBefore is inserted, each iteration, before the first token of the compound,
     * not with each new line. If you want to insert a token after each new line, you should write
     * the specification to reflect this.
     *
     * Required.
     */
    insertBefore: string; // Maybe change to token if we want to accept multiple (different) tokens
    /**
     * Setting this to true will make it possible to delete an iteration from the compound and add
     * it to the parent compound. In practice, this often means removing the indentation in front
     * of the cursor position.
     *
     * Optional, defaults to false.
     */
    enableIndentation?: boolean;
    /**
     * The list of format definitions that should be repeated in the compound.
     *
     * Required.
     */
    format: FormatDefType[];
}

/**
 * Structure of the toolbox definition which is displayed when hovering over a construct in
 * the editor's toolbox.
 */
interface ToolboxDefinition {
    /**
     * The title of the category in which the construct should be displayed in the toolbox.
     *
     * Required.
     */
    category: string;
    /**
     * The id of the pop-up, which should be unique. It is never shown to the end user
     *
     * Required.
     */
    title: string;
    /**
     * The header of the pop-up, with the title and the description that is being shown.
     *
     * Required.
     */
    tooltip: {
        title: string;
        body: string;
    };
    /**
     * Tooltip to show when the construct can not be inserted.
     *
     * Optional.
     */
    invalidTooltip: string;
    /**
     * The list of all tips to be shown in the toolbox.
     *
     * Required.
     */
    tips: ToolboxTip[];
    /**
     * A list of strings against which the user's input is matched when typing in the
     * toolbox's search bar.
     *
     * Required.
     */
    searchQueries: string[];
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
    | ReferenceFormatDefinition
    | ImplementationFormatDefinition
    | IdentifierFormatDefinition
    | EditableFormatDefinition
    | RecursiveFormatDefinition
    | CompoundFormatDefinition;
/**
 * Type aggregating all possible toolbox tip definitions.
 */
type ToolboxTip = ExecutableTip | UseCaseTip | QuickTip;
