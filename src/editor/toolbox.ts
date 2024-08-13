import Fuse from "fuse.js";
import { Position } from "monaco-editor";

import { nova, runBtnToOutputWindow } from "..";
import { attachPyodideActions, codeString } from "../pyodide-js/pyodide-controller";
import { CONSOLE_ERR_TXT_CLASS, addTextToConsole, clearConsole } from "../pyodide-ts/pyodide-ui";
import { Construct, Statement } from "../syntax-tree/ast";
import { DataType, InsertionType, Tooltip } from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { getUserFriendlyType } from "../utilities/util";
import { LogEvent, LogType, Logger } from "./../logger/analytics";
import { Accordion, TooltipType } from "./accordion";
import { EditCodeAction } from "./action-filter";
import { Actions } from "./consts";
import { createExample } from "./doc-box";
import { Context } from "./focus";

export const docBoxRunButtons = new Map<string, string[]>(); // Can remove export

/**
 * Singleton class that handles the creation and updating of all the toolbox elements, including
 * the toolbox buttons, the search box, the tooltips and the toolbox menu on the left side of
 * the toolbox. Disabling and enabling buttons is also handled here in the updateButtonsOnContextChange
 */
export class ToolboxController {
    /**
     * Defining the names of the classes used for the buttons in the toolbox.
     */
    static draftModeButtonClass = "button-draft-mode";
    static invalidButtonClass = "button-invalid";
    static validButtonClass = "button-valid";

    updateToolbox: () => void;

    module: Module;

    constructor(module: Module) {
        this.module = module;
    }

    /**
     * Add a tooltop to each button in the toolbox.
     */
    addTooltips() {
        const toolboxCategories = Actions.instance().toolboxCategories;

        for (const constructGroup of toolboxCategories) {
            for (const item of constructGroup.items) {
                const button = document.getElementById(item.cssId);

                button.addEventListener("mouseover", () => {
                    const tooltipId = `tooltip-${item.cssId}`;

                    if (!document.getElementById(tooltipId)) {
                        const tooltipComponent = new TooltipComponent(this.module, item);
                        const tooltip = tooltipComponent.element;
                        tooltip.id = tooltipId;

                        tooltip.style.left = `${button.getBoundingClientRect().right + 10}px`;
                        tooltip.style.top = `${button.getBoundingClientRect().top}px`;
                        tooltip.style.display = "block";

                        button.addEventListener("click", () => {
                            tooltip.remove();
                        });

                        setTimeout(() => {
                            tooltip.style.opacity = "1";
                        }, 1);

                        button.addEventListener("mouseleave", () => {
                            setTimeout(() => {
                                if (tooltip && !tooltip.matches(":hover") && !button.matches(":hover")) {
                                    tooltip.style.opacity = "0";

                                    setTimeout(() => {
                                        tooltipComponent.onRemove();
                                        tooltip.remove();
                                    }, 100);
                                }
                            }, 150);
                        });

                        tooltip.addEventListener("mouseleave", () => {
                            // No setTimeout before checking the if, so when returning from the tooltip,
                            // it will always disappear.
                            if (tooltip && !tooltip.matches(":hover") && !button.matches(":hover")) {
                                tooltip.style.opacity = "0";

                                setTimeout(() => {
                                    tooltipComponent.onRemove();
                                    tooltip.remove();
                                }, 100);
                            }
                        });
                    }
                });
            }
        }
    }

    /**
     * Update which buttons can be used based on the current context.
     */
    updateButtonsOnContextChange() {
        this.module.focus.subscribeOnNavChangeCallback(
            ((c: Context) => {
                const inserts = this.module.actionFilter.getProcessedInsertionsList();

                // mark draft mode buttons
                ToolboxController.updateButtonsVisualMode(inserts);
            }).bind(this)
        );
    }

