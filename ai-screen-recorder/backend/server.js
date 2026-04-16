require("dotenv").config();
const express=require("express");
const cors=require("cors");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobe = require("ffprobe-static");
const OpenAI = require("openai");

const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "screen_analyzer",
    password: "Shashank@31",
    port: 5432,
});

pool.query("SELECT NOW()", (err, res) => {
    if (err) {
        console.error("DB Error:", err);
    } else {
        console.log("DB Connected ");
    }
});

const app=express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

function filterFrames(files, folder) {
    let filtered = [];
    let lastHash = null;

    files.forEach(file => {
        const filePath = `${folder}/${file}`;
        const buffer = fs.readFileSync(filePath);

        const hash = buffer.toString('base64').slice(0, 50);

        if (hash !== lastHash) {
            filtered.push(file);
            lastHash = hash;
        }
    });
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

    ffmpeg(videoPath)
        .outputOptions([
            '-vf', 'fps=1'
        ])
        .output(`${folder}/frame-%03d.png`)
        .on('end', () => {
            console.log("Frames extracted");

            let files = fs.readdirSync(folder);

            files.sort();

            files = filterFrames(files, folder);

            files = files.sort(() => Math.random() - 0.5);

            const MAX_FRAMES = 8;
            files = files.slice(0, MAX_FRAMES);

            if (files.length === 0) {
                console.log("No meaningful frames found");

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

            const images = files.map(file => {
                const imgPath = `${folder}/${file}`;
                const img = fs.readFileSync(imgPath);
                return img.toString("base64");
            });

            analyzeWithAI(images, res, videoPath, folder);
        })
        .on("error", (err) => {
        console.error("FFmpeg Error:", err);
        res.status(500).json({
            message: "Frame extraction failed",
            error: err.message
        });
    })
    .run();
}

async function analyzeWithAI(images, res, videoPath, folder) {
    try {
        const batches = chunkArray(images, 4);

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
                                You MUST return ONLY valid JSON.

                                DO NOT include any explanation.
                                DO NOT include markdown.
                                DO NOT include text before or after JSON.

                                Return EXACTLY this format:

                                {
                                "task": "",
                                "apps": [],
                                "steps": [],
                                "issues": [],
                                "suggestions": []
                                }
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

        merged.task = [...new Set(merged.task)];
        merged.apps = [...new Set(merged.apps)];
        merged.steps = [...new Set(merged.steps)];
        merged.issues = [...new Set(merged.issues)];
        merged.suggestions = [...new Set(merged.suggestions)];

        try {
            await pool.query(
                `INSERT INTO analyses (filename, task, apps, steps, issues, suggestions)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    videoPath,
                    merged.task,
                    merged.apps,
                    merged.steps,
                    merged.issues,
                    merged.suggestions
                ]
            );

            console.log("Saved to DB ");
        } catch (dbErr) {
            console.error("DB Insert Error:", dbErr);
        }

        console.log("AI Results:", finalResults);

        if (!res.headersSent) {
            res.json({
                message: "Analysis complete",
                analysis: merged
            });
        }
        try {
            fs.unlinkSync(videoPath);
            fs.rmSync(folder, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
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

app.post("/analyze",(req,res)=>{
    const { video } =req.body;

    if(!video){
        return res.status(400).json({
            message: "No video received"
        });
    }
    const base64Data = video.replace(/^data:video\/webm;base64,/, "");
    const videoPath = `video_${Date.now()}.webm`;

    fs.writeFileSync(videoPath, base64Data, "base64");

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

const PORT=5000;
app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`);
});