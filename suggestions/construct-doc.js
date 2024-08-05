import { EDITOR_DOM_ID } from "../language-definition/settings";
/**
 * Class representing a code construct's documentation that can be displayed to the user.
 */
export class ConstructDoc {
    docElementClass = "docParent";
    imgElementClass = "docImageParent";
    bodyElementClass = "docBody";
    titleElementClass = "docTitle";
    images;
    text;
    links;
    title;
    parentElement;
    /**
     * Needs to be commented because we commented out the this.constructDocs in the
     * Util class (util.ts file) which is the class behind "Util.getPopulatedInstance()".
     */
    // static updateDocsLeftOffset(offset: number) {
    //     constructKeys.forEach((key) => {
    //         if (Util.getPopulatedInstance().constructDocs.get(key)) {
    //             Util.getPopulatedInstance().constructDocs.get(key).updateLeftOffset(offset);
    //         }
    //     });
    // }
    constructor(title = "DOC Title", text = "DOC text", images = [], links = []) {
        this.images = images;
        this.text = text;
        this.title = title;
        this.links = links;
        this.parentElement = document.createElement("div");
        this.parentElement.classList.add(this.docElementClass);
        this.buildDoc();
        this.hide();
        this.parentElement.addEventListener("mouseenter", () => {
            this.show();
        });
        this.parentElement.addEventListener("mouseleave", () => {
            this.hide();
        });
    }
    buildDoc() {
        const title = document.createElement("h3");
        title.textContent = this.title;
        title.classList.add(this.titleElementClass);
        const body = document.createElement("div");
        body.classList.add(this.bodyElementClass);
        body.innerHTML = this.text;
        this.parentElement.appendChild(title);
        this.parentElement.appendChild(body);
        if (this.images.length > 0)
            this.addImageSection();
        if (this.links.length > 0)
            this.addLinkSection();
        //TODO: Should be global...
        this.parentElement.style.left = `${document.getElementById(EDITOR_DOM_ID).offsetLeft}px`;
        this.parentElement.style.top = `${parseFloat(window.getComputedStyle(document.getElementById(EDITOR_DOM_ID)).paddingTop)}px`;
        document.getElementById(EDITOR_DOM_ID).appendChild(this.parentElement);
    }
    addImageSection() {
        const imageParent = document.createElement("div");
        imageParent.classList.add(this.imgElementClass);
        this.images.forEach((imgSrc) => {
            const image = document.createElement("img");
            image.classList.add("docImage");
            image.src = imgSrc;
            imageParent.appendChild(image);
        });
        this.parentElement.appendChild(imageParent);
    }
    addLinkSection() {
        const linkParent = document.createElement("div");
        linkParent.classList.add("docLinkParent");
        this.parentElement.appendChild(linkParent);
    }
    show() {
        this.parentElement.style.visibility = "visible";
    }
    hide() {
        this.parentElement.style.visibility = "hidden";
    }
    updateLeftOffset(offset) {
        this.parentElement.style.left = `${offset}px`;
    }
    resetScroll() {
        this.parentElement.scrollTop = 0;
    }
}
//# sourceMappingURL=construct-doc.js.map