    /**
     * Checks for each insertion record, corresponding to toolbox buttons, if the insertion is valid,
     * invalid or in draft mode. If invalid, the button is disabled.
     *
     * @param insertionRecords - The list of insertion records to update the buttons for.
     */
    static updateButtonsVisualMode(insertionRecords: EditCodeAction[]) {
        for (const insertionRecord of insertionRecords) {
            const button = document.getElementById(insertionRecord.cssId) as HTMLButtonElement;

            if (button) {
                if (insertionRecord.insertionResult.insertionType === InsertionType.DraftMode) {
                    removeClassFromButton(insertionRecord.cssId, ToolboxController.invalidButtonClass);
                    removeClassFromButton(insertionRecord.cssId, ToolboxController.validButtonClass);
                    // addClassToButton(insertionRecord.cssId, ToolboxController.draftModeButtonClass);
                    button.disabled = false;
                } else if (insertionRecord.insertionResult.insertionType === InsertionType.Valid) {
                    addClassToButton(insertionRecord.cssId, ToolboxController.validButtonClass);
                    // removeClassFromButton(insertionRecord.cssId, ToolboxController.draftModeButtonClass);
                    removeClassFromButton(insertionRecord.cssId, ToolboxController.invalidButtonClass);
                    button.disabled = false;
                } else {
                    // removeClassFromButton(insertionRecord.cssId, ToolboxController.draftModeButtonClass);
                    removeClassFromButton(insertionRecord.cssId, ToolboxController.validButtonClass);
                    addClassToButton(insertionRecord.cssId, ToolboxController.invalidButtonClass);
                    button.disabled = true;
                }
            }
        }
    }

    /**
     * Creates the searchbox, adds the updateToolbox function which updates the visible toolbox
     * buttons and calls this function whenever the searchbox input changes.
     *
     * @returns - The search box DOM element.
     */
    createSearchBox(): HTMLDivElement {
        // Seach box container
        const container = document.createElement("div");
        container.classList.add("search-box-container");

        // Search field of search box
        const searchBox = document.createElement("input");
        searchBox.id = "toolbox-search-box";
        searchBox.type = "search";
        searchBox.placeholder = "type to search";
        searchBox.classList.add("search-box");

        container.appendChild(searchBox);

        const options = {
            includeMatches: true,
            shouldSort: true,
            threshold: 0.2,
            keys: ["documentation.searchQueries"],
        };

        const fuse = new Fuse(Actions.instance().actionsList, options);

        this.updateToolbox = () => {
            let results = fuse.search(searchBox.value);
            let resultActionsId = results.map((result) => result.item.cssId);

            const showAll = results.length === 0;

            for (const category of Actions.instance().toolboxCategories) {
                let clearedItemsInCategory = 0;

                for (const item of category.items) {
                    if (!showAll && resultActionsId.indexOf(item.cssId) === -1) {
                        // Hide button
                        document.getElementById(item.cssId).parentElement.style.display = "none";
                        clearedItemsInCategory++;
                    } else {
                        // Show button
                        document.getElementById(item.cssId).parentElement.style.display = "flex";
                    }
                }

                if (clearedItemsInCategory === category.items.length) {
                    // Hide category
                    document.getElementById(category.id).style.display = "none";
                } else {
                    // Show category
                    document.getElementById(category.id).style.display = "block";
                }
            }
        };

        searchBox.addEventListener("input", () => {
            this.updateToolbox();
        });

        return container;
    }

    /**
     * Creates the entire toolbox on the left of the editor.
     */
    loadToolboxFromJson() {
        const staticToolboxDiv = document.getElementById("static-toolbox");
        const toolboxDiv = document.getElementById("editor-toolbox");
        const toolboxMenu = document.getElementById("toolbox-menu");
        // The dummy in the toolbox column for the CodeStructs that fills the remaining space after
        // the last category to make it fit to the top of the toolbox when fully scrolled
        // to the bottom of the containing element.
        const staticDummySpace = document.getElementById("static-toolbox-dummy-space");

        const toolboxCategories = Actions.instance().toolboxCategories;

        for (const constructGroup of toolboxCategories) {
            if (constructGroup) {
                let categoryDiv;

                // Create a div for the category
                categoryDiv = document.createElement("div");
                categoryDiv.id = constructGroup.id;
                categoryDiv.classList.add("group");

                // Create the category name
                const p = document.createElement("p");
                p.textContent = constructGroup.displayName;
                categoryDiv.appendChild(p);

                for (const item of constructGroup.items) {
                    const button = ToolboxButton.createToolboxButtonFromJsonObj(item);

                    categoryDiv.appendChild(button.container);
                }

                // Insert the categoryDiv as a child of toolboxDiv before the staticDummySpace
                toolboxDiv.insertBefore(categoryDiv, staticDummySpace);

                // Create a button in the overview menu on the left side of the toolbox for the category
                const menuButton = document.createElement("div");
                menuButton.classList.add("menu-button");
                menuButton.innerText = constructGroup.displayName;

                menuButton.addEventListener("click", () => {
                    document.getElementById(constructGroup.id).scrollIntoView({ behavior: "smooth" });
                });

                toolboxMenu.appendChild(menuButton);
            }
        }

        // Create the searchbox on top of the toolbox
        const searchBox = this.createSearchBox();
        staticToolboxDiv.insertBefore(searchBox, toolboxMenu);

        staticDummySpace.style.minHeight = `${
            toolboxDiv.clientHeight - toolboxDiv.children[toolboxDiv.children.length - 2].clientHeight - 20
        }px`;
    }
}

