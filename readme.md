# Educational Language-Independent Structure Editor

A new text-based environment that helps beginners transition into conventional text-based programming environments. It extends / adapts the (CodeStruct)[https://github.com/MajeedKazemi/code-struct] environment to allow users to write their own syntax or language. 

Features:

-   avoids syntax errors
-   enables structured text-based editing
-   language agnostic framework

Authoring code:

-   Cursor-aware Toolbox
-   Suggestion Menus and Autocomplete

## Setup

### Install

-   `npm i`: Install all dependencies
-   `npm start`: Start running the development server

Navigate to `localhost:8080` in your preferred browser.

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
-   <kbd>Delete</kbd>: NYI
-   <kbd>Backspace</kbd>: Implemented, but still some remaining undefined behaviour
-   <kbd>⇥ Tab</kbd>: NYI
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
-   Most effort is spent on insertion, while during editing there is higher likelihood of invalid states