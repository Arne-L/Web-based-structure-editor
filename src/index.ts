import "./css/index.css";
//might be related to parsing or handling the syntax tree of the code written in the editor.??
import { Module } from "./syntax-tree/module";
import { initializeEditor as initialiseEditor } from "./editor/language-toggle";
import { Loader } from "./language-definition/parser";
import { Actions } from "./editor/consts";

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


await initialiseEditor();

// retrieveUser();
let currLanguage;
let nova = new Module("editor");
const runBtnToOutputWindow = new Map<string, string>();
runBtnToOutputWindow.set("runCodeBtn", "outputDiv");

const languageToggle = <HTMLSelectElement>document.getElementById("toggleLanguageBtn")
languageToggle.addEventListener("change", handleToggle);

async function handleToggle() { 
    console.log("Language changed to: ", this.value);
    currLanguage = this.value;
    await initialiseEditor(this.value);
    Actions.reset();
    console.log("Editor initialised", Loader.instance)
    nova = new Module("editor");

    // Reattach event listener after previous one has been deleted
    const languageToggle = <HTMLSelectElement>document.getElementById("toggleLanguageBtn");
    languageToggle.addEventListener("change", handleToggle);
 }

export { nova, runBtnToOutputWindow, currLanguage };