import { initLanguage } from "../language-definition/parser";
import { ErrorMessage } from "../messages/error-msg-generator";
export class Language {
    module;
    language;
    reservedWords;
    constructor(module) {
        this.module = module;
        // Load the language definition file
        const langConfig = initLanguage();
        this.language = langConfig.language;
        this.reservedWords = langConfig.reservedWords;
    }
    /**
     * Get the name of the language this object represents
     *
     * @returns The name of the language
     */
    getLanguage() {
        return this.language;
    }
    /**
     * Check if the given text string appears in one of the reserved word lists
     *
     * @param word - The text to check if it is a reserved word
     * @returns true if it appears in one of the reserved lists, false otherwise
     */
    isReservedWord(word) {
        for (let words of this.reservedWords.values()) {
            if (words.has(word)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Checks if the given word is a reserved word and if so, adds a pop-up message to the editor
     * with a reason. Returns true if the word is reserved, false otherwise.
     *
     * @param word - The text to check if it is a reserved word
     * @param construct - The construct the word is part of and the message should be added to
     * @returns true if the word is reserved, false otherwise
     */
    validateReservedWord(word, construct) {
        for (let [reason, words] of this.reservedWords) {
            if (words.has(word)) {
                this.module.messageController.addPopUpMessage(construct, { identifier: word, message: reason }, ErrorMessage.general);
                return true;
            }
        }
        return false;
        // console.log(construct, word)
        // this.module.messageController.addPopUpMessage(
        //     construct,
        //     { identifier: word },
        //     ErrorMessage.identifierIsKeyword
        // );
        // return true
    }
}
//# sourceMappingURL=language.js.map