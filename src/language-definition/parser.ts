/**
 * Options:
 * 1) Insert characters one by one in the editor
 *      - easy
 *      - reuse existing systems without much hassle
 *      - PROBLEM: when multiple options are the same (before the hole)
 * 2) Write a seperate "parser" to create the AST and insert it
 *      - more work
 *      - could lead to some unforseen problems
 *      - can use backtracking to solve cases in which multiple constructs are possible (test all of them)
 */

import { Actions } from "../editor/consts";
import { Construct, UniConstruct } from "../syntax-tree/ast";
import { Module } from "../syntax-tree/module";

const example = `print('Hello world')
name = input('What is your name?')
if (len(name) > 5):
    print("Wow that is a long name")
    print(f"Hi {name}!")
`;
/**
 * OPTION 1
 */
function typeLetter(letter: string) {
    console.log("loading option 1");
    // Simulate typing
    const event = new KeyboardEvent("keydown", {
        key: letter,
    });
    const stack = [];

    const context = Module.instance.focus.getContext();
    // Get the EditAction corresponding to the event
    const action = Module.instance.eventRouter.getKeyAction(event, context);

    // If there is data, set its source to "keyboard"
    if (action?.data) action.data.source = { type: "keyboard" };

    // Handle cases
    // switch (action.type) {
    //     case EditActionType.InsertUniConstruct: {
    //         action.data.
    //     }
    // }

    console.log("Action", action);
    // Execute the action and prevent the default event from being triggered if necessary
    const preventDefaultEvent = Module.instance.executer.execute(action, context, event);
}

export function loadCode() {
    let index = 0;
    while (index < example.length - 1) {
        console.log(index, example[index]);
        const letter = example[index] === "\n" ? "Enter" : example[index];
        index++;
        setTimeout(() => typeLetter(letter), 100 * index);
    }
    // typeLetter("p");
    // typeLetter("r");
    // typeLetter("i");
    // typeLetter("n");
    // typeLetter("t");
    // typeLetter("(");
}


/**
 * Option 2
 */
type Result = {
    "constructs": Construct[],
    "remainingCode": string
}

// function parseCode(code: string, stack: string[]): Result {
    
//     for (const action of Actions.instance().actionsList) {
//         const subast = action.getCode() as UniConstruct
//         const staticParts = subast.getRenderText().split("---").map(val => val.split("--")).flat()
//         if (staticParts[0] === code.substring(0, staticParts[0].length)) {
//             subast.tokens = parseCode()
//         }
//     }
// }
