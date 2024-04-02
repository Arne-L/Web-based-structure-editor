// var controller; // DEAD CODE?
// import { addVariableReferenceButton, removeVariableReferenceButton } from "../editor/toolbox";
import { getUserFriendlyType, hasMatch, Util } from "../utilities/util";
import {
    CodeConstruct,
    ElseStatement,
    Expression,
    // ForStatement,
    IfStatement,
    Statement,
    // VarAssignmentStmt,
    VariableReferenceExpr,
} from "./ast";
import { DataType, typeToConversionRecord, TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR } from "./consts";
import { Module } from "./module";
import { Reference, Scope } from "./scope";

/**
 *
 */
export class VariableController {
    /**
     * HTML elements of all variable reference buttons in the module (including those hidden
     * in the current scope)
     */
    private variableButtons: HTMLDivElement[];
    /**
     * The current module.
     */
    private module: Module;

    //<ref, ref's parent scopes, deleted assignment's scope>
    // private refsToDeletedVars: [VariableReferenceExpr, Scope[], Scope][]; DEAD CODE?

    constructor(module: Module) {
        this.variableButtons = [];
        this.module = module;
        // this.refsToDeletedVars = []; // DEAD CODE?
    }

    // /**
    //  * Add the variable reference button for the given assignment statement.
    //  *
    //  * @param assignmentStmt
    //  */
    // addVariableRefButton(assignmentStmt: VarAssignmentStmt) {
    //     const button = addVariableReferenceButton(
    //         assignmentStmt.getIdentifier(),
    //         assignmentStmt.buttonId,
    //         this.module.eventStack,
    //         this.module
    //     );
    //     this.variableButtons.push(button);
    // }

    // /**
    //  * Check if the given button id is an existing variable reference button.
    //  *
    //  * @param buttonId - The id of the button to check for
    //  * @returns - true if the button is an existing variable reference
    //  * button, false otherwise
    //  */
    // isVariableReferenceButton(buttonId: string): boolean {
    //     // return (
    //     //     this.module.variableController
    //     //         .getVariableButtons()
    //     //         .map((buttonElement) => buttonElement.id)
    //     //         .indexOf(buttonId) > -1
    //     // );
    //     // Correct?
    //     return (
    //         this.getVariableButtons()
    //             .map((buttonElement) => buttonElement.id)
    //             .indexOf(buttonId) > -1
    //     );
    // }

    // /**
    //  * Removes the variable reference button with the given button id
    //  * from the current reference button list.
    //  *
    //  * @param buttonId - The id of the button to remove
    //  */
    // removeVariableRefButton(buttonId: string) {
    //     // Find index of button with given button id
    //     // let indexOfButton = -1;
    //     // for (let i = 0; i < this.variableButtons.length; i++) {
    //     //     if (this.variableButtons[i].id === buttonId) {
    //     //         indexOfButton = i;
    //     //     }
    //     // }
    //     // Correct?
    //     const indexOfButton = this.variableButtons.findIndex((button) => button.id === buttonId);

    //     // If button exists, remove it from the list
    //     if (indexOfButton > -1) {
    //         removeVariableReferenceButton(buttonId);
    //         this.variableButtons.splice(indexOfButton, 1);
    //     }
    // }

    // /**
    //  * ONLY FOR TYPING
    //  *
    //  * @param varId - The id of the variable button
    //  */
    // updateReturnTypeOfRefs(varId: string): void {
    //     const varRefs = this.getVarRefsBFS(varId, this.module);
    //     for (const ref of varRefs) {
    //         const newType = this.getVariableTypeNearLine(this.getScopeOfVarRef(ref), ref.lineNumber, ref.identifier);

    //         if (newType !== ref.returns) {
    //             const typeMismatch = this.updateReturnTypeOfRef(ref, newType);
    //             if (!typeMismatch && ref.draftModeEnabled) {
    //                 //WARNING: Because of this check, this method should NEVER be called when a variable is being deleted as it could remove the wrong warning highlights since we have no way to distinguish them
    //                 this.module.closeConstructDraftRecord(ref);
    //             }
    //         }

