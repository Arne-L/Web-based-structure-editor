import { hasMatchWithIndex } from "../utilities/util";
import { Construct, /*ForStatement,*/ Statement, /*VarAssignmentStmt,*/ AssignmentToken } from "./ast";
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
    references = new Array<Reference>();

    /**
     * Checks if the given id is a valid reference in the current scope (= the id is assigned to a variable in
     * the current scope or a parent scope)
     *
     * @param uniqueId - The button id to check
     * @param line - The current line number
     * @returns - true if the id is a valid reference, false otherwise
     */
    // isValidReference(uniqueId: string, line: number): boolean {
    //     // Get all valid references, from the current scope and all parent scopes, that appear before the current line
    //     const validReferences = this.getValidReferences(line);

    //     // If one of the reference id's matches the given id, then the id is valid
    //     for (let ref of validReferences) {
    //         if (
    //             // If the reference is a variable assignment statement and the id matches the variable id
    //             (ref.statement instanceof VarAssignmentStmt && ref.statement.buttonId == uniqueId) ||
    //             // If the reference is a for loop and the id matches the loop variable id
    //             (ref.statement instanceof ForStatement && ref.statement.buttonId == uniqueId)
    //         ) {
    //             return true;
    //         }
    //     }

    //     return false;
    // }
    // SUPERSEDED BY covers

    /**
     * Get all assignments in the current and all parent scopes that appear before the given line.
     *
     * @param line - The current line number to check from
     * @returns - An array of all the valid references
     */
    getValidReferences(line: number): Array<Reference> {
        // All references that appear before the current line
        let validReferences = this.references.filter((ref) => ref.getLineNumber() < line);

        // All references that appear before the current line in the parent scope
        if (this.parentScope) {
            validReferences = validReferences.concat(this.parentScope.getValidReferences(line));
        }

        return validReferences;
    }

    /**
     * Returns all existing assignments to the variable with the given identifier in this scope (and parent scopes).
     *
     * There can only be one variable with the given identifier in this scope, because we disallow creation of duplicates
     * when a new variable is created.
     *
     * NOTE: the references are tied to variable assignment statements so this is equivalent to finding all
     * assignments to a variable.
     *
     * @param identifier - The variable reference identifier
     * @param excludeStmt - The statement to exclude from the search
     * @returns An array of all the references to the variable with the given identifier in this scope, excluding
     * the references to the given statement
     *
     * @example
     * // We can choose which references to x to return, the one referencing the first of second assigment.
     * let x = 1;
     * let y = 2;
     * {
     *  let x = 3;
     *  x;
     *  let z = 4;
     * }
     */
    // getAllAssignmentsToVariableWithinScope(
    //     identifier: string,
    //     excludeStmt?: VarAssignmentStmt | ForStatement
    // ): Reference[] {
    //     // Get all references to the variable with the given identifier in this scope, excluding references to the
    //     // given statement
    //     let validReferences = this.references.filter((ref) => {
    //         if (ref.statement instanceof ForStatement) {
    //             // For loop var is nested in the statement
    //             return ref.statement.loopVar.getIdentifier() === identifier && excludeStmt !== ref.statement;
    //         } else if (ref.statement instanceof VarAssignmentStmt) {
    //             return ref.statement.getIdentifier() === identifier && excludeStmt !== ref.statement;
    //         }
    //     });

    //     // Also get all these references in the parent scope
    //     if (this.parentScope != null) {
    //         validReferences = validReferences.concat(
    //             this.parentScope.getAllAssignmentsToVariableWithinScope(identifier) // Why not excludeStmt here?
    //         );
    //     }

    //     return validReferences;
    // }

    /**
     * Get all assignment statements to the given identifier in the entire module that can be accessed from the
     * current location in the current scope.
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param lineNumber - The current line number
     */
    // getAllAccessableAssignments(identifier: string, lineNumber: number): VarAssignmentStmt[] {
    //     return this.getAllAssignmentsToVariableWithinScope(identifier)
    //         .filter((ref) => ref.getLineNumber() < lineNumber)
    //         .map((ref) => {
    //             // If the current node is of the correct type and has the correct identifier, add it to the list of assignments
    //             if (ref.statement instanceof VarAssignmentStmt && ref.statement.getIdentifier() === identifier) {
    //                 return ref.statement;
    //             } else if (
    //                 ref.statement instanceof ForStatement &&
    //                 ref.statement.loopVar.getIdentifier() === identifier
    //             ) {
    //                 // loopvar constains the nested VarAssignmentStmt in the for loop statement
    //                 return ref.statement.loopVar;
    //             }
    //         });
    // }
    // ONLY INDIRECTLY USED FOR TYPING

    /**
     * Get all references to assignments with the given identifier that can be accessed from the current location in the
     * current scope.
     *
     * This function is similar to {@link getAllAccessableAssignments}, but returns the references to the assignments instead of
     * the assignments themselves.
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param lineNumber - The current line number
     * @returns All references to assignments with the given identifier that can be accessed from the current location
     */
    getAccessableAssignments(identifier: string, lineNumber: number): Reference[] {
        return this.getValidReferences(lineNumber).filter((ref) => ref.getAssignment().getRenderText() === identifier);

        // !!!EQUIVALENT!!!

        // const assignments = this.references.filter(
        //     (ref) => ref.getLineNumber() < lineNumber && ref.getAssignment().getRenderText() === identifier
        // );

        // if (this.parentScope) {
        //     return assignments.concat(this.parentScope.getAccessableAssignments(identifier, lineNumber));
        // } else {
        //     return assignments;
        // }
    }

    /**
     * Check if an assignment with the given identifier is accessible from the current location
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param lineNumber - The current line number
     * @returns true if an assignment with the given identifier is accessible from the current location, false otherwise
     */
    covers(identifier: string, lineNumber: number): boolean {
        return this.getAccessableAssignments(identifier, lineNumber).length > 0;
    }

    /**
     * Gets all the scopes in which the current statement is nested, not including the
     * scope of the statement itself.
     *
     * @param stmt - The statement to get all the parent scopes of
     * @returns - An array of all the parent scopes of the given statement
     */
    static getAllScopesOfStmt(stmt: Statement) {
        let currStatement: Statement | Module = stmt;
        const scopes: Scope[] = [];

        while (currStatement && !(currStatement instanceof Module)) {
            // Add the parent scope of the current statement
            scopes.push((currStatement.rootNode as Statement | Module).scope);
            currStatement = currStatement.rootNode as Statement | Module;
        }

        return scopes;
    }

    /**
     * Get a list of all variable assignments to the given identifier in the entire module.
     *
     * @param identifier - The identifier to find assignments to (e.g. 'x')
     * @param module - The current module
     * @returns - A list of all variable assignments to the given identifier in the entire module
     *
     * @example
     * let x = 1;
     * let y = 2;
     * {
     *  let x = 3;
     *  x;
     *  let z = 4;
     * }
     * //=> [x = 1, x = 3]
     */
    // private getAllAssignmentsToVar(identifier: string, module: Module): VarAssignmentStmt[] {
    //     const assignments: VarAssignmentStmt[] = [];
    //     //Find all assignments to vars with this identifier e.g. 'x'
    //     const Q: CodeConstruct[] = [];
    //     // Get all statements in the top level of module
    //     Q.push(...module.body);

    //     let currNode;
    //     while (Q.length > 0) {
    //         // Take the first node
    //         currNode = Q.splice(0, 1)[0];

    //         // If the current node is of the correct type and has the correct identifier, add it to the list of assignments
    //         if (currNode instanceof VarAssignmentStmt && currNode.getIdentifier() === identifier) {
    //             assignments.push(currNode);
    //         } else if (currNode instanceof ForStatement && currNode.loopVar.getIdentifier() === identifier) {
    //             // loopvar constains the nested VarAssignmentStmt in the for loop statement
    //             assignments.push(currNode.loopVar);
    //         }

    //         // Add all nested constructs to the queue
    //         if (currNode instanceof Statement) {
    //             Q.push(...currNode.tokens);
    //             Q.push(...currNode.body);
    //         }
    //     }

    //     return assignments;
    // }

    /**
     * TODO; NOT CLEAR WHAT THIS METHOD DOES / HOW IT WORKS
     *
     * This method determines whether an assignment to a given variable exists and would be covered by the scope at
     * lineNumber. It returns all such assignments in an array.
     *
     * PROBABLY: This method determines all assignment statements with the given identifier that can be accessed / are
     * in scope at the given line number.
     *
     * @param identifier - The variable identifier to find assignments to (e.g. 'x')
     * @param module - The current module
     * @param lineNumber - The line number of the excluded statement
     * @param excludeStmt - The statement to exclude from the search
     * @returns
     */
    // getAllVarAssignmentsToNewVar(
    //     identifier: string,
    //     module: Module,
    //     lineNumber: number,
    //     excludeStmt: VarAssignmentStmt = null
    // ): VarAssignmentStmt[] {
    //     // Get all assignment statements to the given identifier in the entire module
    //     let assignments: VarAssignmentStmt[] = this.getAllAssignmentsToVar(identifier, module);

    //     // DEAD CODE?
    //     // //We know these are the same variable if their scopes match at some point
    //     // // Get the statement at the given line number
    //     // let statement = module.focus.getStatementAtLineNumber(lineNumber);

    //     // // Find the scope that contains the statement
    //     // let workingScope = statement.scope;
    //     // let currStatement = statement;
    //     // // While the working scope is null and the current statement is not null,
    //     // // try to find a non-null (parent) scope
    //     // while (!workingScope && currStatement && currStatement.rootNode) {
    //     //     // Set the working scope to the parent scope of the current statement
    //     //     workingScope = (currStatement.rootNode as Module | Statement).scope;

    //     //     if (currStatement.rootNode instanceof Module) {
    //     //         // Module does not have a parent node or scope
    //     //         break;
    //     //     } else {
    //     //         // Set the parent as the current statement
    //     //         currStatement = currStatement.rootNode as Statement;
    //     //     }
    //     // }

    //     //filter out assignment statements that are not in this scope
    //     assignments = assignments.filter((assignmentStmt) => {
    //         // Assignment statements should be different from the excluded statement
    //         if (assignmentStmt !== excludeStmt) {
    //             // All the ancestor scopes of the excluded statement
    //             const newAssignmentScopes = Scope.getAllScopesOfStmt(excludeStmt);
    //             // All the ancestor scopes of the current assignment statement
    //             const oldAssignmentScopes = Scope.getAllScopesOfStmt(assignmentStmt);

    //             // Get a tuple of indices of the last matching element in the second list with the first list
    //             // This corresponds to the most nested scope that is common to both lists
    //             const matchInfo = hasMatchWithIndex(newAssignmentScopes, oldAssignmentScopes);

    //             if (lineNumber < assignmentStmt.lineNumber) {
    //                 //new var is above old var assignment; new is in-scope of old
    //                 return true;
    //             } else if (lineNumber > assignmentStmt.lineNumber && matchInfo[0] < matchInfo[1]) {
    //                 //new is below old assignment, if scope of old assignment is at least one level deeper than the scope of the new var assign, they are diff vars
    //                 return false;
    //             } else if (matchInfo[0] === matchInfo[1]) {
    //                 //if var scopes are on the same level, then they are the same as long as the roots of both assignments match
    //                 return excludeStmt ? assignmentStmt.rootNode === excludeStmt.rootNode : false;
    //             } else {
    //                 return excludeStmt ? assignmentStmt.scope === excludeStmt.scope : false; //two vars are in same scope
    //             }
    //         }
    //     });

    //     return assignments;
    // }

    /**
     * Get all statements that assign to the given variable identifier in the current scope and all parent scopes,
     * that appear before (exclusive or inclusive) the given line number.
     *
     * @param identifier - The variable identifier to find assignments to (e.g. 'x')
     * @param module - The current module
     * @param lineNumber - The line number to search before
     * @param excludeCurrentLine - Whether to exclude the current line number from the search
     * @returns - A list of all variable assignments to the given identifier in the current scope and all parent scopes,
     * that appear before (exclusive or inclusive) the given line number
     */
    // getAllAssignmentsToVarAboveLine(
    //     identifier: string,
    //     module: Module,
    //     lineNumber: number,
    //     excludeCurrentLine: boolean = true
    // ) {
    //     if (excludeCurrentLine) {
    //         return this.getAllAssignmentsToVar(identifier, module).filter((stmt) => stmt.lineNumber < lineNumber);
    //     }

    //     return this.getAllAssignmentsToVar(identifier, module).filter((stmt) => stmt.lineNumber <= lineNumber);
    // }

    /**
     * Replace the currStmt with the newStmt in the reference to the currStmt. This should only be one reference.
     *
     * @param currStmt - The statement to search a reference for
     * @param newStmt - The new statement to replace the currStmt with
     */
    // replaceReferenceStatement(currStmt: VarAssignmentStmt, newStmt: VarAssignmentStmt) {
    //     // Get the reference to the given variable assignment statement
    //     const ref = this.references.filter((ref) => ref.statement === currStmt)[0]; //only one reference per var in scope
    //     // Replace with the new statement
    //     ref.statement = newStmt;
    // }

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
    removeAssignment(assigment: AssignmentToken): boolean {
        const initialLength = this.references.length;
        this.references = this.references.filter((ref) => ref.getAssignment() !== assigment);
        return initialLength !== this.references.length;
    }

    /**
     * Add an assignment token to the current scope.
     *
     * @param assignment - The assignment token to add to the current scope
     */
    addAssignment(assignment: AssignmentToken) {
        this.references.push(new Reference(assignment, this));
    }

    /**
     * Push all assignments tokens in the current scope to the given scope. If
     * a token is not in the current scope, it will not be added to the given scope.
     *
     * @param toScope - The scope to push the assignments to
     * @param assignments - The assignment tokens to push to the parent scope
     * @returns The number of assignments that were pushed to the parent scope
     */
    pushToScope(toScope: Scope, assignments: AssignmentToken[]): number {
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
    pushToParentScope(assignments: AssignmentToken[]): number {
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
    token: AssignmentToken;

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
    constructor(token: AssignmentToken, scope: Scope) {
        this.token = token;
        this.scope = scope;
    }

    getLineNumber(): number {
        return this.token.getFirstLineNumber();
    }

    getAssignment(): AssignmentToken {
        return this.token;
    }
}
