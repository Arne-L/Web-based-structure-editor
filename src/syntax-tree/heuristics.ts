import { CompoundConstruct, Construct } from "./ast";
import { ScopeType } from "./consts";
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
            // Searches for the first compound construct appearing after the given construct
            // that is a direct child of the root
            // If none is found, or the one found does not have a scope, null is returned
            for (const tkn of construct.rootNode.tokens) {
                if (tkn.indexInRoot > construct.indexInRoot && tkn instanceof CompoundConstruct) {
                    return tkn.scope;
                }
            }
    }
}
