const express = require("express");
const router = express.Router();
const pool = require("../db");

function getCategory(score) {
    if (score >= 75) return "Good";
    if (score >= 40) return "Average";
    return "Poor";
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM analyses");
    const sessions = result.rows;

    let appUsage = {};
    let issueCount = 0;
    let totalScore = 0;

    sessions.forEach(session => {
        const apps = Array.isArray(session.apps)
            ? session.apps
            : (session.apps ? JSON.parse(session.apps) : []);
        const steps = Array.isArray(session.steps)
            ? session.steps
            : (session.steps ? JSON.parse(session.steps) : []);
        const issues = Array.isArray(session.issues)
            ? session.issues
            : (session.issues ? JSON.parse(session.issues) : []);

        const uniqueApps = [...new Set(apps)];
        uniqueApps.forEach(app => {
            appUsage[app] = (appUsage[app] || 0) + 1;
        });

        issueCount += issues.length;

        let score = 100 - (issues.length * 10) + (steps.length * 5);
        score = Math.max(0, Math.min(100, score));

        totalScore += score;
    });

    const totalSessions = sessions.length;

    if (totalSessions === 0) {
      return res.json({
        totalSessions: 0,
        totalIssues: 0,
        avgIssuesPerSession: 0,
        topApps: [],
        avgProductivity: 0,
        productivityLevel: "N/A"
      });
    }

    const sortedApps = Object.entries(appUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const avgProductivity = (totalScore / totalSessions).toFixed(2);

    res.json({
        totalSessions,
        totalIssues: issueCount,
        avgIssuesPerSession: (issueCount / totalSessions).toFixed(2),
        topApps: sortedApps,
        avgProductivity,
        productivityLevel: getCategory(Number(avgProductivity))
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err); 
    res.status(500).json({ 
        error: "Analytics failed",
        message: err.message  
        });
    }
});

module.exports = router;