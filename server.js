const express = require('express');
const cors = require('cors');
const axios = require('axios'); // נשתמש ב-axios לביצוע בקשות HTTP
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // מאפשר גישה מכל מקור (חשוב לפרוקסי)

// --- נתיב לדף הבית (ה"נקי" של הרדיו + פרוקסי UI) ---
app.get('/', (req, res) => {
    const pageHtml = `
<!DOCTYPE html>
<html lang="he">
<head>
    <meta charset="UTF-8">
    <link rel="icon" href="https://www.reshot.com/preview-assets/icons/EQFBGJ6SY9/radio-EQFBGJ6SY9.svg" type="image/svg+xml">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>תחנות הרדיו החרדיות וגישת פרוקסי</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Noto Sans Hebrew', sans-serif;
            background-image: url('https://www.photo-art.co.il/wp-content/uploads/2015/09/BY1A4457.webp');
            background-size: cover;
            background-position: center;
            text-align: center;
            padding: 50px;
            color: white;
            margin: 0; /* הסרת שוליים ברירת מחדל */
        }
        h1 {
            color: #fff;
            margin-bottom: 20px;
        }
        p {
            margin-bottom: 30px;
        }
        .radio-container {
            display: flex;
            justify-content: center; /* ריכוז במרכז */
            flex-wrap: wrap; /* מעבר שורה לפריטים רבים */
            gap: 30px;
            margin-bottom: 50px;
        }
        .radio-item {
            background-color: rgba(0, 0, 0, 0.6); /* רקע כהה יותר, שקיפות מעט גבוהה יותר */
            border-radius: 10px;
            padding: 20px;
            width: 250px;
            text-align: center;
            transition: border 0.3s ease-in-out, transform 0.2s ease-in-out; /* הוספת אנימציה למעבר עכבר */
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* צל קל */
        }
        .radio-item:hover {
            transform: translateY(-5px); /* אפקט קל במעבר עכבר */
        }
        .radio-item.active {
            border: 3px solid #ff9800;
        }
        .radio-item img {
            width: 150px;
            height: 150px;
            object-fit: contain;
            margin-bottom: 15px;
            border-radius: 8px; /* פינות מעוגלות לתמונות */
        }
        .radio-item h2 {
            font-size: 20px;
            margin: 10px 0;
            color: #ff9800; /* צבע כותרת שונה */
        }
        .link-button {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 15px 25px;
            text-decoration: none;
            border-radius: 5px;
            font-size: 16px;
            transition: background-color 0.3s, transform 0.2s;
            cursor: pointer;
        }
        .link-button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
        }
        audio {
            width: 80%;
            max-width: 600px; /* הגבלת רוחב לנגן אודיו */
            margin-top: 20px;
            border-radius: 10px;
            background-color: rgba(255, 255, 255, 0.1); /* רקע שקוף לנגן */
        }
        .proxy-section {
            background-color: rgba(0, 0, 0, 0.7); /* רקע כהה יותר לפרוקסי */
            padding: 40px 20px;
            margin-top: 50px;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }
        .proxy-section h1 {
            color: #00bcd4; /* צבע שונה לכותרת הפרוקסי */
            margin-bottom: 25px;
        }
        .proxy-form {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 30px;
            flex-wrap: wrap;
            gap: 15px;
        }
        .proxy-form input[type="text"] {
            width: 70%;
            max-width: 500px;
            padding: 12px 15px;
            border-radius: 8px;
            border: 1px solid #555;
            background-color: #333;
            color: white;
            font-size: 16px;
        }
        .proxy-form button {
            background-color: #00bcd4; /* כפתור פרוקסי בצבע שונה */
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
        }
        .proxy-form button:hover {
            background-color: #0097a7;
            transform: translateY(-2px);
        }
        #proxyFrame {
            width: 100%;
            height: 600px;
            border: 1px solid #444;
            border-radius: 10px;
            background-color: white; /* רקע לבן ל-iframe */
        }
        footer {
            margin-top: 50px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
        }
    </style>
</head>
<body>

    <h1>האזנה לתחנות הרדיו החרדיות</h1>
    <p>בחר תחנה להאזנה:</p>

    <div class="radio-container">
        <div class="radio-item">
            <img src="https://www.likol.co.il/wp-content/uploads/2019/04/Station_Share_Image6_img__2.jpg" alt="רדיו מורשת">
            <h2>רדיו מורשת</h2>
            <a href="#" class="link-button" onclick="playAudio('https://playerservices.streamtheworld.com/api/livestream-redirect/KAN_MORESHET.mp3?dist=rlive', this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kol-play.co.il/wp-content/themes/kolplay/images/logo.png" alt="קול פליי">
            <h2>קול פליי</h2>
            <a href="#" class="link-button" onclick="playAudio('https://cdn.cybercdn.live/Kol_Barama/Music/icecast.audio', this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kol-barama.co.il/wp-content/uploads/2024/05/LOGO_KOL-BARAMA_WHITE-e1715205528822.png" alt="קול ברמה">
            <h2>קול ברמה</h2>
            <a href="#" class="link-button" onclick="playAudio('https://cdn.cybercdn.live/Kol_Barama/Live_Audio/icecast.audio', this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kcm.fm/static/images/logo.svg" alt="קול חי מיוזיק">
            <h2>קול חי מיוזיק</h2>
            <a href="#" class="link-button" onclick="playAudio('https://live.kcm.fm/livemusic', this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="data:image/svg+xml,%3csvg%20id='Group_5050'%20data-name='Group%205050'%20xmlns='http://www.w3.org/2000/svg'%20width='70.382'%20height='42.98'%20viewBox='0%200%2070.382%2042.98'%3e%3cg%20id='Group_4156'%20data-name='Group%204156'%20transform='translate(31.57%2013.207)'%3e%3cg%20id='Group_4155'%20data-name='Group%204155'%20transform='translate(0)'%3e%3cpath%20id='Path_1522'%20data-name='Path%201522'%20d='M64.579-53.441H62.993A4.834,4.834,0,0,0,58.1-49.085L56.667-35.4h5.965Z'%20transform='translate(-56.667%2053.441)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4158'%20data-name='Group%204158'%20transform='translate(0%2013.207)'%3e%3cg%20id='Group_4157'%20data-name='Group%204157'%3e%3cpath%20id='Path_1523'%20data-name='Path%201523'%20d='M.031-48.23A5.313,5.313,0,0,0,5.4-42.2L6.567-53.442H.6Z'%20transform='translate(0%2053.442)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4160'%20data-name='Group%204160'%20transform='translate(6.524%2013.207)'%3e%3cg%20id='Group_4159'%20data-name='Group%204159'%20transform='translate(0)'%3e%3cpath%20id='Path_1524'%20data-name='Path%201524'%20d='M29.317-47.74a5.39,5.39,0,0,0-5.268-5.7h-11L11.741-41.389A5.3,5.3,0,0,0,17.113-35.4l1.269-12.01h2.963A1.777,1.777,0,0,1,23.1-45.5L22.023-35.4H28.03Z'%20transform='translate(-11.71%2053.441)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4162'%20data-name='Group%204162'%20transform='translate(40.331%2013.331)'%3e%3cg%20id='Group_4161'%20data-name='Group%204161'%3e%3cpath%20id='Path_1525'%20data-name='Path%201525'%20d='M82.955-53.219H72.97l-.578,5.659h8.075a1.9,1.9,0,0,1,1.892,2.076L82.212-44.1c-.187,1.954-.846,2.971-2.866,3.135l-.618,5.659A9.34,9.34,0,0,0,88.153-43.9l.344-3.216a5.627,5.627,0,0,0-5.542-6.106'%20transform='translate(-72.393%2053.219)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4164'%20data-name='Group%204164'%20transform='translate(38.596%2020.699)'%3e%3cg%20id='Group_4163'%20data-name='Group%204163'%3e%3cpath%20id='Path_1526'%20data-name='Path%201526'%20d='M69.278-25.294h.041a6.761,6.761,0,0,0,6.521-5.987l.933-8.713H70.849Z'%20transform='translate(-69.278%2039.994)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4166'%20data-name='Group%204166'%20transform='translate(24.061%206.57)'%3e%3cg%20id='Group_4165'%20data-name='Group%204165'%3e%3cpath%20id='Path_1527'%20data-name='Path%201527'%20d='M53.151-65.354H53.11c-3.917.286-6.46,2.2-7.552,5.742a11.214,11.214,0,0,0-.563,2.4c-.367,3.461-1.807,16.531-1.807,16.531h6.089l.146-1.383.044-.531,1.31-12.05a6.381,6.381,0,0,1,6.418-5.742h1.461c0-1.14-.429-4.968-5.5-4.968'%20transform='translate(-43.188%2065.354)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4167'%20data-name='Group%204167'%20transform='translate(48.902%2021.967)'%3e%3cpath%20id='Path_1528'%20data-name='Path%201528'%20d='M-8.943-5.265-7.59.149A.63.63,0,0,1-8.363.91l-5.6-1.495a13.179,13.179,0,0,1-5.349,1.5c-.135.011-.266.036-.4.043V.938c-.152.005-.3.023-.454.023h-.026V9.124A21.422,21.422,0,0,0-5,2.83,21.422,21.422,0,0,0,1.286-11.889H-6.925A13.183,13.183,0,0,1-8.943-5.265'%20transform='translate(20.192%2011.889)'%20fill='%23db1419'/%3e%3c/g%3e%3cg%20id='Group_4168'%20data-name='Group%204168'%20transform='translate(48.902%200)'%3e%3cpath%20id='Path_1529'%20data-name='Path%201529'%20d='M-17.075-16.76A21.419,21.419,0,0,0-23.36-31.548a21.422,21.422,0,0,0-15.2-6.294v8.306l.026,0c.153,0,.3.018.454.023v-.023c.15.008.3.033.445.046A13.236,13.236,0,0,1-25.3-16.76Z'%20transform='translate(38.555%2037.842)'%20fill='%2300059b'/%3e%3c/g%3e%3cg%20id='Group_4240'%20data-name='Group%204240'%20transform='translate(0%200)'%3e%3cpath%20id='Path_1530'%20data-name='Path%201530'%20d='M0-34.167H70.382v-42.98H0Z'%20transform='translate(0%2077.147)'%20fill='none'/%3e%3c/g%3e%3c/svg%3e" alt="קול חי">
                <h2>קול חי</h2>
                <a href="#" class="link-button" onclick="playAudio('https://media2.93fm.co.il/live-new', this)">האזן עכשיו</a>
            </div>
        </div>

        <div>
            <audio id="audioPlayer" controls>
                <source id="audioSource" src="" type="audio/mpeg">
                הדפדפן שלך לא תומך בנגן אודיו.
            </audio>
        </div>

        <script>
            let currentActiveItem = null;

            function playAudio(audioURL, clickedElement) {
                var audioPlayer = document.getElementById('audioPlayer');
                var audioSource = document.getElementById('audioSource');
                audioSource.src = audioURL;
                audioPlayer.load();
                audioPlayer.play();

                if (currentActiveItem) {
                    currentActiveItem.classList.remove('active');
                }

                const radioItem = clickedElement.closest('.radio-item');
                radioItem.classList.add('active');
                currentActiveItem = radioItem;
            }
        </script>

        <div class="proxy-section">
            <h1>גישת פרוקסי (לשימוש מחוץ לסינון)</h1>
            <form id="proxyForm" class="proxy-form">
                <input type="text" id="urlInput" placeholder="הכנס כתובת URL (לדוגמה: https://www.example.com)">
                <button type="submit">טען דרך פרוקסי</button>
            </form>
            <iframe id="proxyFrame"></iframe>
        </div>

        <footer>
            <p>&copy; 2025 Haredi Radio Player. All rights reserved.</p>
        </footer>

        <script>
            document.getElementById('proxyForm').addEventListener('submit', async function(event) {
                event.preventDefault(); // מונע שליחת טופס רגילה
                const url = document.getElementById('urlInput').value;
                const proxyFrame = document.getElementById('proxyFrame');

                // בדיקה בסיסית אם ה-URL שהוזן הוא תקין
                try {
                    new URL(url); // יזרוק שגיאה אם ה-URL לא תקין
                } catch (e) {
                    alert('אנא הכנס כתובת URL תקינה (עם https:// או http://)');
                    return;
                }

                // נשלח את הבקשה לשרת הפרוקסי שלנו
                const proxyUrl = `/proxy?url=${encodeURIComponent(url)}`;
                proxyFrame.src = proxyUrl;
            });
        </script>

    </body>
    </html>
    `;
    res.header('Content-Type', 'text/html; charset=utf-8');
    res.send(pageHtml);
});

