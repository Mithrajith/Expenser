"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  Clock3,
  Edit2,
  Loader2,
  Mail,
  Plus,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  buildReminderTimeValue,
  formatReminderSchedule,
  getMonthDayOptions,
  getWeekdayOptions,
  parseReminderTimeValue,
  type ReminderRepeat,
} from "@/lib/reminders";

type Reminder = {
  id: string;
  title: string;
  message: string;
  time: string;
  repeat: ReminderRepeat;
  enabled: boolean;
  last_sent_at?: string;
};

const initialFormState = {
  title: "",
  message: "",
  repeat: "daily" as ReminderRepeat,
  enabled: true,
  time: "20:00",
  onceDate: new Date().toISOString().substring(0, 10),
  weekday: 0,
  monthDay: 1,
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(initialFormState);
  const [showForm, setShowForm] = useState(false);

  const weekdayOptions = useMemo(() => getWeekdayOptions(), []);
  const monthDayOptions = useMemo(() => getMonthDayOptions(), []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reminders");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reminders");
      setReminders((data.reminders || []) as Reminder[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialFormState);
    setShowForm(false);
    setError("");
    setSuccess("");
  };

  const handleEdit = (reminder: Reminder) => {
    const parts = parseReminderTimeValue(reminder.repeat, reminder.time);
    setEditingId(reminder.id);
    setForm({
      title: reminder.title,
      message: reminder.message,
      repeat: reminder.repeat,
      enabled: reminder.enabled,
      time: parts.clock,
      onceDate:
        reminder.repeat === "once"
          ? parts.date || new Date().toISOString().substring(0, 10)
          : initialFormState.onceDate,
      weekday: reminder.repeat === "weekly" ? parts.weekday || 0 : 0,
      monthDay: reminder.repeat === "monthly" ? parts.dayOfMonth || 1 : 1,
    });
    setShowForm(true);
    setError("");
    setSuccess("");
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const reminderTime = buildReminderTimeValue({
      repeat: form.repeat,
      date: form.onceDate,
      time: form.time,
      weekday: form.weekday,
      dayOfMonth: form.monthDay,
    });

    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        time: reminderTime,
        repeat: form.repeat,
        enabled: form.enabled,
      };

      const res = await fetch(editingId ? `/api/reminders/${editingId}` : "/api/reminders", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save reminder");

      setSuccess(editingId ? "Reminder updated" : "Reminder created");
      resetForm();
      await loadReminders();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reminder?")) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete reminder");
      setSuccess("Reminder deleted");
      await loadReminders();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete reminder");
    }
  };

  const toggleReminder = async (reminder: Reminder) => {
    try {
      const res = await fetch(`/api/reminders/${reminder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reminder, enabled: !reminder.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update reminder");
      await loadReminders();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to update reminder");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Reminders</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Get email reminders for bills, spending reviews &amp; recurring money tasks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(initialFormState);
            setError("");
            setSuccess("");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold hover:from-blue-500 hover:to-cyan-400 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Global alerts */}
      {error && !showForm && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && !showForm && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        {/* ── Left column: Add / Edit form ─────────────────────────── */}
        {showForm && (
          <form
            onSubmit={handleSave}
            className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4"
          >
            {/* Form header */}
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingId ? "Edit Reminder" : "New Reminder"}
                </h3>
                <p className="text-xs text-gray-400">
                  An email will be sent to your registered address.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Reminder Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="💰 Add Expenses"
                required
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Email Message
              </label>
              <textarea
                value={form.message}
                onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
                className="w-full min-h-24 px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="Don't forget to add today's expenses."
                required
              />
            </div>

            {/* Repeat */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Repeat
              </label>
              <select
                value={form.repeat}
                onChange={(e) => setForm((c) => ({ ...c, repeat: e.target.value as ReminderRepeat }))}
                className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Date/time pickers based on repeat */}
            {form.repeat === "once" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Date
                  </label>
                  <input
                    type="date"
                    value={form.onceDate}
                    onChange={(e) => setForm((c) => ({ ...c, onceDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {form.repeat === "daily" && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                  Time
                </label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {form.repeat === "weekly" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Day
                  </label>
                  <select
                    value={form.weekday}
                    onChange={(e) => setForm((c) => ({ ...c, weekday: Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  >
                    {weekdayOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {form.repeat === "monthly" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Day of Month
                  </label>
                  <select
                    value={form.monthDay}
                    onChange={(e) => setForm((c) => ({ ...c, monthDay: Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  >
                    {monthDayOptions.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((c) => ({ ...c, time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-[#1C2433] border border-[#263145] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Enable toggle */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#1C2433] border border-[#263145] cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-white">Enable reminder</p>
                <p className="text-xs text-gray-400">Turn it off without deleting it.</p>
              </div>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((c) => ({ ...c, enabled: e.target.checked }))}
                className="w-5 h-5 accent-cyan-500"
              />
            </label>

            {/* Schedule preview */}
            <div className="rounded-2xl bg-[#1C2433] border border-[#263145] p-4 space-y-1 text-xs text-gray-300">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-1">
                <Clock3 className="w-4 h-4" />
                <span>Preview</span>
              </div>
              <p className="font-semibold text-white">{form.title || "Reminder title"}</p>
              <p>
                {formatReminderSchedule({
                  repeat: form.repeat,
                  time: buildReminderTimeValue({
                    repeat: form.repeat,
                    date: form.onceDate,
                    time: form.time,
                    weekday: form.weekday,
                    dayOfMonth: form.monthDay,
                  }),
                })}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:from-blue-500 hover:to-cyan-400 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{editingId ? "Update Reminder" : "Save Reminder"}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 rounded-xl bg-[#1C2433] text-gray-300 font-semibold hover:bg-[#263145] transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Right column: Email info + reminder list ──────────────── */}
        <div className="space-y-4">
          {/* Email delivery info card */}
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Email Reminders</p>
                <p className="text-xs text-gray-400">
                  Emails are sent to your registered address at the scheduled time — even when the
                  app is closed.
                </p>
              </div>
            </div>
          </div>

          {/* Reminders list */}
          <div className="bg-[#141A24] border border-[#263145] rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#263145] pb-3">
              <h3 className="text-lg font-bold text-white">Your Reminders</h3>
              <span className="text-xs text-gray-400">{reminders.length} total</span>
            </div>

            {loading ? (
              <div className="space-y-3" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-2xl bg-[#1C2433] border border-[#263145] animate-pulse"
                  />
                ))}
              </div>
            ) : reminders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#263145] p-8 text-center space-y-2">
                <Bell className="w-8 h-8 text-gray-600 mx-auto" />
                <p className="text-base font-semibold text-gray-300">No reminders yet</p>
                <p className="text-xs text-gray-500">
                  Tap <strong>+ Add Reminder</strong> to create your first one.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="rounded-2xl bg-[#1C2433] border border-[#263145] p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-white truncate">{reminder.title}</h4>
                        <p className="text-xs text-gray-400 mt-1 whitespace-pre-line line-clamp-2">
                          {reminder.message}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleReminder(reminder)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border transition shrink-0"
                        title={reminder.enabled ? "Disable reminder" : "Enable reminder"}
                      >
                        {reminder.enabled ? (
                          <ToggleRight className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-4 h-4 text-gray-500" />
                        )}
                        <span className={reminder.enabled ? "text-emerald-400" : "text-gray-400"}>
                          {reminder.enabled ? "ON" : "OFF"}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                      <span className="px-2 py-1 rounded-full bg-[#141A24] border border-[#263145]">
                        {formatReminderSchedule(reminder)}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-[#141A24] border border-[#263145] capitalize">
                        {reminder.repeat}
                      </span>
                      {reminder.last_sent_at && (
                        <span className="px-2 py-1 rounded-full bg-[#141A24] border border-[#263145] text-gray-500">
                          Last sent{" "}
                          {new Date(reminder.last_sent_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(reminder)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141A24] border border-[#263145] text-gray-200 text-xs font-semibold hover:border-blue-500/50 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(reminder.id)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141A24] border border-[#263145] text-red-400 text-xs font-semibold hover:border-red-500/50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
