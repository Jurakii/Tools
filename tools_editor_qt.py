#!/usr/bin/env python3
"""
NSC Tools - JSON Editor (PySide6 edition)
------------------------------------------
A modern desktop GUI for editing tools.json.

Requires PySide6:
    pip install PySide6

Run:
    python3 tools_editor_qt.py
    (optionally: python3 tools_editor_qt.py /path/to/tools.json)
"""

import json
import os
import shutil
import sys

from PySide6.QtCore import Qt, QRect, QPoint, QSize, Signal
from PySide6.QtGui import QAction, QKeySequence
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QLabel, QLineEdit, QTextEdit,
    QComboBox, QCheckBox, QPushButton, QVBoxLayout, QHBoxLayout, QFormLayout,
    QListWidget, QListWidgetItem, QScrollArea,
    QFileDialog, QMessageBox, QDialog, QInputDialog, QAbstractItemView,
    QSizePolicy, QLayout, QFrame, QSplitter
)

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

DEFAULT_MEDIA_TYPES = ["image", "icons"]

EMPTY_SITE = {
    "schemaVersion": 1,
    "site": {"title": "", "subtitle": "", "footer": "", "categories": []},
    "projects": []
}

STYLESHEET = """
QWidget {
    background-color: %(BG)s;
    color: %(TEXT)s;
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
}
QMainWindow, QDialog { background-color: %(BG)s; }
QLabel, QCheckBox, QScrollArea, QScrollArea > QWidget > QWidget {
    background: transparent;
}
QFrame#panel { background-color: %(PANEL)s; border-radius: 10px; }
QLineEdit, QTextEdit, QComboBox {
    background-color: %(PANEL_ALT)s;
    border: 1px solid %(BORDER)s;
    border-radius: 6px;
    padding: 6px;
    selection-background-color: %(ACCENT)s;
}
QComboBox::drop-down { border: none; width: 22px; }
QListWidget {
    background-color: %(PANEL_ALT)s;
    border: 1px solid %(BORDER)s;
    border-radius: 6px;
    outline: none;
}
QListWidget::item { padding: 4px; border-radius: 6px; }
QListWidget::item:selected { background: %(ACCENT)s; color: white; }
QHeaderView::section {
    background: #333333; color: %(TEXT)s; border: none; padding: 6px; font-weight: bold;
}
QPushButton {
    background-color: #3a3a3a;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
}
QPushButton:hover { background-color: #4a4a4a; }
QPushButton#accentBtn { background-color: %(ACCENT)s; color: white; font-weight: bold; }
QPushButton#accentBtn:hover { background-color: %(ACCENT_HOVER)s; }
QPushButton#dangerBtn { color: %(DANGER)s; }
QPushButton#dangerBtn:hover { background-color: #3a2a2a; }
QCheckBox::indicator { width: 16px; height: 16px; }
QScrollArea { border: none; }
QStatusBar { color: %(MUTED)s; }
QLabel#header { font-size: 15pt; font-weight: bold; }
QLabel#sectionHeader { font-size: 11pt; font-weight: bold; }
QLabel#muted { color: %(MUTED)s; }
QFrame#tagChip { background: #3a3a4a; border-radius: 12px; }
QPushButton#tagChipRemove {
    background: transparent; color: %(MUTED)s; border-radius: 9px; padding: 0px; font-weight: bold;
}
QPushButton#tagChipRemove:hover { background: #4a4a5a; color: white; }
QSplitter::handle { background-color: %(BG)s; width: 6px; }
""" % dict(BG=BG, PANEL=PANEL, PANEL_ALT=PANEL_ALT, BORDER=BORDER, TEXT=TEXT,
           MUTED=MUTED, ACCENT=ACCENT, ACCENT_HOVER=ACCENT_HOVER, DANGER=DANGER)


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
        "id": pid, "category": "", "title": "New Project", "version": "1.0",
        "desc": "", "tags": [], "enabled": True,
        "media": {"type": "image", "files": []}, "links": []
    }


