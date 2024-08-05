"use strict";
(self["webpackChunknova_editor"] = self["webpackChunknova_editor"] || []).push([["src_language-definition_parser_ts"],{

/***/ "./src/language-definition/parser.ts":
/*!*******************************************!*\
  !*** ./src/language-definition/parser.ts ***!
  \*******************************************/
/***/ ((module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.a(module, async (__webpack_handle_async_dependencies__, __webpack_async_result__) => { try {
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   loadCode: () => (/* binding */ loadCode)
/* harmony export */ });
/* harmony import */ var _syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../syntax-tree/module */ "./src/syntax-tree/module.ts");
var __webpack_async_dependencies__ = __webpack_handle_async_dependencies__([_syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__]);
_syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__ = (__webpack_async_dependencies__.then ? (await __webpack_async_dependencies__)() : __webpack_async_dependencies__)[0];
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

const example = `print('Hello world')
name = input('What is your name?')
if (len(name) > 5):
    print("Wow that is a long name")
    print(f"Hi {name}!")
`;
/**
 * OPTION 1
 */
function typeLetter(letter) {
    console.log("loading option 1");
    // Simulate typing
    const event = new KeyboardEvent("keydown", {
        key: letter,
    });
    const stack = [];
    const context = _syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__.Module.instance.focus.getContext();
    // Get the EditAction corresponding to the event
    const action = _syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__.Module.instance.eventRouter.getKeyAction(event, context);
    // If there is data, set its source to "keyboard"
    if (action?.data)
        action.data.source = { type: "keyboard" };
    // Handle cases
    // switch (action.type) {
    //     case EditActionType.InsertUniConstruct: {
    //         action.data.
    //     }
    // }
    console.log("Action", action);
    // Execute the action and prevent the default event from being triggered if necessary
    const preventDefaultEvent = _syntax_tree_module__WEBPACK_IMPORTED_MODULE_0__.Module.instance.executer.execute(action, context, event);
}
function loadCode() {
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
// function parseCode(code: string, stack: string[]): Result {
//     for (const action of Actions.instance().actionsList) {
//         const subast = action.getCode() as UniConstruct
//         const staticParts = subast.getRenderText().split("---").map(val => val.split("--")).flat()
//         if (staticParts[0] === code.substring(0, staticParts[0].length)) {
//             subast.tokens = parseCode()
//         }
//     }
// }

__webpack_async_result__();
} catch(e) { __webpack_async_result__(e); } });

/***/ })

}]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3JjX2xhbmd1YWdlLWRlZmluaXRpb25fcGFyc2VyX3RzLmJ1bmRsZS5qcyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7O0dBVUc7QUFJNEM7QUFFL0MsTUFBTSxPQUFPLEdBQUc7Ozs7O0NBS2YsQ0FBQztBQUNGOztHQUVHO0FBQ0gsU0FBUyxVQUFVLENBQUMsTUFBYztJQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFDaEMsa0JBQWtCO0lBQ2xCLE1BQU0sS0FBSyxHQUFHLElBQUksYUFBYSxDQUFDLFNBQVMsRUFBRTtRQUN2QyxHQUFHLEVBQUUsTUFBTTtLQUNkLENBQUMsQ0FBQztJQUNILE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQztJQUVqQixNQUFNLE9BQU8sR0FBRyx1REFBTSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDbkQsZ0RBQWdEO0lBQ2hELE1BQU0sTUFBTSxHQUFHLHVEQUFNLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRXhFLGlEQUFpRDtJQUNqRCxJQUFJLE1BQU0sRUFBRSxJQUFJO1FBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLENBQUM7SUFFNUQsZUFBZTtJQUNmLHlCQUF5QjtJQUN6QixnREFBZ0Q7SUFDaEQsdUJBQXVCO0lBQ3ZCLFFBQVE7SUFDUixJQUFJO0lBRUosT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUM7SUFDOUIscUZBQXFGO0lBQ3JGLE1BQU0sbUJBQW1CLEdBQUcsdURBQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pGLENBQUM7QUFFTSxTQUFTLFFBQVE7SUFDcEIsSUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0lBQ2QsT0FBTyxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNoQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNuQyxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNsRSxLQUFLLEVBQUUsQ0FBQztRQUNSLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFDRCxtQkFBbUI7SUFDbkIsbUJBQW1CO0lBQ25CLG1CQUFtQjtJQUNuQixtQkFBbUI7SUFDbkIsbUJBQW1CO0lBQ25CLG1CQUFtQjtBQUN2QixDQUFDO0FBV0QsOERBQThEO0FBRTlELDZEQUE2RDtBQUM3RCwwREFBMEQ7QUFDMUQscUdBQXFHO0FBQ3JHLDZFQUE2RTtBQUM3RSwwQ0FBMEM7QUFDMUMsWUFBWTtBQUNaLFFBQVE7QUFDUixJQUFJIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vbm92YS1lZGl0b3IvLi9zcmMvbGFuZ3VhZ2UtZGVmaW5pdGlvbi9wYXJzZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIE9wdGlvbnM6XHJcbiAqIDEpIEluc2VydCBjaGFyYWN0ZXJzIG9uZSBieSBvbmUgaW4gdGhlIGVkaXRvclxyXG4gKiAgICAgIC0gZWFzeVxyXG4gKiAgICAgIC0gcmV1c2UgZXhpc3Rpbmcgc3lzdGVtcyB3aXRob3V0IG11Y2ggaGFzc2xlXHJcbiAqICAgICAgLSBQUk9CTEVNOiB3aGVuIG11bHRpcGxlIG9wdGlvbnMgYXJlIHRoZSBzYW1lIChiZWZvcmUgdGhlIGhvbGUpXHJcbiAqIDIpIFdyaXRlIGEgc2VwZXJhdGUgXCJwYXJzZXJcIiB0byBjcmVhdGUgdGhlIEFTVCBhbmQgaW5zZXJ0IGl0XHJcbiAqICAgICAgLSBtb3JlIHdvcmtcclxuICogICAgICAtIGNvdWxkIGxlYWQgdG8gc29tZSB1bmZvcnNlZW4gcHJvYmxlbXNcclxuICogICAgICAtIGNhbiB1c2UgYmFja3RyYWNraW5nIHRvIHNvbHZlIGNhc2VzIGluIHdoaWNoIG11bHRpcGxlIGNvbnN0cnVjdHMgYXJlIHBvc3NpYmxlICh0ZXN0IGFsbCBvZiB0aGVtKVxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFjdGlvbnMgfSBmcm9tIFwiLi4vZWRpdG9yL2NvbnN0c1wiO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QsIFVuaUNvbnN0cnVjdCB9IGZyb20gXCIuLi9zeW50YXgtdHJlZS9hc3RcIjtcclxuaW1wb3J0IHsgTW9kdWxlIH0gZnJvbSBcIi4uL3N5bnRheC10cmVlL21vZHVsZVwiO1xyXG5cclxuY29uc3QgZXhhbXBsZSA9IGBwcmludCgnSGVsbG8gd29ybGQnKVxyXG5uYW1lID0gaW5wdXQoJ1doYXQgaXMgeW91ciBuYW1lPycpXHJcbmlmIChsZW4obmFtZSkgPiA1KTpcclxuICAgIHByaW50KFwiV293IHRoYXQgaXMgYSBsb25nIG5hbWVcIilcclxuICAgIHByaW50KGZcIkhpIHtuYW1lfSFcIilcclxuYDtcclxuLyoqXHJcbiAqIE9QVElPTiAxXHJcbiAqL1xyXG5mdW5jdGlvbiB0eXBlTGV0dGVyKGxldHRlcjogc3RyaW5nKSB7XHJcbiAgICBjb25zb2xlLmxvZyhcImxvYWRpbmcgb3B0aW9uIDFcIik7XHJcbiAgICAvLyBTaW11bGF0ZSB0eXBpbmdcclxuICAgIGNvbnN0IGV2ZW50ID0gbmV3IEtleWJvYXJkRXZlbnQoXCJrZXlkb3duXCIsIHtcclxuICAgICAgICBrZXk6IGxldHRlcixcclxuICAgIH0pO1xyXG4gICAgY29uc3Qgc3RhY2sgPSBbXTtcclxuXHJcbiAgICBjb25zdCBjb250ZXh0ID0gTW9kdWxlLmluc3RhbmNlLmZvY3VzLmdldENvbnRleHQoKTtcclxuICAgIC8vIEdldCB0aGUgRWRpdEFjdGlvbiBjb3JyZXNwb25kaW5nIHRvIHRoZSBldmVudFxyXG4gICAgY29uc3QgYWN0aW9uID0gTW9kdWxlLmluc3RhbmNlLmV2ZW50Um91dGVyLmdldEtleUFjdGlvbihldmVudCwgY29udGV4dCk7XHJcblxyXG4gICAgLy8gSWYgdGhlcmUgaXMgZGF0YSwgc2V0IGl0cyBzb3VyY2UgdG8gXCJrZXlib2FyZFwiXHJcbiAgICBpZiAoYWN0aW9uPy5kYXRhKSBhY3Rpb24uZGF0YS5zb3VyY2UgPSB7IHR5cGU6IFwia2V5Ym9hcmRcIiB9O1xyXG5cclxuICAgIC8vIEhhbmRsZSBjYXNlc1xyXG4gICAgLy8gc3dpdGNoIChhY3Rpb24udHlwZSkge1xyXG4gICAgLy8gICAgIGNhc2UgRWRpdEFjdGlvblR5cGUuSW5zZXJ0VW5pQ29uc3RydWN0OiB7XHJcbiAgICAvLyAgICAgICAgIGFjdGlvbi5kYXRhLlxyXG4gICAgLy8gICAgIH1cclxuICAgIC8vIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZyhcIkFjdGlvblwiLCBhY3Rpb24pO1xyXG4gICAgLy8gRXhlY3V0ZSB0aGUgYWN0aW9uIGFuZCBwcmV2ZW50IHRoZSBkZWZhdWx0IGV2ZW50IGZyb20gYmVpbmcgdHJpZ2dlcmVkIGlmIG5lY2Vzc2FyeVxyXG4gICAgY29uc3QgcHJldmVudERlZmF1bHRFdmVudCA9IE1vZHVsZS5pbnN0YW5jZS5leGVjdXRlci5leGVjdXRlKGFjdGlvbiwgY29udGV4dCwgZXZlbnQpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbG9hZENvZGUoKSB7XHJcbiAgICBsZXQgaW5kZXggPSAwO1xyXG4gICAgd2hpbGUgKGluZGV4IDwgZXhhbXBsZS5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coaW5kZXgsIGV4YW1wbGVbaW5kZXhdKTtcclxuICAgICAgICBjb25zdCBsZXR0ZXIgPSBleGFtcGxlW2luZGV4XSA9PT0gXCJcXG5cIiA/IFwiRW50ZXJcIiA6IGV4YW1wbGVbaW5kZXhdO1xyXG4gICAgICAgIGluZGV4Kys7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0eXBlTGV0dGVyKGxldHRlciksIDEwMCAqIGluZGV4KTtcclxuICAgIH1cclxuICAgIC8vIHR5cGVMZXR0ZXIoXCJwXCIpO1xyXG4gICAgLy8gdHlwZUxldHRlcihcInJcIik7XHJcbiAgICAvLyB0eXBlTGV0dGVyKFwiaVwiKTtcclxuICAgIC8vIHR5cGVMZXR0ZXIoXCJuXCIpO1xyXG4gICAgLy8gdHlwZUxldHRlcihcInRcIik7XHJcbiAgICAvLyB0eXBlTGV0dGVyKFwiKFwiKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBPcHRpb24gMlxyXG4gKi9cclxudHlwZSBSZXN1bHQgPSB7XHJcbiAgICBcImNvbnN0cnVjdHNcIjogQ29uc3RydWN0W10sXHJcbiAgICBcInJlbWFpbmluZ0NvZGVcIjogc3RyaW5nXHJcbn1cclxuXHJcbi8vIGZ1bmN0aW9uIHBhcnNlQ29kZShjb2RlOiBzdHJpbmcsIHN0YWNrOiBzdHJpbmdbXSk6IFJlc3VsdCB7XHJcbiAgICBcclxuLy8gICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIEFjdGlvbnMuaW5zdGFuY2UoKS5hY3Rpb25zTGlzdCkge1xyXG4vLyAgICAgICAgIGNvbnN0IHN1YmFzdCA9IGFjdGlvbi5nZXRDb2RlKCkgYXMgVW5pQ29uc3RydWN0XHJcbi8vICAgICAgICAgY29uc3Qgc3RhdGljUGFydHMgPSBzdWJhc3QuZ2V0UmVuZGVyVGV4dCgpLnNwbGl0KFwiLS0tXCIpLm1hcCh2YWwgPT4gdmFsLnNwbGl0KFwiLS1cIikpLmZsYXQoKVxyXG4vLyAgICAgICAgIGlmIChzdGF0aWNQYXJ0c1swXSA9PT0gY29kZS5zdWJzdHJpbmcoMCwgc3RhdGljUGFydHNbMF0ubGVuZ3RoKSkge1xyXG4vLyAgICAgICAgICAgICBzdWJhc3QudG9rZW5zID0gcGFyc2VDb2RlKClcclxuLy8gICAgICAgICB9XHJcbi8vICAgICB9XHJcbi8vIH1cclxuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9