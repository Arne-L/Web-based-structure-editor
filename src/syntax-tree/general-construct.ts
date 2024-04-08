import {
    Importable,
    Construct,
    Statement,
    EmptyLineStmt,
    ImportStatement,
    TypedEmptyExpr,
    NonEditableTkn,
    IdentifierTkn,
} from "./ast";
import { Module } from "./module";
import { Scope } from "./scope";
import { DataType, InsertionType } from "./consts";
import { Validator } from "../editor/validator";
import { Context } from "../editor/focus";

/**
 * For some reason, extracting GeneralStatement to this file from ast.ts leads to an
 * "Uncaught TypeError: Class extends value undefined is not a constructor or null" error
 *
 * Possible reasons:
 * Javascript has difficulties with importing an abstract class from an other file and
 * extending a new class with it?
 *
 * Long term should the entire ast.ts file be replaced, so this should be fixed in the end
 */
