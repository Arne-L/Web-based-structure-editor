import { Position } from "monaco-editor";
import { EditCodeAction } from "../editor/action-filter";
import { Actions, EditActionType } from "../editor/consts";
import { EditAction } from "../editor/data-types";
import { Editor } from "../editor/editor";
import { EDITOR_DOM_ID } from "../language-definition/settings";
import { Construct, GeneralStatement } from "../syntax-tree/ast";
import { InsertionType } from "../syntax-tree/consts";
import { Module } from "../syntax-tree/module";
import { getStyledSpanAtSubstrings } from "../utilities/text-enhance";
import { ConstructDoc } from "./construct-doc";
import { createFinalConstruct, getHoleValues } from "../utilities/util";

/*
 *A tree menu that can hold options for the user and link through those options to other menus.
 */
class Menu {
    //Menu object
    private isMenuOpen: boolean = false;
    options: MenuOption[] = [];
    editCodeActionsOptions: EditCodeAction[];

    /**
     * Index into this.options of an option that is currently focused and links to another menu.
     */
    openedLinkOptionIndex = -1;

    //tree structure
    children: Menu[] = [];
    parentMenu = null;

    //DOM
    static menuCount = 0;
    static idPrefix = "suggestion-menu-";
    htmlElement: HTMLDivElement;

    private optionsInViewPort;

    constructor(options: Map<string, Function>) {
        this.htmlElement = document.createElement("div");
        this.htmlElement.classList.add(MenuController.menuElementClass);
        this.htmlElement.id = `${Menu.idPrefix}${Menu.menuCount}`;
        document.getElementById(EDITOR_DOM_ID).appendChild(this.htmlElement);

        Menu.menuCount++;

        for (const [key, value] of options) {
            const option = new MenuOption(key, false, null, this, null, value);
            option.attachToParentMenu(this);

            this.options.push(option);
        }

        this.htmlElement.addEventListener("mouseover", () => {
            this.htmlElement.style.visibility = "visible";
        });
    }

    //close any open sub-menus of menu
    // closeChildren() {
    //     const activeChildren = this.children.filter((menu) => menu.isOpen);

    //     if (activeChildren.length > 0) {
    //         activeChildren.forEach((menu) => {
    //             menu.closeChildren();
    //             menu.close();
    //         });
    //     }
    // }

    //indent children of this menu according to their level
    indentChildren(offset: number = 0) {
        if (this.children.length > 0) {
            const adjustment = offset + this.htmlElement.offsetWidth;
            this.children.forEach((child) => {
                child.htmlElement.style.left = `${adjustment}px`;

                if (child.children.length > 0) child.indentChildren(adjustment);
            });
        }
    }

    //Link this menu to a child through optionInParent
    linkMenuThroughOption(child: Menu, optionInParent: string) {
        const option = this.options.filter((option) => option.text === optionInParent)[0];

        if (option.hasChild()) option.setChildMenu(child);
        else {
            option.linkToChildMenu(child);
            option.selectAction = null;
            child.close();

            child.htmlElement.style.left = `${this.htmlElement.offsetWidth + this.htmlElement.offsetLeft}px`;

            this.addChildMenu(child);
        }
    }

    removeChild(child: Menu) {
        const childIndex = this.children.indexOf(child);

        if (childIndex > -1) {
            this.children.splice(childIndex, 1);
            child.removeFromDOM();
            this.removeLink(child);

            return true;
        }

        return false;
    }

    //Remove the option that links this menu to child from this menu and the DOM
    private removeLink(child: Menu) {
        const link = this.options.filter((option) => option.hasChild() && option.getChildMenu() === child)[0];
        this.options.splice(this.options.indexOf(link), 1);
        link.removeFromDOM();
    }

    //An empty option is one that does not link to another menu and also does not have a select action
    private countEmptyOptions() {
        let count = 0;

        this.options.forEach((option) => {
            if (!option.selectAction && !option.hasChild()) count++;
        });

        return count;
    }

