import { Statement } from "./ast";
import { CallbackType } from "./callback";
import { Module } from "./module";
/**
 * Updates the linenumber of all statements in the body of the given bodyContainer, starting
 * from the given index in the body and the given linenumber.
 *
 * @param bodyContainer - The statement or module in whose body the statements will be updated
 * @param fromIndex - The index in the body of the bodyContainer from which the statements will be updated;
 * index 0 being the bodyContainer itself and the first statement in the body
 * @param startLineNumber - The to start from at the given index
 */
export function rebuildBody(bodyContainer, fromIndex, startLineNumber) {
    let lineNumber = startLineNumber;
    for (let i = fromIndex; i < bodyContainer.body.length; i++) {
        // Set the "indexInRoot" field of the childstatement
        bodyContainer.body[i].indexInRoot = i;
        // Set the given lineNumber as the lineNumber of the bodycontainer, aka the current
        // Module | Statement, if the fromIndex is 0 and the bodyContainer is a Statement (module
        // does not have a lineNumber)
        if (i == 0 && bodyContainer instanceof Statement) {
            bodyContainer.setLineNumber(lineNumber);
            lineNumber++;
        }
        // Recursively rebuild the body of the childstatement
        // Because of the if statement above, the lineNumber is set for the container aswell
        if (bodyContainer.body[i].hasBody())
            rebuildBody(bodyContainer.body[i], 0, lineNumber);
        // The childelement is a single line statement and therefore has a lineNumber
        else
            bodyContainer.body[i].setLineNumber(lineNumber);
        // Add the height of the childstatement to the lineNumber: if it has a body the height is
        // body.length + 1, else it is 1
        lineNumber += bodyContainer.body[i].getHeight();
    }
    // propagate the rebuild-body process to the root node
    // All constructs following the current bodycontainer in one of the ancestors of the bodycontainer
    // might have had a changed linenumber as well
    if (bodyContainer instanceof Statement) {
        if (bodyContainer.rootNode instanceof Module) {
            // Rebuild all the statements following this statement in the root node
            rebuildBody(bodyContainer.rootNode, bodyContainer.indexInRoot + 1, lineNumber);
            bodyContainer.notify(CallbackType.change);
        }
        else if (bodyContainer.rootNode instanceof Statement && bodyContainer.rootNode.hasBody()) {
            // Rebuild all the statements following this statement in the root node
            rebuildBody(bodyContainer.rootNode, bodyContainer.indexInRoot + 1, lineNumber);
            bodyContainer.notify(CallbackType.change);
        }
    }
}
/**
 * Replace the statement at the given index in the body of the bodyContainer with the given statement.
 * Also rebuilds all following statements to make sure they are still correctly positioned.
 *
 * @param bodyContainer - The statement or module in whose body the statement will be replaced
 * @param atIndex - The index in the body of the statement that will be replaced
 * @param newStatement - The statement that will replace the statement at the given index
 */
export function replaceInBody(bodyContainer, atIndex, newStatement) {
    const leftPos = bodyContainer.body[atIndex].getLeftPosition();
    // Build the new statement recursively from the current left position
    newStatement.init(leftPos);
    // Set the same root node and indexInRoot as the statement that is being replaced
    newStatement.rootNode = bodyContainer.body[atIndex].rootNode;
    newStatement.indexInRoot = atIndex;
    // Replace statement
    bodyContainer.body[atIndex] = newStatement;
    if (newStatement.hasScope())
        newStatement.scope.parentScope = bodyContainer.scope;
    // Rebuild everything that comes after the statement that is being replaced
    rebuildBody(bodyContainer, atIndex + 1, leftPos.lineNumber + newStatement.getHeight());
}
//# sourceMappingURL=body.js.map