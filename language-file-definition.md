# Language configuration file definitions

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

## Format syntax
