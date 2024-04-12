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

A browser window should open automatically. If not, navigate to `localhost:8080`.

### Possible problems with pure JSON

-   How do we now how the assigned variable should be accessable?
    -   Globally?
    -   Only in the body of the statement in which it occurs (e.g. for)?
    -   In the parent's scope but only after the assignment (e.g. x = 5)?

### Current shortcommings

-   Inserting a requiring constructs between existing constructs does not check that the constructs behind it are still valid; or in other words that the constructs can be inserted there based on the tailing constructs
-   References are only detected if they appear before the current line
    -   Making some type of references have access to all references all over the codebase, could solve this. However, this does still not solve everything e.g. Python functions are accessible in other functions defined before the given function, but not in the code itself
-   No variable reference buttons are created as we don't keep track of types
    -   Maybe useful to add in some way?
-   How to handle autocomplete without typing e.g. x.split("")?

### Existing errors from before

-   When changing a top-level variable assignment to an empty name or a different name, an error is shown in the console. Also, no warning are added when it is left empty.
    -   Potential fix: ERROR[1]
    -   Potentially fixed

### New errors

-   After inserting a new assignment statement, the type will be "any" for a single update cycle: see WARNING[1] for more information
    -   This is not yet fixed as types are currently not the main focus

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

[ ] How to fuse statements and expressions; more precisely, how to handle something that takes at least one line and something that is nested? What if one 'statement' is spread over multiple lines (without including the body)? - To determine whether a construct is a "statement", we can check if its root is on a different line or not. If it is, the current construct can be seen as a statement, otherwise it is not - Is this always true? - Is this even necessary?
[x] Cursor movement: make the cursor jump to the right place after insertion of a construct
[ ] Make it impossible for the cursor to be placed in the middle of a construct (e.g. between two non editable tokens)
[ ] Fix variable in the for-loop
[ ] Debugging
[ ] Rewrite deletion logic (and more generally the editor) to not hardcode statements & expressions.
[ ] Make it so that the delete / backspace keys just delete "the adjacent construct" without making a distinction between statements, expressions and tokens
[ ] Further code cleanup for autocomplete menu
[ ] TODO: Toolbox text scheiden van autocomplete text; waarschijnlijk best door autocomplete text de render text te maken tot en met een enter
[x] Currently the cursor is always placed after the expression when it is inserted, but this should only be the case if there are no empty holes left
[ ] Finding a solution for assignment modifiers when they are being added from the toolbox. As the reference is non-editable, the inserted construct is always an empty non-editable token followed by the assignment modifier, which is a useless construct. How can we make the toolbox insertion behave in a correct manner?

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

### Ideale config file

#### Prolog

_Code_

```Prolog
find_max(X, Y, X) :- X >= Y, !.
find_max(X, Y, Y) :- X < Y.

find_min(X, Y, X) :- X =< Y, !.
find_min(X, Y, Y) :- X > Y.

find_max(100, 200, Max).
% Max = 200
```

_Template_
{identifier}({identifiers}\*) :- {body}.

