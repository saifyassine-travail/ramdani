const fetch = require('node-fetch');

async function test() {
    try {
        // 1. Get settings first
        const getRes = await fetch("http://127.0.0.1:8000/api/settings", {
            headers: {
                "Accept": "application/json"
            }
        });
        console.log("GET Response:", getRes.status, await getRes.text());
    } catch (e) {
        console.error(e);
    }
}
test();
