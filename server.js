const express = require('express');
const cors = require('cors');
const axios = require('axios'); // נשתמש ב-axios כי הוא תומך מובנה בפרוקסי וקל יותר לטיפול ב-arraybuffer/headers
const cheerio = require('cheerio'); // נשתמש ב-cheerio לניתוח ושכתוב HTML
const app = express();
const PORT = process.env.PORT || 3000;

// --- הגדרות הפרוקסי ל-VM שלך (חשוב!) ---
const VM_PROXY_HOST = '34.28.145.94'; // ה-IP של ה-VM שלך
const VM_PROXY_PORT = 8080;         // הפורט שבו הפרוקסי ב-VM מאזין

app.use(cors());
app.use(express.json()); // כדי לטפל ב-JSON bodies אם מגיעים בקשות POST/PUT

// קוד JavaScript שיוזרק לכל דף HTML כדי לנסות ליירט בקשות רשת בצד הלקוח
const clientRewritingScript = `
<script>
    (function() {
        if (window._proxyRewritingScriptLoaded) {
            return;
        }
        window._proxyRewritingScriptLoaded = true;

        const proxyBaseUrl = window.location.origin + '/proxy?url=';

        function rewriteUrlClient(originalUrl) {
            if (!originalUrl) return originalUrl;
            try {
                const url = new URL(originalUrl, window.location.href);
                // אם ה-URL כבר עובר דרך הפרוקסי שלנו, אל תשכתב שוב.
                // אם זה URL יחסי, או URL באותו דומיין שאינו הפרוקסי שלנו, או URL חיצוני.
                // נשכתב רק URL חיצוני או יחסי שלא מתחיל כבר ב'/proxy'
                if (url.origin === window.location.origin && url.pathname.startsWith('/proxy')) {
                    return originalUrl;
                }
                return proxyBaseUrl + encodeURIComponent(url.href);
            } catch (e) {
                console.warn('[Client Rewriting] Could not rewrite URL:', originalUrl, e);
                return originalUrl;
            }
        }

        // ליירט fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            let [resource, options] = args;
            if (typeof resource === 'string') {
                resource = rewriteUrlClient(resource);
            } else if (resource instanceof Request) {
                try {
                    const newUrl = rewriteUrlClient(resource.url);
                    const newRequest = new Request(newUrl, {
                        method: resource.method,
                        headers: new Headers(resource.headers),
                        body: resource.bodyUsed ? null : (resource.body || null), // שימו לב: bodyUsed
                        mode: resource.mode,
                        credentials: resource.credentials,
                        cache: resource.cache,
                        redirect: resource.redirect,
                        referrer: resource.referrer,
                        integrity: resource.integrity,
                        keepalive: resource.keepalive,
                        signal: resource.signal,
                    });
                    resource = newRequest;
                } catch (e) {
                    console.warn('[Client Rewriting] Could not rewrite fetch Request object:', resource.url, e);
                }
            }
            return originalFetch(resource, options);
        };

        // ליירט XMLHttpRequest
        const originalOpen = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function(method, url, ...args) {
            const rewrittenUrl = rewriteUrlClient(url);
            return originalOpen.call(this, method, rewrittenUrl, ...args);
        };

        // ליירט form submissions
        document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form && form.tagName === 'FORM' && form.action) {
                try {
                    const originalAction = new URL(form.action, window.location.href);
                    const rewrittenAction = rewriteUrlClient(originalAction.href);
                    if (form.action !== rewrittenAction) {
                        form.action = rewrittenAction;
                    }
                } catch (err) {
                    console.warn('[Client Rewriting] Could not rewrite form action:', form.action, err);
                }
            }
        }, true); // Use capture phase to catch before native submission
    })();
</script>
`;

