import { EditActionType, InsertActionType } from "./consts";

/**
 * Encapsulates an {@link EditActionType} and data necessary to perform the action.
 */
export class EditAction {
    type: EditActionType;
    data: any;

    constructor(type: EditActionType, data?: any) {
        this.type = type;
        this.data = data;
    }
}
/**
 * DEAD CODE?!?
 */
// export class InsertActionData {
//     cssId: string;
//     action: InsertActionType;
//     data: any;

//     constructor(cssId: string, type: InsertActionType, data: any = {}) {
//         this.cssId = cssId;
//         this.action = type;
//         this.data = data;
//     }
// }
