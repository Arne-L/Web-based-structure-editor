import { EditActionType } from "./consts";

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