/**
 * Class for creating toolbox buttons and adding them to the toolbox.
 */
export class ToolboxButton {
    // Can remove export
    container: HTMLDivElement;

    constructor(text: string, domId?: string, code?: Construct) {
        // Container for the button
        this.container = document.createElement("div");
        this.container.classList.add("var-button-container");

        // Button itself
        const button = document.createElement("div");
        button.classList.add("button");

        /**
         * TODO: CHANGE BUTTON VISUAL MODES TO SOMETHING EXTENTABLE
         */
        // if (!(code instanceof Expression) && !(code instanceof Modifier)) {
        //     // For example "if ...", "while ...", "for ...", "var = ..." etc.
        //     // Shown as a square button.
        //     button.classList.add("statement-button");
        // } else if (code instanceof Modifier) {
        //     // For example "= ...", "+= ...", "-= ...", etc.
        //     // Shown as a square button.
        //     button.classList.add("modifier-button");
        // } else if (code instanceof Expression) {
        //     // For example "0", "range(...)", etc.
        //     // Shown as a pill shaped button button.
        //     button.classList.add("expression-button");
        // }

        this.container.appendChild(button);

        if (domId) button.id = domId;

        // Expression holes or similar are shown as a pill shaped hole.
        let htmlText = text.replace(/---/g, "<hole1></hole1>");
        // Statement holes or similar are shown as a square hole. (see e.g. for ... in ...)
        htmlText = htmlText.replace(/--/g, "<hole2></hole2>");
        // The spaces in the code constructs
        htmlText = htmlText.trim().replace(/ /g, "&nbsp");
        button.innerHTML = htmlText;
    }

    /**
     * Get the button element for the toolbox code constructs.
     *
     * @returns - The button element of the toolbox button (so without the container).
     */
    getButtonElement(): Element {
        return this.container.getElementsByClassName("button")[0];
    }

    /**
     * Remove the toolbox button together with its container from the DOM.
     */
    removeFromDOM() {
        this.container.remove();
    }

    /**
     * Create a toolbox button from an EditCodeAction.
     *
     * @param action - The EditCodeAction to create the button from.
     * @returns - The created toolbox button.
     */
    static createToolboxButtonFromJsonObj(action: EditCodeAction) {
        return new ToolboxButton(action.optionName, action.cssId, action.getCode());
    }

    /**
     * Change the visual mode of the button to the given insertion type. If it is
     * invalid, the button will be disabled.
     *
     * @param insertionType - The insertion type to set the button to.
     */
    divButtonVisualMode(insertionType: InsertionType) {
        const element = this.getButtonElement();

        if (insertionType === InsertionType.DraftMode) {
            // element.classList.add(ToolboxController.draftModeButtonClass);
            element.classList.remove(ToolboxController.invalidButtonClass);
            element.classList.remove(ToolboxController.validButtonClass);
        } else if (insertionType === InsertionType.Valid) {
            // element.classList.remove(ToolboxController.draftModeButtonClass);
            element.classList.remove(ToolboxController.invalidButtonClass);
            element.classList.add(ToolboxController.validButtonClass);
        } else {
            element.classList.remove(ToolboxController.validButtonClass);
            // element.classList.remove(ToolboxController.draftModeButtonClass);
            element.classList.add(ToolboxController.invalidButtonClass);
        }
    }
}

// /**
//  * Get the HTML element to create a variable reference button for the given variable. This can be
//  * used to add a variable reference button to the toolbox.
//  *
//  * @param identifier - The name of the variable, e.g. "x".
//  * @param buttonId - The id of the variable reference button.
//  * @param events - The event stack to add the button's event to.
//  * @param module - The module to add the variable reference button to.
//  * @returns - The button element of the created variable reference button.
//  */
// export function addVariableReferenceButton(
//     identifier: string,
//     buttonId: string,
//     events: EventStack,
//     module: Module
// ): HTMLDivElement {
//     // Create the containing div for the "Defined Variables" section of the toolbox.
//     const container = document.createElement("div");
//     container.classList.add("var-button-container");