def slugify(text):
    out, prev_dash = [], False
    for ch in text.lower().strip():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif not prev_dash:
            out.append("-")
            prev_dash = True
    return "".join(out).strip("-") or "project"


# ==================================================
#   FLOW LAYOUT  (wraps tag chips onto multiple lines)
# ==================================================

class FlowLayout(QLayout):
    def __init__(self, parent=None, margin=0, spacing=6):
        super().__init__(parent)
        self._items = []
        self.setContentsMargins(margin, margin, margin, margin)
        self.setSpacing(spacing)

    def addItem(self, item):
        self._items.append(item)

    def count(self):
        return len(self._items)

    def itemAt(self, index):
        return self._items[index] if 0 <= index < len(self._items) else None

    def takeAt(self, index):
        return self._items.pop(index) if 0 <= index < len(self._items) else None

    def expandingDirections(self):
        return Qt.Orientation(0)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, width):
        return self._do_layout(QRect(0, 0, width, 0), True)

    def setGeometry(self, rect):
        super().setGeometry(rect)
        self._do_layout(rect, False)

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for item in self._items:
            size = size.expandedTo(item.minimumSize())
        m = self.contentsMargins()
        size += QSize(m.left() + m.right(), m.top() + m.bottom())
        return size

    def _do_layout(self, rect, test_only):
        x, y, line_height = rect.x(), rect.y(), 0
        spacing = self.spacing()
        for item in self._items:
            next_x = x + item.sizeHint().width() + spacing
            if next_x - spacing > rect.right() and line_height > 0:
                x = rect.x()
                y += line_height + spacing
                next_x = x + item.sizeHint().width() + spacing
                line_height = 0
            if not test_only:
                item.setGeometry(QRect(QPoint(x, y), item.sizeHint()))
            x = next_x
            line_height = max(line_height, item.sizeHint().height())
        return y + line_height - rect.y()


# ==================================================
#   TAG CHIP
# ==================================================

class TagChip(QFrame):
    removed = Signal(str)

    def __init__(self, text):
        super().__init__()
        self.setObjectName("tagChip")
        self.text_value = text
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 4, 6, 4)
        layout.setSpacing(6)
        layout.addWidget(QLabel(text))
        btn = QPushButton("\u00d7")
        btn.setObjectName("tagChipRemove")
        btn.setFixedSize(18, 18)
        btn.setCursor(Qt.PointingHandCursor)
        btn.clicked.connect(lambda: self.removed.emit(self.text_value))
        layout.addWidget(btn)


# ==================================================
#   MEDIA LIST  (accepts real OS drag-and-drop of files)
# ==================================================

class MediaListWidget(QListWidget):
    filesDropped = Signal(list)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAcceptDrops(True)
        self.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.setMaximumHeight(90)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            super().dragEnterEvent(event)

    def dragMoveEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            super().dragMoveEvent(event)

    def dropEvent(self, event):
        if event.mimeData().hasUrls():
            paths = [u.toLocalFile() for u in event.mimeData().urls() if u.isLocalFile()]
            if paths:
                self.filesDropped.emit(paths)
            event.acceptProposedAction()
        else:
            super().dropEvent(event)


# ==================================================
#   LINK ROW
# ==================================================

class LinkRow(QWidget):
    changed = Signal()
    removeRequested = Signal(object)

    def __init__(self, label="", url=""):
        super().__init__()
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        self.label_edit = QLineEdit(label)
        self.label_edit.setPlaceholderText("Label")
        self.label_edit.setMaximumWidth(110)
        self.url_edit = QLineEdit(url)
        self.url_edit.setPlaceholderText("URL or relative path")
        remove_btn = QPushButton("Remove")
        remove_btn.setObjectName("dangerBtn")
        layout.addWidget(self.label_edit)
        layout.addWidget(self.url_edit)
        layout.addWidget(remove_btn)

        self.label_edit.textChanged.connect(self.changed.emit)
        self.url_edit.textChanged.connect(self.changed.emit)
        remove_btn.clicked.connect(lambda: self.removeRequested.emit(self))

    def data(self):
        return {"label": self.label_edit.text().strip(), "url": self.url_edit.text().strip()}