// פונקציית עזר לשכתוב URL בשרת
function rewriteUrlServer(originalUrl, baseUrlOfProxy, targetBaseUrl) {
    if (!originalUrl) return originalUrl;

    try {
        // צור אובייקט URL מהקישור המקורי, תוך שימוש ב-targetBaseUrl כבסיס לקישורים יחסיים
        const parsedOriginal = new URL(originalUrl, targetBaseUrl);
        const fullOriginalUrl = parsedOriginal.href;

        // ודא שהקישור לא כבר עובר דרך הפרוקסי שלנו (למקרה של קישורים יחסיים ששוכתבו)
        // או שהוא לא פשוט /proxy?url=
        if (fullOriginalUrl.startsWith(baseUrlOfProxy + '/proxy?url=')) {
            return originalUrl; // כבר שוכתב, או הוא קישור בסיסי לפרוקסי
        }

        // בנה את ה-URL החדש שיעבור דרך הפרוקסי
        const rewritten = new URL(baseUrlOfProxy + '/proxy');
        rewritten.searchParams.set('url', fullOriginalUrl);
        return rewritten.href;
    } catch (e) {
        // אם יש שגיאה בניתוח ה-URL, החזר את ה-URL המקורי
        console.warn(`[Server Rewriting] Could not rewrite URL: ${originalUrl}, Error: ${e.message}`);
        return originalUrl;
    }
}