    //         if (ref.rootNode instanceof Expression) {
    //             ref.rootNode.validateTypes(this.module);
    //         }
    //     }
    // }

    // /**
    //  * ONLY FOR TYPING
    //  *
    //  * @param ref - Reference expression to a variable
    //  * @param newType - The new type of the variable
    //  * @returns - true if the newType type does not matche the required type, false if they do
    //  */
    // private updateReturnTypeOfRef(ref: VariableReferenceExpr, newType: DataType): boolean {
    //     // Update the type of the variable reference
    //     ref.returns = newType;
    //     // Get the type that the parent requires of this variable reference
    //     const originalTypes = ref.rootNode.typeOfHoles[ref.indexInRoot];
    //     // If the current type does not match the new type, but it can be converted to the new type
    //     if (
    //         !hasMatch(originalTypes, [newType]) &&
    //         hasMatch(Util.getInstance().typeConversionMap.get(newType), originalTypes)
    //     ) {
    //         // Filter the reconds to only contain the ones that convert to the required parent type
    //         const conversionRecords = typeToConversionRecord.has(newType)
    //             ? typeToConversionRecord.get(newType).filter((record) => originalTypes.indexOf(record.convertTo) > -1)
    //             : [];
    //         // Open draft mode with 'fix options' the different type conversions
    //         this.module.openDraftMode(
    //             ref,
    //             TYPE_MISMATCH_IN_HOLE_DRAFT_MODE_STR(originalTypes, newType),
    //             conversionRecords.map((rec) => rec.getConversionButton(ref.identifier, this.module, ref))
    //         );

    //         return true;
    //     }

    //     return false;
    // }

    // /**
    //  * Gets the (first) non-null scope starting from the given variable reference.
    //  *
    //  * @param ref - Reference expression to a variable
    //  * @returns - The first non-null scope starting from the given variable reference
    //  */
    // private getScopeOfVarRef(ref: VariableReferenceExpr): Scope {
    //     let currCode: Statement = ref;
    //     // Find the first non-null scope starting from the reference expression
    //     while (currCode.scope === null) {
    //         if (currCode.rootNode instanceof Module) {
    //             return currCode.rootNode.scope;
    //         }

    //         currCode = currCode.rootNode as Statement;
    //     }
    //     return currCode.scope;
    // }

    // /**
    //  * Check if the given assignment statement covers the given variable reference. This means
    //  * that the assignment statement is above the variable reference and is in the same scope or
    //  * is an ancestor of the variable reference's scope.
    //  *
    //  * @param ref - Reference expression to a variable
    //  * @param refScope - The scope of the reference expression
    //  * @param stmtScope - The scope of the statement
    //  * @param stmt - The assignment statement
    //  * @returns true if the assignment statement covers the variable reference, false otherwise
    //  */
    // private doesAssignmentCoverVarRef(
    //     ref: VariableReferenceExpr,
    //     refScope: Scope,
    //     stmtScope: Scope,
    //     stmt: VarAssignmentStmt
    // ): boolean {
    //     return stmt.lineNumber < ref.lineNumber && (stmtScope === refScope || stmtScope.isAncestor(refScope)); // Is this more accurate?
    //     // return (stmt.lineNumber < ref.lineNumber && stmtScope === refScope) || stmtScope.isAncestor(refScope);
    // }

    // /**
    //  * Let the given variable reference point / refer to the given assignment statement.
    //  *
    //  * @param ref - The variable reference to point to the assignment statement
    //  * @param varId - CURRENTLY UNUSED
    //  * @param stmt - The assignment statement to point to
    //  */
    // private pointVarRefToNewVar(ref: VariableReferenceExpr, varId: string, stmt: VarAssignmentStmt): void {
    //     ref.uniqueId = stmt.buttonId;
    //     this.updateReturnTypeOfRef(ref, stmt.dataType); // ONLY FOR TYPING
    // }

