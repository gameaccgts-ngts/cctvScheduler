/**
 * Drop-in JSON loader for the Child Life Calendar display PC.
 *
 * The display PC has no network, so the week's calendar arrives on a drive as
 * a `calendar-data.json` produced by tools/calendar-converter.html. Drop that
 * file next to `Child Life Calendar.html`, refresh, and this imports it.
 *
 * It imports each file exactly once: the stamp of the last import is kept in
 * localStorage, so a reboot does not undo edits made on the display PC. A new
 * file has a new stamp, so it comes in on the next refresh.
 */

'use strict';

const DROP_IN_FILE = 'calendar-data.json';
const DROP_IN_STAMP_KEY = 'childLifeCalendarImportStamp';

class CalendarDropInLoader {
    constructor(calendar) {
        this.calendar = calendar;
    }

    /**
     * Looks for the drop-in file and imports it if it is new.
     * Never rejects: an unhandled rejection would trip the self-heal watchdog
     * in app-server-version.js and reload the display in a loop.
     */
    async check() {
        try {
            const response = await fetch(DROP_IN_FILE, { cache: 'no-store' });
            if (!response.ok) {
                console.log(`📄 No ${DROP_IN_FILE} to import (${response.status})`);
                return;
            }

            const text = await response.text();
            const data = JSON.parse(text);

            if (!this.isUsable(data)) {
                console.warn(`📄 ${DROP_IN_FILE} does not look like calendar data — ignoring it`);
                this.toast('Calendar file could not be read', 'error');
                return;
            }

            const stamp = this.stampFor(data, text);
            if (stamp === localStorage.getItem(DROP_IN_STAMP_KEY)) {
                console.log('📄 Calendar file already imported — leaving current data alone');
                return;
            }

            this.apply(data);
            localStorage.setItem(DROP_IN_STAMP_KEY, stamp);

            const label = this.weekLabel();
            console.log(`✅ Imported ${DROP_IN_FILE} (week of ${label})`);
            this.toast(`New calendar loaded — week of ${label}`, 'success');
        } catch (error) {
            // A missing file on file:// throws rather than 404s; that is fine.
            console.warn(`📄 Could not import ${DROP_IN_FILE}:`, error.message);
        }
    }

    isUsable(data) {
        return !!data && typeof data === 'object' && Array.isArray(data.events) && data.events.length > 0;
    }

    /**
     * Identifies this particular file. The converter stamps every export with
     * generatedAt; anything hand-made falls back to a hash of the contents.
     */
    stampFor(data, text) {
        if (typeof data.generatedAt === 'string' && data.generatedAt) return data.generatedAt;

        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
        }
        return 'hash:' + (hash >>> 0).toString(36);
    }

    apply(data) {
        const calendar = this.calendar;

        // Events: always exactly 21 (Mon-Sun x Morning/Afternoon/Evening).
        const events = new Array(21).fill('No Event');
        for (let i = 0; i < 21; i++) {
            const value = data.events[i];
            if (typeof value === 'string' && value.trim()) events[i] = value;
        }
        calendar.events = events;

        if (data.weekStart) {
            const weekStart = new Date(data.weekStart);
            if (!isNaN(weekStart.getTime())) calendar.selectedWeekStart = weekStart;
        }

        const month = parseInt(data.month, 10);
        if (month >= 1 && month <= 12) {
            calendar.currentMonth = month;
            const monthSelect = document.getElementById('monthSelect');
            if (monthSelect) monthSelect.value = month;
        }

        // Videos are scheduled on this PC, not in the emailed calendar, so put
        // the "Channel 16: ..." lines back on top of the freshly imported text.
        calendar.syncVideoScheduleToEvents();
        calendar.saveCalendarData();

        calendar.applyMonthTheme(calendar.currentMonth);
        calendar.updateWeekDisplay();
        calendar.updateInputs();
        calendar.updateQRCode();
        calendar.updateDisplay();
    }

    weekLabel() {
        const start = this.calendar.selectedWeekStart;
        return start.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
    }

    /**
     * Brief on-screen note. Styled inline so the display PC only ever needs
     * this one extra file copied over.
     */
    toast(message, kind) {
        const el = document.createElement('div');
        el.textContent = message;
        el.style.cssText = [
            'position:fixed',
            'top:20px',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:99999',
            'padding:14px 26px',
            'border-radius:8px',
            'font-family:Arial, sans-serif',
            'font-size:20px',
            'font-weight:700',
            'color:#fff',
            'box-shadow:0 4px 18px rgba(0,0,0,0.45)',
            'background:' + (kind === 'error' ? '#e74c3c' : '#2ecc71')
        ].join(';');

        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
    }
}

window.CalendarDropInLoader = CalendarDropInLoader;
