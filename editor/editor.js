/*
==================================================
    NSC TOOLS
    editor/editor.js

    Local editor for tools.json. Open the repo
    folder in Chrome or Edge; edits are written
    back to tools.json when you save.
==================================================
*/

"use strict";

/*==================================================
    STATE
==================================================*/

const KEY = Symbol("projectKey");
const AUTO_ID = Symbol("autoId");

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i;
const SKIP_DIRS = new Set(["node_modules", "build", "dist", "__pycache__"]);
const SEV_RANK = { error: 0, warn: 1, info: 2 };
const SEV_LABEL = { error: "Error", warn: "Warning", info: "Note" };

const state = {
    dir: null,
    fileHandle: null,
    diskText: "",
    format: { indent: "    ", eol: "\n", finalNewline: true },
    original: null,
    data: null,
    files: new Set(),
    thumbs: new Map(),
    siteCss: "",
    selected: null,
    filter: "All",
    query: "",
    rightTab: "preview",
    reviewView: "fields",
    pickerOpen: false,
    siteDraft: null,
    nextKey: 1
};

let previewRoot = null;
let sitePreviewRoot = null;
let toastTimer = 0;

const $ = id => document.getElementById(id);

/*==================================================
    INITIALIZATION
==================================================*/

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {

    if (!window.showDirectoryPicker) {

        $("unsupported").hidden = false;
        $("chooseFolderBtn").disabled = true;

    }

    $("chooseFolderBtn").addEventListener("click", chooseFolder);

    setupDrop();
    setupEditor();
    setupDialogs();

    renderRecent();

}

/*==================================================
    DOM HELPERS
==================================================*/

const ICONS = {
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M21 16l-5-5-8 8"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7 0 .9-.8 2.3-2.2 3.6"/><path d="M6.6 6.6C4.4 8 3 10.5 3 12c0 2 4 7 9 7 1.6 0 3.1-.5 4.4-1.3"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5v.01"/>',
    warn: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.5v.01"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'
};

function icon(name, size = 16, label = "") {

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    svg.innerHTML = ICONS[name];

    if (label) {

        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);

    } else {

        svg.setAttribute("aria-hidden", "true");

    }

    return svg;

}

/*
    el("button", { class: "btn", onClick: fn }, "Label")

    Attributes named on* become listeners, text sets
    textContent, value/disabled/checked are set as
    properties, everything else as attributes.
*/

function el(tag, attrs = {}, ...children) {

    const node = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {

        if (value === null || value === undefined || value === false)
            return;

        if (key === "class") {

            node.className = value;

        } else if (key === "text") {

            node.textContent = value;

        } else if (key.startsWith("on") && typeof value === "function") {

            node.addEventListener(key.slice(2).toLowerCase(), value);

        } else if (key === "value" || key === "disabled" || key === "checked") {

            node[key] = value;

        } else {

            node.setAttribute(key, value === true ? "" : value);

        }

    });

    children.flat().forEach(child => {

        if (child === null || child === undefined || child === false)
            return;

        node.append(child instanceof Node ? child : String(child));

    });

    return node;

}

function iconButton(name, label, disabled, onClick, extraClass = "") {

    return el(
        "button",
        {
            type: "button",
            class: `btn btn-icon ${extraClass}`.trim(),
            "aria-label": label,
            disabled,
            onClick
        },
        icon(name, 14)
    );

}

function toast(message) {

    const box = $("toast");

    box.textContent = message;
    box.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => box.classList.remove("show"), 2800);

}

/*==================================================
    TEXT HELPERS
==================================================*/

function plural(count, one, many = one + "s") {

    return `${count} ${count === 1 ? one : many}`;

}

function slugify(text) {

    return String(text)
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}

function swap(list, a, b) {

    const held = list[a];

    list[a] = list[b];
    list[b] = held;

}

function formatWhen(timestamp) {

    return new Date(timestamp).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });

}

/*==================================================
    PATH HELPERS
==================================================*/

function isWebLink(url) {

    return /^https?:\/\//i.test(url);

}

function hasScheme(url) {

    return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//");

}