    // /**
    //  * Add warnings to the variable reference without an assignment statement in scope, or update the reference if there
    //  * is an other assignment statement in the same scope.
    //  *
    //  * @param varId - The button id of the variable (e.g. var-ref-1)
    //  * @param varIdentifier - The identifier of the variable (e.g. x)
    //  * @param module - The current module
    //  * @param stmtToExclude - The statement to exclude from the search
    //  */
    // addWarningToVarRefs(varId: string, varIdentifier: string, module: Module, stmtToExclude: VarAssignmentStmt) {
    //     // Get all variable reference expressions to the variable with the given varId
    //     const varRefs = this.getVarRefsBFS(varId, module);

    //     // Put a warning on every var ref that is not covered by a top-level assignment
    //     for (const ref of varRefs) {
    //         // Get the scope of the variable reference
    //         const refScope = this.getScopeOfVarRef(ref);

    //         // Get all assignments to this variable within the (ancestor's) scope
    //         const assignmentsToVarWithinScope = refScope.getAllAssignmentsToVariableWithinScope(
    //             varIdentifier,
    //             stmtToExclude
    //         );

    //         // Find assignment with the smallest line number
    //         let topLevelAssignmentWithinScope: Reference = null;

    //         // Check all assignment statements for the one with the smallest line number
    //         if (assignmentsToVarWithinScope.length > 0) {
    //             topLevelAssignmentWithinScope = assignmentsToVarWithinScope[0];
    //             for (const reference of assignmentsToVarWithinScope) {
    //                 if (reference.statement.lineNumber < topLevelAssignmentWithinScope.statement.lineNumber) {
    //                     topLevelAssignmentWithinScope = reference;
    //                 }
    //             }
    //         }

    //         // If no assignment covers this variable, then we need to put a warning on it
    //         if (
    //             !topLevelAssignmentWithinScope ||
    //             (topLevelAssignmentWithinScope.statement.lineNumber > ref.lineNumber &&
    //                 !topLevelAssignmentWithinScope.scope.isAncestor(refScope))
    //         ) {
    //             // Either no assignment exists OR the assignment is below the reference when the scope of the
    //             // assignment is not an ancestor of the scope of the reference
    //             module.openDraftMode(
    //                 ref,
    //                 "This variable has been removed and cannot be referenced anymore. Consider deleting this reference.",
    //                 []
    //             );
    //         } else {
    //             // This reference is actually covered by some assignment and just needs to have its id and type updated. NOTE: Type might not always be updated
    //             this.pointVarRefToNewVar(ref, varId, topLevelAssignmentWithinScope.statement as VarAssignmentStmt);

    //             // We actually need to make a button (if it does not yet exist) for the top level assignment and make all other
    //             // assignments point to it as well
    //             const button = document.getElementById(
    //                 (topLevelAssignmentWithinScope.statement as VarAssignmentStmt).buttonId
    //             );
    //             if (!button) {
    //                 // If button does not exist, create it
    //                 this.addVariableRefButton(topLevelAssignmentWithinScope.statement as VarAssignmentStmt);
    //             }
    //             // Assign the button id of the top level assignment to all other varAssignmentStmts
    //             for (const assignment of assignmentsToVarWithinScope) {
    //                 if (assignment !== topLevelAssignmentWithinScope) {
    //                     (assignment.statement as VarAssignmentStmt).buttonId = (
    //                         topLevelAssignmentWithinScope.statement as VarAssignmentStmt
    //                     ).buttonId;
    //                 }
    //             }
    //         }
    //     }
    // }
    // SUPERSEDED BY NEW METHOD

    // /**
    //  * Update the uniqueId and datatype of all variable reference expressions that reference the given VarAssignmentStmt
    //  * and are covered by it, while also performing type checks.
    //  *
    //  * @param varStmt - The VarAssignmentStmt to check the references against
    //  */
    // updateExistingRefsOnReinitialization(varStmt: VarAssignmentStmt): void {
    //     // List of variable reference expressions to the given VarAssignmentStmt that are in draft mode
    //     const varRefs = [];
    //     // Go through all constructs and add the construct if it is a variable reference to the given VarAssignmentStmt
    //     // and is in draft mode
    //     this.module.performActionOnBFS((code) => {
    //         if (
    //             code instanceof VariableReferenceExpr &&
    //             code.identifier === varStmt.getIdentifier() &&
    //             code.draftModeEnabled
    //         ) {
    //             varRefs.push(code);
    //         }
    //     });