// --- נתיב לדף הבית (הנגן רדיו) ---
app.get('/', (req, res) => {
    // השתמש בתוכן ה-HTML המלא שלך מנגן הרדיו
    const pageHtml = `
<!DOCTYPE html>
<html lang="he">
<head>
    <meta charset="UTF-8">
    <link rel="icon" href="https://www.reshot.com/preview-assets/icons/EQFBGJ6SY9/radio-EQFBGJ6SY9.svg" type="image/svg+xml">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>תחנות הרדיו החרדיות</title>
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
            margin: 0;
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
            justify-content: center;
            flex-wrap: wrap;
            gap: 30px;
            margin-bottom: 50px;
        }
        .radio-item {
            background-color: rgba(0, 0, 0, 0.6);
            border-radius: 10px;
            padding: 20px;
            width: 250px;
            text-align: center;
            transition: border 0.3s ease-in-out, transform 0.2s ease-in-out;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .radio-item:hover {
            transform: translateY(-5px);
        }
        .radio-item.active {
            border: 3px solid #ff9800;
        }
        .radio-item img {
            width: 150px;
            height: 150px;
            object-fit: contain;
            margin-bottom: 15px;
            border-radius: 8px;
        }
        .radio-item h2 {
            font-size: 20px;
            margin: 10px 0;
            color: #ff9800;
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
            max-width: 600px;
            margin-top: 20px;
            border-radius: 10px;
            background-color: rgba(255, 255, 255, 0.1);
        }
        footer {
            margin-top: 50px;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.7);
        }
        /* סגנונות חדשים עבור שדה הקלט וכפתור הפרוקסי */
        .proxy-input-container {
            margin-top: 30px;
            margin-bottom: 40px;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 20px;
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            align-items: center;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        .proxy-input-container input[type="text"] {
            width: 90%;
            padding: 12px;
            margin-bottom: 15px;
            border: 1px solid #ff9800;
            border-radius: 5px;
            background-color: #333;
            color: white;
            font-size: 16px;
            text-align: right;
        }
        .proxy-input-container input[type="text"]::placeholder {
            color: #aaa;
        }
        .proxy-input-container button {
            background-color: #007bff;
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 5px;
            font-size: 18px;
            cursor: pointer;
            transition: background-color 0.3s, transform 0.2s;
        }
        .proxy-input-container button:hover {
            background-color: #0056b3;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>

    <h1>האזנה לתחנות הרדיו החרדיות</h1>
    <p>בחר תחנה להאזנה:</p>

    <div class="radio-container">
        <div class="radio-item">
            <img src="https://www.likol.co.il/wp-content/uploads/2019/04/Station_Share_Image6_img__2.jpg" alt="רדיו מורשת">
            <h2>רדיו מורשת</h2><a href="#" class="link-button" onclick="playAudio('/proxy?url=' + encodeURIComponent('https://playerservices.streamtheworld.com/api/livestream-redirect/KAN_MORESHET.mp3?dist=rlive'), this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kol-play.co.il/wp-content/themes/kolplay/images/logo.png" alt="קול פליי">
            <h2>קול פליי</h2>
            <a href="#" class="link-button" onclick="playAudio('/proxy?url=' + encodeURIComponent('https://cdn.cybercdn.live/Kol_Barama/Music/icecast.audio'), this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kol-barama.co.il/wp-content/uploads/2024/05/LOGO_KOL-BARAMA_WHITE-e1715205528822.png" alt="קול ברמה">
            <h2>קול ברמה</h2>
            <a href="#" class="link-button" onclick="playAudio('/proxy?url=' + encodeURIComponent('https://cdn.cybercdn.live/Kol_Barama/Live_Audio/icecast.audio'), this)">האזן עכשיו</a>
        </div>

        <div class="radio-item">
            <img src="https://kcm.fm/static/images/logo.svg" alt="קול חי מיוזיק">
            <h2>קול חי מיוזיק</h2>
            <a href="#" class="link-button" onclick="playAudio('/proxy?url=' + encodeURIComponent('https://live.kcm.fm/livemusic'), this)">האזן עכשיו</a>
        </div>
        
        <div class="radio-item">
            <img src="data:image/svg+xml,%3csvg%20id='Group_5050'%20data-name='Group%205050'%20xmlns='http://www.w3.org/2000/svg'%20width='70.382'%20height='42.98'%20viewBox='0%200%2070.382%2042.98'%3e%3cg%20id='Group_4156'%20data-name='Group%204156'%20transform='translate(31.57%2013.207)'%3e%3cg%20id='Group_4155'%20data-name='Group%204155'%20transform='translate(0)'%3e%3cpath%20id='Path_1522'%20data-name='Path%201522'%20d='M64.579-53.441H62.993A4.834,4.834,0,0,0,58.1-49.085L56.667-35.4h5.965Z'%20transform='translate(-56.667%2053.441)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4158'%20data-name='Group%204158'%20transform='translate(0%2013.207)'%3e%3cg%20id='Group_4157'%20data-name='Group%204157'%3e%3cpath%20id='Path_1523'%20data-name='Path%201523'%20d='M.031-48.23A5.313,5.313,0,0,0,5.4-42.2L6.567-53.442H.6Z'%20transform='translate(0%2053.442)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4160'%20data-name='Group%204160'%20transform='translate(6.524%2013.207)'%3e%3cg%20id='Group_4159'%20data-name='Group%204159'%20transform='translate(0)'%3e%3cpath%20id='Path_1524'%20data-name='Path%201524'%20d='M29.317-47.74a5.39,5.39,0,0,0-5.268-5.7h-11L11.741-41.389A5.3,5.3,0,0,0,17.113-35.4l1.269-12.01h2.963A1.777,1.777,0,0,1,23.1-45.5L22.023-35.4H28.03Z'%20transform='translate(-11.71%2053.441)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4162'%20data-name='Group%204162'%20transform='translate(40.331%2013.331)'%3e%3cg%20id='Group_4161'%20data-name='Group%204161'%3e%3cpath%20id='Path_1525'%20data-name='Path%201525'%20d='M82.955-53.219H72.97l-.578,5.659h8.075a1.9,1.9,0,0,1,1.892,2.076L82.212-44.1c-.187,1.954-.846,2.971-2.866,3.135l-.618,5.659A9.34,9.34,0,0,0,88.153-43.9l.344-3.216a5.627,5.627,0,0,0-5.542-6.106'%20transform='translate(-72.393%2053.219)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4164'%20data-name='Group%204164'%20transform='translate(38.596%2020.699)'%3e%3cg%20id='Group_4163'%20data-name='Group%204163'%3e%3cpath%20id='Path_1526'%20data-name='Path%201526'%20d='M69.278-25.294h.041a6.761,6.761,0,0,0,6.521-5.987l.933-8.713H70.849Z'%20transform='translate(-69.278%2039.994)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4166'%20data-name='Group%204166'%20transform='translate(24.061%206.57)'%3e%3cg%20id='Group_4165'%20data-name='Group%204165'%3e%3cpath%20id='Path_1527'%20data-name='Path%201527'%20d='M53.151-65.354H53.11c-3.917.286-6.46,2.2-7.552,5.742a11.214,11.214,0,0,0-.563,2.4c-.367,3.461-1.807,16.531-1.807,16.531h6.089l.146-1.383.044-.531,1.31-12.05a6.381,6.381,0,0,1,6.418-5.742h1.461c0-1.14-.429-4.968-5.5-4.968'%20transform='translate(-43.188%2065.354)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4167'%20data-name='Group%204167'%20transform='translate(48.902%2021.967)'%3e%3cpath%20id='Path_1528'%20data-name='Path%201528'%20d='M-8.943-5.265-7.59.149A.63.63,0,0,1-8.363.91l-5.6-1.495a13.179,13.179,0,0,1-5.349,1.5c-.135.011-.266.036-.4.043V.938c-.152.005-.3.023-.454.023h-.026V9.124A21.422,21.422,0,0,0-5,2.83,21.422,21.422,0,0,0,1.286-11.889H-6.925A13.183,13.183,0,0,1-8.943-5.265'%20transform='translate(20.192%2011.889)'%20fill='%23db1419'/%3e%3c/g%3e%3cg%20id='Group_4168'%20data-name='Group%204168'%20transform='translate(48.902%200)'%3e%3cpath%20id='Path_1529'%20data-name='Path%201529'%20d='M-17.075-16.76A21.419,21.419,0,0,0-23.36-31.548a21.422,21.422,0,0,0-15.2-6.294v8.306l.026,0c.153,0,.3.018,.454.023v-.023c.15.008,.3.033,.445.046A13.236,13.236,0,0,1-25.3-16.76Z'%20transform='translate(38.555%2037.842)'%20fill='%2300059b'/%3e%3c/g%3e%3cg%20id='Group_4240'%20data-name='Group%204240'%20transform='translate(0%200)'%3e%3cpath%20id='Path_1530'%20data-name='Path%201530'%20d='M0-34.167H70.382v-42.98H0Z'%20transform='translate(0%2077.147)'%20fill='none'/%3e%3c/g%3e%3c/svg%3e" alt="קול חי">
            <h2>קול חי</h2>
            <a href="#" class="link-button" onclick="playAudio('/proxy?url=' + encodeURIComponent('https://media2.93fm.co.il/live-new'), this)">האזן עכשיו</a>
        </div>

    </div>

    <div class="proxy-input-container">
        <h2>גלישה דרך הפרוקסי</h2>
        <p>הכנס/י כתובת אתר (URL) לגלישה דרך הפרוקסי:</p>
        <input type="text" id="proxyInput" placeholder="לדוגמה: https://www.google.com" dir="ltr">
        <button onclick="navigateToProxy()">גלוש דרך הפרוקסי</button>
    </div>


    <div>
        <audio id="audioPlayer" controls>
            <source id="audioSource" src="" type="audio/mpeg">
            הדפדפן שלך לא תומך בנגן אודיו.
        </audio>
    </div>

    <footer>
        <p>&copy; 2025 Haredi Radio Player. All rights reserved.</p>
    </footer>

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

        // פונקציה חדשה לניווט דרך הפרוקסי
        function navigateToProxy() {
            const inputElement = document.getElementById('proxyInput');
            const targetUrl = inputElement.value;
            if (targetUrl) {
                // בונה את ה-URL של הפרוקסי באמצעות ה-URL שהוזן
                const proxyUrl = window.location.origin + '/proxy?url=' + encodeURIComponent(targetUrl);
                window.location.href = proxyUrl; // מנתב את הדפדפן ל-URL של הפרוקסי
            } else {
                alert('אנא הכנס כתובת אתר.');
            }
        }
    </script>

</body>
</html>
    `;
    res.header('Content-Type', 'text/html; charset=utf-8');
    res.send(pageHtml);
});

