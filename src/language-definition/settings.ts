export const EMPTYIDENTIFIER: string = "  ";
export const TAB_SPACES = 4;
export const LIGHT_GRAY: [number, number, number, number] = [230, 235, 255, 0.7];
export const ERROR_HIGHLIGHT_COLOUR: [number, number, number, number] = [255, 153, 153, 0.5];
export const EDITOR_DOM_ID = "editor";
export const navigationKeys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
export const FONT_SIZE = 20;
export const INITIAL_Z_INDEX = 500;

/**
 * The text that is used to represent a hole in the code.
 */
export const HOLETEXT = "   ";

/**
 * Amount of times the algorithm will move up in the AST to the next UniConstruct
 * in hopes of finding a (child)scope
 */
export const LOCALCHILDSEARCHDEPTH = 5;
