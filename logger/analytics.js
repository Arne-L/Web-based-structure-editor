import { sendEventsBatch } from "./requests";
import { getUser } from "./user";
export const ANALYTICS_ENABLED = false; // Can remove export
/**
 * Indicates the action type that needs to be logged
 */
export var LogType;
(function (LogType) {
    LogType["DraftHelpUsed"] = "draft-help-used";
    LogType["InsertCode"] = "insert-code";
    LogType["UseCaseSlideUsage"] = "use-case-slide-usage";
    LogType["TooltipItemUsage"] = "tooltip-item-usage";
    LogType["TooltipHoverDuration"] = "tooltip-hover-duration";
    LogType["RunMainCode"] = "run-main-code";
})(LogType || (LogType = {}));
export class LogEvent {
    type;
    data;
    constructor(type, data) {
        this.data = data;
        this.type = type;
    }
}
export class Logger {
    interval;
    maxSize;
    queue = [];
    static instance;
    constructor(interval = 10000, maxSize = 25) {
        this.maxSize = maxSize;
        this.interval = interval;
        this.dispatchEvents = this.dispatchEvents.bind(this);
        if (ANALYTICS_ENABLED)
            setInterval(this.dispatchEvents, interval);
    }
    static Instance() {
        if (!Logger.instance)
            Logger.instance = new Logger();
        return Logger.instance;
    }
    queueEvent(event) {
        if (ANALYTICS_ENABLED) {
            console.log(event);
            this.queue.push(event);
            if (this.queue.length >= this.maxSize)
                this.dispatchEvents();
        }
    }
    dispatchEvents() {
        if (this.queue.length === 0 || !ANALYTICS_ENABLED)
            return;
        sendEventsBatch(this.queue, getUser(), "nova-editor")
            .then(() => {
            console.log(`batch of ${this.queue.length} events sent successfully`);
            this.queue = [];
        })
            .catch(() => {
            console.error(`failed to send batch of ${this.queue.length} events. will retry ${this.interval}ms later`);
        });
    }
}
//# sourceMappingURL=analytics.js.map