    //     // Go through all variable reference expressions in draft mode and update their uniqueId and dataType if they
    //     // are covered by the given VarAssignmentStmt
    //     for (const ref of varRefs) {
    //         // Scope of the reference expression
    //         const refScope = this.getScopeOfVarRef(ref);

    //         // If the assignment statement covers the reference expression, then update the reference expression
    //         if (
    //             this.doesAssignmentCoverVarRef(
    //                 ref,
    //                 refScope,
    //                 varStmt.scope /* var-assignment */ ?? varStmt.rootNode.scope /* for-loop */,
    //                 varStmt
    //             )
    //         ) {
    //             // A valid assignment found, thus remove the warning
    //             this.module.closeConstructDraftRecord(ref);
    //             // Update uniqueId and dataType of the reference expression
    //             this.pointVarRefToNewVar(ref, varStmt.buttonId, varStmt);
    //         }
    //     }
    // }
    // LARGELY SUPERSEDED BY NEW METHOD (remaining parts are obsolete because we drop types)

    // /**
    //  * The list of all reference expression buttons in the module
    //  *
    //  * @returns - The HTML elements of all variable reference buttons in the module
    //  */
    // getVariableButtons(): HTMLDivElement[] {
    //     return this.variableButtons;
    // }

    // /**
    //  * Get the HTML button element of the variable reference with the given varId
    //  *
    //  * @param varId - The id of the variable button
    //  * @returns The HTML button element of the variable reference with the given varId,
    //  * or null if it does not exist
    //  */
    // getVariableButton(varId: string): HTMLDivElement {
    //     const buttons = this.variableButtons.filter((button) => button.id === varId);

    //     if (buttons.length === 0) {
    //         return null;
    //     }

    //     return buttons[0];
    // }

    // /**
    //  * Update the visibility of all variable reference buttons in the module based on the current scope and line number.
    //  *
    //  * @param scope - The current scope of the editor
    //  * @param lineNumber - The current line number of the editor
    //  */
    // updateToolboxVarsCallback(scope: Scope, lineNumber: number) {
    //     // Get all valid references accessible in the given scope and before the given line number
    //     // and map them to their button id
    //     const availableRefs = scope
    //         ?.getValidReferences(lineNumber)
    //         ?.map((ref) => (ref.statement as VarAssignmentStmt).buttonId);

    //     // Hide all buttons that are not in the availableRefs list and make all others visible
    //     if (availableRefs) {
    //         for (const button of this.variableButtons) {
    //             // Hide or show buttons based on availability in scope
    //             if (availableRefs.indexOf(button.id) === -1) {
    //                 // Reference not available in scope
    //                 button.parentElement.parentElement.style.display = "none";
    //             } else {
    //                 // Reference available in scope
    //                 button.parentElement.parentElement.style.display = "flex";

    //                 // Get each variable's return type
    //                 const varType = this.getVariableTypeNearLine(scope, lineNumber, button.textContent);
    //                 // Set each variable's return type
    //                 this.setButtonTypeVisuals(button, varType);
    //             }
    //         }
    //     }
    // }
    // WE DO NOT USE REFERENCE BUTTONS ANYMORE

    // /**
    //  * Add/set the type of the given variable reference button.
    //  *
    //  * @param button - The HTML button element to change the type of
    //  * @param type - The type to set the button to
    //  */
    // setButtonTypeVisuals(button: HTMLDivElement, type: DataType) {
    //     // Get the button container
    //     const buttonContainer = button.parentElement.parentElement;
    //     // Get the type as a string
    //     const readableType = getUserFriendlyType(type);

    //     buttonContainer.getElementsByClassName(
    //         "var-type-text"
    //     )[0].innerHTML = `<span class="def-vars-type-title-span">type: <span class="def-vars-type-span">${readableType}</span></span>`;

    //     // let immediateTooltips = ``;

    //     // switch (type) {
    //     //     case DataType.Number:
    //     //         immediateTooltips = `<span class="immediate-tooltip">convert text</span>`;
    //     //         break;