// --- נתיב הפרוקסי ---
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url; // קבלת ה-URL מה-query parameter

    if (!targetUrl) {
        return res.status(400).send('URL parameter is missing.');
    }

    try {
        // ביצוע בקשה ל-URL היעד
        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer', // כדי לטפל בנתונים בינאריים (תמונות, קבצי קול וכו')
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36', // העבר את ה-User-Agent המקורי או ברירת מחדל
                'Accept': req.headers['accept'] || '*/*',
                'Accept-Encoding': req.headers['accept-encoding'] || 'identity', // חשוב לא לדחוס
                'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
                'Connection': 'keep-alive'
            }
        });

        // העברת הכותרות המקוריות מהשרת היעד לדפדפן
        // יש להיזהר מכותרות מסוימות שיכולות לגרום לבעיות אבטחה או התנהגות לא צפויה
        const headersToExclude = ['content-encoding', 'transfer-encoding', 'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization'];
        for (const key in response.headers) {
            if (response.headers.hasOwnProperty(key) && !headersToExclude.includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        }

        // שליחת הנתונים מהשרת היעד חזרה לדפדפן
        res.send(response.data);

    } catch (error) {
        console.error('Proxy request failed:', error.message);
        if (error.response) {
            console.error('Target URL responded with status:', error.response.status);
            // אם השרת היעד החזיר שגיאה (לדוגמה 404, 500), העבר אותה
            res.status(error.response.status).send(`Error fetching URL: ${error.response.status} ${error.response.statusText || error.message}`);
        } else if (error.request) {
            // הבקשה נשלחה אך לא התקבלה תגובה (לדוגמה, בעיות רשת)
            res.status(500).send('No response received from target URL. Check your internet connection or the URL.');
        } else {
            // שגיאה בהגדרת הבקשה
            res.status(500).send(`An error occurred while setting up the request: ${error.message}`);
        }
    }
});

// מפעיל את השרת
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the radio and proxy page.`);
    console.log(`To use proxy API directly: http://localhost:${PORT}/proxy?url=YOUR_URL_HERE`);
});