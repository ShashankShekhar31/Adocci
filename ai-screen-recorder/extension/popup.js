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
let chartInstance = null;
let trendChartInstance = null;

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const status = document.getElementById("status");

const parseSafe = (data) => {
    if (!data) return [];
    try {
        return Array.isArray(data) ? data : JSON.parse(data);
    } catch {
        return [];
    }
};

startBtn.onclick = () => {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }
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
            status.style.color = "red";

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
                const response = await fetch("https://adocci.onrender.com/analyze", {
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
                    document.getElementById("loader").style.display = "none";
                    status.innerText = "Status: Server Error";
                    status.style.color = "red";
                    return;
                }

                status.innerText = "Status: Processing...";
                status.style.color = "orange";
                document.getElementById("result").innerText = "AI is analyzing your recording...";

                const data = await response.json();
                console.log("Backend response:", data);

                document.getElementById("loader").style.display = "none";

                
                displayResult(data.analysis || {});
                
                startBtn.disabled = false;
                stopBtn.disabled = true;

                status.innerText ="Status: Completed ";
                status.style.color = "green";

            } catch (err) {
                status.innerText = "Status: Error ";
                status.style.color = "red";
                document.getElementById("loader").style.display = "none";
            }
        };
    };

    status.innerText = "Status: Processing... ";
    stopBtn.disabled = true;
};

function displayResult(data) {
    const container = document.getElementById("result");

    container.innerHTML = `
        <div class="card">
            <h3> Task</h3>
            <p>${(data.task || []).join(", ")}</p>
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
    container.scrollTop = 0;
}

function displayHistory(data) {
    const container = document.getElementById("result");

    historyCache = data;

    if (!data || data.length === 0) {
        container.innerHTML = "<p>No history found</p>";
        return;
    }

    container.innerHTML = data.map(item => {
        const apps = parseSafe(item.apps);
        const task = item.task || "N/A";

        return`
        <div class="card history-item" onclick='showDetails(${item.id})'>
            <h3> ${new Date(item.created_at).toLocaleString()}</h3>

            <p><b>Task:</b> ${task}</p>
            <p><b>Apps:</b> ${apps.join(", ")}</p>
        </div>
        `;
    }).join("");
}

function showDetails(id) {
    const item = historyCache.find(i => i.id === id);

    if (!item) return;

    const apps = parseSafe(item.apps);
    const steps = parseSafe(item.steps);
    const issues = parseSafe(item.issues);
    const suggestions = parseSafe(item.suggestions);

    const container = document.getElementById("result");

    container.innerHTML = `
        <button onclick="loadHistory()">⬅ Back</button>

        <div class="card">
            <h3> Task</h3>
            <p>${item.task || "N/A"}</p>
        </div>

        <div class="card">
            <h3> Apps</h3>
            <ul>${apps.map(a => `<li>${a}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Steps</h3>
            <ul>${steps.map(s => `<li>${s}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Issues</h3>
            <ul>${issues.map(i => `<li>${i}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Suggestions</h3>
            <ul>${suggestions.map(s => `<li>${s}</li>`).join("")}</ul>
        </div>

        <div class="card">
            <h3> Timeline</h3>
            <div class="timeline">
                ${steps.map((step, index) => `
                    <div class="timeline-item">
                        <span class="time">Step ${index + 1}</span>
                        <p>${step}</p>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

function loadHistory() {
    document.getElementById("historyBtn").click();
}

document.getElementById("historyBtn").onclick = async () => {
    const container = document.getElementById("result");

    status.innerText = "Status: Loading history...";
    status.style.color = "orange";
    container.innerHTML = " Loading history...";
    document.getElementById("loader").style.display = "block";

    startBtn.disabled = false;
    stopBtn.disabled = true;

    try {
        const response = await fetch("https://adocci.onrender.com/history");
        const data = await response.json();

        console.log("History Data:", data);

        document.getElementById("loader").style.display = "none";

        displayHistory(data);

        status.innerText = "Status: History Loaded ";
        status.style.color = "green";
    } catch (err) {
        console.error("History Error:", err);
        container.innerHTML = " Error loading history";
        status.innerText = "Status: Error";
    }
};

document.getElementById("loadAnalytics").addEventListener("click", loadAnalytics);

async function loadAnalytics() {
    const summaryDiv = document.getElementById("summary");
    const analyticsBtn = document.getElementById("loadAnalytics");

    analyticsBtn.disabled = true;

    try {
        const res = await fetch("https://adocci.onrender.com/analytics");
        const data = await res.json();

        summaryDiv.innerHTML = `
        <div class="card">
            <h3>Overview</h3>
            <p><b>Sessions:</b> ${data.totalSessions}</p>
            <p><b>Avg Issues:</b> ${data.avgIssuesPerSession}</p>
            <p><b>Score:</b> ${data.avgProductivity}</p>
            <p><b>Level:</b> ${data.productivityLevel}</p>

            <hr>

            <h4>Insights</h4>
            <p>Best: ${data.bestSession ? `#${data.bestSession.id} (${data.bestSession.score})` : "N/A"}</p>
            <p>Worst: #${data.worstSession?.id} (${data.worstSession?.score})</p>
            <p>Trend: ${data.improvement}</p>
        </div>
    `;

    let message = "";

    if (data.improvement === "Improving") {
        message = "You're getting better over time";
    } else if (data.improvement === "Declining") {
        message = "Performance is dropping. Review issues ";
    } else {
        message = "Performance is stable.";
    }

    summaryDiv.innerHTML += `<p><b>${message}</b></p>`;

    summaryDiv.innerHTML += `
    <p>Focus Area: Reduce issues in low-score sessions</p>
    `;

    let color = "red";

    if (data.avgProductivity >= 75) color = "green";
    else if (data.avgProductivity >= 40) color = "orange";

    summaryDiv.innerHTML += `
    <p style="color:${color}; font-weight:bold;">
        ${data.productivityLevel}
    </p>
    `;

    if (!data.topApps || data.topApps.length === 0) {
      summaryDiv.innerHTML += `<p>No analytics data available yet.</p>`;
      return; 
    }

    if (!data.totalSessions) {
        summaryDiv.innerHTML = "<p>No data yet. Record something first.</p>";
        analyticsBtn.disabled = false;
        return;
    }

    renderChart(data.topApps);

    renderTrendChart(data.productivityTrend);

    analyticsBtn.disabled = false;

    } catch (err) {
        summaryDiv.innerHTML = "<p style='color:red;'>Failed to load analytics</p>";
        analyticsBtn.disabled = false;
        document.getElementById("loader").style.display = "none";
    }
}

function renderChart(topApps) {
    if (!topApps || topApps.length === 0) return;

    const ctx = document.getElementById("appChart");

    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = topApps.map(a => a[0]);
    const values = topApps.map(a => a[1]);

    chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
        labels,
        datasets: [{
            label: "Top Apps Usage",
            data: values
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true
            }
        }
    }
});
}

function renderTrendChart(trendData) {
    if (!trendData || trendData.length === 0) return;

    const ctx = document.getElementById("trendChart");

    if (trendChartInstance) {
        trendChartInstance.destroy();
    }

    const labels = trendData.map(t => t.date);
    const values = trendData.map(t => Number(t.avgScore));

    trendChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Productivity Score",
                data: values
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

window.onload = () => {
  loadAnalytics();
};