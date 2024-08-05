import axios from "axios";
const baseUrl = ""; //"https://nova.majeed.cc/api";
export function sendEventsBatch(events, user, app) {
    return axios({
        method: "post",
        url: `${baseUrl}/events/batch`,
        data: {
            user,
            app,
            events,
        },
    });
}
//# sourceMappingURL=requests.js.map