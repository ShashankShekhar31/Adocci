require("dotenv").config();
const express=require("express");
const cors=require("cors");
const fs = require("fs");
const { spawn } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const OpenAI = require("openai");
const analyticsRoute = require("./routes/analytics");

const pool = require("./db");

// await pool.query("SELECT NOW()", (err, res) => {
//     if (err) {
//         console.error("DB Error:", err);
//     } else {
//         console.log("DB Connected ");
//     }
// });

pool.query("SELECT NOW()")
  .then(() => console.log("DB Connected "))
  .catch(err => console.error("DB Error:", err));

const app=express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use("/analytics", analyticsRoute);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function filterFrames(files, folder) {
    let filtered = [];
    let lastHash = null;

    for (const file of files) {
        const filePath = `${folder}/${file}`;
        const buffer = await fs.promises.readFile(filePath);

        const hash = buffer.toString('base64').slice(0, 50);

        if (hash !== lastHash) {
            filtered.push(file);
            lastHash = hash;
        }
    };
    return filtered;
}

function chunkArray(array, size) {
    let result = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

function extractFrames(videoPath, res) {
    const folder = `frames_${Date.now()}`;
    fs.mkdirSync(folder, { recursive: true });

    const outputPattern = `${folder}/frame-%03d.png`;

    console.log("FFmpeg Path:", ffmpegPath);

    const ffmpegProcess = spawn(ffmpegPath, [
        "-i", videoPath,
        "-vf", "fps=1",
        outputPattern
    ]);

    ffmpegProcess.on("close", async (code) => {
        if (code !== 0) {
            console.error("FFmpeg failed");

            if (!res.headersSent) {
                return res.status(500).json({
                    message: "Frame extraction failed"
                });
            }
            return;
        }

        console.log("Frames extracted");

        let files = fs.readdirSync(folder);
        files.sort();

        files = await filterFrames(files, folder);
        files = files.sort(() => Math.random() - 0.5);

        const MAX_FRAMES = 8;
        files = files.slice(0, MAX_FRAMES);

        if (files.length === 0) {
            return res.json({
                message: "No meaningful frames found",
                analysis: {
                    task: [],
                    apps: [],
                    steps: [],
                    issues: [],
                    suggestions: []
                }
            });
        }

        console.log("After filtering:", files.length);

        const images = await Promise.all(
            files.map(async file => {
                const imgPath = `${folder}/${file}`;
                const img = await fs.promises.readFile(imgPath);
                return img.toString("base64");
            })
        );

        console.log("Images generated:", images.length);

        analyzeWithAI(images, res, videoPath, folder);
    });

    ffmpegProcess.on("error", (err) => {
        console.error("FFmpeg Error:", err);
        if (!res.headersSent) {
            res.status(500).json({
                message: "FFmpeg failed",
                error: err.message
            });
       }
    });
}

async function analyzeWithAI(images, res, videoPath, folder) {
    try {
        const batches = chunkArray(images, 4);

        console.log({
            totalImages: images.length,
            totalBatches: batches.length
        });

        let finalResults = [];
        for (const batch of batches) {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `
                                Analyze these screenshots and extract user activity.

                                You MUST return ONLY valid JSON.

                                DO NOT include any explanation.
                                DO NOT include markdown.
                                DO NOT include text before or after JSON.

                                Return EXACTLY this format:

                                {
                                "task": "Short description of what user is doing",
                                "apps": ["list of apps or websites"],
                                "steps": ["step-by-step actions"],
                                "issues": ["problems or errors"],
                                "suggestions": ["improvements"]
                                }
                                
                                Rules:
                                - NEVER leave fields empty if something is visible
                                - Infer reasonable steps if unclear
                                - Be concise
                                `
                            },

                            ...batch.map(img => ({
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${img}`
                                }
                            }))
                        ]
                    }
                ]
            });

            const content = response.choices[0].message.content;
            try {
            let cleaned = content.trim();

            if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "").trim();
            }

            const start = cleaned.indexOf("{");
            const end = cleaned.lastIndexOf("}");

            if (start !== -1 && end !== -1) {
                cleaned = cleaned.substring(start, end + 1);
            }

            const parsed = JSON.parse(cleaned);
            finalResults.push(parsed);

            } catch (e) {
                console.log("Parse failed. Raw content:", content);
                finalResults.push({});
            }
        }
        const merged = {
            task: [],
            apps: [],
            steps: [],
            issues: [],
            suggestions: []
        };

        finalResults.forEach(r => {
            if (r.task) merged.task.push(r.task);
            if (r.apps) merged.apps.push(...r.apps);
            if (r.steps) merged.steps.push(...r.steps);
            if (r.issues) merged.issues.push(...r.issues);
            if (r.suggestions) merged.suggestions.push(...r.suggestions);
        });

        if (merged.task.length === 0) merged.task = ["No task detected"];

        merged.task = [...new Set(merged.task)];
        merged.apps = [...new Set(merged.apps)];
        merged.steps = [...new Set(merged.steps)];
        merged.issues = [...new Set(merged.issues)];
        merged.suggestions = [...new Set(merged.suggestions)];

        const score = 100 - (merged.issues.length * 10) + (merged.steps.length * 5);
        const finalScore = Math.max(0, Math.min(100, score));

        try {
            await pool.query(
                `INSERT INTO analyses (filename, task, apps, steps, issues, suggestions, productivity_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                    videoPath,
                    JSON.stringify(merged.task),
                    JSON.stringify(merged.apps),
                    JSON.stringify(merged.steps),
                    JSON.stringify(merged.issues),
                    JSON.stringify(merged.suggestions),
                    finalScore
                ]
            );

            console.log("Saved to DB ");
        } catch (dbErr) {
            console.error("DB Insert Error:", dbErr);
        }

        console.log("AI Results:", finalResults);

        try {
            await fs.promises.unlink(videoPath);
            await fs.promises.rm(folder, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }
        if (!res.headersSent) {
            return res.json({
                message: "Analysis complete",
                analysis: merged
            });
        }

    } catch (err) {
        console.error("AI Error:", err);
        res.json({
            message: "AI failed",
            error: err.message
        });
    }
}

app.get("/", (req,res)=>{
    res.send("Backend is running");
});

app.post("/analyze", async (req,res)=>{
    const { video } =req.body;

    if(!video){
        return res.status(400).json({
            message: "No video received"
        });
    }
    const base64Data = video.replace(/^data:video\/\w+;base64,/, "");
    const videoPath = `video_${Date.now()}.webm`;

    await fs.promises.writeFile(videoPath, base64Data, "base64");

    console.log("Video saved:", videoPath);

    extractFrames(videoPath, res);

});

app.get("/history", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM analyses ORDER BY created_at DESC"
        );

        res.json(result.rows);

    } catch (err) {
        console.error("History Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        task TEXT,
        apps TEXT,
        steps TEXT,
        issues TEXT,
        suggestions TEXT
      );
    `);

    res.send("Table created");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`);
});