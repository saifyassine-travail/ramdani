const fetch = require('node-fetch');

// Or just using native NodeJS fetch if running Node 18+
fetch("http://127.0.0.1:8000/api/settings", {
    method: "PUT",
    headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        custom_measures: ["Test"]
    })
})
    .then(r => r.text())
    .then(t => console.log(t))
    .catch(console.error);
