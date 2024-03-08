import { ConstructDoc } from "../suggestions/construct-doc";
import { CodeConstruct, GeneralStatement, Importable, Statement } from "../syntax-tree/ast";
import { Module } from "../syntax-tree/module";
import { addClassToDraftModeResolutionButton, DataType, ListTypes } from "./../syntax-tree/consts";

/**
 * IMPORTANT!!!
 *
 * constructKeys and ConstructKeys need to have the same values.
 *
 * The enum is so that we can get a dummy construct anywhere in the code.
 * The list is so that we can loop over all dumy constructs since Map does not have a public keys property.
 *
 * In regular JS we could always call Object.keys(ConstructKeys), but not in TS.
 */
export const constructKeys = [
    "VarAssign",
    "print()",
    "randint()",
    "range()",
    "len()",
    "string",
    "int",
    "True",
    "False",
    "+",
    "-",
    "*",
    "/",
    "And",
    "Or",
    "Not",
    "==",
    "!=",
    "<",
    "<=",
    ">",
    ">=",
    "while",
    "If",
    "Elif",
    "Else",
    "For",
    "List Literal",
    ".append()",
    "List Element Access",
    ".split()",
    ".join()",
    ".replace()",
    ".find()",
    "List Element Assignment",
];

export class Util {
    private static instance: Util;

    // Currently DEAD CODE?
    // constructDocs: Map<string, ConstructDoc>;
    typeConversionMap: Map<DataType, Array<DataType>>;

    module: Module;

    private constructor(module?: Module) {
        if (module) {
            this.module = module;
        }

        const context = this.module.focus.getContext();

        //these cannot exist on their own, need to wrap them in a class. Otherwise they does not see the imports for the construct classes.

        //stores information about what types an object or literal of a given type can be converted to either through casting or
        //some other manipulation such as [number] or number === --- or accessing some property such as list.length > 0
        this.typeConversionMap = new Map<DataType, Array<DataType>>([
            [DataType.Void, []],
            [DataType.Number, [DataType.String, DataType.NumberList, DataType.Boolean]],
            [DataType.String, [DataType.StringList, DataType.Boolean, DataType.Number]],
            [DataType.Boolean, [DataType.BooleanList]],
            [DataType.AnyList, [DataType.Any, DataType.Number, DataType.Number]],
            [DataType.NumberList, [DataType.Number, DataType.Boolean]],
            [DataType.BooleanList, [DataType.Number, DataType.Boolean]],
            [DataType.StringList, [DataType.Number, DataType.String, DataType.Boolean]],
            [DataType.Any, [DataType.AnyList]],
        ]);

        // DEAD CODE? Nothing is done with it?
        // this.constructDocs = new Map<string, ConstructDoc>();
    }

    static getInstance(module?: Module) {
        if (!Util.instance) Util.instance = new Util(module);

        return Util.instance;
    }

    static getPopulatedInstance() {
        return Util.instance;
    }
}

export function areEqualTypes(incoming: DataType, receiving: DataType): boolean {
    if (receiving == DataType.Any) return true;
    else if (receiving == DataType.AnyList && ListTypes.indexOf(incoming) > -1) return true;
    else if (receiving == incoming) return true;

    return false;
}

/**
 * Return whether list1 contains at least one item from list2.
 */
export function hasMatch(list1: any[], list2: any[]): boolean {
    if (list2?.length == 0 || list1?.length == 0) return false;

    if (list2) {
        for (const item of list2) {
            if (list1?.indexOf(item) > -1) return true;
        }
    }

    return false;
}

/**
 * Checks if an element of list2 is equal to an element of list1. The index of the last 
 * element of list2 that also appears in list1 is returned together with the (first) index of the
 * element in list1.
 * 
 * @param list1 - The first list to compare
 * @param list2 - The second list to compare
 * @returns A tuple containing the index of the last element of list2 that also appears in list1 and the
 * index of the corresponding element in list1. If the element appears multiple times in list1, only the first
 * element is returned. The tuple [-1, -1] is returned if no match is found.
 * 
 * @example
 * const list1 = [1, 2, 3, 4, 5];
 * const list2 = [1, 3, 4, 5, 6];
 * 
 * const matchingIndices = hasMatchWithIndex(list1, list2);
 * // => [4, 3]
 */
export function hasMatchWithIndex<T>(list1: T[], list2: T[]): [number, number] {
    const matchingIndices: [number, number] = [-1, -1];

    if (list1.length === 0 || list2.length === 0) {
        return matchingIndices;
    }

    for (let i = 0; i < list2.length; i++) {
        if (list1.indexOf(list2[i]) > -1) {
            matchingIndices[0] = list1.indexOf(list2[i]);
            matchingIndices[1] = i;
        }
    }

    return matchingIndices;
}

/**
 * Check if the given object is importable.
 * NEEDS FUTURE UPDATES
 * 
 * @param object - A code construct
 * @returns true if the object is importable, false otherwise
 */
export function isImportable(object: object): object is Importable {
    console.log((object as Importable).requiredModule);
    return Object.hasOwn(object, "requiredModule") && !!(object as Importable).requiredModule; //calling hasOwnProperty with call() because 'object' is not necessarily an object
}

export function getUserFriendlyType(type: DataType): string {
    switch (type) {
        case DataType.Any:
            return "any";

        case DataType.AnyList:
            return "list";

        case DataType.Boolean:
            return "boolean";

        case DataType.BooleanList:
            return "boolean list";

        case DataType.Number:
            return "number";

        case DataType.NumberList:
            return "number list";

        case DataType.String:
            return "text";

        case DataType.StringList:
            return "text list";

        case DataType.Iterator:
            return "iterator";

        default:
            return type;
    }
}

export function createWarningButton(buttonTxt: string, warningCode: CodeConstruct, action: Function): HTMLDivElement {
    const button = document.createElement("div");
    button.innerHTML = buttonTxt;
    button.classList.add("button");
    button.onclick = () => {
        action();
    };
    addClassToDraftModeResolutionButton(button, warningCode);

    return button;
}
