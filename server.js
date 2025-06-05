const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const PORT = process.env.PORT || 3000;

// --- הגדרות הפרוקסי ל-VM שלך ---
const VM_PROXY_HOST = '34.28.145.94'; // ה-IP של ה-VM שלך
const VM_PROXY_PORT = 8080;         // הפורט שבו הפרוקסי ב-VM מאזין

app.use(cors());
app.use(express.json()); // כדי לטפל ב-JSON bodies אם מגיעים בקשות POST/PUT

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

    <h1>האז
