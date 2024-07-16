import "./css/index.css";
//might be related to parsing or handling the syntax tree of the code written in the editor.??
import { Module } from "./syntax-tree/module";
import { initializeEditor as initialiseEditor } from "./editor/language-toggle";
import { Loader } from "./language-definition/parser";
import { Actions } from "./editor/consts";
import config from "./language-definition/config.json";

console.log("index");

// @ts-ignore
self.MonacoEnvironment = {
    // self == window, so we define a MonacoEnvironment property on the window object
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
let nova = new Module("editor");
const runBtnToOutputWindow = new Map<string, string>();
runBtnToOutputWindow.set("runCodeBtn", "outputDiv");

const languageToggle = <HTMLSelectElement>document.getElementById("toggleLanguageBtn");
languageToggle.addEventListener("change", handleToggle);

// Handle export button
document.getElementById("exportCodeBtn").addEventListener("click", () => {
    const code = nova.editor.monaco.getValue();
    download(code, "code.py", "text/plain");
    console.log("Exported code", code);
});

async function handleToggle() {
    await initialiseEditor(this.value);
    Actions.reset();
    nova = new Module("editor");

    // Reattach event listener after previous one has been deleted
    const languageToggle = <HTMLSelectElement>document.getElementById("toggleLanguageBtn");
    languageToggle.addEventListener("change", handleToggle);

    // Handle export button
    document.getElementById("exportCodeBtn").addEventListener("click", () => {
        const code = nova.editor.monaco.getValue();
        download(code, `code.${config.availableLanguages.find((val) => val.language === this.value).extension}`, "text/plain");
    });
}

function download(data, filename, type) {
    const file = new Blob([data], { type: type });
    const a = document.createElement("a"),
        url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

export { nova, runBtnToOutputWindow };
