/*
==================================================
    NSC TOOLS
    script.js
==================================================
*/

"use strict";

/*==================================================
    GLOBALS
==================================================*/

let siteData = null;
let currentCategory = null;

/*==================================================
    INITIALIZATION
==================================================*/

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {

    try {

        await loadData();

        buildSite();

    } catch (error) {

        console.error(error);

        document
            .getElementById("siteTitle")
            .textContent = "Failed to load website.";

    }

}

/*==================================================
    LOAD JSON
==================================================*/

async function loadData() {

    const response = await fetch("tools.json");

    if (!response.ok) {

        throw new Error("Unable to load tools.json");

    }

    siteData = await response.json();

}

/*==================================================
    BUILD SITE
==================================================*/

function buildSite() {
    loadSiteInfo();

    createTabs();

    if (siteData.site.categories.length > 0) {

        switchCategory(siteData.site.categories[0]);

    }

}

/*==================================================
    SITE INFO
==================================================*/

function loadSiteInfo() {

    document
        .getElementById("siteTitle")
        .textContent = siteData.site.title;

    document
        .getElementById("siteSubtitle")
        .textContent = siteData.site.subtitle;

    document
        .getElementById("siteFooter")
        .textContent = siteData.site.footer;

}

/*==================================================
    NAVIGATION
==================================================*/

function createTabs() {

    const nav = document.getElementById("tabContainer");

    nav.innerHTML = "";

    siteData
        .site
        .categories
        .forEach((category, index) => {

            const button = document.createElement("button");

            button.className = "tab-btn";

            button.textContent = category;

            if (index === 0) {

                button
                    .classList
                    .add("active");

                currentCategory = category;

            }

            button.addEventListener("click", () => {

                document
                    .querySelectorAll(".tab-btn")
                    .forEach(btn => btn.classList.remove("active"));

                button
                    .classList
                    .add("active");

                switchCategory(category);

            });

            nav.appendChild(button);

        });

}

/*==================================================
    CATEGORY
==================================================*/

function switchCategory(category) {

    currentCategory = category;

    renderProjects(category);

}

/*==================================================
    GET PROJECTS
==================================================*/

function getProjects(category) {

    return siteData
        .projects
        .filter(project => {

            return (project.enabled && project.category === category);

        });

}

/*==================================================
    SORT PROJECTS
==================================================*/

function sortProjects(projects) {

    return projects.sort((a, b) => a.title.localeCompare(b.title));

}

/*==================================================
    RENDER CATEGORY
==================================================*/

function renderProjects(category) {

    const grid = document.getElementById("toolsGrid");

    grid.innerHTML = "";

    let projects = getProjects(category);

    projects = sortProjects(projects);

    projects.forEach(project => {

        const card = createProjectCard(project);

        grid.appendChild(card);

    });

}

/*==================================================
    CREATE PROJECT CARD
==================================================*/

function createProjectCard(project) {

    switch (project.media.type.toLowerCase()) {

        case "icons":
            return createScriptCard(project);

        case "image":
        default:
            return createToolCard(project);

    }

}
/*==================================================
    TOOL CARD
==================================================*/

function createToolCard(project) {

    const template = document.getElementById("toolTemplate");

    const card = template
        .content
        .firstElementChild
        .cloneNode(true);

    card
        .querySelector(".project-title")
        .textContent = project.title;

    card
        .querySelector(".project-description")
        .textContent = project.desc;

    card
        .querySelector(".project-version")
        .textContent = project.version
            ? "Version " + project.version
            : "";

    createMedia(card.querySelector(".tool-media"), project);

    createLinks(card.querySelector(".project-links"), project.links);

    return card;

}

/*==================================================
    SCRIPT CARD
==================================================*/