//     // Create the div for the identifier and type definitions.
//     const varContainer = document.createElement("div");
//     varContainer.classList.add("var-container-wrapper");
//     // Identifier
//     const button = document.createElement("div");
//     button.classList.add("var-button");
//     button.id = buttonId;

//     varContainer.appendChild(button);

//     // Text for the type of the variable.
//     const typeText = document.createElement("div");
//     typeText.classList.add("var-type-text");
//     varContainer.appendChild(typeText);

//     container.appendChild(varContainer);

//     // Actions button
//     const moreActionsButton = document.createElement("div");
//     moreActionsButton.classList.add("var-more-actions-button");
//     moreActionsButton.innerText = "actions >";
//     container.appendChild(moreActionsButton);

//     // Possible actions for the variable reference button: changing the assignment modifier (e.g =, +=,
//     // -=, etc.) and converting the variable to a different type (e.g. string to number).
//     moreActionsButton.addEventListener("mouseover", () => {
//         const [options, type] = getVarOptions(identifier, buttonId, module);

//         //it is important that these options are regenerated on each mouseover
//         createAndAttachCascadedMenu(moreActionsButton, buttonId, options, module, identifier, type);
//     });

//     button.textContent = identifier;

//     // Insert the identifier into the editor when the button is clicked.
//     button.addEventListener("click", () => {
//         const action = new EventAction(EventType.OnButtonDown, button.id);
//         events.stack.push(action);
//         events.apply(action);
//     });

//     // When a new variable is created, mark the button as (green) glowing for 5 seconds.
//     setTimeout(() => {
//         container.classList.add("glowing");

//         setTimeout(() => {
//             container.classList.remove("glowing");
//         }, 5000);
//     }, 1);

//     document.getElementById("vars-button-grid").appendChild(container);

//     return button;
// }

// /**
//  * Removes a variable reference from the "Defined Variables" section of the toolbox.
//  *
//  * @param buttonId - The id of the variable reference button to remove.
//  */
// export function removeVariableReferenceButton(buttonId: string): void {
//     const button = document.getElementById(buttonId);
//     // Button is the identifer div, var-container-wrapper is the div containing the identifier
//     // and type text (=parent)
//     const parent = button.parentElement;
//     // var-button-container is the div containing the grandparent (a row in the "Defined Variables")
//     document.getElementById("vars-button-grid").removeChild(parent.parentElement);
// }

// /**
//  * Create the cascaded menu div object and its options along with their action handlers.
//  */
// /**
//  * Creates the menu that appears when hovering over the "actions >" button of a variable reference
//  *
//  * @param validActions - The valid actions for the variable reference button; the ways in which the variable can be used.
//  * @param buttonId - The id of the variable reference button.
//  * @param module - The module to add the cascaded menu to.
//  * @param identifier - The name of the variable, e.g. "x".
//  * @param type - The type of the variable, e.g. DataType.Number.
//  * @returns - The created cascaded menu div object.
//  */
// function constructCascadedMenuObj(
//     validActions: Map<string, EditCodeAction>,
//     buttonId: string,
//     module: Module,
//     identifier: string,
//     type: DataType
// ): HTMLDivElement {
//     const context = module.focus.getContext();
//     // The "tooltip"
//     const menu = document.createElement("div");
//     menu.classList.add("cascadedMenuMainDiv");
//     menu.id = `${buttonId}-cascadedMenu`;

//     // "Tooltip" header
//     const header = document.createElement("div");
//     header.classList.add("cascaded-menu-header");
//     header.innerHTML = `<h3>actions with <span class="identifier">${identifier}</span> variable:</h3>`;
//     menu.appendChild(header);

//     setTimeout(() => {
//         menu.style.opacity = "1";
//     }, 1);

//     let id = 0;

//     for (const [key, value] of validActions) {
//         // Action / option
//         const menuItem = document.createElement("div");
//         menuItem.classList.add("cascadedMenuContent");

//         // Text for the action / option
//         const menuText = document.createElement("span");
//         menuText.classList.add("cascadedMenuOptionTooltip");
//         if (value.shortDescription) {
//             menuText.innerHTML =
//                 "> " + value.shortDescription.replace("{VAR_ID}", `<span class="inline-var-id">${identifier}</span>`);
//         }