    //     //     case DataType.String:
    //     //         immediateTooltips = `<span class="immediate-tooltip">convert number</span>`;
    //     //         break;

    //     //     case DataType.AnyList:
    //     //     case DataType.NumberList:
    //     //     case DataType.StringList:
    //     //     case DataType.BooleanList:
    //     //         immediateTooltips = `<span class="immediate-tooltip">add to list</span>
    //     // 			<span class="immediate-tooltip">access item from list</span>
    //     // 			<span class="immediate-tooltip">loop over items in list</span>`;
    //     //         break;

    //     //     default:
    //     //         immediateTooltips = ``;
    //     // }

    //     // buttonContainer.getElementsByClassName("immediate-tooltips-container")[0].innerHTML = immediateTooltips;
    // }

    // /**
    //  * Update the type of the button with the given button id.
    //  *
    //  * @param buttonId - The id of the button to update
    //  * @param scope - The current scope
    //  * @param lineNumber - The current line number
    //  * @param identifier - The identifier of the variable
    //  */
    // updateVarButtonWithType(buttonId: string, scope: Scope, lineNumber: number, identifier: string) {
    //     // Get the type for the identifier within the given scope
    //     const varType = this.getVariableTypeNearLine(scope, lineNumber, identifier, false);

    //     // Get the button element with the given button id
    //     const varButton = this.variableButtons.filter((button) => button.id === buttonId)[0];

    //     // Set the type of the button
    //     this.setButtonTypeVisuals(varButton, varType);
    // }

    // /**
    //  * Get the type of the assignment closest to the current position in the editor.
    //  *
    //  * @param scope -
    //  * @param lineNumber
    //  * @param identifier
    //  * @param excludeCurrentLine
    //  * @returns
    //  */
    // getVariableTypeNearLine(
    //     scope: Scope,
    //     lineNumber: number,
    //     identifier: string,
    //     excludeCurrentLine: boolean = true
    // ): DataType {
    //     return DataType.Any; // Replacement for all following lines because we do not use typing!
        // const focus = this.module.focus;
        // // Get all assignment statements to the given identifier
        // // const assignmentsToVar = scope.getAllAssignmentsToVarAboveLine(
        // //     identifier,
        // //     this.module,
        // //     lineNumber,
        // //     excludeCurrentLine
        // // );
        // // Correct?
        // const assignmentsToVar = scope.getAllAccessableAssignments(identifier, lineNumber);

        // // Possible fix for ERROR[1]
        // if (assignmentsToVar.length === 0) {
        //     // No assignments to the variable, so we are unable to determine the type
        //     return DataType.Any;
        // }

        // // Find the assignment statement closest to the given line number, indicated
        // // by the index 'i' in the assignmentsToVar list
        // let smallestDiffIndex = 0;
        // for (let i = 0; i < assignmentsToVar.length; i++) {
        //     if (
        //         lineNumber - assignmentsToVar[i].lineNumber <
        //         lineNumber - assignmentsToVar[smallestDiffIndex].lineNumber
        //     ) {
        //         smallestDiffIndex = i;
        //     }
        // }

        // // Get the closest assignment statement
        // const closestStatement = assignmentsToVar[smallestDiffIndex];

        // /**
        //  * WARNING[1]
        //  * This is a newly added line making all following code obsolete (together with "scope.getAllAccessableAssignments" 
        //  * method above). However, it seems that because of the way the references in a scope are added in the update cycle,
        //  * it does not detect the newly added assignment right after insertion but only after the next update cycle. A possible
        //  * reason is that the variables on the next line are defined before the references in the scope are updated. So currently
        //  * the any type will show up right after insertion. 
        //  * 
        //  * The solution used by the original code is to search the entire program for all assignments and then filtering, requiring
        //  * a lot of unnecessary work and being difficult to generalise. This solution should be more robust, but requires a deeper
        //  * look at the update cycle.
        //  */
        // return closestStatement.dataType;


        // // Get the statement at the currently focused line
        // // Types will be determined based on the statement at the currently focused line
        // const statementAtLine = focus.getStatementAtLineNumber(lineNumber);

