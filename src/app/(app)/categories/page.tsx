"use client";

import React, { useEffect, useState } from "react";
import { Plus, Loader2, Tags, Edit2, Trash2, X, Check } from "lucide-react";
import { IconHelper } from "@/components/ui/IconHelper";

interface Category {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  subcategories: string[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeTab, setActiveTypeTab] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [icon, setIcon] = useState("Tag");
  const [color, setColor] = useState("#10B981");
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [newSubInput, setNewSubInput] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCat(null);
    setName("");
    setType(activeTypeTab);
    setIcon("Tag");
    setColor("#10B981");
    setSubcategories([]);
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setType(cat.type as "EXPENSE" | "INCOME");
    setIcon(cat.icon || "Tag");
    setColor(cat.color || "#10B981");
    setSubcategories(cat.subcategories || []);
    setShowModal(true);
  };

  const addSubcategory = () => {
    if (newSubInput.trim() && !subcategories.includes(newSubInput.trim())) {
      setSubcategories([...subcategories, newSubInput.trim()]);
      setNewSubInput("");
    }
  };

  const removeSubcategory = (sub: string) => {
    setSubcategories(subcategories.filter((s) => s !== sub));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        type,
        icon,
        color,
        subcategories,
      };

      const url = editingCat ? `/api/categories/${editingCat.id}` : "/api/categories";
      const method = editingCat ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchCategories();
      }
    } catch (err) {
      console.error("Save category error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error("Delete category error:", err);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === activeTypeTab);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Categories</h2>
          <p className="text-xs text-gray-400">Organize your expenses and income sources</p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/20 transition touch-target"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#141A24] rounded-2xl border border-[#263145] max-w-xs">
        <button
          onClick={() => setActiveTypeTab("EXPENSE")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTypeTab === "EXPENSE" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-gray-400"
          }`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTypeTab("INCOME")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
            activeTypeTab === "INCOME" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-gray-400"
          }`}
        >
          Income
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
          <p className="text-xs text-gray-400">Loading categories...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-[#141A24] border border-[#263145] hover:border-blue-500/40 rounded-3xl p-5 shadow-xl space-y-3 flex flex-col justify-between transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: cat.color || "#10B981" }}
                  >
                    <IconHelper name={cat.icon || "Tag"} className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-base text-white">{cat.name}</h4>
                </div>

                <div className="flex items-center gap-1">
                  <button onClick={() => openEditModal(cat)} className="p-1.5 text-gray-400 hover:text-blue-400 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Subcategories */}
              <div className="pt-2 border-t border-[#263145]/60">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Subcategories</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.subcategories && cat.subcategories.length > 0 ? (
                    cat.subcategories.map((sub) => (
                      <span key={sub} className="text-xs px-2.5 py-1 rounded-xl bg-[#1C2433] text-gray-300 border border-[#263145]">
                        {sub}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No subcategories</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <h3 className="font-bold text-white text-lg">{editingCat ? "Edit Category" : "Add Category"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dining Out"
                  className="w-full p-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white"
                />
              </div>

              {/* Subcategories Input */}
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-400 mb-1">Subcategories</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newSubInput}
                    onChange={(e) => setNewSubInput(e.target.value)}
                    placeholder="Add subcategory..."
                    className="flex-1 p-2.5 rounded-xl bg-[#1C2433] border border-[#263145] text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={addSubcategory}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {subcategories.map((sub) => (
                    <span key={sub} className="text-xs px-2.5 py-1 rounded-xl bg-[#1C2433] text-gray-200 border border-[#263145] flex items-center gap-1.5">
                      <span>{sub}</span>
                      <button type="button" onClick={() => removeSubcategory(sub)} className="text-gray-400 hover:text-red-400">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-medium hover:bg-[#263145]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