//         if (value.insertionResult.insertionType === InsertionType.Valid) {
//             menuText.classList.add("valid-option-tooltip");
//         }

//         const code = value.getCode();
//         let returnType = null;

//         if (code instanceof Expression && code.returns != DataType.Void) {
//             returnType = getUserFriendlyType(code.returns);
//         }

//         // Create the clickable button for the action / option
//         value.cssId = `cascadedMenu-button-${id}`;
//         id++;
//         const menuButton = ToolboxButton.createToolboxButtonFromJsonObj(value);

//         menuButton.getButtonElement().classList.add("cascadedMenuItem");
//         menuButton.getButtonElement().innerHTML = menuButton
//             .getButtonElement()
//             .innerHTML.replace(identifier, `<span class="button-id">${identifier}</span>`);
//         value.performAction.bind(value);

//         // Add the option to the editor when clicked
//         menuButton.getButtonElement().addEventListener("click", () => {
//             value.performAction(module.executer, module.eventRouter, context, "defined-variables");

//             menu.remove();
//         });

//         // Update the visual mode of the button (e.g. if it is invalid, it will be disabled)
//         menuButton.divButtonVisualMode(value.insertionResult.insertionType);

//         menuItem.appendChild(menuButton.container);
//         menuItem.appendChild(menuText);

//         menu.appendChild(menuItem);
//     }

//     // Container for the extra options (e.g. converting a string to a number)
//     const extraContainer = document.createElement("div");
//     extraContainer.classList.add("cascaded-menu-extra-container");

//     const createExtraItem = (innerHTML: string) => {
//         const extraItem = document.createElement("div");
//         extraItem.classList.add("cascaded-menu-extra-item");
//         extraItem.innerHTML = innerHTML;

//         return extraItem;
//     };

//     if (type === DataType.String) {
//         // Not always logical to convert a string to a number (e.g. "hello")
//         extraContainer.appendChild(
//             createExtraItem(
//                 `try converting to integer (number) using <span class='code'>int(<span class='inline-var'>${identifier}</span>)</span>`
//             )
//         );

//         menu.appendChild(extraContainer);
//     } else if (type === DataType.Number) {
//         extraContainer.appendChild(
//             createExtraItem(
//                 `convert to string (text) using <span class='code'>str(<span class='inline-var'>${identifier}</span>)</span>`
//             )
//         );

//         menu.appendChild(extraContainer);
//     }

//     return menu;
// }

//creates a cascaded menu dom object with the given options and attaches it to button with id = buttonId.
//also updates its position according to the button it is being attached to.
// /**
//  * Creates the menu and positions it according to the button it is being attached to.
//  *
//  * @param moreActionsButton - The "actions >" button of the variable reference.
//  * @param buttonId - The id of the variable reference button.
//  * @param validActions - The valid actions for the variable reference button; the ways in which the variable can be used.
//  * @param module - The module to add the cascaded menu to.
//  * @param identifier - The name of the variable, e.g. "x".
//  * @param type - The type of the variable, e.g. DataType.Number.
//  */
// function createAndAttachCascadedMenu(
//     moreActionsButton: HTMLDivElement,
//     buttonId: string,
//     validActions: Map<string, EditCodeAction>,
//     module: Module,
//     identifier: string,
//     type: DataType
// ) {
//     const button = document.getElementById(buttonId);

//     if (!document.getElementById(`${buttonId}-cascadedMenu`)) {
//         const menuElement = constructCascadedMenuObj(validActions, buttonId, module, identifier, type);

//         if (menuElement.children.length > 0) {
//             const content = document.createElement("div");
//             content.classList.add("cascadedMenuContent");
//             button.parentElement.appendChild(menuElement);

//             const domMenuElement = document.getElementById(`${buttonId}-cascadedMenu`);
//             const buttonRect = moreActionsButton.getBoundingClientRect();
//             const bodyRect = document.body.getBoundingClientRect();

//             const leftPos = buttonRect.left - bodyRect.left + buttonRect.width;

//             domMenuElement.style.left = `${leftPos + 10}px`;
//             domMenuElement.style.bottom = `${bodyRect.bottom - buttonRect.bottom}px`;

//             // When mouse leaves "actions >" button, remove the menu only if
//             // the mouse is not over the menu or button after 100ms
//             moreActionsButton.addEventListener("mouseleave", () => {
//                 setTimeout(() => {
//                     if (menuElement && !menuElement.matches(":hover") && !moreActionsButton.matches(":hover")) {
//                         menuElement.style.opacity = "0";
//                         setTimeout(() => {
//                             menuElement.remove();
//                         }, 100);
//                     }
//                 }, 150);
//             });