        // // ERROR[1]: "closestStatement" is sometimes undefined (possibly fixed)
        // if (closestStatement.rootNode === statementAtLine.rootNode) {
        //     // They have the same parent, meaning they are in the same scope: we can
        //     // simply use the type of the closest statement
        //     return closestStatement.dataType;
        // } else {
        //     // The closest statement is not in the same scope as the currently focused statement
        //     // Get a list of all types of the variable assignments up to the currently focused line
        //     const types = assignmentsToVar
        //         .filter((assignment) => assignment.lineNumber <= lineNumber)
        //         .map((filteredRecord) => filteredRecord.dataType);
        //     // Get the first type in the list
        //     const firstType = types[0];
        //     // Scope of the focused statement if it has a scope, otherwise the scope of the parent node
        //     const statementAtLineScope = statementAtLine.hasScope()
        //         ? statementAtLine.scope
        //         : (statementAtLine.rootNode as Module | Statement).scope;
        //     // Scope of the closest statement if it has a scope, otherwise the scope of the parent node
        //     const closestStatementScope = closestStatement.hasScope()
        //         ? closestStatement.scope
        //         : (closestStatement.rootNode as Module | Statement).scope;

        //     // Check if the closest statement's scope is an ancestor scope of the statement at the currently focused line
        //     const closestStatementScopeIsParentScope = closestStatementScope.isAncestor(statementAtLineScope);
        //     // Check if the closest statement has as parent an if or an elif statement
        //     const closestStmtIsIfElseParent =
        //         closestStatement.rootNode instanceof IfStatement ||
        //         (closestStatement.rootNode instanceof ElseStatement &&
        //             (closestStatement.rootNode as ElseStatement).hasCondition);

        //     // If all types are equal, then it is safe to return that type
        //     if (types.every((type) => type === firstType)) {
        //         return firstType;
        //     } else if (
        //         // statementAtLineScope.parentScope === closestStatementScope || // Is it correct to remove this? Should be equivalent without it?
        //         closestStatementScopeIsParentScope
        //     ) {
        //         /**
        //          * abc = 123
        //          * abc = ""
        //          *
        //          * if ---:
        //          *    ref abc here should be string, not Any
        //          */
        //         return types[types.length - 1];
        //     // The following "else if" makes sure that the type of the variable is not Any if it is in an if or an elif statement
        //     } else if (closestStmtIsIfElseParent) {
        //         // Get the parent scope of the if statement
        //         const parentAssignments =
        //             closestStatementScope.parentScope.getAllAssignmentsToVariableWithinScope(identifier);
        //         // Get the type of the variable in the parent scope
        //         return parentAssignments.length > 0
        //             ? (parentAssignments[parentAssignments.length - 1].statement as VarAssignmentStmt).dataType
        //             : DataType.Any;
        //     } else {
        //         return DataType.Any;
        //     }
        // }
    // }

    // /**
    //  * Check if the given variable assignment statement is a reassignment of a variable that appears before
    //  *
    //  * @param varStmt - The variable assignment statement
    //  * @param module - The current module
    //  * @returns - true if the given variable assignment statement is a reassignment of a variable that appears before, 
    //  * false otherwise
    //  */
    // isVarStmtReassignment(varStmt: VarAssignmentStmt, module: Module): boolean {
    //     // List of alle constructs
    //     const Q: CodeConstruct[] = [];
    //     // Insert all top-level constructs before the given varStmt into the queue
    //     Q.unshift(...module.body.filter((stmt) => stmt.lineNumber < varStmt.lineNumber));

    //     while (Q.length > 0) {
    //         const currCodeConstruct = Q.pop();

    //         if (currCodeConstruct instanceof Statement) {
    //             // Add body of statement to the queue
    //             Q.unshift(...currCodeConstruct.body);

    //             // If there is a variable assignment statement with the same identifier as varStmt that
    //             // appears before varStmt, then varStmt is a reassignment
    //             if (
    //                 currCodeConstruct instanceof VarAssignmentStmt &&
    //                 currCodeConstruct.getIdentifier() === varStmt.getIdentifier() &&
    //                 currCodeConstruct.lineNumber < varStmt.lineNumber
    //             ) {
    //                 return true;
    //             }
    //         }
    //     }

