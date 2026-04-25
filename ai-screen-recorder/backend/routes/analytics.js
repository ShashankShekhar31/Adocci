const express = require("express");
const router = express.Router();
const pool = require("../db");

function getCategory(score) {
    if (score >= 75) return "Good";
    if (score >= 40) return "Average";
    return "Poor";
}

const parseSafe = (data) => {
    try {
        if (!data) return [];
        return Array.isArray(data) ? data : JSON.parse(data);
    } catch {
        return [];
    }
};

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM analyses");
    const sessions = result.rows;

    let appUsage = {};
    let issueCount = 0;
    let totalScore = 0;
    let dailySessions = {};
    let dailyProductivity = {};
    let bestSession = null;
    let worstSession = null;
    let improvement = "Stable";

    sessions.forEach(session => {
        const dateObj = new Date(session.created_at);
        const date = dateObj.toISOString().split("T")[0];
        const apps = parseSafe(session.apps || "[]");
        const steps = parseSafe(session.steps || "[]");
        const issues = parseSafe(session.issues || "[]");

        const uniqueApps = [...new Set(apps)];
        uniqueApps.forEach(app => {
            appUsage[app] = (appUsage[app] || 0) + 1;
        });

        issueCount += issues.length;

        const score = session.productivity_score || 0;

        totalScore += score;

        dailySessions[date] = (dailySessions[date] || 0) + 1;

        if (!dailyProductivity[date]) {
            dailyProductivity[date] = { total: 0, count: 0 };
        }

        dailyProductivity[date].total += score;
        dailyProductivity[date].count += 1;

        if (!bestSession || score > bestSession.score) {
            bestSession = { 
                id: session.id, 
                score,
                date: session.created_at 
            };
        }

        if (!worstSession || score < worstSession.score) {
            worstSession = { id: session.id, score };
        }
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

    const productivityTrend = Object.entries(dailyProductivity)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([date, data]) => ({
        date,
        avgScore: Number((data.total / data.count).toFixed(2))
    }));

    const sortedDailySessions = Object.entries(dailySessions)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .reduce((acc, [date, count]) => {
        acc[date] = count;
        return acc;
    }, {});

    if (productivityTrend.length >= 2) {
        const first = Number(productivityTrend[0].avgScore);
        const last = Number(productivityTrend[productivityTrend.length - 1].avgScore);

        if (last > first) improvement = "Improving";
        else if (last < first) improvement = "Declining";
    }

    res.json({
        totalSessions,
        totalIssues: issueCount,
        avgIssuesPerSession: (issueCount / totalSessions).toFixed(2),
        topApps: sortedApps,
        avgProductivity,
        productivityLevel: getCategory(Number(avgProductivity)),
        dailySessions: sortedDailySessions,
        productivityTrend,
        bestSession: bestSession || null,
        worstSession: worstSession || null,
        improvement: improvement || "Stable"
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err); 
    res.status(500).json({ 
        error: "Analytics failed",
        message: err.message  
        });
    }
});

router.get("/history", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, created_at, productivity_score
            FROM analyses
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;