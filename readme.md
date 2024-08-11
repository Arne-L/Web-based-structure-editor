# CodeStruct

A new text-based environment that helps beginners transition into conventional text-based programming environments.

Features:

-   avoids syntax errors
-   enables structured text-based editing
-   provides learning moments on invalid attempts
-   provides hints and visual descriptions

Authoring code with CodeStruct:

-   Cursor-aware Toolbox
-   Suggestion Menus and Autocomplete
-   Draft Mode Editing

## Setup

### Install

-   `npm i`: Install all dependencies
-   `npm start`: Start running the development server

Navigate to `localhost:8080` in your preferred browser.

### Existing errors from before

-   When changing a top-level variable assignment to an empty name or a different name, an error is shown in the console. Also, no warning are added when it is left empty.
    -   Potential fix: ERROR[1]
    -   Potentially fixed

### Possible titles

-   Frame-based programming language-agnostic web-based editor
-   Educatieve programming language agnostic structure editor (EPLASE)
    Een aantal suggesties voor een naam:
    CodeBlox
    CodeScribble / ScriptScribble
    ScriptStitch
    Prostructor (program constructor) / Codestructor (idem)

binnen de "construct editors"

### TODOs

[ ] 

### Short cuts / key presses

The following list is an exhaustive description of all keyboard
combinations in the edit

-   <kbd>↑</kbd>: Move the focus up in an open menu, otherwise the cursor up in the editor
-   <kbd>↓</kbd>: Move the focus down in an open menu, otherwise the cursor down in the editor
-   <kbd>←</kbd>: Move the cursor left in the editor, either to the previous character when text-editable, otherwise to the previous token
-   <kbd>→</kbd>: Move the cursor right in the editor, either to the next character when text-editable, otherwise to the next token
-   <kbd>Home</kbd>: NYI
-   <kbd>End</kbd>: NYI
-   <kbd>Delete</kbd>: NOT FULLY LANGUAGE INDEPENDENT
-   <kbd>Backspace</kbd>: NOT FULLY LANGUAGE INDEPENDENT
-   <kbd>⇥ Tab</kbd>: Indent the current line forwards
-   <kbd>Enter</kbd>: If the menu is open, select the currently focused item, otherwise insert a newline
-   <kbd>Esc</kbd>: If the menu is open, check for an exact match of the current input and insert it if found, otherwise close the menu
-   <kbd>Ctrl</kbd> + <kbd>Space</kbd>: Open the suggestion menu
-   <kbd>Crtl</kbd> + <kbd>C</kbd>: NYI (Copy)
-   <kbd>Crtl</kbd> + <kbd>V</kbd>: NYI (Paste)
-   <kbd>Crtl</kbd> + <kbd>Z</kbd>: NYI (Undo)
-   <kbd>Crtl</kbd> + <kbd>Y</kbd>: NYI (Redo)
-   <kbd>Space</kbd>:

### Design philisophy

-   We try our best to keep the editor in a valid state, but this will always be best effort
    -   Most effort is spent on insertion, while during editing there is higher likelihood of
        invalid states