    //Removes menu's that only serve as links (have a single option that links to another menu)
    static collapseSingleLinkMenus(root: Menu) {
        //this will collapse a menu that links to a single option as long as it is not the root menu
        if (root.parentMenu && root.options.length == 1 && root.children.length == 1) {
            const child = root.children[0];

            //move the child's options' DOM elements to root
            child.options.forEach((option) => {
                option.attachToParentMenu(root);
                const removedOption = child.htmlElement.removeChild(option.htmlElement);
                root.htmlElement.appendChild(removedOption);
            });

            //update root's children
            root.setChildMenus([...root.children, ...child.children]);
            root.removeChild(child);
            root.indentChildren(root.htmlElement.offsetLeft);

            root.options = child.options;

            //possible that root is a single option menu that links to another
            root = Menu.collapseSingleLinkMenus(root);

            return root;
        }

        //Do this for all nodes
        root.children.forEach((child) => {
            child = Menu.collapseSingleLinkMenus(child);
        });

        return root;
    }

    removeEmptyChildren() {
        if (this.children.length == 0) {
            //root could be a menu with options that had all of their links removed
            if (this.countEmptyOptions() == this.options.length && this.parentMenu) {
                this.parentMenu.removeChild(this);
            }
        }

        //some options might remain, but not link to a menu or have an action associated with them. These need to be removed
        //this is due to the fact that buildAvailableInsertsMenu() does not recursively check the menuMap for empty options
        let optionsToRemove = [];
        this.options.forEach((option) => {
            if (!option.hasChild() && !option.selectAction) {
                optionsToRemove.push(option);
            }
        });
        optionsToRemove.forEach((option) => {
            option.removeFromDOM();
        });
        optionsToRemove = optionsToRemove.map((option) => option.text);

        this.options = this.options.filter((option) => optionsToRemove.indexOf(option.text) == -1);

        this.children.forEach((child) => {
            child.removeEmptyChildren();
        });
    }

    open() {
        this.isMenuOpen = true;
        this.htmlElement.style.visibility = "visible";
    }

    close() {
        this.isMenuOpen = false;
        this.htmlElement.style.visibility = "hidden";

        //if we are closing this menu, the focused option needs to be reset
        this.options.forEach((option) => {
            option.removeFocus();
        });
    }

    isOpen() {
        return this.isMenuOpen;
    }

    //for bulk setting children
    setChildMenus(menus: Menu[]) {
        menus.forEach(
            ((menu) => {
                menu.parentMenu = this;
            }).bind(this)
        );

        this.children = menus;
    }

    addChildMenu(menu: Menu) {
        menu.parentMenu = this;
        this.children.push(menu);
    }

    removeFromDOM() {
        document.getElementById(EDITOR_DOM_ID).removeChild(this.htmlElement);
    }

    getOptionByText(optionText: string) {
        return this.options.filter((option) => option.text == optionText)[0];
    }

    setOptionsInViewport(n: number) {
        this.optionsInViewPort = n;
    }

    getOptionsInViewport() {
        return this.optionsInViewPort;
    }

    /**
     * This should only be called on menus with > 0 options. Otherwise it will have no effect.
     */
    updateDimensions() {
        if (this.options.length > 0) {
            const optionHeight = this.options[0].htmlElement.offsetHeight;
            const totalOptionHeight = optionHeight * this.options.length;
            const vh = window.innerHeight;

            if (totalOptionHeight <= 0.3 * vh) {
                this.optionsInViewPort = this.options.length;
                this.htmlElement.style.height = `${totalOptionHeight}px`;
            } else {
                this.optionsInViewPort = Math.floor((0.3 * vh) / optionHeight);
                this.htmlElement.style.height = `${this.optionsInViewPort * optionHeight}px`;
            }
        }
    }

    /**
     * Add the option as a child to the menu
     *
     * @param option - The option to insert into the menu.
     */
    insertOption(option: MenuOption) {
        option.attachToParentMenu(this);
        this.options.push(option);
    }

