import { editor, KeyCode, KeyMod, languages, Range, Selection } from "monaco-editor";
import {
    CodeConstruct,
    Construct,
    EditableTextTkn,
    // EmptyOperatorTkn,
    IdentifierTkn,
    Statement,
    HoleTkn,
} from "../syntax-tree/ast";
import { TAB_SPACES } from "../language-definition/settings";
import { Module } from "../syntax-tree/module";
import { Cursor } from "./cursor";
import { Hole } from "./hole";
import { FONT_SIZE } from "../language-definition/settings";

export class Editor {
    module: Module;
    cursor: Cursor;
    monaco: editor.IStandaloneCodeEditor;
    holes: Hole[];
    mousePosWindow: number[] = [0, 0];
    scrollOffsetTop: number = 0;
    oldCursorLineNumber: number = 1;
    mousePosMonaco: any;

    constructor(parentEl: HTMLElement, module: Module) {
        languages.register({ id: "python3.6" });
        languages.setMonarchTokensProvider("python3.6", {
            defaultToken: "",
            tokenPostfix: ".python",

            keywords: [
                "and",
                "as",
                "assert",
                "break",
                "class",
                "continue",
                "def",
                "del",
                "elif",
                "else",
                "except",
                "exec",
                "finally",
                "for",
                "from",
                "global",
                "if",
                "import",
                "in",
                "is",
                "lambda",
                "None",
                "not",
                "or",
                "pass",
                "print",
                "raise",
                "return",
                "self",
                "try",
                "while",
                "with",
                "yield",

                "int",
                "float",
                "long",
                "complex",
                "hex",

                "abs",
                "all",
                "any",
                "apply",
                "basestring",
                "bin",
                "bool",
                "buffer",
                "bytearray",
                "callable",
                "chr",
                "classmethod",
                "cmp",
                "coerce",
                "compile",
                "complex",
                "delattr",
                "dict",
                "dir",
                "divmod",
                "enumerate",
                "eval",
                "execfile",
                "file",
                "filter",
                "format",
                "frozenset",
                "getattr",
                "globals",
                "hasattr",
                "hash",
                "help",
                "id",
                "input",
                "intern",
                "isinstance",
                "issubclass",
                "iter",
                "len",
                "locals",
                "list",
                "map",
                "max",
                "memoryview",
                "min",
                "next",
                "object",
                "oct",
                "open",
                "ord",
                "pow",
                "print",
                "property",
                "reversed",
                "range",
                "raw_input",
                "reduce",
                "reload",
                "repr",
                "reversed",
                "round",
                "set",
                "setattr",
                "slice",
                "sorted",
                "staticmethod",
                "str",
                "sum",
                "super",
                "tuple",
                "type",
                "unichr",
                "unicode",
                "vars",
                "xrange",
                "zip",

                "True",
                "False",

                "__dict__",
                "__methods__",
                "__members__",
                "__class__",
                "__bases__",
                "__name__",
                "__mro__",
                "__subclasses__",
                "__init__",
                "__import__",
            ],

            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

            brackets: [
                { open: "{", close: "}", token: "delimiter.curly" },
                { open: "[", close: "]", token: "delimiter.bracket" },
                { open: "(", close: ")", token: "delimiter.parenthesis" },
            ],

            tokenizer: {
                root: [
                    { include: "@whitespace" },
                    { include: "@numbers" },
                    { include: "@strings" },

                    [/[,:;]/, "delimiter"],
                    [/[{}\[\]()]/, "@brackets"],

                    [/@[a-zA-Z]\w*/, "tag"],
                    [
                        /[a-zA-Z]\w*/,
                        {
                            cases: {
                                "@keywords": "keyword",
                                "@default": "identifier",
                            },
                        },
                    ],
                ],

                // Deal with white space, including single and multi-line comments
                whitespace: [
                    [/\s+/, "white"],
                    [/(^#.*$)/, "comment"],
                    [/('''.*''')|(""".*""")/, "string"],
                    [/'''.*$/, "string", "@endDocString"],
                    [/""".*$/, "string", "@endDblDocString"],
                ],
                endDocString: [
                    [/\\'/, "string"],
                    [/.*'''/, "string", "@popall"],
                    [/.*$/, "string"],
                ],
                endDblDocString: [
                    [/\\"/, "string"],
                    [/.*"""/, "string", "@popall"],
                    [/.*$/, "string"],
                ],

                // Recognize hex, negatives, decimals, imaginaries, longs, and scientific notation
                numbers: [
                    [/-?0x([abcdef]|[ABCDEF]|\d)+[lL]?/, "number.hex"],
                    [/-?(\d*\.)?\d+([eE][+\-]?\d+)?[jJ]?[lL]?/, "number"],
                ],

                // Recognize strings, including those broken across lines with \ (but not without)
                strings: [
                    [/'$/, "string.escape", "@popall"],
                    [/'/, "string.escape", "@stringBody"],
                    [/"/, "string", "@string_double"],
                    [/"/, "string.escape", "@dblStringBody"],
                    [/f'/, "string", "@string_backtick"],
                ],
                stringBody: [
                    [/[^\\']+$/, "string", "@popall"],
                    [/[^\\']+/, "string"],
                    [/\\./, "string"],
                    [/'/, "string.escape", "@popall"],
                    [/\\$/, "string"],
                ],
                dblStringBody: [
                    [/[^\\"]+$/, "string", "@popall"],
                    [/[^\\"]+/, "string"],
                    [/\\./, "string"],
                    [/"/, "string.escape", "@popall"],
                    [/\\$/, "string"],
                ],

                string_double: [
                    [/[^\\"]+/, "string"],
                    [/\\./, "string.escape.invalid"],
                    [/"/, "string", "@pop"],
                ],

                string_backtick: [
                    [/\{/, { token: "delimiter.curly", next: "@bracketCounting" }],
                    [/[^\\']/, "string"],
                    [/@escapes/, "string.escape"],
                    [/\\./, "string.escape.invalid"],
                    [/'/, "string", "@pop"],
                ],

                bracketCounting: [
                    [/\{/, "delimiter.curly", "@bracketCounting"],
                    [/\}/, "delimiter.curly", "@pop"],
                    { include: "root" },
                ],
            },
        });

        this.monaco = editor.create(parentEl, {
            folding: false,
            dimension: { height: 500, width: 700 },
            value: "",
            language: "python3.6",
            theme: "vs",
            minimap: {
                enabled: false,
            },
            find: { autoFindInSelection: "never" },
            overviewRulerLanes: 0,
            automaticLayout: true,
            scrollbar: {
                vertical: "auto",
                horizontal: "auto",
                verticalSliderSize: 5,
                scrollByPage: false,
            },
            overviewRulerBorder: false,
            fontSize: FONT_SIZE,
            contextmenu: false,
            mouseWheelScrollSensitivity: 0,
            lineHeight: 40,
            selectOnLineNumbers: false,
            letterSpacing: -0.5,
            codeLens: false,
            dragAndDrop: false,
            quickSuggestions: {
                other: false,
                comments: false,
                strings: false,
            },
            parameterHints: {
                enabled: false,
            },
            suggestOnTriggerCharacters: false,
            acceptSuggestionOnEnter: "off",
            tabCompletion: "off",
            wordBasedSuggestions: false,
            renderWhitespace: "none",
            occurrencesHighlight: false,
        });

        this.monaco.addCommand(KeyMod.CtrlCmd | KeyCode.KEY_Z, () => {
            return;
        });

        this.cursor = new Cursor(this);
        this.holes = [];
        this.module = module;
    }

    getLineEl(ln: number) {
        const lines = document.body.getElementsByClassName("view-lines")[0];
        const line = lines.children[ln - 1];

        return <HTMLElement>line?.children[0];
    }

    addHoles(code: Construct) {
        // If hole already exists, return
        for (const hole of this.holes) if (hole.code == code) return;

        if (
            code instanceof EditableTextTkn ||
            code instanceof HoleTkn ||
            code instanceof IdentifierTkn
            // || code instanceof EmptyOperatorTkn
        ) {
            this.holes.push(new Hole(this, code));
        } else if (code instanceof CodeConstruct) {
            code.tokens.forEach((token) => this.addHoles(token));
        }
    }

    /**
     * Add the text to the monaco editor at the given range and add a hole to the editor
     *
     * @param range - The range to replace in the monaco editor
     * @param code - The code to insert
     * @param overwrite - The text to overwrite the range with. If null, the code's render text is used.
     */
    executeEdits(range: Range, code: Construct, overwrite: string = null) {
        // Text to use in the given range
        let text = overwrite;

        // If overwrite is null, use the code's render text
        if (overwrite == null) text = code?.getRenderText() ? code.getRenderText() : "";

        // Execute the edit in the monaco editor
        this.monaco.executeEdits("module", [{ range: range, text, forceMoveMarkers: true }]);

        // Add hole to the editor for the current code
        if (code) this.addHoles(code);

        // Update the focus of the browser
        this.monaco.focus();
    }

    /**
     * Recursively indent the given statement and its body to the left or right,
     * depending on the value of backward
     *
     * @param statement - The statement to indent
     * @param param1 - { backward: boolean } - Whether to indent to the left or right
     */
    indentRecursively(statement: CodeConstruct, { backward = false }) {
        // Indent the given statement to the left or right
        this.module.editor.executeEdits(
            new Range(
                statement.lineNumber,
                statement.leftCol,
                statement.lineNumber,
                statement.leftCol - (backward ? TAB_SPACES : 0)
            ),
            null,
            backward ? "" : "    "
        );

        // If the statement has a body, indent the body as well (recursively)
        if (statement.hasBody()) {
            const stmtStack = new Array<CodeConstruct>();

            stmtStack.unshift(...statement.body);

            /*
                If backswards is false, then we want to indent the statement to the right
                This is done by making the range just the current cursor position (4th element 
                of Range(...) is curStmt.left - 0). As text, we insert 4 spaces, thus resulting
                in an indent of 4 spaces.

                If backwards is true, then we want to unindent the statement to the left. 
                Meaning that we make the range the current cursor position minus 4 spaces and 
                replace that with nothing, thus resulting in an unindent of 4 spaces.
            */
            while (stmtStack.length > 0) {
                const curStmt = stmtStack.pop();

                this.module.editor.executeEdits(
                    new Range(
                        curStmt.lineNumber,
                        curStmt.leftCol,
                        curStmt.lineNumber,
                        curStmt.leftCol - (backward ? TAB_SPACES : 0)
                    ),
                    null,
                    backward ? "" : "    "
                );

                if (curStmt.hasBody()) stmtStack.unshift(...curStmt.body);
            }
        }
    }

    insertAtCurPos(codeList: Array<Construct>) {
        const curPos = this.monaco.getPosition();
        let text = "";

        for (const code of codeList) text += code.getRenderText();

        const range = new Range(curPos.lineNumber, curPos.column, curPos.lineNumber, curPos.column);

        this.monaco.executeEdits("module", [{ range: range, text, forceMoveMarkers: true }]);

        for (const code of codeList) this.addHoles(code);
    }

    computeBoundingBox(selection: Selection) {
        const x = this.monaco.getOffsetForColumn(selection.startLineNumber, selection.startColumn);
        const y = this.monaco.getTopForLineNumber(selection.startLineNumber);

        const width = this.monaco.getOffsetForColumn(selection.endLineNumber, selection.endColumn) - x;
        const height = this.computeCharHeight();

        // if (selection.endLineNumber === 3) {
        //     console.log(this.monaco.getModel().getValue());
        //     console.log(selection.startLineNumber, selection.endLineNumber, selection.startColumn, selection.endColumn);
        //     console.log(this.monaco.getOffsetForColumn(selection.endLineNumber, selection.endColumn), x)
        // }

        return { x, y, width, height };
    }

    computeCharHeight() {
        const lines = document.getElementsByClassName("view-lines")[0];
        const line = lines.children[0];
        const boundingBox = line?.getBoundingClientRect();

        return boundingBox?.height || 0;
    }

    computeCharWidth(ln = 1) {
        const lines = document.getElementsByClassName("view-lines")[0];

        const line = <HTMLElement>lines.children[ln - 1]?.children[0];
        if (line == null) return 0;

        if (line.getBoundingClientRect().width === 0 && line.innerText.length === 0) {
            return 0;
        }

        return line.getBoundingClientRect().width / line.innerText.length;
    }

    computeCharWidthGlobal() {
        const lines = document.getElementsByClassName("view-lines")[0];

        for (let i = 0; i < lines.children.length; i++) {
            const line = <HTMLElement>lines.children[i]?.children[0];

            if (line.getBoundingClientRect().width !== 0 && line.innerText.length !== 0) {
                return line.getBoundingClientRect().width / line.innerText.length;
            }
        }

        return 0;
    }

    computeCharWidthInvisible(ln = 1): number {
        let width = this.computeCharWidth(ln);
        if (width > 0) return width;

        const lines = Array.from(document.getElementsByClassName("view-lines")[0].children);

        for (const line of lines) {
            if (line.children[0] && (line.children[0] as HTMLElement).innerText.length > 0) {
                return (
                    line.children[0].getBoundingClientRect().width / (line.children[0] as HTMLElement).innerText.length
                );
            }
        }
        return FONT_SIZE / 1.92; //Major hack that probably won't always work, but there is no other way than to manually set
        //the value because monaco does not allow you to get font size unless you have a line within
        //the viewport of the editor that also has text in it.
    }

    reset() {
        this.monaco.getModel().setValue("");
        this.holes.forEach((hole) => hole.remove());
        this.holes = [];
    }
}