function cleanPath(path) {

    let clean = String(path || "")
        .trim()
        .replace(/^\.\//, "")
        .split(/[?#]/)[0];

    try {

        clean = decodeURI(clean);

    } catch (error) {

        // Leave malformed escapes as written.

    }

    return clean;

}

function fileExists(path) {

    return state.files.has(cleanPath(path));

}

/*
    Windows ignores case but GitHub Pages does not,
    so a path that only matches by case is reported.
*/

function caseMatch(path) {

    const lower = cleanPath(path).toLowerCase();

    for (const file of state.files) {

        if (file.toLowerCase() === lower)
            return file;

    }

    return null;

}

/*==================================================
    FILE ACCESS
==================================================*/

async function ensurePermission(handle) {

    const options = { mode: "readwrite" };

    if (!handle.queryPermission)
        return true;

    if ((await handle.queryPermission(options)) === "granted")
        return true;

    return (await handle.requestPermission(options)) === "granted";

}

async function readHandle(handle) {

    const file = await handle.getFile();

    return file.text();

}

async function writeHandle(handle, contents) {

    const writable = await handle.createWritable();

    await writable.write(contents);
    await writable.close();

}

async function readOptional(name) {

    try {

        return await readHandle(await state.dir.getFileHandle(name));

    } catch (error) {

        return null;

    }

}

async function resolveFile(path, create = false) {

    const parts = cleanPath(path).split("/").filter(Boolean);

    let dir = state.dir;

    for (const part of parts.slice(0, -1)) {

        dir = await dir.getDirectoryHandle(part, { create });

    }

    return dir.getFileHandle(parts[parts.length - 1], { create });

}

async function scanFolder() {

    const files = new Set();

    async function walk(dir, prefix, depth) {

        for await (const [name, handle] of dir.entries()) {

            if (files.size >= 5000)
                return;

            if (handle.kind === "file") {

                files.add(prefix + name);

            } else if (depth < 5 && !name.startsWith(".") && !SKIP_DIRS.has(name)) {

                await walk(handle, `${prefix}${name}/`, depth + 1);

            }

        }

    }

    await walk(state.dir, "", 0);

    state.files = files;

    state.thumbs.forEach(entry => {

        if (entry.url)
            URL.revokeObjectURL(entry.url);

    });

    state.thumbs.clear();

    renderFileDatalist();

}

/*==================================================
    THUMBNAILS
==================================================*/

function thumbFor(path) {

    const clean = cleanPath(path);

    if (!IMAGE_EXT.test(clean) || !state.files.has(clean))
        return null;

    let entry = state.thumbs.get(clean);

    if (!entry) {

        entry = { url: null, promise: null };

        entry.promise = resolveFile(clean)
            .then(handle => handle.getFile())
            .then(file => {

                entry.url = URL.createObjectURL(file);

                return entry.url;

            })
            .catch(() => null);

        state.thumbs.set(clean, entry);

    }

    return entry;

}

/*
    Points an <img> at a file in the folder. Returns
    false when the path is not an image that exists.
*/

function setImage(img, path) {

    const entry = thumbFor(path);

    if (!entry)
        return false;

    img.addEventListener("load", () => {

        if (img.naturalWidth <= 64)
            img.classList.add("pixel");

    }, { once: true });

    if (entry.url) {

        img.src = entry.url;

    } else {

        entry.promise.then(url => {

            if (url)
                img.src = url;

        });

    }

    return true;

}

/*==================================================
    LOAD + SERIALIZE
==================================================*/

function detectFormat(text) {

    const indent = text.match(/^[ \t]+(?=")/m);

    return {
        indent: indent ? indent[0] : "    ",
        eol: text.includes("\r\n") ? "\r\n" : "\n",
        finalNewline: /\n$/.test(text)
    };

}

function serialize(data) {

    let out = JSON.stringify(data, null, state.format.indent);

    if (state.format.eol !== "\n")
        out = out.replace(/\n/g, state.format.eol);

    if (state.format.finalNewline)
        out += state.format.eol;

    return out;

}

function asText(value) {

    return typeof value === "string" ? value : (value === null || value === undefined ? "" : String(value));

}

function parseData(text) {

    const data = JSON.parse(text);

    if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("the top level should be an object");

    if (!data.site || typeof data.site !== "object" || Array.isArray(data.site))
        data.site = {};

    ["title", "subtitle", "footer"].forEach(key => {

        data.site[key] = asText(data.site[key]);

    });

    if (!Array.isArray(data.site.categories))
        data.site.categories = [];

    data.site.categories = data.site.categories.map(asText);

    if (!Array.isArray(data.projects))
        data.projects = [];

    data.projects = data.projects.filter(p => p && typeof p === "object" && !Array.isArray(p));

    data.projects.forEach(normalizeProject);

    return data;

}

function normalizeProject(project) {

    ["id", "category", "title", "version", "desc"].forEach(key => {

        project[key] = asText(project[key]);

    });

    if (!Array.isArray(project.tags))
        project.tags = [];

    project.tags = project.tags.map(asText);

    // The site only shows a project when enabled is truthy.
    if (typeof project.enabled !== "boolean")
        project.enabled = Boolean(project.enabled);

    if (!project.media || typeof project.media !== "object")
        project.media = { type: "icons", files: [] };

    project.media.type = asText(project.media.type) || "icons";

    if (!Array.isArray(project.media.files))
        project.media.files = [];

    project.media.files = project.media.files.map(asText);

    if (!Array.isArray(project.links))
        project.links = [];

    project.links = project.links.filter(link => link && typeof link === "object");

    project.links.forEach(link => {

        link.label = asText(link.label);
        link.url = asText(link.url);

    });

}

function loadData(text, data) {

    state.diskText = text;
    state.format = detectFormat(text);

    data.projects.forEach(project => {

        project[KEY] = state.nextKey++;

    });

    state.data = data;
    state.original = cloneData(data);

}

function cloneData(data) {

    const copy = JSON.parse(JSON.stringify(data));

    copy.projects.forEach((project, index) => {

        project[KEY] = data.projects[index][KEY];

    });

    return copy;

}

function isDirty() {

    return serialize(state.data) !== serialize(state.original);

}

/*==================================================
    OPEN FOLDER
==================================================*/

async function chooseFolder() {

    hideOpenError();

    try {

        const dir = await window.showDirectoryPicker({ id: "tools-editor", mode: "readwrite" });

        await openFolder(dir);

    } catch (error) {

        if (error.name !== "AbortError")
            showOpenError(error.message);

    }

}

async function openFolder(dir) {

    hideOpenError();

    if (!(await ensurePermission(dir))) {

        showOpenError("Permission to edit that folder wasn't granted.");

        return;

    }

    let fileHandle;

    try {

        fileHandle = await dir.getFileHandle("tools.json");

    } catch (error) {

        showOpenError(`There's no tools.json in "${dir.name}". Pick the folder that holds it.`);

        return;

    }

    const text = await readHandle(fileHandle);

    let data;

    try {

        data = parseData(text);

    } catch (error) {

        showOpenError(`tools.json couldn't be read: ${error.message}`);

        return;

    }

    state.dir = dir;
    state.fileHandle = fileHandle;

    loadData(text, data);

    await scanFolder();

    state.siteCss = (await readOptional("styles.css")) || "";
    state.filter = "All";
    state.query = "";
    state.pickerOpen = false;
    state.selected = defaultSelection();

    $("searchInput").value = "";
    $("folderName").textContent = dir.name;
    $("openScreen").hidden = true;
    $("editorScreen").hidden = false;

    rememberFolder(dir);
    renderAll();

}

async function reloadFromDisk(skipConfirm = false) {

    if (!skipConfirm && isDirty() && !confirm("Drop your unsaved changes and reload tools.json from disk?"))
        return;

    let data;
    let text;

    try {

        text = await readHandle(state.fileHandle);
        data = parseData(text);

    } catch (error) {

        toast(`Couldn't reload tools.json: ${error.message}`);

        return;

    }

    const selectedId = current() ? current().id : null;

    loadData(text, data);

    await scanFolder();

    state.siteCss = (await readOptional("styles.css")) || "";

    const match = state.data.projects.find(project => project.id === selectedId);

    state.selected = match ? match[KEY] : defaultSelection();
    state.pickerOpen = false;

    renderAll();
    toast("Reloaded tools.json from disk");

}

function showOpenError(message) {

    const box = $("openError");

    box.textContent = message;
    box.hidden = false;

}

function hideOpenError() {

    $("openError").hidden = true;

}

function setupDrop() {

    const zone = $("dropZone");

    // Stop a stray drop from navigating away from the editor.
    window.addEventListener("dragover", event => event.preventDefault());
    window.addEventListener("drop", event => event.preventDefault());

    zone.addEventListener("dragover", event => {

        event.preventDefault();
        zone.classList.add("over");

    });

    zone.addEventListener("dragleave", () => zone.classList.remove("over"));

    zone.addEventListener("drop", async event => {

        event.preventDefault();
        zone.classList.remove("over");

        const item = [...event.dataTransfer.items].find(entry => entry.kind === "file");

        if (!item || !item.getAsFileSystemHandle) {

            showOpenError("Drop a folder, or use Choose folder.");

            return;

        }

        // Must be requested before the first await, while the drop data is live.
        const pending = item.getAsFileSystemHandle();

        try {

            const handle = await pending;

            if (!handle || handle.kind !== "directory") {

                showOpenError("That's a file. Drop the folder that holds tools.json.");

                return;

            }

            await openFolder(handle);

        } catch (error) {

            showOpenError(error.message);

        }

    });

}

/*==================================================
    RECENT FOLDER
==================================================*/

function openDb() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open("tools-editor", 1);

        request.onupgradeneeded = () => request.result.createObjectStore("handles");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}

async function dbGet(key) {

    const db = await openDb();

    return new Promise((resolve, reject) => {

        const request = db.transaction("handles").objectStore("handles").get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}

async function dbSet(key, value) {

    const db = await openDb();

    return new Promise((resolve, reject) => {

        const transaction = db.transaction("handles", "readwrite");

        transaction.objectStore("handles").put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

    });

}

async function rememberFolder(dir) {

    try {

        await dbSet("recent", {
            handle: dir,
            opened: Date.now(),
            projects: state.data.projects.length
        });

    } catch (error) {

        // Recent folders are a convenience; ignore storage failures.

    }

}

async function renderRecent() {

    let recent = null;

    try {

        recent = await dbGet("recent");

    } catch (error) {

        return;

    }

    if (!recent || !recent.handle)
        return;

    const button = el(
        "button",
        {
            type: "button",
            class: "recent-item",
            onClick: async () => {

                try {

                    await openFolder(recent.handle);

                } catch (error) {

                    showOpenError(`Couldn't reopen "${recent.handle.name}": ${error.message}`);

                }

            }
        },
        el("span", { class: "thumb" }, icon("folder", 18)),
        el(
            "span",
            { class: "recent-text" },
            el("span", { class: "recent-name", text: recent.handle.name }),
            el("span", {
                class: "recent-meta",
                text: `${plural(recent.projects || 0, "project")} · opened ${formatWhen(recent.opened)}`
            })
        ),
        el("span", { class: "issue-go" }, icon("chevron", 16))
    );

    $("recentList").replaceChildren(button);
    $("recentSection").hidden = false;

}

/*==================================================
    VALIDATION
==================================================*/

function projectIssues(project, data) {

    const issues = [];
    const add = (sev, msg) => issues.push({ sev, msg });
    const type = project.media.type;

    if (!project.title.trim())
        add("error", "Title is empty");

    if (!project.id.trim()) {

        add("error", "ID is empty");

    } else if (data.projects.filter(other => other.id === project.id).length > 1) {

        add("error", `Duplicate ID "${project.id}"`);

    } else if (project.id !== slugify(project.id)) {

        add("warn", "ID should be lowercase-with-dashes");

    }

    if (!data.site.categories.includes(project.category)) {

        add("error", project.category
            ? `Category "${project.category}" isn't a tab, so the card never shows`
            : "No category, so the card never shows");

    }

    if (!project.desc.trim())
        add("warn", "Description is empty");

    project.media.files.forEach(path => checkPath(path, `Missing file ${path}`, add));

    if (type.toLowerCase() === "icons" && project.media.files.length === 0)
        add("warn", "No icons set, so the card shows an empty icon slot");

    if (type === "image" && project.media.files.length === 0)
        add("info", "No image, so the site shows the No Preview placeholder");

    if (type.toLowerCase() !== "icons" && type !== "image")
        add("warn", `Unknown media type "${type}"`);

    project.links.forEach(link => {

        const url = link.url.trim();

        if (!url || url === "#") {

            add("warn", `Link "${link.label || "untitled"}" has no URL and is hidden`);

        } else if (!hasScheme(url)) {

            checkPath(url, `Download not found: ${url}`, add);

        }

        if (url && url !== "#" && !link.label.trim())
            add("warn", "A link has no label, so its button is blank");

    });

    if (project.enabled && !project.links.some(link => link.url && link.url !== "#"))
        add("warn", "Visible but has no working links");

    return issues;

}

function checkPath(path, missingMessage, add) {

    if (fileExists(path))
        return;

    const near = caseMatch(path);

    if (near) {

        add("error", `${cleanPath(path)} only matches ${near} by letter case. GitHub Pages is case-sensitive`);

    } else {

        add("error", missingMessage);

    }

}

function collectIssues(data) {

    const issues = [];

    data.projects.forEach(project => {

        projectIssues(project, data).forEach(issue => {

            issues.push({
                ...issue,
                key: project[KEY],
                project: project.title.trim() || project.id || "Untitled"
            });

        });

    });

    return issues.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);

}

/*
    Files inside asset folders (icons/, images/,
    scripts/ and any folder a project points into)
    that no project references.
*/

function unusedFiles(data) {

    const used = new Set();

    data.projects.forEach(project => {

        project.media.files.forEach(path => used.add(cleanPath(path)));

        project.links.forEach(link => {

            if (!hasScheme(link.url.trim()))
                used.add(cleanPath(link.url));

        });

    });

    const folders = new Set(["icons", "images", "scripts"]);

    used.forEach(path => {

        const slash = path.indexOf("/");

        if (slash > 0)
            folders.add(path.slice(0, slash));

    });

    return [...state.files]
        .filter(file => {

            const slash = file.indexOf("/");

            return slash > 0 && folders.has(file.slice(0, slash)) && !used.has(file);

        })
        .sort((a, b) => a.localeCompare(b));

}

/*==================================================
    CHANGES
==================================================*/

function isPlainObject(value) {

    return value !== null && typeof value === "object" && !Array.isArray(value);

}

function isPrimitive(value) {

    return value === null || typeof value !== "object";

}

function diffValues(before, after, path, out) {

    if (isPlainObject(before) && isPlainObject(after)) {

        new Set([...Object.keys(before), ...Object.keys(after)]).forEach(key => {

            diffValues(before[key], after[key], path ? `${path}.${key}` : key, out);

        });

        return;

    }

    if (Array.isArray(before) && Array.isArray(after)) {

        if (before.every(isPrimitive) && after.every(isPrimitive)) {

            if (JSON.stringify(before) === JSON.stringify(after))
                return;

            const added = after.filter(value => !before.includes(value));
            const removed = before.filter(value => !after.includes(value));

            out.push({ path, kind: "list", added, removed, reordered: !added.length && !removed.length });

            return;

        }

        for (let i = 0; i < Math.max(before.length, after.length); i++) {

            diffValues(before[i], after[i], `${path}[${i}]`, out);

        }

        return;

    }

    if (JSON.stringify(before) !== JSON.stringify(after))
        out.push({ path, kind: "value", from: before, to: after });

}

function changeGroups() {

    const groups = [];
    const siteChanges = [];

    diffValues(state.original.site, state.data.site, "", siteChanges);

    if (siteChanges.length)
        groups.push({ site: true, title: "Site settings", sub: "site", changes: siteChanges });

    const before = new Map(state.original.projects.map(project => [project[KEY], project]));
    const seen = new Set();

    state.data.projects.forEach(project => {

        const old = before.get(project[KEY]);

        seen.add(project[KEY]);

        if (!old) {

            groups.push({ title: project.title || "Untitled", sub: project.id, kind: "added", changes: [] });

            return;

        }

        const changes = [];

        diffValues(old, project, "", changes);

        if (changes.length)
            groups.push({ title: project.title || old.title || "Untitled", sub: project.id, changes });

    });

    state.original.projects.forEach(project => {

        if (!seen.has(project[KEY]))
            groups.push({ title: project.title || "Untitled", sub: project.id, kind: "removed", changes: [] });

    });

    return groups;

}

/*
    Line diff (LCS) between the file on disk and
    what would be written, for the raw diff view.
*/

function lineDiff(beforeText, afterText) {

    const a = beforeText.split(/\r?\n/);
    const b = afterText.split(/\r?\n/);

    let start = 0;

    while (start < a.length && start < b.length && a[start] === b[start])
        start++;

    let endA = a.length;
    let endB = b.length;

    while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {

        endA--;
        endB--;

    }

    const ops = a.slice(0, start).map(text => ({ t: " ", text }));
    const midA = a.slice(start, endA);
    const midB = b.slice(start, endB);
    const n = midA.length;
    const m = midB.length;

    if (n * m > 4000000) {

        midA.forEach(text => ops.push({ t: "-", text }));
        midB.forEach(text => ops.push({ t: "+", text }));

    } else {

        const width = m + 1;
        const table = new Int32Array((n + 1) * width);

        for (let i = n - 1; i >= 0; i--) {

            for (let j = m - 1; j >= 0; j--) {

                table[i * width + j] = midA[i] === midB[j]
                    ? table[(i + 1) * width + j + 1] + 1
                    : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);

            }

        }

        let i = 0;
        let j = 0;

        while (i < n && j < m) {

            if (midA[i] === midB[j]) {

                ops.push({ t: " ", text: midA[i] });
                i++;
                j++;

            } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {

                ops.push({ t: "-", text: midA[i++] });

            } else {

                ops.push({ t: "+", text: midB[j++] });

            }

        }

        while (i < n)
            ops.push({ t: "-", text: midA[i++] });

        while (j < m)
            ops.push({ t: "+", text: midB[j++] });

    }

    a.slice(endA).forEach(text => ops.push({ t: " ", text }));

    return ops;

}

function toHunks(ops, context = 3) {

    const keep = new Array(ops.length).fill(false);

    ops.forEach((op, index) => {

        if (op.t === " ")
            return;

        const from = Math.max(0, index - context);
        const to = Math.min(ops.length - 1, index + context);

        for (let k = from; k <= to; k++)
            keep[k] = true;

    });

    const lines = [];

    let skipped = false;

    ops.forEach((op, index) => {

        if (!keep[index]) {

            skipped = true;

            return;

        }

        if (skipped && lines.length)
            lines.push({ t: "@" });

        skipped = false;
        lines.push(op);

    });

    return lines;

}

/*==================================================
    SAVE
==================================================*/

async function save(force = false) {

    if (!force && !isDirty())
        return;

    const button = $("saveBtn");

    button.disabled = true;

    try {

        if (!(await ensurePermission(state.dir)))
            throw new Error("permission to write the folder wasn't granted");

        const disk = await readHandle(state.fileHandle);

        if (!force && disk !== state.diskText) {

            $("conflictBox").hidden = false;
            $("conflictBox").scrollIntoView({ block: "nearest" });

            return;

        }

        const text = serialize(state.data);

        if ($("backupCheck").checked) {

            const backup = await state.dir.getFileHandle("tools.json.bak", { create: true });

            await writeHandle(backup, disk);

            state.files.add("tools.json.bak");

        }

        await writeHandle(state.fileHandle, text);

        state.diskText = text;
        state.original = cloneData(state.data);

        $("reviewDialog").close();

        renderAll();
        toast("Saved tools.json");

    } catch (error) {

        toast(`Couldn't save: ${error.message}`);

    } finally {

        button.disabled = !isDirty();

    }

}

/*==================================================
    SELECTION
==================================================*/

function current() {

    if (!state.data)
        return null;

    return state.data.projects.find(project => project[KEY] === state.selected) || null;

}

/*
    Projects grouped the way the sidebar shows them:
    one group per category tab, A-Z by title like the
    site, plus projects whose category isn't a tab.
*/

function displayGroups(filter = state.filter, query = state.query) {

    const data = state.data;
    const categories = [...new Set(data.site.categories)];
    const q = query.trim().toLowerCase();

    const matches = project => !q || [project.title, project.id, project.desc, ...project.tags]
        .join(" ")
        .toLowerCase()
        .includes(q);

    const byTitle = (a, b) => a.title.localeCompare(b.title);

    const groups = (filter === "All" ? categories : [filter]).map(name => ({
        name,
        projects: data.projects
            .filter(project => project.category === name && matches(project))
            .sort(byTitle)
    }));

    if (filter === "All") {

        const orphans = data.projects
            .filter(project => !categories.includes(project.category) && matches(project))
            .sort(byTitle);

        if (orphans.length)
            groups.push({ name: "Not on a tab", projects: orphans });

    }

    return groups;

}

function displayOrder() {

    return displayGroups("All", "").flatMap(group => group.projects.map(project => project[KEY]));

}

function defaultSelection() {

    const order = displayOrder();

    return order.length ? order[0] : null;

}

function selectProject(key) {

    state.selected = key;
    state.pickerOpen = false;

    renderAll();

}

function goToProject(key) {

    state.filter = "All";
    state.query = "";

    $("searchInput").value = "";

    if ($("reviewDialog").open)
        $("reviewDialog").close();

    selectProject(key);

}

function focusTitle() {

    const input = $("titleInput");

    input.focus();
    input.select();

}

/*==================================================
    PROJECT ACTIONS
==================================================*/

function uniqueId(base, except = null) {

    const taken = new Set(
        state.data.projects
            .filter(project => project !== except)
            .map(project => project.id)
    );

    const root = base || "project";

    let id = root;
    let n = 2;

    while (taken.has(id))
        id = `${root}-${n++}`;

    return id;

}

function idFollowsTitle(project) {

    return Boolean(project[AUTO_ID]) || project.id === slugify(project.title);

}

function newProject() {

    const categories = state.data.site.categories;

    const project = {
        id: uniqueId("new-project"),
        category: categories.includes(state.filter) ? state.filter : (categories[0] || ""),
        title: "New Project",
        version: "1.0",
        desc: "",
        tags: [],
        enabled: false,
        media: { type: "icons", files: [] },
        links: []
    };

    project[KEY] = state.nextKey++;
    project[AUTO_ID] = true;

    state.data.projects.push(project);
    state.query = "";

    $("searchInput").value = "";

    selectProject(project[KEY]);
    focusTitle();

}

function duplicateProject() {

    const project = current();

    if (!project)
        return;

    const copy = JSON.parse(JSON.stringify(project));

    copy.title = `${project.title} copy`;
    copy.id = uniqueId(slugify(copy.title));
    copy.enabled = false;
    copy[KEY] = state.nextKey++;
    copy[AUTO_ID] = true;

    state.data.projects.splice(state.data.projects.indexOf(project) + 1, 0, copy);

    selectProject(copy[KEY]);
    focusTitle();

}

function deleteProject() {

    const project = current();

    if (!project)
        return;

    const name = project.title || project.id || "this project";

    if (!confirm(`Delete "${name}"? Nothing changes on disk until you save.`))
        return;

    const order = displayOrder();
    const index = order.indexOf(project[KEY]);

    state.data.projects.splice(state.data.projects.indexOf(project), 1);

    const next = order[index + 1] !== undefined ? order[index + 1] : order[index - 1];

    selectProject(next !== undefined ? next : defaultSelection());

}

function edit(change) {

    const project = current();

    if (!project)
        return;

    change(project);
    renderLive();

}

function addTag(raw) {

    const project = current();
    const tag = String(raw).replace(/,/g, " ").trim();

    if (!project || !tag)
        return;

    if (!project.tags.some(existing => existing.toLowerCase() === tag.toLowerCase()))
        project.tags.push(tag);

    $("tagInput").value = "";

    renderTags();
    renderLive();

}

function addLink() {

    const project = current();

    if (!project)
        return;

    project.links.push({ label: project.links.length ? "Github" : "Download", url: "" });

    renderLinks();
    renderLive();

    const inputs = $("linkList").querySelectorAll(".link-url");

    if (inputs.length)
        inputs[inputs.length - 1].focus();

}

function pickerFolder(project) {

    return project.media.type === "image" ? "images/" : "icons/";

}

function pickerCandidates(project) {

    const folder = pickerFolder(project);
    const images = [...state.files].filter(file => IMAGE_EXT.test(file) && !file.startsWith("editor/"));
    const inFolder = images.filter(file => file.startsWith(folder));

    return {
        label: inFolder.length ? folder : "the folder",
        files: (inFolder.length ? inFolder : images).sort((a, b) => a.localeCompare(b))
    };

}

/*
    Copies picked images into icons/ (or images/)
    right away, then adds them to the project.
*/

async function importFiles() {

    const project = current();

    if (!project || !window.showOpenFilePicker)
        return;

    let handles;

    try {

        handles = await window.showOpenFilePicker({
            multiple: true,
            types: [{
                description: "Images",
                accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"] }
            }]
        });

    } catch (error) {

        if (error.name !== "AbortError")
            toast(error.message);

        return;

    }

    if (!(await ensurePermission(state.dir))) {

        toast("Permission to write the folder wasn't granted.");

        return;

    }

    const folder = pickerFolder(project);
    const copied = [];

    for (const handle of handles) {

        const file = await handle.getFile();
        const path = folder + file.name;

        if (state.files.has(path) && !confirm(`${path} already exists. Replace it?`))
            continue;

        try {

            await writeHandle(await resolveFile(path, true), file);

        } catch (error) {

            toast(`Couldn't copy ${file.name}: ${error.message}`);

            continue;

        }

        const cached = state.thumbs.get(path);

        if (cached && cached.url)
            URL.revokeObjectURL(cached.url);

        state.thumbs.delete(path);
        state.files.add(path);

        if (!project.media.files.includes(path))
            project.media.files.push(path);

        copied.push(file.name);

    }

    if (!copied.length)
        return;

    renderFileDatalist();
    renderMedia();
    renderLive();

    toast(`Copied ${copied.join(", ")} into ${folder}`);

}

/*==================================================
    EDITOR WIRING
==================================================*/

function setupEditor() {

    $("searchInput").addEventListener("input", event => {

        state.query = event.target.value;

        renderSidebar();

    });

    $("newProjectBtn").addEventListener("click", newProject);
    $("duplicateBtn").addEventListener("click", duplicateProject);
    $("deleteBtn").addEventListener("click", deleteProject);

    $("titleInput").addEventListener("input", event => edit(project => {

        const follow = idFollowsTitle(project);

        project.title = event.target.value;

        if (follow) {

            project.id = uniqueId(slugify(project.title), project);
            project[AUTO_ID] = true;

            $("idInput").value = project.id;

        }

    }));

    $("idInput").addEventListener("input", event => edit(project => {

        project.id = event.target.value;

        delete project[AUTO_ID];

    }));

    $("versionInput").addEventListener("input", event => edit(project => {

        project.version = event.target.value;

    }));

    $("descInput").addEventListener("input", event => edit(project => {

        project.desc = event.target.value;

    }));

    $("categorySelect").addEventListener("change", event => {

        edit(project => {

            project.category = event.target.value;

        });

        renderCategorySelect(current());

    });

    $("enabledSwitch").addEventListener("click", () => edit(project => {

        project.enabled = !project.enabled;

        renderSwitch(project);

    }));

    $("tagInput").addEventListener("keydown", event => {

        const project = current();

        if (event.key === "Enter" || event.key === ",") {

            event.preventDefault();
            addTag(event.target.value);

        } else if (event.key === "Backspace" && !event.target.value && project && project.tags.length) {

            project.tags.pop();

            renderTags();
            renderLive();

        }

    });

    $("mediaIconsBtn").addEventListener("click", () => setMediaType("icons"));
    $("mediaImageBtn").addEventListener("click", () => setMediaType("image"));

    $("pickerBtn").addEventListener("click", () => {

        state.pickerOpen = !state.pickerOpen;

        renderMedia();

    });

    $("pickerDoneBtn").addEventListener("click", () => {

        state.pickerOpen = false;

        renderMedia();
        $("pickerBtn").focus();

    });

    $("importBtn").addEventListener("click", importFiles);
    $("addLinkBtn").addEventListener("click", addLink);

    $("tabPreviewBtn").addEventListener("click", () => {

        state.rightTab = "preview";

        renderPreview();

    });

    $("tabJsonBtn").addEventListener("click", () => {

        state.rightTab = "json";

        renderPreview();

    });

    $("reloadBtn").addEventListener("click", () => reloadFromDisk());
    $("siteBtn").addEventListener("click", openSiteDialog);
    $("reviewBtn").addEventListener("click", openReview);

    document.addEventListener("keydown", event => {

        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s")
            return;

        if ($("editorScreen").hidden)
            return;

        event.preventDefault();

        if ($("reviewDialog").open) {

            if (!$("saveBtn").disabled)
                save();

        } else if (!$("siteDialog").open) {

            openReview();

        }

    });

    window.addEventListener("beforeunload", event => {

        if (state.data && isDirty()) {

            event.preventDefault();
            event.returnValue = "";

        }

    });

}

function setMediaType(type) {

    edit(project => {

        project.media.type = type;

    });

    renderMedia();

}

/*==================================================
    RENDER
==================================================*/

function renderAll() {

    renderStatus();
    renderSidebar();
    renderForm();
    renderPreview();
    renderChecks();

}

/*
    Called on every edit. Leaves the form inputs
    alone so typing keeps focus and caret position.
*/

function renderLive() {

    renderStatus();
    renderSidebar();
    renderHeading();
    renderPreview();
    renderChecks();

}

function renderStatus() {

    const dirty = isDirty();
    const count = dirty ? Math.max(changeGroups().length, 1) : 0;

    $("statusPill").className = dirty ? "pill pill-dirty" : "pill pill-ok";
    $("statusText").textContent = dirty ? plural(count, "unsaved change") : "No unsaved changes";

    document.title = dirty ? "● Tools Editor" : "Tools Editor";

}

/*==================================================
    RENDER: PROJECT LIST
==================================================*/

function renderSidebar() {

    const data = state.data;
    const categories = [...new Set(data.site.categories)];

    if (state.filter !== "All" && !categories.includes(state.filter))
        state.filter = "All";

    $("catTabs").replaceChildren(...["All", ...categories].map(name => {

        const count = name === "All"
            ? data.projects.length
            : data.projects.filter(project => project.category === name).length;

        return el(
            "button",
            {
                type: "button",
                "aria-pressed": String(state.filter === name),
                onClick: () => {

                    state.filter = name;

                    renderSidebar();

                }
            },
            name,
            " ",
            el("span", { class: "n", text: count })
        );

    }));

    const problems = new Map();

    collectIssues(data).forEach(issue => {

        if (issue.sev !== "info")
            problems.set(issue.key, (problems.get(issue.key) || 0) + 1);

    });

    const groups = displayGroups();

    $("projectList").replaceChildren(...groups.map(group => el(
        "div",
        { class: "group" },
        el(
            "div",
            { class: "group-head" },
            el("span", { text: group.name }),
            el("span", { text: group.projects.length })
        ),
        group.projects.length
            ? group.projects.map(project => projectRow(project, problems.get(project[KEY]) || 0))
            : el("div", { class: "group-empty", text: state.query.trim() ? "No matches" : "Nothing here yet" })
    )));

    if (!groups.length)
        $("projectList").append(el("div", { class: "group-empty", text: "Add a category in Site settings first." }));

}

function projectRow(project, problems) {

    const thumb = el("span", { class: "thumb" });
    const img = el("img", { alt: "" });

    if (setImage(img, project.media.files[0] || "")) {

        thumb.append(img);

    } else {

        thumb.append(icon("image", 16));

    }

    return el(
        "button",
        {
            type: "button",
            class: project.enabled ? "project-row" : "project-row is-hidden",
            "aria-current": String(project[KEY] === state.selected),
            onClick: () => selectProject(project[KEY])
        },
        thumb,
        el(
            "span",
            { class: "row-text" },
            el("span", { class: "row-title", text: project.title || "Untitled" }),
            el("span", { class: "row-meta", text: `${project.id || "no-id"} · v${project.version || "?"}` })
        ),
        project.enabled ? null : el("span", { class: "row-hidden" }, icon("eyeOff", 16, "Hidden on site")),
        problems
            ? el("span", { class: "row-flag", role: "img", "aria-label": plural(problems, "issue") }, icon("warn", 14), String(problems))
            : null
    );

}

/*==================================================
    RENDER: FORM
==================================================*/

function renderForm() {

    const project = current();

    $("emptyForm").hidden = Boolean(project);
    $("projectForm").hidden = !project;

    if (!project)
        return;

    $("titleInput").value = project.title;
    $("idInput").value = project.id;
    $("versionInput").value = project.version;
    $("descInput").value = project.desc;
    $("tagInput").value = "";

    renderCategorySelect(project);
    renderHeading();
    renderSwitch(project);
    renderTags();
    renderMedia();
    renderLinks();

}

function renderHeading() {

    const project = current();

    if (!project)
        return;

    $("crumb").textContent = `${project.category || "No category"} / ${project.id || "no-id"}`;
    $("formHeading").textContent = project.title.trim() || "Untitled project";

    $("idHint").textContent = idFollowsTitle(project)
        ? "Follows the title until you change it"
        : "Custom ID, must be unique";

    $("descHint").textContent = `${plural(project.desc.length, "character")}, one or two lines reads best on a card`;

}

function renderCategorySelect(project) {

    const categories = [...new Set(state.data.site.categories)];
    const options = categories.map(name => el("option", { value: name, text: name }));

    if (!categories.includes(project.category)) {

        options.unshift(el("option", {
            value: project.category,
            text: project.category ? `${project.category} (not a tab)` : "No category"
        }));

    }

    $("categorySelect").replaceChildren(...options);
    $("categorySelect").value = project.category;

}

function renderSwitch(project) {

    $("enabledSwitch").setAttribute("aria-checked", String(project.enabled));
    $("enabledLabel").textContent = project.enabled ? "Visible on site" : "Hidden from site";

}

function renderTags() {

    const project = current();

    $("tagList").replaceChildren(...project.tags.map((tag, index) => el(
        "span",
        { class: "tag" },
        tag,
        el(
            "button",
            {
                type: "button",
                "aria-label": `Remove tag ${tag}`,
                onClick: () => {

                    project.tags.splice(index, 1);

                    renderTags();
                    renderLive();

                }
            },
            icon("x", 12)
        )
    )));

    const pool = [...new Set(state.data.projects.flatMap(other => other.tags))]
        .filter(tag => !project.tags.includes(tag))
        .sort((a, b) => a.localeCompare(b));

    $("tagSuggest").replaceChildren(
        pool.length ? el("span", { class: "suggest-label", text: "Used on other projects:" }) : "",
        ...pool.map(tag => el("button", { type: "button", onClick: () => addTag(tag) }, `+ ${tag}`))
    );

}

function renderMedia() {

    const project = current();

    if (!project)
        return;

    const type = project.media.type;
    const files = project.media.files;
    const picker = pickerCandidates(project);

    $("mediaIconsBtn").setAttribute("aria-pressed", String(type === "icons"));
    $("mediaImageBtn").setAttribute("aria-pressed", String(type === "image"));

    if (type === "image") {

        $("mediaHint").textContent = "The first file fills the 180px banner on a tool card.";

    } else if (type === "icons") {

        $("mediaHint").textContent = "Up to 3 icons, stacked on a horizontal script card.";

    } else {

        $("mediaHint").textContent = `Unknown type "${type}". Pick Icons or Image.`;

    }

    $("fileList").replaceChildren(...files.map((path, index) => fileRow(project, path, index)));

    if (!files.length) {

        $("fileList").append(el("div", {
            class: "empty-box",
            text: `No files yet. Pick one from ${picker.label} or import one.`
        }));

    }

    $("pickerBtnLabel").textContent = `Pick from ${picker.label}`;
    $("pickerBtn").setAttribute("aria-expanded", String(state.pickerOpen));
    $("picker").hidden = !state.pickerOpen;

    if (!state.pickerOpen)
        return;

    $("pickerTitle").textContent = `${picker.label} · click to add or remove`;

    $("pickerGrid").replaceChildren(...picker.files.map(path => {

        const img = el("img", { alt: "" });

        setImage(img, path);

        return el(
            "button",
            {
                type: "button",
                class: "picker-item",
                title: path,
                "aria-pressed": String(files.includes(path)),
                onClick: () => {

                    const at = files.indexOf(path);

                    if (at < 0) {

                        files.push(path);

                    } else {

                        files.splice(at, 1);

                    }

                    renderMedia();
                    renderLive();

                }
            },
            img,
            el("span", { class: "picker-name", text: path.slice(path.lastIndexOf("/") + 1) })
        );

    }));

    if (!picker.files.length)
        $("pickerGrid").append(el("div", { class: "group-empty", text: "No images in the folder yet." }));

}

function fileRow(project, path, index) {

    const files = project.media.files;
    const exists = fileExists(path);
    const near = exists ? null : caseMatch(path);
    const thumb = el("span", { class: exists ? "thumb thumb-lg" : "thumb thumb-lg thumb-missing" });
    const img = el("img", { alt: "" });

    if (exists && setImage(img, path)) {

        thumb.append(img);

    } else {

        thumb.append(icon(exists ? "image" : "error", 18));

    }

    let shown;

    if (project.media.type === "image") {

        shown = index === 0 ? "used as banner" : "not used";

    } else {

        shown = index < 3 ? "shown on card" : "not shown, max 3";

    }

    const status = exists
        ? el("span", { class: "ok-text", text: "Found" })
        : el("span", { class: "err-text", text: near ? `Case differs from ${near}` : "File not found" });

    const move = offset => {

        swap(files, index, index + offset);

        renderMedia();
        renderLive();

    };

    return el(
        "div",
        { class: "file-row" },
        thumb,
        el(
            "span",
            { class: "file-text" },
            el("span", { class: "file-path", text: path, title: path }),
            el("span", { class: "file-status" }, status, ` · ${shown}`)
        ),
        iconButton("up", "Move up", index === 0, () => move(-1)),
        iconButton("down", "Move down", index === files.length - 1, () => move(1)),
        iconButton("x", "Remove file", false, () => {

            files.splice(index, 1);

            renderMedia();
            renderLive();

        })
    );

}

function linkKind(url) {

    const value = url.trim();

    if (!value || value === "#")
        return { cls: "kind-hidden", icon: "warn", text: "Hidden" };

    if (isWebLink(value))
        return { cls: "kind-ext", icon: "external", text: "Opens tab" };

    if (hasScheme(value))
        return { cls: "kind-ext", icon: "external", text: "Link" };

    if (fileExists(value))
        return { cls: "kind-dl", icon: "download", text: "Download" };

    return { cls: "kind-bad", icon: "warn", text: "Not found" };

}

function paintKind(badge, url) {

    const kind = linkKind(url);

    badge.className = `kind ${kind.cls}`;
    badge.replaceChildren(icon(kind.icon, 14), kind.text);

}

function renderLinks() {

    const project = current();

    $("linkList").replaceChildren(...project.links.map((link, index) => {

        const badge = el("span", { class: "kind" });

        paintKind(badge, link.url);

        return el(
            "div",
            { class: "link-row" },
            el("input", {
                type: "text",
                class: "input link-label",
                "aria-label": "Button label",
                value: link.label,
                onInput: event => {

                    link.label = event.target.value;

                    renderLive();

                }
            }),
            el("input", {
                type: "text",
                class: "input link-url",
                "aria-label": "Link URL or file path",
                spellcheck: "false",
                placeholder: "https://… or scripts/file.zip",
                list: "localFiles",
                value: link.url,
                onInput: event => {

                    link.url = event.target.value;

                    paintKind(badge, link.url);
                    renderLive();

                }
            }),
            badge,
            iconButton("x", "Remove link", false, () => {

                project.links.splice(index, 1);

                renderLinks();
                renderLive();

            }, "btn-icon-lg")
        );

    }));

    if (!project.links.length)
        $("linkList").append(el("div", { class: "empty-box", text: "No links, so the card has no buttons." }));

}

function renderFileDatalist() {

    const options = [...state.files]
        .filter(file => file.includes("/") && !file.startsWith("editor/"))
        .sort((a, b) => a.localeCompare(b))
        .map(file => el("option", { value: file }));

    $("localFiles").replaceChildren(...options);

}

/*==================================================
    RENDER: PREVIEW
==================================================*/

function siteStyle(extra = "") {

    const style = document.createElement("style");

    style.textContent = `${state.siteCss}
:host { display: block; font-family: Arial, Helvetica, sans-serif; color: #e0e0e0; line-height: 1.5; }
.preview-grid { max-width: 373px; margin: 0 auto; }
.missing-icon { display: flex; align-items: center; justify-content: center; border: 1px dashed #ff8a80 !important; color: #ff8a80; font-size: 11px; }
${extra}`;

    return style;

}

function renderPreview() {

    const project = current();
    const tab = state.rightTab;

    $("tabPreviewBtn").setAttribute("aria-pressed", String(tab === "preview"));
    $("tabJsonBtn").setAttribute("aria-pressed", String(tab === "json"));
    $("previewPane").hidden = tab !== "preview" || !project;
    $("jsonPane").hidden = tab !== "json" || !project;

    if (!project) {

        $("previewWhere").textContent = "";

        return;

    }

    $("previewWhere").textContent = state.data.site.categories.includes(project.category)
        ? `Shown under the ${project.category} tab`
        : "Not on any tab";

    if (tab === "json") {

        $("jsonPane").textContent = JSON.stringify(project, null, state.format.indent);

        return;

    }

    $("hiddenBanner").hidden = project.enabled;
    $("previewSurface").classList.toggle("dim", !project.enabled);
    $("cssNote").hidden = Boolean(state.siteCss);

    if (!previewRoot)
        previewRoot = $("previewHost").attachShadow({ mode: "open" });

    previewRoot.replaceChildren(siteStyle(), el("div", { class: "preview-grid" }, buildCard(project)));

}

/*
    Mirrors createScriptCard / createToolCard in the
    site's script.js so styles.css applies unchanged.
*/

function buildCard(project) {

    const isScript = project.media.type.toLowerCase() === "icons";
    const media = el("div", { class: isScript ? "script-media" : "tool-media" });

    buildCardMedia(media, project);

    return el(
        "div",
        { class: isScript ? "script-card" : "tool-card" },
        media,
        el(
            "div",
            { class: isScript ? "script-info" : "tool-content" },
            el("h2", { class: "project-title", text: project.title }),
            el("div", { class: "project-version", text: project.version ? "Version " + project.version : "" }),
            el("p", { class: "project-description", text: project.desc }),
            el(
                "div",
                { class: "project-links" },
                project.links
                    .filter(link => link.url && link.url !== "#")
                    .map(link => el("span", { class: "btn btn-primary", text: link.label }))
            )
        )
    );

}

function buildCardMedia(container, project) {

    const files = project.media.files;

    if (project.media.type === "image") {

        const img = el("img", { class: "tool-image", alt: project.title });

        if (files.length && setImage(img, files[0])) {

            container.append(img);

            return;

        }

        container.append(el(
            "div",
            { class: "image-placeholder" },
            el("div", { class: "placeholder-icon", text: "\u{1F6E0}" }),
            el("div", { class: "placeholder-text", text: "No Preview" })
        ));

        return;

    }

    const stack = el("div", { class: `script-icon-stack stack-${Math.min(files.length, 3)}` });

    files.slice(0, 3).forEach(path => {

        const img = el("img", { class: "script-icon", alt: "" });

        if (setImage(img, path)) {

            stack.append(img);

        } else {

            stack.append(el("span", { class: "script-icon missing-icon", text: "missing" }));

        }

    });

    container.append(stack);

}

/*==================================================
    RENDER: CHECKS
==================================================*/

function issueButton(issue) {

    return el(
        "button",
        { type: "button", class: "issue", onClick: () => goToProject(issue.key) },
        el("span", { class: `issue-icon sev-${issue.sev}` }, icon(issue.sev, 16, SEV_LABEL[issue.sev])),
        el(
            "span",
            { class: "issue-text" },
            el("span", { class: "issue-project", text: issue.project }),
            el("span", { class: "issue-msg", text: issue.msg })
        ),
        el("span", { class: "issue-go" }, icon("chevron", 14))
    );

}

function renderChecks() {

    const issues = collectIssues(state.data);
    const errors = issues.filter(issue => issue.sev === "error").length;
    const warnings = issues.filter(issue => issue.sev === "warn").length;

    $("errCount").className = errors ? "count count-err" : "count count-plain";
    $("errCount").textContent = plural(errors, "error");
    $("warnCount").className = warnings ? "count count-warn" : "count count-plain";
    $("warnCount").textContent = plural(warnings, "warning");

    $("issueList").replaceChildren(...issues.map(issueButton));

    if (!issues.length)
        $("issueList").append(el("div", { class: "all-clear", text: "All checks pass." }));

    const unused = unusedFiles(state.data);

    $("unusedList").replaceChildren(...unused.map(file => el("span", { class: "file-chip", text: file })));

    if (!unused.length)
        $("unusedList").append(el("span", { class: "help", text: "Every file is in use." }));

}

/*==================================================
    DIALOGS
==================================================*/

function setupDialogs() {

    document.querySelectorAll("[data-close]").forEach(button => {

        button.addEventListener("click", () => button.closest("dialog").close());

    });

    // Site settings

    $("siteTitleInput").addEventListener("input", event => {

        state.siteDraft.title = event.target.value;

        renderSitePreview();

    });

    $("siteSubtitleInput").addEventListener("input", event => {

        state.siteDraft.subtitle = event.target.value;

        renderSitePreview();

    });

    $("siteFooterInput").addEventListener("input", event => {

        state.siteDraft.footer = event.target.value;

        renderSitePreview();

    });

    $("newCatInput").addEventListener("keydown", event => {

        if (event.key === "Enter") {

            event.preventDefault();
            addCategory();

        }

    });

    $("addCatBtn").addEventListener("click", addCategory);
    $("siteApplyBtn").addEventListener("click", applySite);

    // Review & save

    $("viewFieldsBtn").addEventListener("click", () => {

        state.reviewView = "fields";

        renderReviewView();

    });

    $("viewRawBtn").addEventListener("click", () => {

        state.reviewView = "raw";

        renderReviewView();

    });

    $("saveBtn").addEventListener("click", () => save());
    $("conflictOverwriteBtn").addEventListener("click", () => save(true));

    $("conflictReloadBtn").addEventListener("click", () => {

        $("reviewDialog").close();

        reloadFromDisk(true);

    });

}

/*==================================================
    SITE SETTINGS
==================================================*/

function openSiteDialog() {

    const site = state.data.site;

    state.siteDraft = {
        title: site.title,
        subtitle: site.subtitle,
        footer: site.footer,
        categories: site.categories.map(name => ({ name, from: name }))
    };

    $("siteTitleInput").value = site.title;
    $("siteSubtitleInput").value = site.subtitle;
    $("siteFooterInput").value = site.footer;
    $("newCatInput").value = "";
    $("siteError").hidden = true;

    $("schemaLabel").textContent = state.data.schemaVersion !== undefined
        ? `schemaVersion ${state.data.schemaVersion}`
        : "";

    renderCategoryList();
    renderSitePreview();

    $("siteDialog").showModal();

}

function categoryUse(name) {

    return state.data.projects.filter(project => project.category === name).length;

}

function renderCategoryList() {

    const list = state.siteDraft.categories;

    const refresh = () => {

        renderCategoryList();
        renderSitePreview();

    };

    $("catList").replaceChildren(...list.map((category, index) => {

        const count = category.from === null ? 0 : categoryUse(category.from);

        return el(
            "div",
            { class: "cat-row" },
            el("span", { class: "cat-pos", text: index + 1 }),
            el("input", {
                type: "text",
                class: "input",
                "aria-label": "Category name",
                value: category.name,
                onInput: event => {

                    category.name = event.target.value;

                    renderSitePreview();

                }
            }),
            el("span", { class: "cat-count", text: plural(count, "project") }),
            iconButton("up", "Move up", index === 0, () => {

                swap(list, index, index - 1);
                refresh();

            }),
            iconButton("down", "Move down", index === list.length - 1, () => {

                swap(list, index, index + 1);
                refresh();

            }),
            el(
                "button",
                {
                    type: "button",
                    class: "btn btn-icon btn-danger",
                    "aria-label": "Delete category",
                    title: count ? "Move its projects to another category first" : "Delete category",
                    disabled: count > 0,
                    onClick: () => {

                        list.splice(index, 1);
                        refresh();

                    }
                },
                icon("trash", 14)
            )
        );

    }));

    if (!list.length)
        $("catList").append(el("div", { class: "empty-box", text: "No categories, so the site has no tabs." }));

}

function addCategory() {

    const input = $("newCatInput");
    const name = input.value.trim();

    if (!name)
        return;

    const existing = state.siteDraft.categories.find(category => category.name.trim().toLowerCase() === name.toLowerCase());

    if (existing) {

        siteError(`There's already a category called "${existing.name.trim()}".`);

        return;

    }

    state.siteDraft.categories.push({ name, from: null });

    input.value = "";
    $("siteError").hidden = true;

    renderCategoryList();
    renderSitePreview();

}

function siteError(message) {

    $("siteError").textContent = message;
    $("siteError").hidden = false;

}

function renderSitePreview() {

    const draft = state.siteDraft;
    const names = draft.categories.map(category => category.name.trim()).filter(Boolean);

    if (!sitePreviewRoot)
        sitePreviewRoot = $("sitePreviewHost").attachShadow({ mode: "open" });

    sitePreviewRoot.replaceChildren(
        siteStyle("header { padding: 8px 8px 0; border-bottom: 0; } .container { margin: 0 auto; } footer { padding: 18px 0 0; }"),
        el(
            "header",
            {},
            el(
                "div",
                { class: "container" },
                el("h1", { text: draft.title }),
                el("p", { text: draft.subtitle }),
                el("nav", {}, names.map((name, index) => el("button", {
                    type: "button",
                    class: index === 0 ? "tab-btn active" : "tab-btn",
                    tabindex: "-1",
                    text: name
                })))
            )
        ),
        el("footer", { text: draft.footer })
    );

}

function applySite() {

    const draft = state.siteDraft;
    const names = draft.categories.map(category => category.name.trim());
    const lower = names.map(name => name.toLowerCase());

    if (names.some(name => !name)) {

        siteError("Category names can't be empty.");

        return;

    }

    const repeat = lower.findIndex((name, index) => lower.indexOf(name) !== index);

    if (repeat >= 0) {

        siteError(`"${names[repeat]}" is listed twice.`);

        return;

    }

    // Map old names to new ones first so swapped renames don't collide.
    const renames = new Map();

    draft.categories.forEach((category, index) => {

        if (category.from !== null)
            renames.set(category.from, names[index]);

    });

    state.data.projects.forEach(project => {

        if (renames.has(project.category))
            project.category = renames.get(project.category);

    });

    const site = state.data.site;

    site.title = draft.title;
    site.subtitle = draft.subtitle;
    site.footer = draft.footer;
    site.categories = names;

    $("siteDialog").close();

    renderAll();

}

/*==================================================
    REVIEW & SAVE
==================================================*/

function openReview() {

    if (!state.data)
        return;

    state.reviewView = "fields";

    $("conflictBox").hidden = true;

    renderReview();

    $("reviewDialog").showModal();

}

function issueSignature(issue) {

    return `${issue.key}|${issue.sev}|${issue.msg}`;

}

function renderReview() {

    const dirty = isDirty();
    const groups = changeGroups();
    const projects = groups.filter(group => !group.site).length;
    const siteChanged = groups.some(group => group.site);
    const fields = groups.reduce((total, group) => total + group.changes.length, 0);

    const before = new Set(
        collectIssues(state.original)
            .filter(issue => issue.sev !== "info")
            .map(issueSignature)
    );

    const issues = collectIssues(state.data);
    const after = issues.filter(issue => issue.sev !== "info").map(issueSignature);
    const afterSet = new Set(after);
    const fixed = [...before].filter(signature => !afterSet.has(signature)).length;
    const added = after.filter(signature => !before.has(signature)).length;

    const chips = [];

    if (!dirty) {

        chips.push(el("span", { class: "count count-plain", text: "No unsaved changes" }));

    } else {

        if (projects)
            chips.push(el("span", { class: "count count-blue", text: `${plural(projects, "project")} changed` }));

        if (siteChanged)
            chips.push(el("span", { class: "count count-blue", text: "Site settings changed" }));

        if (fields)
            chips.push(el("span", { class: "count count-plain", text: plural(fields, "field") }));

        if (fixed)
            chips.push(el("span", { class: "count count-ok", text: `${plural(fixed, "issue")} fixed` }));

        if (added)
            chips.push(el("span", { class: "count count-warn", text: `${plural(added, "new issue")}` }));

    }

    $("reviewSummary").replaceChildren(...chips);

    $("fieldChanges").replaceChildren(...groups.map(renderChangeGroup));

    if (!groups.length) {

        $("fieldChanges").append(el("div", {
            class: "diff-empty",
            text: dirty ? "Only the order of projects changed." : "Nothing has changed since tools.json was loaded."
        }));

    }

    renderReviewView();

    $("openIssues").replaceChildren(...issues.map(issueButton));

    if (!issues.length)
        $("openIssues").append(el("div", { class: "all-clear", text: "All checks pass." }));

    const indent = state.format.indent === "\t"
        ? "tab indent"
        : `${state.format.indent.length}-space indent`;

    $("formatNote").textContent = `Writes UTF-8 with ${indent} and ${state.format.eol === "\r\n" ? "CRLF" : "LF"} line endings, same as the file.`;
    $("reformatNote").hidden = serialize(state.original) === state.diskText;

    const errors = issues.filter(issue => issue.sev === "error").length;

    $("reviewFootNote").textContent = errors ? `${plural(errors, "error")} will remain` : "All checks pass";
    $("saveBtn").disabled = !dirty;

}

function renderReviewView() {

    const raw = state.reviewView === "raw";

    $("viewFieldsBtn").setAttribute("aria-pressed", String(!raw));
    $("viewRawBtn").setAttribute("aria-pressed", String(raw));
    $("fieldChanges").hidden = raw;
    $("rawDiff").hidden = !raw;

    if (!raw)
        return;

    const lines = toHunks(lineDiff(state.diskText, serialize(state.data)));

    if (!lines.length) {

        $("rawDiff").replaceChildren(el("div", { class: "diff-empty", text: "No differences from the file on disk." }));

        return;

    }

    $("rawDiff").replaceChildren(...lines.map(line => {

        if (line.t === "@")
            return el("div", { class: "diff-gap", text: "⋯" });

        let cls = "diff-line";

        if (line.t === "+")
            cls += " diff-add";
        else if (line.t === "-")
            cls += " diff-del";

        return el("div", { class: cls, text: `${line.t} ${line.text}` });

    }));

}

function showValue(value) {

    if (value === undefined)
        return "(none)";

    if (typeof value === "string")
        return value === "" ? '""' : value;

    return JSON.stringify(value);

}

function renderChangeGroup(group) {

    let badge = null;

    if (group.kind === "added")
        badge = el("span", { class: "change-badge count-ok", text: "New project" });
    else if (group.kind === "removed")
        badge = el("span", { class: "change-badge count-err", text: "Deleted" });

    return el(
        "div",
        { class: "change-group" },
        el(
            "div",
            { class: "change-title" },
            el("strong", { text: group.title }),
            group.sub ? el("span", { class: "change-sub", text: group.sub }) : null,
            badge
        ),
        group.changes.length ? el("div", { class: "change-list" }, group.changes.map(renderChange)) : null
    );

}

function renderChange(change) {

    const values = el("div", { class: "change-values" });

    if (change.kind === "list") {

        change.added.forEach(value => values.append(el("span", { class: "val val-new", text: `+ ${showValue(value)}` })));
        change.removed.forEach(value => values.append(el("span", { class: "val val-old", text: showValue(value) })));

        if (change.reordered)
            values.append(el("span", { class: "val-note", text: "Order changed" }));

    } else {

        const from = change.from === undefined ? null : showValue(change.from);
        const to = change.to === undefined ? null : showValue(change.to);
        const long = (from || "").length + (to || "").length > 60;

        if (long)
            values.classList.add("stack");

        if (from !== null)
            values.append(el("span", { class: "val val-old", text: from }));

        if (from !== null && to !== null && !long)
            values.append(icon("arrow", 14));

        if (to !== null)
            values.append(el("span", { class: "val val-new", text: to }));

    }

    return el(
        "div",
        { class: "change" },
        el("span", { class: "change-path", text: change.path }),
        values
    );

}