    /**
     * Get all EditCodeActions that match the given user input.
     *
     * @param userInput - The user's input.
     * @returns EditCodeActions matching the given user input
     */
    getPossibleEditCodeActions(userInput: string): EditCodeAction[] {
        const lowUserInput = userInput.toLowerCase();

        // Get all EditCodeActions that match the user input, either based on the exact string or the regex
        const actionsToKeep = this.editCodeActionsOptions.filter((editAction) => {
            if (editAction.matchString) {
                const actionLowerCase = editAction.matchString.toLowerCase();
                return actionLowerCase.includes(lowUserInput) || lowUserInput.includes(actionLowerCase);
            } else if (editAction.matchRegex) {
                return editAction.matchRegex.test(userInput);
            } else {
                console.warn(`No matchString or matchRegex found for action ${editAction.optionName}!`);
                return false;
            }
        });

        // Sorting of autocomplete options (OPTIMISATATIONS POSSIBLE)
        function sortActions(a: EditCodeAction, b: EditCodeAction) {
            // Prefer exact string matches over regex matches
            if (a.matchString && b.matchRegex) return -1;
            if (a.matchRegex && b.matchString) return 1;

            // Get the final rendered text, as a string, for both options
            const aText = a.getConstructText(userInput).toLowerCase(),
                bText = b.getConstructText(userInput).toLowerCase();
            // Get the position of the current text in both options, as well as the
            // difference in length between the current text and both options
            const aStart = aText.indexOf(lowUserInput),
                bStart = bText.indexOf(lowUserInput),
                aDiff = aText.length - userInput.length,
                bDiff = bText.length - userInput.length;

            // Give preference to the option that has the current text the closest
            // to the front
            if (aStart - bStart !== 0) return aStart - bStart;

            // Give preference to the option that differs the least from the current
            // text in terms of length
            return aDiff - bDiff;
        }

        // Use the above defined function to sort the options in the autocomplete menu
        actionsToKeep.sort(sortActions);

        return actionsToKeep;
    }
}

/**
 * An option within a menu that can link to another menu or perform an action when selected.
 */
class MenuOption {
    //menu this option links to
    private childMenu: Menu;
    //menu this option is a part of
    parentMenu: Menu;

    text: string;
    doc: ConstructDoc;
    htmlElement: HTMLDivElement;
    draftMode: boolean;

    //action performed when this option is selected, null if this option links to another menu
    selectAction: Function;

    constructor(
        text: string = "Option Text",
        useInnerHTML: boolean = false,
        childMenu?: Menu,
        parentMenu?: Menu,
        doc?: ConstructDoc,
        selectAction?: Function,
        extraInformation?: string,
        draftMode: boolean = false
    ) {
        this.text = text;
        this.childMenu = childMenu;
        this.parentMenu = parentMenu;
        this.doc = doc;
        this.selectAction = selectAction;

        this.htmlElement = document.createElement("div");
        this.htmlElement.classList.add(MenuController.optionElementClass);

        this.draftMode = draftMode;

        if (draftMode) this.htmlElement.classList.add(MenuController.draftModeOptionElementClass);

        let textNode;

        text = text.replace(/---/g, "<hole1></hole1>");
        text = text.replace(/--/g, "<hole2></hole2>");

        if (useInnerHTML) {
            textNode = document.createElement("div");
            textNode.innerHTML = text;
        } else {
            textNode = document.createElement("span");
            textNode.textContent = text;
        }

        textNode.classList.add(MenuController.optionTextElementClass);
        this.htmlElement.appendChild(textNode);

        if (extraInformation) {
            let extra = document.createElement("div");
            extra.innerHTML = extraInformation;
            extra.classList.add(MenuController.suggestionOptionExtraInfo);

            this.htmlElement.appendChild(extra);
        }

        this.addArrowImg();

        this.htmlElement.addEventListener("click", () => {
            this.select();
            MenuController.getInstance().removeMenus();
        });

        parentMenu.htmlElement.appendChild(this.htmlElement);
    }

    private addArrowImg() {
        if (this.childMenu) {
            const image = document.createElement("img");
            image.src = "./src/res/img/optionArrow.png";
            image.classList.add("optionArrowImage");
            this.htmlElement.appendChild(image);
        }
    }

    select() {
        if (this.childMenu) this.childMenu.open(); // TODO: No child menu's anymore?
        else if (this.selectAction) this.selectAction();
    }

    linkToChildMenu(child: Menu) {
        this.childMenu = child;

        this.htmlElement.addEventListener("mouseenter", () => {
            this.childMenu.parentMenu.openedLinkOptionIndex = this.childMenu.parentMenu.options.indexOf(this);
            this.childMenu.open();
        });

        this.addArrowImg();
    }

    attachToParentMenu(menu: Menu) {
        this.parentMenu = menu;
    }

