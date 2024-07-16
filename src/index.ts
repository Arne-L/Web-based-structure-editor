import "./css/index.css";
//might be related to parsing or handling the syntax tree of the code written in the editor.??
import { Module } from "./syntax-tree/module";
import { initializeEditor } from "./editor/language-toggle";

console.log("index")

// @ts-ignore
self.MonacoEnvironment = { // self == window, so we define a MonacoEnvironment property on the window object
    getWorkerUrl: function (moduleId, label) {
        if (label === "json") {
            return "./json.worker.bundle.js";
        }

        if (label === "css" || label === "scss" || label === "less") {
            return "./css.worker.bundle.js";
        }

        if (label === "html" || label === "handlebars" || label === "razor") {
            return "./html.worker.bundle.js";
        }

        if (label === "typescript" || label === "javascript") {
            return "./ts.worker.bundle.js";
        }

        return "./editor.worker.bundle.js";
    },
};


await initializeEditor();

// retrieveUser();
let currLanguage;
let nova = new Module("editor");
const runBtnToOutputWindow = new Map<string, string>();
runBtnToOutputWindow.set("runCodeBtn", "outputDiv");

const languageToggle = <HTMLSelectElement>document.getElementById("toggleLanguageBtn")
console.log("Adding listener to language toggle");
languageToggle.addEventListener("change", async function () { 
    console.log("Language changed to: ", this.value);
    currLanguage = this.value;
    await initializeEditor(this.value);
    nova = new Module("editor");
 });

export { nova, runBtnToOutputWindow, currLanguage };