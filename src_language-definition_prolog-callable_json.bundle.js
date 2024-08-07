"use strict";
(self["webpackChunknova_editor"] = self["webpackChunknova_editor"] || []).push([["src_language-definition_prolog-callable_json"],{

/***/ "./src/language-definition/prolog-callable.json":
/*!******************************************************!*\
  !*** ./src/language-definition/prolog-callable.json ***!
  \******************************************************/
/***/ ((module) => {

module.exports = JSON.parse('[{"name":"body","format":[{"type":"token","value":"\\n"},{"type":"compound","scope":true,"insertBefore":null,"enableIndentation":true,"format":[{"type":"compound","scope":false,"insertBefore":null,"enableIndentation":false,"format":[{"type":"token","value":"    "},{"type":"hole","elements":[{"type":"term","elements":true}]},{"type":"token","value":",","waitOnUser":","},{"type":"token","value":"\\n"}]},{"type":"token","value":";","waitOnUser":";"},{"type":"token","value":"\\n"}]},{"type":"token","value":"."}]},{"name":"arguments","format":[{"type":"identifier","regex":"^[a-zA-Z_][a-zA-Z0-9_]*$","scopeType":"localChild","reference":"variable"},{"type":"compound","scope":false,"insertBefore":null,"format":[{"type":"token","value":",","waitOnUser":","},{"type":"identifier","regex":"^[a-zA-Z_][a-zA-Z0-9_]*$","scopeType":"localChild","reference":"variable"}]}]},{"name":"arguments_bodyless","format":[{"type":"editable","regex":"^[a-zA-Z_][a-zA-Z0-9_]*$"},{"type":"compound","scope":false,"insertBefore":null,"format":[{"type":"token","value":",","waitOnUser":","},{"type":"editable","regex":"^[a-zA-Z_][a-zA-Z0-9_]*$"}]}]},{"name":"callArguments","format":[{"type":"hole","elements":[{"type":"term","optional":false}]},{"type":"compound","scope":false,"insertBefore":null,"format":[{"type":"token","value":",","waitOnUser":","},{"type":"hole","elements":[{"type":"expression","optional":false}]}]}]}]');

/***/ })

}]);