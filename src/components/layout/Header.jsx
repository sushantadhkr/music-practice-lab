import React, { useState, useRef } from "react";
import { Download, Upload, Plus, Github, Menu, X } from "lucide-react";
import logo from "/music-practice-lab.svg?url";

const Header = ({ onAddWidget, onImportWidgets }) => {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleExport = () => {
    const data = localStorage.getItem("mpl-widgets") || "[]";
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "music-practice-lab-widgets.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          localStorage.setItem("mpl-widgets", JSON.stringify(parsed));
          onImportWidgets?.(parsed);
        }
      } catch {}
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const ActionButtons = (
    <>
      <button
        className="flex items-center w-fit gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow transition"
        onClick={onAddWidget}
        title="Add widget (Ctrl+K)"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">Add Widget</span>
        <span className="hidden sm:inline text-xs bg-blue-500 px-2 py-1 rounded">
          Ctrl+K
        </span>
      </button>
      <button
        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 w-fit bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        onClick={handleExport}
        title="Export widgets"
        aria-label="Export widgets"
      >
        <Upload className="w-5 h-5" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />
      <button
        className="p-2 rounded-lg border border-gray-200 w-fit dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
        onClick={handleImportClick}
        title="Import widgets"
        aria-label="Import widgets"
      >
        <Download className="w-5 h-5" />
      </button>
      <button
        id="req-feature-btn"
        className="px-4 py-2 bg-green-600 hover:bg-green-700 w-fit text-white rounded-lg font-semibold transition-colors cursor-pointer shadow"
      >
        💡
      </button>
      <a href="https://github.com/wormcracker" target="_blank">
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 w-fit text-white rounded-lg font-semibold transition-colors cursor-pointer shadow">
          <Github />
        </button>
      </a>
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-full flex items-center justify-between px-4 py-3">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <span className="w-6 h-6">
            <img src={logo} alt="Music Practice Lab logo" />
          </span>
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Music Practice Lab
          </span>
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">{ActionButtons}</div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden flex flex-row-reverse gap-2 border-t p-4 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {ActionButtons}
        </div>
      )}
    </header>
  );
};

export default Header;
