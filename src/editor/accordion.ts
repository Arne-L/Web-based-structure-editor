import { DOMManupulation } from "../utilities/util";
import { LogEvent, Logger, LogType } from "./../logger/analytics";

// SVG icons for the tooltips
const playIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" fill="white" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const lightBulbIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" /></svg>`;
const zapIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="16" fill="white" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`;
const chevronUpIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
const chevronDownIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const chevronRightIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

// /**
//  * Describes the three variants of tooltips
//  */
// export enum TooltipType {
//     StepByStepExample = "step-by-step-example",
//     UsageHint = "usage-hint",
//     RunnableExample = "runnable-example",
// }

/**
 * Describes the three variants of tooltips
 */
export class TooltipType {
    static StepByStepExample = new TooltipType("step-by-step-example", "learn", zapIconSVG, "bg-learn");
    static UsageHint = new TooltipType("usage-hint", "hint", lightBulbIconSVG, "bg-hint");
    static RunnableExample = new TooltipType("runnable-example", "try", playIconSVG, "bg-try");
    
    private constructor(private readonly type: string, public readonly text: string, public readonly icon: string, public readonly typeClass: string) { }
    
    toString() {
        return this.type;
    }
}

/**
 * Represents a row in the accordion
 */
export class AccordionRow {
    /**
     * The accordion this row belongs to
     */
    private accordion: Accordion;
    /**
     * Whether the row is currently expanded or not
     */
    private isOpen: boolean = false;
    /**
     * The chevron element that indicates whether the row is expanded or not
     */
    private chevronElement: HTMLElement;
    /**
     * The content container that holds the content of the row
     */
    private contentContainer: HTMLDivElement;
    /**
     * The HTML element of the row
     */
    element: HTMLDivElement;
    id: string;
    usageTime: number = 0;
    /**
     * The type of the tooltip according to {@link TooltipType}
     */
    type: TooltipType;

    /**
     * Construct a new row in the accordion
     * 
     * @param accordion - The accordion this row belongs to
     * @param id - The id of the row
     * @param type - The type of the tooltip according to {@link TooltipType} (e.g. "hint", "try" and "learn")
     * @param title - The title of the tooltip
     * @param content - The content of the tooltip
     * @param onClick - The function to be called when the row is clicked
     */
    constructor(
        accordion: Accordion,
        id: string,
        type: TooltipType,
        title: string,
        content: HTMLDivElement,
        onClick: () => void = () => {}
    ) {
        this.type = type;
        this.id = id;
        this.accordion = accordion;

        // Construct the HTML for this row
        this.constructHTML(title, content, type, onClick)
    }

    /**
     * Open the row
     */
    open() {
        this.contentContainer.style.maxHeight = this.contentContainer.scrollHeight + "px";

        setTimeout(() => {
            this.contentContainer.style.maxHeight = "1000px";
        }, 350);

        this.chevronElement.innerHTML = chevronUpIconSVG;

        this.accordion.closeAllRows(this)

        this.isOpen = true;
    }

    /**
     * Close the row
     */
    close() {
        this.contentContainer.style.maxHeight = "0px";
        this.chevronElement.innerHTML = chevronDownIconSVG;

        this.isOpen = false;
    }

    /**
     * Construct the HTML for this row
     * 
     * @param title - The title of the tooltip
     * @param content - The content of the tooltip
     * @param type - The type of the tooltip according to {@link TooltipType} (e.g. "hint", "try" and "learn")
     * @param onClick - The function to be called when the row is clicked
     */
    private constructHTML(title: string, content: HTMLDivElement, type: TooltipType, onClick: () => void = () => {}) {
        this.contentContainer = DOMManupulation.createElement(
            "div",
            "content-container",
            { "max-height": "0px" },
            undefined,
            undefined,
            [content]
        );

        // The tooltip icon in the bar
        const icon = DOMManupulation.createElement("i", "row-icon", undefined, type.icon);

        // The type of the tooltip (e.g. "hint", "try" and "learn") in the bar
        const typeElement = DOMManupulation.createElement("span", "row-type", undefined, type.text);

        // The title of the tooltip in the bar
        const titleElement = DOMManupulation.createElement("span", "row-title", undefined, title);

        // The type of the tooltip (e.g. "hint", "try" and learn) together with the icon in the bar
        const typeContainer = DOMManupulation.createElement(
            "div",
            ["type-container", type.typeClass],
            undefined,
            undefined,
            undefined,
            [icon, typeElement]
        );

        // Text container with type (e.g. "hint") and title in a bar
        const textContainer = DOMManupulation.createElement("div", "text-container", undefined, undefined, undefined, [
            typeContainer,
            titleElement,
        ]);

        // The chevron icon that indicates whether the row is expanded or not
        this.chevronElement = DOMManupulation.createElement(
            "i",
            "expand-collapse-button",
            undefined,
            chevronDownIconSVG
        );

        // Header bar with chevron icon
        const headerContainer = DOMManupulation.createElement(
            "div",
            "header-container",
            undefined,
            undefined,
            undefined,
            [textContainer, this.chevronElement]
        );

        headerContainer.addEventListener("click", () => {
            if (this.isOpen) {
                this.close();
            } else {
                this.open();
                onClick();
            }
        });

        // Create wrapper HTML element for an entire row
        this.element = DOMManupulation.createElement("div", "accordion-row", undefined, undefined, undefined, [
            headerContainer,
            this.contentContainer,
        ]);
    }
}

/**
 * Class representing an accordion
 */
export class Accordion {
    private rows: AccordionRow[] = [];
    private id: string;
    /**
     * The HTML element representing the accordion
     */
    private container: HTMLDivElement;

    constructor(id: string) {
        this.id = id;
        this.container = DOMManupulation.createElement("div", "accordion-group-container");
    }

    /**
     * Get the HTML element representing the accordion
     */
    get HTMLElement() {
        return this.container;
    }

    /**
     * Close all rows, except the one given as an exception (if any)
     * 
     * @param except - If given, this row will not be closed
     */
    closeAllRows(except?: AccordionRow) {
        for (const row of this.rows) {
            if (row !== except) {
                row.close();
            }
        };
    }

    /**
     * Add a new row to the accordion
     * 
     * @param type - The type of the tooltip according to {@link TooltipType} (e.g. "hint", "try" and "learn")
     * @param title - The title of the tooltip
     * @param content - The content of the tooltip
     * @param onClick - The function to be called when the row is clicked
     */
    addRow(type: TooltipType, title: string, content: HTMLDivElement, onClick: () => void = () => {}) {
        const id = this.id + "-" + this.rows.length;
        const row = new AccordionRow(this, id, type, title, content, onClick);
        this.rows.push(row);
        this.container.appendChild(row.element);
    }
}
