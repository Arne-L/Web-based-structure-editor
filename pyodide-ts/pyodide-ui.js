export const CONSOLE_TXT_CLASS = "consoleTxt";
export const CONSOLE_ERR_TXT_CLASS = "consoleErrTxt";
export const CONSOLE_WARN_TXT_CLASS = "consoleWarnTxt";
export const addTextToConsole = (consoleId, text, styleClass = CONSOLE_TXT_CLASS) => {
    const outputArea = document.getElementById(consoleId);
    const textEm = document.createElement("div");
    textEm.classList.add(CONSOLE_TXT_CLASS);
    textEm.classList.add(styleClass);
    textEm.textContent = text;
    outputArea.appendChild(textEm);
};
export const clearConsole = (consoleId) => {
    document.getElementById(consoleId).innerHTML = "";
};
//# sourceMappingURL=pyodide-ui.js.map