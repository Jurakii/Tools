#!/usr/bin/env python3
"""
NSC Tools - JSON Editor
------------------------
A small desktop GUI for editing tools.json without hand-writing JSON.

Requires only the Python standard library (tkinter). No pip installs needed.

Run:
    python3 tools_editor.py
    (optionally: python3 tools_editor.py /path/to/tools.json)
"""

import json
import os
import shutil
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ==================================================
#   THEME  (matches the website's dark palette)
# ==================================================

BG = "#1e1e1e"
PANEL = "#2a2a2a"
PANEL_ALT = "#242424"
BORDER = "#3a3a3a"
TEXT = "#e0e0e0"
MUTED = "#999999"
ACCENT = "#4f7cff"
ACCENT_HOVER = "#648cff"
DANGER = "#e05555"

FONT = ("Segoe UI", 10)
FONT_BOLD = ("Segoe UI", 10, "bold")
FONT_HEADER = ("Segoe UI", 13, "bold")

DEFAULT_MEDIA_TYPES = ["image", "icons"]

EMPTY_SITE = {
    "schemaVersion": 1,
    "site": {
        "title": "",
        "subtitle": "",
        "footer": "",
        "categories": []
    },
    "projects": []
}


# ==================================================
#   DATA HELPERS
# ==================================================

def new_project(existing_ids):
    base = "new-project"
    pid = base
    n = 2
    while pid in existing_ids:
        pid = f"{base}-{n}"
        n += 1
    return {
        "id": pid,
        "category": "",
        "title": "New Project",
        "version": "1.0",
        "desc": "",
        "tags": [],
        "enabled": True,
        "media": {"type": "image", "files": []},
        "links": []
    }


def slugify(text):
    out = []
    prev_dash = False
    for ch in text.lower().strip():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return "".join(out).strip("-") or "project"


# ==================================================
#   SCROLLABLE FRAME (right-hand edit panel)
# ==================================================

class ScrollableFrame(ttk.Frame):
    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.canvas = tk.Canvas(self, bg=PANEL, highlightthickness=0)
        self.vscroll = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.inner = ttk.Frame(self.canvas, style="Panel.TFrame")

        self.inner.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.canvas_window = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.canvas.configure(yscrollcommand=self.vscroll.set)

        self.canvas.bind("<Configure>", self._resize_inner)
        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        self.canvas.pack(side="left", fill="both", expand=True)
        self.vscroll.pack(side="right", fill="y")

    def _resize_inner(self, event):
        self.canvas.itemconfig(self.canvas_window, width=event.width)

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")


# ==================================================
#   MAIN APPLICATION
# ==================================================