//             // Remove menu when leaving the menu with the mouse
//             menuElement.addEventListener("mouseleave", () => {
//                 if (menuElement && !menuElement.matches(":hover") && !button.matches(":hover")) {
//                     menuElement.style.opacity = "0";

//                     setTimeout(() => {
//                         menuElement.remove();
//                     }, 100);
//                 }
//             });
//         }
//     }
// }

// helper for creating options for a variable's cascaded menu
// /**
//  * Helper for creating options for a variable's cascaded menu.
//  *
//  * @param identifier - The name of the variable, e.g. "x".
//  * @param buttonId - The id of the variable reference button.
//  * @param module - The module to add the cascaded menu to.
//  * @returns - The options for the variable's cascaded menu.
//  */
// function getVarOptions(identifier: string, buttonId: string, module: Module): [Map<string, EditCodeAction>, DataType] {
//     const dataType = module.variableController.getVariableTypeNearLine(
//         module.focus.getFocusedStatement().scope ??
//             (
//                 module.focus.getStatementAtLineNumber(module.editor.monaco.getPosition().lineNumber).rootNode as
//                     | Statement
//                     | Module
//             ).scope,
//         module.editor.monaco.getPosition().lineNumber,
//         identifier,
//         false
//     );
//     const varRef = new VariableReferenceExpr(identifier, dataType, buttonId);
//     return [module.actionFilter.validateVariableOperations(varRef), dataType];
// }

/**
 * Resize the filler dummy for the toolbox when the window is resized.
 */
window.onresize = () => {
    const staticDummySpace = document.getElementById("static-toolbox-dummy-space");

    staticDummySpace.style.minHeight = `${
        staticDummySpace.parentElement.clientHeight -
        staticDummySpace.parentElement.children[staticDummySpace.parentElement.children.length - 2].clientHeight -
        20
    }px`;
};

/**
 * Removes the given class from the given button.
 *
 * @param buttonId - The id of the button to remove the class from.
 * @param className - The class to remove from the button.
 */
function removeClassFromButton(buttonId: string, className: string) {
    const button = document.getElementById(buttonId);

    if (button) {
        button.classList.remove(className);
    }
}

/**
 * Adds the given class to the given button.
 *
 * @param buttonId - The id of the button to add the class to.
 * @param className - The class to add to the button.
 */
function addClassToButton(buttonId: string, className: string) {
    const button = document.getElementById(buttonId);

    if (button) {
        button.classList.add(className);
    }
}

/**
 * Class for creating the step-by-step example sliders in the tooltips.
 */
class UseCaseSliderComponent {
    element: HTMLDivElement;
    sendUsage: () => void;

    constructor(useCase: any, buttonId: string) {
        this.element = this.createUseCaseComponent(
            useCase.path,
            useCase.max,
            useCase.extension,
            useCase.prefix,
            useCase.explanations,
            useCase.title,
            useCase.id,
            buttonId
        );
    }