{reference}({args}[\# afh van definition])

#### TypeScript

```TypeScript
function findMax(x: number, y: number): number {
    return x >= y ? x : y;
}

function findMin(x: number, y: number): number {
    return x <= y ? x : y;
}
```

_Template_
function {identifier}((?:{identifier}(?:: {type})?)\*)(?:: {type}) {\n?\t?{body}}

body = (?:{statement};\n?)+

#### Python

```Python
def find_max(x, y):
    return x if x >= y else y

def find_min(x, y):
    return x if x <= y else y
```

_Template_
def {identifier}({identifier}\*):\n{body}

body = (?:\t{statement}\n)

==> Dit vertalen naar JSON:

-   Kleene-star operator -> min & max repetition van de structuur
-   -   operator -> idem
-

Dit in de plaats van de huidige body format elements in de python-constructs.json file
{
"type": "reference",
"name": "body",
"min": 1,
"max": 1
}

Problemen die hier bij voor kunnen komen?

-   Het concept 'body' verdwijnt en alles wordt een element van de token list -- GEEN PROBLEEM
-   Hoe indentation afhandelen?
    -   Standaard wordt dit aangegeven door tokens, namelijk "\t", "\n" en " ". Binnen een gegeven construct is de structuur dus steeds vast bepaald
    -   Echter een probleem als
        -   De parent wordt verwijderd
            -   bij Python moeten dan alle "body" constructen toegevoegd worden aan de parents "body", maar het body concept verdwijnt volledig.
            -   <span style="color: green">OPLOSSING?</span>
                <i>Telkens bij het verwijderen van de parent door alle tokens gaan en kijken welke tokens hetzelfde constructtype hebben als de parent (of in de plaats van de parent kunnen worden geplaatst)</i>
                <span style="color: red">Een body kan echter meerdere constructs bevatten die gescheiden zijn door een non-editable token.</span> Hoe kunnen we dit oplossen?
                -   <span style="color: green">OPLOSSINGen?</span> - <i>De user laten bepalen wanneer composite structuren kunnen door te kijken wat de recursieve structuren zijn die zijn gedefinieerd (o.a. op naam ofzo). Bijvoorbeeld de if statement zal in de configuratiefile als volgt gedefinieerd zijn:</i>
                    `JSON
    "format": [
      {
          "type": "token",
          "value": "if "
      },
      {
          "type": "hole"
      },
      {
          "type": "token",
          "value": " :\n"
      },
      {
          "type": "recursive",
          "name": "body"
      }
    ]
    `
                    <i>waarbij dan wordt gekeken of het recursief element "body" ook aanwezig is in de parent en dan kan het daar worden ingestoken, anders wordt gewoon het eerste enkele element genomen dat voldoet</i>
                    <span style="color: red">Aantal problemen: dit moet expliciet bijgehouden worden bij runtime constructen + als recursive op naam niet matcht, maar wel op structuur geeft dit invalid terug + suboproepen in de recursive leiden ook weer tot mismatches terwijl ze wel valid zijn</span> - <i>Matchen op de structuur: kijken afhankelijk van de cursorpositie (en verwijderrichting) of de overblijvende constructs kunnen worden ingevoegd in de parent op de positie waar het verwijderde construct stond, eventueel met \t, \n en spatie tokens verwaardloosd om het flexibeler te houden?</i><br>
                    ==> Simpelste voor nu is om gewoon de hele structuur te verwijderen, maar eerst een duidelijke pop-up of warning te geven dat ze moeten bevestigen
                    Later kan er gekeken worden naar manieren om structuren als een geheel te definiëren en te verwijderen, indentaties aan te geven, tokens op de geven als optioneel zodat er een onderscheid kan gemaakt worden tussen de structuur die geinsert moet worden en de structuur die nog steeds valid is ... <br>
                    Eventueel kan je voor indentatie een soort prefix / encapsulating element toevoegen dat een bepaalde token overal voor insert en ook als geheel kunt verwijderen => een soort veralgemeende body
        -   Een bestaand construct naar achter of voor wordt geïndenteerd
            -   <span style="color:green">Naar voor indenteren gaat enkel als er na geen tokens / constructs meer komen met een zelfde oorspronkelijke indent</span>
            -   <span style="color:green">Naar achter indenteren gaat enkel als het verschil tussen het te indenteren construct en het construct ervoor één indentatie is</span><br>
                ==> Indentatie naar volgende niveau werkt wel makkelijk, maar indentatie als deletion niet<br>
                ==> Interessant om dit in de paper ook uit te schrijven waarom hier een onderscheid in is
-   Hoe deletion afhandelen?
    -   Alles is nu een token, een hole of empty line, dus hoe weten wat we moeten verwijderen bij een backspace of delete? Bv. een delete achter de "if --- :" moet de eerste lijn van de "body" verwijderen, wat nu een \n, \t en een statement is bij Python om een correcte structuur te behouden
        -   Ofwel verwijder je één recursief deel ofwel een vast deel
            -   In het recursief deel wil je één stap ongedaan maken
            -   In het vaste deel wil je alles verwijderen, behalve wat in het voorgaande puntje werd besproken
-   Hoe insertions afhandelen
    -   Grotendeels gelijkaardig aan hoe we het nu doen, maar nu moet het insertion algorithm ook rekening houden met de structuur van de parent
        -   Als je momenteel aan een token zit met een "waitOnKeyPress" attribute, dan moet er ook naar die key geluisterd worden en als die getypt wordt, moet een recursie cycle worden uitgevoerd
            Er zijn dus twee eisen om de recursieve call te mogen uitvoeren:
            -   We zitten momenteel aan de juiste token / construct
            -   De correcte "waitOn" key wordt gepressed
        -   Anders kan gewoon het huidige algorithme worden gebruikt
-   Waar mag je je cursor kunnen plaatsen?
    -   Voor of na een construct (code construct, en dus niet een token)
    -   In een hole of empty line
    -   Voor of na een construct in een hole / empty line (dit maakt de eerste regel dus recursief)
-   Hoe scoping afhandelen?
    -   De "body" kan nu overal staan (achter, onder, beiden ...) en moet correct worden aangegeven; hoe kunnen we de scope visueel aangeven?

Eens de syntax correct is, kan er eenvoudig een linter worden gerund op syntactisch correcte programma's

Moet de variable ervoor gedefinieerd zijn of niet? Best als een boolean setting maken
==> scoping ligt op syntactisch vlak, niet op semantisch
==> Scoping laten vallen, en gewoon kijken welke references er in heel het programma gedefinieerd zijn
Eventueel wel scoping gebruiken om voorrang te geven aan bepaalde assignments

Ideeën voor body:

-   getSelection -> getLineSelection() & getSelection
    -   getLineSelection(): Selecteert heel de eerste regel, volgende regels worden geskipt
    -   getSelection(): Selecteert heel de construct, ook verdere regels mochten die er zijn
-   CompositeToken & Single token
    - Composite token: Een reeks tokens die samen bepaalde functionaliteit verwezenlijken, bv. scoping, bepaalde wederkerende tokens etc
    - Single token: zoals voorheen, een gewone token


Er zijn nu twee alternatieven: recursief of imperatief

Recursief:
| Voordelen | Nadelen |
| --- | --- |
| Kunnen bepalen hoe vaak we een token willen herhalen | Niet eenvoudig om een scope aan te geven |
| Mogelijk om verschillende recursiepunten te hebben |  |

Notes: 
* waitOnUser kan algemeen gebruikt worden, en dus ook in het geval van de imperatieve oplossing, maar mag niet top-level gebruikt worden (anders zou een niet geldig construct gegeneerd worden) / eventueel gewoon skippen op de top-level


Imperatief:
| Voordelen | Nadelen |
| --- | --- |
| Scopes kunnen eenvoudig aangegeven worden | Enkel herhaling mogelijk als het de seperator is die herhaald wordt |
| Samenhoren en operaties op het geheel kunnen eenvoudig aangegeven worden | Slechts één punt waar herhaling mogelijk is binnen één loop (kunnen eventueel genest worden) |

Kunnen beiden gecombineerd worden?
Mogelijks ... Elk niveau van recursie een container geven waar ook een seperator token aan kan worden toegevoegd (= imperatief element)
