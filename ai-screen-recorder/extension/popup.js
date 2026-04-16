// let mediaRecorder;
// let recordedChunks = [];

// const startBtn = document.getElementById("start");
// const stopBtn = document.getElementById("stop");
// const status = document.getElementById("status");
// const preview = document.getElementById("preview");

// startBtn.onclick = () => {
//   chrome.runtime.onMessage.addListener({ type: "START_RECORDING" });
//   status.innerText = "Status: Recording...";
// };

// stopBtn.onclick = () => {
//   chrome.runtime.onMessage.addListener({ type: "STOP_RECORDING" });
//   status.innerText = "Status: Stopped";
// };

// chrome.runtime.onMessage.addListener((message) => {
//   if (message.type === "RECORDING_READY") {

//     chrome.runtime.sendMessage({ type: "GET_RECORDING" }, (response) => {
//       const blob = response.blob;

//       const url = URL.createObjectURL(blob);

//       preview.src = url;
//       preview.style.display = "block";

//       status.innerText = "Status: Preview Ready";
//     });
//   }
// });

// document.getElementById("start").addEventListener("click", async ()=>{
//     recordedChunks = [];

//     try{
//         const stream = await chrome.tabCapture.capture()({ 
//             video: true,
//             audio: true
//         });
//         if (!stream) {
//                 console.error("Tab capture failed ");
//                 status.innerText = "Status: Error ";
//                 return;
//             }
//         mediaRecorder = new MediaRecorder(stream);

//         mediaRecorder.ondataavailable = (event)=>{
//             if(event.data.size > 0){
//                 recordedChunks.push(event.data);
//             }
//         };
//         mediaRecorder.start();
//         status.innerText = "Status: Recording Tab...";
//         console.log("Recording started");
//     } catch (err){
//         console.log("Error:", err);
//     }
// });

// document.getElementById("stop").addEventListener("click", ()=>{
//     if (!mediaRecorder) {
//         console.error("No recording found ");
//         return;
//     }
//     mediaRecorder.stop();

//     mediaRecorder.onstop = async ()=>{
//         console.log("Recording stopped");

//         const blob=new Blob(recordedChunks, {
//             type: "video/webm"
//         });

//         const reader = new FileReader();
//         reader.readAsArrayBuffer(blob);

//         reader.onloadend = async ()=>{
//             const base64 = reader.result;

//             console.log("Sending video to backend...");
//             try{
//                 const response = await fetch("http://localhost:5000/analyze",{
//                     method: "POST",
//                     headers:{
//                         "Content-Type": "application/json"
//                     },
//                     body: JSON.stringify({
//                         video: base64
//                    })
//                 });
//                 const result = await response.json();
//                 console.log("Backend response:", result);

//                 status.innerText = "Status: Sent to Backend ";
//             } catch (err) {
//                 console.error("Error:", err);
//                 status.innerText = "Status: Error ";
//             }
//        };
//     };
//     status.innerText = "Status: Stopped";
// });
let mediaRecorder;
let recordedChunks = [];
let historyCache = [];

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const status = document.getElementById("status");

startBtn.onclick = () => {
    recordedChunks = [];

    startBtn.disabled = true;
    stopBtn.disabled = false;

    document.getElementById("result").innerHTML = "";
    

    chrome.tabCapture.capture(
        {
            audio: true,
            video: true
        },
        (stream) => {
            if (!stream) {
                console.error("Tab capture failed ");
                status.innerText = "Status: Error ";
                return;
            }

            mediaRecorder = new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.start();
            status.innerText = "Status: Recording ";

            console.log("Tab recording started");
        }
    );
};

