# Language configuration file definitions

Every language file consists of precisely one language. The language is defined by the following JSON syntax:

Every top level object in the JSON array represents a code construct. A code construct can be seen as a language concept, such as a class, a function, a variable, etc. These are fully self defined. The available object properties are:
* `name`: The name of the code construct. This is used to identify the code construct in the code. This is a required property.
* `match`: A regex expression against which the code construct's string will be matched. This is an optional propery, but required if `format` is not defined.
* `format`: A format string that will be used to format the code construct's string. It can exist out of other code constructs as well as standard tokens. This is an optional propery, but required if `match` is not defined. See [Format syntax](#format-syntax) for more information.
* `implementations`: An array of definitions that are implementations, or more specific implementations, of the code construct. This is an optional property. See [Implementations](#implementations) for more information.

## Implementations

An implementation is a specific implementation of a code construct. For example, a Python statement (in reality an expression)
```Python
print("Hello World!")
```
is a specific implementation of the standard method. The "print" replaces the identifier and specifies a number of arguments for the expression list. 
The possible implementation properties are:
* `ref`: Which element in the more abstract definition it replaces
* `name`: The name with which the ref argument will be replaced
* `arguments`: An array of arguments that will be used to replace the arguments of the ref argument. The strings in the array are argument names. This is an optional property.
* `toolbox`: Properties necessary to create the toolbox for the given implementation. This is an optional property. See [Toolbox](#toolbox) for more information.

## Toolbox

## Format syntax