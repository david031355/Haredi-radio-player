const express = require('express');
const cors = require('cors'); // *** תיקון: שגיאת ההקלדה תוקנה כאן ***
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// קוד JavaScript שיוזרק לכל דף HTML כדי ליירט בקשות רשת
const clientRewritingScript = `
<script>
    (function() {
        // בודק אם הסקריפט כבר הוזרק כדי למנוע כפילויות
        if (window._proxyRewritingScriptLoaded) {
            return;
        }
        window._proxyRewritingScriptLoaded = true;

        const proxyBaseUrl = window.location.origin + '/proxy?url=';

        function rewriteUrlClient(originalUrl) {
            if (!originalUrl) return originalUrl;
            try {
                const url = new URL(originalUrl, window.location.href);
                // ודא שה-URL הוא יחסי או מאותו דומיין, אחרת שכתב אותו
                if (url.origin === window.location.origin && !url.pathname.startsWith('/proxy')) {
                    // אם זה משאב מקומי בפרוקסי, אל תשכתב שוב
                    return originalUrl;
                }
                return proxyBaseUrl + encodeURIComponent(url.href);
            } catch (e) {
                console.warn('[Client] Could not rewrite URL:', originalUrl, e);
                return originalUrl; // Fallback to original if invalid URL
            }
        }

        function rewriteAndFetch(originalFetch) {
            return function(...args) {
                let [resource, options] = args;
                if (typeof resource === 'string') {
                    resource = rewriteUrlClient(resource);
                    console.log('Rewrote fetch URL:', resource);
                } else if (resource instanceof Request) {
                    // טיפול באובייקט Request - ניצור אובייקט חדש עם URL משוכתב
                    try {
                        const newUrl = rewriteUrlClient(resource.url);
                        // יש לשים לב שאם ה-body כבר נקרא, הוא לא יהיה זמין שוב.
                        // זה פתרון חלקי עבור המקרים הללו.
                        const newRequest = new Request(newUrl, {
                            method: resource.method,
                            headers: new Headers(resource.headers),
                            body: resource.bodyUsed ? null : (resource.body || null),
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
                        console.log('Rewrote fetch Request object URL:', newUrl);
                    } catch (e) {
                        console.warn('Could not rewrite fetch Request object:', resource.url, e);
                    }
                }
                return originalFetch(resource, options);
            };
        }

        function rewriteAndOpen(originalOpen) {
            return function(method, url, ...args) {
                const rewrittenUrl = rewriteUrlClient(url);
                console.log('Rewrote XMLHttpRequest URL:', rewrittenUrl);
                return originalOpen.call(this, method, rewrittenUrl, ...args);
            };
        }

        // Apply rewrites
        if (typeof window.fetch === 'function') {
            window.fetch = rewriteAndFetch(window.fetch);
        }
        if (typeof window.XMLHttpRequest !== 'undefined') {
            window.XMLHttpRequest.prototype.open = rewriteAndOpen(window.XMLHttpRequest.prototype.open);
        }

        // גם לטפל בהפניות של form submissions אם הן לא נקלטות ע"י ה-action attribute
        document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form && form.tagName === 'FORM' && form.action) {
                try {
                    const originalAction = new URL(form.action, window.location.href);
                    const rewrittenAction = rewriteUrlClient(originalAction.href);
                    if (form.action !== rewrittenAction) {
                        form.action = rewrittenAction;
                        console.log('Rewrote form action:', form.action);
                    }
                } catch (err) {
                    console.warn('Could not rewrite form action:', form.action, err);
                }
            }
        }, true);
    })();
</script>
`;


