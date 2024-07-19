import { Context } from "../editor/focus";
import { CodeConstruct, CompoundConstruct, Construct, UniConstruct, HoleTkn } from "./ast";
import { Module } from "./module";

export namespace ValidatorNameSpace {
    export function validateRequiredConstructs(context: Context, invokedConstruct: UniConstruct): boolean {
        // If there are no required constructs, the depending constructs are always valid
        if (invokedConstruct.requiredConstructs.length === 0) return true;

        let canInsertConstruct = false;
        // For each of the constructs which are required by this construct, check if one of them
        // appears (correctly) in front of the current construct
        for (const requiredName of invokedConstruct.requiredConstructs) {
            // TODO: This is currently casted because expression does inherit from Statement and not GeneralStatement => CHANGE IN THE FUTURE
            const requiredConstruct = UniConstruct.constructs.get(requiredName); // NOT OKAY; FIX LATER

            // TODO: Currently the function assumes that each construct will only appear once
            // This is however not always the case, so we should look for a way to generalise
            // this in the future. A possibility is to use a form of sliding window from the back and
            // try to match all construct you came acros in the editor with the constructs in the
            // dependingConstructs list. if there is no match, we can shift the window until it matches
            // again => look at the algorithm used in "Ontwerp van algoritmen" course for this

            // Information about each of the depending constructs in order
            const depConstructsInfo = requiredConstruct.requiringConstructs;

            // Find where the current construct appears in the list of depending constructs
            // TODO: See todo above
            let dependingIndex = depConstructsInfo.findIndex(
                (construct) => construct.getConstructName() === invokedConstruct.getKeyword()
            );

            // Skip to next required construct; this case should never appear if required and requiring constructs
            // are correctly defined
            if (dependingIndex === -1) continue;

            // Depending / requiring construct to start checking from
            let currentConstruct: Construct = context.codeConstruct;
            if (currentConstruct instanceof CompoundConstruct) {
                const replacement = context.token ?? context.tokenToLeft ?? context.tokenToRight;
                if (replacement instanceof HoleTkn) currentConstruct = replacement;
            }
            const startingConstruct = currentConstruct;

            // There is no construct in front of the current one, so the insertion is invalid
            if (!currentConstruct) break;

            // Get the next construct in the editor after this
            let nextConstruct = getNextSiblingOf(currentConstruct);

            if (nextConstruct) {
                // Check if it appears in the depending constructs list
                let nextIndex = depConstructsInfo.findIndex(
                    (construct) => construct.getConstructName() === nextConstruct.getKeyword()
                );

                // If it appears in the depending constructs at the same place of after the last
                // found depending construct, then we take that as the next construct
                while (nextIndex >= dependingIndex) {
                    // Update the current with all the next construct information
                    dependingIndex = nextIndex;
                    currentConstruct = nextConstruct;

                    // Check if the following construct in the editor also appears
                    // in the depending constructs list
                    nextConstruct = getNextSiblingOf(nextConstruct);

                    if (!nextConstruct) break;

                    nextIndex = depConstructsInfo.findIndex(
                        (construct) => construct.getConstructName() === nextConstruct.getKeyword()
                    );
                }
            }

            // Keep track of how many times each depending construct has been visited / appeared, starting
            // from the current construct to the first requiring construct
            const dependingVisited = new Array(dependingIndex + 1).fill(0);

            // The current construct we want to insert also needs to be counted
            // Because we assume that each requiring construct can appear at least once, we do not need to
            // check the constraints
            // dependingVisited[dependingIndex] = 1;

            let prevConstruct = currentConstruct;

            // TODO: Not completely correct: what if there are multiple of the first requiring construct?
            while (dependingIndex >= 0) {
                const currentEditorConstruct = currentConstruct;
                if (currentConstruct === startingConstruct) {
                    prevConstruct = prevConstruct === currentConstruct ? invokedConstruct : prevConstruct;
                    currentConstruct = invokedConstruct;
                }

                // Still the same construct
                if (currentConstruct.getKeyword() === prevConstruct.getKeyword()) {
                    // Check if it is allowed to have many of the same construct
                    if (dependingVisited[dependingIndex] >= depConstructsInfo[dependingIndex].getMaxRepetition()) {
                        // We are at or over the limit of the current construct
                        // Start working on the next required construct, cause this one is not possible
                        break;
                    }
                    // Current construct has the name of the construct in front of the previous construct
                } else {
                    // New construct: names are different
                    // First check if the previous construct occured enough times; if not, we need to move on and check the other required constructs
                    if (dependingVisited[dependingIndex] < depConstructsInfo[dependingIndex].getMinRepetition()) {
                        // We are under the limit of the current construct
                        // The insertion is invalid
                        break;
                    }
                    // Move on to the next requiring construct
                    while (
                        dependingIndex >= 0 &&
                        currentConstruct.getKeyword() !== depConstructsInfo[dependingIndex].getConstructName()
                    ) {
                        dependingIndex--;
                    }
                }

                // Increase the amount of times the current construct type has been visited
                dependingVisited[dependingIndex]++;

                // As long as the depending index is not smaller than zero, we need to look for requiring constructs
                // Else the current construct is the required construct
                if (dependingIndex >= 0) {
                    prevConstruct = currentConstruct;
                    currentConstruct = getPrevSiblingOf(currentEditorConstruct);

                    // In case there are not yet any constructs in front of the current position
                    if (!currentConstruct) {
                        break;
                    }
                }
            }

            // Now we are at required construct and we have handled all the depending constructs
            if (currentConstruct && currentConstruct.getKeyword() === requiredConstruct.getKeyword()) {
                // We found the required construct
                canInsertConstruct = true;
            }
        }

        return canInsertConstruct;
    }