    /**
     * Create the step-by-step example slider.
     *
     * @param path - The path to the images of the slider.
     * @param max - The maximum number of slides.
     * @param extension - The extension of the images.
     * @param prefix - The prefix of the images.
     * @param explanations - The explanations for the slides.
     * @param title - The title of the slider.
     * @param id - The id of the slider.
     * @param buttonId - The id of the button that opens the slider.
     * @returns - The created step-by-step example slider.
     */
    createUseCaseComponent(
        path: string,
        max: number,
        extension: string,
        prefix: string,
        explanations: any[],
        title: string,
        id: string,
        buttonId: string
    ): HTMLDivElement {
        let useCaseUsed = false;

        // Single usecase
        const useCaseContainer = document.createElement("div");
        useCaseContainer.classList.add("single-use-case-container");

        // Content container for the usecase
        const sliderContainer = document.createElement("div");
        sliderContainer.classList.add("slider-container");
        useCaseContainer.appendChild(sliderContainer);

        // Slider
        const slider = document.createElement("input");
        slider.classList.add("range-slider");
        slider.type = "range";
        slider.min = "1";
        slider.max = max.toString();
        slider.value = "1";

        const labelsContainer = document.createElement("div");
        labelsContainer.classList.add("labels-container");

        const buttonsContainer = document.createElement("div");
        buttonsContainer.classList.add("buttons-container");

        const explanationContainer = document.createElement("div");
        explanationContainer.classList.add("explanation-container");
        explanationContainer.style.visibility = "hidden";

        const updateSlide = () => {
            slideImage.src = slides[parseInt(slider.value) - 1];

            if (explanations) {
                const explanation = explanations.find((exp) => exp.slide == parseInt(slider.value));
                explanationContainer.innerText = explanation ? explanation.text : "&nbsp;";
                explanationContainer.style.visibility = explanation ? "visible" : "hidden";
            }

            if (currentSlide.index != parseInt(slider.value) - 1) {
                // Slide changed
                slideUsage[currentSlide.index].time += Date.now() - currentSlide.startTime;
                slideUsage[currentSlide.index].count++;

                currentSlide.index = parseInt(slider.value) - 1;
                currentSlide.startTime = Date.now();
            }
        };

        // Next button to the right of the slider
        const nextBtn = document.createElement("div");
        nextBtn.classList.add("slider-btn");
        nextBtn.innerText = ">";

        nextBtn.addEventListener("click", () => {
            if (slider.value != max.toString()) {
                useCaseUsed = true;

                slider.value = (parseInt(slider.value) + 1).toString();
                updateSlide();
            }
        });

        // Previous button to the left of the slider
        const prevBtn = document.createElement("div");
        prevBtn.classList.add("slider-btn");
        prevBtn.innerText = "<";
        prevBtn.addEventListener("click", () => {
            if (slider.value != "1") {
                useCaseUsed = true;

                slider.value = (parseInt(slider.value) - 1).toString();
                updateSlide();
            }
        });

        const slides = [];
        const slideUsage = [];

        for (let i = 1; i < max + 1; i++) {
            if (prefix) slides.push(`${path}${prefix}${i}.${extension}`);
            else slides.push(`${path}${i}.${extension}`);

            slideUsage.push({ time: 0, count: 0 });
        }

        let currentSlide = { startTime: Date.now(), index: 0 };

        const slideImage = document.createElement("img");
        sliderContainer.append(slideImage);
        slideImage.classList.add("slider-image");

        slider.oninput = () => {
            useCaseUsed = true;

            updateSlide();
        };

        updateSlide();

        labelsContainer.appendChild(explanationContainer);
        sliderContainer.appendChild(labelsContainer);

        buttonsContainer.appendChild(prevBtn);
        buttonsContainer.append(slider);
        buttonsContainer.appendChild(nextBtn);
        sliderContainer.appendChild(buttonsContainer);

        this.sendUsage = () => {
            if (useCaseUsed) {
                Logger.Instance().queueEvent(
                    new LogEvent(LogType.UseCaseSlideUsage, {
                        "use-case": id,
                        "button-id": buttonId,
                        "slide-usage": slideUsage,
                    })
                );
            }
        };

        explanationContainer.innerText = "step-by-step explanation";
        explanationContainer.style.visibility = "visible";

        return useCaseContainer;
    }

    sentUsage = false;

    onRemove() {
        if (!this.sentUsage) {
            this.sendUsage();

            this.sentUsage = true;
        }
    }
}

/**
 * Class for creating the tooltips for the toolbox buttons.
 */
export class TooltipComponent {
    // Can remove export
    onRemoveCallbacks: Array<() => void> = [];
    element: HTMLDivElement;
    startTime: number;
    sentUsage = false;
    name: string;