    hasChild() {
        return this.childMenu ? true : false;
    }

    getChildMenu() {
        return this.childMenu;
    }

    //highlights this option when it is focused on in the menu and opens its child menu if it has one
    setFocus() {
        this.htmlElement.classList.add(MenuController.selectedOptionElementClass);

        if (this.childMenu) {
            this.childMenu.open();
            this.childMenu.htmlElement.style.top = `${
                this.htmlElement.offsetTop +
                this.parentMenu.htmlElement.offsetTop -
                this.parentMenu.htmlElement.scrollTop
            }px`;
        } else if (this.doc) {
            this.doc.resetScroll();
            this.doc.show();
        }
    }

    //removes highlight from option when focused off and closes any child menus that were open
    removeFocus() {
        this.htmlElement.classList.remove(MenuController.selectedOptionElementClass);

        // if (this.childMenu) this.parentMenu.closeChildren();
        // else
        if(this.doc) this.doc.hide();
    }

    removeFromDOM() {
        this.parentMenu.htmlElement.removeChild(this.htmlElement);
    }

    setChildMenu(child: Menu) {
        this.childMenu = child;
    }
}

/**
 * Singleton controlling menu generation and removal as well as navigation through a menu
 */
export class MenuController {
    private static instance: MenuController;
    private topOptionIndex: number = 0;
    private bottomOptionIndex: number = 0;

    static suggestionOptionExtraInfo: string = "suggestionOptionExtraInfo";
    static optionElementClass: string = "suggestionOptionParent";
    static draftModeOptionElementClass: string = "draftModeOptionElementClass";
    static menuElementClass: string = "suggestionMenuParent";
    static optionTextElementClass: string = "suggestionOptionText";
    static selectedOptionElementClass: string = "selectedSuggestionOptionParent";

    private oldScrollOffset: number = 0;

    module: Module;
    editor: Editor;
    indexOfRootMenu: number = -1;

    focusedMenuIndex: number = 0;
    focusedOptionIndex: number = -1;

    menus: Menu[] = [];

    private constructor() {}

    static getInstance() {
        if (!MenuController.instance) MenuController.instance = new MenuController();

        return MenuController.instance;
    }

    setInstance(module: Module, editor: Editor) {
        this.module = module;
        this.editor = editor;
    }

    /**
     * Build a single-node menu that contains all options provided by suggestions.
     *
     * @param suggestions An array of options this menu will have.
     *
     * @param pos         Starting top-left corner of this menu in the editor.
     */
    buildSingleLevelMenu(suggestions: EditCodeAction[], pos: any = { left: 0, top: 0 }) {
        if (this.menus.length > 0) this.removeMenus();
        else if (suggestions.length >= 0) {
            //TODO: Very hacky way of fixing #569
            // CAN THIS BE REMOVED? SEEMS TO WORK PERFECTLY FINE WITHOUT IT, even when checking against https://github.com/MajeedKazemi/code-struct/issues/569
            //The issue is that the "no options" option is only added to the menu during the call to updateOptions
            //if there is an attempt to create a menu that would have no options, the menu was simply not allowed to be created which is why the "no options" option was not visible any longer
            // if (suggestions.length === 0) {
            //     suggestions.push(Actions.instance().actionsList[0]); //this does not have to be this specific action, just need one to create the option so that the menu is created and then we immediately delete the option
            // }

            const menu = this.module.menuController.buildMenu(suggestions, pos);

            //TODO: Continuation of very hacky way of fixing #569
            // CAN THIS BE REMOVED?
            // if (suggestions.length === 0) {
            //     menu.options[0].removeFromDOM();
            //     menu.options = [];
            //     const option = new MenuOption("No suitable options found.", false, null, menu, null, () => {});
            //     menu.insertOption(option);
            //     this.focusedOptionIndex = 0;
            // }

            menu.updateDimensions();
            menu.open();
            this.indexOfRootMenu = 0;
            this.focusedOptionIndex = 0;
            this.bottomOptionIndex = menu.getOptionsInViewport() - 1;
            menu.editCodeActionsOptions = suggestions;
            this.focusOption(menu.options[this.focusedOptionIndex]);
        }
    }

