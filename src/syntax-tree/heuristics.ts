import { LOCALCHILDSEARCHDEPTH } from "../language-definition/settings";
import { CompoundConstruct, Construct } from "./ast";
import { CodeConstructType, ScopeType } from "./consts";
import { Module } from "./module";

/**
 * Get the scope corresponding to the given scope type.
 *
 * @param construct - The construct for which to get the scope
 * @param scopeType - Determines the scope that will be returned relative to the given construct
 * @returns The scope corresponding to the given scope type and construct
 */
export function scopeHeuristic(construct: Construct, scopeType: ScopeType) {
    switch (scopeType) {
        case ScopeType.Global:
            // The global scope
            return Module.instance.scope;
        case ScopeType.LocalParent:
            // The scope of the nearest parent
            return construct.getNearestScope();
        case ScopeType.LocalChild:
            // Searches for the first compound construct with a scope appearing after the given construct
            // that is a direct child an ancestor node
            // If none is found, or the one found does not have a scope, null is returned
            // LOCALCHILDSEARCHDEPTH determines how many UniConstructs up the algorithm will search
            // TODO: Increase the search depth to find a scope? Depends on what users expect ...
            let currentDepth = 0;
            let currentConstruct = construct;
            while (currentDepth < LOCALCHILDSEARCHDEPTH) {
                const tokens = currentConstruct.rootNode
                    .getNearestCodeConstruct(CodeConstructType.UniConstruct) // TODO: This wrongly assumes that the rootNode is always a UniConstruct
                    .tokens.slice(construct.indexInRoot + 1);
                for (const tkn of tokens) {
                    if (tkn instanceof CompoundConstruct && tkn.scope) {
                        return tkn.scope;
                    }
                }

                currentConstruct = currentConstruct.rootNode;
                currentDepth++;
            }
            console.error("None of the following subconstructs (after the assignment token) have a scope");
    }
}
