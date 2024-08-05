/**
 * CSS classes that can be applied on HTML elemeents representing identifiers, types, keywords,
 * emphasized text, and other text.
 */
export var CSSClasses;
(function (CSSClasses) {
    CSSClasses["identifier"] = "identifier";
    CSSClasses["type"] = "type";
    CSSClasses["keyword"] = "keyword";
    CSSClasses["emphasize"] = "emph";
    CSSClasses["other"] = "other";
})(CSSClasses || (CSSClasses = {}));
/**
 * Style the given content with the given CSS class.
 *
 * @param content - The content to be styled
 * @param styleClass - The CSS class to be applied
 * @returns The HTML string with the content styled with the given CSS class
 */
export function getStyledSpan(content, styleClass) {
    return `<span class=${styleClass}>${content}</span>`;
}
/**
 * Style the given ranges in the content string with the given CSS class.
 *
 * @param content - The entire content string
 * @param styleClass - The CSS class to be applied
 * @param matches - A list of lists in which each sublist contains the start
 * and end index of the substring to be styled with the given CSS class
 * @returns The HTML string with the content styled with the given CSS class
 */
export function getStyledSpanAtSubstrings(content, styleClass, matches) {
    let finalHTML = "";
    const startIndexToLength = [];
    for (const listOfMatches of matches) {
        for (const matchRecord of listOfMatches) {
            startIndexToLength.push([matchRecord[0], matchRecord[1] - matchRecord[0] + 1]);
        }
    }
    for (let i = 0; i < content?.length; i++) {
        if (startIndexToLength.length > 0 && i === startIndexToLength[0][0]) {
            let stringToAdd = "";
            for (let j = i; j < i + startIndexToLength[0][1]; j++) {
                stringToAdd += content[j];
            }
            finalHTML += getStyledSpan(stringToAdd, styleClass);
            i = startIndexToLength[0][0] + startIndexToLength[0][1] - 1;
            startIndexToLength.splice(0, 1);
        }
        else {
            finalHTML += content[i];
        }
    }
    return finalHTML;
}
//# sourceMappingURL=text-enhance.js.map