function createScriptCard(project) {

    const template = document.getElementById("scriptTemplate");

    const card = template
        .content
        .firstElementChild
        .cloneNode(true);

    card
        .querySelector(".project-title")
        .textContent = project.title;

    card
        .querySelector(".project-description")
        .textContent = project.desc;

    card
        .querySelector(".project-version")
        .textContent = project.version
            ? "Version " + project.version
            : "";

    createMedia(card.querySelector(".script-media"), project);

    createLinks(card.querySelector(".project-links"), project.links);

    return card;

}

/*==================================================
    HELPERS
==================================================*/

function isExternalLink(url) {

    if (!url) {

        return false;

    }

    return (url.startsWith("http://") || url.startsWith("https://"));

}

/*==================================================
    PLACEHOLDER HELPERS
==================================================*/

function setImagePlaceholder(img, fallback) {

    img.onerror = null;

    img.src = fallback;

}

/*==================================================
    SEARCH HELPERS
==================================================*/

/*
    Future feature.

    Returns all enabled projects
    matching a search string.

    Searches:

    • Title
    • Description
    • Tags
*/

function searchProjects(searchText) {

    searchText = searchText.toLowerCase();

    return siteData
        .projects
        .filter(project => {

            if (!project.enabled) 
                return false;
            
            if (project.title.toLowerCase().includes(searchText)) {

                return true;

            }

            if (project.desc.toLowerCase().includes(searchText)) {

                return true;

            }

            return project
                .tags
                .some(tag => tag.toLowerCase().includes(searchText));

        });

}

/*==================================================
    TAG HELPERS
==================================================*/

/*
    Future feature.

    Returns every project
    containing a specific tag.
*/

function filterByTag(tag) {

    return siteData
        .projects
        .filter(project => project.enabled && project.tags.includes(tag));

}

/*==================================================
    CATEGORY HELPERS
==================================================*/

function getCategories() {

    return siteData.site.categories;

}

function getProjectByID(id) {

    return siteData
        .projects
        .find(project => project.id === id);

}

/*==================================================
    SORT HELPERS
==================================================*/

function sortByTitle(projects) {

    return [...projects].sort((a, b) => a.title.localeCompare(b.title));

}

function sortByVersion(projects) {

    return [...projects].sort((a, b) => a.version.localeCompare(b.version));

}

/*==================================================
    DEBUG
==================================================*/

function printProjects() {

    console.table(siteData.projects);

}
function createMedia(container, project) {

    container.innerHTML = "";

    if (project.media.type === "image") {

        if (project.media.files.length === 0) {

            const placeholder = document
                .getElementById("imagePlaceholderTemplate")
                .content
                .firstElementChild
                .cloneNode(true);

            container.appendChild(placeholder);

            return;

        }

        const img = document.createElement("img");

        img.className = "tool-image";

        img.src = project
            .media
            .files[0];

        img.alt = project.title;

        img.onerror = () => {

            img.remove();

            const placeholder = document
                .getElementById("imagePlaceholderTemplate")
                .content
                .firstElementChild
                .cloneNode(true);

            container.appendChild(placeholder);

        };

        container.appendChild(img);

        return;

    }

    const stack = document.createElement("div");

    stack.className = "script-icon-stack stack-" + Math.min(
        project.media.files.length,
        3
    );

    project
        .media
        .files
        .slice(0, 3)
        .forEach(file => {

            const img = document.createElement("img");

            img.className = "script-icon";

            img.src = file;

            img.alt = "";

            stack.appendChild(img);

        });

    container.appendChild(stack);

}
function createLinks(container, links) {

    container.innerHTML = "";

    links.forEach(link => {

        if (!link.url) 
            return;
        
        if (link.url === "#") 
            return;
        
        const button = document.createElement("a");

        button.className = "btn btn-primary";

        button.textContent = link.label;

        button.href = link.url;

        if (isExternalLink(link.url)) {

            button.target = "_blank";

        } else {

            button.setAttribute("download", "");

        }

        container.appendChild(button);

    });

}
/*==================================================
    END
==================================================*/

console.log("%cNSC Tools Loaded", "color:#4f7cff;font-weight:bold;");