stopBtn.onclick = () => {
    if (!mediaRecorder) {
        console.error("No recording found ");
        return;
    }

    mediaRecorder.stop();

    mediaRecorder.onstop = async () => {
        console.log("Recording stopped");

        const blob = new Blob(recordedChunks, {
            type: "video/webm"
        });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `recording_${Date.now()}.webm`;

        document.body.appendChild(a);
        a.click();

        URL.revokeObjectURL(url);

        const reader = new FileReader();
        reader.readAsDataURL(blob);

        reader.onloadend = async () => {
            const base64 = reader.result;

            console.log("Sending video to backend...");
            
            document.getElementById("loader").style.display = "block";
            try {
                const response = await fetch("http://localhost:5000/analyze", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        video: base64
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Server Error:", errorText);
                    return;
                }

                status.innerText = "Status: Processing...";
                document.getElementById("result").innerText = "Analyzing screen...";

                const data = await response.json();
                console.log("Backend response:", data);

                document.getElementById("loader").style.display = "none";

                
                displayResult(data.analysis);
                
                startBtn.disabled = false;
                stopBtn.disabled = true;

                status.innerText ="Status: Completed ";

            } catch (err) {
                // console.error("Error:", err);
                status.innerText = "Status: Error ";
            }
        };
    };

    status.innerText = "Status: Processing... ";
};

function displayResult(data) {
    const container = document.getElementById("result");

    container.innerHTML = `
        <div class="card">
            <h3> Task</h3>
            <p>${data.task?.join(", ") || "N/A"}</p>
        </div>

        <div class="card">
            <h3> Apps</h3>
            <ul>${(data.apps || []).map(a => `<li>${a}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Steps</h3>
            <ul>${(data.steps || []).map(s => `<li>${s}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Issues</h3>
            <ul>${(data.issues || []).map(i => `<li>${i}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Suggestions</h3>
            <ul>${(data.suggestions || []).map(s => `<li>${s}</li>`).join("")}</ul>
        </div>
    `;
}

function displayHistory(data) {
    const container = document.getElementById("result");

    historyCache = data;

    if (!data || data.length === 0) {
        container.innerHTML = "<p>No history found</p>";
        return;
    }

    container.innerHTML = data.map(item => `
    <div class="card history-item" onclick='showDetails(${item.id})'>
        <h3> ${new Date(item.created_at).toLocaleString()}</h3>
        <p><b>Task:</b> ${(item.task || []).join(", ")}</p>
        <p><b>Apps:</b> ${(item.apps || []).join(", ")}</p>
    </div>
`).join("");
}

function showDetails(id) {
    const item = historyCache.find(i => i.id === id);

    if (!item) return;

    const container = document.getElementById("result");

    container.innerHTML = `
        <button onclick="loadHistory()">⬅ Back</button>

        <div class="card">
            <h3> Task</h3>
            <p>${(item.task || []).join(", ")}</p>
        </div>

        <div class="card">
            <h3> Apps</h3>
            <ul>${(item.apps || []).map(a => `<li>${a}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Steps</h3>
            <ul>${(item.steps || []).map(s => `<li>${s}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Issues</h3>
            <ul>${(item.issues || []).map(i => `<li>${i}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Suggestions</h3>
            <ul>${(item.suggestions || []).map(s => `<li>${s}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Timeline</h3>
            <div class="timeline">
                ${(item.steps || []).map((step, index) => `
                    <div class="timeline-item">
                        <span class="time">Step ${index + 1}</span>
                        <p>${step}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `;

    const steps = item.steps || [];

    const timelineHTML = steps.map((step, index) => `
        <div class="timeline-item">
            <span class="time">Step ${index + 1}</span>
            <p>${step}</p>
        </div>
    `).join("");
}

function loadHistory() {
    document.getElementById("historyBtn").click();
}

document.getElementById("historyBtn").onclick = async () => {
    const container = document.getElementById("result");

    status.innerText = "Status: Loading history...";
    container.innerHTML = " Loading history...";
    document.getElementById("loader").style.display = "block";

    startBtn.disabled = false;
    stopBtn.disabled = true;

    try {
        const response = await fetch("http://localhost:5000/history");
        const data = await response.json();

        console.log("History Data:", data);

        document.getElementById("loader").style.display = "none";

        displayHistory(data);

        status.innerText = "Status: History Loaded ";
    } catch (err) {
        console.error("History Error:", err);
        container.innerHTML = " Error loading history";
        status.innerText = "Status: Error";
    }
};