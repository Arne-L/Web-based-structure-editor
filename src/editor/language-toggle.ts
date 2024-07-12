import config from "../language-definition/config.json";

const languages = config.availableLanguages;

let languageHTML = "";
for (const language of languages) {
    languageHTML += `<option value="${language}">${language}</option>`;
}

export function initializeEditor() {
    document.getElementsByTagName("body")[0].innerHTML = `<div id="editor-container">
            <div id="toolbox-container">
                <div id="static-toolbox">
                    <div class="box-header">
                        <h2>Toolbox</h2>
                    </div>
                    <div id="toolbox-menu"></div>
                    <div id="editor-toolbox">
                        <div id="static-toolbox-dummy-space"></div>
                    </div>
                </div>
                <div id="dynamic-toolbox">
                    <div class="box-header">
                        <h2>Defined Variables</h2>
                    </div>
                    <div id="user-variables">
                        <div id="vars-button-grid"></div>
                    </div>
                </div>
            </div>
            <div id="editorArea">
                <div id="editor"></div>
                <div id="console">
                    <div class="button-container">
                        <div class="run-code-button-container">
                            <div class="console-button run-code-btn disabled" id="runCodeBtn">> Run Code</div>
                            <div class="console-button clear-output-btn" id="clearOutputBtn">Clear Console</div>
                        </div>
                        <div class="run-code-button-container">
                            <select name="toggleLanguage" class="console-button toggle-language-btn" id="toggleLanguageBtn">
                                ${languageHTML}
                            </select>
                        </div>
                    </div>
                    <div id="outputDiv"></div>
                </div>
            </div>
        </div>`;
}
