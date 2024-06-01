import { Position } from "monaco-editor";
import { AssignmentTkn } from "./ast";
import { Module } from "./module";

/**
 * These scopes are created by multi-line statements
 * They determine which variables, functions, classes ... are in scope for the statement
 *
 * To determine whether a variable is in scope, we need to look at all variable assignments before the
 * current line and in all the parent scopes.
 */
export class Scope {
    /**
     * The scope of the parent element, if any.
     */
    parentScope: Scope = null;
    /**
     * All references to variables, functions, classes ... in this scope.
     * A reference is only added once, so that no duplicates to the same assignment statement
     * appear in the list.
     */
    references = new Map<string, Reference[]>();

    /**
     * Get all references accessible at the given position. This includes all references in the current scope,
     * parent scope and global scope.
     *
     * @param pos - The current position to check from. Only references that appear before this position are returned,
     * except for references in the global scope.
     * @returns All references that are accessible at the given position
     */
    getValidReferences(pos: Position, referenceType?: string): Reference[] {
        return [
            ...(referenceType
                ? Module.instance.scope.references.get(referenceType) ?? []
                : [...Module.instance.scope.references.values()].flat()),
            ...this.getValidReferencesRecursive(pos, referenceType),
        ];
    }

    /**
     * Get all assignments in the current and all parent scopes that appear before the given line.
     *
     * @param pos - The current position to check from. Only references that appear before this position are returned.
     * @returns - An array of all the valid references in this and all parent scopes
     */
    private getValidReferencesRecursive(pos: Position, referenceType?: string): Reference[] {
        const references = referenceType
            ? this.references.get(referenceType) ?? []
            : [...this.references.values()].flat();
        // All references that appear before the current line
        let validReferences = references.filter((ref) => ref.getPosition().isBeforeOrEqual(pos));

        // All references that appear before the current line in the parent scope
        if (this.parentScope) {
            validReferences = validReferences.concat(this.parentScope.getValidReferencesRecursive(pos));
        }

        return validReferences;
    }

    /**
     * Get all references to assignments with the given identifier that can be accessed from the current location in the
     * current scope.
     *
     * This function is similar to {@link getAllAccessableAssignments}, but returns the references to the assignments instead of
     * the assignments themselves.
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param pos - The current position
     * @returns All references to assignments with the given identifier that can be accessed from the current location
     */
    getAccessableAssignments(identifier: string, pos: Position): Reference[] {
        return this.getValidReferences(pos).filter((ref) => ref.getAssignment().getRenderText() === identifier);
    }

    /**
     * Check if an assignment with the given identifier is accessible from the current location
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param pos - The current line number
     * @returns true if an assignment with the given identifier is accessible from the current location, false otherwise
     */
    covers(identifier: string, pos: Position): boolean {
        return this.getAccessableAssignments(identifier, pos).length > 0;
    }

    /**
     * Check if the current scope is an ancestor of the given scope potentialChild.
     *
     * @param potentialChild - The scope to check if it is a child of the current scope
     * @returns - true if the current scope is an ancestor of the given scope potentialChild, false otherwise
     */
    isAncestor(potentialChild: Scope): boolean {
        // If scope is null, it can not be a parent
        if (!potentialChild) return false;

        // Get the parent scope of the child scope
        let curr = potentialChild.parentScope;
        // As long as the parent scope is not null, check if it is the current scope
        while (curr) {
            if (curr === this) return true;

            curr = curr.parentScope;
        }

        // If none of the parent scopes are the current scope, then the current scope is not an ancestor
        return false;
    }

    /**
     * Remove the given reference from the current scope.
     *
     * @returns true if the reference was removed, false otherwise
     */
    removeAssignment(assignment: AssignmentTkn): boolean {
        const references = this.references.get(assignment.referenceType) ?? [];
        const initialLength = references.length;
        this.references.set(
            assignment.referenceType,
            references.filter((ref) => ref.getAssignment() !== assignment)
        );
        return initialLength !== this.references.get(assignment.referenceType).length;
    }

    /**
     * Add an assignment token to the current scope.
     *
     * @param assignment - The assignment token to add to the current scope
     */
    addAssignment(assignment: AssignmentTkn) {
        const references = this.references.get(assignment.referenceType);
        if (references) references.push(new Reference(assignment, this));
        else this.references.set(assignment.referenceType, [new Reference(assignment, this)]);
    }

    /**
     * Push all assignments tokens in the current scope to the given scope. If
     * a token is not in the current scope, it will not be added to the given scope.
     *
     * @param toScope - The scope to push the assignments to
     * @param assignments - The assignment tokens to push to the parent scope
     * @returns The number of assignments that were pushed to the parent scope
     */
    pushToScope(toScope: Scope, assignments: AssignmentTkn[]): number {
        let total = 0;

        if (!toScope) return;

        for (let assignment of assignments) {
            const removed = this.removeAssignment(assignment);
            if (removed) toScope.addAssignment(assignment);
            total += removed ? 1 : 0;
        }

        return total;
    }

    /**
     * Push all assignments tokens in the current scope to the parent scope. If
     * a token is not in the current scope, it will not be added to the parent scope.
     *
     * @param assignments - The assignment tokens to push to the parent scope
     * @returns The number of assignments that were pushed to the parent scope
     */
    pushToParentScope(assignments: AssignmentTkn[]): number {
        return this.pushToScope(this.parentScope, assignments);
    }
}

/**
 * Reference to a variable, function, class ...
 */
export class Reference {
    /**
     * Token encapsulating the assignment. It has a place in the AST and
     * can be used for context information.
     */
    token: AssignmentTkn;

    /**
     * The scope in which this item is assigned.
     */
    scope: Scope;

    /**
     * SHOULD BE UPDATED IN THE FUTURE
     *
     * @param statement - Var assignment statement, obsolete in the future
     * @param scope - The scope in which the reference is valid
     * @param token - The token that is being referenced
     */
    constructor(token: AssignmentTkn, scope: Scope) {
        this.token = token;
        this.scope = scope;
    }

    getPosition(): Position {
        return this.token.right;
    }

    getAssignment(): AssignmentTkn {
        return this.token;
    }
}