// --- נתיב הפרוקסי הראשי ---
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('URL parameter is missing.');
    }

    console.log(`[Proxy Request] Target URL: ${targetUrl}`);

    try {
        const urlObj = new URL(targetUrl); // ננתח את ה-URL המקורי
        const baseUrlOfProxy = `${req.protocol}://${req.get('host')}`; // ה-URL הבסיסי של שרת הפרוקסי שלנו (Render)

        // הגדרת כותרות לבקשה לשרת היעד, כולל אלו שנועדו לעזור לעקוף חסימות (x-netfree)
        const requestHeaders = {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Encoding': 'identity', // חשוב כדי למנוע דחיסה שלא נוכל לטפל בה
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9,he;q=0.8',
            'Connection': 'keep-alive',
            'Referer': targetUrl, // שולח את ה-Referer המקורי
            'Origin': urlObj.origin, // שולח את ה-Origin המקורי
            'Host': urlObj.host, // שולח את ה-Host המקורי
            // כותרות Sec-Fetch כדי לדמות בקשת דפדפן אמיתית
            'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
            'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
            'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
            'Sec-Fetch-User': req.headers['sec-fetch-user'] || '?1',
            'Upgrade-Insecure-Requests': req.headers['upgrade-insecure-requests'] || '1',
        };

        // הוספת כותרת x-netfree-option-no-send-images אם מדובר בתמונה (למקרה של נטפרי)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
        const urlPath = urlObj.pathname.toLowerCase();
        const isImage = imageExtensions.some(ext => urlPath.endsWith(ext));
        if (isImage) {
            requestHeaders['x-netfree-option-no-send-images'] = '1';
            console.log(`[Proxy Request] Added x-netfree-option-no-send-images header for image: ${targetUrl}`);
        }

        // --- כאן אנחנו משתמשים ב-VM Tinyproxy! ---
        const axiosConfig = {
            responseType: 'arraybuffer', // לקבל את התוכן כבייטים
            headers: requestHeaders,
            validateStatus: function (status) { // אל תזרוק שגיאה על סטטוסים של 3xx, אנחנו רוצים לטפל בהם בעצמנו
                return status >= 200 && status < 400;
            },
            maxRedirects: 0, // לא לעקוב אוטומטית אחרי הפניות
            proxy: {
                host: VM_PROXY_HOST,
                port: VM_PROXY_PORT,
                protocol: 'http'
            }
        };

        const response = await axios.get(targetUrl, axiosConfig);

        // --- טיפול בהפניות (Redirects) ---
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            const redirectUrl = response.headers.location;
            const rewrittenRedirectUrl = rewriteUrlServer(redirectUrl, baseUrlOfProxy, targetUrl); // שכתוב את ה-URL של ההפניה
            console.log(`[Proxy Redirect] Original: ${redirectUrl} -> Rewritten: ${rewrittenRedirectUrl}`);
            res.redirect(response.status, rewrittenRedirectUrl); // הפנה את הלקוח ל-URL המשוכתב
            return;
        }

        let responseData = response.data;
        const contentType = response.headers['content-type'];

        // --- שכתוב תוכן (Rewriting Content) ---
        if (contentType && contentType.includes('text/html')) {
            const $ = cheerio.load(responseData.toString('utf8'));

            // הסר תגית <base> אם קיימת (כי היא משבשת קישורים יחסיים)
            $('base[href]').remove();

            // שכתוב קישורים באלמנטים שונים
            $('a[href], link[href], img[src], iframe[src], video[src], audio[src], source[src]').each((i, elem) => {
                const element = $(elem);
                const attr = element.attr('href') ? 'href' : 'src';
                const originalValue = element.attr(attr);
                if (originalValue) {
                    element.attr(attr, rewriteUrlServer(originalValue, baseUrlOfProxy, targetUrl));
                }
            });

            // שכתוב action בטפסים
            $('form[action]').each((i, elem) => {
                const element = $(elem);
                const originalAction = element.attr('action');
                if (originalAction) {
                    element.attr('action', rewriteUrlServer(originalAction, baseUrlOfProxy, targetUrl));
                }
            });

            // שכתוב URLים בתוך תגי <style> (CSS מוטבע)
            $('style').each((i, elem) => {
                let cssText = $(elem).html();
                if (cssText) {
                    cssText = cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
                        return `url('${rewriteUrlServer(url, baseUrlOfProxy, targetUrl)}')`;
                    });
                    $(elem).html(cssText);
                }
            });

            // שכתוב src בתוך תגי <script> חיצוניים
            $('script[src]').each((i, elem) => {
                const element = $(elem);
                const originalSrc = element.attr('src');
                if (originalSrc) {
                    element.attr('src', rewriteUrlServer(originalSrc, baseUrlOfProxy, targetUrl));
                }
            });

            // שכתוב URLים בתוך קוד JavaScript מוטבע (זה החלק הקשה והפחות שלם!)
            // זהו ניסיון בסיסי וישבור אתרים רבים
            $('script:not([src])').each((i, elem) => {
                let jsCode = $(elem).html();
                if (jsCode) {
                    // זהו ניסיון מאוד פשטני ויכול לשבור דברים!
                    // מנסה לשכתב מחרוזות URL בתוך JavaScript
                    jsCode = jsCode.replace(/(['"])(https?:\/\/[^'"]+?)(['"])/g, (match, p1, url, p2) => {
                        // נבדוק שזה באמת URL לפני השכתוב
                        try {
                            const rewritten = rewriteUrlServer(url, baseUrlOfProxy, targetUrl);
                            return `${p1}${rewritten}${p2}`;
                        } catch (e) {
                            return match; // החזר מקורי אם יש שגיאה
                        }
                    });
                    $(elem).html(jsCode);
                }
            });


            // הזרקת סקריפט ה-client-side rewriting שלנו לתוך ה-head של הדף
            $('head').prepend(clientRewritingScript);

            responseData = Buffer.from($.html(), 'utf8'); // המר בחזרה לבאפר

        } else if (contentType && contentType.includes('text/css')) {
            // שכתוב URLים בתוך קובצי CSS
            let cssText = responseData.toString('utf8');
            cssText = cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
                return `url('${rewriteUrlServer(url, baseUrlOfProxy, targetUrl)}')`;
            });
            responseData = Buffer.from(cssText, 'utf8');

        } else if (contentType && (contentType.includes('application/javascript') || contentType.includes('text/javascript'))) {
            // עבור קבצי JavaScript חיצוניים, אנחנו לא מבצעים שכתוב בשרת
            // אנחנו סומכים על ה-clientRewritingScript שיוזרק ל-HTML וידאג ליירט בקשות fetch/XHR
            // אם המשאב הוא רק קובץ JS, ה-clientRewritingScript לא יוזרק, וייתכנו בעיות.
            // לפתרון מלא יותר נצטרך לנתח גם קבצי JS בשרת.
            console.log(`[Proxy Request] Serving JavaScript file: ${targetUrl} (client-side rewriting relies on HTML injection).`);
        }

        // העברת כותרות תגובה מהשרת המקורי אל הלקוח
        const headersToExclude = [
            'content-encoding', 'transfer-encoding', 'connection', 'keep-alive',
            'proxy-authenticate', 'proxy-authorization',
            'content-security-policy', // CSP עלול לחסום את הסקריפטים והמשאבים שלנו
            'x-frame-options', // מונע הטמעת אתרים ב-iframe
            'strict-transport-security', // עלול לגרום לבעיות ב-HTTPS
            'set-cookie' // יש לטפל בעוגיות בצורה מיוחדת בפרוקסי
        ];

        for (const key in response.headers) {
            if (response.headers.hasOwnProperty(key) && !headersToExclude.includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        }
        // ודא שה-Content-Type נשלח נכון
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.send(responseData);

    } catch (error) {
        console.error(`[Proxy Error] Failed to proxy request for URL: ${targetUrl}`);
        console.error(`[Proxy Error] Message: ${error.message}`);
        if (error.response) {
            console.error(`[Proxy Error] Target responded with status: ${error.response.status}`);
            res.status(error.response.status).send(`Error from target: ${error.response.status} ${error.response.statusText || error.message}`);
        } else if (error.request) {
            console.error(`[Proxy Error] No response received from target URL.`);
            res.status(500).send('No response from target URL. Check URL or VM connection.');
        } else {
            console.error(`[Proxy Error] An unknown error occurred: ${error.message}`);
            res.status(500).send(`An error occurred: ${error.message}`);
        }
    }
});


// מפעיל את השרת ומאזין לחיבורים בפורט מסוים
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the radio player and proxy input.`);
});