    /**
     * Calculate how good the current input text matches the given matchString.
     *
     * @param text - The current input text.
     * @param matchString - The string to match against, inherent to a given CodeConstruct.
     * @returns - A string representing the precision of the match. 1 is a perfect match, 0 is no match.
     */
    private calculateAutocompleteMatchPrecision(text: string, matchString: string): string {
        if (matchString && text) {
            let matchCount = 0;

            for (let i = 0; i < text.length; i++) {
                if (text[i] === matchString[i]) matchCount++;
            }

            // because the terminating char will never be hit here in the suggestion menu click
            // (otherwise it would've been matched by the autocomplete)
            return (matchCount / (matchString.length + 1)).toFixed(2);
        } else return "1";
    }

    /**
     * Helper for building a menu and assigning its options. Does not specify the tree structure. Simply constructs a Menu object.
     *
     * @param options the menu's options.
     * @param pos     Initial top-left corner of the menu.
     *
     * @returns the constructed menu. Null if no options was empty.
     */
    private buildMenu(options: EditCodeAction[], pos: any = { left: 0, top: 0 }): Menu {
        if (options.length > 0) {
            const menuOptions = new Map<string, Function>();

            for (const action of options) {
                menuOptions.set(action.optionName, () => {
                    action.performAction(
                        this.module.executer,
                        this.module.eventRouter,
                        this.module.focus.getContext(),
                        { type: "autocomplete-menu", precision: "0", length: action.matchString.length + 1 },
                        {}
                    );
                });
            }

            const menu = new Menu(menuOptions);

            //TODO: These are the same values as the ones used for mouse offset by the messages so maybe make them shared in some util file
            menu.htmlElement.style.left = `${pos.left + document.getElementById(EDITOR_DOM_ID).offsetLeft}px`;
            menu.htmlElement.style.top = `${
                pos.top + parseFloat(window.getComputedStyle(document.getElementById(EDITOR_DOM_ID)).paddingTop)
            }px`;

            //TODO: No good way of separating responsibility completely because ready doc objects are stored in util instead of being created here.
            //I guess, it is always possible to have a list of active docs and loop through it here and update their positions instead of
            //using the static method to update them all. Do that in case this ever slows down anything.
            // ConstructDoc.updateDocsLeftOffset(
            //     document.getElementById(EDITOR_DOM_ID).offsetLeft +
            //         document.getElementById(`${Menu.idPrefix}${Menu.menuCount - 1}`).offsetWidth
            // );
            /**
             * Currently never being used? So comment for now, maybe we can use it in the future?
             */

            this.menus.push(menu);

            return menu;
        }

        return null;
    }

    /**
     * Clear all current menus
     */
    removeMenus() {
        this.menus.forEach((menu) => {
            menu.close();
            menu.removeFromDOM();
        });

        this.menus = [];
        this.focusedMenuIndex = 0;
        this.focusedOptionIndex = 0;
    }

    //Removes focus from currently focused option and sets it to the option below it.
    focusOptionBelow() {
        const options = this.menus[this.focusedMenuIndex].options;
        const optionDomElements = this.menus[this.focusedMenuIndex].htmlElement.getElementsByClassName(
            MenuController.optionElementClass
        );

        //Updates
        options[this.focusedOptionIndex].removeFocus();
        this.focusedOptionIndex++;

        if (this.focusedOptionIndex == optionDomElements.length) {
            this.focusedOptionIndex = 0;
        }

        if (this.focusedOptionIndex == 0) {
            this.menus[this.focusedMenuIndex].htmlElement.scrollTop = 0;
            this.topOptionIndex = 0;
            this.bottomOptionIndex = this.menus[this.focusedMenuIndex].getOptionsInViewport() - 1;
        } else if (this.focusedOptionIndex > this.bottomOptionIndex) {
            this.topOptionIndex++;
            this.bottomOptionIndex++;
            this.menus[this.focusedMenuIndex].htmlElement.scrollTop += (
                optionDomElements[0] as HTMLDivElement
            ).offsetHeight;
        }

        options[this.focusedOptionIndex].setFocus();

        //Open sub-menu if there is one
        if (options[this.focusedOptionIndex].hasChild()) {
            this.menus[this.focusedMenuIndex].openedLinkOptionIndex = this.focusedOptionIndex;
        }
    }

