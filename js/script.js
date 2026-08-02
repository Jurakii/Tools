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

    createFeatured();

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
    FEATURED PROJECTS
==================================================*/

function createFeatured() {

    const section = document.getElementById("featuredSection");

    const grid = document.getElementById("featuredGrid");

    grid.innerHTML = "";

    const featured = siteData
        .projects
        .filter(project => project.display.enabled && project.display.featured);

    if (featured.length === 0) {

        section
            .classList
            .add("hidden");

        return;

    }

    section
        .classList
        .remove("hidden");

    featured.forEach(project => {

        const card = createProjectCard(project);

        grid.appendChild(card);

    });

}

/*==================================================
    GET PROJECTS
==================================================*/

function getProjects(category) {

    return siteData
        .projects
        .filter(project => {

            return (project.display.enabled && project.category === category);

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

    if (project.icons.length > 0) {

        return createScriptCard(project);

    }

    return createToolCard(project);

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

    const image = card.querySelector(".tool-image");

    image.src = project.image;
    image.alt = project.title;

    image.onerror = () => {

        image.src = "images/placeholder.png";

    };

    card
        .querySelector("h2")
        .textContent = project.title;

    card
        .querySelector("p")
        .textContent = project.desc;

    createButtons(card, project);

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
        .querySelector("h2")
        .textContent = project.title;

    card
        .querySelector("p")
        .textContent = project.desc;

    const stack = card.querySelector(".script-icon-stack");

    createIconStack(stack, project.icons);

    createButtons(card, project);

    return card;

}

/*==================================================
    ICON STACK
==================================================*/

function createIconStack(container, icons) {

    container.innerHTML = "";

    const amount = Math.min(icons.length, 3);

    container
        .classList
        .add("stack-" + amount);

    icons
        .slice(0, 3)
        .forEach(icon => {

            const img = document.createElement("img");

            img.className = "script-icon";

            img.src = icon;

            img.alt = "";

            img.onerror = () => {

                img.src = "icons/placeholder.png";

            };

            container.appendChild(img);

        });

}

/*==================================================
    BUTTONS
==================================================*/

function createButtons(card, project) {

    const download = card.querySelector(".download-btn");

    const docs = card.querySelector(".docs-btn");

    /*==============================*/

    if (project.download && project.download !== "#") {

        download.href = project.download;

        download.textContent = project.display.buttonText;

        if (isExternalLink(project.download)) {

            download.target = "_blank";

        } else {

            download.setAttribute("download", "");

        }

    } else {

        download.remove();

    }

    /*==============================*/

    if (project.docs && project.docs.length > 0) {

        docs.href = project.docs;

    } else {

        docs.remove();

    }

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

            if (!project.display.enabled) 
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
        .filter(project => project.display.enabled && project.tags.includes(tag));

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

/*==================================================
    END
==================================================*/

console.log("%cNSC Tools Loaded", "color:#4f7cff;font-weight:bold;");
