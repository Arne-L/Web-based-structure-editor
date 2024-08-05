export class NotificationManager {
    module;
    constructor(module) {
        this.module = module;
    }
    /**
     * Shows a notification, indicating that the user can also insert the statement by typing.
     *
     * @param action - The action to show a notification for.
     */
    showTypingMessage(action) {
        const keys = this.generateKeys(action.matchString, action.terminatingChars);
        let codeHtml = action.optionName.replace(/---/g, "<expr-hole></expr-hole>");
        codeHtml = codeHtml.replace(/--/g, "<id-hole></id-hole>");
        const headerMessage = `Insert the <span class="code">${codeHtml}</span> statement by typing:`;
        let notificationEl = document.createElement("div");
        notificationEl.classList.add("notification-container");
        document.body.appendChild(notificationEl);
        let messageEl = document.createElement("div");
        messageEl.classList.add("message");
        messageEl.innerHTML = headerMessage;
        notificationEl.appendChild(messageEl);
        setTimeout(() => {
            notificationEl.classList.add("animate");
        }, 50);
        setTimeout(() => {
            document.body.removeChild(notificationEl);
        }, 5000 + 500 * keys.length);
        let keyIndex = 0;
        const keyAnimationContainer = document.createElement("div");
        keyAnimationContainer.classList.add("key-animation-container");
        notificationEl.appendChild(keyAnimationContainer);
        let interval = setInterval(() => {
            if (keyIndex < keys.length) {
                const keySpan = document.createElement("span");
                keySpan.classList.add("key-span");
                keySpan.innerHTML = keys[keyIndex];
                keyIndex++;
                keyAnimationContainer.appendChild(keySpan);
            }
            else {
                clearInterval(interval);
            }
        }, 500);
    }
    showNotification(message) {
        let notification = document.createElement("div");
        notification.classList.add("notification-container");
        notification.innerHTML = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add("animate");
        }, 50);
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
    }
    generateKeys(matchString, terminatingChars) {
        const keys = [];
        for (let i = 0; i < matchString.length; i++) {
            keys.push(matchString[i]);
        }
        for (let i = 0; i < terminatingChars.length; i++) {
            let key = terminatingChars[i];
            if (key === " ")
                key = "space";
            keys.push(key);
        }
        return keys;
    }
}
//# sourceMappingURL=notifications.js.map