class ToolsEditorApp(tk.Tk):
    def __init__(self, path=None):
        super().__init__()
        self.title("NSC Tools - JSON Editor")
        self.geometry("1180x720")
        self.minsize(900, 560)
        self.configure(bg=BG)

        self.file_path = None
        self.data = None
        self.selected_id = None
        self.dirty = False
        self._drag_iid = None

        self._build_style()
        self._build_menu()
        self._build_layout()

        if path and os.path.exists(path):
            self.load_file(path)
        else:
            guess = os.path.join(os.getcwd(), "tools.json")
            if os.path.exists(guess):
                self.load_file(guess)
            else:
                self.data = json.loads(json.dumps(EMPTY_SITE))
                self.refresh_tree()
                self.set_status("No file loaded - use File > Open")

        self.protocol("WM_DELETE_WINDOW", self.on_close)

    # ----------------------------------------
    #  STYLE
    # ----------------------------------------

    def _build_style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        style.configure(".", background=BG, foreground=TEXT, font=FONT)
        style.configure("TFrame", background=BG)
        style.configure("Panel.TFrame", background=PANEL)
        style.configure("TLabel", background=BG, foreground=TEXT, font=FONT)
        style.configure("Panel.TLabel", background=PANEL, foreground=TEXT, font=FONT)
        style.configure("Muted.TLabel", background=PANEL, foreground=MUTED, font=FONT)
        style.configure("Header.TLabel", background=BG, foreground=TEXT, font=FONT_HEADER)

        style.configure("TEntry", fieldbackground=PANEL_ALT, foreground=TEXT,
                         insertcolor=TEXT, bordercolor=BORDER)
        style.configure("TCombobox", fieldbackground=PANEL_ALT, background=PANEL_ALT,
                         foreground=TEXT, arrowcolor=TEXT)
        style.map("TCombobox", fieldbackground=[("readonly", PANEL_ALT)])

        style.configure("TButton", background="#3a3a3a", foreground=TEXT,
                         borderwidth=0, focusthickness=0, padding=8, font=FONT)
        style.map("TButton", background=[("active", "#4a4a4a")])

        style.configure("Accent.TButton", background=ACCENT, foreground="white",
                         borderwidth=0, padding=8, font=FONT_BOLD)
        style.map("Accent.TButton", background=[("active", ACCENT_HOVER)])

        style.configure("Danger.TButton", background="#3a3a3a", foreground=DANGER,
                         borderwidth=0, padding=6, font=FONT)
        style.map("Danger.TButton", background=[("active", "#4a2a2a")])

        style.configure("Treeview", background=PANEL_ALT, fieldbackground=PANEL_ALT,
                         foreground=TEXT, rowheight=28, borderwidth=0, font=FONT)
        style.configure("Treeview.Heading", background="#333333", foreground=TEXT,
                         borderwidth=0, font=FONT_BOLD)
        style.map("Treeview", background=[("selected", ACCENT)],
                  foreground=[("selected", "white")])

        style.configure("TCheckbutton", background=PANEL, foreground=TEXT, font=FONT)
        style.map("TCheckbutton", background=[("active", PANEL)])

        style.configure("Vertical.TScrollbar", background=PANEL, troughcolor=BG,
                         bordercolor=BG, arrowcolor=TEXT)

    # ----------------------------------------
    #  MENU
    # ----------------------------------------

    def _build_menu(self):
        menubar = tk.Menu(self)

        filemenu = tk.Menu(menubar, tearoff=0)
        filemenu.add_command(label="Open...", command=self.open_file_dialog, accelerator="Ctrl+O")
        filemenu.add_command(label="Reload from disk", command=self.reload_file)
        filemenu.add_separator()
        filemenu.add_command(label="Save", command=self.save_file, accelerator="Ctrl+S")
        filemenu.add_command(label="Save As...", command=self.save_file_as)
        filemenu.add_separator()
        filemenu.add_command(label="Exit", command=self.on_close)
        menubar.add_cascade(label="File", menu=filemenu)

        sitemenu = tk.Menu(menubar, tearoff=0)
        sitemenu.add_command(label="Site Settings...", command=self.open_site_settings)
        menubar.add_cascade(label="Site", menu=sitemenu)

        self.config(menu=menubar)
        self.bind_all("<Control-s>", lambda e: self.save_file())
        self.bind_all("<Control-o>", lambda e: self.open_file_dialog())

    # ----------------------------------------
    #  LAYOUT
    # ----------------------------------------

    def _build_layout(self):
        root = ttk.Frame(self)
        root.pack(fill="both", expand=True)

        # ----- Top bar -----
        topbar = ttk.Frame(root)
        topbar.pack(fill="x", padx=14, pady=(12, 6))

        ttk.Label(topbar, text="NSC Tools Editor", style="Header.TLabel").pack(side="left")
        self.path_label = ttk.Label(topbar, text="", style="TLabel")
        self.path_label.pack(side="left", padx=16)

        ttk.Button(topbar, text="Save", style="Accent.TButton",
                   command=self.save_file).pack(side="right")
        ttk.Button(topbar, text="Site Settings", command=self.open_site_settings).pack(
            side="right", padx=(0, 8))

        body = ttk.Frame(root)
        body.pack(fill="both", expand=True, padx=14, pady=6)
        body.columnconfigure(0, weight=2)
        body.columnconfigure(1, weight=3)
        body.rowconfigure(0, weight=1)

        # ----- Left: project list -----
        left = ttk.Frame(body, style="Panel.TFrame")
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 8))
        left.rowconfigure(1, weight=1)
        left.columnconfigure(0, weight=1)

        left_header = ttk.Frame(left, style="Panel.TFrame")
        left_header.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        ttk.Label(left_header, text="Projects", style="Panel.TLabel", font=FONT_BOLD).pack(side="left")
        ttk.Button(left_header, text="+ New", command=self.add_project).pack(side="right")

        columns = ("category", "title", "version", "enabled")
        self.tree = ttk.Treeview(left, columns=columns, show="headings", selectmode="browse")
        self.tree.heading("category", text="Category")
        self.tree.heading("title", text="Title")
        self.tree.heading("version", text="Ver")
        self.tree.heading("enabled", text="On")
        self.tree.column("category", width=90, anchor="w")
        self.tree.column("title", width=180, anchor="w")
        self.tree.column("version", width=50, anchor="center")
        self.tree.column("enabled", width=40, anchor="center")
        self.tree.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

        self.tree.bind("<<TreeviewSelect>>", self.on_select_project)
        self.tree.bind("<ButtonPress-1>", self._on_drag_start)
        self.tree.bind("<B1-Motion>", self._on_drag_motion)
        self.tree.bind("<ButtonRelease-1>", self._on_drag_end)

        hint = ttk.Label(left, text="Drag rows to reorder  ·  (site sorts cards A-Z, this is just for you)",
                          style="Muted.TLabel", wraplength=260, justify="left")
        hint.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 10))

        # ----- Right: edit panel -----
        right_container = ttk.Frame(body, style="Panel.TFrame")
        right_container.grid(row=0, column=1, sticky="nsew")
        right_container.rowconfigure(0, weight=1)
        right_container.columnconfigure(0, weight=1)

        self.scroll = ScrollableFrame(right_container)
        self.scroll.grid(row=0, column=0, sticky="nsew")

        self.form = self.scroll.inner
        for c in range(2):
            self.form.columnconfigure(c, weight=1)

        self._build_form()

        # ----- Status bar -----
        self.status = ttk.Label(root, text="", style="TLabel", foreground=MUTED)
        self.status.pack(fill="x", padx=14, pady=(0, 10))

    # ----------------------------------------
    #  FORM (right side, one project at a time)
    # ----------------------------------------

    def _build_form(self):
        pad = dict(padx=14, pady=6)
        f = self.form
        row = 0

        ttk.Label(f, text="Edit Project", style="Panel.TLabel", font=FONT_BOLD).grid(
            row=row, column=0, columnspan=2, sticky="w", padx=14, pady=(14, 4))
        row += 1

        self.var_title = tk.StringVar()
        self.var_id = tk.StringVar()
        self.var_category = tk.StringVar()
        self.var_version = tk.StringVar()
        self.var_enabled = tk.BooleanVar(value=True)
        self.var_media_type = tk.StringVar(value="image")

        row = self._labeled_entry(f, row, "Title", self.var_title, on_change=self._on_title_change)
        row = self._labeled_entry(f, row, "ID (unique, url-safe)", self.var_id)

        ttk.Label(f, text="Category", style="Panel.TLabel").grid(row=row, column=0, sticky="w", **pad)
        self.category_combo = ttk.Combobox(f, textvariable=self.var_category, state="normal")
        self.category_combo.grid(row=row, column=1, sticky="ew", **pad)
        row += 1

        row = self._labeled_entry(f, row, "Version", self.var_version)

        ttk.Label(f, text="Enabled (shown on site)", style="Panel.TLabel").grid(
            row=row, column=0, sticky="w", **pad)
        ttk.Checkbutton(f, variable=self.var_enabled).grid(row=row, column=1, sticky="w", **pad)
        row += 1

        ttk.Label(f, text="Description", style="Panel.TLabel").grid(row=row, column=0, sticky="nw", **pad)
        self.desc_text = tk.Text(f, height=3, width=30, bg=PANEL_ALT, fg=TEXT,
                                  insertbackground=TEXT, relief="flat", wrap="word", font=FONT)
        self.desc_text.grid(row=row, column=1, sticky="ew", **pad)
        row += 1

        # ---- Tags ----
        ttk.Label(f, text="Tags", style="Panel.TLabel").grid(row=row, column=0, sticky="nw", **pad)
        tag_col = ttk.Frame(f, style="Panel.TFrame")
        tag_col.grid(row=row, column=1, sticky="ew", **pad)
        tag_col.columnconfigure(0, weight=1)

        self.chip_frame = ttk.Frame(tag_col, style="Panel.TFrame")
        self.chip_frame.grid(row=0, column=0, sticky="ew")

        add_tag_row = ttk.Frame(tag_col, style="Panel.TFrame")
        add_tag_row.grid(row=1, column=0, sticky="ew", pady=(6, 0))
        self.new_tag_var = tk.StringVar()
        tag_entry = ttk.Entry(add_tag_row, textvariable=self.new_tag_var, width=16)
        tag_entry.grid(row=0, column=0, sticky="w")
        tag_entry.bind("<Return>", lambda e: self._add_tag())
        ttk.Button(add_tag_row, text="Add tag", command=self._add_tag).grid(row=0, column=1, padx=6)
        row += 1

        # ---- Media ----
        ttk.Label(f, text="Media type", style="Panel.TLabel").grid(row=row, column=0, sticky="w", **pad)
        media_combo = ttk.Combobox(f, textvariable=self.var_media_type,
                                    values=DEFAULT_MEDIA_TYPES, state="readonly")
        media_combo.grid(row=row, column=1, sticky="ew", **pad)
        row += 1

        ttk.Label(f, text="Media files", style="Panel.TLabel").grid(row=row, column=0, sticky="nw", **pad)
        media_col = ttk.Frame(f, style="Panel.TFrame")
        media_col.grid(row=row, column=1, sticky="ew", **pad)
        media_col.columnconfigure(0, weight=1)

        self.media_listbox = tk.Listbox(media_col, height=3, bg=PANEL_ALT, fg=TEXT,
                                         selectbackground=ACCENT, relief="flat",
                                         highlightthickness=0, font=FONT)
        self.media_listbox.grid(row=0, column=0, sticky="ew")

        media_btns = ttk.Frame(media_col, style="Panel.TFrame")
        media_btns.grid(row=1, column=0, sticky="ew", pady=(6, 0))
        ttk.Button(media_btns, text="Browse...", command=self._browse_media_file).pack(side="left")
        ttk.Button(media_btns, text="Add path...", command=self._add_media_path).pack(side="left", padx=6)
        ttk.Button(media_btns, text="Remove selected", style="Danger.TButton",
                   command=self._remove_media_file).pack(side="left")
        row += 1

        # ---- Links ----
        ttk.Label(f, text="Links", style="Panel.TLabel").grid(row=row, column=0, sticky="nw", **pad)
        self.links_frame = ttk.Frame(f, style="Panel.TFrame")
        self.links_frame.grid(row=row, column=1, sticky="ew", **pad)
        self.links_frame.columnconfigure(0, weight=1)
        row += 1

        ttk.Button(f, text="+ Add link", command=self._add_link_row).grid(
            row=row, column=1, sticky="w", padx=14, pady=(0, 10))
        row += 1

        # ---- Bottom actions ----
        actions = ttk.Frame(f, style="Panel.TFrame")
        actions.grid(row=row, column=0, columnspan=2, sticky="ew", padx=14, pady=(10, 20))
        ttk.Button(actions, text="Apply changes", style="Accent.TButton",
                   command=self.commit_form_to_data).pack(side="left")
        ttk.Button(actions, text="Delete project", style="Danger.TButton",
                   command=self.delete_selected_project).pack(side="left", padx=8)

        self._set_form_enabled(False)

    def _labeled_entry(self, parent, row, label, var, on_change=None):
        pad = dict(padx=14, pady=6)
        ttk.Label(parent, text=label, style="Panel.TLabel").grid(row=row, column=0, sticky="w", **pad)
        entry = ttk.Entry(parent, textvariable=var)
        entry.grid(row=row, column=1, sticky="ew", **pad)
        if on_change:
            var.trace_add("write", lambda *a: on_change())
        return row + 1

    def _on_title_change(self):
        # convenience: suggest an id from the title for brand-new, still-default projects
        pass

    def _set_form_enabled(self, enabled):
        state = "normal" if enabled else "disabled"
        for child in self.form.winfo_children():
            self._set_widget_state(child, state)

    def _set_widget_state(self, widget, state):
        try:
            widget.configure(state=state)
        except tk.TclError:
            pass
        for child in widget.winfo_children():
            self._set_widget_state(child, state)

    # ----------------------------------------
    #  FILE OPERATIONS
    # ----------------------------------------

    def open_file_dialog(self):
        path = filedialog.askopenfilename(
            title="Open tools.json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if path:
            self.load_file(path)

    def load_file(self, path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            messagebox.showerror("Error loading file", str(e))
            return

        data.setdefault("schemaVersion", 1)
        data.setdefault("site", {})
        data["site"].setdefault("title", "")
        data["site"].setdefault("subtitle", "")
        data["site"].setdefault("footer", "")
        data["site"].setdefault("categories", [])
        data.setdefault("projects", [])

        for p in data["projects"]:
            p.setdefault("category", "")
            p.setdefault("title", "")
            p.setdefault("version", "")
            p.setdefault("desc", "")
            p.setdefault("tags", [])
            p.setdefault("enabled", True)
            p.setdefault("media", {"type": "image", "files": []})
            p["media"].setdefault("type", "image")
            p["media"].setdefault("files", [])
            p.setdefault("links", [])

        self.data = data
        self.file_path = path
        self.dirty = False
        self.selected_id = None
        self.refresh_tree()
        self._clear_form()
        self._set_form_enabled(False)
        self.path_label.configure(text=path)
        self.set_status(f"Loaded {len(data['projects'])} projects")

    def reload_file(self):
        if self.file_path:
            if self.dirty and not messagebox.askyesno(
                "Discard changes?", "Reloading will discard unsaved changes. Continue?"
            ):
                return
            self.load_file(self.file_path)

    def save_file(self):
        if not self.file_path:
            return self.save_file_as()
        self.commit_form_to_data(silent=True)
        try:
            if os.path.exists(self.file_path):
                shutil.copy2(self.file_path, self.file_path + ".bak")
            with open(self.file_path, "w", encoding="utf-8") as fh:
                json.dump(self.data, fh, indent=4, ensure_ascii=False)
                fh.write("\n")
        except Exception as e:
            messagebox.showerror("Error saving file", str(e))
            return
        self.dirty = False
        self.set_status(f"Saved to {self.file_path}  (backup: {os.path.basename(self.file_path)}.bak)")

    def save_file_as(self):
        path = filedialog.asksaveasfilename(
            title="Save tools.json as",
            defaultextension=".json",
            filetypes=[("JSON files", "*.json")]
        )
        if path:
            self.file_path = path
            self.path_label.configure(text=path)
            self.save_file()

    def on_close(self):
        if self.dirty:
            if not messagebox.askyesno("Unsaved changes", "You have unsaved changes. Quit anyway?"):
                return
        self.destroy()

    def set_status(self, text):
        self.status.configure(text=text)

    def mark_dirty(self):
        self.dirty = True
        base = os.path.basename(self.file_path) if self.file_path else "untitled"
        self.set_status(f"Unsaved changes - {base}")

    # ----------------------------------------
    #  PROJECT LIST (tree)
    # ----------------------------------------

    def refresh_tree(self):
        self.tree.delete(*self.tree.get_children())
        for p in self.data["projects"]:
            self.tree.insert("", "end", iid=p["id"], values=(
                p.get("category", ""), p.get("title", ""),
                p.get("version", ""), "Yes" if p.get("enabled") else "No"
            ))

    def find_project(self, pid):
        for p in self.data["projects"]:
            if p["id"] == pid:
                return p
        return None

    def on_select_project(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        if self.selected_id and self.selected_id != sel[0]:
            self.commit_form_to_data(silent=True)
        self.selected_id = sel[0]
        p = self.find_project(self.selected_id)
        if p:
            self._load_project_into_form(p)
            self._set_form_enabled(True)

    def add_project(self):
        ids = [p["id"] for p in self.data["projects"]]
        p = new_project(ids)
        if self.data["site"]["categories"]:
            p["category"] = self.data["site"]["categories"][0]
        self.data["projects"].append(p)
        self.refresh_tree()
        self.tree.selection_set(p["id"])
        self.tree.see(p["id"])
        self.on_select_project()
        self.mark_dirty()

    def delete_selected_project(self):
        if not self.selected_id:
            return
        p = self.find_project(self.selected_id)
        if not p:
            return
        if not messagebox.askyesno("Delete project", f"Delete '{p['title']}'? This can't be undone."):
            return
        self.data["projects"] = [x for x in self.data["projects"] if x["id"] != self.selected_id]
        self.selected_id = None
        self.refresh_tree()
        self._clear_form()
        self._set_form_enabled(False)
        self.mark_dirty()

    # ----------------------------------------
    #  DRAG TO REORDER
    # ----------------------------------------

    def _on_drag_start(self, event):
        self._drag_iid = self.tree.identify_row(event.y)

    def _on_drag_motion(self, event):
        if not self._drag_iid:
            return
        target = self.tree.identify_row(event.y)
        if target and target != self._drag_iid:
            target_index = self.tree.index(target)
            self.tree.move(self._drag_iid, "", target_index)

    def _on_drag_end(self, event):
        if self._drag_iid:
            self._sync_project_order_from_tree()
        self._drag_iid = None

    def _sync_project_order_from_tree(self):
        order = self.tree.get_children()
        by_id = {p["id"]: p for p in self.data["projects"]}
        self.data["projects"] = [by_id[iid] for iid in order if iid in by_id]
        self.mark_dirty()

    # ----------------------------------------
    #  FORM <-> DATA
    # ----------------------------------------

    def _clear_form(self):
        self.var_title.set("")
        self.var_id.set("")
        self.var_category.set("")
        self.var_version.set("")
        self.var_enabled.set(True)
        self.var_media_type.set("image")
        self.desc_text.delete("1.0", "end")
        self.media_listbox.delete(0, "end")
        for child in list(self.chip_frame.winfo_children()):
            child.destroy()
        for child in list(self.links_frame.winfo_children()):
            child.destroy()
        self._current_tags = []
        self._current_links = []

    def _load_project_into_form(self, p):
        self._clear_form()
        self.category_combo.configure(values=self.data["site"]["categories"])
        self.var_title.set(p.get("title", ""))
        self.var_id.set(p.get("id", ""))
        self.var_category.set(p.get("category", ""))
        self.var_version.set(p.get("version", ""))
        self.var_enabled.set(bool(p.get("enabled")))
        self.var_media_type.set(p.get("media", {}).get("type", "image"))
        self.desc_text.insert("1.0", p.get("desc", ""))

        self._current_tags = list(p.get("tags", []))
        self._render_chips()

        for f in p.get("media", {}).get("files", []):
            self.media_listbox.insert("end", f)

        self._current_links = [dict(l) for l in p.get("links", [])]
        self._render_links()

    def commit_form_to_data(self, silent=False):
        if not self.selected_id:
            return
        p = self.find_project(self.selected_id)
        if not p:
            return

        new_id = self.var_id.get().strip() or slugify(self.var_title.get())
        if new_id != p["id"]:
            existing = [x["id"] for x in self.data["projects"] if x is not p]
            if new_id in existing:
                messagebox.showerror("Duplicate ID", f"Another project already uses id '{new_id}'.")
                return

        p["id"] = new_id
        p["title"] = self.var_title.get().strip()
        p["category"] = self.var_category.get().strip()
        p["version"] = self.var_version.get().strip()
        p["enabled"] = bool(self.var_enabled.get())
        p["desc"] = self.desc_text.get("1.0", "end").strip()
        p["tags"] = list(self._current_tags)
        p["media"] = {
            "type": self.var_media_type.get(),
            "files": list(self.media_listbox.get(0, "end"))
        }
        p["links"] = [dict(l) for l in self._current_links]

        cats = self.data["site"]["categories"]
        if p["category"] and p["category"] not in cats:
            cats.append(p["category"])

        self.selected_id = p["id"]
        self.refresh_tree()
        self.tree.selection_set(p["id"])
        self.mark_dirty()
        if not silent:
            self.set_status("Applied changes (not yet saved to disk)")

    # ----------------------------------------
    #  TAGS (chip UI)
    # ----------------------------------------

    def _render_chips(self):
        for child in list(self.chip_frame.winfo_children()):
            child.destroy()
        col = 0
        row = 0
        for tag in self._current_tags:
            chip = tk.Frame(self.chip_frame, bg="#3a3a4a", padx=8, pady=3)
            chip.grid(row=row, column=col, padx=3, pady=3, sticky="w")
            tk.Label(chip, text=tag, bg="#3a3a4a", fg=TEXT, font=FONT).pack(side="left")
            tk.Button(chip, text="x", bg="#3a3a4a", fg=MUTED, relief="flat", bd=0,
                      font=FONT, cursor="hand2",
                      command=lambda t=tag: self._remove_tag(t)).pack(side="left", padx=(6, 0))
            col += 1
            if col > 3:
                col = 0
                row += 1

    def _add_tag(self):
        tag = self.new_tag_var.get().strip()
        if tag and tag not in self._current_tags:
            self._current_tags.append(tag)
            self.new_tag_var.set("")
            self._render_chips()
            self.mark_dirty()

    def _remove_tag(self, tag):
        self._current_tags = [t for t in self._current_tags if t != tag]
        self._render_chips()
        self.mark_dirty()

    # ----------------------------------------
    #  MEDIA FILES
    # ----------------------------------------

    def _browse_media_file(self):
        path = filedialog.askopenfilename(title="Choose media file")
        if not path:
            return
        # store relative path to the json file's folder when possible
        if self.file_path:
            base_dir = os.path.dirname(self.file_path)
            try:
                path = os.path.relpath(path, base_dir).replace(os.sep, "/")
            except ValueError:
                pass
        self.media_listbox.insert("end", path)
        self.mark_dirty()

    def _add_media_path(self):
        dialog = SimpleTextPrompt(self, "Add media path", "Relative path (e.g. images/foo.jpg):")
        self.wait_window(dialog)
        if dialog.result:
            self.media_listbox.insert("end", dialog.result)
            self.mark_dirty()

    def _remove_media_file(self):
        sel = list(self.media_listbox.curselection())
        for i in reversed(sel):
            self.media_listbox.delete(i)
        if sel:
            self.mark_dirty()

    # ----------------------------------------
    #  LINKS
    # ----------------------------------------

    def _render_links(self):
        for child in list(self.links_frame.winfo_children()):
            child.destroy()
        for idx, link in enumerate(self._current_links):
            row_frame = ttk.Frame(self.links_frame, style="Panel.TFrame")
            row_frame.grid(row=idx, column=0, sticky="ew", pady=3)
            row_frame.columnconfigure(0, weight=1)
            row_frame.columnconfigure(1, weight=2)

            label_var = tk.StringVar(value=link.get("label", ""))
            url_var = tk.StringVar(value=link.get("url", ""))

            le = ttk.Entry(row_frame, textvariable=label_var, width=10)
            le.grid(row=0, column=0, sticky="ew", padx=(0, 4))
            ue = ttk.Entry(row_frame, textvariable=url_var)
            ue.grid(row=0, column=1, sticky="ew", padx=(0, 4))

            def make_writer(i, lv, uv):
                def writer(*a):
                    self._current_links[i]["label"] = lv.get()
                    self._current_links[i]["url"] = uv.get()
                    self.mark_dirty()
                return writer

            writer = make_writer(idx, label_var, url_var)
            label_var.trace_add("write", writer)
            url_var.trace_add("write", writer)

            ttk.Button(row_frame, text="Remove", style="Danger.TButton",
                       command=lambda i=idx: self._remove_link(i)).grid(row=0, column=2)

    def _add_link_row(self):
        self._current_links.append({"label": "", "url": ""})
        self._render_links()
        self.mark_dirty()

    def _remove_link(self, index):
        del self._current_links[index]
        self._render_links()
        self.mark_dirty()

    # ----------------------------------------
    #  SITE SETTINGS DIALOG
    # ----------------------------------------

    def open_site_settings(self):
        SiteSettingsDialog(self)


# ==================================================
#   SMALL DIALOGS
# ==================================================

class SimpleTextPrompt(tk.Toplevel):
    def __init__(self, parent, title, prompt):
        super().__init__(parent)
        self.title(title)
        self.configure(bg=PANEL)
        self.result = None
        self.geometry("360x120")
        self.resizable(False, False)

        tk.Label(self, text=prompt, bg=PANEL, fg=TEXT, font=FONT).pack(padx=14, pady=(14, 6), anchor="w")
        self.var = tk.StringVar()
        entry = ttk.Entry(self, textvariable=self.var)
        entry.pack(fill="x", padx=14)
        entry.focus_set()

        btns = ttk.Frame(self)
        btns.pack(pady=12)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side="left", padx=6)
        ttk.Button(btns, text="Add", style="Accent.TButton", command=self._confirm).pack(side="left")

        entry.bind("<Return>", lambda e: self._confirm())
        self.transient(parent)
        self.grab_set()

    def _confirm(self):
        self.result = self.var.get().strip()
        self.destroy()


class SiteSettingsDialog(tk.Toplevel):
    def __init__(self, app):
        super().__init__(app)
        self.app = app
        self.title("Site Settings")
        self.configure(bg=PANEL)
        self.geometry("460x620")
        self.minsize(400, 500)
        self.transient(app)
        self.grab_set()

        site = app.data["site"]
        pad = dict(padx=14, pady=6)

        tk.Label(self, text="Site Settings", bg=PANEL, fg=TEXT, font=FONT_HEADER).pack(
            anchor="w", padx=14, pady=(14, 10))

        self.title_var = tk.StringVar(value=site.get("title", ""))
        self.subtitle_var = tk.StringVar(value=site.get("subtitle", ""))
        self.footer_var = tk.StringVar(value=site.get("footer", ""))

        self._labeled(self, "Title", self.title_var)
        self._labeled(self, "Subtitle", self.subtitle_var)
        self._labeled(self, "Footer", self.footer_var)

        tk.Label(self, text="Categories (order = tab order on site)", bg=PANEL, fg=TEXT, font=FONT).pack(
            anchor="w", padx=14, pady=(10, 4))

        self.cat_listbox = tk.Listbox(self, bg=PANEL_ALT, fg=TEXT, selectbackground=ACCENT,
                                       relief="flat", highlightthickness=0, font=FONT)
        self.cat_listbox.pack(fill="both", expand=True, padx=14)
        for c in site.get("categories", []):
            self.cat_listbox.insert("end", c)

        cat_btns = ttk.Frame(self)
        cat_btns.pack(fill="x", padx=14, pady=8)
        self.new_cat_var = tk.StringVar()
        ttk.Entry(cat_btns, textvariable=self.new_cat_var, width=16).pack(side="left")
        ttk.Button(cat_btns, text="Add", command=self._add_category).pack(side="left", padx=4)
        ttk.Button(cat_btns, text="Remove selected", style="Danger.TButton",
                   command=self._remove_category).pack(side="left", padx=4)
        ttk.Button(cat_btns, text="Move up", command=lambda: self._move_category(-1)).pack(side="left", padx=4)
        ttk.Button(cat_btns, text="Move down", command=lambda: self._move_category(1)).pack(side="left")

        bottom = ttk.Frame(self)
        bottom.pack(pady=12)
        ttk.Button(bottom, text="Cancel", command=self.destroy).pack(side="left", padx=6)
        ttk.Button(bottom, text="Save", style="Accent.TButton", command=self._save).pack(side="left")

    def _labeled(self, parent, label, var):
        tk.Label(parent, text=label, bg=PANEL, fg=TEXT, font=FONT).pack(anchor="w", padx=14)
        ttk.Entry(parent, textvariable=var).pack(fill="x", padx=14, pady=(0, 6))

    def _add_category(self):
        c = self.new_cat_var.get().strip()
        if c:
            self.cat_listbox.insert("end", c)
            self.new_cat_var.set("")

    def _remove_category(self):
        sel = list(self.cat_listbox.curselection())
        for i in reversed(sel):
            self.cat_listbox.delete(i)

    def _move_category(self, direction):
        sel = self.cat_listbox.curselection()
        if not sel:
            return
        i = sel[0]
        j = i + direction
        if 0 <= j < self.cat_listbox.size():
            val = self.cat_listbox.get(i)
            self.cat_listbox.delete(i)
            self.cat_listbox.insert(j, val)
            self.cat_listbox.selection_set(j)

    def _save(self):
        site = self.app.data["site"]
        site["title"] = self.title_var.get().strip()
        site["subtitle"] = self.subtitle_var.get().strip()
        site["footer"] = self.footer_var.get().strip()
        site["categories"] = list(self.cat_listbox.get(0, "end"))
        self.app.mark_dirty()
        self.destroy()


# ==================================================
#   ENTRY POINT
# ==================================================

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else None
    app = ToolsEditorApp(path)
    app.mainloop()


if __name__ == "__main__":
    main()