    //Removes focus from currently focused option and sets it to the option above it.
    focusOptionAbove() {
        const options = this.menus[this.focusedMenuIndex].options;
        const optionDomElements = this.menus[this.focusedMenuIndex].htmlElement.getElementsByClassName(
            MenuController.optionElementClass
        );

        //Updates
        options[this.focusedOptionIndex].removeFocus();
        this.focusedOptionIndex--;

        if (this.focusedOptionIndex < 0) this.focusedOptionIndex = options.length - 1;

        if (this.focusedOptionIndex == options.length - 1) {
            this.menus[this.focusedMenuIndex].htmlElement.scrollTop =
                (optionDomElements[0] as HTMLDivElement).offsetHeight * options.length;
            this.topOptionIndex = options.length - this.menus[this.focusedMenuIndex].getOptionsInViewport();
            this.bottomOptionIndex = options.length - 1;
        } else if (this.focusedOptionIndex < this.topOptionIndex) {
            this.topOptionIndex--;
            this.bottomOptionIndex--;
            this.menus[this.focusedMenuIndex].htmlElement.scrollTop -= (
                optionDomElements[0] as HTMLDivElement
            ).offsetHeight;
        }

        options[this.focusedOptionIndex].setFocus();

        //Open sub-menu if there is one
        if (options[this.focusedOptionIndex].hasChild()) {
            this.menus[this.focusedMenuIndex].openedLinkOptionIndex = this.focusedOptionIndex;
        }
    }

    //Tracks the focused option for mouse interactions. Keys use focusOptionBelow(), focusOptionAbove(), openSubMenu() and closeSubMenu()
    focusOption(option: MenuOption) {
        //remove focus from any other options that may be focused within the currently focused menu
        if (this.focusedOptionIndex > -1 && this.focusedMenuIndex == this.menus.indexOf(option.parentMenu)) {
            this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].removeFocus();
        }

        //update focus
        this.focusedMenuIndex = this.menus.indexOf(option.parentMenu);
        this.focusedOptionIndex = this.menus[this.focusedMenuIndex].options.indexOf(option);

        //if user navigated from child, need to clear options in newly focused menu as well
        this.menus[this.focusedMenuIndex].options.forEach((option) => {
            option.removeFocus();
        });

