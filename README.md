# 🚀 AI Screen Activity Analyzer (Chrome Extension + AI)

An intelligent Chrome Extension that records user screen activity, extracts key frames, and uses AI to analyze productivity, detect issues, and provide actionable insights.

---

## 🎯 Features

* 🎥 Screen recording using Chrome Extension
* 📤 Upload recordings to backend
* 🧠 AI-powered analysis (OpenAI)
* 🖼️ Frame extraction using FFmpeg
* 📊 Productivity scoring & insights
* 📈 Analytics dashboard (charts + trends)
* 🗄️ PostgreSQL database storage
* ☁️ Deployed on Render

---

## 🏗️ Tech Stack

### Frontend (Extension)

* JavaScript
* Chrome Extension APIs
* Chart.js

### Backend

* Node.js
* Express.js
* PostgreSQL

### AI & Processing

* OpenAI API
* FFmpeg (frame extraction)

### Deployment

* Render

---

## ⚙️ Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/ShashankShekhar31/Adocci.git
cd Adocci
```

---

### 2️⃣ Install Dependencies

```bash
cd backend
npm install
```

---

### 3️⃣ Create `.env` File (IMPORTANT 🔑)

Create a `.env` file inside the `backend` folder and add:

```env
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=your_postgresql_connection_url
PORT=5000
```

👉 Example:

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
PORT=5000
```

---

### 4️⃣ Run Backend

```bash
node server.js
```

---

### 5️⃣ Load Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

---

## 🧠 How It Works

1. User records screen via extension
2. Video is uploaded to backend
3. FFmpeg extracts frames
4. Frames are sent to OpenAI
5. AI generates:

   * Task summary
   * Apps used
   * Steps taken
   * Issues detected
   * Suggestions
6. Data is stored in PostgreSQL
7. Analytics dashboard shows insights

---

## 📊 Analytics Provided

* Total sessions
* Average issues per session
* Productivity score (0–100)
* Productivity level (Good / Average / Poor)
* App usage trends
* Daily productivity trends
* Best & worst session detection

---

## 🚀 Deployment

Backend deployed on Render:

👉 https://adocci.onrender.com

---

## ⚠️ Important Notes

* Do NOT commit `.env` file
* Add `.env` to `.gitignore`
* FFmpeg is required for frame extraction
* Free Render instance may sleep (delay in response)

---

## 📌 Future Improvements

* Video compression before upload
* Real-time analysis
* User authentication
* Dashboard UI improvements
* Session history filtering

---

## 👨‍💻 Author

**Shashank Shekhar**

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!