    constructor(module: Module, code: EditCodeAction) {
        let codeAction = null;

        for (const x of module.actionFilter.getProcessedConstructInsertions()) {
            if (x.cssId == code.cssId) {
                codeAction = x;

                break;
            }
        }

        const returnType = null; //code.getUserFriendlyReturnType();

        const tooltipContainer = document.createElement("div");
        tooltipContainer.classList.add("tooltip-container");
        document.body.appendChild(tooltipContainer);

        const tooltipTop = document.createElement("div");
        tooltipTop.classList.add("tooltip-top");
        tooltipContainer.appendChild(tooltipTop);

        const tooltipHeader = document.createElement("div");
        tooltipHeader.classList.add("tooltip-header");
        const tooltipText = document.createElement("p");
        tooltipText.classList.add("tooltip-text");

        // The top title and text of the tooltip
        if (code.documentation.tooltip) {
            tooltipHeader.innerHTML = `<h4>${code.documentation.tooltip.title}</h4>`;
            tooltipTop.appendChild(tooltipHeader);
            this.name = code.documentation.tooltip.title.replace(/ /g, "-").toLowerCase();

            tooltipText.innerText = code.documentation.tooltip.body;
            tooltipTop.appendChild(tooltipText);
        }

        // Foldable elements
        if (code.documentation.tips) {
            const useCasesContainer = document.createElement("div");
            useCasesContainer.classList.add("use-cases-container");

            const accordion = new Accordion(`${code.cssId}-toolbox`);
            tooltipContainer.appendChild(accordion.HTMLElement);

            for (const tip of code.documentation.tips) {
                // create a new div with icon + type + title (step-by-step, run example, usage tip)
                // body
                // on click to expand and close others in the same group

                if (tip.type == "use-case") {
                    const useCaseComp = new UseCaseSliderComponent(tip, code.cssId);
                    accordion.addRow(TooltipType.StepByStepExample, tip.title, useCaseComp.element);
                    this.onRemoveCallbacks.push(useCaseComp.sendUsage);
                } else if (tip.type == "quick") {
                    const hintEl = document.createElement("div");
                    hintEl.classList.add("quick-tip");
                    hintEl.innerText = tip.text;

                    accordion.addRow(TooltipType.UsageHint, tip.title ? tip.title : "quick tip", hintEl);
                } else if (tip.type == "executable") {
                    const ex = createExample(tip.example);
                    accordion.addRow(
                        TooltipType.RunnableExample,
                        tip.title ? tip.title : "run this example",
                        ex[0],
                        () => {
                            ex[2].setPosition(new Position(99999, 99999));
                            ex[2].focus();
                        }
                    );

                    docBoxRunButtons.set(tip.id, ex[1]);

                    attachPyodideActions(
                        (() => {
                            const actions = [];

                            for (const buttonId of ex[1]) {
                                actions.push((pyodideController) => {
                                    const button = document.getElementById(buttonId);

                                    button.addEventListener("click", () => {
                                        try {
                                            nova.globals.lastPressedRunButtonId = button.id;

                                            clearConsole(ex[3]);
                                            pyodideController.runPython(codeString(ex[2].getValue()));
                                        } catch (err) {
                                            console.error("Unable to run python code");

                                            addTextToConsole(
                                                runBtnToOutputWindow.get(button.id),
                                                err,
                                                CONSOLE_ERR_TXT_CLASS
                                            );
                                        }
                                    });
                                });
                            }

                            return actions;
                        })(),
                        []
                    );
                }
            }
        }

        if (returnType) {
            const typeText = document.createElement("div");
            typeText.classList.add("return-type-text");
            typeText.innerHTML = `returns <span class="return-type">${returnType}</span>`;

            tooltipTop.appendChild(typeText);
        }

        if (codeAction?.insertionResult?.insertionType === InsertionType.Invalid) {
            const code = codeAction.getCode() as Construct;
            const errorMessage = document.createElement("div");
            errorMessage.classList.add("error-text");

            const tooltip = code.getSimpleInvalidTooltip();

            //TODO: #526 this should be changed when that functionality is updated.
            if (tooltip !== "") {
                errorMessage.innerHTML = tooltip;
            } else {
                // if (code instanceof Modifier) {
                //     errorMessage.innerHTML = "This can only be inserted after a --- ";
                // } else if (code instanceof Expression) {
                //     errorMessage.innerHTML = "This can only be inserted inside a hole with a matching type";
                // } else
                if (code instanceof Statement) {
                    errorMessage.innerHTML = "This can only be inserted at the beginning of a line";
                }
            }

            tooltipTop.appendChild(errorMessage);
        } else if (codeAction?.insertionResult?.insertionType === InsertionType.DraftMode) {
            const warningMessage = document.createElement("div");
            warningMessage.classList.add("warning-text");
            warningMessage.innerHTML = Tooltip.TypeMismatch;

            tooltipTop.appendChild(warningMessage);
        }

        this.element = tooltipContainer;
        this.startTime = Date.now();
    }

    onRemove() {
        if (!this.sentUsage) {
            const duration = Date.now() - this.startTime;

            if (duration > 3000) {
                Logger.Instance().queueEvent(
                    new LogEvent(LogType.TooltipHoverDuration, {
                        duration: Date.now() - this.startTime,
                        name: this.name,
                    })
                );
            }

            this.onRemoveCallbacks.forEach((f) => f());

            this.sentUsage = true;
        }
    }
}
