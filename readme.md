# Educational Language-Independent Structure Editor

A new text-based environment that helps beginners transition into conventional text-based programming environments. It extends / adapts the [CodeStruct](https://github.com/MajeedKazemi/code-struct) environment to allow users to write their own syntax or language. 

Features:

-   Structured text-based editing preventing most syntax errors
-   Supports transition from block-based editors to text-based editors
-   Language independent with JSON interface to define a new syntax 
-   Option to export text-based code
-   Web based editor
-   Toolbox with cursor-aware behaviour
-   IDE-like features such as autocomplete

## Editor

### High-level description

The programming environment consists of three main parts: a toolbox, editor and console. 

- The toolbox contains all structures that can be used in the environment 
- The editor is where the user's code is located. It is not purely text based, even though it might seem so. The user will only be able to edit on the level of constructs instead of characters. The only exception is when typing in a hole.
- The console shows the output of the program when the "Run Code" button has been pressed. This only works for the languages with an available runtime environment. 

Aside from the toolbox, structures can be inserted by selecting them from the autocomplete menu or by typing them out completely. This allows users to intuitively progress from a block-based to a more text-based feeling workflow within the same environment. 

### Short cuts

The following list is an exhaustive description of all keyboard
combinations in the editor:

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

<span style="font-style:italic;">NYI = Not Yet Implemented</span>

## Adding languages

The environment uses a custom JSON format to define a syntax or language. This allows anyone interested, even when programming knowledge is limited, to define a language in an intuitive manner. Teachers, online teaching platforms or anyone interested in tinckering with a syntax should thus be able to make their own custom syntax. 

### Example

The next example will illustrate the basic building blocks and how they can be used to construct a new syntax. We refer to [definitions.ts](src/language-definition/definitions.ts) for a more detailed description of the interface.

#### Required files

In total there are four files required to get a syntax to work: `config.json`, `{language}.json`, `{language}-constructs.json` and `{language}-callable.json`. Three languages have already been added and can be found in the [language-definitions](src/language-definition/) folder; use them as a reference when adding a new syntax.

`config.json` and `{language}.json` contain metadata related to all available languages and each individual language respectively. 

Notice that the `{language}-constructs.json` and `{language}-callable.json` are by conventioned named in this way. However, they can be named however you like as long as they are equal to the `constructFile` and `callableFile` values. The name `config.json` is fixed and can not be changed. The language in `{language}.json` filename is dependent on the languages defined in the config file under the `language` field. 

#### Adding a construct

Let's assume we want to implement the Python language. As any good programmer knows, the minimum viable product for a programming language is the ability to print "Hello World!" to the standard output. To achieve this, we need to add a construct to the constructs file `python-constructs.json`:

```json
[
    {
        "keyword": "print",
        "constructType": "statement",
        "format": [
            {
                "type": "token",
                "value": "print"
            },
            {
                "type": "token",
                "value": "("
            },
            {
                "type": "hole",
                "delimiter": ", ",
                "elements": [
                    {
                        "type": "expression",
                        "optional": false
                    }
                ]
            },
            {
                "type": "token",
                "value": ")"
            }
        ],
        "editorName": "print(---)",
        "match": "print",
        "triggerInsertion": ["("],
        "toolbox": { ... }
    },
]
```

The `keyword` field needs to be a unique name identifying the construct. This name will be used in other constructs to refer to the print construct. 

`constructType` is used to check compatibility with a construct hole. Only constructs with the correct type can be inserted in a hole.

The `format` field contains a list of tokens representing the syntax structure of the construct. This is the most central part of the specification and makes many of the editor's features possible. A full list of all token types can be found in [Token Types](#token-types).

The `editorName` is the value found within each toolbox block. Visually, "--" will be replaced by a text hole while "---" will be replaced by a construct hole.

The `match` field is used to match the user's input when typing with each of the constructs. Often times this will be equal to the first token(s). `triggerInsertion` includes an array of characters: if the match-string equals the user input, and the next character typed is one of the triggerInsertion characters, the structure is automatically inserted. 

The last remaining field `toolbox` encompasses an array of mostly fields informing the end user of what the construct does and how it works. 

#### Introducing looping

In reality a print statement can have an infinite number of arguments. Currently it is only possible to write a single fixed argument. To fix this, we introduce a new concept called `CompoundConstruct`: the structure repeats a list of subconstructs until it has to wait for some user input. The following example extends the print statement with a `CompoundConstruct`:

```json
[
    {
        "keyword": "print",
        "constructType": "statement",
        "format": [
            ...
            {
                "type": "hole",
                "delimiter": ", ",
                "elements": [
                    {
                        "type": "expression",
                        "optional": false
                    }
                ]
            },
            {
                "type": "compound",
                "scope": false,
                "insertBefore": null,
                "format": [
                    {
                        "type": "token",
                        "value": ", ",
                        "waitOnUser": ","
                    },
                    {
                        "type": "hole",
                        "delimiter": ", ",
                        "elements": [
                            {
                                "type": "expression",
                                "optional": false
                            }
                        ]
                    }
                ]
            },
            {
                "type": "token",
                "value": ")"
            }
        ],
        ...
    },
]
```

The `CompoundConstruct` will keep on inserting the defined tokens (under the `format` field) until it reaches a taken with a `waitOnUser` field. Only when the button corresponding to the given field-value is pressed at that location, will the `CompoundConstruct` continue inserting the defined tokens where it last stopped. When it reaches the last defined token of the list of format-tokens, it loops back to the start of the list. <br><span style="color: orange; font-weight: bold;">WARNING</span>: The `CompoundConstruct` will thus loops indefinitly until stopped by a defined token with a `waitOnUser` field.

#### Adding a callable

Many structures share some common components, for example a body. In Python we could define the body concept as follows:

```json
{
    "type": "compound",
    "scope": true,
    "insertBefore": "    ",
    "enableIndentation": true,
    "format": [
        {
            "type": "hole",
            "elements": [
                {
                    "type": "statement",
                    "optional": true
                }
            ]
        },
        {
            "type": "token",
            "value": "\n",
            "waitOnUser": "Enter"
        }
    ]
}
```

This results in an intended - relative to its parent - hole in the editor. If the user presses the enter key directly after the hole, a new intended hole will be produced on the next line. The result is thus what we would expect from a body. 

`if`, `while`, `for` and `def` statements all make use of this body concept. The most direct option would be to copy the above json code into each of the definitions of the constructs, but this would result in duplicate code. The ideal option would be to define it once and only use a reference in all other places, similar to how variables work. The following example shows (a part of) the while statement:

```json
{
    "keyword": "while",
    "editorName": "while --- :",
    "format": [
        {
            "type": "token",
            "value": "while "
        },
        {
            "type": "hole",
            "delimiter": ", ",
            "elements": [
                {
                    "type": "expression",
                    "optional": false
                }
            ]
        },
        {
            "type": "token",
            "value": " :"
        },
        {
            "type": "recursive",
            "recursiveName": "body"
        }
    ],
    ...
}
```

Notice the format token of `type` "recursive". This serves as a "variable reference" to a "variable" defined in `python-callable.json`, which contains all defined "variables". Each "variable" is a name together with a list of format tokens:

```json
[
    {
        "name": "body",
        "format": [
            {
                "type": "token",
                "value": "\n"
            },
            {
                "type": "compound",
                "scope": true,
                "insertBefore": "    ",
                "enableIndentation": true,
                "format": [
                    {
                        "type": "hole",
                        "elements": [
                            {
                                "type": "statement",
                                "optional": true
                            }
                        ]
                    },
                    {
                        "type": "token",
                        "value": "\n",
                        "waitOnUser": "Enter"
                    }
                ]
            }
        ]
    }
]
```

#### What's next?

The previous example should function as a good starting point to define a new syntax or language. The implementation for the Python, Prolog and Hedy subsets can be found in the [language-definitions](src/language-definition) folder. Additionally, be sure to take a look at the full specification in [definitions.ts](src/language-definition/definitions.ts). 


### Token types

The table listed below contains an enumaration of the different token types with a short description. Each type is accompanied by a list of fields. For more information about each type of token or the fields, see the [definitions.ts](src/language-definition/definitions.ts) file.

| Type          | Description   |
| ------------- | ------------- |
| token | Fixed value. It is the base building block for each of the constructs. <br>Required fields: `value` <br>The token *type* refers to the smallest, fixed, non-editable building block. The token *construct* encompasses all indivisable structures. |
| hole | A hole signifies an empty spot were a construct can be placed. If the `elements` field constains multiple items, the `delimiter` field is required as well.<br>Required fields: `elements` <br>Dependent fields: `delimiter` |
| identifier | Adds the editable building block's text to the given scope.<br>Required fields: `regex`, `scopeType` and `reference` |
| reference | Indicates that the given building block should be a reference to a declared and in scope variable, function, class ... References can be chosen from in scope identifiers. |
| editable | A basic, editable building block. It is often refered to as a *text hole*.<br>Required fields: `regex`<br>Optional fields: `value` |
| recursive | Inserts the list of tokens defined in ```{language}-callable.json``` with `name` equal to the `recursiveName` value.<br>Required fields: `recursiveName` |
| compound | Loops through the tokens defined under the `format` field and inserts them one by one. When reaching the last token, it starts back from the start. The infinite insertion loop is only broken when it reaches a token with a `waitOnUser` field. When the request button is pressed, the infinite loop restarts again until it reaches the next token wit a `waitOnUser` field.<br>Required fields: `scope` and `format` |

Notice that the last two tokens types are in fact not single, indivisable structures but placeholders for a list of constructs containing somewhere between zero and an infinite number of constructs.

## Implementation details

### File structure


<details>
<summary>File tree</summary>
<pre style="color: white;">
📦src
 ┣ 📂css
 ┣ 📂editor
 ┃ ┣ 📜action-executor.ts
 ┃ ┣ 📜action-filter.ts
 ┃ ┣ 📜consts.ts
 ┃ ┣ 📜cursor.ts
 ┃ ┣ 📜data-types.ts
 ┃ ┣ 📜doc-box.ts
 ┃ ┣ 📜draft.ts
 ┃ ┣ 📜editor.ts
 ┃ ┣ 📜event-router.ts
 ┃ ┣ 📜event-stack.ts
 ┃ ┣ 📜focus.ts
 ┃ ┣ 📜hole.ts
 ┃ ┣ 📜language-toggle.ts
 ┃ ┣ 📜toolbox.ts
 ┃ ┣ 📜utils.ts
 ┃ ┗ 📜validator.ts
 ┣ 📂icons
 ┃ ┣ 📜export.svg
 ┃ ┗ 📜icons.ts
 ┣ 📂language-definition
 ┃ ┣ 📜config.json
 ┃ ┣ 📜definitions.ts
 ┃ ┣ 📜hedyl1_en-callable.json
 ┃ ┣ 📜hedyl1_en-constructs.json
 ┃ ┣ 📜hedyl1_en.json
 ┃ ┣ 📜hedyl1_nl-callable.json
 ┃ ┣ 📜hedyl1_nl-constructs.json
 ┃ ┣ 📜hedyl1_nl.json
 ┃ ┣ 📜hedyl2_en-callable.json
 ┃ ┣ 📜hedyl2_en-constructs.json
 ┃ ┣ 📜hedyl2_en.json
 ┃ ┣ 📜loader.ts
 ┃ ┣ 📜parser.ts
 ┃ ┣ 📜prolog-callable.json
 ┃ ┣ 📜prolog-constructs.json
 ┃ ┣ 📜prolog.json
 ┃ ┣ 📜python-callable.json
 ┃ ┣ 📜python-constructs.json
 ┃ ┣ 📜python.json
 ┃ ┗ 📜settings.ts
 ┣ 📂logger
 ┃ ┣ 📜analytics.ts
 ┃ ┣ 📜requests.ts
 ┃ ┗ 📜user.ts
 ┣ 📂messages
 ┃ ┣ 📜error-msg-generator.ts
 ┃ ┣ 📜message-controller.ts
 ┃ ┣ 📜messages.ts
 ┃ ┗ 📜notifications.ts
 ┣ 📂pyodide-js
 ┃ ┣ 📜load-pyodide.js
 ┃ ┗ 📜pyodide-controller.js
 ┣ 📂pyodide-ts
 ┃ ┗ 📜pyodide-ui.ts
 ┣ 📂suggestions
 ┃ ┣ 📜construct-doc.ts
 ┃ ┗ 📜suggestions-controller.ts
 ┣ 📂syntax-tree
 ┃ ┣ 📜ast.ts
 ┃ ┣ 📜callback.ts
 ┃ ┣ 📜constructor.ts
 ┃ ┣ 📜consts.ts
 ┃ ┣ 📜heuristics.ts
 ┃ ┣ 📜language.ts
 ┃ ┣ 📜module.ts
 ┃ ┣ 📜scope.ts
 ┃ ┣ 📜utils.ts
 ┃ ┗ 📜validator.ts
 ┣ 📂utilities
 ┃ ┣ 📜text-enhance.ts
 ┃ ┗ 📜util.ts
 ┣ 📜index.html
 ┗ 📜index.ts
</pre>
</details>

## Local Installation

The following steps should suffice to get the editor running locally once the repository has been cloned.

-   `npm i`: Install all dependencies
-   `npm start`: Start running the development server
-   Navigate to `localhost:8080` in your preferred browser.

### Design philisophy

-   We try our best to keep the editor in a valid state, but this will always be best effort
-   Most effort is spent on insertion, while during editing there is higher likelihood of invalid states

### Known bugs

The following is - sadly - a non-exhaustive list of all currently known bugs

- Clicking on the whitespace after a line of code places the cursor at the beginning of the line
- Not possible to remove a construct when the cursor is placed in an editable token
- Moving the cursor around with the arrow keys does sometimes result in unexpected behaviour
- Switching back to the Python language does not re-enable the Run Code button 





<!-- # Language configuration file definitions

Every language file consists of precisely one language. The language is defined by the following JSON syntax:

Every top level object in the JSON array represents a code construct. A code construct can be seen as a language concept, such as a class, a function, a variable, etc. These are fully self defined. The available object properties are:

-   `name`: The name of the code construct. This is used to identify the code construct in the code. This is a required property.
-   `match`: A regex expression against which the code construct's string will be matched. This is an optional propery, but required if `format` is not defined.
-   `format`: A format string that will be used to format the code construct's string. It can exist out of other code constructs as well as standard tokens. This is an optional propery, but required if `match` is not defined. See [Format syntax](#format-syntax) for more information.
-   `implementations`: An array of definitions that are implementations, or more specific implementations, of the code construct. This is an optional property. See [Implementations](#implementations) for more information.

## Implementations

An implementation is a specific implementation of a code construct. For example, a Python statement (in reality an expression)

```Python
print("Hello World!")
```

is a specific implementation of the standard method. The "print" replaces the identifier and specifies a number of arguments for the expression list.
The possible implementation properties are:

-   `ref`: Which element in the more abstract definition it replaces
-   `name`: The name with which the ref argument will be replaced
-   `arguments`: An array of arguments that will be used to replace the arguments of the ref argument. The strings in the array are argument names. This is an optional property.
-   `editorName`: Option name used to represent the button in the toolbox. "---" is replaced with a expression hole, "--" with a statement hole and " " with a tab. CURRENT STATE? WILL PROBABLY CHANGE IN THE FUTURE
-   `id`: Id of the button that has to be unique. It is also used for the tooltip. Failing to provide a unique id might result in lost features
-   `toolbox`: Properties necessary to create the toolbox for the given implementation. This is an optional property. See [Toolbox](#toolbox) for more information.

## Toolbox

All properties here are for showing the correct information in the toolbox.

-   `category`: The category in which the code construct will be placed in the toolbox.
-   `title`: The title of the code construct WHEN IS THIS IMPORTANT?
-   `tooltip`
    -   `title`: The title of the tooltip
    -   `body`: The description of the tooltip
-   `tips` \[
    -   `type`: The type of expandable tip that will be shown. Options are "executable", "quick" and "use-case".
    -   `title`: The title of the tip.
    -   `id`: A unique identifier for the tip.
    -   `example?`: The code to show in the tip. Only necessary for the executable tip type.
    -   `text?`: Explain a concept. Only necessary for the quick tip type.
    -   `path?`, `max?`, `prefix?`, `extension?`, `id?` and `explanations?`: See example. Only necessary for the use-case tip type.
-   `searchQueries`: Words to match with the input of the searchbox. An array should be provided.

\]

## Format syntax -->