    //     return false;
    // }

    // /**
    //  * Get all assigments with the given varId in the entire module
    //  *
    //  * @param varId - The button id of the variable
    //  * @param module - The current module
    //  * @returns - A list of all variable assignment statements with the given varId
    //  */
    // getAllAssignmentsToVar(varId: string, module: Module): VarAssignmentStmt[] {
    //     // List of all constructs
    //     const Q: CodeConstruct[] = [];
    //     // Result list of all variable assignment statements with the given varId
    //     const result: VarAssignmentStmt[] = [];
    //     // Add all top-level constructs to the queue
    //     Q.push(...module.body);

    //     while (Q.length > 0) {
    //         // Take first element
    //         const currCodeConstruct = Q.splice(0, 1)[0];
    //         if (currCodeConstruct instanceof Expression) {
    //             // Add tokens of expression to the queue
    //             Q.push(...currCodeConstruct.tokens);
    //         } else if (currCodeConstruct instanceof Statement) {
    //             // Add body and tokens of statement to the queue
    //             Q.push(...currCodeConstruct.body);
    //             Q.push(...currCodeConstruct.tokens);

    //             // If the current statement is a variable assignment statement with the given varId, add it to the result list
    //             if (currCodeConstruct instanceof VarAssignmentStmt && currCodeConstruct.buttonId === varId) {
    //                 result.push(currCodeConstruct);
    //             } else if (currCodeConstruct instanceof ForStatement && currCodeConstruct.loopVar.buttonId === varId) {
    //                 result.push(currCodeConstruct.loopVar);
    //             }
    //         }
    //     }

    //     return result;
    // }

    // /**
    //  * Get all variable reference expressions with the given varId (refering to the same variable)
    //  *
    //  * @param varId - The button id of the variable
    //  * @param module - The current module
    //  * @returns - A list of all variable reference expressions with the given varId (refering to the same variable)
    //  */
    // private getVarRefsBFS(varId: string, module: Module): VariableReferenceExpr[] {
    //     // List of all constructs
    //     const Q: CodeConstruct[] = [];
    //     // List of all variable reference expressions with the given varId (refering to the same variable)
    //     const result: VariableReferenceExpr[] = [];
    //     // Start with all statements at the top level
    //     Q.push(...module.body);

    //     // While there are still constructs to process
    //     while (Q.length > 0) {
    //         // Take the last node
    //         const currCodeConstruct = Q.pop();

    //         // If the node is an expression, add its tokens to the queue
    //         if (currCodeConstruct instanceof Expression) {
    //             Q.push(...currCodeConstruct.tokens);

    //             if (currCodeConstruct instanceof VariableReferenceExpr && currCodeConstruct.uniqueId === varId) {
    //                 // Add the variable reference with the given vadId to the result list
    //                 result.push(currCodeConstruct);
    //             }
    //             // If the node is a statement, add its body and tokens to the queue
    //         } else if (currCodeConstruct instanceof Statement) {
    //             Q.push(...currCodeConstruct.body);
    //             Q.push(...currCodeConstruct.tokens);
    //         }
    //         // Skip in case of Token or Module
    //     }

    //     return result;
    // }
}

