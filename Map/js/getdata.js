// Robustly fetch data from Google Sheets with fallback and clear errors
const apiKey = 'AIzaSyAUi4KazffmDZV_dQUnMUKA1jJt4i0mqlU';
const spreadsheetId = '19LosVkt3flvZfcL15k_DBLLrjOwiHWu9rYVE8ri7NQY';
const sheetName = '360';

// Expose globally so map.js can read it (both as window property and var)
window.dataObject = window.dataObject || [];
var dataObject = window.dataObject; // maintain legacy global var used by map.js

(function fetchSheetData() {
    const sheetParam = encodeURIComponent(sheetName);
    const cacheBuster = `&_=${Date.now()}`;
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetParam}?key=${apiKey}${cacheBuster}`;
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${sheetParam}${cacheBuster}`;

    const timeoutMs = 12000;

    function withTimeout(promise, ms, controller) {
        return Promise.race([
            promise,
            new Promise((_, rej) => setTimeout(() => {
                if (controller) controller.abort();
                rej(new Error(`Fetch timeout after ${ms}ms`));
            }, ms))
        ]);
    }

    function buildObjectsFromHeadersRows(headers, rows) {
        headers = Array.isArray(headers) ? headers : [];
        rows = Array.isArray(rows) ? rows : [];
        return rows.map(row => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = (row[i] !== undefined ? row[i] : ''); });
            return obj;
        });
    }

    async function trySheetsAPI() {
        const controller = new AbortController();
        const res = await withTimeout(fetch(sheetsUrl, { signal: controller.signal, cache: 'no-store' }), timeoutMs, controller);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Sheets API error ${res.status}: ${text.slice(0, 200)}`);
        }
        const json = await res.json();
        const values = Array.isArray(json.values) ? json.values : [];
        if (!values.length) throw new Error('Sheets API returned no values');
        const headers = values[0];
        const rows = values.slice(1);
        return buildObjectsFromHeadersRows(headers, rows);
    }

    async function tryGviz() {
        const controller = new AbortController();
        const res = await withTimeout(fetch(gvizUrl, { signal: controller.signal, cache: 'no-store' }), timeoutMs, controller);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`GViz error ${res.status}: ${text.slice(0, 200)}`);
        }
        const text = await res.text();
        // Google returns: google.visualization.Query.setResponse({...});
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);?$/);
        if (!match) throw new Error('GViz parse error: unexpected format');
        const payload = JSON.parse(match[1]);
        if (!payload.table) throw new Error('GViz payload missing table');
        const cols = (payload.table.cols || []).map(c => c.label || c.id || '');
        const rows = (payload.table.rows || []).map(r => (r.c || []).map(c => (c ? (c.v ?? '') : '')));
        return buildObjectsFromHeadersRows(cols, rows);
    }

    function showErrorBanner(message) {
        try {
            let banner = document.getElementById('api-error-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'api-error-banner';
                Object.assign(banner.style, {
                    position: 'fixed', top: '8px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1000, background: '#fdecea', color: '#b71c1c',
                    border: '1px solid #f5c2c7', borderRadius: '8px', padding: '10px 14px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.1)', maxWidth: '90vw'
                });
                document.body.appendChild(banner);
            }
            banner.textContent = message;
        } catch (_) {}
    }

    (async () => {
        try {
            // First try official Sheets API (requires API key + public sheet or proper restrictions)
            const dataViaSheets = await trySheetsAPI();
            window.dataObject = dataViaSheets; dataObject = window.dataObject;
            console.info(`Loaded ${dataViaSheets.length} rows via Sheets API.`);
        } catch (err1) {
            console.warn('Sheets API failed, trying GViz...', err1);
            try {
                const dataViaGviz = await tryGviz();
                window.dataObject = dataViaGviz; dataObject = window.dataObject;
                console.info(`Loaded ${dataViaGviz.length} rows via GViz.`);
            } catch (err2) {
                console.error('Both Sheets API and GViz failed:', err2);
                showErrorBanner('データの読み込みに失敗しました。スプレッドシートの公開設定やAPIキーのリファラー制限をご確認ください。');
                window.dataObject = []; dataObject = window.dataObject;
            }
        }

        // Normalize headers to expected schema (lat, lon, title, category, etc.)
        try {
            const raw = Array.isArray(window.dataObject) ? window.dataObject : [];
            const norm = [];
            const normalizeKey = (k) => String(k || '').trim().toLowerCase();
            const pick = (obj, candidates) => {
                const keys = Object.keys(obj);
                const map = new Map(keys.map(k => [normalizeKey(k), k]));
                for (const c of candidates) {
                    const found = map.get(normalizeKey(c));
                    if (found !== undefined) return obj[found];
                }
                // Also try loose contains match
                for (const k of keys) {
                    const nk = normalizeKey(k);
                    if (candidates.some(c => nk.includes(normalizeKey(c)))) return obj[k];
                }
                return undefined;
            };
            const latKeys = ['lat','latitude','緯度','緯度(十進)','緯度（十進）','y','y_lat'];
            const lonKeys = ['lon','lng','long','longitude','経度','経度(十進)','経度（十進）','x','x_lon'];
            const titleKeys = ['title','name','名称','施設名','スポット名','イベント名'];
            const catKeys = ['category','カテゴリ','カテゴリー','種別','種類'];
            const expKeys = ['explanation','description','説明','詳細','案内'];
            const dateKeys = ['date','day','開催日','日付','日','開催日程'];
            const locKeys = ['location','場所','所在地','住所'];
            const orgKeys = ['organizer','主催','担当','連絡先','問い合わせ'];
            const bldKeys = ['building','建物','棟名','施設'];
            const classroomKeys = ['classroomname','classroom','room','教室','教室名','部屋','部屋名'];
            const imgKeys = ['imageurl','image','画像','写真','thumbnail','サムネイル','img'];
            const streetImgKeys = ['streetview','street_view','street_image','streetview_image','street 360','360','360image','360_image','panorama','pano','streetviewphoto'];
            const streetYawKeys = ['street_yaw','streetview_yaw','yaw','heading','方角'];
            const streetPitchKeys = ['street_pitch','streetview_pitch','pitch'];
            const streetFovKeys = ['street_fov','streetview_fov','hfov','視野'];
            const miniXKeys = ['minimap_x','mini_x','mini x','map_x','mapx','x_coord','x位置','x座標','marker_x','pin_x','x'];
            const miniYKeys = ['minimap_y','mini_y','mini y','map_y','mapy','y_coord','y位置','y座標','marker_y','pin_y','y'];
            const startKeys = ['start','starttime','start_time','開始','開始時刻','開始時間','開始日','開始日時'];
            const endKeys = ['end','endtime','end_time','終了','終了時刻','終了時間','終了日','終了日時'];
            const rainLocKeys = ['rain_location','雨天場所','雨天時場所','雨天会場','雨天時会場','雨天移動先','雨天避難場所'];
            const rainBldKeys = ['rain_building','雨天建物','雨天棟名','雨天施設'];
            const rainLatKeys = ['rain_lat','雨天緯度','雨天緯度(十進)','雨天緯度（十進）'];
            const rainLonKeys = ['rain_lon','雨天経度','雨天経度(十進)','雨天経度（十進）'];
            const orderKeys = ['order','sort','priority','表示順','並び順','順番','順序','sort_order','sortorder','display_order'];

            const looksLikeImage = (value) => {
                return typeof value === 'string' && /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(value.trim());
            };

            for (let rowIndex = 0; rowIndex < raw.length; rowIndex++) {
                const row = raw[rowIndex];
                const latVal = pick(row, latKeys);
                const lonVal = pick(row, lonKeys);
                const lat = parseFloat(String(latVal ?? '').replace(/,/g, '.'));
                const lon = parseFloat(String(lonVal ?? '').replace(/,/g, '.'));
                if (Number.isNaN(lat) || Number.isNaN(lon)) {
                    continue; // skip invalid rows
                }
                // Parse optional rain lat/lon; leave undefined if not parsable
                const rlatVal = pick(row, rainLatKeys) ?? row.rain_lat;
                const rlonVal = pick(row, rainLonKeys) ?? row.rain_lon;
                const rain_lat_num = parseFloat(String(rlatVal ?? '').replace(/,/g, '.'));
                const rain_lon_num = parseFloat(String(rlonVal ?? '').replace(/,/g, '.'));

                const minimapXVal = pick(row, miniXKeys);
                const minimapYVal = pick(row, miniYKeys);
                const minimapXNum = parseFloat(String(minimapXVal ?? '').replace(/,/g, '.'));
                const minimapYNum = parseFloat(String(minimapYVal ?? '').replace(/,/g, '.'));

                const buildingName = pick(row, bldKeys) || row.building || '';
                const classroomName = pick(row, classroomKeys) || row.classroomname || row.classroom || '';
                const rawTitle = pick(row, titleKeys) || row.title || '';
                const fallbackTitle = buildingName || rawTitle || row.name || '';
                const normalizedTitle = looksLikeImage(rawTitle) ? (buildingName || row.category || row.floor || rawTitle) : (rawTitle || fallbackTitle);
                const rawStreetImage = pick(row, streetImgKeys) || row.streetViewImage || row.streetview || '';
                const derivedStreetImage = rawStreetImage || (looksLikeImage(row.name) ? row.name : '') || (looksLikeImage(rawTitle) ? rawTitle : '');
                const orderValue = pick(row, orderKeys) ?? row.order ?? row.sort ?? row.priority;

                norm.push({
                    __rowIndex: rowIndex,
                    lat, lon,
                    title: normalizedTitle || fallbackTitle,
                    category: pick(row, catKeys) || row.category || '',
                    explanation: pick(row, expKeys) || row.explanation || '',
                    location: pick(row, locKeys) || row.location || '',
                    organizer: pick(row, orgKeys) || row.organizer || '',
                    building: buildingName,
                    classroomname: classroomName,
                    imageUrl: pick(row, imgKeys) || row.imageUrl || row.image || '',
                    startTime: pick(row, startKeys) || row.startTime || row.start || '',
                    endTime: pick(row, endKeys) || row.endTime || row.end || '',
                    date: pick(row, dateKeys) || row.date || row.day || '',
                    // New rain fields
                    rain_location: pick(row, rainLocKeys) || row.rain_location || '',
                    rain_building: pick(row, rainBldKeys) || row.rain_building || '',
                    rain_lat: Number.isNaN(rain_lat_num) ? undefined : rain_lat_num,
                    rain_lon: Number.isNaN(rain_lon_num) ? undefined : rain_lon_num,
                    minimapX: Number.isNaN(minimapXNum) ? undefined : minimapXNum,
                    minimapY: Number.isNaN(minimapYNum) ? undefined : minimapYNum,
                    minimapCategory: pick(row, catKeys) || row.category || '',
                    // Optional ordering: if you add "order" (or "表示順") column in the sheet, map.js will sort by it.
                    order: orderValue ?? '',
                    streetViewImage: derivedStreetImage,
                    streetViewYaw: pick(row, streetYawKeys) || row.streetViewYaw || '',
                    streetViewPitch: pick(row, streetPitchKeys) || row.streetViewPitch || '',
                    streetViewFov: pick(row, streetFovKeys) || row.streetViewFov || ''
                });
            }
            if (norm.length) {
                window.dataObject = norm; dataObject = window.dataObject;
                console.info(`Normalized ${norm.length} usable rows (from ${raw.length} raw). Sample:`, norm.slice(0,3));
            } else {
                console.warn('No usable rows after normalization. Check lat/lon headers and values. Raw sample:', raw.slice(0,3));
                if (raw.length > 0) {
                    showErrorBanner('緯度・経度の列が見つからないか数値ではありません。シートのヘッダー（例: lat, lon, 緯度, 経度）と値を確認してください。');
                }
            }
        } catch (normErr) {
            console.warn('Normalization step failed, proceeding with raw data.', normErr);
        }

        // Initialize the map once data is ready (map.js defines initmap)
        try {
            if (typeof window.initmap === 'function') {
                window.initmap();
            } else {
                // If initmap is not yet defined (race), try once on next tick
                setTimeout(() => { if (typeof window.initmap === 'function') window.initmap(); }, 0);
            }
        } catch (e) {
            console.error('Error initializing map:', e);
        }
    })();
})();
