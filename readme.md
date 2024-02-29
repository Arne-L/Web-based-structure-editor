# CodeStruct
A new text-based environment that helps beginners transition into conventional text-based programming environments.

Features:
- avoids syntax errors
- enables structured text-based editing
- provides learning moments on invalid attempts
- provides hints and visual descriptions

Authoring code with CodeStruct:
- Cursor-aware Toolbox
- Suggestion Menus and Autocomplete
- Draft Mode Editing

## Setup

### Install
* `npm i`: Install all dependencies
* `npm start`: Start running the development server

A browser window should open automatically. If not, navigate to `localhost:8080`.

### Possible problems with pure JSON
* How do we now how the assigned variable should be accessable?
    - Globally?
    - Only in the body of the statement in which it occurs (e.g. for)?
    - In the parent's scope but only after the assignment (e.g. x = 5)?

### Current shortcommings
* Inserting a requiring constructs between existing constructs does not check that the constructs behind it are still valid; or in other words that the constructs can be inserted there based on the tailing constructs
* References are only detected if they appear before the current line
    * Making some type of references have access to all references all over the codebase, could solve this. However, this does still not solve everything e.g. Python functions are accessible in other functions defined before the given function, but not in the code itself
* No variable reference buttons are created as we don't keep track of types
    * Maybe useful to add in some way?
    
* How to handle autocomplete without typing e.g. x.split("")?

### Existing errors from before
* When changing a top-level variable assignment to an empty name or a different name, an error is shown in the console. Also, no warning are added when it is left empty. 
    * Potential fix: ERROR[1]
    * Potentially fixed

### New errors
* After inserting a new assignment statement, the type will be "any" for a single update cycle: see WARNING[1] for more information
    * This is not yet fixed as types are currently not the main focus

### Possible titles
* Frame-based programming language-agnostic web-based editor
* Educatieve programming language agnostic structure editor (EPLASE)




### Short cuts / key presses
The following list is an exhaustive description of all keyboard 
combinations in the edit
* <kbd>↑</kbd>: Move the focus up in an open menu, otherwise the cursor up in the editor
* <kbd>↓</kbd>: Move the focus down in an open menu, otherwise the cursor down in the editor
* <kbd>←</kbd>: Move the cursor left in the editor, either to the previous character when text-editable, otherwise to the previous token
* <kbd>→</kbd>: Move the cursor right in the editor, either to the next character when text-editable, otherwise to the next token
* <kbd>Home</kbd>: NYI
* <kbd>End</kbd>: NYI
* <kbd>Delete</kbd>: NOT FULLY LANGUAGE INDEPENDENT
* <kbd>Backspace</kbd>: NOT FULLY LANGUAGE INDEPENDENT
* <kbd>⇥ Tab</kbd>: Indent the current line forwards
* <kbd>Enter</kbd>: If the menu is open, select the currently focused item, otherwise insert a newline
* <kbd>Esc</kbd>: If the menu is open, check for an exact match of the current input and insert it if found, otherwise close the menu
* <kbd>Ctrl</kbd> + <kbd>Space</kbd>: Open the suggestion menu
* <kbd>Crtl</kbd> + <kbd>C</kbd>: NYI (Copy) 
* <kbd>Crtl</kbd> + <kbd>V</kbd>: NYI (Paste) 
* <kbd>Crtl</kbd> + <kbd>Z</kbd>: NYI (Undo) 
* <kbd>Crtl</kbd> + <kbd>Y</kbd>: NYI (Redo) 
* <kbd>Space</kbd>: 
*