        this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].setFocus();
    }

    //Open the menu, if any, that the currently focused option links to.
    openSubMenu() {
        if (this.focusedOptionIndex > -1) {
            const newFocusedMenu = this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].getChildMenu();

            this.menus[this.focusedMenuIndex].openedLinkOptionIndex = this.focusedOptionIndex;

            if (newFocusedMenu) {
                this.selectFocusedOption();

                this.focusedMenuIndex = this.menus.indexOf(newFocusedMenu);
                this.focusedOptionIndex = 0; //TODO: If we ever go back to nested menus then this.topOptionIndex and this.bottomOptionIndex need to be updated here.
                this.focusOption(this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex]);
            }
        }
    }

    //Close any open sub-menus when navigating up in the menu from the currently focused option.
    // closeSubMenu() {
    //     if (this.menus[this.focusedMenuIndex].parentMenu) {
    //         this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].removeFocus();
    //         this.focusedMenuIndex = this.menus.indexOf(this.menus[this.focusedMenuIndex].parentMenu);
    //         this.focusedOptionIndex = this.menus[this.focusedMenuIndex].openedLinkOptionIndex; //TODO: If we ever go back to nested menus then this.topOptionIndex and this.bottomOptionIndex need to be updated here.
    //         this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].setFocus();
    //         this.menus[this.focusedMenuIndex].closeChildren();
    //     }
    // }

    //Perform the action associated with the currently focused option.
    selectFocusedOption() {
        if (this.focusedOptionIndex > -1) {
            this.menus[this.focusedMenuIndex].options[this.focusedOptionIndex].select();
        }
    }

    isMenuOpen() {
        return this.menus.length > 0 ? this.menus[this.indexOfRootMenu].isOpen() : false;
    }

    updateMenuArrayFromTree(root: Menu, isRoot: boolean) {
        if (isRoot) {
            this.indexOfRootMenu = 0;
            this.menus = [];
            this.focusedOptionIndex = 0; //TODO: If we ever go back to nested menus then this.topOptionIndex and this.bottomOptionIndex need to be updated here.
            this.focusedMenuIndex = 0;
        }

        this.menus.push(root);

        root.children.forEach((child) => {
            this.updateMenuArrayFromTree(child, false);
        });
    }

    /**
     * Recreate the options in the menu and set the correct focused option
     */
    styleMenuOptions() {
        if (this.isMenuOpen()) {
            // Menu is open

            // Get current menu ... but there should always be only one menu
            const menu = this.menus[this.focusedMenuIndex];

            // All actions
            let actionsToKeep = menu.editCodeActionsOptions;

            //------RECREATE OPTIONS------
            let focusedOptionText = "";
            if (this.focusedOptionIndex > -1) {
                focusedOptionText = menu.options[this.focusedOptionIndex].text;
            }

            //clear old options since some of them might not be valid anymore
            menu.options.forEach((option) => {
                option.removeFromDOM();
            });
            menu.options = [];

            for (const action of actionsToKeep) {
                // Create an menu option for each action
                let option = new MenuOption(
                    action.optionName,
                    true,
                    null,
                    menu,
                    null,
                    () => {
                        action.performAction(
                            this.module.executer,
                            this.module.eventRouter,
                            this.module.focus.getContext(),
                            "autocomplete-menu",
                            {}
                        );
                    },
                    null,
                    action.insertionResult.insertionType == InsertionType.DraftMode
                );

                // Add option to menu
                menu.insertOption(option);

                // Set the current focused index and give the option a special style
                if (option.text === focusedOptionText) {
                    this.focusedOptionIndex = menu.options.length - 1;
                    option.htmlElement.classList.add(MenuController.selectedOptionElementClass);
                } else {
                    this.focusedOptionIndex = 0;
                }
            }

            //------UPDATE FOCUSED OPTION------
            if (menu.options.length == 0) {
                const option = new MenuOption("No suitable options found.", false, null, menu, null, () => {});
                menu.insertOption(option);
                this.focusedOptionIndex = 0;
            } else if (this.focusedOptionIndex < menu.options.length) {
                this.focusOption(menu.options[this.focusedOptionIndex]);
            } else {
                console.error("suggestion-controller: this.focusedOptionIndex >= menu.options.length");
            }
        }
    }

    /**
     * Update the options of the currently focused menu based on the user's input.
     *
     * @param optionText - The user's input.
     */
    updateMenuOptions(optionText: string) {
        // If menu is not open, return
        if (!this.isMenuOpen()) return;

        // Select the current menu (focusedMenuIndex should always be zero)
        const menu = this.menus[this.focusedMenuIndex];

        //------FILTER------
        const menuOptions = menu.getPossibleEditCodeActions(optionText);

        //------RECREATE OPTIONS------
        // Clear old options since some of them might not be valid anymore
        menu.options.forEach((option) => {
            option.removeFromDOM();
        });
        menu.options = [];

        for (const editAction of menuOptions) {
            let substringMatchRanges = []; // DO WE STILL WANT THIS?

            // Get the user input aware final construct
            const code = editAction.getConstruct(optionText);

            // If the current input is a reserved keyword, skip this option if it contains an identifier
            if (code.containsAssignments() && this.module.language.isReservedWord(optionText)) continue;

            // Create the HTML string for the option name
            const optionDisplayText = getStyledSpanAtSubstrings(
                editAction.getDisplayText(optionText), //code.getRenderText(),
                "matchingText",
                substringMatchRanges
            );

            // Create new option from above info
            let option: MenuOption;
            let extraInfo = null;

            // If at the end of the matchString or matchRegex, show that the terminating character
            // can be used to insert the option
            if (
                (editAction.matchRegex || editAction.matchString === optionText) &&
                editAction.terminatingChars.length > 0
            ) {
                extraInfo = `press <span class="highlighted-text">${this.convertTerminatingChar(
                    editAction.terminatingChars[0]
                )}</span> to insert`;
            } else {
                extraInfo = `press <span class="highlighted-text">Enter</span> to insert`;
            }

            option = new MenuOption(
                optionDisplayText,
                true,
                null,
                menu,
                null,
                () => {
                    editAction.performAction(
                        this.module.executer,
                        this.module.eventRouter,
                        this.module.focus.getContext(),
                        {
                            type: "autocomplete-menu",
                            precision: this.calculateAutocompleteMatchPrecision(optionText, editAction.matchString),
                            length: editAction.matchRegex ? optionText.length + 1 : editAction.matchString.length + 1,
                        },
                        {
                            // Capture all the groups for regex (sub)constructs that appear in the construct so that
                            // they can be used in the autocomplete
                            values: editAction.matchRegex ? editAction.matchRegex.exec(optionText) : [],
                        }
                    );
                },
                extraInfo,
                editAction.insertionResult.insertionType == InsertionType.DraftMode
            );

            menu.insertOption(option);
        }

        //focus top option if one exists
        this.focusedOptionIndex = 0;
        this.topOptionIndex = 0;
        this.bottomOptionIndex = menu.getOptionsInViewport() > 0 ? menu.getOptionsInViewport() - 1 : 0;

        //------UPDATE FOCUSED OPTION------
        if (menu.options.length === 0) {
            const option = new MenuOption("No suitable options found.", false, null, menu, null, () => {});
            menu.insertOption(option);
            this.focusedOptionIndex = 0;
        } else if (this.focusedOptionIndex < menu.options.length) {
            this.focusOption(menu.options[this.focusedOptionIndex]);
        } else {
            console.error("suggestion-controller: this.focusedOptionIndex >= menu.options.length");
        }
    }

    /**
     * Set the current menu at the given position.
     *
     * @param pos - The position to place the menu at.
     */
    updatePosition(pos: { left: number; top: number }) {
        const element = this.menus[this.focusedMenuIndex]?.htmlElement;

        if (element) {
            element.style.left = `${pos.left}px`;
            element.style.top = `${pos.top}px`;
        }
    }

    getNewMenuPositionFromPosition(position: Position): { left: number; top: number } {
        const pos = { left: 0, top: 0 };
        pos.left =
            document.getElementById(EDITOR_DOM_ID).offsetLeft +
            (
                document
                    .getElementById(EDITOR_DOM_ID)
                    .getElementsByClassName("monaco-editor no-user-select  showUnused showDeprecated vs")[0]
                    .getElementsByClassName("overflow-guard")[0]
                    .getElementsByClassName("margin")[0] as HTMLElement
            ).offsetWidth +
            (this.module.editor.computeCharWidth() ? position.column * this.module.editor.computeCharWidth() : 0);

        pos.top =
            this.module.editor.monaco.getSelection().startLineNumber * this.module.editor.computeCharHeight() +
            document.getElementById(EDITOR_DOM_ID).offsetTop;

        return pos;
    }

    getNewMenuPositionFromCode(code: Construct): { left: number; top: number } {
        const pos = { left: 0, top: 0 };
        pos.left =
            document.getElementById(EDITOR_DOM_ID).offsetLeft +
            (
                document
                    .getElementById(EDITOR_DOM_ID)
                    .getElementsByClassName("monaco-editor no-user-select  showUnused showDeprecated vs")[0]
                    .getElementsByClassName("overflow-guard")[0]
                    .getElementsByClassName("margin")[0] as HTMLElement
            ).offsetWidth +
            (this.module.editor.computeCharWidth()
                ? code.getRenderText().length * this.module.editor.computeCharWidth()
                : 0);

        pos.top =
            this.module.editor.monaco.getSelection().startLineNumber * this.module.editor.computeCharHeight() +
            document.getElementById(EDITOR_DOM_ID).offsetTop -
            this.module.editor.scrollOffsetTop;

        return pos;
    }

    updateFocusedMenuScroll(scrollOffset: number) {
        if (this.isMenuOpen()) {
            this.menus[this.focusedMenuIndex].htmlElement.style.top = `${
                this.menus[this.focusedMenuIndex].htmlElement.offsetTop + (this.oldScrollOffset - scrollOffset)
            }px`;
        }

        this.oldScrollOffset = scrollOffset;
    }

    hasNoSuggestions(): boolean {
        return (
            this.menus[this.focusedMenuIndex].options.length == 1 &&
            this.menus[this.focusedMenuIndex].options[0].text == "No suitable options found."
        );
    }

    private convertTerminatingChar(text: string): string {
        if (text == " ") return "space";
        else return text;
    }
}