/*
  Class representing a Map<string, Array<[number, DataType]>> object that contains information about
  variable assignments in the form map.get(varID) = [lineNumber, DataType][]

export class VariableAssignmentMap {
    private map: Map<string, Array<[number, DataType]>>;

    constructor() {
        this.map = new Map<string, [number, DataType][]>();
    }


     * Add a new type assignment record to the variable with the given varID.
     *
     * If an entry for this variable does not exist, one will be created.
     * If there is already an assignment record with the exact same lineNumber, then the old one will be updated to reflect
     * the type provided.

    addRecord(varID: string, lineNumber: number, type: DataType) {
        const recordsList = this.map.get(varID);

        if (recordsList && recordsList.length >= 0) {
            const existingRecord = this.getRecordByLineNumber(recordsList, lineNumber);
            if (!existingRecord) {
                recordsList.push([lineNumber, type]);
            } else {
                this.updateRecord(varID, lineNumber, type);
            }
        } else if (!recordsList) {
            this.map.set(varID, [[lineNumber, type]]);
        }
    }


     * Update an exisiting record with a new type. If the record with the provided lineNumber
     * does not exist or there is no entry in the map for the variable with the provided identifier
     * then the method does nothing.

    updateRecord(identifier: string, lineNumber: number, type: DataType) {
        if (this.map.get(identifier)) {
            const record = this.getRecordByLineNumber(this.map.get(identifier), lineNumber);

            if (record) {
                record[1] = type;
            }
        }
    }


     * Remove a single assignment record from the list of records for the given variable from the entry for this variable.

    removeRecord(varID: string, lineNumber: number) {
        if (this.map.get(varID)) {
            this.map.get(varID).splice(this.getRecordIndex(this.map.get(varID), lineNumber), 1);
        }
    }


     * Remove all assignment records for a given variable from the map.

    removeRecordsList(varID: string) {
        if (this.map.get(varID)) {
            this.map.delete(varID);
        }
    }


     * Return a list of assignment records for a given variable.
     *
     * @returns a list of tuples [lineNumber, type] if the list exists. [] otherwise.

    getRecords(identifier: string): [number, DataType][] {
        if (this.map.get(identifier)) {
            return this.map.get(identifier);
        }

        return [];
    }


     * Return the type a variable is assigned on a given line.
     *
     * @returns the type of expression assigned to the variable on the given line. null if there is no assignment on that line.

    getAssignedTypeOnLine(varID: string, lineNumber: number): DataType {
        if (this.map.get(varID)) {
            const record = this.getRecordByLineNumber(this.map.get(varID), lineNumber);
            return record ? record[1] : null;
        }
    }


     * Return the inferred data type of a variable on a given line.
     *
     * @returns inferred data type of the variable on lineNumber. null otherwise.

    getAssignedTypeNearLine(varID: string, lineNumber: number, focus: Focus): DataType {
        if (this.map.get(varID)) {
            const record = this.getRecordByLineNumber(this.map.get(varID), lineNumber);

            if (record) {
                return record[1];
            } else {
                const records: [number, DataType][] = this.map.get(varID);
                const recordLines = records.map((record) => record[0]).filter((line) => line <= lineNumber);

                if (recordLines.length === 0) {
                    //lineNumber is above all assignments to this var
                    return null;
                }

                //find assignment closest to lineNumber
                let smallestDiffIndex = 0;
                for (let i = 0; i < recordLines.length; i++) {
                    if (lineNumber - recordLines[i] < lineNumber - recordLines[smallestDiffIndex]) {
                        smallestDiffIndex = i;
                    }
                }

                //determine type
                const record = records[smallestDiffIndex];
                const statementAtRefLine = focus.getStatementAtLineNumber(lineNumber);
                const assignemntStmt = focus.getStatementAtLineNumber(record[0]);

                if (statementAtRefLine.rootNode === assignemntStmt.rootNode) {
                    return record[1];
                } else {
                    //find all assignments and their type above lineNumber
                    const types = records
                        .filter((record) => record[0] <= lineNumber)
                        .map((filteredRecord) => filteredRecord[1]);
                    const firstType = types[0];

                    //if all types are equal, then it is safe to return that type
                    if (types.every((type) => type === firstType)) {
                        return firstType;
                    } else {
                        return DataType.Any;
                    }
                }
            }
        }

        return null;
    }

    isVariableInMap(varID: string): boolean {
        return this.map.get(varID)?.length > 0 ?? false;
    }

    private getRecordByLineNumber(recordsList: [number, DataType][], lineNumber: number): [number, DataType] {
        for (const record of recordsList) {
            if (record[0] === lineNumber) {
                return record;
            }
        }

        return null;
    }

    private getRecordIndex(recordsList: [number, DataType][], lineNumber: number): number {
        for (let i = 0; i < recordsList.length; i++) {
            if (recordsList[i][0] === lineNumber) {
                return i;
            }
        }

        return -1;
    }
}
*/
