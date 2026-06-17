# BigQuery Release Notes Hub

A modern, responsive, and aesthetically premium Flask web application designed to fetch, parse, search, filter, and share Google Cloud BigQuery Release Notes.

The application converts Google's raw XML release notes feed into segmented, categorised update cards and features full Light/Dark mode themes and an integrated in-app **Twitter Composer & Preview Card** with accurate URL character counting.

---

## ✨ Features

- **Granular Segmenter:** Breaks down bulk daily logs into clean, single-subject cards categorized as `Feature`, `Breaking Change`, `Issue`, `Announcement`, `Change`, or `General Update`.
- **Search & Filtering:** Dynamic, client-side full-text search and category filtering with instant sidebar count updates.
- **Glassmorphic UI Design:** Translucent panels, glowing borders, card hover scales, and clean loaders styled using modern CSS tokens.
- **Dark & Light Themes:** Native, variable-based theme toggling backed by persistent `localStorage` browser settings.
- **Custom Twitter Composer:**
  - Standard, Technical, and Short template presets.
  - Interactive tweet text editor with a simulated live X UI card.
  - Dynamic URL length compensator (handling links as exactly 23 characters matching Twitter's API wrapper) to accurately track the 280-character limit.
- **Backend memory Cache:** Keeps the application fast and prevents Google feed servers from rate-limiting requests.

---

## 🛠️ Tech Stack

- **Backend:** Python (Flask, BeautifulSoup4, Requests)
- **Frontend:** Plain HTML5, CSS3 (CSS Variables, Flexbox, Grid), Vanilla JavaScript

---

## 📂 Project Structure

```text
bigquery-release-notes/
│
├── app.py                  # Flask application & Atom feed parser
├── requirements.txt        # PIP dependencies
├── README.md               # Project documentation
├── .gitignore              # Git ignore exclusions
│
├── templates/
│   └── index.html          # Frontend HTML structure
│
└── static/
    ├── css/
    │   └── style.css       # Layout styles & Light/Dark themes
    └── js/
        └── main.js         # State management, search, and Tweet modal
```

---

## 🚀 Setup and Launch

### 1. Prerequisites
Ensure you have Python 3.12 (or higher) installed on your system.

### 2. Install Dependencies
Navigate to the project directory and install the required packages:
```powershell
pip install -r requirements.txt
```

### 3. Start the Server
Run the Flask application:
```powershell
python app.py
```

### 4. Access the Web App
Open your web browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 📝 License
This project is open-source and available under the MIT License.