# ==================================================
#   PROJECT LIST  (flat list - InternalMove can only reorder siblings,
#   unlike QTreeWidget which can accidentally nest a dropped row)
# ==================================================

class ProjectList(QListWidget):
    orderChanged = Signal()

    def dropEvent(self, event):
        super().dropEvent(event)
        self.orderChanged.emit()


class ProjectRow(QWidget):
    def __init__(self, project):
        super().__init__()
        self.setObjectName("projectRow")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 6, 10, 6)
        layout.setSpacing(2)

        top = QHBoxLayout()
        self.title_label = QLabel()
        self.title_label.setStyleSheet("font-weight: 600;")
        self.status_label = QLabel()
        top.addWidget(self.title_label)
        top.addStretch()
        top.addWidget(self.status_label)
        layout.addLayout(top)

        self.meta_label = QLabel()
        self.meta_label.setObjectName("muted")
        layout.addWidget(self.meta_label)

        self.set_data(project)

    def set_data(self, project):
        self.title_label.setText(project.get("title", "") or "(untitled)")
        cat = project.get("category", "")
        ver = project.get("version", "")
        meta = cat
        if ver:
            meta = f"{cat}  \u00b7  v{ver}" if cat else f"v{ver}"
        self.meta_label.setText(meta)
        enabled = bool(project.get("enabled"))
        self.status_label.setText("\u25cf On" if enabled else "\u25cb Off")
        self.status_label.setStyleSheet(
            f"color: {ACCENT if enabled else MUTED}; font-weight: 600;"
        )


# ==================================================
#   SITE SETTINGS DIALOG
# ==================================================

class SiteSettingsDialog(QDialog):
    def __init__(self, main_window):
        super().__init__(main_window)
        self.main_window = main_window
        self.setWindowTitle("Site Settings")
        self.resize(460, 620)
        self.setMinimumSize(400, 500)

        site = main_window.data["site"]
        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(8)

        header = QLabel("Site Settings")
        header.setObjectName("header")
        layout.addWidget(header)

        form = QFormLayout()
        self.title_edit = QLineEdit(site.get("title", ""))
        self.subtitle_edit = QLineEdit(site.get("subtitle", ""))
        self.footer_edit = QLineEdit(site.get("footer", ""))
        form.addRow("Title", self.title_edit)
        form.addRow("Subtitle", self.subtitle_edit)
        form.addRow("Footer", self.footer_edit)
        layout.addLayout(form)

        cat_label = QLabel("Categories (order = tab order on site, drag to reorder)")
        cat_label.setObjectName("muted")
        cat_label.setWordWrap(True)
        layout.addWidget(cat_label)

        self.cat_list = QListWidget()
        self.cat_list.setDragDropMode(QAbstractItemView.InternalMove)
        self.cat_list.addItems(site.get("categories", []))
        layout.addWidget(self.cat_list, stretch=1)

        cat_btns = QHBoxLayout()
        self.new_cat_edit = QLineEdit()
        self.new_cat_edit.setPlaceholderText("New category name")
        self.new_cat_edit.returnPressed.connect(self._add_category)
        add_btn = QPushButton("Add")
        remove_btn = QPushButton("Remove selected")
        remove_btn.setObjectName("dangerBtn")
        add_btn.clicked.connect(self._add_category)
        remove_btn.clicked.connect(self._remove_category)
        cat_btns.addWidget(self.new_cat_edit)
        cat_btns.addWidget(add_btn)
        cat_btns.addWidget(remove_btn)
        layout.addLayout(cat_btns)

        bottom = QHBoxLayout()
        bottom.addStretch()
        cancel_btn = QPushButton("Cancel")
        save_btn = QPushButton("Save")
        save_btn.setObjectName("accentBtn")
        cancel_btn.clicked.connect(self.reject)
        save_btn.clicked.connect(self._save)
        bottom.addWidget(cancel_btn)
        bottom.addWidget(save_btn)
        layout.addLayout(bottom)

    def _add_category(self):
        text = self.new_cat_edit.text().strip()
        if text:
            self.cat_list.addItem(QListWidgetItem(text))
            self.new_cat_edit.clear()

    def _remove_category(self):
        for item in self.cat_list.selectedItems():
            self.cat_list.takeItem(self.cat_list.row(item))

    def _save(self):
        site = self.main_window.data["site"]
        site["title"] = self.title_edit.text().strip()
        site["subtitle"] = self.subtitle_edit.text().strip()
        site["footer"] = self.footer_edit.text().strip()
        site["categories"] = [self.cat_list.item(i).text() for i in range(self.cat_list.count())]
        self.main_window.mark_dirty()
        self.main_window.refresh_category_combo()
        self.accept()