    export function validateAncestors(context: Context, invokedConstruct: UniConstruct): boolean {
        // If element needs to be a descendant of a certain construct
        if (invokedConstruct.requiredAncestorConstructs.length === 0) return true;

        let canInsertConstruct = false;

        // Go all the way to the top of the tree, even when we have already matched one construct.
        // We could also take the maximum level over all required ancestor constructs, but
        // in reality this would probably often be infinite.

        // If null, then we are at the top of the tree
        let currentParent = getParentOf(context.codeConstruct);
        let level = 0;
        while (currentParent) {
            const foundAncestor = invokedConstruct.requiredAncestorConstructs.find(
                (ancestor) => ancestor.getConstructName() === currentParent.getKeyword()
            );
            if (foundAncestor && foundAncestor.isValidLevel(level)) {
                // We found a required ancestor construct
                canInsertConstruct = true;
                break;
            }

            currentParent = getParentOf(currentParent);

            level++;
        }

        return canInsertConstruct;
    }

    /**
     * Returns the next sibling of the given construct that is either a UniConstruct
     * or a Hole
     *
     * @param construct - Statement to get the next sibling of
     * @returns - The next sibling of the given statement, or null if the
     * given statement is the last statement in the root's body
     */
    function getNextSiblingOf(construct: Construct): UniConstruct | HoleTkn {
        // TODO: Currently both the getNextSiblingOf & getPrevSiblingOf functions
        // only check for a possible sibling in the same root construct. Maybe we want
        // to traverse further if the rootNode is a CompoundConstruct? This might be useful,
        // but could also undesirable in some case...

        // Construct is the last construct in the root's tokens
        if (!construct.rootNode || construct.indexInRoot === construct.rootNode.tokens.length - 1) return null;
        console.log("fdfsfd", construct.rootNode, construct.rootNode?.tokens.length - 1);
        // Get the next construct
        const nextConstruct = construct.rootNode.tokens[construct.indexInRoot + 1];
        // If the next construct is a UniConstruct or a Hole, return it
        if (nextConstruct instanceof UniConstruct || nextConstruct instanceof HoleTkn) return nextConstruct;
        // Otherwise, keep searching
        else return getNextSiblingOf(nextConstruct);
    }

    /**
     * Returns the previous sibling of the given construct that is either a UniConstruct
     * or a Hole
     *
     * @param construct - Statement to get the previous sibling of
     * @returns - The previous sibling of the given statement, or null if the
     * given statement is the first statement in the root's body
     */
    function getPrevSiblingOf(construct: Construct): UniConstruct | HoleTkn {
        // Construct is the first construct in the root's tokens
        if (!construct?.rootNode || construct.indexInRoot === 0) return null;
        // Get the previous construct
        const prevConstruct = construct.rootNode.tokens[construct.indexInRoot - 1];
        // If the prev construct is a UniConstruct or a Hole, return it
        if (prevConstruct instanceof UniConstruct || prevConstruct instanceof HoleTkn) return prevConstruct;
        // Otherwise, keep searching
        else return getPrevSiblingOf(prevConstruct);
    }

    /**
     * Returns the parent of the given statement
     *
     * @param statement - Statement to get the parent of
     * @returns - The parent of the given statement, or null if the given statement
     * is of the {@link Module} type
     */
    function getParentOf(statement: CodeConstruct): CodeConstruct {
        if (statement.rootNode instanceof Module) return null;
        return statement.rootNode;
    }
}