// --- נתיב לדף הבית (רק הרדיו, בלי הפרוקסי UI) ---
app.get('/', (req, res) => {
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
            <img src="data:image/svg+xml,%3csvg%20id='Group_5050'%20data-name='Group%205050'%20xmlns='http://www.w3.org/2000/svg'%20width='70.382'%20height='42.98'%20viewBox='0%200%2070.382%2042.98'%3e%3cg%20id='Group_4156'%20data-name='Group%204156'%20transform='translate(31.57%2013.207)'%3e%3cg%20id='Group_4155'%20data-name='Group%204155'%20transform='translate(0)'%3e%3cpath%20id='Path_1522'%20data-name='Path%201522'%20d='M64.579-53.441H62.993A4.834,4.834,0,0,0,58.1-49.085L56.667-35.4h5.965Z'%20transform='translate(-56.667%2053.441)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4158'%20data-name='Group%204158'%20transform='translate(0%2013.207)'%3e%3cg%20id='Group_4157'%20data-name='Group%204157'%3e%3cpath%20id='Path_1523'%20data-name='Path%201523'%20d='M.031-48.23A5.313,5.313,0,0,0,5.4-42.2L6.567-53.442H.6Z'%20transform='translate(0%2053.442)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4160'%20data-name='Group%204160'%20transform='translate(6.524%2013.207)'%3e%3cg%20id='Group_4159'%20data-name='Group%204159'%20transform='translate(0)'%3e%3cpath%20id='Path_1524'%20data-name='Path%201524'%20d='M29.317-47.74a5.39,5.39,0,0,0-5.268-5.7h-11L11.741-41.389A5.3,5.3,0,0,0,17.113-35.4l1.269-12.01h2.963A1.777,1.777,0,0,1,23.1-45.5L22.023-35.4H28.03Z'%20transform='translate(-11.71%2053.441)'%20fill='%23db1419'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4162'%20data-name='Group%204162'%20transform='translate(40.331%2013.331)'%3e%3cg%20id='Group_4161'%20data-name='Group%204161'%3e%3cpath%20id='Path_1525'%20data-name='Path%201525'%20d='M82.955-53.219H72.97l-.578,5.659h8.075a1.9,1.9,0,0,1,1.892,2.076L82.212-44.1c-.187,1.954-.846,2.971-2.866,3.135l-.618,5.659A9.34,9.34,0,0,0,88.153-43.9l.344-3.216a5.627,5.627,0,0,0-5.542-6.106'%20transform='translate(-72.393%2053.219)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4164'%20data-name='Group%204164'%20transform='translate(38.596%2020.699)'%3e%3cg%20id='Group_4163'%20data-name='Group%204163'%3e%3cpath%20id='Path_1526'%20data-name='Path%201526'%20d='M69.278-25.294h.041a6.761,6.761,0,0,0,6.521-5.987l.933-8.713H70.849Z'%20transform='translate(-69.278%2039.994)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4166'%20data-name='Group%204166'%20transform='translate(24.061%206.57)'%3e%3cg%20id='Group_4165'%20data-name='Group%204165'%3e%3cpath%20id='Path_1527'%20data-name='Path%201527'%20d='M53.151-65.354H53.11c-3.917.286-6.46,2.2-7.552,5.742a11.214,11.214,0,0,0-.563,2.4c-.367,3.461-1.807,16.531-1.807,16.531h6.089l.146-1.383.044-.531,1.31-12.05a6.381,6.381,0,0,1,6.418-5.742h1.461c0-1.14-.429-4.968-5.5-4.968'%20transform='translate(-43.188%2065.354)'%20fill='%2300059b'/%3e%3c/g%3e%3c/g%3e%3cg%20id='Group_4167'%20data-name='Group%204167'%20transform='translate(48.902%2021.967)'%3e%3cpath%20id='Path_1528'%20data-name='Path%201528'%20d='M-8.943-5.265-7.59.149A.63.63,0,0,1-8.363.91l-5.6-1.495a13.179,13.179,0,0,1-5.349,1.5c-.135.011-.266.036-.4.043V.938c-.152.005-.3.023-.454.023h-.026V9.124A21.422,21.422,0,0,0-5,2.83,21.422,21.422,0,0,0,1.286-11.889H-6.925A13.183,13.183,0,0,1-8.943-5.265'%20transform='translate(20.192%2011.889)'%20fill='%23db1419'/%3e%3c/g%3e%3cg%20id='Group_4168'%20data-name='Group%204168'%20transform='translate(48.902%200)'%3e%3cpath%20id='Path_1529'%20data-name='Path%201529'%20d='M-17.075-16.76A21.419,21.419,0,0,0-23.36-31.548a21.422,21.422,0,0,0-15.2-6.294v8.306l.026,0c.153,0,.3.018,.454.023v-.023c.15.008,.3.033,.445.046A13.236,13.236,0,0,1-25.3-16.76Z'%20transform='translate(38.555%2037.842)'%20fill='%2300059b'/%3e%3c/g%3e%3cg%20id='Group_4240'%20data-name='Group%204240'%20transform='translate(0%200)'%3e%3cpath%20id='Path_1530'%20data-name='Path%201530'%20d='M0-34.167H70.382v-42.98H0Z'%20transform='translate(0%2077.147)'%20fill='none'/%3e%3c/g%3e%3c/svg%3e" alt="קול חי">
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
    </script>

</body>
</html>
    `;
    res.header('Content-Type', 'text/html; charset=utf-8');
    res.send(pageHtml);
});

// פונקציית עזר לשכתוב URL בשרת
function rewriteUrlServer(originalUrl, baseUrlOfProxy, targetBaseUrl) { // *** וודא שורה זו שלמה ומסתיימת ב-'{' ***
    if (!originalUrl) return originalUrl;

    try {
        const parsedOriginal = new URL(originalUrl, targetBaseUrl);
        const fullOriginalUrl = parsedOriginal.href;

        const rewritten = new URL(baseUrlOfProxy + '/proxy');
        rewritten.searchParams.set('url', fullOriginalUrl);
        return rewritten.href;
    } catch (e) {
        console.warn(`[Server] Could not rewrite URL: ${originalUrl}, Error: ${e.message}`);
        return originalUrl;
    }
} // *** וודא שסוגר זה קיים ***

// --- נתיב הפרוקסי ---
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('URL parameter is missing.');
    }

    let response;
    try {
        const urlObj = new URL(targetUrl);
        const requestHeaders = {
            // ננסה User-Agent עדכני יותר של Chrome
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': req.headers['accept'] || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'identity', // חשוב כדי למנוע דחיסה שאנחנו לא מפרקים
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9,he;q=0.8',
            'Connection': 'keep-alive',
            'Referer': encodeURI(targetUrl), // *** תיקון: מקודד את ה-URL לפני שליחה בכותרת Referer ***
            'Origin': urlObj.origin, // *** הוספה: כותרת Origin ***
            'Host': urlObj.host,     // *** הוספה: כותרת Host ***
            'Sec-Fetch-Dest': req.headers['sec-fetch-dest'] || 'document',
            'Sec-Fetch-Mode': req.headers['sec-fetch-mode'] || 'navigate',
            'Sec-Fetch-Site': req.headers['sec-fetch-site'] || 'none',
            'Sec-Fetch-User': req.headers['sec-fetch-user'] || '?1',
            'Upgrade-Insecure-Requests': '1',
            // אפשר לנסות להעביר חלק מכותרות המקור מהלקוח כפי שהן
            // 'Cookie': req.headers['cookie'] || '', // זה ידרוש טיפול בעוגיות
            // 'X-Requested-With': req.headers['x-requested-with'] || '', // אם רלוונטי ל-AJAX
        };

        // --- הוספה חדשה: הוספת header לנטפרי עבור תמונות ---
        // בדיקה לפי סיומת קובץ - לא מושלם אבל מכסה את רוב המקרים
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico'];
        const urlPath = urlObj.pathname.toLowerCase();
        const isImage = imageExtensions.some(ext => urlPath.endsWith(ext));

        if (isImage) {
            requestHeaders['x-netfree-option-no-send-images'] = '1';
            console.log(`[Server] Added x-netfree-option-no-send-images header for image: ${targetUrl}`);
        }
        // --- סוף הוספה חדשה ---

        response = await axios.get(targetUrl, {
            responseType: 'arraybuffer', // לקבל נתונים בינאריים
            headers: requestHeaders,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            },
            maxRedirects: 0
        });

        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            const redirectUrl = response.headers.location;
            const baseUrlOfProxy = `${req.protocol}://${req.get('host')}`;
            const rewrittenRedirectUrl = rewriteUrlServer(redirectUrl, baseUrlOfProxy, targetUrl);
            res.redirect(response.status, rewrittenRedirectUrl);
            return;
        }

        const baseUrlOfProxy = `${req.protocol}://${req.get('host')}`;
        let responseData = response.data;
        const contentType = response.headers['content-type'];

        if (contentType && contentType.includes('text/html')) {
            const $ = cheerio.load(responseData.toString('utf8'));

            // שכתוב קישורי HTML
            $('a[href], link[href], img[src], iframe[src], video[src], audio[src], source[src]').each((i, elem) => {
                const element = $(elem);
                const attr = element.attr('href') ? 'href' : 'src';
                const originalValue = element.attr(attr);
                if (originalValue) {
                    element.attr(attr, rewriteUrlServer(originalValue, baseUrlOfProxy, targetUrl));
                }
            });

            // שכתוב action של טפסים
            $('form[action]').each((i, elem) => {
                const element = $(elem);
                const originalAction = element.attr('action');
                if (originalAction) {
                    element.attr('action', rewriteUrlServer(originalAction, baseUrlOfProxy, targetUrl));
                }
            });

            // שכתוב CSS בתוך תגי <style>
            $('style').each((i, elem) => {
                let cssText = $(elem).html();
                if (cssText) {
                    cssText = cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
                        return `url('${rewriteUrlServer(url, baseUrlOfProxy, targetUrl)}')`;
                    });
                    $(elem).html(cssText);
                }
            });

            // שכתוב src של תגי script (כדי שקובצי JS יטענו דרך הפרוקסי)
            $('script[src]').each((i, elem) => {
                const element = $(elem);
                const originalSrc = element.attr('src');
                if (originalSrc) {
                    element.attr('src', rewriteUrlServer(originalSrc, baseUrlOfProxy, targetUrl));
                }
            });


            // ניסיון להסיר את ה-base tag
            $('base[href]').remove();

            // *** הזרקת קוד ה-JavaScript של הלקוח ליירוט בקשות ***
            // הכנס את הסקריפט שלנו בתחילת ה-<body> או בסוף ה-<head>
            $('head').prepend(clientRewritingScript);

            responseData = Buffer.from($.html(), 'utf8');

        } else if (contentType && contentType.includes('text/css')) {
            let cssText = responseData.toString('utf8');
            cssText = cssText.replace(/url\(['"]?(.*?)['"]?\)/g, (match, url) => {
                return `url('${rewriteUrlServer(url, baseUrlOfProxy, targetUrl)}')`;
            });
            responseData = Buffer.from(cssText, 'utf8');

        } else if (contentType && (contentType.includes('application/javascript') || contentType.includes('text/javascript'))) {
            console.log(`[Server] Serving JavaScript file: ${targetUrl} (client-side rewriting enabled via injected script).`);
        }

        const headersToExclude = [
            'content-encoding', 'transfer-encoding', 'connection', 'keep-alive',
            'proxy-authenticate', 'proxy-authorization',
            'content-security-policy', 'x-frame-options', 'strict-transport-security',
            'set-cookie'
        ];

        for (const key in response.headers) {
            if (response.headers.hasOwnProperty(key) && !headersToExclude.includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        }
        res.setHeader('Content-Type', contentType || 'application/octet-stream');
        res.send(responseData);

    } catch (error) {
        console.error('Proxy request failed:', error.message);
        if (error.response) {
            console.error('Target URL responded with status:', error.response.status);
            res.status(error.response.status).send(`Error fetching URL: ${error.response.status} ${error.response.statusText || error.message}`);
        } else if (error.request) {
            res.status(500).send('No response received from target URL. Check your internet connection or the URL.');
        } else {
            res.status(500).send(`An error occurred while setting up the request: ${error.message}`);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the radio player.`);
    console.log(`To use proxy API: http://localhost:${PORT}/proxy?url=YOUR_URL_HERE`);
});