# ==================================================
#   MAIN WINDOW
# ==================================================

class MainWindow(QMainWindow):
    def __init__(self, path=None):
        super().__init__()
        self.setWindowTitle("NSC Tools - JSON Editor")
        self.resize(1380, 860)
        self.setMinimumSize(1080, 680)

        self.file_path = None
        self.data = None
        self.selected_id = None
        self.dirty = False
        self.current_tags = []
        self.link_rows = []

        self._build_ui()

        if path and os.path.exists(path):
            self.load_file(path)
        else:
            guess = os.path.join(os.getcwd(), "tools.json")
            if os.path.exists(guess):
                self.load_file(guess)
            else:
                self.data = json.loads(json.dumps(EMPTY_SITE))
                self.refresh_tree()
                self.statusBar().showMessage("No file loaded - use File > Open")

    # ----------------------------------------
    #  UI CONSTRUCTION
    # ----------------------------------------

    def _build_ui(self):
        self._build_menu()

        central = QWidget()
        self.setCentralWidget(central)
        root = QVBoxLayout(central)
        root.setContentsMargins(14, 12, 14, 8)

        topbar = QHBoxLayout()
        title_label = QLabel("NSC Tools Editor")
        title_label.setObjectName("header")
        self.path_label = QLabel("")
        self.path_label.setObjectName("muted")
        topbar.addWidget(title_label)
        topbar.addWidget(self.path_label)
        topbar.addStretch()
        site_settings_btn = QPushButton("Site Settings")
        site_settings_btn.clicked.connect(self.open_site_settings)
        save_btn = QPushButton("Save")
        save_btn.setObjectName("accentBtn")
        save_btn.clicked.connect(self.save_file)
        topbar.addWidget(site_settings_btn)
        topbar.addWidget(save_btn)
        root.addLayout(topbar)

        splitter = QSplitter(Qt.Horizontal)
        root.addWidget(splitter, stretch=1)

        # ----- Left: project list -----
        left_panel = QFrame()
        left_panel.setObjectName("panel")
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(10, 10, 10, 10)

        left_header = QHBoxLayout()
        left_title = QLabel("Projects")
        left_title.setObjectName("sectionHeader")
        new_btn = QPushButton("+ New")
        new_btn.clicked.connect(self.add_project)
        left_header.addWidget(left_title)
        left_header.addStretch()
        left_header.addWidget(new_btn)
        left_layout.addLayout(left_header)

        self.tree = ProjectList()
        self.tree.setSpacing(2)
        self.tree.setDragDropMode(QAbstractItemView.InternalMove)
        self.tree.setSelectionMode(QAbstractItemView.SingleSelection)
        self.tree.itemSelectionChanged.connect(self.on_select_project)
        self.tree.orderChanged.connect(self._sync_order_from_tree)
        left_layout.addWidget(self.tree, stretch=1)

        hint = QLabel("Drag rows to reorder \u00b7 site always sorts cards A-Z, this is just for you")
        hint.setObjectName("muted")
        hint.setWordWrap(True)
        left_layout.addWidget(hint)

        splitter.addWidget(left_panel)

        # ----- Right: edit form -----
        right_panel = QFrame()
        right_panel.setObjectName("panel")
        right_outer = QVBoxLayout(right_panel)
        right_outer.setContentsMargins(0, 0, 0, 0)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        right_outer.addWidget(scroll)

        self.form_widget = QWidget()
        scroll.setWidget(self.form_widget)
        self._build_form(self.form_widget)

        splitter.addWidget(right_panel)
        splitter.setSizes([460, 900])

        self.statusBar().showMessage("")
        self._set_form_enabled(False)

    def _build_menu(self):
        menubar = self.menuBar()

        file_menu = menubar.addMenu("File")
        open_action = QAction("Open...", self)
        open_action.setShortcut(QKeySequence.Open)
        open_action.triggered.connect(self.open_file_dialog)
        reload_action = QAction("Reload from disk", self)
        reload_action.triggered.connect(self.reload_file)
        save_action = QAction("Save", self)
        save_action.setShortcut(QKeySequence.Save)
        save_action.triggered.connect(self.save_file)
        save_as_action = QAction("Save As...", self)
        save_as_action.triggered.connect(self.save_file_as)
        exit_action = QAction("Exit", self)
        exit_action.triggered.connect(self.close)
        for a in (open_action, reload_action, save_action, save_as_action, exit_action):
            file_menu.addAction(a)
            if a is save_as_action:
                file_menu.addSeparator()

        site_menu = menubar.addMenu("Site")
        settings_action = QAction("Site Settings...", self)
        settings_action.triggered.connect(self.open_site_settings)
        site_menu.addAction(settings_action)

    def _build_form(self, parent):
        layout = QVBoxLayout(parent)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(10)

        header = QLabel("Edit Project")
        header.setObjectName("sectionHeader")
        layout.addWidget(header)

        form = QFormLayout()
        form.setSpacing(8)

        self.title_edit = QLineEdit()
        self.id_edit = QLineEdit()
        self.category_combo = QComboBox()
        self.category_combo.setEditable(True)
        self.version_edit = QLineEdit()
        self.enabled_check = QCheckBox("Shown on site")
        self.desc_edit = QTextEdit()
        self.desc_edit.setMaximumHeight(70)

        form.addRow("Title", self.title_edit)
        form.addRow("ID (unique, url-safe)", self.id_edit)
        form.addRow("Category", self.category_combo)
        form.addRow("Version", self.version_edit)
        form.addRow("Enabled", self.enabled_check)
        form.addRow("Description", self.desc_edit)
        layout.addLayout(form)

        # ---- Tags ----
        layout.addWidget(self._label("Tags"))
        self.chip_container = QWidget()
        self.chip_layout = FlowLayout(self.chip_container, spacing=6)
        layout.addWidget(self.chip_container)

        tag_row = QHBoxLayout()
        self.new_tag_edit = QLineEdit()
        self.new_tag_edit.setPlaceholderText("New tag")
        self.new_tag_edit.setMaximumWidth(160)
        self.new_tag_edit.returnPressed.connect(self._add_tag)
        add_tag_btn = QPushButton("Add tag")
        add_tag_btn.clicked.connect(self._add_tag)
        tag_row.addWidget(self.new_tag_edit)
        tag_row.addWidget(add_tag_btn)
        tag_row.addStretch()
        layout.addLayout(tag_row)

        # ---- Media ----
        media_form = QFormLayout()
        self.media_type_combo = QComboBox()
        self.media_type_combo.addItems(DEFAULT_MEDIA_TYPES)
        media_form.addRow("Media type", self.media_type_combo)
        layout.addLayout(media_form)

        layout.addWidget(self._label("Media files  (drag files here from your file browser)"))
        self.media_list = MediaListWidget()
        self.media_list.filesDropped.connect(self._on_files_dropped)
        layout.addWidget(self.media_list)

        media_btns = QHBoxLayout()
        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self._browse_media_file)
        add_path_btn = QPushButton("Add path...")
        add_path_btn.clicked.connect(self._add_media_path)
        remove_media_btn = QPushButton("Remove selected")
        remove_media_btn.setObjectName("dangerBtn")
        remove_media_btn.clicked.connect(self._remove_media_file)
        media_btns.addWidget(browse_btn)
        media_btns.addWidget(add_path_btn)
        media_btns.addWidget(remove_media_btn)
        media_btns.addStretch()
        layout.addLayout(media_btns)

        # ---- Links ----
        layout.addWidget(self._label("Links"))
        self.links_container = QWidget()
        self.links_layout = QVBoxLayout(self.links_container)
        self.links_layout.setContentsMargins(0, 0, 0, 0)
        self.links_layout.setSpacing(6)
        layout.addWidget(self.links_container)

        add_link_btn = QPushButton("+ Add link")
        add_link_btn.clicked.connect(lambda: self._add_link_row())
        layout.addWidget(add_link_btn, alignment=Qt.AlignLeft)

        # ---- Actions ----
        actions = QHBoxLayout()
        apply_btn = QPushButton("Apply changes")
        apply_btn.setObjectName("accentBtn")
        apply_btn.clicked.connect(lambda: self.commit_form_to_data())
        delete_btn = QPushButton("Delete project")
        delete_btn.setObjectName("dangerBtn")
        delete_btn.clicked.connect(self.delete_selected_project)
        actions.addWidget(apply_btn)
        actions.addWidget(delete_btn)
        actions.addStretch()
        layout.addLayout(actions)
        layout.addStretch()

        self._form_fields = [
            self.title_edit, self.id_edit, self.category_combo, self.version_edit,
            self.enabled_check, self.desc_edit, self.new_tag_edit, self.media_type_combo,
            self.media_list, apply_btn, delete_btn
        ]

    def _label(self, text):
        lbl = QLabel(text)
        lbl.setObjectName("sectionHeader")
        return lbl

    def _set_form_enabled(self, enabled):
        for w in getattr(self, "_form_fields", []):
            w.setEnabled(enabled)

    # ----------------------------------------
    #  FILE OPERATIONS
    # ----------------------------------------

    def open_file_dialog(self):
        path, _ = QFileDialog.getOpenFileName(self, "Open tools.json", "", "JSON files (*.json)")
        if path:
            self.load_file(path)

    def load_file(self, path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except Exception as e:
            QMessageBox.critical(self, "Error loading file", str(e))
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
        self.refresh_category_combo()
        self._clear_form()
        self._set_form_enabled(False)
        self.path_label.setText(path)
        self.statusBar().showMessage(f"Loaded {len(data['projects'])} projects")

    def reload_file(self):
        if not self.file_path:
            return
        if self.dirty:
            resp = QMessageBox.question(self, "Discard changes?",
                                         "Reloading will discard unsaved changes. Continue?")
            if resp != QMessageBox.Yes:
                return
        self.load_file(self.file_path)

    def save_file(self):
        if not self.file_path:
            self.save_file_as()
            return
        self.commit_form_to_data(silent=True)
        try:
            if os.path.exists(self.file_path):
                shutil.copy2(self.file_path, self.file_path + ".bak")
            with open(self.file_path, "w", encoding="utf-8") as fh:
                json.dump(self.data, fh, indent=4, ensure_ascii=False)
                fh.write("\n")
        except Exception as e:
            QMessageBox.critical(self, "Error saving file", str(e))
            return
        self.dirty = False
        self.statusBar().showMessage(
            f"Saved to {self.file_path}  (backup: {os.path.basename(self.file_path)}.bak)")

    def save_file_as(self):
        path, _ = QFileDialog.getSaveFileName(self, "Save tools.json as", "", "JSON files (*.json)")
        if path:
            self.file_path = path
            self.path_label.setText(path)
            self.save_file()

    def closeEvent(self, event):
        if self.dirty:
            resp = QMessageBox.question(self, "Unsaved changes", "You have unsaved changes. Quit anyway?")
            if resp != QMessageBox.Yes:
                event.ignore()
                return
        event.accept()

    def mark_dirty(self):
        self.dirty = True
        base = os.path.basename(self.file_path) if self.file_path else "untitled"
        self.statusBar().showMessage(f"Unsaved changes - {base}")

    def refresh_category_combo(self):
        current = self.category_combo.currentText()
        self.category_combo.clear()
        self.category_combo.addItems(self.data["site"]["categories"])
        self.category_combo.setCurrentText(current)

    # ----------------------------------------
    #  PROJECT LIST (tree)
    # ----------------------------------------

    def refresh_tree(self):
        self.tree.blockSignals(True)
        self.tree.clear()
        for p in self.data["projects"]:
            item = QListWidgetItem()
            item.setData(Qt.UserRole, p["id"])
            row = ProjectRow(p)
            item.setSizeHint(row.sizeHint())
            self.tree.addItem(item)
            self.tree.setItemWidget(item, row)
        self.tree.blockSignals(False)

    def find_project(self, pid):
        for p in self.data["projects"]:
            if p["id"] == pid:
                return p
        return None

    def _select_item_by_id(self, pid):
        for i in range(self.tree.count()):
            item = self.tree.item(i)
            if item.data(Qt.UserRole) == pid:
                self.tree.setCurrentItem(item)
                return

    def _find_item_by_id(self, pid):
        for i in range(self.tree.count()):
            item = self.tree.item(i)
            if item.data(Qt.UserRole) == pid:
                return item
        return None

    def _sync_order_from_tree(self):
        order = [self.tree.item(i).data(Qt.UserRole)
                 for i in range(self.tree.count())]
        by_id = {p["id"]: p for p in self.data["projects"]}
        self.data["projects"] = [by_id[pid] for pid in order if pid in by_id]
        self.mark_dirty()

    def on_select_project(self):
        items = self.tree.selectedItems()
        if not items:
            return
        pid = items[0].data(Qt.UserRole)
        if self.selected_id and self.selected_id != pid:
            self.commit_form_to_data(silent=True)
        self.selected_id = pid
        p = self.find_project(pid)
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
        self._select_item_by_id(p["id"])
        self.mark_dirty()

    def delete_selected_project(self):
        if not self.selected_id:
            return
        p = self.find_project(self.selected_id)
        if not p:
            return
        resp = QMessageBox.question(self, "Delete project", f"Delete '{p['title']}'? This can't be undone.")
        if resp != QMessageBox.Yes:
            return
        self.data["projects"] = [x for x in self.data["projects"] if x["id"] != self.selected_id]
        self.selected_id = None
        self.refresh_tree()
        self._clear_form()
        self._set_form_enabled(False)
        self.mark_dirty()

    # ----------------------------------------
    #  FORM <-> DATA
    # ----------------------------------------

    def _clear_form(self):
        self.title_edit.clear()
        self.id_edit.clear()
        self.category_combo.setCurrentText("")
        self.version_edit.clear()
        self.enabled_check.setChecked(True)
        self.media_type_combo.setCurrentIndex(0)
        self.desc_edit.clear()
        self.media_list.clear()
        while self.chip_layout.count():
            item = self.chip_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        while self.links_layout.count():
            item = self.links_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        self.current_tags = []
        self.link_rows = []

    def _load_project_into_form(self, p):
        self._clear_form()
        self.refresh_category_combo()
        self.title_edit.setText(p.get("title", ""))
        self.id_edit.setText(p.get("id", ""))
        self.category_combo.setCurrentText(p.get("category", ""))
        self.version_edit.setText(p.get("version", ""))
        self.enabled_check.setChecked(bool(p.get("enabled")))
        media_type = p.get("media", {}).get("type", "image")
        idx = self.media_type_combo.findText(media_type)
        self.media_type_combo.setCurrentIndex(idx if idx >= 0 else 0)
        self.desc_edit.setPlainText(p.get("desc", ""))

        self.current_tags = list(p.get("tags", []))
        self._render_chips()

        for f in p.get("media", {}).get("files", []):
            self.media_list.addItem(QListWidgetItem(f))

        for link in p.get("links", []):
            self._add_link_row(link.get("label", ""), link.get("url", ""))

    def commit_form_to_data(self, silent=False):
        if not self.selected_id:
            return
        p = self.find_project(self.selected_id)
        if not p:
            return

        new_id = self.id_edit.text().strip() or slugify(self.title_edit.text())
        if new_id != p["id"]:
            existing = [x["id"] for x in self.data["projects"] if x is not p]
            if new_id in existing:
                QMessageBox.critical(self, "Duplicate ID", f"Another project already uses id '{new_id}'.")
                return

        p["id"] = new_id
        p["title"] = self.title_edit.text().strip()
        p["category"] = self.category_combo.currentText().strip()
        p["version"] = self.version_edit.text().strip()
        p["enabled"] = self.enabled_check.isChecked()
        p["desc"] = self.desc_edit.toPlainText().strip()
        p["tags"] = list(self.current_tags)
        p["media"] = {
            "type": self.media_type_combo.currentText(),
            "files": [self.media_list.item(i).text() for i in range(self.media_list.count())]
        }
        p["links"] = [row.data() for row in self.link_rows]

        cats = self.data["site"]["categories"]
        if p["category"] and p["category"] not in cats:
            cats.append(p["category"])
            self.refresh_category_combo()

        # Update the existing row in place instead of rebuilding the tree -
        # rebuilding would clear the current selection and undo any drag reorder.
        item = self._find_item_by_id(self.selected_id)
        self.selected_id = p["id"]
        if item is not None:
            item.setData(Qt.UserRole, p["id"])
            row_widget = self.tree.itemWidget(item)
            if row_widget is not None:
                row_widget.set_data(p)
        self.mark_dirty()
        if not silent:
            self.statusBar().showMessage("Applied changes (not yet saved to disk)")

    # ----------------------------------------
    #  TAGS
    # ----------------------------------------

    def _render_chips(self):
        while self.chip_layout.count():
            item = self.chip_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        for tag in self.current_tags:
            chip = TagChip(tag)
            chip.removed.connect(self._remove_tag)
            self.chip_layout.addWidget(chip)

    def _add_tag(self):
        tag = self.new_tag_edit.text().strip()
        if tag and tag not in self.current_tags:
            self.current_tags.append(tag)
            self.new_tag_edit.clear()
            self._render_chips()
            self.mark_dirty()

    def _remove_tag(self, tag):
        self.current_tags = [t for t in self.current_tags if t != tag]
        self._render_chips()
        self.mark_dirty()

    # ----------------------------------------
    #  MEDIA FILES
    # ----------------------------------------

    def _relativize(self, path):
        if self.file_path:
            base_dir = os.path.dirname(self.file_path)
            try:
                return os.path.relpath(path, base_dir).replace(os.sep, "/")
            except ValueError:
                pass
        return path

    def _browse_media_file(self):
        path, _ = QFileDialog.getOpenFileName(self, "Choose media file")
        if path:
            self.media_list.addItem(QListWidgetItem(self._relativize(path)))
            self.mark_dirty()

    def _add_media_path(self):
        text, ok = QInputDialog.getText(self, "Add media path", "Relative path (e.g. images/foo.jpg):")
        if ok and text.strip():
            self.media_list.addItem(QListWidgetItem(text.strip()))
            self.mark_dirty()

    def _remove_media_file(self):
        for item in self.media_list.selectedItems():
            self.media_list.takeItem(self.media_list.row(item))
        self.mark_dirty()

    def _on_files_dropped(self, paths):
        for path in paths:
            self.media_list.addItem(QListWidgetItem(self._relativize(path)))
        self.mark_dirty()

    # ----------------------------------------
    #  LINKS
    # ----------------------------------------

    def _add_link_row(self, label="", url=""):
        row = LinkRow(label, url)
        row.changed.connect(self.mark_dirty)
        row.removeRequested.connect(self._remove_link_row)
        self.links_layout.addWidget(row)
        self.link_rows.append(row)
        self.mark_dirty()

    def _remove_link_row(self, row):
        if row in self.link_rows:
            self.link_rows.remove(row)
        self.links_layout.removeWidget(row)
        row.deleteLater()
        self.mark_dirty()

    # ----------------------------------------
    #  SITE SETTINGS
    # ----------------------------------------

    def open_site_settings(self):
        dialog = SiteSettingsDialog(self)
        dialog.exec()


# ==================================================
#   ENTRY POINT
# ==================================================

def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLESHEET)
    path = sys.argv[1] if len(sys.argv) > 1 else None
    window = MainWindow(path)
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()