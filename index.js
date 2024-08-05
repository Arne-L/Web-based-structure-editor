import "./css/index.css";
//might be related to parsing or handling the syntax tree of the code written in the editor.??
import { Module } from "./syntax-tree/module";
// @ts-ignore
self.MonacoEnvironment = {
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
// retrieveUser();
const nova = new Module("editor");
const runBtnToOutputWindow = new Map();
runBtnToOutputWindow.set("runCodeBtn", "outputDiv");
export { nova, runBtnToOutputWindow };
//# sourceMappingURL=index.js.map